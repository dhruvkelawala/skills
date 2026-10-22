#!/usr/bin/env node
// sync-skills: give each agent's skill folder this checkout's skills and the outside skills that
// outside-skills.json pins, and report anything else it finds there.
//
//   node scripts/sync-skills.mjs [--dry-run] [--remove-unlisted]
//
// This repo's skills are linked from the checkout the script runs in. Each outside skill is
// unpacked once into ~/.agents/skills at its pinned commit, and the other agent folders link to
// that copy, so an agent that reads several folders finds one skill. A skill that is neither is
// reported as unlisted, and removed only with --remove-unlisted. Every change prints before any is
// made, and --dry-run stops there.

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, readlinkSync, realpathSync, renameSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, posix, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const USAGE = "usage: node scripts/sync-skills.mjs [--dry-run] [--remove-unlisted]";

try {
  main(process.argv.slice(2));
} catch (error) {
  console.error(error.usage ? USAGE : `sync-skills: ${error.message}`);
  process.exit(error.usage ? 2 : 1);
}

function main(argv) {
  const flags = parseFlags(argv);
  const checkout = realpathSync(fileURLToPath(new URL("..", import.meta.url)));
  const home = homedir();
  const show = (path) => (path === home || path.startsWith(`${home}/`) ? `~${path.slice(home.length)}` : path);
  const own = ownSkills(checkout);
  const outside = readList(join(checkout, "outside-skills.json"), own);
  const cache = join(process.env.XDG_CACHE_HOME?.trim() || join(home, ".cache"), "sync-skills");
  for (const skill of outside) skill.pinned = pinnedFiles(cache, skill);

  const { store, folders, skipped } = agentFolders(home, process.env);
  const plans = folders.map((folder) => ({ folder, steps: planFolder(folder.path, store.path, checkout, own, outside, flags, show) }));
  const steps = plans.flatMap((plan) => plan.steps);
  const changes = steps.filter((step) => step.apply).length;
  const unlisted = steps.length - changes;

  for (const [agent, agentHome] of skipped) console.log(`${agent}: skipped, ${show(agentHome)} does not exist`);
  for (const { folder, steps } of plans) {
    if (steps.length) console.log(show(folder.shown));
    for (const step of steps) console.log(`  ${step.action.padEnd(8)} ${step.name}${step.detail ?? ""}`);
  }
  if (!changes) {
    console.log("nothing to change");
  } else if (flags.dryRun) {
    console.log(`dry run: ${count(changes, "change")}, none made`);
  } else {
    for (const { folder, steps } of plans) {
      if (steps.some((step) => step.apply)) mkdirSync(folder.path, { recursive: true });
      for (const step of steps) step.apply?.();
    }
    console.log(`made ${count(changes, "change")}`);
  }
  if (unlisted) console.log(`${count(unlisted, "unlisted skill")} kept; --remove-unlisted removes ${unlisted === 1 ? "it" : "them"}`);
}

function parseFlags(argv) {
  const flags = { dryRun: false, removeUnlisted: false };
  for (const arg of argv) {
    if (arg === "--dry-run") flags.dryRun = true;
    else if (arg === "--remove-unlisted") flags.removeUnlisted = true;
    else throw Object.assign(new Error(`unknown argument ${arg}`), { usage: true });
  }
  return flags;
}

function count(n, noun) {
  return `${n} ${noun}${n === 1 ? "" : "s"}`;
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
  const located = (shown) => ({ shown, path: existsSync(shown) ? realpathSync(shown) : shown });
  const store = located(join(home, ".agents", "skills"));
  const folders = [store];
  const skipped = [];
  const agents = [
    ["claude", env.CLAUDE_CONFIG_DIR?.trim() || join(home, ".claude")],
    ["codex", env.CODEX_HOME?.trim() || join(home, ".codex")],
    ["pi", env.PI_CODING_AGENT_DIR?.trim() || join(home, ".pi", "agent")],
  ];
  for (const [agent, agentHome] of agents) {
    if (!existsSync(agentHome)) {
      skipped.push([agent, agentHome]);
      continue;
    }
    const folder = located(join(agentHome, "skills"));
    if (!folders.some((other) => other.path === folder.path)) folders.push(folder);
  }
  return { store, folders, skipped };
}

// Each wanted entry is a link, or in the shared folder an outside skill's files. An entry that
// already matches gets no step, which is what makes a second run change nothing. Hidden entries,
// such as Codex's .system, belong to the agent and are left out.
function planFolder(folder, store, checkout, own, outside, flags, show) {
  const wanted = new Map();
  for (const name of own) wanted.set(name, { link: join(checkout, "skills", name) });
  for (const skill of outside) wanted.set(skill.name, folder === store ? { skill } : { link: join(store, skill.name) });

  const steps = [];
  for (const [name, want] of wanted) {
    const path = join(folder, name);
    const have = inspect(path);
    if (want.link) {
      if (have.kind === "link" && have.target === want.link) continue;
      const was = have.kind === "missing" ? "" : ` (was ${describe(have, "a folder", show)})`;
      steps.push({ action: was ? "update" : "link", name, detail: ` -> ${show(want.link)}${was}`, apply: () => link(want.link, path) });
    } else {
      if (have.kind === "folder" && sameFiles(path, want.skill.pinned.files)) continue;
      const was = have.kind === "missing" ? "" : ` (was ${describe(have, "a different copy", show)})`;
      const from = ` from ${want.skill.source}@${want.skill.ref.slice(0, 7)}`;
      steps.push({ action: was ? "update" : "install", name, detail: `${from}${was}`, apply: () => install(want.skill.pinned, path) });
    }
  }

  const present = existsSync(folder) ? readdirSync(folder).sort() : [];
  for (const name of present.filter((name) => !name.startsWith(".") && !wanted.has(name))) {
    const path = join(folder, name);
    steps.push(flags.removeUnlisted ? { action: "remove", name, apply: () => rmSync(path, { recursive: true, force: true }) } : { action: "unlisted", name });
  }
  return steps;
}

function describe(have, folderText, show) {
  return have.kind === "link" ? `a link to ${show(have.target)}` : have.kind === "folder" ? folderText : "a file";
}

function inspect(path) {
  let stat;
  try {
    stat = lstatSync(path);
  } catch (error) {
    if (error.code === "ENOENT") return { kind: "missing" };
    throw error;
  }
  if (stat.isSymbolicLink()) return { kind: "link", target: resolve(dirname(path), readlinkSync(path)) };
  return { kind: stat.isDirectory() ? "folder" : "file" };
}

// Compares in git's terms (path, mode and blob id), so an installed folder is checked against the
// pinned tree without fetching any file contents.
function sameFiles(dir, files) {
  const pinned = files.map((file) => `${file.path}\t${file.mode} ${file.id}`).sort();
  const installed = [];
  const walk = (prefix) => {
    for (const entry of readdirSync(join(dir, prefix), { withFileTypes: true })) {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      const path = join(dir, rel);
      if (entry.isDirectory()) walk(rel);
      else if (entry.isSymbolicLink()) installed.push(`${rel}\t120000 ${blobId(Buffer.from(readlinkSync(path)))}`);
      else if (entry.isFile()) installed.push(`${rel}\t${statSync(path).mode & 0o100 ? "100755" : "100644"} ${blobId(readFileSync(path))}`);
    }
  };
  walk("");
  return installed.sort().join("\n") === pinned.join("\n");
}

function blobId(contents) {
  return createHash("sha1").update(`blob ${contents.length}\0`).update(contents).digest("hex");
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
