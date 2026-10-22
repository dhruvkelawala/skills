#!/usr/bin/env node
// sync-skills: give each agent's skill folder this checkout's skills and the outside skills that
// outside-skills.json pins.
//
//   node scripts/sync-skills.mjs
//
// This repo's skills are linked from the checkout the script runs in. Each outside skill is
// unpacked once into ~/.agents/skills at its pinned commit, and the other agent folders link to
// that copy, so an agent that reads several folders finds one skill.

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, renameSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, posix } from "node:path";
import { fileURLToPath } from "node:url";

try {
  main();
} catch (error) {
  console.error(`sync-skills: ${error.message}`);
  process.exit(1);
}

function main() {
  const checkout = realpathSync(fileURLToPath(new URL("..", import.meta.url)));
  const home = homedir();
  const own = ownSkills(checkout);
  const outside = readList(join(checkout, "outside-skills.json"), own);
  const cache = join(process.env.XDG_CACHE_HOME?.trim() || join(home, ".cache"), "sync-skills");
  for (const skill of outside) skill.pinned = pinnedFiles(cache, skill);

  const { store, folders } = agentFolders(home, process.env);
  for (const folder of folders) {
    const steps = planFolder(folder, store, checkout, own, outside);
    if (steps.length) mkdirSync(folder, { recursive: true });
    for (const step of steps) step.apply();
  }
}

function ownSkills(checkout) {
  const dir = join(checkout, "skills");
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(dir, entry.name, "SKILL.md")))
    .map((entry) => entry.name)
    .sort();
}

// The list uses the entry shape `npx skills` writes to its lock file, with `ref` pinned to a commit.
function readList(path, own) {
  const { skills = {} } = JSON.parse(readFileSync(path, "utf8"));
  return Object.entries(skills).map(([name, entry]) => {
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(name)) throw new Error(`${JSON.stringify(name)} is not a skill name`);
    if (own.includes(name)) throw new Error(`${name} is one of this repo's skills, so the list cannot name it too`);
    if (!/^[0-9a-f]{40}$/.test(entry.ref ?? "")) throw new Error(`${name}: ref must be a full commit SHA, not ${JSON.stringify(entry.ref)}`);
    if (!entry.source || !entry.sourceUrl || !/(^|\/)SKILL\.md$/.test(entry.skillPath ?? "")) {
      throw new Error(`${name}: needs a source, a sourceUrl and a skillPath that ends in SKILL.md`);
    }
    return { name, ...entry };
  });
}

// Agent folders that resolve to one real folder are synced once, so none is linked to itself.
function agentFolders(home, env) {
  const real = (path) => (existsSync(path) ? realpathSync(path) : path);
  const store = real(join(home, ".agents", "skills"));
  const folders = [store];
  const agentHomes = [
    env.CLAUDE_CONFIG_DIR?.trim() || join(home, ".claude"),
    env.CODEX_HOME?.trim() || join(home, ".codex"),
    env.PI_CODING_AGENT_DIR?.trim() || join(home, ".pi", "agent"),
  ];
  for (const agentHome of agentHomes) {
    if (!existsSync(agentHome)) continue;
    const folder = real(join(agentHome, "skills"));
    if (!folders.includes(folder)) folders.push(folder);
  }
  return { store, folders };
}

function planFolder(folder, store, checkout, own, outside) {
  const steps = [];
  for (const name of own) {
    const path = join(folder, name);
    steps.push({ apply: () => link(join(checkout, "skills", name), path) });
  }
  for (const skill of outside) {
    const path = join(folder, skill.name);
    steps.push({ apply: folder === store ? () => install(skill.pinned, path) : () => link(join(store, skill.name), path) });
  }
  return steps;
}

function link(target, path) {
  rmSync(path, { recursive: true, force: true });
  symlinkSync(target, path);
}

// Writes into a hidden sibling first, so a failed fetch leaves the installed copy in place.
function install(pinned, path) {
  const temp = join(dirname(path), `.${basename(path)}.sync-skills`);
  rmSync(temp, { recursive: true, force: true });
  writePinned(pinned, temp);
  rmSync(path, { recursive: true, force: true });
  renameSync(temp, path);
}

// ---------- the source cache ----------
//
// One bare repo per source under the cache folder. Each pinned commit is fetched once, with its
// trees but no file contents (some sources are hundreds of megabytes), and kept under
// refs/pins/<sha>. Comparing a skill needs only the trees; installing one fetches its files.

function pinnedFiles(cache, skill) {
  const repo = join(cache, `${skill.source.replace(/[^\w.-]+/g, "_")}.git`);
  if (!hasPin(repo, skill.ref)) fetchPin(repo, skill);
  const dir = posix.dirname(skill.skillPath);
  let listing = "";
  try {
    listing = git(repo, "ls-tree", "-r", "-z", `${skill.ref}:${dir === "." ? "" : dir}`);
  } catch {}
  const files = listing
    .split("\0")
    .filter(Boolean)
    .map((line) => {
      const [meta, path] = line.split("\t");
      const [mode, type, id] = meta.split(" ");
      return { mode: normalMode(mode), type, id, path };
    })
    .filter((file) => file.type === "blob");
  if (!files.some((file) => file.path === "SKILL.md")) {
    throw new Error(`${skill.name}: ${skill.source}@${skill.ref.slice(0, 7)} has no ${skill.skillPath}`);
  }
  return { repo, files };
}

function hasPin(repo, ref) {
  if (!existsSync(repo)) return false;
  try {
    git(repo, "rev-parse", "--verify", "--quiet", `refs/pins/${ref}`);
    return true;
  } catch {
    return false;
  }
}

function fetchPin(repo, skill) {
  if (!existsSync(repo)) {
    mkdirSync(repo, { recursive: true });
    git(repo, "init", "--quiet", "--bare");
    git(repo, "config", "remote.origin.promisor", "true");
    git(repo, "config", "remote.origin.partialclonefilter", "blob:none");
  }
  git(repo, "config", "remote.origin.url", skill.sourceUrl);
  try {
    git(repo, "fetch", "--quiet", "--no-tags", "--depth", "1", "--filter=blob:none", "origin", `${skill.ref}:refs/pins/${skill.ref}`);
  } catch (error) {
    throw new Error(`${skill.name}: cannot fetch ${skill.ref} from ${skill.sourceUrl}: ${lastLine(error)}`);
  }
}

function writePinned({ repo, files }, dest) {
  const ids = files.map((file) => file.id);
  git(repo, "-c", "fetch.negotiationAlgorithm=noop", "fetch", "--quiet", "--no-tags", "--no-write-fetch-head", "--recurse-submodules=no", "--filter=blob:none", "origin", ...ids);
  const out = execFileSync("git", ["-C", repo, "cat-file", "--batch"], { input: `${ids.join("\n")}\n`, maxBuffer: 1 << 30, env: gitEnv() });
  let at = 0;
  for (const file of files) {
    const headerEnd = out.indexOf(10, at);
    const [id, type, size] = out.toString("latin1", at, headerEnd).split(" ");
    if (id !== file.id || type !== "blob") throw new Error(`the cache is missing ${file.path} (${file.id})`);
    const contents = out.subarray(headerEnd + 1, headerEnd + 1 + Number(size));
    at = headerEnd + 1 + Number(size) + 1;
    const path = join(dest, file.path);
    mkdirSync(dirname(path), { recursive: true });
    if (file.mode === "120000") symlinkSync(contents.toString(), path);
    else writeFileSync(path, contents, { mode: file.mode === "100755" ? 0o755 : 0o644 });
  }
}

function normalMode(mode) {
  return mode === "120000" || mode === "100755" ? mode : "100644";
}

function git(repo, ...args) {
  return execFileSync("git", ["-C", repo, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], env: gitEnv() });
}

function gitEnv() {
  return { ...process.env, GIT_TERMINAL_PROMPT: "0" };
}

function lastLine(error) {
  return String(error.stderr ?? error.message).trim().split("\n").pop();
}
