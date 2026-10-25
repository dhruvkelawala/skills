// Drives run.mjs through its command line. A run's agents are a fake claude on PATH, and its case is a scratch repo.
// From the repo root: node --test skills/verification-skill/evals/run.test.mjs
import { before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const evalsDir = dirname(fileURLToPath(import.meta.url));
const skillsDir = dirname(dirname(evalsDir));

const runner = (dir, args = [], env = process.env) => spawnSync(process.execPath, [join(dir, "run.mjs"), ...args], { encoding: "utf8", env });
const git = (cwd, ...a) => execFileSync("git", ["-c", "user.name=eval", "-c", "user.email=eval@example.com", "-c", "core.hooksPath=/dev/null", ...a], { cwd, encoding: "utf8" }).trim();
const LESSONS = ["Pin the toolchain (abb228b0).", "Wait for an element before measuring it (#12).", "Kill the whole process group (#540, #545)."];

// A copy of the skills this eval reads, so a test can add a case or a results file without touching the repo.
function scratchSkills() {
  const root = mkdtempSync(join(tmpdir(), "verification-skill-eval-test-"));
  cpSync(join(skillsDir, "verification-skill"), join(root, "skills", "verification-skill"), { recursive: true });
  cpSync(join(skillsDir, "evidence", "references", "surfaces.md"), join(root, "skills", "evidence", "references", "surfaces.md"));
  return { root, evals: join(root, "skills", "verification-skill", "evals") };
}

function writeCase(evals, name, lessons, { checkout = `/nowhere/${name}`, base = "a".repeat(40) } = {}) {
  mkdirSync(join(evals, "cases"), { recursive: true });
  writeFileSync(
    join(evals, "cases", `${name}.md`),
    `# ${name}\n\n- Repo: acme/${name}\n- Checkout: ${checkout}\n- Base: ${base}\n\n## Lessons\n\n${lessons.map((l, i) => `${i + 1}. ${l}`).join("\n")}\n`,
  );
}

// One run of a demo case, whose repo has a base commit and a later one holding the hand-fixed verify skill.
function runDemo() {
  const { root, evals } = scratchSkills();
  git(join(root, "skills"), "init", "-q");
  git(join(root, "skills"), "add", ".");
  git(join(root, "skills"), "commit", "-qm", "skills");
  const repo = join(root, "demo");
  mkdirSync(repo);
  git(repo, "init", "-q", "-b", "main");
  writeFileSync(join(repo, "README.md"), "# demo\n");
  git(repo, "add", ".");
  git(repo, "commit", "-qm", "base");
  const base = git(repo, "rev-parse", "HEAD");
  mkdirSync(join(repo, ".agents", "skills", "verify-demo"), { recursive: true });
  writeFileSync(join(repo, ".agents", "skills", "verify-demo", "SKILL.md"), "the hand-fixed answer\n");
  git(repo, "add", ".");
  git(repo, "commit", "-qm", "add the hand-fixed verify skill");
  git(repo, "remote", "add", "origin", "https://github.com/acme/demo.git");
  writeCase(evals, "demo", LESSONS, { checkout: repo, base });

  const home = join(root, "home");
  const bin = join(root, "bin");
  mkdirSync(home);
  mkdirSync(bin);
  writeFileSync(join(bin, "claude"), `#!/bin/sh\nexec "${process.execPath}" "${join(evalsDir, "fake-claude.mjs")}" "$@"\n`);
  chmodSync(join(bin, "claude"), 0o755);
  const log = join(root, "claude.log");
  const refs = git(repo, "for-each-ref");
  const env = { ...process.env, HOME: home, PATH: `${bin}:${process.env.PATH}`, FAKE_CLAUDE_LOG: log, FAKE_VERDICTS: "covered,partly,missing" };
  const { status, stdout, stderr } = runner(evals, ["demo"], env);
  const results = existsSync(join(evals, "results.md")) ? readFileSync(join(evals, "results.md"), "utf8") : "";
  const runs = join(home, ".cache", "verification-skill-evals");
  return {
    status,
    output: `${stdout}${stderr}`,
    section: results.slice(results.lastIndexOf("\n## ") + 1),
    seen: existsSync(log) ? JSON.parse(readFileSync(log, "utf8").split("\n")[0]) : {},
    runDir: existsSync(runs) ? join(runs, readdirSync(runs)[0]) : null,
    skillCommit: git(join(root, "skills"), "rev-parse", "--short", "HEAD"),
    repo,
    base,
    later: git(repo, "rev-parse", "HEAD"),
    refs,
  };
}

describe("cases", () => {
  test("lore and visaroy load, each lesson citing a commit or PR", () => {
    const { status, stdout, stderr } = runner(evalsDir);
    assert.equal(status, 0, stderr);
    assert.match(stdout, /^ {2}lore\b/m);
    assert.match(stdout, /^ {2}visaroy\b/m);
  });

  test("refuses a case with a lesson that cites no commit or PR", () => {
    const { evals } = scratchSkills();
    writeCase(evals, "uncited", ["Pin the toolchain (abb228b0).", "Wait for an element before measuring it.", "Kill the process group (#540)."]);
    const { status, stderr } = runner(evals, ["uncited"]);
    assert.equal(status, 2);
    assert.match(stderr, /lesson 2 cites no commit or PR/);
  });
});

describe("a run", () => {
  const today = new Date().toLocaleDateString("en-CA");
  let demo;
  before(() => {
    demo = runDemo();
  });

  test("the create agent works at the base with only the skill, and can't see later commits or reach GitHub", () => {
    const { seen } = demo;
    assert.equal(seen.head, demo.base, demo.output);
    assert.ok(!seen.commits.includes(demo.later), "the agent can read the commit after the base");
    assert.equal(seen.remotes, "");
    assert.notEqual(seen.gh, 0, "gh worked inside the run");
    assert.deepEqual(seen.skills.filter((f) => f.endsWith("SKILL.md")), [join("verification-skill", "SKILL.md")]);
    assert.ok(seen.skills.includes(join("evidence", "references", "surfaces.md")), "a file the skill links to is missing");
    assert.deepEqual(seen.skills.filter((f) => f.includes("evals")), [], "the agent can read the eval's lessons");
  });

  test("appends the grader's score to results.md, with the date and the skill's commit", () => {
    const { section } = demo;
    assert.match(section, new RegExp(`^## demo, ${today}, skill ${demo.skillCommit}$`, "m"), demo.output);
    assert.match(section, /^Score 1\.5 of 3 \(50%\)/m);
    assert.match(section, /^\| 1\. Pin the toolchain \(abb228b0\)\. \| covered \|$/m);
    assert.match(section, /^\| 2\. Wait for an element before measuring it \(#12\)\. \| partly \|$/m);
    assert.match(section, /^\| 3\. Kill the whole process group \(#540, #545\)\. \| missing \|$/m);
    assert.equal(demo.status, 0, demo.output);
  });

  test("stops what the agents left running and removes the checkout, keeping what create wrote", () => {
    for (const pid of demo.seen.strays ?? []) assert.throws(() => process.kill(pid, 0), { code: "ESRCH" }, `process ${pid} is still running`);
    assert.match(demo.section, /after create: node, node; after the grade: nothing/, demo.output);
    assert.ok(demo.runDir && !existsSync(join(demo.runDir, "checkout")), "the checkout is still there");
    assert.ok(existsSync(join(demo.runDir, "changes", ".agents", "skills", "verify-demo", "SKILL.md")), "the skill create wrote is gone");
    assert.equal(git(demo.repo, "for-each-ref"), demo.refs);
    assert.equal(git(demo.repo, "status", "--porcelain"), "");
  });
});
