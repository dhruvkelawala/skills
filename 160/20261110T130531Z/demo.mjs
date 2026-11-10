import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import assert from "node:assert/strict";
const shipPath = resolve(process.argv[2]);
function fixtureGitHub(t, changes = {}) {
  const dir = mkdtempSync(join(tmpdir(), "ship-gh-"));
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
  writeFileSync(statePath, JSON.stringify({
    login: "dhruv", graphql: false, pr, baseTip: git("rev-parse", "main"), reviewDecision: "", comments: [], reviews: [], protected: false, rulesets: [],
    branch: { mergeQueue: null, ref: { refUpdateRule: null, rules: { nodes: [] } } }, merged: [], mergedAs: null, calls: [], ...changes,
  }));
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
const pr = state.pr;
const flag = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
if (!state.graphql && (args[0] === "pr" || args[0] === "repo")) fail("", "GraphQL: " + limit);
if (!state.graphql && args[0] === "api" && args[1] === "graphql") {
  fail(JSON.stringify({ errors: [{ type: "RATE_LIMITED", code: "graphql_rate_limit", message: limit }] }), "gh: " + limit);
}
if (args[0] === "repo" && args[1] === "view") answer({ defaultBranchRef: { name: "main" }, isArchived: Boolean(state.archived) });
if (args[0] === "api" && args[1] === "graphql") answer({ data: { repository: state.branch } });
if (args[0] === "pr" && args[1] === "list" && flag("--state") === "merged") {
  answer(state.merged.filter((p) => p.headRefName === flag("--head")).map((p) => ({ headRefOid: p.headRefOid })));
}
if (args[0] === "pr" && args[1] === "list") {
  answer(state.mergedAs ? [] : [{
    number: pr.number, title: pr.title, author: { login: pr.user.login }, body: pr.body, baseRefName: pr.base.ref,
    headRefName: pr.head.ref, headRefOid: pr.head.sha, isCrossRepository: false, isDraft: false, additions: 1, deletions: 0,
    reviewDecision: state.reviewDecision, mergeStateStatus: "BLOCKED",
  }]);
}
if (args[0] === "pr" && args[1] === "view" && flag("--json") === "comments") {
  answer({ comments: state.comments.map((c) => ({ body: c.body, author: { login: c.user.login }, createdAt: c.created_at })) });
}
if (args[0] === "pr" && args[1] === "view" && flag("--json") === "reviewDecision,baseRefName") {
  answer({ reviewDecision: state.reviewDecision, baseRefName: pr.base.ref });
}
if (args[0] === "pr" && args[1] === "view" && flag("--json") === "state,autoMergeRequest,mergeCommit") {
  answer({ state: state.mergedAs ? "MERGED" : "OPEN", autoMergeRequest: null, mergeCommit: state.mergedAs && { oid: state.mergedAs } });
}
if (args[0] === "pr" && args[1] === "merge") {
  if (flag("--match-head-commit") !== pr.head.sha) fail("", "GraphQL: Head branch was modified. Review and try the merge again. (mergePullRequest)");
  if (state.reviewDecision === "REVIEW_REQUIRED" && !args.includes("--admin")) {
    fail("", "X Pull request fixture/repo#7 is not mergeable: the base branch policy prohibits the merge.");
  }
  state.mergedAs = "c".repeat(40);
  answer("");
}
if (args[0] === "pr" && args[1] === "comment") {
  state.comments.push({ body: flag("--body"), user: { login: state.login }, created_at: "2026-10-21T12:00:00Z" });
  answer("");
}
const endpoint = (args.find((a) => a === "user" || a.startsWith("repos/")) ?? "").split("?")[0];
const method = args.includes("-X") ? args[args.indexOf("-X") + 1] : "GET";
if (endpoint.startsWith("repos/fixture/repo/compare/")) answer({ behind_by: state.behindBy ?? 0, ahead_by: state.baseAhead ?? 0, files: state.baseFiles ?? [] });
const field = (name) => args.find((a) => a.startsWith(name + "="))?.slice(name.length + 1);
const pages = (list) => (args.includes("--slurp") ? [list] : list);
switch (method + " " + endpoint) {
  case "GET user": answer(state.login + "\\n");
  case "GET repos/fixture/repo": answer({ full_name: "fixture/repo", default_branch: "main", archived: Boolean(state.archived) });
  case "GET repos/fixture/repo/branches/main": answer({ name: "main", protected: state.protected });
  case "GET repos/fixture/repo/git/ref/heads/main": answer({ object: { sha: state.baseTip } });
  case "GET repos/fixture/repo/pulls": answer(pages(state.mergedAs ? [] : [pr]));
  case "GET repos/fixture/repo/pulls/7":
    answer({ ...pr, state: state.mergedAs ? "closed" : "open", merged: Boolean(state.mergedAs), merge_commit_sha: state.mergedAs, auto_merge: null });
  case "GET repos/fixture/repo/pulls/7/reviews": answer(pages(state.reviews));
  case "GET repos/fixture/repo/pulls/7/files": answer(pages(state.prFiles ?? [{ filename: "sample.txt" }]));
  case "GET repos/fixture/repo/issues/7/comments": answer(pages(state.comments));
  case "POST repos/fixture/repo/issues/7/comments": {
    const comment = { body: field("body"), user: { login: state.login }, created_at: "2026-10-21T12:00:00Z" };
    state.comments.push(comment);
    answer(comment);
  }
  case "GET repos/fixture/repo/rules/branches/main":
    if (state.rulesError) fail("", "gh: " + state.rulesError);
    answer(state.rulesets);
  case "PUT repos/fixture/repo/pulls/7/merge":
    if (field("merge_method") !== "squash" || field("sha") !== pr.head.sha) {
      fail('{"message":"Head branch was modified. Review and try the merge again."}', "gh: Head branch was modified. Review and try the merge again. (HTTP 409)");
    }
    state.mergedAs = "c".repeat(40);
    answer({ sha: state.mergedAs, merged: true, message: "Pull Request successfully merged" });
}
fail("", "gh: Not Found (HTTP 404)");
`, { mode: 0o755 });
  const ship = (...args) => spawnSync(process.execPath, [shipPath, ...args, "--repo", "fixture/repo"], {
    cwd: dir, encoding: "utf8", env: { ...process.env, PATH: join(dir, "bin") + ":" + process.env.PATH },
  });
  const cli = (...args) => {
    const run = ship(...args, "--json");
    assert.equal(run.status, 0, run.stderr);
    return JSON.parse(run.stdout);
  };
  const state = () => JSON.parse(readFileSync(statePath, "utf8"));
  const setState = (changes) => writeFileSync(statePath, JSON.stringify({ ...state(), ...changes }));
  return { dir, git, head, ship, cli, state, setState };
}

const cleanup = [];
const t = { after: (fn) => cleanup.push(fn) };
try {
  const cap = Array.from({ length: 300 }, (_, n) => ({ filename: `gen/${n}.txt` }));
  const { dir, git, cli, setState } = fixtureGitHub(t, { graphql: true, baseAhead: 1, baseFiles: cap });
  const identify = () => {
    git("remote", "set-url", "origin", "https://github.com/fixture/repo.git");
    git("config", `url.${dir}.insteadOf`, "https://github.com/fixture/repo.git");
  };
  identify();
  git("checkout", "--quiet", "main");
  mkdirSync(join(dir, "gen"));
  for (let n = 0; n < 301; n++) writeFileSync(join(dir, "gen", `${n}.txt`), "base only\n");
  git("add", "gen");
  git("commit", "--quiet", "-m", "301 unrelated base files");
  const show = (label) => {
    console.log(label);
    console.log("$ node ship.mjs run 7 --repo fixture/repo --json");
    const result = cli("run", "7");
    console.log(JSON.stringify({ landable: result.run.map((p) => p.number), refusal: result.ceiling?.blocker ?? null }, null, 2));
  };
  setState({ baseTip: git("rev-parse", "main"), baseFiles: [{ filename: "gen/0.txt" }] });
  show("Uncapped compare, no shared file");
  setState({ baseFiles: cap });
  show("Capped compare, 301 base-only files, no shared file");
  git("mv", "sample.txt", "renamed.txt");
  git("commit", "--quiet", "-m", "base renames PR file");
  setState({ baseAhead: 2, baseTip: git("rev-parse", "main") });
  show("Capped compare, real overlap via old rename name");
  git("remote", "set-url", "origin", "https://github.com/other/repo.git");
  git("config", `url.${dir}.insteadOf`, "https://github.com/other/repo.git");
  show("Capped compare, origin identity cannot be confirmed");
  identify();
  git("update-ref", "refs/ship/drift", "HEAD");
  show("Capped compare, Git fetch fails on a conflicting ref namespace");
  git("update-ref", "-d", "refs/ship/drift");
  setState({ baseTip: "f".repeat(40) });
  show("Capped compare, origin cannot supply GitHub base tip");
} finally {
  for (const fn of cleanup.reverse()) fn();
}
