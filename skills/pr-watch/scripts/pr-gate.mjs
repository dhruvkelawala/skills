#!/usr/bin/env node
// Deterministic PR readiness gate for the pr-watch skill.
//
// Public seam: evaluateGate(snapshot, options) -> { state, reasons, threads, notes? }
//   state:   "ready" | "pending" | "blocked"
//   reasons: human-readable strings explaining a non-ready state
//   threads: what a repair must address: unresolved, non-outdated review threads,
//            and unanswered written reviews from people (marked kind: "review")
//   notes:   present only when non-empty; checks that are not required and did not
//            pass. Informational: they never change the state.
//
// Snapshot shape (built by fetchSnapshot, or handed in by tests):
//   pr:            { state, isDraft, mergeable, mergeStateStatus, reviewDecision,
//                    headRefOid, expectedHead, headCommittedAt, author }
//   checkRuns:     [{ name, status: "QUEUED"|"IN_PROGRESS"|"COMPLETED", conclusion, required }]
//   truncated:     true when any GitHub collection exceeded one page
//   reviewThreads: [{ isResolved, isOutdated, path, line, author, body }]
//   reviews:       [{ author, authorType, commitId, state, submittedAt, body }]
//   comments:      [{ author, body, createdAt }]      // PR-level issue comments
//   reactions:     [{ author, content, createdAt }]   // PR-level reactions
//
// Checks: when any check on the HEAD is required by the base branch, only required
// checks hold or block the gate. When none is marked required, every check counts.
//
// Options:
//   reviewers:      logins (with or without "[bot]") that must review the exact HEAD
//   requestComment: text the orchestrator posts to ask a reviewer for a pass;
//                   reviewer evidence older than the newest such comment is stale
//   allowNoChecks:  treat a HEAD with zero check/status contexts as clean
//   ignoreChecks:   check names (case-insensitive) left out of the gate entirely
//
// CLI: node pr-gate.mjs --repo owner/name --pr N --expected-head SHA
//        [--reviewer LOGIN]... [--request-comment TEXT] [--allow-no-checks]
//        [--ignore-check NAME]... [--json] [--watch] [--timeout-seconds N]
//        [--interval-seconds N]
// Exit codes: 0 ready, 1 pending/timeout, 2 blocked/invalid.
// Reads GitHub through the `gh` CLI only (execFile, never a shell); never mutates GitHub.

import { execFile } from "node:child_process";
import fs from "node:fs";
import process from "node:process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

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
  if (pr.isDraft) blocked.push("PR is a draft");
  if (pr.mergeable === false) blocked.push("PR has merge conflicts");
  else if (pr.mergeable !== true) pending.push("PR mergeability is unknown");
  if (pr.mergeStateStatus === "BEHIND") pending.push("PR branch is behind its base");
  else if (
    pr.mergeStateStatus === "UNKNOWN"
      || pr.mergeStateStatus === "HAS_HOOKS"
      || pr.mergeStateStatus === "BLOCKED"
      || !pr.mergeStateStatus
  ) {
    pending.push(`PR merge state is ${pr.mergeStateStatus ?? "not settled"}`);
  } else if (pr.mergeStateStatus !== "CLEAN" && pr.mergeStateStatus !== "UNSTABLE") {
    // UNSTABLE only means some check did not pass; the check loop below decides
    // whether that check counts.
    blocked.push(`PR merge state is ${pr.mergeStateStatus}`);
  }
  if (snapshot?.truncated) pending.push("GitHub collections were truncated; readiness cannot be proven");
  if (pr.reviewDecision === "CHANGES_REQUESTED") blocked.push("Review decision is CHANGES_REQUESTED");

  const activeThreads = reviewThreads
    .filter((t) => !t.isResolved && !t.isOutdated)
    .map((t) => ({
      path: t.path ?? null,
      line: t.line ?? null,
      author: t.author ?? null,
      body: truncate(t.body),
    }));
  if (activeThreads.length > 0) {
    blocked.push(`${activeThreads.length} unresolved review thread(s) on the PR`);
  }

  const unanswered = unansweredReviews(snapshot);
  for (const review of unanswered) {
    blocked.push(`Written review from ${review.author} at ${review.submittedAt} has no reply`);
    activeThreads.push({
      kind: "review",
      path: null,
      line: null,
      author: review.author,
      submittedAt: review.submittedAt,
      body: truncate(review.body),
    });
  }

  const notes = [];
  const ignored = new Set((options.ignoreChecks ?? []).map((name) => String(name).toLowerCase()));
  const counted = checkRuns.filter((run) => !ignored.has(String(run.name).toLowerCase()));
  const requiredOnly = counted.some((run) => run.required === true);
  if (checkRuns.length === 0) {
    if (!options.allowNoChecks) pending.push("No check runs found on head commit");
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
  const isBot = (review) => review.authorType === "Bot" || /\[bot\]$/i.test(String(review.author ?? ""));
  return reviews.filter((review) => {
    if (review.state !== "COMMENTED" || !hasText(review)) return false;
    if (isBot(review) || sameLogin(review.author, prAuthor)) return false;
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
    allowNoChecks: false, ignoreChecks: [], json: false, watch: false, help: false,
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
      state isDraft mergeable mergeStateStatus reviewDecision headRefOid
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
          isResolved isOutdated path line
          comments(first:1){ nodes{ author{ login } body } }
        }
        pageInfo{ hasNextPage }
      }
      reviews(first:100){ nodes{ author{ __typename login } state submittedAt body commit{ oid } } pageInfo{ hasNextPage } }
      comments(first:100){ nodes{ author{ login } body createdAt } pageInfo{ hasNextPage } }
      reactions(first:100){ nodes{ user{ login } content createdAt } pageInfo{ hasNextPage } }
    }
  }
}`;

export async function fetchSnapshot({ owner, name }, prNumber, runGh = gh) {
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
  const requiredNames = new Set((contexts?.nodes ?? [])
    .filter((ctx) => ctx?.isRequired === true)
    .map((ctx) => (ctx.__typename === "StatusContext" ? ctx.context : ctx.name)));

  let truncated = Boolean(
    pr.reviewThreads?.pageInfo?.hasNextPage
      || pr.reviews?.pageInfo?.hasNextPage
      || pr.comments?.pageInfo?.hasNextPage
      || pr.reactions?.pageInfo?.hasNextPage
      || contexts?.pageInfo?.hasNextPage
  );

  const checksData = await runGh(["api", `repos/${owner}/${name}/commits/${head}/check-runs?per_page=100`]);
  const statusesData = await runGh(["api", `repos/${owner}/${name}/commits/${head}/status?per_page=100`]);
  truncated ||= Number(checksData?.total_count ?? 0) > (checksData?.check_runs ?? []).length;
  truncated ||= Number(statusesData?.total_count ?? 0) > (statusesData?.statuses ?? []).length;
  if (truncated) console.error("warning: paginated GitHub data truncated at 100 entries per collection");

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
    },
    checkRuns: [
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
    ],
    truncated,
    reviewThreads: (pr.reviewThreads?.nodes ?? []).map((t) => {
      const first = t.comments?.nodes?.[0];
      return {
        isResolved: t.isResolved,
        isOutdated: t.isOutdated,
        path: t.path ?? null,
        line: t.line ?? null,
        author: first?.author?.login ?? null,
        body: first?.body ?? "",
      };
    }),
    reviews: (pr.reviews?.nodes ?? []).map((r) => ({
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
  };
  const loadSnapshot = async () => {
    const snapshot = await fetchSnapshot(repo, args.pr);
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
