import test from "node:test";
import assert from "node:assert/strict";

import { FINGERPRINT_DIFF_FLAGS, actor, bypassBlockers, formatVerdict, humanApprovers, landableRun, latestVerdict, parseArgs, parseDoor, patchFingerprint, planQueue, verdictStatus, walkStack } from "./ship.mjs";

const TWO = "## Merge Danger\n\n**Door:** two-way\n\n**Blast Radius:** local";
const ONE = "## Merge Danger\n\n**Door:** one-way\n\n**Blast Radius:** every user";

function pr(number, base, head, extra = {}) {
  return { number, title: `pr ${number}`, author: { login: "vlad" }, body: TWO, baseRefName: base, headRefName: head, headRefOid: "h" + number, isCrossRepository: false, additions: 10, deletions: 0, isDraft: false, reviewDecision: "", mergeStateStatus: "BLOCKED", ...extra };
}

test("parseArgs separates flags, values, and positionals", () => {
  assert.deepEqual(parseArgs(["run", "12", "--force", "--trusted", "a,b", "--json"]), { _: ["run", "12"], force: true, trusted: "a,b", json: true });
  assert.throws(() => parseArgs(["run", "12", "--rule-b"]), /--rule-b needs a value/, "a trailing --rule-b would otherwise name no PR");
  assert.throws(() => parseArgs(["run", "12", "--trusted", "--json"]), /--trusted needs a value/);
});

test("parseDoor reads the pr skill's Merge Danger line", () => {
  assert.equal(parseDoor(TWO), "two-way");
  assert.equal(parseDoor(ONE), "one-way");
  assert.equal(parseDoor("no section"), "unknown");
  assert.equal(parseDoor(null), "unknown");
});

test("planQueue: approved and clean on the default branch is merge-now, ranked by what it unblocks", () => {
  const prs = [
    pr(1, "main", "a", { reviewDecision: "APPROVED", mergeStateStatus: "CLEAN" }),
    pr(2, "a", "b"),
    pr(3, "main", "c", { reviewDecision: "APPROVED", mergeStateStatus: "CLEAN" }),
  ];
  const q = planQueue(prs, { me: "dhruv", defaultBranch: "main" });
  assert.deepEqual(q.mergeNow.map((r) => [r.number, r.unblocks]), [[1, 1], [3, 0]]);
});

test("planQueue: unstable or dirty approved PRs are not merge-now", () => {
  const q = planQueue([pr(1, "main", "a", { reviewDecision: "APPROVED", mergeStateStatus: "UNSTABLE", author: { login: "dhruv" } })], { me: "dhruv", defaultBranch: "main" });
  assert.equal(q.mergeNow.length, 0);
  assert.equal(q.mine[0].number, 1);
});

test("planQueue: review is ranked by unblock count, then smallest first; children of unapproved parents wait", () => {
  const prs = [
    pr(1, "main", "a", { additions: 900 }),
    pr(2, "a", "b"),
    pr(3, "main", "c", { additions: 5 }),
    pr(4, "main", "d", { additions: 50 }),
  ];
  const q = planQueue(prs, { me: "dhruv", defaultBranch: "main" });
  assert.deepEqual(q.review.map((r) => r.number), [1, 3, 4]);
  assert.deepEqual(q.waitingOnParent.map((r) => r.number), [2]);
});

test("planQueue: drafts are ignored and the caller's own PRs never land in review", () => {
  const q = planQueue([pr(1, "main", "a", { isDraft: true }), pr(2, "main", "b", { author: { login: "dhruv" } })], { me: "dhruv", defaultBranch: "main" });
  assert.deepEqual([q.review.length, q.mine.map((r) => r.number)], [0, [2]]);
});

const V = { verdict: "FAIL", by: "verifier", at: "2026-10-05T10:00:00Z", head: "a".repeat(40), base: "b".repeat(40), patchId: "p1" };
const comment = (v, login, createdAt) => ({ body: formatVerdict(v), author: { login }, createdAt });

test("formatVerdict round-trips through latestVerdict; the newest by server time wins", () => {
  const neu = { ...V, verdict: "PASS", patchId: "p2" };
  const comments = [comment(neu, "dhruv", "2026-10-05T11:00:00Z"), { body: "unrelated", author: { login: "x" } }, comment(V, "dhruv", "2026-10-05T10:00:00Z")];
  assert.deepEqual(latestVerdict(comments, { prAuthor: "vlad" }), { ...neu, recordedBy: "dhruv", recordedAt: "2026-10-05T11:00:00Z" });
});

test("latestVerdict: a forged PASS from the PR author is ignored, whatever its embedded fields claim", () => {
  const forged = { ...V, verdict: "PASS", by: "verifier", at: "2099-01-01T00:00:00Z" };
  const comments = [comment(V, "dhruv", "2026-10-05T10:00:00Z"), comment(forged, "vlad", "2026-10-05T12:00:00Z")];
  const v = latestVerdict(comments, { prAuthor: "vlad" });
  assert.deepEqual([v.verdict, v.recordedBy], ["FAIL", "dhruv"]);
});

test("latestVerdict: a trusted list excludes everyone else; a missing login never counts", () => {
  const comments = [comment({ ...V, verdict: "PASS" }, "stranger", "2026-10-05T12:00:00Z"), comment(V, "dhruv", "2026-10-05T10:00:00Z"), { ...comment(V, "x", "z"), author: null }];
  assert.equal(latestVerdict(comments, { prAuthor: "vlad", trusted: ["dhruv"] }).verdict, "FAIL");
});

test("latestVerdict ignores a corrupt marker", () => {
  assert.equal(latestVerdict([{ body: "<!-- ship-verdict:v1 {not json} -->", author: { login: "dhruv" } }], { prAuthor: "vlad" }), null);
});

test("latestVerdict never discards a newer FAIL with comment delimiters or Unicode in its notes", () => {
  for (const notes of ["Live failed on text } --> inside notes", "First lane\nSecond lane", "Line\u2028separator\u2029text"]) {
    const comments = [comment({ ...V, verdict: "PASS" }, "dhruv", "2026-10-05T10:00:00Z"), comment({ ...V, notes }, "dhruv", "2026-10-05T11:00:00Z")];
    const verdict = latestVerdict(comments, { prAuthor: "vlad" });
    assert.equal(verdict.verdict, "FAIL", notes);
    assert.equal(verdict.notes, notes);
    assert.equal(verdictStatus(verdict, { patchId: V.patchId }).status, "failed");
  }
});

const DIFF = (body, at = "@@ -10,3 +11,5 @@ def handler():") => `diff --git a/x.py b/x.py\nindex 111..222 100644\n--- a/x.py\n+++ b/x.py\n${at}\n ctx\n${body}\n ctx`;

test("patchFingerprint keeps whitespace, so re-indenting a changed line invalidates it", () => {
  assert.notEqual(patchFingerprint(DIFF("+    if ok:\n+        run()")), patchFingerprint(DIFF("+    if ok:\n+    run()")));
});

test("patchFingerprint survives a retarget that only changes blob ids", () => {
  const retargeted = DIFF("+    if ok:\n+        run()").replace("index 111..222", "index 333..444");
  assert.equal(patchFingerprint(DIFF("+    if ok:\n+        run()")), patchFingerprint(retargeted));
});

test("patchFingerprint: an identical edit at another position is a different patch, even with identical context", () => {
  const first = DIFF('-  "auth": true,\n+  "auth": false,', "@@ -10,3 +10,3 @@");
  const second = DIFF('-  "auth": true,\n+  "auth": false,', "@@ -40,3 +40,3 @@");
  assert.notEqual(patchFingerprint(first), patchFingerprint(second));
});

test("patchFingerprint: the same removed line in a different function is a different patch", () => {
  const user = DIFF("-    require_auth()", "@@ -10,3 +10,2 @@ def user_handler():");
  const admin = DIFF("-    require_auth()", "@@ -80,3 +80,2 @@ def admin_handler():");
  assert.notEqual(patchFingerprint(user), patchFingerprint(admin));
});

test("actor: gh's app/ prefix, REST's [bot] suffix, and the bare login are one account", () => {
  assert.equal(actor("app/claude"), actor("claude[bot]"));
  assert.equal(actor("claude"), actor("Claude[bot]"));
  assert.notEqual(actor("claude"), actor("dhruv"));
});

test("latestVerdict: a bot cannot verify its own PR under any of its names", () => {
  const v = { ...V, verdict: "PASS" };
  assert.equal(latestVerdict([comment(v, "claude", "2026-10-05T12:00:00Z")], { prAuthor: "app/claude" }), null);
});

test("verdictStatus: missing, stale on a changed patch, failed, current", () => {
  const v = { verdict: "PASS", by: "verifier", recordedBy: "dhruv", head: "a".repeat(40), patchId: "p1" };
  assert.equal(verdictStatus(null, { patchId: "p1" }).status, "missing");
  assert.equal(verdictStatus(v, { patchId: "p2" }).status, "stale");
  assert.equal(verdictStatus({ ...v, verdict: "FAIL" }, { patchId: "p1" }).status, "failed");
  assert.deepEqual(verdictStatus(v, { head: "h", patchId: "p1" }), { status: "current", verdict: "PASS", by: "verifier", recordedBy: "dhruv", head: "h" });
});

test("verdictStatus: a rebase that keeps the patch keeps the verdict", () => {
  const v = { verdict: "PASS", by: "verifier", head: "old".padEnd(40, "0"), patchId: "same" };
  assert.equal(verdictStatus(v, { head: "new".padEnd(40, "0"), patchId: "same" }).status, "current");
});

test("fork PRs never form stack edges, so a fork's main into main cannot loop", () => {
  const fork = pr(1, "main", "main", { isCrossRepository: true });
  const prs = [fork, pr(2, "main", "a"), pr(3, "a", "b")];
  const q = planQueue(prs, { me: "dhruv", defaultBranch: "main" });
  assert.deepEqual(q.review.map((r) => [r.number, r.unblocks]), [[2, 1], [1, 0]]);
  assert.deepEqual(walkStack(prs, 1).stack.map((p) => p.number), [1]);
  assert.deepEqual(walkStack(prs, 2).stack.map((p) => p.number), [2, 3]);
});

test("walkStack follows a linear chain and stops at a fork", () => {
  const prs = [pr(1, "main", "a"), pr(2, "a", "b"), pr(3, "b", "c"), pr(4, "b", "d")];
  const { stack, stop } = walkStack(prs, 1);
  assert.deepEqual(stack.map((p) => p.number), [1, 2]);
  assert.match(stop, /#2 has 2 children/);
  assert.match(walkStack(prs, 99).stop, /not open/);
});

const ok = (recordedBy = "dhruv") => ({ status: "current", verdict: "PASS", by: "verifier", recordedBy });
const review = (login, state, at, type = "User", patchId = "p1") => ({ user: { login, type }, state, submitted_at: at, patchId });

test("humanApprovers: a bot approval does not count, a human one does", () => {
  const reviews = [review("claude[bot]", "APPROVED", "2026-10-05T10:00:00Z", "Bot"), review("dhruv", "APPROVED", "2026-10-05T11:00:00Z")];
  assert.deepEqual(humanApprovers(reviews.slice(0, 1), { prAuthor: "vlad", reviewDecision: "APPROVED", patchId: "p1" }), []);
  assert.deepEqual(humanApprovers(reviews, { prAuthor: "vlad", reviewDecision: "APPROVED", patchId: "p1" }), ["dhruv"]);
});

test("humanApprovers: a later change request or dismissal withdraws it; comments do not", () => {
  const base = [review("dhruv", "APPROVED", "2026-10-05T10:00:00Z")];
  assert.deepEqual(humanApprovers([...base, review("dhruv", "COMMENTED", "2026-10-05T11:00:00Z")], { prAuthor: "vlad", reviewDecision: "APPROVED", patchId: "p1" }), ["dhruv"]);
  assert.deepEqual(humanApprovers([...base, review("dhruv", "CHANGES_REQUESTED", "2026-10-05T11:00:00Z")], { prAuthor: "vlad", reviewDecision: "APPROVED", patchId: "p1" }), []);
  assert.deepEqual(humanApprovers([...base, review("dhruv", "DISMISSED", "2026-10-05T11:00:00Z")], { prAuthor: "vlad", reviewDecision: "APPROVED", patchId: "p1" }), []);
});

test("humanApprovers: an approval counts only for the patch it was given on", () => {
  const approval = (patchId) => [review("dhruv", "APPROVED", "2026-10-05T10:00:00Z", "User", patchId)];
  assert.deepEqual(humanApprovers(approval("p1"), { prAuthor: "vlad", reviewDecision: "APPROVED", patchId: "p1" }), ["dhruv"]);
  assert.deepEqual(humanApprovers(approval("p1"), { prAuthor: "vlad", reviewDecision: "APPROVED", patchId: "p2" }), []);
  assert.deepEqual(humanApprovers(approval(undefined), { prAuthor: "vlad", reviewDecision: "APPROVED", patchId: "p2" }), [], "a commit ship could not read");
});

test("humanApprovers: nothing counts unless GitHub's overall decision is APPROVED", () => {
  assert.deepEqual(humanApprovers([review("dhruv", "APPROVED", "2026-10-05T10:00:00Z")], { prAuthor: "vlad", reviewDecision: "REVIEW_REQUIRED", patchId: "p1" }), []);
});

test("landableRun: a stack lands bottom first, each PR pinned to its head", () => {
  const stack = [pr(1, "main", "a"), pr(2, "a", "b")];
  const r = landableRun(stack, new Map([[1, ok()], [2, ok()]]), { me: "dhruv" });
  assert.deepEqual([r.run.map((x) => [x.number, x.head]), r.ceiling], [[[1, "h1"], [2, "h2"]], null]);
});

test("landableRun: where GitHub requires a review, even the caller's own PR waits for a human approval", () => {
  const own = pr(1, "main", "a", { author: { login: "dhruv" } });
  const waits = landableRun([own], new Map([[1, ok("dhruv")]]), { me: "dhruv", requiredApprovals: 1 });
  assert.deepEqual(waits.ceiling, { number: 1, blocker: "GitHub requires a review: waiting for a human approval of this patch" });
  const shown = landableRun([{ ...own, reviewDecision: "REVIEW_REQUIRED" }], new Map([[1, ok("dhruv")]]), { me: "dhruv" });
  assert.deepEqual(shown.ceiling, waits.ceiling, "GitHub's REVIEW_REQUIRED on the PR counts even when the branch rule reads as none");
  const approved = landableRun([own], new Map([[1, ok("dhruv")]]), { me: "dhruv", requiredApprovals: 1, approversByNumber: new Map([[1, ["vlad"]]]) });
  assert.deepEqual([approved.ceiling, approved.run[0].approvedBy], [null, ["vlad"]]);
  const short = landableRun([own], new Map([[1, ok("dhruv")]]), { me: "dhruv", requiredApprovals: 2, approversByNumber: new Map([[1, ["vlad"]]]) });
  assert.deepEqual(short.ceiling, { number: 1, blocker: "GitHub requires 2 approvals: 1 human approval of this patch so far" }, "a stale approval cannot make up GitHub's count");
});

test("landableRun: a two-way PR outside rule B lands on its build's own checks, without a verdict", () => {
  const r = landableRun([pr(1, "main", "a")], new Map(), { me: "dhruv" });
  assert.equal(r.ceiling, null);
  assert.equal(r.run[0].verdict, "not needed");
});

test("landableRun: rule B holds a PR without a current verdict when it is named, its door is one-way or missing, or a verdict is on record", () => {
  const cases = [
    [pr(1, "main", "a"), { status: "missing" }, [1], "verdict missing (rule B: named in --rule-b)"],
    [pr(1, "main", "a", { body: ONE }), { status: "missing" }, [], "verdict missing (rule B: the door is one-way)"],
    [pr(1, "main", "a", { body: "" }), { status: "missing" }, [], "verdict missing (rule B: no door line)"],
    [pr(1, "main", "a"), { status: "stale", reason: "patch changed" }, [], "verdict stale: patch changed (rule B: a verdict is on record)"],
    [pr(1, "main", "a"), { status: "failed", reason: "verdict is FAIL" }, [], "verdict failed: verdict is FAIL (rule B: a verdict is on record)"],
  ];
  for (const [p, status, ruleB, blocker] of cases) {
    assert.deepEqual(landableRun([p], new Map([[1, status]]), { me: "dhruv", ruleB }).ceiling, { number: 1, blocker });
    assert.equal(landableRun([p], new Map([[1, ok()]]), { me: "dhruv", ruleB }).ceiling, null, `${blocker}, once a verdict is current`);
  }
});

test("landableRun: stops at the first gap, so a verified PR above an unverified one does not land", () => {
  const stack = [pr(1, "main", "a"), pr(2, "a", "b"), pr(3, "b", "c")];
  const r = landableRun(stack, new Map([[1, ok()], [2, { status: "stale", reason: "patch changed" }], [3, ok()]]), { me: "dhruv" });
  assert.deepEqual(r.run.map((x) => x.number), [1]);
  assert.deepEqual(r.ceiling, { number: 2, blocker: "verdict stale: patch changed (rule B: a verdict is on record)" });
});

test("landableRun: a bot author's own verdict, recorded under its bare login, does not count", () => {
  const r = landableRun([pr(1, "main", "a", { author: { login: "app/claude" } })], new Map([[1, ok("claude")]]), { me: "dhruv" });
  assert.match(r.ceiling.blocker, /not recorded by someone other than the PR author/);
});

test("landableRun: nothing lands onto a merge-queue branch, since the queue merges later heads", () => {
  const r = landableRun([pr(1, "main", "a")], new Map([[1, ok()]]), { me: "dhruv", mergeQueue: true });
  assert.deepEqual(r.run, []);
  assert.match(r.ceiling.blocker, /merge queue/);
});

test("the fingerprint diff disables every filter local git config could apply", () => {
  for (const f of ["--no-relative", "--no-textconv", "--no-ext-diff", "--ignore-submodules=none"]) assert.ok(FINGERPRINT_DIFF_FLAGS.includes(f), f);
});

test("landableRun: the author cannot verify their own PR", () => {
  const r = landableRun([pr(1, "main", "a")], new Map([[1, ok("vlad")]]), { me: "dhruv" });
  assert.equal(r.ceiling.blocker, "verdict was not recorded by someone other than the PR author");
});

// --- one account: the caller runs ship as the author of their own PRs ---------

test("latestVerdict: on the caller's own PR, the caller's verdict counts", () => {
  const mine = comment({ ...V, verdict: "PASS" }, "dhruv", "2026-10-05T12:00:00Z");
  assert.equal(latestVerdict([mine], { prAuthor: "dhruv", me: "dhruv" }).verdict, "PASS");
  assert.equal(latestVerdict([mine], { prAuthor: "dhruv" }), null);
});

test("latestVerdict: on someone else's PR, their own verdict is still ignored", () => {
  const forged = comment({ ...V, verdict: "PASS" }, "vlad", "2026-10-05T12:00:00Z");
  assert.equal(latestVerdict([forged], { prAuthor: "vlad", me: "dhruv" }), null);
});

test("landableRun: --force skips only the wait for a required approval", () => {
  const own = pr(1, "main", "a", { author: { login: "dhruv" } });
  const forced = landableRun([own], new Map(), { me: "dhruv", requiredApprovals: 1, force: true });
  assert.deepEqual([forced.ceiling, forced.run[0].approvedBy, forced.run[0].forced], [null, [], true]);
  for (const [p, opts, blocker] of [
    [{ ...own, body: ONE }, {}, /^verdict missing \(rule B: the door is one-way\)$/],
    [{ ...own, reviewDecision: "CHANGES_REQUESTED" }, {}, /requested changes/],
    [own, { mergeQueue: true }, /merge queue/],
  ]) {
    assert.match(landableRun([p], new Map(), { me: "dhruv", requiredApprovals: 1, force: true, ...opts }).ceiling.blocker, blocker);
  }
});

test("landableRun: where GitHub requires no review, the caller's verdict counts on their own PR and their land request stands in for approval", () => {
  const own = pr(1, "main", "a", { author: { login: "dhruv" } });
  const r = landableRun([own], new Map([[1, ok("dhruv")]]), { me: "dhruv" });
  assert.equal(r.ceiling, null);
  assert.deepEqual(r.run[0].approvedBy, ["dhruv (land request)"]);
});

test("landableRun: someone else's PR needs a verdict from another account, and a human approval where GitHub requires a review", () => {
  const theirs = pr(1, "main", "a");
  const noApproval = landableRun([theirs], new Map([[1, ok("dhruv")]]), { me: "dhruv", requiredApprovals: 1 });
  assert.deepEqual(noApproval.ceiling, { number: 1, blocker: "GitHub requires a review: waiting for a human approval of this patch" });
  const selfVerdict = landableRun([theirs], new Map([[1, ok("vlad")]]), { me: "dhruv" });
  assert.equal(selfVerdict.ceiling.blocker, "verdict was not recorded by someone other than the PR author");
});

// --- --force: GitHub's admin bypass skips every branch rule, so ship takes it only when the review is all that is missing

const checkRun = (name, conclusion, app = 7) => ({ __typename: "CheckRun", name, conclusion, checkSuite: { app: { databaseId: app } } });
const rollup = (...nodes) => ({ statusCheckRollup: { contexts: { nodes } } });
const guarded = ({ classic = {}, rules = [], threads = [], onMerge = null, onHead = [checkRun("build", "SUCCESS")] } = {}) => ({
  ref: {
    target: { oid: "b".repeat(40) }, refUpdateRule: { pattern: "main" },
    branchProtectionRule: classic && { lockBranch: false, requiresDeployments: false, requiresConversationResolution: false, requiresStrictStatusChecks: false, requiredStatusChecks: [{ context: "build", app: { databaseId: 7 } }], ...classic },
    rules: { nodes: rules },
  },
  pullRequest: { reviewThreads: { nodes: threads }, potentialMergeCommit: onMerge && rollup(...onMerge) },
  object: rollup(...onHead),
});

test("bypassBlockers: the admin bypass is taken only when every other rule holds as GitHub would judge it", () => {
  assert.deepEqual(bypassBlockers(guarded(), { behind: false }), []);
  assert.deepEqual(bypassBlockers(guarded({ rules: [{ type: "DELETION", parameters: null }, { type: "PULL_REQUEST", parameters: { requiredReviewThreadResolution: false } }] }), { behind: false }), [], "rules a squash merge keeps");
  const cases = [
    [{ onHead: [checkRun("build", "SUCCESS", 99)] }, false, "required check build has not passed", "a pass from an app other than the one the rule names"],
    [{ onMerge: [checkRun("build", "FAILURE")] }, false, "required check build has not passed", "GitHub judges the test merge commit when it has results"],
    [{ classic: { requiresDeployments: true } }, false, "the branch requires deployments"],
    [{ rules: [{ type: "REQUIRED_DEPLOYMENTS", parameters: {} }] }, false, "the branch has a REQUIRED_DEPLOYMENTS rule"],
    [{ classic: null }, false, "only admins can read the branch's protection"],
    [{ classic: { requiresConversationResolution: true }, threads: [{ isResolved: true }, { isResolved: false }] }, false, "a review conversation is unresolved"],
    [{ classic: { requiresStrictStatusChecks: true } }, true, "the head is behind its base, which the branch requires it to include"],
  ];
  for (const [shape, behind, blocker, why = blocker] of cases) assert.deepEqual(bypassBlockers(guarded(shape), { behind }), [blocker], why);
});
