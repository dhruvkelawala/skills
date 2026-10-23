import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const LAND = fileURLToPath(new URL("./land.mjs", import.meta.url));
const GIT_ENV = {
  ...process.env,
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_CONFIG_NOSYSTEM: "1",
  GIT_AUTHOR_NAME: "Fixture",
  GIT_AUTHOR_EMAIL: "fixture@example.com",
  GIT_COMMITTER_NAME: "Fixture",
  GIT_COMMITTER_EMAIL: "fixture@example.com",
};

// A build's worktree: a branch with one commit on origin's main, and a run record whose `base_ref`
// is origin's main, as stage 1 writes it. `restack` lands someone else's change on main and rebases
// the branch onto it, which keeps the branch's patch. `change` commits a change to the branch's patch.
function worktree(t) {
  const dir = mkdtempSync(join(tmpdir(), "issue-to-pr-land-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const origin = join(dir, "origin.git");
  const work = join(dir, "work");
  const record = join(dir, "7.md");
  const git = (...args) => execFileSync("git", args, { cwd: work, env: GIT_ENV, encoding: "utf8" }).trim();
  const commit = (file, text, message) => {
    writeFileSync(join(work, file), text);
    git("add", file);
    git("commit", "--quiet", "-m", message);
    return git("rev-parse", "HEAD");
  };
  execFileSync("git", ["init", "--quiet", "--bare", "--initial-branch=main", origin], { env: GIT_ENV });
  mkdirSync(work);
  git("init", "--quiet", "--initial-branch=main");
  git("remote", "add", "origin", origin);
  commit("score.txt", "round\nscore: none\ntotal\n", "base");
  git("push", "--quiet", "origin", "main");
  git("checkout", "--quiet", "-b", "feat/7-show-score");
  const head = commit("score.txt", "round\nscore: 12\ntotal\n", "feat: show the score");
  writeFileSync(record, [
    "issue: https://github.com/o/r/issues/7",
    "base_ref: refs/remotes/origin/main",
    `head: ${head}`,
    "repairs: 0/10",
    "pr: https://github.com/o/r/pull/8",
    "",
    "## Contract",
    "",
  ].join("\n"));
  return {
    record,
    head,
    land: (...args) => spawnSync(process.execPath, [LAND, ...args], { cwd: work, env: GIT_ENV, encoding: "utf8" }),
    held: () => readFileSync(record, "utf8").match(/^land: (.+)$/m)?.[1],
    restack() {
      git("checkout", "--quiet", "main");
      commit("other.txt", "someone else's change\n", "other");
      git("push", "--quiet", "origin", "main");
      git("checkout", "--quiet", "feat/7-show-score");
      git("rebase", "--quiet", "main");
      return git("rev-parse", "HEAD");
    },
    change: (text) => commit("score.txt", text, "fix: the score"),
  };
}

test("a land said before the PR is clean lands at a clean head with the same patch, a restack included, and is dropped after a push that changes the patch", (t) => {
  const build = worktree(t);
  const hold = build.land("hold", build.record, "--head", build.head);
  assert.equal(hold.status, 0, hold.stderr);
  assert.match(build.held(), new RegExp(`^held at ${build.head}, patch [0-9a-f]{64}$`));

  const atTheHead = build.land("check", build.record);
  assert.equal(atTheHead.status, 0, `the head "land" was said at: ${atTheHead.stdout}${atTheHead.stderr}`);

  const restacked = build.restack();
  assert.notEqual(restacked, build.head);
  const afterRestack = build.land("check", build.record);
  assert.equal(afterRestack.status, 0, `a restack keeps the patch: ${afterRestack.stdout}${afterRestack.stderr}`);

  build.change("round\nscore: 12 points\ntotal\n");
  const afterPush = build.land("check", build.record);
  assert.equal(afterPush.status, 1, `a push that changes the patch must not land: ${afterPush.stdout}`);
  assert.match(afterPush.stdout, /dropped/);
  assert.match(build.held(), /^dropped\b/);
  assert.equal(build.land("check", build.record).status, 1, "a dropped land stays dropped");
});

test("a land is tied to the PR's head the user saw, not to a commit the thread hasn't pushed yet", (t) => {
  const build = worktree(t);
  build.change("round\nscore: 12, unpushed\ntotal\n");
  const hold = build.land("hold", build.record, "--head", build.head);
  assert.equal(hold.status, 0, hold.stderr);
  const check = build.land("check", build.record);
  assert.equal(check.status, 1, `a commit the user never saw must not land: ${check.stdout}`);
  assert.match(build.held(), /^dropped\b/);
});

test("--merge from the build's start lands whatever patch the PR has once it is clean", (t) => {
  const build = worktree(t);
  assert.equal(build.land("check", build.record).status, 1, "nothing held, nothing lands");
  assert.equal(build.land("hold", build.record, "--merge").status, 0);
  build.change("round\nscore: 12 points\ntotal\n");
  const check = build.land("check", build.record);
  assert.equal(check.status, 0, check.stdout + check.stderr);
});
