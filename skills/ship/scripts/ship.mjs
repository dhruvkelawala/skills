#!/usr/bin/env node
// ship: planning for landing PRs, plus two writes: posting a verdict comment and a pinned merge.
//
//   ship.mjs queue   [--repo o/r] [--me <login>] [--json]
//   ship.mjs verdict record <pr> <PASS|PASS+NOTES|FAIL> --head <tested-sha> --by <who> [--notes <file>] [--repo o/r]
//   ship.mjs verdict check  <pr> [--trusted a,b] [--repo o/r] [--me <login>] [--json]
//   ship.mjs run     <bottom-pr> [--rule-b <pr,pr>] [--force] [--trusted a,b] [--repo o/r] [--me <login>] [--json]
//   ship.mjs merge   <pr> --head <run[0].head> [--force] [--repo o/r] [--json]
//
// Nothing here rebases, retargets, or force-pushes, and `merge` lands only the head it is given. The
// caller runs `run` before each merge and does the rest, one PR at a time.

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const MARKER = "ship-verdict:v1";
const PASSING = new Set(["PASS", "PASS+NOTES"]);
const BOOLEAN_FLAGS = new Set(["json", "force"]);
const MERGEABLE = new Set(["CLEAN", "HAS_HOOKS"]);

// ---------- pure ----------

export function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) out._.push(a);
    else if (BOOLEAN_FLAGS.has(a.slice(2))) out[a.slice(2)] = true;
    else out[a.slice(2)] = argv[++i];
  }
  return out;
}

export function parseDoor(body) {
  const m = /\*\*Door:\*\*\s*(one-way|two-way)/i.exec(body ?? "");
  return m ? m[1].toLowerCase() : "unknown";
}

// Fingerprint of what a PR changes: the whole base-to-head diff, whitespace and hunk line numbers
// included, minus only the `index` lines (blob ids). The verdict survives a rebase only when every
// changed line lands at the same place with the same context, which is the case when a stack layer
// is retargeted after its parent squash-merges. Any edit that moves goes stale and needs a new verdict.
export function patchFingerprint(diff) {
  const kept = diff.split("\n").filter((l) => !l.startsWith("index ")).join("\n");
  return createHash("sha256").update(kept).digest("hex");
}

// GitHub names one bot account three ways: `app/name` (gh's PR author), `name[bot]` (REST), and
// `name` (gh's comment author). Compare on one canonical form.
export function actor(login) {
  return (login ?? "").toLowerCase().replace(/^app\//, "").replace(/\[bot\]$/, "");
}

// Stack edges are same-repository only: a fork PR's head branch lives in the fork, so it can never be
// another PR's base, even when the names match (a fork's `main` into upstream `main`).
export function indexStacks(prs) {
  const local = prs.filter((p) => !p.isCrossRepository);
  const byHead = new Map(local.map((p) => [p.headRefName, p]));
  const children = new Map();
  for (const p of prs) {
    if (!children.has(p.baseRefName)) children.set(p.baseRefName, []);
    children.get(p.baseRefName).push(p);
  }
  const childrenOf = (p) => (p.isCrossRepository ? [] : (children.get(p.headRefName) ?? []).filter((c) => c !== p));
  const downstream = (p) => {
    const seen = new Set([p.number]);
    const todo = [p];
    while (todo.length) for (const c of childrenOf(todo.pop())) if (!seen.has(c.number)) seen.add(c.number), todo.push(c);
    return seen.size - 1;
  };
  return { byHead, childrenOf, downstream };
}

// A human approval is an APPROVED review from a GitHub "User" account (not a Bot or app) that is not
// the PR author, still standing as that reviewer's latest decisive review, on a PR whose overall review
// decision is APPROVED. Takes REST reviews (`user.login`, `user.type`, `state`, `submitted_at`).
export function humanApprovers(reviews, { prAuthor, reviewDecision }) {
  if (reviewDecision !== "APPROVED") return [];
  const last = new Map();
  const ordered = [...reviews].sort((a, b) => (a.submitted_at ?? "").localeCompare(b.submitted_at ?? ""));
  for (const r of ordered) {
    if (!["APPROVED", "CHANGES_REQUESTED", "DISMISSED"].includes(r.state)) continue;
    last.set(r.user?.login, r);
  }
  return [...last.values()]
    .filter((r) => r.state === "APPROVED" && r.user?.type === "User" && actor(r.user.login) !== actor(prAuthor))
    .map((r) => r.user.login);
}

export function planQueue(prs, { me, defaultBranch }) {
  const { byHead, downstream } = indexStacks(prs);
  const size = (p) => (p.additions ?? 0) + (p.deletions ?? 0);
  const row = (p) => ({ number: p.number, title: p.title, author: p.author?.login, size: size(p), unblocks: downstream(p), door: parseDoor(p.body), mergeState: p.mergeStateStatus, review: p.reviewDecision || "NONE" });
  const plan = { mergeNow: [], review: [], waitingOnParent: [], mine: [] };
  for (const p of prs) {
    if (p.isDraft) continue;
    const parent = byHead.get(p.baseRefName);
    const approved = p.reviewDecision === "APPROVED";
    if (approved && p.baseRefName === defaultBranch && MERGEABLE.has(p.mergeStateStatus)) plan.mergeNow.push(row(p));
    else if (actor(p.author?.login) === actor(me)) plan.mine.push(row(p));
    else if (approved) continue;
    else if (parent && parent.reviewDecision !== "APPROVED") plan.waitingOnParent.push(row(p));
    else plan.review.push(row(p));
  }
  plan.mergeNow.sort((a, b) => b.unblocks - a.unblocks);
  plan.review.sort((a, b) => b.unblocks - a.unblocks || a.size - b.size);
  plan.mine.sort((a, b) => b.unblocks - a.unblocks);
  return plan;
}

export function formatVerdict(v) {
  const human = `**ship verdict: ${v.verdict}** by ${v.by} at \`${v.head.slice(0, 12)}\` (patch-id \`${v.patchId.slice(0, 12)}\`)`;
  return `<!-- ${MARKER} ${JSON.stringify(v)} -->\n${human}${v.notes ? `\n\n${v.notes}` : ""}`;
}

// Trust comes from GitHub, not from the comment text: the verdict is attributed to the commenter's login
// and ordered by the server's createdAt. Comments by the PR author count only on the caller's own PR
// (`me`), where one account runs both the agents and the review. When `trusted` is
// non-empty only those logins count. The embedded `by` and `at` are informational.
export function latestVerdict(comments, { prAuthor, trusted = [], me } = {}) {
  const ownPr = Boolean(me) && actor(prAuthor) === actor(me);
  const prefix = `<!-- ${MARKER} `;
  const suffix = " -->";
  let best = null;
  for (const c of comments) {
    const login = c.author?.login;
    if (!login || (actor(login) === actor(prAuthor) && !ownPr) || (trusted.length && !trusted.map(actor).includes(actor(login)))) continue;
    // JSON.stringify keeps the payload on the first LF-delimited line. Slice the outer marker
    // so delimiters or Unicode line separators inside note strings cannot hide a newer FAIL.
    const line = (c.body ?? "").split("\n", 1)[0];
    if (!line.startsWith(prefix) || !line.endsWith(suffix)) continue;
    let v;
    try {
      v = JSON.parse(line.slice(prefix.length, -suffix.length));
    } catch {
      continue;
    }
    const entry = { ...v, recordedBy: login, recordedAt: c.createdAt ?? "" };
    if (!best || entry.recordedAt >= best.recordedAt) best = entry;
  }
  return best;
}

export function verdictStatus(verdict, current) {
  if (!verdict) return { status: "missing" };
  if (verdict.patchId !== current.patchId) return { status: "stale", reason: `patch changed since verdict at ${verdict.head.slice(0, 12)}` };
  if (!PASSING.has(verdict.verdict)) return { status: "failed", reason: `verdict is ${verdict.verdict}` };
  return { status: "current", verdict: verdict.verdict, by: verdict.by, recordedBy: verdict.recordedBy, head: current.head };
}

export function walkStack(prs, bottomNumber) {
  const { childrenOf } = indexStacks(prs);
  const bottom = prs.find((p) => p.number === bottomNumber);
  if (!bottom) return { stack: [], stop: `PR #${bottomNumber} is not open` };
  const stack = [bottom];
  const seen = new Set([bottom.number]);
  for (;;) {
    const kids = childrenOf(stack.at(-1));
    if (kids.length === 0) return { stack };
    if (kids.length > 1) return { stack, stop: `#${stack.at(-1).number} has ${kids.length} children (${kids.map((k) => "#" + k.number).join(", ")}); land up to here, then run again per branch` };
    if (seen.has(kids[0].number)) return { stack, stop: `cycle at #${kids[0].number}` };
    seen.add(kids[0].number);
    stack.push(kids[0]);
  }
}

// Rule B: a PR needs an independent verdict only when its door is one-way or unstated, when the caller
// names it in `ruleB` (it touches authority, stored data, money or a production switch that its proof
// doesn't cover, or the user said verify), or when a verdict is already on record for it. Every other
// PR lands on its build's own checks.
function verdictReason(p, door, status, ruleB) {
  if (door === "one-way") return "the door is one-way";
  if (door !== "two-way") return "no door line";
  if (ruleB.includes(p.number)) return "named in --rule-b";
  if (status.status !== "missing") return "a verdict is on record";
  return null;
}

// ship follows GitHub's review rule for the default branch, where every PR in a stack lands.
// `reviewRequired` says whether that branch asks for an approving review; a PR GitHub already shows
// as REVIEW_REQUIRED waits too. Where a review is required, the PR waits for a human approval
// (`approversByNumber` holds humanApprovers() per PR; reviewDecision alone is not trusted, because a
// bot can approve). Where none is required, the caller's request to land stands in for it.
// `force` skips only the wait for a required approval; a standing change request still blocks.
// The caller's own verdict counts on their own PR (`me`).
//
// A merge queue (or any deferred merge) lands whatever head is current when it fires, so the pinned
// head cannot be enforced. ship never lands onto a branch with a merge queue.
export function landableRun(stack, statusByNumber, { approversByNumber = new Map(), reviewRequired = false, ruleB = [], force = false, mergeQueue = false, me } = {}) {
  if (mergeQueue && stack.length) return { run: [], ceiling: { number: stack[0].number, blocker: "the target branch uses a merge queue, which merges later heads ship cannot pin" } };
  const run = [];
  for (const p of stack) {
    const s = statusByNumber.get(p.number) ?? { status: "missing" };
    const door = parseDoor(p.body);
    const ownPr = Boolean(me) && actor(p.author?.login) === actor(me);
    const approvers = approversByNumber.get(p.number) ?? [];
    const needsReview = reviewRequired || p.reviewDecision === "REVIEW_REQUIRED";
    const why = verdictReason(p, door, s, ruleB);
    let blocker = null;
    if (why && s.status !== "current") blocker = `verdict ${s.status}${s.reason ? `: ${s.reason}` : ""} (rule B: ${why})`;
    else if (why && (!s.recordedBy || (actor(s.recordedBy) === actor(p.author?.login) && !ownPr))) blocker = "verdict was not recorded by someone other than the PR author";
    else if (needsReview && approvers.length === 0 && !force) blocker = "GitHub requires a review: waiting for a human approval";
    else if (needsReview && approvers.length === 0 && p.reviewDecision === "CHANGES_REQUESTED") blocker = "a reviewer requested changes, and --force skips only the wait for an approval";
    if (blocker) return { run, ceiling: { number: p.number, blocker } };
    const forced = needsReview && approvers.length === 0;
    run.push({ number: p.number, head: p.headRefOid, door, verdict: why ? s.verdict : "not needed", approvedBy: approvers.length > 0 || forced ? approvers : [`${me} (land request)`], forced });
  }
  return { run, ceiling: null };
}

// ---------- io ----------

const sh = (cmd, args, { trimOutput = true, ...opts } = {}) => {
  const output = execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...opts });
  return trimOutput ? output.trim() : output;
};
const gh = (args, repo) => sh("gh", repo ? [...args, "--repo", repo] : args);
const restJson = (endpoint) => JSON.parse(sh("gh", ["api", endpoint]));
const restList = (endpoint) => JSON.parse(sh("gh", ["api", "--paginate", "--slurp", endpoint], { maxBuffer: 1 << 28 })).flat();

// gh pr, gh repo view and gh api graphql spend the GraphQL quota that every agent on the account
// shares. Once it is spent, gh prints "API rate limit already exceeded" or the RATE_LIMITED type.
function isRateLimited(error) {
  return /rate limit|RATE_LIMITED/i.test(`${error?.stderr ?? ""}\n${error?.stdout ?? ""}`);
}

let warnedRest = false;
function graphqlOrRest(graphql, viaRest) {
  try {
    return graphql();
  } catch (error) {
    if (!isRateLimited(error)) throw error;
    if (!warnedRest) process.stderr.write("ship: GitHub's GraphQL quota is spent; using REST, which has no review decision, so no PR shows as approved\n");
    warnedRest = true;
    return viaRest();
  }
}
// Whole-repository, unfiltered diff: no relative paths, conversion filters, external drivers, or
// ignored submodules, so local git config cannot hide a change from the fingerprint.
export const FINGERPRINT_DIFF_FLAGS = ["--no-relative", "--no-ext-diff", "--no-textconv", "--ignore-submodules=none", "--no-color", "--binary", "--full-index", "-U3"];
const PR_FIELDS = "number,title,author,body,baseRefName,headRefName,headRefOid,isCrossRepository,additions,deletions,isDraft,reviewDecision,mergeStateStatus";

function openPrs(repo) {
  return graphqlOrRest(
    () => JSON.parse(gh(["pr", "list", "--state", "open", "--limit", "200", "--json", PR_FIELDS], repo)),
    () => restList(`repos/${nameWithOwner(repo)}/pulls?state=open&per_page=100`).map(fromRestPr),
  );
}

// REST's PR list has what a stack walk and a verdict need, but no review decision, merge state or
// size. Without a decision humanApprovers finds no approval, so a PR that needs one waits.
function fromRestPr(p) {
  return {
    number: p.number, title: p.title, author: { login: p.user?.login }, body: p.body ?? "",
    baseRefName: p.base?.ref, headRefName: p.head?.ref, headRefOid: p.head?.sha,
    isCrossRepository: p.head?.repo?.full_name !== p.base?.repo?.full_name,
    isDraft: p.draft, reviewDecision: null,
  };
}

function defaultBranch(repo) {
  return graphqlOrRest(
    () => JSON.parse(sh("gh", ["repo", "view", ...(repo ? [repo] : []), "--json", "defaultBranchRef"])).defaultBranchRef.name,
    () => restJson(`repos/${nameWithOwner(repo)}`).default_branch,
  );
}

// The PR's patch as GitHub defines it: merge-base(base tip, PR head) to PR head. Both refs are fetched
// into private names so FETCH_HEAD ordering and remote-tracking updates cannot change which is which.
function currentPatch(pr) {
  const baseRef = `refs/ship/base/${pr.number}`;
  const headRef = `refs/ship/pull/${pr.number}`;
  try {
    sh("git", ["fetch", "--quiet", "--no-tags", "origin", `+refs/heads/${pr.baseRefName}:${baseRef}`, `+refs/pull/${pr.number}/head:${headRef}`]);
    const base = sh("git", ["merge-base", baseRef, pr.headRefOid]);
    // Trimming the last added line would make blank and space-only lines share a fingerprint.
    const diff = sh("git", ["-c", "diff.relative=false", "diff", ...FINGERPRINT_DIFF_FLAGS, base, pr.headRefOid], { maxBuffer: 1 << 28, trimOutput: false });
    return { head: pr.headRefOid, base, patchId: patchFingerprint(diff) };
  } finally {
    for (const ref of [baseRef, headRef]) try { sh("git", ["update-ref", "-d", ref]); } catch {}
  }
}

function nameWithOwner(repo) {
  return repo ?? graphqlOrRest(
    () => JSON.parse(sh("gh", ["repo", "view", "--json", "nameWithOwner"])).nameWithOwner,
    () => restJson("repos/{owner}/{repo}").full_name,
  );
}

function prReviews(n, repo) {
  return restList(`repos/${nameWithOwner(repo)}/pulls/${n}/reviews?per_page=100`);
}

// What the branch's rules ask of a merge: a merge queue, and approving reviews. GraphQL shows
// classic protection (refUpdateRule) and rulesets to anyone who can read the repository.
function branchRules(branch, repo) {
  const [owner, name] = nameWithOwner(repo).split("/");
  const q = "query($o:String!,$n:String!,$b:String!,$q:String!){repository(owner:$o,name:$n){mergeQueue(branch:$b){id} ref(qualifiedName:$q){refUpdateRule{requiredApprovingReviewCount} rules(first:100){nodes{type parameters{... on PullRequestParameters{requiredApprovingReviewCount}}}}}}}";
  return graphqlOrRest(
    () => {
      const r = JSON.parse(sh("gh", ["api", "graphql", "-f", `query=${q}`, "-f", `o=${owner}`, "-f", `n=${name}`, "-f", `b=${branch}`, "-f", `q=refs/heads/${branch}`])).data.repository;
      const counts = [r.ref?.refUpdateRule?.requiredApprovingReviewCount, ...(r.ref?.rules.nodes ?? []).filter((n) => n.type === "PULL_REQUEST").map((n) => n.parameters?.requiredApprovingReviewCount)];
      return { mergeQueue: Boolean(r.mergeQueue?.id), requiresReview: counts.some((c) => c > 0) };
    },
    () => {
      let rules = [];
      try {
        rules = restJson(`repos/${owner}/${name}/rules/branches/${branch}`);
      } catch (error) {
        // A plan without rulesets answers 403, and it has no rulesets to read. A rate limit's 403
        // says nothing about them.
        if (isRateLimited(error) || !/HTTP 40[34]/.test(error?.stderr ?? "")) throw error;
      }
      // REST shows a classic protection rule's details only to admins, so any protected branch
      // counts as asking for a review.
      return {
        mergeQueue: rules.some((rule) => rule.type === "merge_queue"),
        requiresReview: restJson(`repos/${owner}/${name}/branches/${branch}`).protected === true
          || rules.some((rule) => rule.type === "pull_request" && rule.parameters?.required_approving_review_count > 0),
      };
    },
  );
}

function prComments(n, repo) {
  return graphqlOrRest(
    () => JSON.parse(gh(["pr", "view", String(n), "--json", "comments"], repo)).comments,
    () => restList(`repos/${nameWithOwner(repo)}/issues/${n}/comments?per_page=100`)
      .map((c) => ({ author: { login: c.user?.login }, body: c.body, createdAt: c.created_at })),
  );
}

function postComment(n, body, repo) {
  graphqlOrRest(
    () => gh(["pr", "comment", String(n), "--body", body], repo),
    () => sh("gh", ["api", "-X", "POST", `repos/${nameWithOwner(repo)}/issues/${n}/comments`, "-f", `body=${body}`]),
  );
}

const CHECK_PASSED = new Set(["SUCCESS", "NEUTRAL", "SKIPPED"]);

// --force skips only the wait for a required approval, through GitHub's admin bypass. The bypass
// would skip the required checks as well, so ship takes it only while GitHub still shows the PR as
// REVIEW_REQUIRED, and only once every check the base branch requires has passed at `head`, every
// run of it included. The required names come from the branch's rules, because a required check
// that has not reported yet is missing from the commit's results.
function needsAdminBypass(n, head, repo) {
  try {
    const pr = JSON.parse(gh(["pr", "view", String(n), "--json", "reviewDecision,baseRefName"], repo));
    if (pr.reviewDecision !== "REVIEW_REQUIRED") return false;
    const [owner, name] = nameWithOwner(repo).split("/");
    const q = "query($o:String!,$n:String!,$q:String!,$h:GitObjectID!){repository(owner:$o,name:$n){ref(qualifiedName:$q){refUpdateRule{requiredStatusCheckContexts} rules(first:100){nodes{type parameters{... on RequiredStatusChecksParameters{requiredStatusChecks{context}}}}}} object(oid:$h){... on Commit{statusCheckRollup{contexts(first:100){nodes{__typename ... on CheckRun{name conclusion} ... on StatusContext{context state}}}}}}}}";
    const r = JSON.parse(sh("gh", ["api", "graphql", "-f", `query=${q}`, "-f", `o=${owner}`, "-f", `n=${name}`, "-f", `q=refs/heads/${pr.baseRefName}`, "-f", `h=${head}`])).data.repository;
    const required = new Set([
      ...(r.ref?.refUpdateRule?.requiredStatusCheckContexts ?? []),
      ...(r.ref?.rules.nodes ?? []).flatMap((rule) => rule.parameters?.requiredStatusChecks?.map((c) => c.context) ?? []),
    ]);
    const passed = new Map();
    for (const c of r.object?.statusCheckRollup?.contexts.nodes ?? []) {
      const check = c.name ?? c.context;
      passed.set(check, passed.get(check) !== false && CHECK_PASSED.has(c.conclusion ?? c.state));
    }
    const open = [...required].filter((check) => passed.get(check) !== true);
    if (open.length) throw new Error(`--force still needs every required check to pass at ${head.slice(0, 12)}; not passed: ${open.join(", ")}`);
    return true;
  } catch (error) {
    if (isRateLimited(error)) throw new Error("--force reads the review rule and required checks through GitHub's GraphQL API, whose quota is spent; try again once it resets");
    throw error;
  }
}

// Squash-merges only while the PR's head is still `head`: GitHub refuses once anything is pushed
// after it. A merge GitHub deferred, such as an auto-merge request, is not pinned, so it is undone.
function mergeAt(n, head, repo, force) {
  const endpoint = `repos/${nameWithOwner(repo)}/pulls/${n}`;
  if (force && needsAdminBypass(n, head, repo)) gh(["pr", "merge", String(n), "--squash", "--admin", "--match-head-commit", head], repo);
  else graphqlOrRest(
    () => gh(["pr", "merge", String(n), "--squash", "--match-head-commit", head], repo),
    () => sh("gh", ["api", "-X", "PUT", `${endpoint}/merge`, "-f", "merge_method=squash", "-f", `sha=${head}`]),
  );
  const pr = graphqlOrRest(
    () => {
      const v = JSON.parse(gh(["pr", "view", String(n), "--json", "state,autoMergeRequest,mergeCommit"], repo));
      return { merged: v.state === "MERGED", autoMerge: Boolean(v.autoMergeRequest), mergeCommit: v.mergeCommit?.oid };
    },
    () => {
      const v = restJson(endpoint);
      return { merged: v.merged === true, autoMerge: Boolean(v.auto_merge), mergeCommit: v.merge_commit_sha };
    },
  );
  if (pr.merged && !pr.autoMerge) return { number: n, head, mergeCommit: pr.mergeCommit };
  if (pr.autoMerge) gh(["pr", "merge", String(n), "--disable-auto"], repo);
  throw new Error(`PR #${n} did not merge at once, so the merge was not pinned to ${head.slice(0, 12)}${pr.autoMerge ? "; its auto-merge request is now disabled" : ""}`);
}

function statusFor(pr, repo, trusted, me) {
  return verdictStatus(latestVerdict(prComments(pr.number, repo), { prAuthor: pr.author?.login, trusted, me }), currentPatch(pr));
}

function print(obj, json, text) {
  process.stdout.write(json ? JSON.stringify(obj, null, 2) + "\n" : text(obj) + "\n");
}

function textQueue(q) {
  const line = (r, extra = "") => `  #${String(r.number).padEnd(5)}${extra}unblocks ${String(r.unblocks).padEnd(3)}${String(r.size).padStart(6)} lines  ${r.door.padEnd(8)} ${r.title.slice(0, 64)}`;
  return [
    `MERGE NOW (${q.mergeNow.length})`, ...q.mergeNow.map((r) => line(r)),
    `REVIEW (${q.review.length}), highest unblock first, then smallest`, ...q.review.map((r) => line(r, `@${(r.author ?? "").padEnd(14)} `)),
    `WAITING ON PARENT (${q.waitingOnParent.length})`, ...q.waitingOnParent.map((r) => line(r)),
    `YOURS, NOT MERGED (${q.mine.length})`, ...q.mine.map((r) => line(r, `${r.review.padEnd(18)}`)),
  ].join("\n");
}

// A flag ship does not know, such as a misspelt or removed one, could loosen a rule if ignored.
const FLAGS = ["json", "repo", "me", "trusted", "rule-b", "force", "head", "by", "notes"];

async function main() {
  const a = parseArgs(process.argv.slice(2));
  const unknown = Object.keys(a).find((k) => k !== "_" && !FLAGS.includes(k));
  if (unknown) throw new Error(`unknown flag --${unknown}`);
  const [cmd, sub, ...rest] = a._;
  const repo = a.repo;
  const trusted = a.trusted ? a.trusted.split(",").map((s) => s.trim()).filter(Boolean) : [];
  const ruleB = a["rule-b"] ? a["rule-b"].split(",").map(Number) : [];
  if (!ruleB.every(Number.isInteger)) throw new Error("usage: --rule-b <pr>[,<pr>...], the PRs rule B covers");
  const authenticated = () => sh("gh", ["api", "user", "--jq", ".login"]);
  // verdict check and run grant the own-PR rules to the caller, so the caller is always the
  // authenticated account; --me may only repeat it. queue uses --me just to sort the list.
  const caller = () => {
    const login = authenticated();
    if (a.me && actor(a.me) !== actor(login)) throw new Error(`--me ${a.me} does not match the authenticated GitHub account ${login}`);
    return login;
  };
  if (cmd === "queue") {
    const me = a.me ?? authenticated();
    const q = planQueue(openPrs(repo), { me, defaultBranch: defaultBranch(repo) });
    return print(q, a.json, textQueue);
  }
  if (cmd === "verdict" && sub === "record") {
    const [n, verdict] = rest;
    if (!n || !["PASS", "PASS+NOTES", "FAIL"].includes(verdict) || !a.by || !a.head) throw new Error("usage: verdict record <pr> <PASS|PASS+NOTES|FAIL> --head <tested-sha> --by <who> [--notes file]");
    const pr = openPrs(repo).find((p) => p.number === Number(n));
    if (!pr) throw new Error(`PR #${n} is not open`);
    if (pr.headRefOid !== a.head) throw new Error(`PR #${n} head is ${pr.headRefOid.slice(0, 12)}, but the verdict is for ${a.head.slice(0, 12)}; verify the current head instead`);
    const v = { verdict, by: a.by, at: new Date().toISOString(), ...currentPatch(pr), notes: a.notes ? readFileSync(a.notes, "utf8").trim() : undefined };
    postComment(n, formatVerdict(v), repo);
    return print(v, a.json, (x) => `recorded ${x.verdict} on #${n} at ${x.head.slice(0, 12)}`);
  }
  if (cmd === "verdict" && sub === "check") {
    const pr = openPrs(repo).find((p) => p.number === Number(rest[0]));
    if (!pr) throw new Error(`PR #${rest[0]} is not open`);
    return print(statusFor(pr, repo, trusted, caller()), a.json, (s) => `#${pr.number}: ${s.status}${s.reason ? ` (${s.reason})` : ""}`);
  }
  if (cmd === "run") {
    const prs = openPrs(repo);
    const { stack, stop } = walkStack(prs, Number(sub));
    const me = caller();
    const statuses = new Map(stack.map((p) => [p.number, statusFor(p, repo, trusted, me)]));
    const approvers = new Map(stack.map((p) => [p.number, humanApprovers(prReviews(p.number, repo), { prAuthor: p.author?.login, reviewDecision: p.reviewDecision })]));
    const { mergeQueue, requiresReview } = stack.length > 0 ? branchRules(defaultBranch(repo), repo) : {};
    const result = { ...landableRun(stack, statuses, { approversByNumber: approvers, reviewRequired: requiresReview, ruleB, force: a.force, mergeQueue, me }), stackStop: stop ?? null };
    return print(result, a.json, (r) =>
      [`landable run: ${r.run.map((x) => `#${x.number}@${x.head}${x.forced ? " (approval skipped by --force)" : ""}`).join(" -> ") || "(none)"}`,
       r.ceiling ? `ceiling: #${r.ceiling.number}, ${r.ceiling.blocker}` : "ceiling: none, the whole stack is landable",
       r.stackStop ? `note: ${r.stackStop}` : ""].filter(Boolean).join("\n"));
  }
  if (cmd === "merge") {
    if (!sub || !/^[0-9a-f]{40}$/.test(a.head ?? "")) throw new Error("usage: merge <pr> --head <the full head SHA from run>");
    return print(mergeAt(Number(sub), a.head, repo, a.force), a.json, (m) => `merged #${m.number} at ${m.head.slice(0, 12)} as ${m.mergeCommit?.slice(0, 12)}`);
  }
  throw new Error("usage: ship.mjs queue | verdict record|check | run <bottom-pr> | merge <pr> --head <sha>");
}

// Skills are usually reached through a symlinked folder (~/.claude/skills), so compare real paths;
// comparing the invoked path itself would make the CLI exit 0 having done nothing.
const invoked = process.argv[1] ? realpathSync(process.argv[1]) : "";
if (invoked === realpathSync(fileURLToPath(import.meta.url))) {
  main().catch((e) => {
    process.stderr.write(`ship: ${e.message}\n`);
    process.exit(2);
  });
}
