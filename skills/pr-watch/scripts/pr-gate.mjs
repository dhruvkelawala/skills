#!/usr/bin/env node
// Deterministic PR readiness gate for the pr-watch skill.
//
// Public seam: evaluateGate(snapshot, options) -> { state, reasons, threads, notes? }
//   state:   "ready" | "pending" | "blocked"
//   reasons: human-readable strings explaining a non-ready state
//   threads: what a repair must address: unresolved review threads that are not outdated,
//            or are a person's and not yet answered by the PR author, and unanswered written
//            reviews from people (marked kind: "review"). A thread's `bot` is true while no
//            person has spoken in it.
//   notes:   present only when non-empty; checks that are not required and did not
//            pass, and a repository with no CI. Informational: they never change the state.
//
// Snapshot shape (built by fetchSnapshot, or handed in by tests):
//   pr:            { state, isDraft, mergeable, mergeStateStatus, reviewDecision,
//                    headRefOid, expectedHead, headCommittedAt, author, baseRefName }
//   checkRuns:     [{ name, status: "QUEUED"|"IN_PROGRESS"|"COMPLETED", conclusion, required }]
//   requiredChecks: required check names, including ones not yet reported; read for verification
//   truncated:     true when any GitHub collection exceeded one page
//   reviewThreads: [{ id, replyTo, lastCommentId, isResolved, isOutdated, path, line, author,
//                     authorType, body, lastAuthor, commenters: [{ login, type }], commentersTruncated }]
//                  // author, body and replyTo are the first comment's, lastCommentId and lastAuthor the newest's,
//                  // and commenters lists the authors of the first 100 comments in order
//   threadsUnknown: why the threads could not be read, such as "GraphQL quota"; holds the gate at pending
//   ci:            { workflows, requiredChecks, results }, only for a head with no check runs or
//                  statuses: the repository's active workflows, the checks its base branch requires,
//                  and the results posted on the base branch's head and the last merged PR's head
//   reviews:       [{ id, author, authorType, commitId, state, submittedAt, body }]
//   comments:      [{ author, body, createdAt }]      // PR-level issue comments
//   reactions:     [{ author, content, createdAt }]   // PR-level reactions
//
// Checks: when any check on the HEAD is required by the base branch, only required
// checks hold or block the gate. When none is marked required, every check counts. A HEAD
// with no checks waits for them, unless `ci` shows the repository has no CI at all.
//
// Options:
//   forVerification: allow draft and approval-only merge states; all other readiness checks remain
//   reviewers:      logins (with or without "[bot]") that must review the exact HEAD
//   requestComment: text the orchestrator posts to ask a reviewer for a pass;
//                   reviewer evidence older than the newest such comment is stale
//   allowNoChecks:  treat a HEAD with zero check/status contexts as clean, even where CI exists
//   ignoreChecks:   check names (case-insensitive) left out of the gate entirely
//   held:           items held.mjs keeps until the user says "post". They hold the gate at
//                   pending, and the threads and written reviews they answer stop blocking.
//
// CLI: node pr-gate.mjs --repo owner/name --pr N --expected-head SHA
//        [--reviewer LOGIN]... [--request-comment TEXT] [--allow-no-checks]
//        [--ignore-check NAME]... [--held-file PATH] [--json] [--watch]
//        [--timeout-seconds N] [--interval-seconds N]
// Exit codes: 0 ready, 1 pending/timeout, 2 blocked/invalid.
// Reads GitHub through the `gh` CLI only (execFile, never a shell); never mutates GitHub.
// GraphQL is the first try. When the account's GraphQL quota is spent, the same PR data comes
// through REST, apart from thread resolution, which REST cannot see.

import { execFile } from "node:child_process";
import fs from "node:fs";
import process from "node:process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import { coversReview, coversThread, readHeld } from "./held.mjs";

const execFileP = promisify(execFile);

const OK_CONCLUSIONS = new Set(["SUCCESS", "NEUTRAL", "SKIPPED"]);
const DEFAULT_TIMEOUT_SECONDS = 30 * 60;
const DEFAULT_INTERVAL_SECONDS = 30;
const DEFAULT_READY_OBSERVATIONS = 3; // first clean poll + two unchanged confirmations
const THREAD_BODY_LIMIT = 400;
const SHA_RE = /^[0-9a-f]{40}$/;

export function evaluateGate(snapshot, options = {}) {
  const blocked = [];
  const pending = [];
  const pr = snapshot?.pr ?? {};
  const checkRuns = snapshot?.checkRuns ?? [];
  const reviewThreads = snapshot?.reviewThreads ?? [];
  const head = String(pr.headRefOid ?? "").toLowerCase();
  const expectedHead = String(pr.expectedHead ?? "").toLowerCase();

  if (pr.state !== "OPEN") blocked.push(`PR is ${pr.state ?? "UNKNOWN"}, not open`);
  if (!SHA_RE.test(head)) blocked.push("PR HEAD is missing or invalid");
  if (!SHA_RE.test(expectedHead)) blocked.push("Expected HEAD is missing or invalid");
  else if (expectedHead !== head) blocked.push(`PR HEAD ${head} does not match expected HEAD ${expectedHead}`);
  if (pr.isDraft && !options.forVerification) blocked.push("PR is a draft");
  if (pr.mergeable === false) blocked.push("PR has merge conflicts");
  else if (pr.mergeable !== true) pending.push("PR mergeability is unknown");
  const mergeState = pr.mergeStateStatus;
  const awaitingApproval = mergeState === "BLOCKED" && pr.reviewDecision === "REVIEW_REQUIRED";
  const verificationState = options.forVerification && (mergeState === "DRAFT" || awaitingApproval);
  if (!verificationState) {
    if (mergeState === "BEHIND") pending.push("PR branch is behind its base");
    else if (["UNKNOWN", "HAS_HOOKS", "BLOCKED"].includes(mergeState) || !mergeState) {
      pending.push(`PR merge state is ${mergeState ?? "not settled"}`);
    } else if (mergeState !== "CLEAN" && mergeState !== "UNSTABLE") {
      blocked.push(`PR merge state is ${mergeState}`);
    }
  }
  if (snapshot?.truncated) pending.push("GitHub collections were truncated; readiness cannot be proven");
  if (pr.reviewDecision === "CHANGES_REQUESTED") blocked.push("Review decision is CHANGES_REQUESTED");

  const held = options.held ?? [];
  const activeThreads = reviewThreads
    .filter((t) => !t.isResolved && (!t.isOutdated || awaitsAnswer(t, pr.author)))
    .filter((t) => !held.some((item) => coversThread(item, t)))
    .map((t) => ({
      id: t.id ?? null,
      replyTo: t.replyTo ?? null,
      lastCommentId: t.lastCommentId ?? null,
      path: t.path ?? null,
      line: t.line ?? null,
      author: t.author ?? null,
      bot: isBotThread(t, pr.author),
      body: truncate(t.body),
    }));
  if (activeThreads.length > 0) {
    blocked.push(`${activeThreads.length} unresolved review thread(s) on the PR`);
  }
  if (snapshot?.threadsUnknown) pending.push(`review threads unknown: ${snapshot.threadsUnknown}`);

  const unanswered = unansweredReviews(snapshot)
    .filter((review) => !held.some((item) => coversReview(item, review)));
  for (const review of unanswered) {
    blocked.push(`Written review from ${review.author} at ${review.submittedAt} has no reply`);
    activeThreads.push({
      kind: "review",
      id: review.id ?? null,
      path: null,
      line: null,
      author: review.author,
      submittedAt: review.submittedAt,
      body: truncate(review.body),
    });
  }

  if (held.length > 0) pending.push(`${held.length} item(s) to people held until "post"`);

  const notes = [];
  const ignored = new Set((options.ignoreChecks ?? []).map((name) => String(name).toLowerCase()));
  if (options.forVerification) {
    if (!Array.isArray(snapshot.requiredChecks)) pending.push("Required checks are unknown");
    else for (const name of snapshot.requiredChecks) {
      if (!ignored.has(name.toLowerCase()) && !checkRuns.some((run) => run.name === name)) {
        pending.push(`Required check "${name}" has not reported on head commit`);
      }
    }
  }
  const counted = checkRuns.filter((run) => !ignored.has(String(run.name).toLowerCase()));
  const requiredOnly = counted.some((run) => run.required === true)
    || (options.forVerification && Array.isArray(snapshot.requiredChecks)
      && snapshot.requiredChecks.some((name) => !ignored.has(name.toLowerCase())));
  if (checkRuns.length === 0) {
    if (hasNoCi(snapshot?.ci)) notes.push("No CI in this repository, so there are no checks to wait on");
    else if (!options.allowNoChecks) pending.push("No check runs found on head commit");
  } else if (counted.length === 0) {
    if (!options.allowNoChecks) pending.push("Every check on the head commit is ignored");
  } else {
    for (const run of counted) {
      const unfinished = run.status !== "COMPLETED";
      if (!unfinished && OK_CONCLUSIONS.has(run.conclusion)) continue;
      const outcome = unfinished ? `is ${run.status}` : `concluded ${run.conclusion}`;
      if (requiredOnly && run.required !== true) notes.push(`Check "${run.name}" ${outcome} (not required)`);
      else if (unfinished) pending.push(`Check "${run.name}" ${outcome}`);
      else blocked.push(`Check "${run.name}" ${outcome}`);
    }
  }

  for (const reviewer of options.reviewers ?? []) {
    const verdict = reviewerVerdict(snapshot, head, reviewer, options.requestComment);
    if (verdict.blocked) blocked.push(verdict.blocked);
    if (verdict.pending) pending.push(verdict.pending);
  }

  const withNotes = (result) => (notes.length > 0 ? { ...result, notes } : result);
  if (blocked.length > 0) return withNotes({ state: "blocked", reasons: blocked, threads: activeThreads });
  if (pending.length > 0) return withNotes({ state: "pending", reasons: pending, threads: activeThreads });
  return withNotes({ state: "ready", reasons: [], threads: [] });
}

// A written review is a COMMENTED review with a body, from a person other than the
// PR author. It needs a reply: a later PR comment from the PR author, a later review
// with text from the PR author, or a newer review from the same reviewer. Replying in
// a thread creates an empty review from the PR author; that answers the thread, not
// the written review. Bots are left to `reviewers` and threads.
function unansweredReviews(snapshot) {
  const prAuthor = snapshot?.pr?.author;
  const reviews = snapshot?.reviews ?? [];
  const comments = snapshot?.comments ?? [];
  const hasText = (item) => String(item.body ?? "").trim() !== "";
  return reviews.filter((review) => {
    if (review.state !== "COMMENTED" || !hasText(review)) return false;
    if (isBot(review.author, review.authorType) || sameLogin(review.author, prAuthor)) return false;
    const after = timestamp(review.submittedAt);
    const authorComment = comments.some((c) => sameLogin(c.author, prAuthor) && timestamp(c.createdAt) > after);
    const laterReview = reviews.some((other) => other !== review
      && timestamp(other.submittedAt) > after
      && (sameLogin(other.author, review.author) || (sameLogin(other.author, prAuthor) && hasText(other))));
    return !authorComment && !laterReview;
  });
}

// A reviewer has covered the exact HEAD when it posted a review object bound to
// that commit, or (for reviewers that signal through PR-level comments or
// reactions) left a comment or a "+1" reaction newer than both the HEAD commit
// and the newest request comment. An "eyes" reaction newer than any "+1" means
// it is still working. Anything older than that floor is stale evidence.
function reviewerVerdict(snapshot, head, reviewer, requestComment) {
  const isReviewer = (login) => sameLogin(login, reviewer);
  const label = `Reviewer ${reviewer}`;
  const pr = snapshot?.pr ?? {};
  const requestText = String(requestComment ?? "").trim().toLowerCase();
  const requests = requestText
    ? (snapshot?.comments ?? []).filter((c) => String(c.body ?? "").trim().toLowerCase() === requestText)
    : [];
  const floorMs = Math.max(latestTimestamp(requests), timestamp(pr.headCommittedAt));

  const headReviews = (snapshot?.reviews ?? [])
    .filter((r) => isReviewer(r.author) && String(r.commitId ?? "").toLowerCase() === head);
  if (headReviews.some((r) => r.state === "CHANGES_REQUESTED")) {
    return { blocked: `${label} requested changes on the current HEAD` };
  }
  if (headReviews.length > 0) return {};

  const comments = (snapshot?.comments ?? [])
    .filter((c) => isReviewer(c.author) && timestamp(c.createdAt) > floorMs);
  if (comments.length > 0) return {};

  const reactions = (snapshot?.reactions ?? [])
    .filter((r) => isReviewer(r.author) && timestamp(r.createdAt) > floorMs)
    .sort((a, b) => timestamp(b.createdAt) - timestamp(a.createdAt));
  const latest = reactions[0];
  if (latest && normalizeReaction(latest.content) === "+1") return {};
  if (latest && normalizeReaction(latest.content) === "eyes") {
    return { pending: `${label} is reviewing the current HEAD` };
  }
  return { pending: `${label} has not reviewed the current HEAD` };
}

function hasNoCi(ci) {
  return Boolean(ci) && ci.workflows === 0 && ci.requiredChecks === 0 && ci.results === 0;
}

function isBot(login, type) {
  return type === "Bot" || /\[bot\]$/i.test(String(login ?? ""));
}

// A fix often outdates a person's thread before its reply is drafted, so an outdated thread
// still counts until the PR author answers it.
function awaitsAnswer(thread, prAuthor) {
  return !isBotThread(thread, prAuthor) && !sameLogin(thread.lastAuthor, prAuthor);
}

function isBotThread(thread, prAuthor) {
  return isBot(thread.author, thread.authorType)
    && !thread.commentersTruncated
    && (thread.commenters ?? []).every((c) => isBot(c.login, c.type) || sameLogin(c.login, prAuthor));
}

function sameLogin(a, b) {
  const norm = (v) => String(v ?? "").toLowerCase().replace(/\[bot\]$/, "");
  return norm(a) !== "" && norm(a) === norm(b);
}

function truncate(body) {
  const text = String(body ?? "");
  return text.length > THREAD_BODY_LIMIT ? `${text.slice(0, THREAD_BODY_LIMIT)}...` : text;
}

function timestamp(value) {
  const parsed = Date.parse(value ?? "");
  return Number.isFinite(parsed) ? parsed : 0;
}

function latestTimestamp(items) {
  return items.reduce((latest, item) => Math.max(latest, timestamp(item.createdAt)), 0);
}

function normalizeReaction(content) {
  if (content === "THUMBS_UP" || content === "+1") return "+1";
  if (content === "EYES" || content === "eyes") return "eyes";
  return String(content ?? "").toLowerCase();
}

// ---------------------------------------------------------------------------
// CLI

function usage() {
  return [
    "Usage: node pr-gate.mjs --repo owner/name --pr N --expected-head SHA [options]",
    "",
    "Options:",
    "  --repo owner/name        Repository (required)",
    "  --pr N                   Pull request number (required)",
    "  --expected-head SHA      Exact 40-char HEAD the PR must be at (required)",
    "  --reviewer LOGIN         A review agent that must cover the exact HEAD (repeatable)",
    "  --request-comment TEXT   Comment text used to request a review; older reviewer evidence is stale",
    "  --allow-no-checks        A HEAD with no CI contexts counts as clean",
    "  --ignore-check NAME      Leave a named check out of the gate (repeatable, case-insensitive)",
    "  --held-file PATH         Items held until \"post\" (held.mjs); what they answer stops blocking",
    "  --for-verification       Allow draft and pending approval; keep checks, reviewers and findings",
    "  --json                   Print { state, reasons, threads } JSON",
    "  --watch                  Poll until blocked or 3 unchanged clean observations (default 30 min)",
    "  --timeout-seconds N      Watch deadline in seconds (default 1800)",
    "  --interval-seconds N     Watch poll interval in seconds (default 30)",
    "  --help                   Show this help",
    "",
    "Exit codes: 0 ready, 1 pending/timeout, 2 blocked/invalid.",
  ].join("\n");
}

export function parseArgs(argv) {
  const args = {
    repo: null, pr: null, expectedHead: null, reviewers: [], requestComment: null,
    allowNoChecks: false, ignoreChecks: [], forVerification: false, json: false, watch: false, help: false,
  };
  let i = 0;
  const value = (flag) => {
    const v = argv[++i];
    if (v === undefined) throw new Error(`${flag} requires a value`);
    return v;
  };
  const positiveInt = (flag) => {
    const v = value(flag);
    const n = Number(v);
    if (!Number.isInteger(n) || n <= 0) throw new Error(`${flag} expects a positive integer, got "${v}"`);
    return n;
  };
  for (; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case "--repo": args.repo = value(arg); break;
      case "--pr": args.pr = positiveInt(arg); break;
      case "--expected-head":
        args.expectedHead = value(arg).toLowerCase();
        if (!SHA_RE.test(args.expectedHead)) throw new Error("--expected-head requires a 40-character Git SHA");
        break;
      case "--reviewer": args.reviewers.push(value(arg)); break;
      case "--request-comment": args.requestComment = value(arg); break;
      case "--allow-no-checks": args.allowNoChecks = true; break;
      case "--ignore-check": args.ignoreChecks.push(value(arg)); break;
      case "--held-file": args.heldFile = value(arg); break;
      case "--for-verification": args.forVerification = true; break;
      case "--json": args.json = true; break;
      case "--watch": args.watch = true; break;
      case "--timeout-seconds": args.timeoutSeconds = positiveInt(arg); break;
      case "--interval-seconds": args.intervalSeconds = positiveInt(arg); break;
      case "--help": case "-h": args.help = true; break;
      default: throw new Error(`unknown argument: ${arg}`);
    }
  }
  return args;
}

function parseRepo(repo) {
  const match = repo.match(/^([^\s/]+)\/([^\s/]+)$/);
  if (!match) throw new Error(`--repo must be owner/name, got "${repo}"`);
  return { owner: match[1], name: match[2] };
}

async function gh(args) {
  const { stdout } = await execFileP("gh", args, { maxBuffer: 16 * 1024 * 1024 });
  return JSON.parse(stdout);
}

const PR_QUERY = `query($owner:String!,$name:String!,$number:Int!){
  repository(owner:$owner,name:$name){
    pullRequest(number:$number){
      state isDraft mergeable mergeStateStatus reviewDecision headRefOid baseRefName
      author{ login }
      commits(last:1){ nodes{ commit{ oid committedDate
        statusCheckRollup{ contexts(first:100){
          nodes{
            __typename
            ... on CheckRun{ name isRequired(pullRequestNumber:$number) }
            ... on StatusContext{ context isRequired(pullRequestNumber:$number) }
          }
          pageInfo{ hasNextPage }
        } }
      } } }
      reviewThreads(first:100){
        nodes{
          id isResolved isOutdated path line
          opening: comments(first:1){ nodes{ databaseId author{ __typename login } body } }
          last: comments(last:1){ nodes{ databaseId author{ login } } }
          comments(first:100){ nodes{ author{ __typename login } } pageInfo{ hasNextPage } }
        }
        pageInfo{ hasNextPage }
      }
      reviews(first:100){ nodes{ id author{ __typename login } state submittedAt body commit{ oid } } pageInfo{ hasNextPage } }
      comments(first:100){ nodes{ author{ login } body createdAt } pageInfo{ hasNextPage } }
      reactions(first:100){ nodes{ user{ login } content createdAt } pageInfo{ hasNextPage } }
    }
  }
}`;

// GitHub's answer once the account's GraphQL quota is spent: gh prints "API rate limit already
// exceeded for user ID ...", and the response carries the RATE_LIMITED error type.
function isRateLimited(error) {
  return /rate limit|RATE_LIMITED/i.test(`${error?.stderr ?? ""}\n${error?.stdout ?? ""}`);
}

export async function fetchSnapshot(repo, prNumber, runGh = gh, { forVerification = false } = {}) {
  const read = await readGraphql(repo, prNumber, runGh).catch((error) => {
    if (!isRateLimited(error)) throw error;
    return readRest(repo, prNumber, runGh);
  });
  const { owner, name } = repo;
  const { requiredNames: reportedRequired, ...snapshot } = read;
  const requiredNames = new Set(reportedRequired);
  let requiredInventory = null;
  if (forVerification) {
    try {
      const required = await requiredChecks(`repos/${owner}/${name}`, snapshot.pr.baseRefName, runGh, false);
      for (const name of required) requiredNames.add(name);
      requiredInventory = [...requiredNames];
    } catch {
      requiredInventory = null;
    }
  }
  const head = snapshot.pr.headRefOid;

  const checksData = await runGh(["api", `repos/${owner}/${name}/commits/${head}/check-runs?per_page=100`]);
  const statusesData = await runGh(["api", `repos/${owner}/${name}/commits/${head}/status?per_page=100`]);
  let truncated = snapshot.truncated;
  truncated ||= Number(checksData?.total_count ?? 0) > (checksData?.check_runs ?? []).length;
  truncated ||= Number(statusesData?.total_count ?? 0) > (statusesData?.statuses ?? []).length;
  if (truncated) console.error("warning: paginated GitHub data truncated at 100 entries per collection");

  const checkRuns = [
    ...(checksData?.check_runs ?? []).map((c) => ({
      name: c.name,
      status: String(c.status ?? "").toUpperCase(),
      conclusion: c.conclusion == null ? null : String(c.conclusion).toUpperCase(),
      required: requiredNames.has(c.name),
    })),
    ...(statusesData?.statuses ?? []).map((s) => ({
      name: s.context,
      status: s.state === "pending" ? "IN_PROGRESS" : "COMPLETED",
      conclusion: s.state === "success" ? "SUCCESS" : s.state === "pending" ? null : "FAILURE",
      required: requiredNames.has(s.context),
    })),
  ];
  // A failed read leaves `ci` out, and the gate keeps waiting for checks.
  const ci = checkRuns.length === 0 ? await ciSigns(repo, snapshot.pr.baseRefName, runGh).catch(() => null) : null;
  return { ...snapshot, checkRuns, truncated, ...(ci ? { ci } : {}), ...(forVerification ? { requiredChecks: requiredInventory } : {}) };
}

async function readGraphql({ owner, name }, prNumber, runGh) {
  const data = await runGh([
    "api", "graphql",
    "-f", `query=${PR_QUERY}`,
    "-F", `owner=${owner}`,
    "-F", `name=${name}`,
    "-F", `number=${prNumber}`,
  ]);
  const pr = data?.data?.repository?.pullRequest;
  if (!pr) throw new Error(`pull request #${prNumber} not found in ${owner}/${name}`);

  const head = pr.headRefOid;
  const headCommit = pr.commits?.nodes?.find((node) => node.commit?.oid === head)?.commit;
  const contexts = headCommit?.statusCheckRollup?.contexts;
  return {
    pr: {
      state: pr.state,
      isDraft: pr.isDraft,
      mergeable: pr.mergeable === "MERGEABLE" ? true : pr.mergeable === "CONFLICTING" ? false : null,
      mergeStateStatus: pr.mergeStateStatus,
      reviewDecision: pr.reviewDecision,
      headRefOid: head,
      headCommittedAt: headCommit?.committedDate ?? null,
      author: pr.author?.login ?? null,
      baseRefName: pr.baseRefName ?? null,
    },
    requiredNames: new Set((contexts?.nodes ?? [])
      .filter((ctx) => ctx?.isRequired === true)
      .map((ctx) => (ctx.__typename === "StatusContext" ? ctx.context : ctx.name))),
    truncated: Boolean(
      pr.reviewThreads?.pageInfo?.hasNextPage
        || pr.reviews?.pageInfo?.hasNextPage
        || pr.comments?.pageInfo?.hasNextPage
        || pr.reactions?.pageInfo?.hasNextPage
        || contexts?.pageInfo?.hasNextPage
        || pr.reviewThreads?.nodes?.some((t) => t.comments?.pageInfo?.hasNextPage)
    ),
    reviewThreads: (pr.reviewThreads?.nodes ?? []).map((t) => {
      const first = t.opening?.nodes?.[0];
      return {
        id: t.id,
        replyTo: first?.databaseId ?? null,
        lastCommentId: t.last?.nodes?.[0]?.databaseId ?? null,
        isResolved: t.isResolved,
        isOutdated: t.isOutdated,
        path: t.path ?? null,
        line: t.line ?? null,
        author: first?.author?.login ?? null,
        authorType: first?.author?.__typename ?? null,
        body: first?.body ?? "",
        lastAuthor: t.last?.nodes?.[0]?.author?.login ?? null,
        commenters: (t.comments?.nodes ?? []).map((c) => ({ login: c.author?.login ?? null, type: c.author?.__typename ?? null })),
        commentersTruncated: Boolean(t.comments?.pageInfo?.hasNextPage),
      };
    }),
    reviews: (pr.reviews?.nodes ?? []).map((r) => ({
      id: r.id,
      author: r.author?.login ?? "",
      authorType: r.author?.__typename ?? null,
      commitId: r.commit?.oid ?? "",
      state: r.state,
      submittedAt: r.submittedAt,
      body: r.body ?? "",
    })),
    comments: (pr.comments?.nodes ?? []).map((c) => ({
      author: c.author?.login ?? "",
      body: c.body,
      createdAt: c.createdAt,
    })),
    reactions: (pr.reactions?.nodes ?? []).map((r) => ({
      author: r.user?.login ?? "",
      content: normalizeReaction(r.content),
      createdAt: r.createdAt,
    })),
  };
}

// REST draws on its own quota but has no field for whether a review thread is resolved, so this
// read leaves the threads unknown and the gate short of ready until GraphQL answers again.
async function readRest({ owner, name }, prNumber, runGh) {
  const repo = `repos/${owner}/${name}`;
  const pr = await runGh(["api", `${repo}/pulls/${prNumber}`]);
  const head = pr.head?.sha;
  const commit = await runGh(["api", `${repo}/git/commits/${head}`]);
  const reviews = await runGh(["api", `${repo}/pulls/${prNumber}/reviews?per_page=100`]);
  const comments = await runGh(["api", `${repo}/issues/${prNumber}/comments?per_page=100`]);
  const reactions = await runGh(["api", `${repo}/issues/${prNumber}/reactions?per_page=100`]);
  return {
    pr: {
      state: pr.merged ? "MERGED" : String(pr.state ?? "").toUpperCase(),
      isDraft: pr.draft,
      mergeable: pr.mergeable ?? null,
      mergeStateStatus: pr.mergeable_state?.toUpperCase() ?? null,
      reviewDecision: standingChangeRequest(reviews) ? "CHANGES_REQUESTED" : null,
      headRefOid: head,
      headCommittedAt: commit?.committer?.date ?? null,
      author: pr.user?.login ?? null,
      baseRefName: pr.base?.ref ?? null,
    },
    requiredNames: await requiredChecks(repo, pr.base?.ref, runGh),
    truncated: [reviews, comments, reactions].some((list) => list.length >= 100),
    reviewThreads: [],
    threadsUnknown: "GraphQL quota",
    reviews: reviews.map((r) => ({
      id: r.node_id,
      author: r.user?.login ?? "",
      authorType: r.user?.type ?? null,
      commitId: r.commit_id ?? "",
      state: r.state,
      submittedAt: r.submitted_at,
      body: r.body ?? "",
    })),
    comments: comments.map((c) => ({ author: c.user?.login ?? "", body: c.body, createdAt: c.created_at })),
    reactions: reactions.map((r) => ({
      author: r.user?.login ?? "",
      content: normalizeReaction(r.content),
      createdAt: r.created_at,
    })),
  };
}

// REST has no reviewDecision, and the gate only blocks on its CHANGES_REQUESTED value.
function standingChangeRequest(reviews) {
  const latest = new Map();
  for (const r of reviews) {
    if (["APPROVED", "CHANGES_REQUESTED", "DISMISSED"].includes(r.state)) latest.set(r.user?.login, r.state);
  }
  return [...latest.values()].includes("CHANGES_REQUESTED");
}

// A repository whose plan or settings lack a feature answers 403 or 404 for it, which reads as
// nothing. Any other failure, a rate limit's 403 included, is thrown.
function readOptional(runGh, args) {
  return runGh(args).catch((error) => {
    if (!isRateLimited(error) && /HTTP 40[34]/.test(error?.stderr ?? "")) return null;
    throw error;
  });
}

// Branch protection and rulesets can each require checks. A failure other than a missing feature
// stops the gate, since missing names would let a failing required check pass as a note.
async function requiredChecks(repo, base, runGh, allowMissingFeatures = true) {
  const read = allowMissingFeatures ? (args) => readOptional(runGh, args) : runGh;
  const branch = await read(["api", `${repo}/branches/${base}`]);
  const rules = await read(["api", `${repo}/rules/branches/${base}`]);
  return new Set([
    ...(branch?.protection?.required_status_checks?.contexts ?? []),
    ...(Array.isArray(rules) ? rules : [])
      .filter((rule) => rule.type === "required_status_checks")
      .flatMap((rule) => (rule.parameters?.required_status_checks ?? []).map((check) => check.context)),
  ]);
}

// Whether the repository runs CI at all, for a head that has no checks yet. Check suites are no sign,
// because apps register empty ones on every commit and some never post a result.
async function ciSigns({ owner, name }, base, runGh) {
  if (!base) throw new Error("base branch unknown");
  const repo = `repos/${owner}/${name}`;
  const workflows = await readOptional(runGh, ["api", `${repo}/actions/workflows?per_page=100`]);
  const required = await requiredChecks(repo, base, runGh);
  const closed = await runGh(["api", `${repo}/pulls?state=closed&base=${base}&sort=updated&direction=desc&per_page=20`]);
  const lastMerged = closed.find((pull) => pull.merged_at);
  let results = 0;
  for (const ref of [base, lastMerged?.head?.sha].filter(Boolean)) {
    const runs = await runGh(["api", `${repo}/commits/${ref}/check-runs?status=completed&per_page=1`]);
    const statuses = await runGh(["api", `${repo}/commits/${ref}/status?per_page=1`]);
    results += Number(runs?.total_count ?? 0) + Number(statuses?.total_count ?? 0);
  }
  return {
    workflows: (workflows?.workflows ?? []).filter((workflow) => workflow.state === "active").length,
    requiredChecks: required.size,
    results,
  };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function readySignature(snapshot) {
  const checks = (snapshot.checkRuns ?? [])
    .map((c) => `${c.name} ${c.status} ${c.conclusion ?? ""}`)
    .sort();
  return JSON.stringify([snapshot.pr?.headRefOid ?? null, checks]);
}

export async function watchGate({
  loadSnapshot,
  options = {},
  timeoutMs,
  intervalMs,
  requiredReadyObservations = DEFAULT_READY_OBSERVATIONS,
  wait = sleep,
  now = Date.now,
  onObservation = () => {},
}) {
  if (!Number.isInteger(requiredReadyObservations) || requiredReadyObservations < 2) {
    throw new Error("requiredReadyObservations must be an integer of at least 2");
  }
  const deadline = now() + timeoutMs;
  let readyObservations = 0;
  let priorSignature = null;

  for (;;) {
    const snapshot = await loadSnapshot();
    const evaluated = evaluateGate(snapshot, options);
    let observation = evaluated;

    if (evaluated.state === "ready") {
      const signature = readySignature(snapshot);
      readyObservations = signature === priorSignature ? readyObservations + 1 : 1;
      priorSignature = signature;
      if (readyObservations < requiredReadyObservations) {
        observation = {
          state: "pending",
          reasons: [`Readiness stability confirmation ${readyObservations}/${requiredReadyObservations}`],
          threads: [],
        };
      }
    } else {
      readyObservations = 0;
      priorSignature = null;
    }

    onObservation(observation);
    if (observation.state === "ready" || observation.state === "blocked") return observation;
    if (now() + intervalMs > deadline) {
      return {
        state: "pending",
        reasons: [`Gate remained pending for ${timeoutMs / 1000}s`, ...evaluated.reasons],
        threads: evaluated.threads,
      };
    }
    await wait(intervalMs);
  }
}

function printResult(result, prNumber, json) {
  if (json) {
    console.log(JSON.stringify(result));
    return;
  }
  const label = { ready: "READY", pending: "PENDING", blocked: "BLOCKED" }[result.state];
  console.log(`${label}: PR #${prNumber}`);
  for (const reason of result.reasons) console.log(`  - ${reason}`);
  for (const t of result.threads ?? []) {
    const where = t.kind === "review" ? "(written review)" : `${t.path ?? "(no path)"}${t.line ? `:${t.line}` : ""}`;
    console.log(`  * ${where} [${t.author ?? "?"}] ${t.body.split("\n")[0]}`);
  }
  for (const note of result.notes ?? []) console.log(`  note: ${note}`);
}

async function main(argv) {
  let args;
  try {
    args = parseArgs(argv);
  } catch (error) {
    console.error(usage());
    console.error(`\nerror: ${error.message}`);
    return 2;
  }
  if (args.help) {
    console.log(usage());
    return 0;
  }
  if (!args.repo || !args.pr || !args.expectedHead) {
    console.error(usage());
    console.error("\nerror: --repo, --pr, and --expected-head are required");
    return 2;
  }
  let repo;
  try {
    repo = parseRepo(args.repo);
  } catch (error) {
    console.error(`error: ${error.message}`);
    return 2;
  }

  const options = {
    reviewers: args.reviewers,
    requestComment: args.requestComment,
    allowNoChecks: args.allowNoChecks,
    ignoreChecks: args.ignoreChecks,
    held: args.heldFile ? readHeld(args.heldFile) : [],
    forVerification: args.forVerification,
  };
  const loadSnapshot = async () => {
    const snapshot = await fetchSnapshot(repo, args.pr, gh, options);
    snapshot.pr.expectedHead = args.expectedHead;
    return snapshot;
  };
  const exitCode = (state) => (state === "ready" ? 0 : state === "blocked" ? 2 : 1);

  try {
    if (!args.watch) {
      const result = evaluateGate(await loadSnapshot(), options);
      printResult(result, args.pr, args.json);
      return exitCode(result.state);
    }
    const timeoutSeconds = args.timeoutSeconds ?? DEFAULT_TIMEOUT_SECONDS;
    const intervalSeconds = args.intervalSeconds ?? DEFAULT_INTERVAL_SECONDS;
    const result = await watchGate({
      loadSnapshot,
      options,
      timeoutMs: timeoutSeconds * 1000,
      intervalMs: intervalSeconds * 1000,
      onObservation: (observation) => printResult(observation, args.pr, args.json),
    });
    if (result.state === "pending") console.error(`timeout: still pending after ${timeoutSeconds}s`);
    return exitCode(result.state);
  } catch (error) {
    console.error(`error: ${error.message}`);
    return 2;
  }
}

if (process.argv[1] && fs.existsSync(process.argv[1]) && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(await main(process.argv.slice(2)));
}
