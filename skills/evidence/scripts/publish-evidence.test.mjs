import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(new URL("./publish-evidence.sh", import.meta.url));
const env = {
  ...process.env,
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_CONFIG_NOSYSTEM: "1",
  GIT_AUTHOR_NAME: "Fixture",
  GIT_AUTHOR_EMAIL: "fixture@example.com",
  GIT_COMMITTER_NAME: "Fixture",
  GIT_COMMITTER_EMAIL: "fixture@example.com",
};
const git = (cwd, ...args) => execFileSync("git", args, { cwd, env, encoding: "utf8" }).trim();

// A bare remote, a repo that stands in for the other builds publishing to it,
// and the checkout under test, which fetched only main.
function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), "publish-evidence-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const remote = join(dir, "remote.git");
  const other = join(dir, "other");
  const checkout = join(dir, "checkout");
  git(dir, "init", "--quiet", "--bare", "--initial-branch=main", remote);
  git(dir, "init", "--quiet", "--initial-branch=main", other);
  git(other, "remote", "add", "origin", remote);
  writeFileSync(join(other, "app.txt"), "app\n");
  git(other, "add", "app.txt");
  git(other, "commit", "--quiet", "-m", "app");
  git(other, "push", "--quiet", "origin", "main");
  git(dir, "clone", "--quiet", "--single-branch", "--branch", "main", remote, checkout);

  const otherPublishes = (branch, file) => {
    const exists = spawnSync("git", ["rev-parse", "--verify", "--quiet", `refs/heads/${branch}`], { cwd: other, env }).status === 0;
    git(other, "checkout", "--quiet", ...(exists ? [branch] : ["--orphan", branch]));
    if (!exists) git(other, "rm", "-rfq", ".");
    mkdirSync(dirname(join(other, file)), { recursive: true });
    writeFileSync(join(other, file), `${file}\n`);
    git(other, "add", file);
    git(other, "commit", "--quiet", "-m", file);
    git(other, "push", "--quiet", "origin", branch);
    return git(other, "rev-parse", "HEAD");
  };
  const publish = (flags = [], capture = "capture.txt", runEnv = env) => {
    const file = join(dir, capture);
    writeFileSync(file, `${capture}\n`);
    return spawnSync("bash", [script, "--repo", "owner/name", "--label", "53", ...flags, file], { cwd: checkout, env: runEnv, encoding: "utf8" });
  };
  const onRemote = (...args) => git(remote, ...args);
  return { dir, checkout, otherPublishes, publish, onRemote };
}

const publishedPath = (run) => {
  const match = run.stdout.trim().match(/^https:\/\/github\.com\/owner\/name\/blob\/evidence\/(53\/\d{8}T\d{6}Z\/capture\.txt)\?raw=true$/);
  assert.ok(match, `unexpected output: ${run.stdout}`);
  return match[1];
};

const checkoutStates = [
  ["has no remote-tracking ref for it", () => {}],
  ["keeps a local evidence branch from an earlier run", (checkout) => git(checkout, "fetch", "--quiet", "origin", "refs/heads/evidence:refs/heads/evidence")],
  ["has a stale remote-tracking ref for it", (checkout) => git(checkout, "fetch", "--quiet", "origin", "+refs/heads/evidence:refs/remotes/origin/evidence")],
  ["tracks every branch and keeps a stale tracking ref nested under its name", (checkout) => {
    git(checkout, "config", "remote.origin.fetch", "+refs/heads/*:refs/remotes/origin/*");
    git(checkout, "update-ref", "refs/remotes/origin/evidence/field-guide", "HEAD");
  }],
];

for (const [state, setup] of checkoutStates) {
  test(`publishes on the remote's latest evidence commit when the checkout ${state}`, (t) => {
    const f = fixture(t);
    f.otherPublishes("evidence", "51/20261022T100000Z/first.txt");
    setup(f.checkout);
    const tip = f.otherPublishes("evidence", "52/20261022T100500Z/second.txt");

    const run = f.publish();

    assert.equal(run.status, 0, run.stderr);
    const path = publishedPath(run);
    assert.equal(f.onRemote("rev-parse", "evidence^"), tip);
    assert.deepEqual(f.onRemote("ls-tree", "-r", "--name-only", "evidence").split("\n"), [
      "51/20261022T100000Z/first.txt",
      "52/20261022T100500Z/second.txt",
      path,
    ]);
  });
}

test("creates the evidence branch with only a README and the capture on the first publish", (t) => {
  const f = fixture(t);

  const run = f.publish();

  assert.equal(run.status, 0, run.stderr);
  assert.equal(f.onRemote("rev-list", "--count", "evidence"), "1");
  assert.deepEqual(f.onRemote("ls-tree", "-r", "--name-only", "evidence").split("\n"), [publishedPath(run), "README.md"]);
});

test("keeps an earlier capture published under the same label in the same second", (t) => {
  const f = fixture(t);
  const bin = join(f.dir, "bin");
  mkdirSync(bin);
  writeFileSync(join(bin, "date"), "#!/bin/sh\necho 20261022T120000Z\n", { mode: 0o755 });
  const sameSecond = { ...env, PATH: `${bin}:${env.PATH}` };
  assert.equal(f.publish([], "first.txt", sameSecond).status, 0);

  const run = f.publish([], "second.txt", sameSecond);

  assert.equal(run.status, 0, run.stderr);
  assert.deepEqual(f.onRemote("ls-tree", "-r", "--name-only", "evidence").split("\n"), [
    "53/20261022T120000Z/first.txt",
    "53/20261022T120000Z/second.txt",
    "README.md",
  ]);
});

const clashes = [
  ["has a remote branch nested under it", "evidence/field-guide", [], "evidence"],
  ["would nest under a remote branch", "evidence", ["--branch", "evidence/pr"], "evidence/pr"],
];

for (const [shape, existing, flags, wanted] of clashes) {
  test(`refuses a branch name that ${shape}, and names the clash`, (t) => {
    const f = fixture(t);
    f.otherPublishes(existing, "field-guide/index.html");
    const refsBefore = f.onRemote("for-each-ref", "--format=%(refname) %(objectname)");

    const run = f.publish(flags);

    assert.equal(run.status, 1);
    assert.equal(run.stdout, "");
    assert.match(run.stderr, new RegExp(`branch '${wanted}' clashes with '${existing}' on origin`));
    assert.equal(f.onRemote("for-each-ref", "--format=%(refname) %(objectname)"), refsBefore);
  });
}
