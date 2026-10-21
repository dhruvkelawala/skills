import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { fileURLToPath } from "node:url";

const ship = fileURLToPath(new URL("./ship.mjs", import.meta.url));

test("verdict check invalidates a final blank line changed to a space-only line", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "ship-cli-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const git = (...args) => execFileSync("git", args, { cwd: dir, encoding: "utf8" }).trim();
  git("init", "--quiet", "--initial-branch=main");
  git("config", "core.hooksPath", "/dev/null");
  git("config", "user.name", "Fixture");
  git("config", "user.email", "fixture@example.com");
  git("remote", "add", "origin", dir);
  const commit = (contents) => {
    writeFileSync(join(dir, "sample.txt"), contents);
    git("add", "sample.txt");
    git("commit", "--quiet", "-m", "fixture");
    return git("rev-parse", "HEAD");
  };
  commit("first\n");
  git("checkout", "--quiet", "-b", "feature");
  const blankHead = commit("first\n\n");
  const publish = (head) => {
    git("update-ref", "refs/pull/7/head", head);
    writeFileSync(join(dir, "pr.json"), JSON.stringify({ number: 7, author: { login: "author" }, baseRefName: "main", headRefName: "feature", headRefOid: head }));
  };
  publish(blankHead);
  writeFileSync(join(dir, "comments.json"), "[]");
  mkdirSync(join(dir, "bin"));
  writeFileSync(join(dir, "bin", "gh"), `#!/usr/bin/env node
const fs = require("node:fs");
const args = process.argv.slice(2);
if (args[0] === "pr" && args[1] === "list") {
  console.log("[" + fs.readFileSync("pr.json", "utf8") + "]");
} else if (args[0] === "pr" && args[1] === "view") {
  console.log(JSON.stringify({ comments: JSON.parse(fs.readFileSync("comments.json", "utf8")) }));
} else if (args[0] === "api" && args[1] === "user") {
  console.log("reviewer");
} else if (args[0] === "pr" && args[1] === "comment") {
  fs.writeFileSync("comments.json", JSON.stringify([{ body: args[args.indexOf("--body") + 1], author: { login: "reviewer" }, createdAt: "2026-10-05T12:00:00Z" }]));
} else {
  throw new Error("Unexpected gh call: " + args.join(" "));
}
`, { mode: 0o755 });
  const cli = (...args) => JSON.parse(execFileSync(process.execPath, [ship, ...args, "--repo", "fixture/repo", "--json"], { cwd: dir, env: { ...process.env, PATH: join(dir, "bin") + ":" + process.env.PATH }, encoding: "utf8" }));
  cli("verdict", "record", "7", "PASS", "--head", blankHead, "--by", "reviewer");
  assert.equal(cli("verdict", "check", "7").status, "current");
  publish(commit("first\n \n"));
  assert.equal(cli("verdict", "check", "7").status, "stale");
  // The own-PR rules key on the caller, so the caller must be the authenticated account.
  assert.throws(() => cli("verdict", "check", "7", "--me", "author"), /does not match the authenticated GitHub account/);
});

test("runs when invoked through a symlinked skills folder, as ~/.claude/skills is", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "ship-link-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const linked = join(dir, "scripts");
  symlinkSync(dirname(ship), linked);
  const run = spawnSync(process.execPath, [join(linked, "ship.mjs")], { encoding: "utf8" });
  assert.equal(run.status, 2, `expected the usage error, got exit ${run.status} with no output`);
  assert.match(run.stderr, /usage: ship\.mjs/);
});

// A fixture repository whose PR #7 is the caller's own, with a gh on PATH whose GraphQL commands
// (gh pr, gh repo, gh api graphql) fail as GitHub answers once the account's quota is spent. Its
// REST calls answer from, and write to, state.json.
function rateLimitedGitHub(t) {
  const dir = mkdtempSync(join(tmpdir(), "ship-quota-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const git = (...args) => execFileSync("git", args, { cwd: dir, encoding: "utf8" }).trim();
  git("init", "--quiet", "--initial-branch=main");
  git("config", "core.hooksPath", "/dev/null");
  git("config", "user.name", "Fixture");
  git("config", "user.email", "fixture@example.com");
  git("remote", "add", "origin", dir);
  writeFileSync(join(dir, "sample.txt"), "first\n");
  git("add", "sample.txt");
  git("commit", "--quiet", "-m", "base");
  git("checkout", "--quiet", "-b", "feature");
  writeFileSync(join(dir, "sample.txt"), "first\nsecond\n");
  git("commit", "--quiet", "-am", "change");
  const head = git("rev-parse", "HEAD");
  git("update-ref", "refs/pull/7/head", head);
  const repo = { full_name: "fixture/repo" };
  const pr = {
    number: 7, title: "pr 7", body: "**Door:** two-way", user: { login: "dhruv" }, draft: false,
    base: { ref: "main", repo }, head: { ref: "feature", sha: head, repo },
  };
  const statePath = join(dir, "state.json");
  writeFileSync(statePath, JSON.stringify({ login: "dhruv", pr, comments: [], mergedAs: null, calls: [] }));
  mkdirSync(join(dir, "bin"));
  writeFileSync(join(dir, "bin", "gh"), `#!/usr/bin/env node
const fs = require("node:fs");
const file = ${JSON.stringify(statePath)};
const state = JSON.parse(fs.readFileSync(file, "utf8"));
const args = process.argv.slice(2);
state.calls.push(args);
const save = () => fs.writeFileSync(file, JSON.stringify(state));
const answer = (value) => { save(); process.stdout.write(typeof value === "string" ? value : JSON.stringify(value)); process.exit(0); };
const fail = (stdout, stderr) => { save(); process.stdout.write(stdout); process.stderr.write(stderr + "\\n"); process.exit(1); };
const limit = "API rate limit already exceeded for user ID 50968441.";
if (args[0] === "pr" || args[0] === "repo") fail("", "GraphQL: " + limit);
if (args[0] === "api" && args[1] === "graphql") {
  fail(JSON.stringify({ errors: [{ type: "RATE_LIMITED", code: "graphql_rate_limit", message: limit }] }), "gh: " + limit);
}
const endpoint = (args.find((a) => a === "user" || a.startsWith("repos/")) ?? "").split("?")[0];
const method = args.includes("-X") ? args[args.indexOf("-X") + 1] : "GET";
const field = (name) => args.find((a) => a.startsWith(name + "="))?.slice(name.length + 1);
const pages = (list) => (args.includes("--slurp") ? [list] : list);
const pr = state.pr;
switch (method + " " + endpoint) {
  case "GET user": answer(state.login + "\\n");
  case "GET repos/fixture/repo": answer({ full_name: "fixture/repo", default_branch: "main" });
  case "GET repos/fixture/repo/pulls": answer(pages(state.mergedAs ? [] : [pr]));
  case "GET repos/fixture/repo/pulls/7":
    answer({ ...pr, state: state.mergedAs ? "closed" : "open", merged: Boolean(state.mergedAs), merge_commit_sha: state.mergedAs, auto_merge: null });
  case "GET repos/fixture/repo/pulls/7/reviews": answer("");
  case "GET repos/fixture/repo/issues/7/comments": answer(pages(state.comments));
  case "POST repos/fixture/repo/issues/7/comments": {
    const comment = { body: field("body"), user: { login: state.login }, created_at: "2026-10-21T12:00:00Z" };
    state.comments.push(comment);
    answer(comment);
  }
  case "GET repos/fixture/repo/rules/branches/main":
    if (state.rulesError) fail("", "gh: " + state.rulesError);
    answer([]);
  case "PUT repos/fixture/repo/pulls/7/merge":
    if (field("merge_method") !== "squash" || field("sha") !== pr.head.sha) {
      fail('{"message":"Head branch was modified. Review and try the merge again."}', "gh: Head branch was modified. Review and try the merge again. (HTTP 409)");
    }
    state.mergedAs = "c".repeat(40);
    answer({ sha: state.mergedAs, merged: true, message: "Pull Request successfully merged" });
}
fail("", "gh: Not Found (HTTP 404)");
`, { mode: 0o755 });
  const cli = (...args) => {
    const run = spawnSync(process.execPath, [ship, ...args, "--repo", "fixture/repo", "--json"], {
      cwd: dir, encoding: "utf8", env: { ...process.env, PATH: join(dir, "bin") + ":" + process.env.PATH },
    });
    assert.equal(run.status, 0, run.stderr);
    return JSON.parse(run.stdout);
  };
  const state = () => JSON.parse(readFileSync(statePath, "utf8"));
  const setState = (changes) => writeFileSync(statePath, JSON.stringify({ ...state(), ...changes }));
  return { dir, head, cli, state, setState };
}

test("GraphQL quota spent: queue, verdict and run read and post through REST", (t) => {
  const { head, cli, state } = rateLimitedGitHub(t);
  assert.deepEqual(cli("queue").mine.map((r) => r.number), [7]);
  cli("verdict", "record", "7", "PASS", "--head", head, "--by", "verifier");
  assert.equal(state().comments.length, 1, "the verdict comment went through REST");
  assert.equal(cli("verdict", "check", "7").status, "current");
  assert.deepEqual(cli("run", "7"), {
    run: [{ number: 7, head, door: "two-way", verdict: "PASS", approvedBy: ["dhruv (own PR)"] }],
    ceiling: null,
    stackStop: null,
  });
  const firstTries = state().calls.filter((c) => c[0] === "pr" || c[0] === "repo" || c[1] === "graphql");
  assert.ok(firstTries.some((c) => c[0] === "pr" && c[1] === "list"), "GraphQL stays the first try");
});

test("GraphQL quota spent: run refuses to call a branch queue-free when the REST rules read is rate limited", (t) => {
  const { dir, head, cli, setState } = rateLimitedGitHub(t);
  cli("verdict", "record", "7", "PASS", "--head", head, "--by", "verifier");
  setState({ rulesError: "You have exceeded a secondary rate limit. Please wait a few minutes before you try again. (HTTP 403)" });
  const run = spawnSync(process.execPath, [ship, "run", "7", "--repo", "fixture/repo", "--json"], {
    cwd: dir, encoding: "utf8", env: { ...process.env, PATH: join(dir, "bin") + ":" + process.env.PATH },
  });
  assert.equal(run.stdout, "", "no landable run is printed when the merge queue is unknown");
  assert.equal(run.status, 2);
  assert.match(run.stderr, /secondary rate limit/);
});

test("GraphQL quota spent: merge squashes through REST, pinned to the verified head", (t) => {
  const { dir, head, cli, state } = rateLimitedGitHub(t);
  const moved = spawnSync(process.execPath, [ship, "merge", "7", "--head", "b".repeat(40), "--repo", "fixture/repo"], {
    cwd: dir, encoding: "utf8", env: { ...process.env, PATH: join(dir, "bin") + ":" + process.env.PATH },
  });
  assert.equal(moved.status, 2);
  assert.match(moved.stderr, /Head branch was modified/);
  assert.equal(state().mergedAs, null);

  assert.deepEqual(cli("merge", "7", "--head", head), { number: 7, head, mergeCommit: "c".repeat(40) });
  const puts = state().calls.filter((c) => c.includes("PUT"));
  assert.deepEqual(puts.map((c) => c.filter((a) => /^(merge_method|sha)=/.test(a))), [
    ["merge_method=squash", `sha=${"b".repeat(40)}`],
    ["merge_method=squash", `sha=${head}`],
  ]);
  assert.ok(state().calls.some((c) => c[0] === "pr" && c[1] === "merge"), "gh pr merge stays the first try");
});
