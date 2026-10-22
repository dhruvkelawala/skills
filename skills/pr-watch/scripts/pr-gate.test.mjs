import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { evaluateGate, fetchSnapshot, parseArgs, watchGate } from "./pr-gate.mjs";

const GATE = fileURLToPath(new URL("./pr-gate.mjs", import.meta.url));

const HEAD = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const OTHER = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const HEAD_COMMITTED_AT = "2026-08-28T20:39:38Z";
const REQUESTED_AT = "2026-08-28T20:40:00Z";
const REVIEWED_AT = "2026-08-28T20:42:39Z";
const BOT = "review-bot[bot]";
const PR_AUTHOR = "dhruv";
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

test("blocked: unresolved thread is reported with path, line, author, body, whether a bot wrote it, and the ids a reply needs", () => {
  const result = evaluateGate(baseSnapshot({
    reviewThreads: [
      { id: "PRRT_a", replyTo: 101, lastCommentId: 102, isResolved: false, isOutdated: false, path: "src/a.ts", line: 12, author: BOT, body: "Null check missing" },
      { id: "PRRT_b", isResolved: true, isOutdated: false, path: "src/b.ts", line: 3, author: BOT, body: "resolved" },
      { id: "PRRT_c", isResolved: false, isOutdated: true, path: "src/c.ts", line: 9, author: BOT, body: "outdated" },
    ],
  }));
  assert.equal(result.state, "blocked");
  assert.deepEqual(result.threads, [{
    id: "PRRT_a", replyTo: 101, lastCommentId: 102, path: "src/a.ts", line: 12, author: BOT, bot: true, body: "Null check missing",
  }]);
});

// --- replies held until "post" ------------------------------------------------

const personThread = (overrides = {}) => ({
  id: "PRRT_p", replyTo: 201, lastCommentId: 201, isResolved: false, isOutdated: false, path: "src/join.ts", line: 40,
  author: "teammate", authorType: "User", commenters: [{ login: "teammate", type: "User" }], body: "Rename this to joinAll", ...overrides,
});
const heldReply = { kind: "reply", thread: "PRRT_p", replyTo: 201, seen: 201, to: "teammate", body: "Renamed in 1a2b3c4." };

test("pending: a person's thread whose reply is held waits on post instead of blocking", () => {
  const result = evaluateGate(baseSnapshot({ reviewThreads: [personThread()] }), { held: [heldReply] });
  assert.deepEqual(result, { state: "pending", reasons: ['1 item(s) to people held until "post"'], threads: [] });
});

test("a person's thread still counts after a push marks it outdated, until the PR author answers it", () => {
  const outdated = personThread({ isOutdated: true });
  const unanswered = evaluateGate(baseSnapshot({ pr: { ...baseSnapshot().pr, author: PR_AUTHOR }, reviewThreads: [outdated] }));
  assert.equal(unanswered.state, "blocked");
  assert.deepEqual(unanswered.threads.map((t) => t.id), ["PRRT_p"]);
  const answered = evaluateGate(baseSnapshot({
    pr: { ...baseSnapshot().pr, author: PR_AUTHOR },
    reviewThreads: [{ ...outdated, lastAuthor: PR_AUTHOR }],
  }));
  assert.equal(answered.state, "ready");
});

test("blocked: a held reply stops covering the thread once the person comments again", () => {
  const result = evaluateGate(baseSnapshot({ reviewThreads: [personThread({ lastCommentId: 202 })] }), { held: [heldReply] });
  assert.equal(result.state, "blocked");
  assert.deepEqual(result.threads.map((t) => t.id), ["PRRT_p"]);
});

// A thread is a bot's only while no person has spoken in it: a person who opens it or answers the
// bot gets their reply held until "post". The PR author's own replies keep a bot's thread a bot's.
const CODEX = { login: "codex-connector", type: "Bot" };
const TEAMMATE = { login: "teammate", type: "User" };
const OWNER = { login: PR_AUTHOR, type: "User" };
for (const [name, commenters, bot] of [
  ["a bot opened it and has the last word", [CODEX, CODEX], true],
  ["a bot opened it and the PR author replied", [CODEX, OWNER], true],
  ["a login ending in [bot] opened it", [{ login: BOT }], true],
  ["a person opened it", [TEAMMATE], false],
  ["a bot opened it and a person joined", [CODEX, TEAMMATE], false],
  ["a bot opened it, a person replied, and the bot answered last", [CODEX, TEAMMATE, CODEX], false],
]) {
  test(`thread from ${name}: bot is ${bot}`, () => {
    const [first] = commenters;
    const thread = { author: first.login, authorType: first.type, commenters };
    const result = evaluateGate(baseSnapshot({
      pr: { ...baseSnapshot().pr, author: PR_AUTHOR },
      reviewThreads: [{ isResolved: false, isOutdated: false, path: "src/a.ts", line: 1, body: "b", ...thread }],
    }));
    assert.equal(result.threads[0].bot, bot);
  });
}

test("thread bodies are truncated for prompt safety", () => {
  const result = evaluateGate(baseSnapshot({
    reviewThreads: [{ isResolved: false, isOutdated: false, path: "x", line: 1, author: "a", body: "y".repeat(1000) }],
  }));
  assert.ok(result.threads[0].body.length < 1000);
  assert.ok(result.threads[0].body.endsWith("..."));
});

// --- configured reviewers ---------------------------------------------------

// --- written human reviews ----------------------------------------------------

const HUMAN = "teammate";
const LATER = "2026-08-28T21:00:00Z";
const humanReview = (overrides = {}) => ({
  id: "PRR_h", author: HUMAN, authorType: "User", state: "COMMENTED", commitId: HEAD,
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
    kind: "review", id: "PRR_h", path: null, line: null, author: HUMAN, submittedAt: REVIEWED_AT,
    body: "The joiner drops messages sent before the reply.",
  }]);
});

test("pending: a written review whose answer is held waits on post instead of blocking", () => {
  const held = [{ kind: "comment", review: "PRR_h", to: HUMAN, body: "Fixed in 1a2b3c4." }];
  const result = evaluateGate(withReviews([humanReview()]), { held });
  assert.deepEqual(result, { state: "pending", reasons: ['1 item(s) to people held until "post"'], threads: [] });
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
                nodes: [{
                  id: "PRRT_a", isResolved: false, isOutdated: false, path: "src/a.ts", line: 4,
                  opening: { nodes: [{ databaseId: 101, author: { __typename: "Bot", login: "review-bot" }, body: "fix me" }] },
                  last: { nodes: [{ databaseId: 102, author: { login: "teammate" } }] },
                  comments: {
                    nodes: [{ author: { __typename: "Bot", login: "review-bot" } }, { author: { __typename: "User", login: "teammate" } }],
                    pageInfo: { hasNextPage: false },
                  },
                }],
                pageInfo: { hasNextPage: false },
              },
              reviews: { nodes: [{ id: "PRR_b", author: { __typename: "Bot", login: BOT }, state: "COMMENTED", submittedAt: REVIEWED_AT, body: "summary", commit: { oid: HEAD } }], pageInfo: { hasNextPage: false } },
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
  assert.deepEqual(snapshot.reviews, [{ id: "PRR_b", author: BOT, authorType: "Bot", commitId: HEAD, state: "COMMENTED", submittedAt: REVIEWED_AT, body: "summary" }]);
  assert.deepEqual(snapshot.reviewThreads, [{
    id: "PRRT_a", replyTo: 101, lastCommentId: 102, isResolved: false, isOutdated: false, path: "src/a.ts", line: 4,
    author: "review-bot", authorType: "Bot", body: "fix me",
    lastAuthor: "teammate", commenters: [{ login: "review-bot", type: "Bot" }, { login: "teammate", type: "User" }], commentersTruncated: false,
  }]);
  assert.deepEqual(snapshot.reactions, [{ author: BOT, content: "+1", createdAt: REVIEWED_AT }]);
  assert.equal(snapshot.truncated, false);
  assert.equal(calls.length, 3);
  assert.ok(calls.every((c) => c[0] === "api"));
});

test("a thread longer than one page of comments counts as a person's, with its newest comment's id", async () => {
  const bot = { author: { __typename: "Bot", login: "coderabbitai" } };
  const runGh = async (args) => {
    if (args[1] === "graphql") {
      const thread = {
        id: "PRRT_long", isResolved: false, isOutdated: false,
        opening: { nodes: [{ databaseId: 1, ...bot, body: "finding" }] },
        last: { nodes: [{ databaseId: 150 }] },
        comments: { nodes: Array.from({ length: 100 }, () => bot), pageInfo: { hasNextPage: true } },
      };
      return { data: { repository: { pullRequest: {
        state: "OPEN", headRefOid: HEAD, commits: { nodes: [] },
        reviewThreads: { nodes: [thread], pageInfo: { hasNextPage: false } },
      } } } };
    }
    if (args[1].includes("check-runs")) return { total_count: 0, check_runs: [] };
    return { total_count: 0, statuses: [] };
  };
  const snapshot = await fetchSnapshot({ owner: "o", name: "r" }, 4, runGh);
  assert.equal(snapshot.truncated, true);
  assert.equal(snapshot.reviewThreads[0].lastCommentId, 150);
  const [thread] = evaluateGate({ ...snapshot, pr: { ...snapshot.pr, expectedHead: HEAD } }).threads;
  assert.equal(thread.bot, false, "a person may have spoken past the first page");
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

// --- GraphQL quota spent ------------------------------------------------------

// A gh on PATH whose GraphQL calls fail the way GitHub answers once the account's quota is spent,
// and whose REST calls answer from `fixtures`, keyed by endpoint without its query string. A
// fixture `{ httpError: "<status line>" }` fails that call the way gh reports an HTTP error.
function rateLimitedGh(t, fixtures) {
  const dir = mkdtempSync(join(tmpdir(), "pr-gate-gh-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(join(dir, "fixtures.json"), JSON.stringify(fixtures));
  writeFileSync(join(dir, "gh"), `#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const args = process.argv.slice(2);
fs.appendFileSync(path.join(__dirname, "calls.log"), args.slice(0, 2).join(" ") + "\\n");
if (args[0] === "api" && args[1] === "graphql") {
  process.stdout.write('{"errors":[{"type":"RATE_LIMITED","code":"graphql_rate_limit","message":"API rate limit already exceeded for user ID 50968441."}]}');
  process.stderr.write("gh: API rate limit already exceeded for user ID 50968441.\\n");
  process.exit(1);
}
const fixtures = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures.json"), "utf8"));
const endpoint = args[0] === "api" ? args[1].split("?")[0] : "";
const answer = fixtures[endpoint] ?? { httpError: "Not Found (HTTP 404)" };
if (answer.httpError) {
  process.stderr.write("gh: " + answer.httpError + "\\n");
  process.exit(1);
}
process.stdout.write(JSON.stringify(answer));
`, { mode: 0o755 });
  const gate = (...args) => {
    const run = spawnSync(process.execPath, [GATE, "--repo", "o/r", "--pr", "7", ...args, "--json"], {
      encoding: "utf8",
      env: { ...process.env, PATH: `${dir}:${process.env.PATH}` },
    });
    return { status: run.status, stderr: run.stderr, result: run.stdout ? JSON.parse(run.stdout) : null };
  };
  const calls = () => readFileSync(join(dir, "calls.log"), "utf8").trim().split("\n");
  return { gate, calls };
}

function restPr(overrides = {}) {
  return {
    "repos/o/r/pulls/7": {
      number: 7, state: "open", merged: false, draft: false, mergeable: true, mergeable_state: "clean",
      user: { login: PR_AUTHOR, type: "User" }, head: { sha: HEAD, ref: "feature" }, base: { ref: "main" },
    },
    [`repos/o/r/git/commits/${HEAD}`]: { sha: HEAD, committer: { date: HEAD_COMMITTED_AT } },
    [`repos/o/r/commits/${HEAD}/check-runs`]: { total_count: 1, check_runs: [{ name: "ci", status: "completed", conclusion: "success" }] },
    [`repos/o/r/commits/${HEAD}/status`]: { total_count: 0, statuses: [] },
    "repos/o/r/pulls/7/reviews": [],
    "repos/o/r/issues/7/comments": [],
    "repos/o/r/issues/7/reactions": [],
    "repos/o/r/branches/main": { name: "main", protection: { enabled: false, required_status_checks: { contexts: [], checks: [] } } },
    "repos/o/r/rules/branches/main": { httpError: "Upgrade to GitHub Pro or make this repository public to enable this feature. (HTTP 403)" },
    ...overrides,
  };
}

test("GraphQL quota spent: the gate reads through REST and holds short of ready, since threads are unknown", (t) => {
  const { gate, calls } = rateLimitedGh(t, restPr());
  const { status, stderr, result } = gate("--expected-head", HEAD);
  assert.equal(status, 1, stderr);
  assert.deepEqual(result, { state: "pending", reasons: ["review threads unknown: GraphQL quota"], threads: [] });
  assert.equal(calls()[0], "api graphql", "GraphQL stays the first try");
});

test("GraphQL quota spent: REST still shows a failed required check and an unanswered written review", (t) => {
  const { gate } = rateLimitedGh(t, restPr({
    [`repos/o/r/commits/${HEAD}/check-runs`]: { total_count: 2, check_runs: [
      { name: "ci", status: "completed", conclusion: "failure" },
      { name: "Visual Recap", status: "completed", conclusion: "failure" },
    ] },
    "repos/o/r/branches/main": { name: "main", protection: { enabled: true, required_status_checks: { contexts: ["ci"], checks: [{ context: "ci" }] } } },
    "repos/o/r/pulls/7/reviews": [{
      node_id: "PRR_h", user: { login: HUMAN, type: "User" }, state: "COMMENTED", commit_id: HEAD,
      submitted_at: REVIEWED_AT, body: "The joiner drops messages sent before the reply.",
    }],
  }));
  const { status, stderr, result } = gate("--expected-head", HEAD);
  assert.ok(result, stderr);
  assert.equal(status, 2);
  assert.equal(result.state, "blocked");
  assert.deepEqual(result.reasons, [
    `Written review from ${HUMAN} at ${REVIEWED_AT} has no reply`,
    'Check "ci" concluded FAILURE',
  ]);
  assert.deepEqual(result.notes, ['Check "Visual Recap" concluded FAILURE (not required)']);
  assert.equal(result.threads[0].kind, "review");
  assert.equal(result.threads[0].id, "PRR_h", "REST gives the review the same id GraphQL does");
});

for (const [failure, httpError] of [
  ["a server error", "Server Error (HTTP 502)"],
  ["a REST rate limit", "You have exceeded a secondary rate limit. Please wait a few minutes before you try again. (HTTP 403)"],
]) {
  test(`GraphQL quota spent: ${failure} on the rulesets read stops the gate instead of demoting a required check`, (t) => {
    const { gate } = rateLimitedGh(t, restPr({
      [`repos/o/r/commits/${HEAD}/check-runs`]: { total_count: 2, check_runs: [
        { name: "ci", status: "completed", conclusion: "success" },
        { name: "lint", status: "completed", conclusion: "failure" },
      ] },
      "repos/o/r/branches/main": { name: "main", protection: { enabled: true, required_status_checks: { contexts: ["ci"], checks: [{ context: "ci" }] } } },
      "repos/o/r/rules/branches/main": { httpError },
    }));
    const { status, stderr, result } = gate("--expected-head", HEAD);
    assert.equal(result, null, 'a lint check that a ruleset may require must not become a "not required" note');
    assert.equal(status, 2);
    assert.ok(stderr.includes(httpError), stderr);
  });
}

test("GraphQL quota spent: REST reads the PR's state, so a merged PR still blocks", (t) => {
  const pr = restPr()["repos/o/r/pulls/7"];
  const { gate } = rateLimitedGh(t, restPr({ "repos/o/r/pulls/7": { ...pr, state: "closed", merged: true } }));
  const { stderr, result } = gate("--expected-head", HEAD);
  assert.ok(result, stderr);
  assert.equal(result.state, "blocked");
  assert.ok(result.reasons.includes("PR is MERGED, not open"));
});

test("GraphQL quota spent: a standing change request in the REST reviews blocks, and a dismissal lifts it", (t) => {
  const review = (state, submitted_at) => ({ user: { login: HUMAN, type: "User" }, state, commit_id: HEAD, submitted_at, body: "" });
  const requested = rateLimitedGh(t, restPr({ "repos/o/r/pulls/7/reviews": [review("CHANGES_REQUESTED", REVIEWED_AT)] })).gate("--expected-head", HEAD);
  assert.ok(requested.result, requested.stderr);
  assert.ok(requested.result.reasons.includes("Review decision is CHANGES_REQUESTED"));
  const dismissed = rateLimitedGh(t, restPr({
    "repos/o/r/pulls/7/reviews": [review("CHANGES_REQUESTED", REVIEWED_AT), review("DISMISSED", LATER)],
  })).gate("--expected-head", HEAD);
  assert.deepEqual(dismissed.result.reasons, ["review threads unknown: GraphQL quota"]);
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
