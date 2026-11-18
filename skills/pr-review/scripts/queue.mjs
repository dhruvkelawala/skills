#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { parseArgs } from "node:util";

const gh = (...args) => execFileSync("gh", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 1 << 28 }).trim();
const json = (...args) => JSON.parse(gh(...args));
const pages = (endpoint) => json("api", "--paginate", "--slurp", endpoint).flat();
const same = (a, b) => (a ?? "").toLowerCase() === (b ?? "").toLowerCase();
const search = (...filters) => json("search", "prs", ...filters, "--state", "open", "--json", "number,repository,isDraft,author", "--limit", "1000");
const openByRepo = new Map();
function openIn(repo) {
  if (!openByRepo.has(repo)) openByRepo.set(repo, pages(`repos/${repo}/pulls?state=open&per_page=100`));
  return openByRepo.get(repo);
}

// Open PRs that ask for the user's review or that the user reviewed before.
function candidates(me, only) {
  const requested = search("--review-requested=@me");
  const found = new Map();
  for (const p of [...requested, ...search("--reviewed-by=@me")]) {
    if (p.isDraft || same(p.author?.login, me) || (only && !same(p.repository.nameWithOwner, only))) continue;
    const key = `${p.repository.nameWithOwner}#${p.number}`;
    found.set(key, { repo: p.repository.nameWithOwner, number: p.number, requested: found.get(key)?.requested || requested.includes(p) });
  }
  return [...found.values()];
}

function selected(only, me, author, since) {
  const pulls = only
    ? openIn(only).map((p) => ({ number: p.number, isDraft: p.draft, author: p.user, repository: { nameWithOwner: only } }))
    : search(...(author ? [`--author=${author}`] : []), ...(since !== undefined ? [`--updated=>=${new Date(since).toISOString().slice(0, 10)}`] : []));
  return pulls
    .filter((p) => !p.isDraft && (author ? same(p.author?.login, author) : !same(p.author?.login, me)))
    .map((p) => ({ repo: p.repository.nameWithOwner, number: p.number, requested: true }));
}

// How each of a repository's open PRs sits in its stacks. A fork's head branch lives in the fork, so
// it is never another PR's base.
function stacks(open) {
  const local = open.filter((p) => p.head.repo?.full_name === p.base.repo?.full_name);
  const byHead = new Map(local.map((p) => [p.head.ref, p]));
  const childrenOf = (p) => (local.includes(p) ? open.filter((c) => c !== p && c.base.ref === p.head.ref) : []);
  const unblocks = (p) => {
    const seen = new Set([p.number]);
    const todo = [p];
    while (todo.length) for (const c of childrenOf(todo.pop())) if (!seen.has(c.number)) seen.add(c.number), todo.push(c);
    return seen.size - 1;
  };
  return { stackBottom: (p) => !byHead.has(p.base.ref) || byHead.get(p.base.ref) === p, unblocks };
}

// A PR the user reviewed at its current head, with no new request, is waiting on its author.
function queueEntry(c, open, shape, me, since) {
  const pull = open.find((p) => p.number === c.number);
  if (!pull || pull.draft) return null;
  let readyAt;
  if (since !== undefined) {
    const events = pages(`repos/${c.repo}/issues/${c.number}/timeline?per_page=100`);
    readyAt = events.filter((e) => e.event === "ready_for_review" && Date.parse(e.created_at) >= since)
      .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))[0]?.created_at;
    if (!readyAt) return null;
  }
  const mine = pages(`repos/${c.repo}/pulls/${c.number}/reviews?per_page=100`)
    .filter((r) => same(r.user?.login, me) && r.state !== "PENDING")
    .sort((a, b) => (a.submitted_at ?? "").localeCompare(b.submitted_at ?? ""));
  const moved = mine.length > 0 && mine.at(-1).commit_id !== pull.head.sha;
  if (!c.requested && !moved) return null;
  const { additions, deletions, changed_files } = json("api", `repos/${c.repo}/pulls/${c.number}`);
  return {
    repo: c.repo, number: c.number, url: pull.html_url, title: pull.title, author: pull.user?.login,
    base: pull.base.ref, head: pull.head.sha, size: additions + deletions, files: changed_files,
    returnVisit: mine.length > 0, stackBottom: shape.stackBottom(pull), unblocks: shape.unblocks(pull),
    ...(readyAt ? { readyAt } : {}),
  };
}

const walkOrder = (a, b) =>
  b.returnVisit - a.returnVisit || b.stackBottom - a.stackBottom || b.unblocks - a.unblocks || a.size - b.size ||
  a.repo.localeCompare(b.repo) || a.number - b.number;

let args, since;
try {
  args = parseArgs({ options: { repo: { type: "string" }, mine: { type: "boolean" }, author: { type: "string" }, "ready-since": { type: "string" } } }).values;
  if (args.mine && args.author) throw new Error("choose --mine or --author");
  if (args["ready-since"] !== undefined) {
    since = Date.parse(args["ready-since"]);
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(args["ready-since"]) || !Number.isFinite(since)) throw new Error("expected an ISO timestamp with timezone");
  }
} catch {
  process.stderr.write("usage: queue.mjs [--repo owner/name] [--mine | --author login] [--ready-since ISO-timestamp]\n");
  process.exit(2);
}
const only = args.repo;
const me = gh("api", "user", "--jq", ".login");
const queue = [];
const author = args.author === "@me" || args.mine ? me : args.author;
const wanted = author || since !== undefined ? selected(only, me, author, since) : candidates(me, only);
for (const repo of new Set(wanted.map((c) => c.repo))) {
  const open = openIn(repo);
  // An archived repository is a dropped project, so none of its PRs wait on anyone.
  if (open.some((p) => p.base.repo?.archived)) continue;
  const shape = stacks(open);
  for (const c of wanted.filter((w) => w.repo === repo)) queue.push(queueEntry(c, open, shape, me, since));
}
process.stdout.write(`${JSON.stringify(queue.filter(Boolean).sort(walkOrder), null, 2)}\n`);
