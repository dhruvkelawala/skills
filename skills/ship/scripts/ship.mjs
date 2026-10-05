#!/usr/bin/env node
// ship: read-only planning for landing PRs, plus one write (posting a verdict comment).
//
//   ship.mjs queue   [--repo o/r] [--me <login>] [--json]
//   ship.mjs verdict record <pr> <PASS|PASS+NOTES|FAIL> --head <tested-sha> --by <who> [--notes <file>] [--repo o/r]
//   ship.mjs verdict check  <pr> [--trusted a,b] [--repo o/r] [--json]
//   ship.mjs run     <bottom-pr> [--policy approval|verdict] [--trusted a,b] [--repo o/r] [--json]
//
// Nothing here merges, rebases, retargets, or force-pushes. The caller does that, one PR at a time.

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const MARKER = "ship-verdict:v1";
const PASSING = new Set(["PASS", "PASS+NOTES"]);
const MERGEABLE = new Set(["CLEAN", "HAS_HOOKS"]);

// ---------- pure ----------

export function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--json") out.json = true;
    else if (a.startsWith("--")) out[a.slice(2)] = argv[++i];
    else out._.push(a);
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
// and ordered by the server's createdAt. Comments by the PR author never count, and when `trusted` is
// non-empty only those logins count. The embedded `by` and `at` are informational.
export function latestVerdict(comments, { prAuthor, trusted = [] } = {}) {
  const prefix = `<!-- ${MARKER} `;
  const suffix = " -->";
  let best = null;
  for (const c of comments) {
    const login = c.author?.login;
    if (!login || actor(login) === actor(prAuthor) || (trusted.length && !trusted.map(actor).includes(actor(login)))) continue;
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

// One-way doors always need human approval. Two-way doors need approval under "approval" policy,
// or only a current passing verdict from a non-author under "verdict" policy. `approversByNumber`
// holds humanApprovers() per PR; reviewDecision alone is not trusted, because a bot can approve.
export const POLICIES = ["approval", "verdict"];

// A merge queue (or any deferred merge) lands whatever head is current when it fires, so the pinned
// head cannot be enforced. ship never lands onto a branch with a merge queue.
export function landableRun(stack, statusByNumber, { policy = "approval", approversByNumber = new Map(), mergeQueue = false } = {}) {
  if (!POLICIES.includes(policy)) throw new Error(`unknown policy "${policy}"; use ${POLICIES.join(" or ")}`);
  if (mergeQueue && stack.length) return { run: [], ceiling: { number: stack[0].number, blocker: "the target branch uses a merge queue, which merges later heads ship cannot pin" } };
  const run = [];
  for (const p of stack) {
    const s = statusByNumber.get(p.number) ?? { status: "missing" };
    const door = parseDoor(p.body);
    const approvers = approversByNumber.get(p.number) ?? [];
    const approved = approvers.length > 0;
    let blocker = null;
    if (s.status !== "current") blocker = `verdict ${s.status}${s.reason ? `: ${s.reason}` : ""}`;
    else if (!s.recordedBy || actor(s.recordedBy) === actor(p.author?.login)) blocker = "verdict was not recorded by someone other than the PR author";
    else if (door !== "two-way" && !approved) blocker = `${door} door needs human approval`;
    else if (policy === "approval" && !approved) blocker = "policy needs human approval";
    if (blocker) return { run, ceiling: { number: p.number, blocker } };
    run.push({ number: p.number, head: p.headRefOid, door, verdict: s.verdict, approvedBy: approvers });
  }
  return { run, ceiling: null };
}

// ---------- io ----------

const sh = (cmd, args, { trimOutput = true, ...opts } = {}) => {
  const output = execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...opts });
  return trimOutput ? output.trim() : output;
};
const gh = (args, repo) => sh("gh", repo ? [...args, "--repo", repo] : args);
// Whole-repository, unfiltered diff: no relative paths, conversion filters, external drivers, or
// ignored submodules, so local git config cannot hide a change from the fingerprint.
export const FINGERPRINT_DIFF_FLAGS = ["--no-relative", "--no-ext-diff", "--no-textconv", "--ignore-submodules=none", "--no-color", "--binary", "--full-index", "-U3"];
const PR_FIELDS = "number,title,author,body,baseRefName,headRefName,headRefOid,isCrossRepository,additions,deletions,isDraft,reviewDecision,mergeStateStatus";

function openPrs(repo) {
  return JSON.parse(gh(["pr", "list", "--state", "open", "--limit", "200", "--json", PR_FIELDS], repo));
}

function defaultBranch(repo) {
  return JSON.parse(sh("gh", ["repo", "view", ...(repo ? [repo] : []), "--json", "defaultBranchRef"])).defaultBranchRef.name;
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
  return repo ?? JSON.parse(sh("gh", ["repo", "view", "--json", "nameWithOwner"])).nameWithOwner;
}

function prReviews(n, repo) {
  const out = sh("gh", ["api", "--paginate", `repos/${nameWithOwner(repo)}/pulls/${n}/reviews`, "--jq", ".[] | {state, submitted_at, user: {login: .user.login, type: .user.type}}"]);
  return out ? out.split("\n").map((l) => JSON.parse(l)) : [];
}

function hasMergeQueue(branch, repo) {
  const [owner, name] = nameWithOwner(repo).split("/");
  const q = "query($o:String!,$n:String!,$b:String!){repository(owner:$o,name:$n){mergeQueue(branch:$b){id}}}";
  const out = sh("gh", ["api", "graphql", "-f", `query=${q}`, "-f", `o=${owner}`, "-f", `n=${name}`, "-f", `b=${branch}`, "--jq", ".data.repository.mergeQueue.id // empty"]);
  return out.length > 0;
}

function prComments(n, repo) {
  return JSON.parse(gh(["pr", "view", String(n), "--json", "comments"], repo)).comments;
}

function statusFor(pr, repo, trusted) {
  return verdictStatus(latestVerdict(prComments(pr.number, repo), { prAuthor: pr.author?.login, trusted }), currentPatch(pr));
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

async function main() {
  const a = parseArgs(process.argv.slice(2));
  const [cmd, sub, ...rest] = a._;
  const repo = a.repo;
  const trusted = a.trusted ? a.trusted.split(",").map((s) => s.trim()).filter(Boolean) : [];
  if (a.policy !== undefined && !POLICIES.includes(a.policy)) throw new Error(`unknown policy "${a.policy}"; use ${POLICIES.join(" or ")}`);
  if (cmd === "queue") {
    const me = a.me ?? sh("gh", ["api", "user", "--jq", ".login"]);
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
    gh(["pr", "comment", String(n), "--body", formatVerdict(v)], repo);
    return print(v, a.json, (x) => `recorded ${x.verdict} on #${n} at ${x.head.slice(0, 12)}`);
  }
  if (cmd === "verdict" && sub === "check") {
    const pr = openPrs(repo).find((p) => p.number === Number(rest[0]));
    if (!pr) throw new Error(`PR #${rest[0]} is not open`);
    return print(statusFor(pr, repo, trusted), a.json, (s) => `#${pr.number}: ${s.status}${s.reason ? ` (${s.reason})` : ""}`);
  }
  if (cmd === "run") {
    const prs = openPrs(repo);
    const { stack, stop } = walkStack(prs, Number(sub));
    const statuses = new Map(stack.map((p) => [p.number, statusFor(p, repo, trusted)]));
    const approvers = new Map(stack.map((p) => [p.number, humanApprovers(prReviews(p.number, repo), { prAuthor: p.author?.login, reviewDecision: p.reviewDecision })]));
    const mergeQueue = stack.length > 0 && hasMergeQueue(defaultBranch(repo), repo);
    const result = { ...landableRun(stack, statuses, { policy: a.policy ?? "approval", approversByNumber: approvers, mergeQueue }), stackStop: stop ?? null };
    return print(result, a.json, (r) =>
      [`landable run: ${r.run.map((x) => `#${x.number}@${x.head}`).join(" -> ") || "(none)"}`,
       r.ceiling ? `ceiling: #${r.ceiling.number}, ${r.ceiling.blocker}` : "ceiling: none, the whole stack is landable",
       r.stackStop ? `note: ${r.stackStop}` : ""].filter(Boolean).join("\n"));
  }
  throw new Error("usage: ship.mjs queue | verdict record|check | run <bottom-pr>");
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((e) => {
    process.stderr.write(`ship: ${e.message}\n`);
    process.exit(2);
  });
}
