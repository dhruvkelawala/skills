import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readlinkSync, realpathSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(new URL("./sync-skills.mjs", import.meta.url));

// A machine with Claude, Codex and Pi installed, a checkout of this repo that holds `apr` and `pr`,
// and an upstream repo whose `grilling` changed after the commit the list pins.
function machine(t, { agents = [".claude", ".codex", ".pi/agent"] } = {}) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "sync-skills-")));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const home = join(root, "home");
  for (const agent of agents) mkdirSync(join(home, agent), { recursive: true });

  const checkout = join(root, "checkout");
  mkdirSync(join(checkout, "scripts"), { recursive: true });
  copyFileSync(script, join(checkout, "scripts", "sync-skills.mjs"));
  for (const name of ["apr", "pr"]) write(join(checkout, "skills", name, "SKILL.md"), `this repo's ${name}\n`);

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

function linkTarget(path) {
  try {
    return lstatSync(path).isSymbolicLink() ? readlinkSync(path) : null;
  } catch {
    return null;
  }
}

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
    assert.equal(readFileSync(join(folder, "grilling/SKILL.md"), "utf8"), "grilling at the pin\n", folder);
    if (folder !== m.folders.agents) assert.equal(linkTarget(join(folder, "grilling")), store, folder);
  }
  assert.equal(kind(store), "folder", "the shared folder holds the outside skill itself");
  assert.ok(statSync(join(store, "scripts/ask")).mode & 0o100, "the pinned script keeps its executable bit");
});

test("a list the script cannot honour stops it before any agent folder changes", (t) => {
  const cases = [
    ["names one of this repo's skills", (m) => ({ pr: m.entry("pr") }), /pr is one of this repo's skills/],
    ["pins a branch instead of a commit", (m) => ({ grilling: { ...m.entry("grilling"), ref: "main" } }), /grilling: ref must be a full commit SHA/],
    ["uses a path as a name", (m) => ({ "../escape": m.entry("grilling") }), /"\.\.\/escape" is not a skill name/],
    ["pins a commit the source does not have", (m) => ({ grilling: m.entry("grilling", "0".repeat(40)) }), /grilling: cannot fetch 0{40} from file:\/\//],
    ["points at a folder with no SKILL.md", (m) => ({ grilling: { ...m.entry("grilling"), skillPath: "skills/grilling/scripts/SKILL.md" } }), /grilling: fixture\/upstream@[0-9a-f]{7} has no skills\/grilling\/scripts\/SKILL\.md/],
  ];
  for (const [label, skills, message] of cases) {
    const m = machine(t);
    m.list(skills(m));
    const result = m.run();
    assert.equal(result.status, 1, label);
    assert.match(result.stderr, message, label);
    assert.equal(existsSync(join(m.home, ".agents")), false, label);
    assert.equal(existsSync(m.folders.claude), false, label);
  }
});

test("an agent folder that is the shared folder under another name is synced once", (t) => {
  const m = machine(t, { agents: [".claude", ".pi/agent"] });
  mkdirSync(m.folders.agents, { recursive: true });
  mkdirSync(join(m.home, ".codex"));
  symlinkSync(m.folders.agents, m.folders.codex);

  const result = m.run();
  assert.equal(result.status, 0, result.stderr);

  const store = join(m.folders.agents, "grilling");
  assert.equal(kind(store), "folder", "grilling stays a folder instead of a link to itself");
  assert.equal(readFileSync(join(store, "SKILL.md"), "utf8"), "grilling at the pin\n");
});

test("each agent's folder follows its config variable, and an agent that is not installed is skipped", (t) => {
  const m = machine(t, { agents: [] });
  const claude = join(m.root, "claude-config");
  const codex = join(m.root, "codex-home");
  mkdirSync(claude);
  mkdirSync(codex);

  const result = m.run([], { CLAUDE_CONFIG_DIR: claude, CODEX_HOME: codex, PI_CODING_AGENT_DIR: join(m.root, "no-pi") });
  assert.equal(result.status, 0, result.stderr);

  for (const folder of [join(claude, "skills"), join(codex, "skills")]) {
    assert.equal(linkTarget(join(folder, "pr")), join(m.checkout, "skills/pr"), folder);
    assert.equal(linkTarget(join(folder, "grilling")), join(m.folders.agents, "grilling"), folder);
  }
  for (const path of [join(m.home, ".claude"), join(m.home, ".codex"), join(m.home, ".pi"), join(m.root, "no-pi")]) {
    assert.equal(existsSync(path), false, path);
  }
});
