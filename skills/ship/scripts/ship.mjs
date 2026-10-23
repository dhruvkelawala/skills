#!/usr/bin/env node
// ship: planning for landing PRs, plus two writes: posting a verdict comment and a pinned merge.
//
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

// ---------- pure ----------

export function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) out._.push(a);
    else if (BOOLEAN_FLAGS.has(a.slice(2))) out[a.slice(2)] = true;
    else if (argv[i + 1] === undefined || argv[i + 1].startsWith("--")) throw new Error(`${a} needs a value`);
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

// A human approval is an APPROVED review from a GitHub "User" account (not a Bot or app) that is not
// the PR author, still standing as that reviewer's latest decisive review, given on the PR's current
// patch, on a PR whose overall review decision is APPROVED. Takes REST reviews (`user.login`,
// `user.type`, `state`, `submitted_at`), each with the `patchId` of the commit it was given on.
export function humanApprovers(reviews, { prAuthor, reviewDecision, patchId }) {
  if (reviewDecision !== "APPROVED" || !patchId) return [];
  const last = new Map();
  const ordered = [...reviews].sort((a, b) => (a.submitted_at ?? "").localeCompare(b.submitted_at ?? ""));
  for (const r of ordered) {
    if (!["APPROVED", "CHANGES_REQUESTED", "DISMISSED"].includes(r.state)) continue;
    last.set(r.user?.login, r);
  }
  return [...last.values()]
    .filter((r) => r.state === "APPROVED" && r.patchId === patchId && r.user?.type === "User" && actor(r.user.login) !== actor(prAuthor))
    .map((r) => r.user.login);
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

// Stack edges are same-repository only: a fork PR's head branch lives in the fork, so it can never be
// another PR's base, even when the names match (a fork's `main` into upstream `main`).
export function walkStack(prs, bottomNumber) {
  const childrenOf = (p) => (p.isCrossRepository ? [] : prs.filter((c) => c !== p && c.baseRefName === p.headRefName));
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
// `requiredApprovals` is how many approving reviews that branch asks for; a PR GitHub already shows
// as REVIEW_REQUIRED needs at least one. Where a review is required, the PR waits for that many human
// approvals of its current patch, since GitHub's own count can include an approval gone stale
// (`approversByNumber` holds humanApprovers() per PR; reviewDecision alone is not trusted, because a
// bot can approve). Where none is required, the caller's request to land stands in for it.
// `force` skips only the wait for a required approval, never a change request GitHub enforces.
// The caller's own verdict counts on their own PR (`me`).
//
// A merge queue (or any deferred merge) lands whatever head is current when it fires, so the pinned
// head cannot be enforced. ship never lands onto a branch with a merge queue.
export function landableRun(stack, statusByNumber, { approversByNumber = new Map(), requiredApprovals = 0, ruleB = [], force = false, mergeQueue = false, me } = {}) {
  if (mergeQueue && stack.length) return { run: [], ceiling: { number: stack[0].number, blocker: "the target branch uses a merge queue, which merges later heads ship cannot pin" } };
  const run = [];
  for (const p of stack) {
    const s = statusByNumber.get(p.number) ?? { status: "missing" };
    const door = parseDoor(p.body);
    const ownPr = Boolean(me) && actor(p.author?.login) === actor(me);
    const approvers = approversByNumber.get(p.number) ?? [];
    const needed = Math.max(requiredApprovals, p.reviewDecision === "REVIEW_REQUIRED" ? 1 : 0);
    const waiting = approvers.length < needed;
    const why = verdictReason(p, door, s, ruleB);
    let blocker = null;
    if (why && s.status !== "current") blocker = `verdict ${s.status}${s.reason ? `: ${s.reason}` : ""} (rule B: ${why})`;
    else if (why && (!s.recordedBy || (actor(s.recordedBy) === actor(p.author?.login) && !ownPr))) blocker = "verdict was not recorded by someone other than the PR author";
    else if (waiting && !force) blocker = approvers.length === 0 ? "GitHub requires a review: waiting for a human approval of this patch" : `GitHub requires ${needed} approvals: ${approvers.length} human approval${approvers.length > 1 ? "s" : ""} of this patch so far`;
    else if (waiting && p.reviewDecision === "CHANGES_REQUESTED") blocker = "a reviewer requested changes, and --force skips only the wait for an approval";
    if (blocker) return { run, ceiling: { number: p.number, blocker } };
    run.push({ number: p.number, head: p.headRefOid, door, verdict: why ? s.verdict : "not needed", approvedBy: approvers.length > 0 || waiting ? approvers : [`${me} (land request)`], forced: waiting });
  }
  return { run, ceiling: null };
}

const CHECK_PASSED = new Set(["SUCCESS", "NEUTRAL", "SKIPPED"]);
// Ruleset rules that a squash merge made by GitHub keeps, or that bypassBlockers confirms itself.
const BYPASS_SAFE_RULES = new Set(["PULL_REQUEST", "REQUIRED_STATUS_CHECKS", "DELETION", "NON_FAST_FORWARD", "CREATION", "REQUIRED_LINEAR_HISTORY", "REQUIRED_SIGNATURES"]);

// What stops ship from taking GitHub's admin bypass for --force. The bypass skips every branch rule,
// not only the review, so ship takes it only when each other rule holds as GitHub would judge it:
// a required check passes on the test merge commit where that has results and on the head
// otherwise, from the app the rule names, every run of it included; and any other rule is one a
// squash merge keeps or one checked here. Takes the repository that needsAdminBypass reads, and
// whether the head is behind its base. A classic protection rule shows its details only to admins.
export function bypassBlockers(r, { behind }) {
  const classic = r.ref?.branchProtectionRule;
  const rules = r.ref?.rules.nodes ?? [];
  const blockers = [];
  if (r.ref?.refUpdateRule && !classic) blockers.push("only admins can read the branch's protection");
  if (classic?.lockBranch) blockers.push("the branch is locked");
  if (classic?.requiresDeployments) blockers.push("the branch requires deployments");
  for (const rule of rules) if (!BYPASS_SAFE_RULES.has(rule.type)) blockers.push(`the branch has a ${rule.type} rule`);
  const resolveThreads = classic?.requiresConversationResolution || rules.some((rule) => rule.parameters?.requiredReviewThreadResolution);
  if (resolveThreads && r.pullRequest.reviewThreads.nodes.some((t) => !t.isResolved)) blockers.push("a review conversation is unresolved");
  const upToDate = classic?.requiresStrictStatusChecks || rules.some((rule) => rule.parameters?.strictRequiredStatusChecksPolicy);
  if (upToDate && behind) blockers.push("the head is behind its base, which the branch requires it to include");
  const required = [
    ...(classic?.requiredStatusChecks ?? []).map((c) => ({ context: c.context, app: c.app?.databaseId })),
    ...rules.flatMap((rule) => rule.parameters?.requiredStatusChecks?.map((c) => ({ context: c.context, app: c.integrationId })) ?? []),
  ];
  const results = (commit) => commit?.statusCheckRollup?.contexts.nodes ?? [];
  for (const { context, app } of required) {
    const counted = (c) => (c.name ?? c.context) === context && (!app || c.checkSuite?.app?.databaseId === app);
    const onMerge = results(r.pullRequest.potentialMergeCommit).filter(counted);
    const runs = onMerge.length > 0 ? onMerge : results(r.object).filter(counted);
    if (runs.length === 0 || !runs.every((c) => CHECK_PASSED.has(c.conclusion ?? c.state))) blockers.push(`required check ${context} has not passed`);
  }
  return blockers;
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
const PR_FIELDS = "number,author,body,baseRefName,headRefName,headRefOid,isCrossRepository,reviewDecision";

function openPrs(repo) {
  return graphqlOrRest(
    () => JSON.parse(gh(["pr", "list", "--state", "open", "--limit", "200", "--json", PR_FIELDS], repo)),
    () => restList(`repos/${nameWithOwner(repo)}/pulls?state=open&per_page=100`).map(fromRestPr),
  );
}

// REST's PR list has what a stack walk and a verdict need, but no review decision. Without a decision
// humanApprovers finds no approval, so a PR that needs one waits.
function fromRestPr(p) {
  return {
    number: p.number, author: { login: p.user?.login }, body: p.body ?? "",
    baseRefName: p.base?.ref, headRefName: p.head?.ref, headRefOid: p.head?.sha,
    isCrossRepository: p.head?.repo?.full_name !== p.base?.repo?.full_name,
    reviewDecision: null,
  };
}

let repoView;
function repository(repo) {
  repoView ??= graphqlOrRest(
    () => {
      const r = JSON.parse(sh("gh", ["repo", "view", ...(repo ? [repo] : []), "--json", "defaultBranchRef,isArchived"]));
      return { defaultBranch: r.defaultBranchRef.name, archived: r.isArchived };
    },
    () => {
      const r = restJson(`repos/${nameWithOwner(repo)}`);
      return { defaultBranch: r.default_branch, archived: r.archived };
    },
  );
  return repoView;
}

// The patch `commit` made since it left `base`: merge-base(base, commit) to commit.
function patchFrom(base, commit) {
  const from = sh("git", ["merge-base", base, commit]);
  // Trimming the last added line would make blank and space-only lines share a fingerprint.
  const diff = sh("git", ["-c", "diff.relative=false", "diff", ...FINGERPRINT_DIFF_FLAGS, from, commit], { maxBuffer: 1 << 28, trimOutput: false });
  return { head: commit, base: from, patchId: patchFingerprint(diff) };
}

// Whether `commit` is here, fetching it by its id when it is missing, as an older commit such as one
// an approval was given on before a force-push can be.
function present(commit) {
  return [["cat-file", "-e", `${commit}^{commit}`], ["fetch", "--quiet", "--no-tags", "origin", commit]].some((args) => {
    try {
      sh("git", args);
      return true;
    } catch {
      return false;
    }
  });
}

// The PR's patch at each of `commits` as GitHub defines it: merge-base(base tip, commit) to commit.
// Both refs are fetched into private names so FETCH_HEAD ordering and remote-tracking updates cannot
// change which is which. A commit that can't be fetched has no patch.
function patchesAt(pr, commits) {
  const baseRef = `refs/ship/base/${pr.number}`;
  const headRef = `refs/ship/pull/${pr.number}`;
  try {
    sh("git", ["fetch", "--quiet", "--no-tags", "origin", `+refs/heads/${pr.baseRefName}:${baseRef}`, `+refs/pull/${pr.number}/head:${headRef}`]);
    return new Map(commits.map((commit) => [commit, commit === pr.headRefOid || present(commit) ? patchFrom(baseRef, commit) : null]));
  } finally {
    for (const ref of [baseRef, headRef]) try { sh("git", ["update-ref", "-d", ref]); } catch {}
  }
}

const currentPatch = (pr) => patchesAt(pr, [pr.headRefOid]).get(pr.headRefOid);

function nameWithOwner(repo) {
  return repo ?? graphqlOrRest(
    () => JSON.parse(sh("gh", ["repo", "view", "--json", "nameWithOwner"])).nameWithOwner,
    () => restJson("repos/{owner}/{repo}").full_name,
  );
}

function prReviews(n, repo) {
  return restList(`repos/${nameWithOwner(repo)}/pulls/${n}/reviews?per_page=100`);
}

// What the branch's rules ask of a merge: a merge queue, and how many approving reviews. GraphQL shows
// classic protection (refUpdateRule) and rulesets to anyone who can read the repository.
function branchRules(branch, repo) {
  const [owner, name] = nameWithOwner(repo).split("/");
  const q = "query($o:String!,$n:String!,$b:String!,$q:String!){repository(owner:$o,name:$n){mergeQueue(branch:$b){id} ref(qualifiedName:$q){refUpdateRule{requiredApprovingReviewCount} rules(first:100){nodes{type parameters{... on PullRequestParameters{requiredApprovingReviewCount}}}}}}}";
  return graphqlOrRest(
    () => {
      const r = JSON.parse(sh("gh", ["api", "graphql", "-f", `query=${q}`, "-f", `o=${owner}`, "-f", `n=${name}`, "-f", `b=${branch}`, "-f", `q=refs/heads/${branch}`])).data.repository;
      const counts = [r.ref?.refUpdateRule?.requiredApprovingReviewCount, ...(r.ref?.rules.nodes ?? []).filter((n) => n.type === "PULL_REQUEST").map((n) => n.parameters?.requiredApprovingReviewCount)];
      return { mergeQueue: Boolean(r.mergeQueue?.id), approvals: Math.max(0, ...counts.filter(Number.isInteger)) };
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
      const counts = rules.filter((rule) => rule.type === "pull_request").map((rule) => rule.parameters?.required_approving_review_count);
      return {
        mergeQueue: rules.some((rule) => rule.type === "merge_queue"),
        approvals: Math.max(restJson(`repos/${owner}/${name}/branches/${branch}`).protected === true ? 1 : 0, ...counts.filter(Number.isInteger)),
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

// --force skips only the wait for a required approval, through GitHub's admin bypass, which ship
// takes only while GitHub still shows the PR as REVIEW_REQUIRED and bypassBlockers finds nothing else
// missing at `head`.
function needsAdminBypass(n, head, repo) {
  try {
    const pr = JSON.parse(gh(["pr", "view", String(n), "--json", "reviewDecision,baseRefName"], repo));
    if (pr.reviewDecision !== "REVIEW_REQUIRED") return false;
    const [owner, name] = nameWithOwner(repo).split("/");
    const checks = "statusCheckRollup{contexts(first:100){nodes{__typename ... on CheckRun{name conclusion checkSuite{app{databaseId}}} ... on StatusContext{context state}}}}";
    const q = `query($o:String!,$n:String!,$pr:Int!,$q:String!,$h:GitObjectID!){repository(owner:$o,name:$n){ref(qualifiedName:$q){target{oid} refUpdateRule{pattern} branchProtectionRule{lockBranch requiresDeployments requiresConversationResolution requiresStrictStatusChecks requiredStatusChecks{context app{databaseId}}} rules(first:100){nodes{type parameters{... on PullRequestParameters{requiredReviewThreadResolution} ... on RequiredStatusChecksParameters{strictRequiredStatusChecksPolicy requiredStatusChecks{context integrationId}}}}}} pullRequest(number:$pr){reviewThreads(first:100){nodes{isResolved}} potentialMergeCommit{${checks}}} object(oid:$h){... on Commit{${checks}}}}}`;
    const r = JSON.parse(sh("gh", ["api", "graphql", "-f", `query=${q}`, "-f", `o=${owner}`, "-f", `n=${name}`, "-F", `pr=${n}`, "-f", `q=refs/heads/${pr.baseRefName}`, "-f", `h=${head}`])).data.repository;
    const behind = Boolean(r.ref) && restJson(`repos/${owner}/${name}/compare/${r.ref.target.oid}...${head}`).behind_by > 0;
    const blockers = bypassBlockers(r, { behind });
    if (blockers.length) throw new Error(`--force would take GitHub's admin bypass, which skips every branch rule, and ${blockers.join("; ")}`);
    return true;
  } catch (error) {
    if (isRateLimited(error)) throw new Error("--force reads the branch's rules and checks through GitHub's GraphQL API, whose quota is spent; try again once it resets");
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

function statusFor(pr, repo, trusted, me, patch = currentPatch(pr)) {
  return verdictStatus(latestVerdict(prComments(pr.number, repo), { prAuthor: pr.author?.login, trusted, me }), patch);
}

// The final heads of the merged PRs this PR was once stacked on, read from its base changes. Without
// GraphQL there are none, which only costs an approval its restack.
function landedParents(pr, repo) {
  const [owner, name] = nameWithOwner(repo).split("/");
  const q = "query($o:String!,$n:String!,$pr:Int!){repository(owner:$o,name:$n){pullRequest(number:$pr){timelineItems(itemTypes:[BASE_REF_CHANGED_EVENT],first:100){nodes{... on BaseRefChangedEvent{previousRefName}}}}}}";
  return graphqlOrRest(
    () => {
      const r = JSON.parse(sh("gh", ["api", "graphql", "-f", `query=${q}`, "-f", `o=${owner}`, "-f", `n=${name}`, "-F", `pr=${pr.number}`])).data.repository;
      const bases = new Set((r.pullRequest?.timelineItems.nodes ?? []).map((e) => e.previousRefName));
      return [...bases].flatMap((base) => JSON.parse(gh(["pr", "list", "--state", "merged", "--head", base, "--limit", "1", "--json", "headRefOid"], repo)).map((p) => p.headRefOid));
    },
    () => [],
  );
}

// A stack PR's verdict and human approvals, each measured against the PR's current patch. An
// approval counts only when the patch at the commit it was given on is that same patch. That patch
// is measured against the PR's base, or, for an approval given while the PR sat on a parent that has
// since squash-merged, against the parent's final head: the base no longer holds the parent's
// commits, and a restack keeps the patch.
function landingState(pr, repo, trusted, me) {
  const reviews = prReviews(pr.number, repo);
  const approvedAt = [...new Set(reviews.filter((r) => r.state === "APPROVED" && r.commit_id).map((r) => r.commit_id))];
  const patches = patchesAt(pr, [pr.headRefOid, ...approvedAt]);
  const current = patches.get(pr.headRefOid);
  let parents;
  const givenOn = (commit) => {
    const onBase = patches.get(commit)?.patchId;
    if (!onBase || onBase === current.patchId || pr.reviewDecision !== "APPROVED") return onBase;
    parents ??= landedParents(pr, repo);
    return parents.some((parent) => present(parent) && patchFrom(parent, commit).patchId === current.patchId) ? current.patchId : onBase;
  };
  return {
    status: statusFor(pr, repo, trusted, me, current),
    approvers: humanApprovers(reviews.map((r) => ({ ...r, patchId: givenOn(r.commit_id) })), { prAuthor: pr.author?.login, reviewDecision: pr.reviewDecision, patchId: current.patchId }),
  };
}

function print(obj, json, text) {
  process.stdout.write(json ? JSON.stringify(obj, null, 2) + "\n" : text(obj) + "\n");
}

const USAGE = "usage: ship.mjs verdict record|check | run <bottom-pr> | merge <pr> --head <sha>";
// A flag ship does not know, such as a misspelt or removed one, could loosen a rule if ignored.
const FLAGS = ["json", "repo", "me", "trusted", "rule-b", "force", "head", "by", "notes"];

async function main() {
  const a = parseArgs(process.argv.slice(2));
  const unknown = Object.keys(a).find((k) => k !== "_" && !FLAGS.includes(k));
  if (unknown) throw new Error(`unknown flag --${unknown}`);
  const [cmd, sub, ...rest] = a._;
  const repo = a.repo;
  // A stray PR number, such as a second one after --rule-b, is refused rather than ignored.
  if (a._.length !== { run: 2, merge: 2, verdict: sub === "record" ? 4 : 3 }[cmd]) throw new Error(USAGE);
  // An archived repository is a dropped project: none of its PRs reach ship's output.
  if (repository(repo).archived) throw new Error(`${nameWithOwner(repo)} is archived, and ship skips archived repositories`);
  const trusted = a.trusted ? a.trusted.split(",").map((s) => s.trim()).filter(Boolean) : [];
  const ruleB = a["rule-b"] ? a["rule-b"].split(",").map(Number) : [];
  if (!ruleB.every(Number.isInteger)) throw new Error("usage: --rule-b <pr>[,<pr>...], the PRs rule B covers");
  // verdict check and run grant the own-PR rules to the caller, so the caller is always the
  // authenticated account; --me may only repeat it.
  const caller = () => {
    const login = sh("gh", ["api", "user", "--jq", ".login"]);
    if (a.me && actor(a.me) !== actor(login)) throw new Error(`--me ${a.me} does not match the authenticated GitHub account ${login}`);
    return login;
  };
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
    const states = new Map(stack.map((p) => [p.number, landingState(p, repo, trusted, me)]));
    const statuses = new Map([...states].map(([n, s]) => [n, s.status]));
    const approvers = new Map([...states].map(([n, s]) => [n, s.approvers]));
    const { mergeQueue, approvals } = stack.length > 0 ? branchRules(repository(repo).defaultBranch, repo) : {};
    const result = { ...landableRun(stack, statuses, { approversByNumber: approvers, requiredApprovals: approvals, ruleB, force: a.force, mergeQueue, me }), stackStop: stop ?? null };
    return print(result, a.json, (r) =>
      [`landable run: ${r.run.map((x) => `#${x.number}@${x.head}${x.forced ? " (approval skipped by --force)" : ""}`).join(" -> ") || "(none)"}`,
       r.ceiling ? `ceiling: #${r.ceiling.number}, ${r.ceiling.blocker}` : "ceiling: none, the whole stack is landable",
       r.stackStop ? `note: ${r.stackStop}` : ""].filter(Boolean).join("\n"));
  }
  if (cmd === "merge") {
    if (!sub || !/^[0-9a-f]{40}$/.test(a.head ?? "")) throw new Error("usage: merge <pr> --head <the full head SHA from run>");
    return print(mergeAt(Number(sub), a.head, repo, a.force), a.json, (m) => `merged #${m.number} at ${m.head.slice(0, 12)} as ${m.mergeCommit?.slice(0, 12)}`);
  }
  throw new Error(USAGE);
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
