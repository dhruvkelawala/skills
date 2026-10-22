import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { fileURLToPath } from "node:url";

const shipPath = fileURLToPath(new URL("./ship.mjs", import.meta.url));

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
} else if (args[0] === "repo" && args[1] === "view") {
  console.log(JSON.stringify({ defaultBranchRef: { name: "main" }, isArchived: false }));
} else if (args[0] === "pr" && args[1] === "comment") {
  fs.writeFileSync("comments.json", JSON.stringify([{ body: args[args.indexOf("--body") + 1], author: { login: "reviewer" }, createdAt: "2026-10-05T12:00:00Z" }]));
} else {
  throw new Error("Unexpected gh call: " + args.join(" "));
}
`, { mode: 0o755 });
  const cli = (...args) => JSON.parse(execFileSync(process.execPath, [shipPath, ...args, "--repo", "fixture/repo", "--json"], { cwd: dir, env: { ...process.env, PATH: join(dir, "bin") + ":" + process.env.PATH }, encoding: "utf8" }));
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
  symlinkSync(dirname(shipPath), linked);
  const run = spawnSync(process.execPath, [join(linked, "ship.mjs")], { encoding: "utf8" });
  assert.equal(run.status, 2, `expected the usage error, got exit ${run.status} with no output`);
  assert.match(run.stderr, /usage: ship\.mjs/);
});

// A fixture repository whose PR #7 is the caller's own, with a gh on PATH that answers from, and
// writes to, state.json. While `graphql` is false, its GraphQL commands (gh pr, gh repo, gh api
// graphql) fail as GitHub answers once the account's quota is spent. `branch` is the default
// branch's GraphQL rules in the shape GitHub returned for public repos on 2026-10-22.
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
    login: "dhruv", graphql: false, pr, reviewDecision: "", comments: [], reviews: [], protected: false, rulesets: [],
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
const field = (name) => args.find((a) => a.startsWith(name + "="))?.slice(name.length + 1);
const pages = (list) => (args.includes("--slurp") ? [list] : list);
switch (method + " " + endpoint) {
  case "GET user": answer(state.login + "\\n");
  case "GET repos/fixture/repo": answer({ full_name: "fixture/repo", default_branch: "main", archived: Boolean(state.archived) });
  case "GET repos/fixture/repo/branches/main": answer({ name: "main", protected: state.protected });
  case "GET repos/fixture/repo/pulls": answer(pages(state.mergedAs ? [] : [pr]));
  case "GET repos/fixture/repo/pulls/7":
    answer({ ...pr, state: state.mergedAs ? "closed" : "open", merged: Boolean(state.mergedAs), merge_commit_sha: state.mergedAs, auto_merge: null });
  case "GET repos/fixture/repo/pulls/7/reviews": answer(pages(state.reviews));
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

test("GraphQL quota spent: queue, verdict and run read and post through REST", (t) => {
  const { head, cli, state } = fixtureGitHub(t);
  assert.deepEqual(cli("queue").mine.map((r) => r.number), [7]);
  cli("verdict", "record", "7", "PASS", "--head", head, "--by", "verifier");
  assert.equal(state().comments.length, 1, "the verdict comment went through REST");
  assert.equal(cli("verdict", "check", "7").status, "current");
  assert.deepEqual(cli("run", "7"), {
    run: [{ number: 7, head, door: "two-way", verdict: "PASS", approvedBy: ["dhruv (land request)"], forced: false }],
    ceiling: null,
    stackStop: null,
  });
  const firstTries = state().calls.filter((c) => c[0] === "pr" || c[0] === "repo" || c[1] === "graphql");
  assert.ok(firstTries.some((c) => c[0] === "pr" && c[1] === "list"), "GraphQL stays the first try");
});

test("GraphQL quota spent: run refuses to call a branch queue-free when the REST rules read is rate limited", (t) => {
  const { head, ship, cli, setState } = fixtureGitHub(t);
  cli("verdict", "record", "7", "PASS", "--head", head, "--by", "verifier");
  setState({ rulesError: "You have exceeded a secondary rate limit. Please wait a few minutes before you try again. (HTTP 403)" });
  const run = ship("run", "7", "--json");
  assert.equal(run.stdout, "", "no landable run is printed when the merge queue is unknown");
  assert.equal(run.status, 2);
  assert.match(run.stderr, /secondary rate limit/);
});

test("GraphQL quota spent: merge squashes through REST, pinned to the verified head", (t) => {
  const { head, ship, cli, state } = fixtureGitHub(t);
  const moved = ship("merge", "7", "--head", "b".repeat(40));
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

const REVIEW_WAIT = { number: 7, blocker: "GitHub requires a review: waiting for a human approval of this patch" };
const rules = (refUpdateRule, nodes = []) => ({ mergeQueue: null, ref: { refUpdateRule, rules: { nodes } } });

test("run: where the default branch asks for an approving review, the caller's own PR waits for a human approval", (t) => {
  const { head, cli, setState } = fixtureGitHub(t, { graphql: true });
  assert.equal(cli("run", "7").ceiling, null, "an unprotected default branch lands on the request to land");
  setState({ branch: rules({ requiredApprovingReviewCount: 1, pattern: "main" }) });
  assert.deepEqual(cli("run", "7").ceiling, REVIEW_WAIT, "classic branch protection");
  setState({ branch: rules(null, [{ type: "PULL_REQUEST", parameters: { requiredApprovingReviewCount: 1 } }, { type: "DELETION", parameters: null }]) });
  assert.deepEqual(cli("run", "7").ceiling, REVIEW_WAIT, "a ruleset");
  setState({ branch: rules({ requiredApprovingReviewCount: 0, pattern: "*" }, [{ type: "PULL_REQUEST", parameters: { requiredApprovingReviewCount: 0 } }]) });
  assert.equal(cli("run", "7").ceiling, null, "rules that ask for no approvals require none");
  setState({
    reviewDecision: "APPROVED", branch: rules({ requiredApprovingReviewCount: 2, pattern: "main" }),
    reviews: [{ user: { login: "vlad", type: "User" }, state: "APPROVED", submitted_at: "2026-10-22T10:00:00Z", commit_id: head }],
  });
  assert.deepEqual(cli("run", "7").ceiling, { number: 7, blocker: "GitHub requires 2 approvals: 1 human approval of this patch so far" });
});

test("GraphQL quota spent: run holds the caller's own PR when the default branch is protected or a ruleset asks for a review", (t) => {
  const { cli, setState } = fixtureGitHub(t);
  setState({ protected: true });
  assert.deepEqual(cli("run", "7").ceiling, REVIEW_WAIT, "REST shows classic protection's rules only to admins");
  setState({ protected: false, rulesets: [{ type: "pull_request", parameters: { required_approving_review_count: 1 } }] });
  assert.deepEqual(cli("run", "7").ceiling, REVIEW_WAIT);
});

test("run refuses an argument it cannot read: an unknown flag such as the removed --policy, or a stray PR number", (t) => {
  const { ship } = fixtureGitHub(t);
  for (const [args, error] of [[["--policy", "approval"], /unknown flag --policy/], [["--rule-b", "7", "8"], /usage/]]) {
    const run = ship("run", "7", ...args);
    assert.equal(run.status, 2, args.join(" "));
    assert.match(run.stderr, error);
  }
});

test("run: a PR outside rule B lands without a verdict, and --rule-b holds it for one", (t) => {
  const { head, cli } = fixtureGitHub(t, { graphql: true });
  assert.deepEqual(cli("run", "7").run, [{ number: 7, head, door: "two-way", verdict: "not needed", approvedBy: ["dhruv (land request)"], forced: false }]);
  assert.deepEqual(cli("run", "7", "--rule-b", "7").ceiling, { number: 7, blocker: "verdict missing (rule B: named in --rule-b)" });
});

test("--force lands a PR waiting only on a required approval, once ship has seen every required check pass", (t) => {
  const build = { __typename: "CheckRun", name: "build", conclusion: "SUCCESS" };
  const lint = { __typename: "StatusContext", context: "lint", state: "SUCCESS" };
  const branch = (...checks) => ({
    mergeQueue: null,
    ref: {
      refUpdateRule: { requiredApprovingReviewCount: 1, requiredStatusCheckContexts: ["build"] },
      rules: { nodes: [{ type: "REQUIRED_STATUS_CHECKS", parameters: { requiredStatusChecks: [{ context: "lint" }] } }] },
    },
    object: { statusCheckRollup: { contexts: { nodes: checks } } },
  });
  const { head, ship, cli, state, setState } = fixtureGitHub(t, { graphql: true, reviewDecision: "REVIEW_REQUIRED", branch: branch(build) });
  assert.deepEqual(cli("run", "7").ceiling, REVIEW_WAIT);
  assert.deepEqual(cli("run", "7", "--force").run.map((r) => [r.number, r.approvedBy, r.forced]), [[7, [], true]]);

  assert.equal(ship("merge", "7", "--head", head).status, 2, "without --force, GitHub's review rule still refuses the merge");
  const unreported = ship("merge", "7", "--head", head, "--force");
  assert.equal(unreported.status, 2, "the admin bypass would skip a required check that has not reported yet");
  assert.match(unreported.stderr, /not passed: lint/);
  setState({ branch: branch(build, { ...build, conclusion: null }, lint) });
  assert.match(ship("merge", "7", "--head", head, "--force").stderr, /not passed: build/, "every run of a check must pass");
  assert.equal(state().mergedAs, null);

  setState({ branch: branch(build, lint) });
  assert.deepEqual(cli("merge", "7", "--head", head, "--force"), { number: 7, head, mergeCommit: "c".repeat(40) });
  assert.deepEqual(state().calls.filter((c) => c[0] === "pr" && c[1] === "merge").map((c) => c.includes("--admin")), [false, true]);
});

test("run: an approval counts for the patch it was given on, through a rebase that keeps it, and not after a real change", (t) => {
  const { dir, git, head, cli, state, setState } = fixtureGitHub(t, { graphql: true, reviewDecision: "APPROVED", branch: rules({ requiredApprovingReviewCount: 1, pattern: "main" }) });
  setState({ reviews: [{ user: { login: "vlad", type: "User" }, state: "APPROVED", submitted_at: "2026-10-22T10:00:00Z", commit_id: head }] });
  const publish = (sha) => {
    git("update-ref", "refs/pull/7/head", sha);
    setState({ pr: { ...state().pr, head: { ...state().pr.head, sha } } });
  };
  assert.deepEqual(cli("run", "7").run.map((r) => [r.number, r.approvedBy]), [[7, ["vlad"]]]);

  git("checkout", "--quiet", "main");
  writeFileSync(join(dir, "other.txt"), "unrelated\n");
  git("add", "other.txt");
  git("commit", "--quiet", "-m", "main moves on");
  git("checkout", "--quiet", "feature");
  git("rebase", "--quiet", "main");
  const rebased = git("rev-parse", "HEAD");
  assert.notEqual(rebased, head);
  publish(rebased);
  assert.deepEqual(cli("run", "7").run.map((r) => [r.number, r.approvedBy]), [[7, ["vlad"]]], "a rebase that keeps the patch keeps the approval");

  writeFileSync(join(dir, "sample.txt"), "first\nsecond\nthird\n");
  git("commit", "--quiet", "-am", "a real change");
  publish(git("rev-parse", "HEAD"));
  assert.deepEqual(cli("run", "7").ceiling, REVIEW_WAIT, "the approval was given on an earlier patch");
});

test("an archived repository's PRs never appear in ship output: every command refuses it before reading them", (t) => {
  const { head, ship, state, setState } = fixtureGitHub(t, { graphql: true, archived: true });
  const commands = [["queue"], ["verdict", "record", "7", "PASS", "--head", head, "--by", "verifier"], ["verdict", "check", "7"], ["run", "7"], ["merge", "7", "--head", head]];
  for (const args of commands) {
    const out = ship(...args, "--json");
    assert.deepEqual([out.status, out.stdout], [2, ""], args.join(" "));
    assert.match(out.stderr, /fixture\/repo is archived/);
  }
  assert.deepEqual(state().calls.filter((c) => c[0] !== "repo"), [], "nothing past the repository was read or written");
  setState({ graphql: false });
  assert.match(ship("queue").stderr, /fixture\/repo is archived/, "the REST fallback reads the archive flag too");
});

test("run: an approval given while the PR sat on its parent survives the restack after the parent squash-merges", (t) => {
  // The fixture's feature branch plays the parent PR; PR 7 is a child stacked on it.
  const { dir, git, head: parentHead, cli, state, setState } = fixtureGitHub(t, { graphql: true, reviewDecision: "APPROVED", branch: rules({ requiredApprovingReviewCount: 1, pattern: "main" }) });
  git("checkout", "--quiet", "-b", "child");
  writeFileSync(join(dir, "child.txt"), "child\n");
  git("add", "child.txt");
  git("commit", "--quiet", "-m", "child");
  const approved = git("rev-parse", "HEAD");
  git("checkout", "--quiet", "main");
  writeFileSync(join(dir, "sample.txt"), "first\nsecond\n");
  git("commit", "--quiet", "-am", "parent, squash-merged");
  git("rebase", "--quiet", "--onto", "main", "feature", "child");
  const restacked = git("rev-parse", "HEAD");
  git("update-ref", "refs/pull/7/head", restacked);
  setState({
    pr: { ...state().pr, head: { ...state().pr.head, ref: "child", sha: restacked } },
    reviews: [{ user: { login: "vlad", type: "User" }, state: "APPROVED", submitted_at: "2026-10-22T10:00:00Z", commit_id: approved }],
    branch: { ...state().branch, pullRequest: { timelineItems: { nodes: [{ previousRefName: "feature" }] } } },
    merged: [{ headRefName: "feature", headRefOid: parentHead }],
  });
  assert.deepEqual(cli("run", "7").run.map((r) => [r.number, r.approvedBy]), [[7, ["vlad"]]]);

  writeFileSync(join(dir, "child.txt"), "child, changed\n");
  git("commit", "--quiet", "-am", "a real change");
  const changed = git("rev-parse", "HEAD");
  git("update-ref", "refs/pull/7/head", changed);
  setState({ pr: { ...state().pr, head: { ...state().pr.head, sha: changed } } });
  assert.deepEqual(cli("run", "7").ceiling, REVIEW_WAIT, "the parent's head is a base for the approved commit, not a pass for any patch");
});
