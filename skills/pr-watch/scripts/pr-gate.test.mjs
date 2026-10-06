import test from "node:test";
import assert from "node:assert/strict";

import { evaluateGate, fetchSnapshot, parseArgs, watchGate } from "./pr-gate.mjs";

const HEAD = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const OTHER = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const HEAD_COMMITTED_AT = "2026-08-28T20:39:38Z";
const REQUESTED_AT = "2026-08-28T20:40:00Z";
const REVIEWED_AT = "2026-08-28T20:42:39Z";
const BOT = "review-bot[bot]";
const WITH_BOT = { reviewers: ["review-bot"], requestComment: "@review-bot review" };

function baseSnapshot(overrides = {}) {
  return {
    pr: {
      state: "OPEN",
      isDraft: false,
      mergeable: true,
      mergeStateStatus: "CLEAN",
      reviewDecision: "APPROVED",
      headRefOid: HEAD,
      expectedHead: HEAD,
      headCommittedAt: HEAD_COMMITTED_AT,
    },
    checkRuns: [{ name: "ci", status: "COMPLETED", conclusion: "SUCCESS" }],
    reviewThreads: [],
    reviews: [],
    comments: [],
    reactions: [],
    ...overrides,
  };
}

function withPr(overrides) {
  return baseSnapshot({ pr: { ...baseSnapshot().pr, ...overrides } });
}

// --- generic PR state -------------------------------------------------------

test("ready: open, at expected HEAD, mergeable, checks green, no threads", () => {
  assert.deepEqual(evaluateGate(baseSnapshot()), { state: "ready", reasons: [], threads: [] });
});

test("pending: checks still running", () => {
  const result = evaluateGate(baseSnapshot({ checkRuns: [{ name: "ci", status: "IN_PROGRESS", conclusion: null }] }));
  assert.equal(result.state, "pending");
  assert.ok(result.reasons.some((r) => r.includes("ci")));
});

test("pending: no checks at all by default", () => {
  const result = evaluateGate(baseSnapshot({ checkRuns: [] }));
  assert.equal(result.state, "pending");
  assert.ok(result.reasons.some((r) => r.toLowerCase().includes("no check")));
});

test("ready: no checks is clean when --allow-no-checks", () => {
  const result = evaluateGate(baseSnapshot({ checkRuns: [] }), { allowNoChecks: true });
  assert.equal(result.state, "ready");
});

test("ready: skipped and neutral conclusions are not failures", () => {
  const result = evaluateGate(baseSnapshot({
    checkRuns: [
      { name: "ci", status: "COMPLETED", conclusion: "SUCCESS" },
      { name: "optional", status: "COMPLETED", conclusion: "SKIPPED" },
      { name: "lint", status: "COMPLETED", conclusion: "NEUTRAL" },
    ],
  }));
  assert.equal(result.state, "ready");
});

test("blocked: a failed check", () => {
  const result = evaluateGate(baseSnapshot({ checkRuns: [{ name: "ci", status: "COMPLETED", conclusion: "FAILURE" }] }));
  assert.equal(result.state, "blocked");
  assert.ok(result.reasons.some((r) => r.includes("FAILURE")));
});

// --- required and optional checks --------------------------------------------

const REQUIRED_CI = { name: "ci", status: "COMPLETED", conclusion: "SUCCESS", required: true };

test("ready: a failing check that is not required becomes a note when required checks exist", () => {
  const result = evaluateGate(baseSnapshot({
    pr: { ...baseSnapshot().pr, mergeStateStatus: "UNSTABLE" },
    checkRuns: [REQUIRED_CI, { name: "Visual Recap", status: "COMPLETED", conclusion: "FAILURE", required: false }],
  }));
  assert.equal(result.state, "ready");
  assert.deepEqual(result.reasons, []);
  assert.ok(result.notes.some((n) => n.includes("Visual Recap") && n.includes("not required")));
});

test("ready: a running check that is not required does not hold the gate", () => {
  const result = evaluateGate(baseSnapshot({
    checkRuns: [REQUIRED_CI, { name: "Visual Recap", status: "IN_PROGRESS", conclusion: null, required: false }],
  }));
  assert.equal(result.state, "ready");
  assert.ok(result.notes.some((n) => n.includes("Visual Recap")));
});

test("blocked: a failing required check blocks even beside optional checks", () => {
  const result = evaluateGate(baseSnapshot({
    checkRuns: [{ ...REQUIRED_CI, conclusion: "FAILURE" }, { name: "lint", status: "COMPLETED", conclusion: "SUCCESS", required: false }],
  }));
  assert.equal(result.state, "blocked");
  assert.ok(result.reasons.some((r) => r.includes("ci")));
});

test("blocked: every check counts when none is marked required", () => {
  const result = evaluateGate(baseSnapshot({
    checkRuns: [
      { name: "ci", status: "COMPLETED", conclusion: "SUCCESS", required: false },
      { name: "lint", status: "COMPLETED", conclusion: "FAILURE", required: false },
    ],
  }));
  assert.equal(result.state, "blocked");
  assert.ok(result.reasons.some((r) => r.includes("lint")));
});

test("ready: an ignored check is left out entirely", () => {
  const result = evaluateGate(baseSnapshot({
    checkRuns: [
      { name: "ci", status: "COMPLETED", conclusion: "SUCCESS" },
      { name: "Visual Recap", status: "COMPLETED", conclusion: "FAILURE" },
    ],
  }), { ignoreChecks: ["visual recap"] });
  assert.deepEqual(result, { state: "ready", reasons: [], threads: [] });
});

test("pending: ignoring every check leaves nothing to prove readiness", () => {
  const result = evaluateGate(baseSnapshot(), { ignoreChecks: ["ci"] });
  assert.equal(result.state, "pending");
  assert.ok(result.reasons.some((r) => r.includes("ignored")));
});

test("ready: the UNSTABLE merge state alone does not block", () => {
  const result = evaluateGate(withPr({ mergeStateStatus: "UNSTABLE" }));
  assert.deepEqual(result, { state: "ready", reasons: [], threads: [] });
});

test("blocked: DIRTY merge state blocks", () => {
  assert.equal(evaluateGate(withPr({ mergeStateStatus: "DIRTY" })).state, "blocked");
});

test("pending: mergeability unknown", () => {
  const result = evaluateGate(withPr({ mergeable: null, mergeStateStatus: "UNKNOWN" }));
  assert.equal(result.state, "pending");
});

test("pending: branch is behind its base", () => {
  const result = evaluateGate(withPr({ mergeStateStatus: "BEHIND" }));
  assert.equal(result.state, "pending");
  assert.ok(result.reasons.some((r) => r.toLowerCase().includes("behind")));
});

test("pending: GitHub BLOCKED merge state while checks settle", () => {
  const result = evaluateGate(withPr({ mergeStateStatus: "BLOCKED" }));
  assert.equal(result.state, "pending");
});

test("pending: truncated GitHub collections cannot prove readiness", () => {
  const result = evaluateGate(baseSnapshot({ truncated: true }));
  assert.equal(result.state, "pending");
});

test("blocked: merge conflicts", () => {
  const result = evaluateGate(withPr({ mergeable: false, mergeStateStatus: "DIRTY" }));
  assert.equal(result.state, "blocked");
});

test("blocked: draft PR", () => {
  assert.equal(evaluateGate(withPr({ isDraft: true })).state, "blocked");
});

test("blocked: closed PR", () => {
  assert.equal(evaluateGate(withPr({ state: "MERGED" })).state, "blocked");
});

test("blocked: missing expected HEAD fails closed", () => {
  assert.equal(evaluateGate(withPr({ expectedHead: undefined })).state, "blocked");
});

test("blocked: expected HEAD differs from the PR HEAD", () => {
  const result = evaluateGate(withPr({ expectedHead: OTHER }));
  assert.equal(result.state, "blocked");
  assert.ok(result.reasons.some((r) => r.includes("expected HEAD")));
});

test("blocked: review decision CHANGES_REQUESTED", () => {
  assert.equal(evaluateGate(withPr({ reviewDecision: "CHANGES_REQUESTED" })).state, "blocked");
});

// --- review threads ---------------------------------------------------------

test("blocked: unresolved thread is reported with path, line, author, and body", () => {
  const result = evaluateGate(baseSnapshot({
    reviewThreads: [
      { isResolved: false, isOutdated: false, path: "src/a.ts", line: 12, author: BOT, body: "Null check missing" },
      { isResolved: true, isOutdated: false, path: "src/b.ts", line: 3, author: BOT, body: "resolved" },
      { isResolved: false, isOutdated: true, path: "src/c.ts", line: 9, author: BOT, body: "outdated" },
    ],
  }));
  assert.equal(result.state, "blocked");
  assert.deepEqual(result.threads, [{ path: "src/a.ts", line: 12, author: BOT, body: "Null check missing" }]);
});

test("thread bodies are truncated for prompt safety", () => {
  const result = evaluateGate(baseSnapshot({
    reviewThreads: [{ isResolved: false, isOutdated: false, path: "x", line: 1, author: "a", body: "y".repeat(1000) }],
  }));
  assert.ok(result.threads[0].body.length < 1000);
  assert.ok(result.threads[0].body.endsWith("..."));
});

// --- configured reviewers ---------------------------------------------------

// --- written human reviews ----------------------------------------------------

const PR_AUTHOR = "dhruv";
const HUMAN = "teammate";
const LATER = "2026-08-28T21:00:00Z";
const humanReview = (overrides = {}) => ({
  author: HUMAN, authorType: "User", state: "COMMENTED", commitId: HEAD,
  submittedAt: REVIEWED_AT, body: "The joiner drops messages sent before the reply.", ...overrides,
});
const withReviews = (reviews, extra = {}) => baseSnapshot({
  pr: { ...baseSnapshot().pr, author: PR_AUTHOR },
  reviews,
  ...extra,
});

test("blocked: an unanswered written review from a person is listed with its text", () => {
  const result = evaluateGate(withReviews([humanReview()]));
  assert.equal(result.state, "blocked");
  assert.ok(result.reasons.some((r) => r.includes(HUMAN)));
  assert.deepEqual(result.threads, [{
    kind: "review", path: null, line: null, author: HUMAN, submittedAt: REVIEWED_AT,
    body: "The joiner drops messages sent before the reply.",
  }]);
});

test("ready: a later PR comment from the PR author answers the review", () => {
  const result = evaluateGate(withReviews([humanReview()], {
    comments: [{ author: PR_AUTHOR, body: "Fixed in 1a2b3c4: the joiner now reads earlier messages.", createdAt: LATER }],
  }));
  assert.equal(result.state, "ready");
});

test("blocked: an empty review from the PR author (a thread reply) does not answer it", () => {
  const result = evaluateGate(withReviews([
    humanReview(),
    humanReview({ author: PR_AUTHOR, submittedAt: LATER, body: "" }),
  ]));
  assert.equal(result.state, "blocked");
});

test("ready: a later review with text from the PR author answers it", () => {
  const result = evaluateGate(withReviews([
    humanReview(),
    humanReview({ author: PR_AUTHOR, submittedAt: LATER, body: "Fixed in 1a2b3c4." }),
  ]));
  assert.equal(result.state, "ready");
});

test("blocked: a PR author comment older than the review does not answer it", () => {
  const result = evaluateGate(withReviews([humanReview()], {
    comments: [{ author: PR_AUTHOR, body: "Ready for review", createdAt: REQUESTED_AT }],
  }));
  assert.equal(result.state, "blocked");
});

test("ready: a newer review from the same reviewer answers the earlier one", () => {
  const result = evaluateGate(withReviews([
    humanReview(),
    humanReview({ state: "APPROVED", submittedAt: LATER, body: "Looks good now" }),
  ]));
  assert.equal(result.state, "ready");
});

test("ready: bot reviews, empty reviews, approvals, and the author's own reviews never block", () => {
  const result = evaluateGate(withReviews([
    humanReview({ author: "coderabbitai", authorType: "Bot" }),
    humanReview({ author: "review-bot[bot]", authorType: undefined }),
    humanReview({ body: "   " }),
    humanReview({ state: "APPROVED", body: "Please fix before the flag is enabled" }),
    humanReview({ author: PR_AUTHOR }),
  ]));
  assert.deepEqual(result, { state: "ready", reasons: [], threads: [] });
});

test("pending: configured reviewer has not covered the current HEAD", () => {
  const result = evaluateGate(baseSnapshot(), WITH_BOT);
  assert.equal(result.state, "pending");
  assert.ok(result.reasons.some((r) => r.includes("review-bot")));
});

test("ready: reviewer posted a review object bound to HEAD", () => {
  const result = evaluateGate(baseSnapshot({
    reviews: [{ author: BOT, commitId: HEAD, state: "COMMENTED", submittedAt: REVIEWED_AT }],
  }), WITH_BOT);
  assert.equal(result.state, "ready");
});

test("pending: reviewer review object bound to an older commit is stale", () => {
  const result = evaluateGate(baseSnapshot({
    reviews: [{ author: BOT, commitId: OTHER, state: "APPROVED", submittedAt: REVIEWED_AT }],
  }), WITH_BOT);
  assert.equal(result.state, "pending");
});

test("blocked: reviewer requested changes on HEAD", () => {
  const result = evaluateGate(baseSnapshot({
    reviews: [{ author: BOT, commitId: HEAD, state: "CHANGES_REQUESTED", submittedAt: REVIEWED_AT }],
  }), WITH_BOT);
  assert.equal(result.state, "blocked");
});

test("reviewer login matches with or without the [bot] suffix", () => {
  const snapshot = baseSnapshot({
    reviews: [{ author: "review-bot", commitId: HEAD, state: "APPROVED", submittedAt: REVIEWED_AT }],
  });
  assert.equal(evaluateGate(snapshot, { reviewers: ["review-bot[bot]"] }).state, "ready");
  assert.equal(evaluateGate(snapshot, { reviewers: ["other-bot"] }).state, "pending");
});

test("ready: +1 reaction newer than the request comment", () => {
  const result = evaluateGate(baseSnapshot({
    comments: [{ author: "human", body: "@review-bot review", createdAt: REQUESTED_AT }],
    reactions: [{ author: BOT, content: "+1", createdAt: REVIEWED_AT }],
  }), WITH_BOT);
  assert.equal(result.state, "ready");
});

test("ready: +1 reaction newer than HEAD needs no request comment", () => {
  const result = evaluateGate(baseSnapshot({
    reactions: [{ author: BOT, content: "THUMBS_UP", createdAt: REVIEWED_AT }],
  }), WITH_BOT);
  assert.equal(result.state, "ready");
});

test("pending: +1 reaction older than HEAD is stale", () => {
  const result = evaluateGate(baseSnapshot({
    reactions: [{ author: BOT, content: "+1", createdAt: "2026-08-28T20:30:00Z" }],
  }), WITH_BOT);
  assert.equal(result.state, "pending");
});

test("pending: +1 reaction after HEAD but older than the newest request is stale", () => {
  const result = evaluateGate(baseSnapshot({
    comments: [{ author: "human", body: "@review-bot review", createdAt: REQUESTED_AT }],
    reactions: [{ author: BOT, content: "+1", createdAt: "2026-08-28T20:39:50Z" }],
  }), WITH_BOT);
  assert.equal(result.state, "pending");
});

test("pending: reaction at exactly the request timestamp is not newer evidence", () => {
  const result = evaluateGate(baseSnapshot({
    comments: [{ author: "human", body: "@review-bot review", createdAt: REQUESTED_AT }],
    reactions: [{ author: BOT, content: "+1", createdAt: REQUESTED_AT }],
  }), WITH_BOT);
  assert.equal(result.state, "pending");
});

test("pending: eyes reaction means the reviewer is still working", () => {
  const result = evaluateGate(baseSnapshot({
    reactions: [{ author: BOT, content: "eyes", createdAt: REVIEWED_AT }],
  }), WITH_BOT);
  assert.equal(result.state, "pending");
  assert.ok(result.reasons.some((r) => r.toLowerCase().includes("reviewing")));
});

test("ready: reviewer comment newer than the request counts as coverage", () => {
  const result = evaluateGate(baseSnapshot({
    comments: [
      { author: "human", body: "@review-bot review", createdAt: REQUESTED_AT },
      { author: BOT, body: "No issues found.", createdAt: REVIEWED_AT },
    ],
  }), WITH_BOT);
  assert.equal(result.state, "ready");
});

test("pending: reviewer comment older than the request is stale", () => {
  const result = evaluateGate(baseSnapshot({
    comments: [
      { author: BOT, body: "No issues found.", createdAt: "2026-08-28T20:39:50Z" },
      { author: "human", body: "@review-bot review", createdAt: REQUESTED_AT },
    ],
  }), WITH_BOT);
  assert.equal(result.state, "pending");
});

test("multiple reviewers must each cover HEAD", () => {
  const snapshot = baseSnapshot({
    reviews: [{ author: "a-bot", commitId: HEAD, state: "APPROVED", submittedAt: REVIEWED_AT }],
  });
  const result = evaluateGate(snapshot, { reviewers: ["a-bot", "b-bot"] });
  assert.equal(result.state, "pending");
  assert.ok(result.reasons.some((r) => r.includes("b-bot")));
  assert.ok(!result.reasons.some((r) => r.includes("a-bot")));
});

// --- CLI parsing ------------------------------------------------------------

test("parseArgs collects repeated reviewers and lowercases the head", () => {
  const args = parseArgs(["--repo", "o/r", "--pr", "4", "--expected-head", HEAD.toUpperCase(), "--reviewer", "a", "--reviewer", "b", "--allow-no-checks"]);
  assert.deepEqual(args.reviewers, ["a", "b"]);
  assert.equal(args.expectedHead, HEAD);
  assert.equal(args.allowNoChecks, true);
});

test("parseArgs collects repeated ignored checks", () => {
  const args = parseArgs(["--ignore-check", "Visual Recap", "--ignore-check", "preview"]);
  assert.deepEqual(args.ignoreChecks, ["Visual Recap", "preview"]);
});

test("parseArgs rejects a short head and unknown flags", () => {
  assert.throws(() => parseArgs(["--expected-head", "abc"]), /40-character/);
  assert.throws(() => parseArgs(["--bogus"]), /unknown argument/);
  assert.throws(() => parseArgs(["--pr", "0"]), /positive integer/);
});

// --- fetchSnapshot ----------------------------------------------------------

test("fetchSnapshot maps GraphQL and REST payloads into the snapshot shape", async () => {
  const calls = [];
  const runGh = async (args) => {
    calls.push(args);
    if (args[1] === "graphql") {
      return {
        data: {
          repository: {
            pullRequest: {
              state: "OPEN", isDraft: false, mergeable: "MERGEABLE", mergeStateStatus: "CLEAN",
              reviewDecision: null, headRefOid: HEAD, author: { login: "dhruv" },
              commits: { nodes: [{ commit: {
                oid: HEAD,
                committedDate: HEAD_COMMITTED_AT,
                statusCheckRollup: { contexts: {
                  nodes: [
                    { __typename: "CheckRun", name: "ci", isRequired: true },
                    { __typename: "StatusContext", context: "legacy", isRequired: false },
                  ],
                  pageInfo: { hasNextPage: false },
                } },
              } }] },
              reviewThreads: {
                nodes: [{ isResolved: false, isOutdated: false, path: "src/a.ts", line: 4, comments: { nodes: [{ author: { login: BOT }, body: "fix me" }] } }],
                pageInfo: { hasNextPage: false },
              },
              reviews: { nodes: [{ author: { __typename: "Bot", login: BOT }, state: "COMMENTED", submittedAt: REVIEWED_AT, body: "summary", commit: { oid: HEAD } }], pageInfo: { hasNextPage: false } },
              comments: { nodes: [{ author: { login: "human" }, body: "@review-bot review", createdAt: REQUESTED_AT }], pageInfo: { hasNextPage: false } },
              reactions: { nodes: [{ user: { login: BOT }, content: "THUMBS_UP", createdAt: REVIEWED_AT }], pageInfo: { hasNextPage: false } },
            },
          },
        },
      };
    }
    if (args[1].includes("check-runs")) {
      return { total_count: 1, check_runs: [{ name: "ci", status: "completed", conclusion: "success" }] };
    }
    return { total_count: 1, statuses: [{ context: "legacy", state: "pending" }] };
  };
  const snapshot = await fetchSnapshot({ owner: "o", name: "r" }, 4, runGh);
  assert.equal(snapshot.pr.mergeable, true);
  assert.equal(snapshot.pr.headCommittedAt, HEAD_COMMITTED_AT);
  assert.equal(snapshot.pr.author, "dhruv");
  assert.deepEqual(snapshot.checkRuns, [
    { name: "ci", status: "COMPLETED", conclusion: "SUCCESS", required: true },
    { name: "legacy", status: "IN_PROGRESS", conclusion: null, required: false },
  ]);
  assert.deepEqual(snapshot.reviews, [{ author: BOT, authorType: "Bot", commitId: HEAD, state: "COMMENTED", submittedAt: REVIEWED_AT, body: "summary" }]);
  assert.deepEqual(snapshot.reviewThreads, [{ isResolved: false, isOutdated: false, path: "src/a.ts", line: 4, author: BOT, body: "fix me" }]);
  assert.deepEqual(snapshot.reactions, [{ author: BOT, content: "+1", createdAt: REVIEWED_AT }]);
  assert.equal(snapshot.truncated, false);
  assert.equal(calls.length, 3);
  assert.ok(calls.every((c) => c[0] === "api"));
});

test("fetchSnapshot flags truncation when REST totals exceed the page", async () => {
  const runGh = async (args) => {
    if (args[1] === "graphql") {
      return { data: { repository: { pullRequest: { state: "OPEN", headRefOid: HEAD, commits: { nodes: [] } } } } };
    }
    if (args[1].includes("check-runs")) return { total_count: 101, check_runs: [] };
    return { total_count: 0, statuses: [] };
  };
  const snapshot = await fetchSnapshot({ owner: "o", name: "r" }, 4, runGh);
  assert.equal(snapshot.truncated, true);
});

// --- watch ------------------------------------------------------------------

function fakeClock() {
  let t = 0;
  return { now: () => t, wait: async (ms) => { t += ms; } };
}

test("watch: ready only after three unchanged clean observations", async () => {
  const clock = fakeClock();
  const seen = [];
  const result = await watchGate({
    loadSnapshot: async () => baseSnapshot(),
    timeoutMs: 10_000, intervalMs: 1_000, ...clock,
    onObservation: (o) => seen.push(o.state),
  });
  assert.equal(result.state, "ready");
  assert.deepEqual(seen, ["pending", "pending", "ready"]);
});

test("watch: a changed check set resets the stability count", async () => {
  const clock = fakeClock();
  const snapshots = [
    baseSnapshot(),
    baseSnapshot(),
    baseSnapshot({ checkRuns: [{ name: "ci", status: "COMPLETED", conclusion: "SUCCESS" }, { name: "late", status: "COMPLETED", conclusion: "SUCCESS" }] }),
  ];
  let i = 0;
  const seen = [];
  const result = await watchGate({
    loadSnapshot: async () => snapshots[Math.min(i++, snapshots.length - 1)],
    timeoutMs: 20_000, intervalMs: 1_000, ...clock,
    onObservation: (o) => seen.push(o.state),
  });
  assert.equal(result.state, "ready");
  assert.deepEqual(seen, ["pending", "pending", "pending", "pending", "ready"]);
});

test("watch: blocked returns immediately with threads", async () => {
  const clock = fakeClock();
  const result = await watchGate({
    loadSnapshot: async () => baseSnapshot({
      reviewThreads: [{ isResolved: false, isOutdated: false, path: "p", line: 1, author: BOT, body: "b" }],
    }),
    timeoutMs: 10_000, intervalMs: 1_000, ...clock,
  });
  assert.equal(result.state, "blocked");
  assert.equal(result.threads.length, 1);
});

test("watch: times out as pending", async () => {
  const clock = fakeClock();
  const result = await watchGate({
    loadSnapshot: async () => baseSnapshot({ checkRuns: [{ name: "ci", status: "QUEUED", conclusion: null }] }),
    timeoutMs: 3_000, intervalMs: 1_000, ...clock,
  });
  assert.equal(result.state, "pending");
  assert.ok(result.reasons.some((r) => r.includes("remained pending")));
});

test("watch: reviewer options are applied on every poll", async () => {
  const clock = fakeClock();
  const result = await watchGate({
    loadSnapshot: async () => baseSnapshot(),
    options: WITH_BOT,
    timeoutMs: 2_000, intervalMs: 1_000, ...clock,
  });
  assert.equal(result.state, "pending");
  assert.ok(result.reasons.some((r) => r.includes("review-bot")));
});

test("watch: rejects a stability requirement below two", async () => {
  await assert.rejects(
    watchGate({ loadSnapshot: async () => baseSnapshot(), timeoutMs: 1, intervalMs: 1, requiredReadyObservations: 1 }),
    /at least 2/
  );
});
