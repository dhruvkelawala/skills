import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const AFTER_MERGE = fileURLToPath(new URL("./after-merge.mjs", import.meta.url));
const GIT_ENV = {
  ...process.env,
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_CONFIG_NOSYSTEM: "1",
  GIT_AUTHOR_NAME: "Fixture",
  GIT_AUTHOR_EMAIL: "fixture@example.com",
  GIT_COMMITTER_NAME: "Fixture",
  GIT_COMMITTER_EMAIL: "fixture@example.com",
};

// The project's main checkout of o/r, with a bare origin and a gh on PATH that answers for the PRs
// in `github`: GraphQL's `gh pr view` while the PR has `graphql: true`, and otherwise the rate-limit
// error GitHub gives once the account's quota is spent, which leaves REST's `gh api` to answer.
// `build(n)` makes PR n's branch in a worktree of its own, the way T3 makes a build's, and pushes it.
// The repository ignores `.env` and `node_modules/`, as most projects do.
function project(t) {
  const dir = mkdtempSync(join(tmpdir(), "issue-to-pr-after-merge-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const origin = join(dir, "origin.git");
  const main = join(dir, "skills");
  const github = {};
  const git = (cwd, ...args) => execFileSync("git", args, { cwd, env: GIT_ENV, encoding: "utf8" }).trim();
  const commit = (cwd, file, text) => {
    writeFileSync(join(cwd, file), text);
    git(cwd, "add", file);
    git(cwd, "commit", "--quiet", "-m", `change ${file}`);
    return git(cwd, "rev-parse", "HEAD");
  };
  execFileSync("git", ["init", "--quiet", "--bare", "--initial-branch=main", origin], { env: GIT_ENV });
  mkdirSync(main);
  git(main, "init", "--quiet", "--initial-branch=main");
  git(main, "remote", "add", "origin", origin);
  commit(main, "README.md", "skills\n");
  commit(main, ".gitignore", ".env\nnode_modules/\n");
  git(main, "push", "--quiet", "-u", "origin", "main");
  mkdirSync(join(dir, "bin"));
  writeFileSync(join(dir, "bin", "gh"), `#!/usr/bin/env node
const github = JSON.parse(require("node:fs").readFileSync(${JSON.stringify(join(dir, "github.json"))}, "utf8"));
const args = process.argv.slice(2);
const answer = (value) => { process.stdout.write(JSON.stringify(value)); process.exit(0); };
const fail = (message) => { process.stderr.write(message + "\\n"); process.exit(1); };
if (args[0] === "pr" && args[1] === "view") {
  const pr = github[args[2].split("/").pop()];
  if (!pr?.graphql) fail("GraphQL: API rate limit already exceeded for user ID 1.");
  answer({ state: pr.state, headRefName: pr.branch, headRefOid: pr.head, baseRefName: "main" });
}
const rest = (args[1] ?? "").match(/^repos\\/o\\/r\\/pulls\\/(\\d+)$/);
if (args[0] === "api" && rest && github[rest[1]]) {
  const pr = github[rest[1]];
  answer({ state: pr.state === "OPEN" ? "open" : "closed", merged: pr.state === "MERGED", head: { ref: pr.branch, sha: pr.head }, base: { ref: "main" } });
}
fail("gh: Not Found (HTTP 404)");
`, { mode: 0o755 });
  const publish = () => writeFileSync(join(dir, "github.json"), JSON.stringify(github));
  publish();
  return {
    main,
    git,
    commit,
    build(n, { inMainCheckout = false } = {}) {
      const branch = `feat/${n}-change`;
      const checkout = inMainCheckout ? main : join(dir, "worktrees", branch.replace("/", "-"));
      if (inMainCheckout) git(main, "switch", "--quiet", "-c", branch);
      else git(main, "worktree", "add", "--quiet", "-b", branch, checkout, "main");
      const head = commit(checkout, `change-${n}.txt`, `PR ${n}\n`);
      git(checkout, "push", "--quiet", "-u", "origin", branch);
      return { branch, checkout, head };
    },
    pr(n, { branch, head }, state, { graphql = true } = {}) {
      github[n] = { state, branch, head, graphql };
      publish();
    },
    afterMerge: (n, cwd) => spawnSync(process.execPath, [AFTER_MERGE, `https://github.com/o/r/pull/${n}`], {
      cwd, encoding: "utf8", env: { ...GIT_ENV, PATH: `${join(dir, "bin")}:${process.env.PATH}` },
    }),
    branches: () => git(main, "branch", "--list", "--format=%(refname:short)").split("\n").filter(Boolean),
    onOrigin: (branch) => git(main, "ls-remote", "--heads", "origin", `refs/heads/${branch}`) !== "",
  };
}

test("once a PR merged, its worktree, its local branch and origin's branch are gone, read through GraphQL or, with its quota spent, REST", (t) => {
  const repo = project(t);
  const built = repo.build(7);
  repo.pr(7, built, "MERGED");
  mkdirSync(join(built.checkout, "node_modules", "left-pad"), { recursive: true });
  writeFileSync(join(built.checkout, "node_modules", "left-pad", "index.js"), "// installed by the project's setup\n");
  const run = repo.afterMerge(7, built.checkout);
  assert.equal(run.status, 0, run.stdout + run.stderr);
  assert.equal(existsSync(built.checkout), false, "the build's worktree is removed");
  assert.deepEqual(repo.branches(), ["main"]);
  assert.equal(repo.onOrigin(built.branch), false, "origin's branch is deleted");
  assert.doesNotMatch(repo.git(repo.main, "worktree", "list"), /feat-7/);

  // An /apr thread publishes from the project's main checkout, which stays and goes back to main.
  const published = repo.build(8, { inMainCheckout: true });
  repo.pr(8, published, "MERGED", { graphql: false });
  const fromMain = repo.afterMerge(8, repo.main);
  assert.equal(fromMain.status, 0, fromMain.stdout + fromMain.stderr);
  assert.equal(repo.git(repo.main, "branch", "--show-current"), "main");
  assert.deepEqual(repo.branches(), ["main"]);
  assert.equal(repo.onOrigin(published.branch), false);
});

test("nothing goes before the PR merges, and a merged PR keeps whatever could lose work", (t) => {
  const repo = project(t);
  const open = repo.build(9);
  repo.pr(9, open, "OPEN");
  const notMerged = repo.afterMerge(9, open.checkout);
  assert.equal(notMerged.status, 2, notMerged.stdout);
  assert.equal(existsSync(open.checkout), true);
  assert.equal(repo.onOrigin(open.branch), true);

  const dirty = repo.build(10);
  repo.pr(10, dirty, "MERGED");
  writeFileSync(join(dirty.checkout, "notes.txt"), "not committed\n");
  const keptDirty = repo.afterMerge(10, repo.main);
  assert.equal(keptDirty.status, 1, keptDirty.stdout + keptDirty.stderr);
  assert.match(keptDirty.stdout, /kept .*feat-10-change.*uncommitted/);
  assert.equal(existsSync(join(dirty.checkout, "notes.txt")), true, "the uncommitted file is still there");
  assert.ok(repo.branches().includes(dirty.branch));

  const ahead = repo.build(11);
  repo.pr(11, ahead, "MERGED");
  repo.commit(ahead.checkout, "follow-up.txt", "never pushed\n");
  const keptAhead = repo.afterMerge(11, repo.main);
  assert.equal(keptAhead.status, 1, keptAhead.stdout + keptAhead.stderr);
  assert.match(keptAhead.stdout, /kept .*feat\/11-change.*never had/);
  assert.equal(existsSync(ahead.checkout), true);
  assert.ok(repo.branches().includes(ahead.branch));

  const withEnv = repo.build(12);
  repo.pr(12, withEnv, "MERGED");
  writeFileSync(join(withEnv.checkout, ".env"), "API_TOKEN=only-here\n");
  const keptEnv = repo.afterMerge(12, repo.main);
  assert.equal(keptEnv.status, 1, keptEnv.stdout + keptEnv.stderr);
  assert.match(keptEnv.stdout, /kept .*feat-12-change.*\.env/);
  assert.equal(existsSync(join(withEnv.checkout, ".env")), true, "an ignored file Git doesn't keep is still there");
});
