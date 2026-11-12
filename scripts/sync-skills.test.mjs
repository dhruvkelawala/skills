import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, readlinkSync, realpathSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(new URL("./sync-skills.mjs", import.meta.url));
const caseInsensitiveDisk = existsSync(script.toUpperCase());

function machine(t, { agents = [".claude", ".codex", ".pi/agent"] } = {}) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "sync-skills-")));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const home = join(root, "home");
  for (const agent of agents) mkdirSync(join(home, agent), { recursive: true });

  const checkout = join(root, "checkout");
  mkdirSync(join(checkout, "scripts"), { recursive: true });
  copyFileSync(script, join(checkout, "scripts", "sync-skills.mjs"));
  for (const name of ["apr", "model-policy", "pr"]) write(join(checkout, "skills", name, "SKILL.md"), `this repo's ${name}\n`);

  const upstream = join(root, "upstream");
  mkdirSync(upstream);
  const git = (...args) => execFileSync("git", args, { cwd: upstream, encoding: "utf8" }).trim();
  git("init", "--quiet", "--initial-branch=main");
  git("config", "user.name", "Fixture");
  git("config", "user.email", "fixture@example.com");
  git("config", "commit.gpgsign", "false");
  git("config", "core.hooksPath", "/dev/null");
  write(join(upstream, "skills/grilling/SKILL.md"), "grilling at the pin\n");
  write(join(upstream, "skills/grilling/scripts/ask"), "#!/bin/sh\n", 0o755);
  write(join(upstream, "skills/pr/SKILL.md"), "another author's pr\n");
  git("add", ".");
  git("commit", "--quiet", "-m", "pin");
  const pin = git("rev-parse", "HEAD");
  write(join(upstream, "skills/grilling/SKILL.md"), "grilling after the pin\n");
  git("commit", "--quiet", "-am", "later");

  const entry = (name, ref = pin) => ({ source: "fixture/upstream", sourceType: "github", sourceUrl: `file://${upstream}`, ref, skillPath: `skills/${name}/SKILL.md` });
  const list = (skills) => writeFileSync(join(checkout, "outside-skills.json"), JSON.stringify({ version: 1, skills }, null, 2));
  list({ grilling: entry("grilling") });

  const run = (args = [], extraEnv = {}) => {
    const env = { ...process.env, HOME: home, ...extraEnv };
    for (const key of ["CLAUDE_CONFIG_DIR", "CODEX_HOME", "PI_CODING_AGENT_DIR", "XDG_CACHE_HOME"]) if (!(key in extraEnv)) delete env[key];
    return spawnSync(process.execPath, [join(checkout, "scripts", "sync-skills.mjs"), ...args], { env, encoding: "utf8" });
  };
  const folders = { agents: join(home, ".agents/skills"), claude: join(home, ".claude/skills"), codex: join(home, ".codex/skills"), pi: join(home, ".pi/agent/skills") };
  return { root, home, checkout, pin, entry, list, run, folders };
}

function write(path, contents, mode = 0o644) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents, { mode });
}

function kind(path) {
  if (!existsSync(path) && linkTarget(path) === null) return "missing";
  const stat = lstatSync(path);
  return stat.isSymbolicLink() ? "link" : stat.isDirectory() ? "folder" : "file";
}

// Every entry under the folders with its inode and mtime, so a rewrite with the same contents shows.
function snapshot(folders) {
  const entries = [];
  const walk = (path) => {
    const stat = lstatSync(path);
    entries.push(`${path} ${stat.ino} ${stat.mtimeMs} ${linkTarget(path) ?? ""}`);
    if (stat.isDirectory()) for (const name of readdirSync(path).sort()) walk(join(path, name));
  };
  for (const folder of folders) existsSync(folder) ? walk(folder) : entries.push(`${folder} missing`);
  return entries;
}

function linkTarget(path) {
  try {
    return lstatSync(path).isSymbolicLink() ? readlinkSync(path) : null;
  } catch {
    return null;
  }
}

test("a dry run prints every link, install, update and removal, and changes nothing", (t) => {
  const m = machine(t);
  write(join(m.folders.agents, "pr/SKILL.md"), "another author's pr\n");
  write(join(m.folders.codex, "stray/SKILL.md"), "stray\n");
  const folders = Object.values(m.folders);
  const before = snapshot(folders);

  const result = m.run(["--dry-run", "--remove-unlisted"]);
  const own = (name) => `${m.checkout}/skills/${name}`;
  assert.equal(result.stdout, [
    "~/.agents/skills",
    `  link     apr -> ${own("apr")}`,
    `  link     model-policy -> ${own("model-policy")}`,
    `  update   pr -> ${own("pr")} (was a folder)`,
    `  install  grilling from fixture/upstream@${m.pin.slice(0, 7)}`,
    "~/.claude/skills",
    `  link     apr -> ${own("apr")}`,
    `  link     model-policy -> ${own("model-policy")}`,
    `  link     pr -> ${own("pr")}`,
    "  link     grilling -> ~/.agents/skills/grilling",
    "~/.codex/skills",
    `  link     apr -> ${own("apr")}`,
    `  link     model-policy -> ${own("model-policy")}`,
    `  link     pr -> ${own("pr")}`,
    "  link     grilling -> ~/.agents/skills/grilling",
    "  remove   stray",
    "~/.pi/agent/skills",
    `  link     apr -> ${own("apr")}`,
    `  link     model-policy -> ${own("model-policy")}`,
    `  link     pr -> ${own("pr")}`,
    "  link     grilling -> ~/.agents/skills/grilling",
    "dry run: 17 changes, none made",
    "",
  ].join("\n"));
  assert.deepEqual(snapshot(folders), before);
  assert.equal(result.status, 0, result.stderr);
});

test("after a run every agent folder links this repo's skills into the checkout and holds the outside skill at its pinned commit", (t) => {
  const m = machine(t);
  // What a stray `npx skills add` left: another author's pr in the shared folder, linked from Claude's.
  write(join(m.folders.agents, "pr/SKILL.md"), "another author's pr\n");
  mkdirSync(m.folders.claude);
  symlinkSync("../../.agents/skills/pr", join(m.folders.claude, "pr"));
  // A grilling newer than the pin, as `npx skills update` would leave it.
  write(join(m.folders.agents, "grilling/SKILL.md"), "grilling after the pin\n");

  const result = m.run();
  assert.equal(result.status, 0, result.stderr);

  const store = join(m.folders.agents, "grilling");
  for (const folder of Object.values(m.folders)) {
    assert.equal(linkTarget(join(folder, "apr")), join(m.checkout, "skills/apr"), folder);
    assert.equal(linkTarget(join(folder, "pr")), join(m.checkout, "skills/pr"), folder);
    assert.equal(readFileSync(join(folder, "pr/SKILL.md"), "utf8"), "this repo's pr\n", folder);
    assert.ok(readFileSync(join(folder, "grilling/SKILL.md"), "utf8").startsWith("grilling at the pin\n"), folder);
    if (folder !== m.folders.agents) assert.equal(linkTarget(join(folder, "grilling")), store, folder);
  }
  assert.equal(kind(store), "folder", "the shared folder holds the outside skill itself");
  assert.ok(statSync(join(store, "scripts/ask")).mode & 0o100, "the pinned script keeps its executable bit");
});

test("a second run changes nothing", (t) => {
  const m = machine(t);
  assert.equal(m.run().status, 0);
  const before = snapshot(Object.values(m.folders));

  const second = m.run();
  assert.equal(second.status, 0, second.stderr);
  assert.deepEqual(snapshot(Object.values(m.folders)), before);
  assert.equal(second.stdout, "nothing to change\n");
});

test("outside skills receive the shared model policy without changing pinned scripts or duplicating it on sync", (t) => {
  const m = machine(t);
  write(join(m.checkout, "skills/model-policy/SKILL.md"), "the local model policy\n");
  const store = join(m.folders.agents, "grilling");
  assert.equal(m.run().status, 0);
  const installed = readFileSync(join(store, "SKILL.md"), "utf8");
  assert.ok(installed.startsWith("grilling at the pin\n"));
  const target = installed.match(/\]\(([^)]+model-policy\/SKILL\.md)\)/)?.[1];
  assert.ok(target, "the installed skill points to the policy");
  for (const folder of Object.values(m.folders)) {
    assert.equal(readFileSync(join(folder, "grilling", target), "utf8"), "the local model policy\n");
  }
  assert.equal(readFileSync(join(store, "scripts/ask"), "utf8"), "#!/bin/sh\n");

  const before = snapshot(Object.values(m.folders));
  const second = m.run();
  assert.equal(second.status, 0, second.stderr);
  assert.equal(second.stdout, "nothing to change\n");
  assert.deepEqual(snapshot(Object.values(m.folders)), before);

  writeFileSync(join(store, "SKILL.md"), "grilling at the pin\n");
  const dry = m.run(["--dry-run"]);
  assert.equal(dry.status, 0, dry.stderr);
  assert.equal(readFileSync(join(store, "SKILL.md"), "utf8"), "grilling at the pin\n");
  assert.match(dry.stdout, /update\s+grilling/);
  assert.equal(m.run().status, 0);
  assert.equal(readFileSync(join(store, "SKILL.md"), "utf8"), installed);
});

test("a skill that is not on the list is reported, and removed only with --remove-unlisted", (t) => {
  const m = machine(t);
  assert.equal(m.run().status, 0);
  write(join(m.folders.codex, "stray/SKILL.md"), "stray\n");
  write(join(m.folders.codex, ".system/openai-docs/SKILL.md"), "Codex's own\n");

  const plain = m.run();
  assert.equal(plain.stdout, "~/.codex/skills\n  unlisted stray\nnothing to change\n1 unlisted skill kept; --remove-unlisted removes it\n");
  assert.equal(kind(join(m.folders.codex, "stray")), "folder");

  const removing = m.run(["--remove-unlisted"]);
  assert.equal(removing.stdout, "~/.codex/skills\n  remove   stray\nmade 1 change\n");
  assert.equal(kind(join(m.folders.codex, "stray")), "missing");
  assert.equal(kind(join(m.folders.codex, ".system")), "folder", "a hidden folder such as Codex's .system is not a skill");
});

test("--remove-unlisted keeps this repo's skill when the folder holds it in other capitals", (t) => {
  const m = machine(t);
  write(join(m.folders.claude, "PR/SKILL.md"), "a stray copy\n");

  const result = m.run(["--remove-unlisted"]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(linkTarget(join(m.folders.claude, "pr")), join(m.checkout, "skills/pr"));
  assert.equal(m.run(["--remove-unlisted"]).stdout, "nothing to change\n");
});

test("a list or folder the script cannot honour stops it before anything changes", (t) => {
  const list = (skills) => (m) => m.list(skills(m));
  const cases = [
    ["names one of this repo's skills", list((m) => ({ pr: m.entry("pr") })), /pr is one of this repo's skills/],
    ["pins a branch instead of a commit", list((m) => ({ grilling: { ...m.entry("grilling"), ref: "main" } })), /grilling: ref must be a full commit SHA/],
    ["names this repo's skill in capitals", list((m) => ({ PR: m.entry("pr") })), /"PR" is not a skill name/],
    ["uses a path as a name", list((m) => ({ "../escape": m.entry("grilling") })), /"\.\.\/escape" is not a skill name/],
    ["pins a commit the source does not have", list((m) => ({ grilling: m.entry("grilling", "0".repeat(40)) })), /grilling: cannot fetch 0{40} from file:\/\//],
    ["points at a folder with no SKILL.md", list((m) => ({ grilling: { ...m.entry("grilling"), skillPath: "skills/grilling/scripts/SKILL.md" } })), /grilling: fixture\/upstream@[0-9a-f]{7} has no skills\/grilling\/scripts\/SKILL\.md/],
    ["points at a linked SKILL.md", (m) => {
      const upstream = join(m.root, "upstream");
      const skill = join(upstream, "skills/grilling/SKILL.md");
      rmSync(skill);
      symlinkSync("scripts/ask", skill);
      execFileSync("git", ["commit", "--quiet", "-am", "link the skill"], { cwd: upstream });
      const ref = execFileSync("git", ["rev-parse", "HEAD"], { cwd: upstream, encoding: "utf8" }).trim();
      m.list({ grilling: m.entry("grilling", ref) });
    }, /grilling: SKILL\.md must be a regular file/],
    ["finds an agent folder that links into this checkout", (m) => symlinkSync(join(m.checkout, "skills"), m.folders.claude), /~\/\.claude\/skills resolves into this checkout/],
    ["finds an agent folder that is this checkout", (m) => symlinkSync(m.checkout, m.folders.claude), /~\/\.claude\/skills resolves into this checkout/],
    ["finds an agent folder that holds this checkout", (m) => symlinkSync(m.root, m.folders.claude), /~\/\.claude\/skills holds this checkout/],
  ];
  if (caseInsensitiveDisk) {
    cases.push(["finds an agent folder that links into this checkout in other capitals", (m) => symlinkSync(join(m.root, "CHECKOUT", "skills"), m.folders.claude), /~\/\.claude\/skills resolves into this checkout/]);
  }
  for (const [label, arrange, message] of cases) {
    const m = machine(t);
    arrange(m);
    const watched = [...Object.values(m.folders), join(m.checkout, "skills")];
    const before = snapshot(watched);
    const result = m.run();
    assert.equal(result.status, 1, label);
    assert.match(result.stderr, message, label);
    assert.deepEqual(snapshot(watched), before, label);
  }
});

test("an agent folder that is the shared folder under another name is synced once", (t) => {
  for (const [label, sharedExists] of [["the shared folder exists", true], ["the shared folder is not made yet", false]]) {
    const m = machine(t);
    if (sharedExists) mkdirSync(m.folders.agents, { recursive: true });
    symlinkSync("../.agents/skills", m.folders.codex);

    const result = m.run();
    assert.equal(result.status, 0, `${label}: ${result.stderr}`);

    const store = join(m.folders.agents, "grilling");
    assert.equal(kind(store), "folder", `${label}: grilling stays a folder instead of a link to itself`);
    assert.ok(readFileSync(join(store, "SKILL.md"), "utf8").startsWith("grilling at the pin\n"), label);
    assert.equal(m.run().stdout, "nothing to change\n", label);
  }
});

test("an agent folder whose relative link only looks like the shared folder is synced on its own", (t) => {
  const m = machine(t, { agents: [".claude", ".pi/agent"] });
  // ~/.codex is a link, so its skills link resolves from the real folder, not from ~/.codex.
  const dotfiles = join(m.root, "dotfiles", "codex");
  mkdirSync(dotfiles, { recursive: true });
  symlinkSync(dotfiles, join(m.home, ".codex"));
  symlinkSync("../.agents/skills", join(dotfiles, "skills"));

  const result = m.run();
  assert.equal(result.status, 0, result.stderr);

  assert.equal(linkTarget(join(m.root, "dotfiles", ".agents", "skills", "pr")), join(m.checkout, "skills/pr"));
  assert.equal(readFileSync(join(m.folders.codex, "pr/SKILL.md"), "utf8"), "this repo's pr\n");
  assert.equal(kind(join(m.folders.agents, "grilling")), "folder");
});

test("each agent's folder follows its config variable, and an agent that is not installed is skipped", (t) => {
  const m = machine(t, { agents: [] });
  const claude = join(m.root, "claude-config");
  const codex = join(m.root, "codex-home");
  mkdirSync(claude);
  mkdirSync(codex);

  const result = m.run([], { CLAUDE_CONFIG_DIR: claude, CODEX_HOME: codex, PI_CODING_AGENT_DIR: join(m.root, "no-pi") });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /^pi: skipped, .*\/no-pi does not exist$/m);

  for (const folder of [join(claude, "skills"), join(codex, "skills")]) {
    assert.equal(linkTarget(join(folder, "pr")), join(m.checkout, "skills/pr"), folder);
    assert.equal(linkTarget(join(folder, "grilling")), join(m.folders.agents, "grilling"), folder);
  }
  for (const path of [join(m.home, ".claude"), join(m.home, ".codex"), join(m.home, ".pi"), join(m.root, "no-pi")]) {
    assert.equal(existsSync(path), false, path);
  }
});
