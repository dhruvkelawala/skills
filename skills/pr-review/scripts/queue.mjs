#!/usr/bin/env node
// The PRs waiting on your review, in the order a review sitting walks them, printed as JSON so any
// skill can ask for the queue:
//
//   queue.mjs
//
// It reads GitHub through gh's search and REST calls only, so it never spends the GraphQL quota that
// every agent on the account shares.

import { execFileSync } from "node:child_process";

const gh = (...args) => execFileSync("gh", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 1 << 28 }).trim();
const json = (...args) => JSON.parse(gh(...args));
const pages = (endpoint) => json("api", "--paginate", "--slurp", endpoint).flat();
const same = (a, b) => (a ?? "").toLowerCase() === (b ?? "").toLowerCase();

// Open PRs that ask for the user's review or that the user reviewed before. 1000 is the most a search returns.
function candidates(me) {
  const search = (filter) => json("search", "prs", filter, "--state", "open", "--json", "number,repository,isDraft,author", "--limit", "1000");
  const requested = search("--review-requested=@me");
  const found = new Map();
  for (const p of [...requested, ...search("--reviewed-by=@me")]) {
    if (p.isDraft || same(p.author?.login, me)) continue;
    const key = `${p.repository.nameWithOwner}#${p.number}`;
    found.set(key, { repo: p.repository.nameWithOwner, number: p.number, requested: found.get(key)?.requested || requested.includes(p) });
  }
  return [...found.values()];
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
function queueEntry(c, open, shape, me) {
  const pull = open.find((p) => p.number === c.number);
  if (!pull) return null;
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
  };
}

const walkOrder = (a, b) =>
  b.returnVisit - a.returnVisit || b.stackBottom - a.stackBottom || b.unblocks - a.unblocks || a.size - b.size ||
  a.repo.localeCompare(b.repo) || a.number - b.number;

const me = gh("api", "user", "--jq", ".login");
const queue = [];
const wanted = candidates(me);
for (const repo of new Set(wanted.map((c) => c.repo))) {
  const open = pages(`repos/${repo}/pulls?state=open&per_page=100`);
  // An archived repository is a dropped project, so none of its PRs wait on anyone.
  if (open.some((p) => p.base.repo?.archived)) continue;
  const shape = stacks(open);
  for (const c of wanted.filter((w) => w.repo === repo)) queue.push(queueEntry(c, open, shape, me));
}
process.stdout.write(`${JSON.stringify(queue.filter(Boolean).sort(walkOrder), null, 2)}\n`);
