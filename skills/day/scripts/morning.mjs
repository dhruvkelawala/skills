#!/usr/bin/env node
// The GitHub half of day's morning report, printed as JSON:
//
//   morning.mjs
//
//   builds        open issues labelled ready-for-agent with no open blocker, that no open PR closes and no
//                 issue-to-pr run record on this machine has started, ranked by the open issues each one blocks,
//                 then by the repository pushed to last, then oldest first
//   almostReady   open unlabelled issues with ticket's "## What's missing" section, and its gaps
//   stale         your open PRs with no update for 14 days, the one that went quiet last first
//   lateComments  your PRs merged in the last 7 days that a person commented on or a bot reviewed after the merge,
//                 newest first
//
// An issue counts when it is in one of your repositories or involves you. Archived repositories are skipped.
// It reads GitHub through search and REST calls only, so it never spends the GraphQL quota that every agent on the
// account shares. Exit codes: 0 printed, 2 a reading failed.

import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileP = promisify(execFile);

const READY = "ready-for-agent";
const DAY_MS = 24 * 60 * 60 * 1000;
const STALE_DAYS = 14;
const LATE_DAYS = 7;
const EXCERPT_CHARS = 280;
// Each merged PR takes three reads, and a busy week merges well over a hundred PRs.
const PARALLEL_READS = 8;

const gh = async (...args) => (await execFileP("gh", args, { maxBuffer: 1 << 28 })).stdout.trim();
const pages = async (endpoint) => JSON.parse(await gh("api", "--paginate", "--slurp", endpoint));
const list = async (endpoint) => (await pages(endpoint)).flat();
const search = async (q) => (await pages(`search/issues?q=${encodeURIComponent(q)}&per_page=100`)).flatMap((page) => page.items);
const same = (a, b) => (a ?? "").toLowerCase() === (b ?? "").toLowerCase();
const repoOf = (item) => item.repository_url.split("/").slice(-2).join("/");

// Your repositories, and other repositories' issues that involve you, such as a team repo's issues you wrote.
async function yours(q, me) {
  const found = new Map();
  for (const item of [...(await search(`${q} user:${me}`)), ...(await search(`${q} involves:${me}`))]) found.set(item.html_url, item);
  return [...found.values()];
}

async function builds(me) {
  const unblocked = (await yours(`is:issue is:open archived:false label:${READY}`, me)).filter((i) => (i.issue_dependencies_summary?.blocked_by ?? 0) === 0);
  const closed = new Map();
  const pushedAt = new Map();
  for (const repo of new Set(unblocked.map(repoOf))) {
    closed.set(repo, closedBy(repo, await list(`repos/${repo}/pulls?state=open&per_page=100`)));
    pushedAt.set(repo, JSON.parse(await gh("api", `repos/${repo}`)).pushed_at ?? "");
  }
  const started = (i) => closed.get(repoOf(i)).has(i.number) || existsSync(join(homedir(), ".agent", "issue-to-pr", repoOf(i).split("/")[1], `${i.number}.md`));
  // A repository pushed to lately is a project in hand, so its builds come before a dormant one's.
  return unblocked
    .filter((i) => !started(i))
    .map((i) => ({ repo: repoOf(i), number: i.number, url: i.html_url, title: i.title, blocking: i.issue_dependencies_summary?.blocking ?? 0, createdAt: i.created_at }))
    .sort((a, b) => b.blocking - a.blocking || pushedAt.get(b.repo).localeCompare(pushedAt.get(a.repo)) || a.createdAt.localeCompare(b.createdAt));
}

// The issue numbers in repo that its open PRs close, by a closing keyword in the PR body.
function closedBy(repo, pulls) {
  const keyword = /\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?):?\s+(?:https:\/\/github\.com\/([\w.-]+\/[\w.-]+)\/issues\/|([\w.-]+\/[\w.-]+)?#)(\d+)\b/gi;
  return new Set(pulls.flatMap((p) => [...(p.body ?? "").matchAll(keyword)].filter(([, url, ref]) => same(url ?? ref ?? repo, repo)).map((m) => Number(m[3]))));
}

async function almostReady(me) {
  // Search matches words, not headings, so it narrows on the word and the heading is checked here.
  const found = await yours(`is:issue is:open archived:false -label:${READY} missing in:body`, me);
  return found
    .map((i) => ({ i, missing: gaps(i.body) }))
    .filter(({ missing }) => missing)
    .sort((a, b) => a.i.created_at.localeCompare(b.i.created_at))
    .map(({ i, missing }) => ({ repo: repoOf(i), number: i.number, url: i.html_url, title: i.title, missing }));
}

// The bullets under ticket's "## What's missing" heading, or null when the body has no such heading.
function gaps(body) {
  const [, section] = (body ?? "").split(/^##\s+What['’]s missing\s*$/im);
  if (section === undefined) return null;
  return section.split(/^#{1,6}\s/m)[0].split("\n").map((line) => line.match(/^\s*[-*]\s+(.+)/)?.[1].trim()).filter(Boolean);
}

async function stale(me, now) {
  const quietSince = now - STALE_DAYS * DAY_MS;
  return (await search(`is:pr is:open archived:false author:${me}`))
    .filter((p) => Date.parse(p.updated_at) < quietSince)
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    .map((p) => ({
      repo: repoOf(p), number: p.number, url: p.html_url, title: p.title, draft: Boolean(p.draft), updatedAt: p.updated_at,
      quietDays: Math.floor((now - Date.parse(p.updated_at)) / DAY_MS),
    }));
}

async function lateComments(me, now) {
  const from = new Date(now - LATE_DAYS * DAY_MS).toISOString().slice(0, 10);
  // A comment moves updated_at past the merge, so a PR untouched since its merge needs no reads.
  const touched = (await search(`is:pr is:merged archived:false author:${me} merged:>=${from}`)).filter((p) => p.updated_at > p.pull_request.merged_at);
  const found = await inBatches(touched, async (p) => {
    const [repo, mergedAt] = [repoOf(p), p.pull_request.merged_at];
    const [comments, reviewComments, reviews] = await Promise.all([
      list(`repos/${repo}/issues/${p.number}/comments?since=${mergedAt}&per_page=100`),
      list(`repos/${repo}/pulls/${p.number}/comments?since=${mergedAt}&per_page=100`),
      list(`repos/${repo}/pulls/${p.number}/reviews?per_page=100`),
    ]);
    // A bot's plain comment is a notice, such as a deploy; its review or line comment is a finding.
    const late = [
      ...comments.filter((c) => c.user?.type !== "Bot").map((c) => ({ author: c.user?.login, at: c.created_at, url: c.html_url, body: c.body })),
      ...reviewComments.map((c) => ({ author: c.user?.login, at: c.created_at, url: c.html_url, body: c.body })),
      ...reviews.map((r) => ({ author: r.user?.login, at: r.submitted_at, url: r.html_url, body: r.body })),
    ]
      .filter((c) => c.at > mergedAt && c.body?.trim() && !same(c.author, me))
      .sort((a, b) => a.at.localeCompare(b.at))
      .map((c) => ({ ...c, body: excerpt(c.body) }));
    return late.length ? { repo, number: p.number, url: p.html_url, title: p.title, mergedAt, comments: late } : null;
  });
  return found.filter(Boolean).sort((a, b) => b.comments.at(-1).at.localeCompare(a.comments.at(-1).at));
}

function excerpt(body) {
  const text = body.replace(/\s+/g, " ").trim();
  return text.length > EXCERPT_CHARS ? `${text.slice(0, EXCERPT_CHARS - 1)}…` : text;
}

async function inBatches(items, read) {
  const results = [];
  for (let i = 0; i < items.length; i += PARALLEL_READS) results.push(...(await Promise.all(items.slice(i, i + PARALLEL_READS).map(read))));
  return results;
}

async function main() {
  try {
    const me = await gh("api", "user", "--jq", ".login");
    const now = Date.now();
    const [ready, close, quiet, late] = await Promise.all([builds(me), almostReady(me), stale(me, now), lateComments(me, now)]);
    process.stdout.write(`${JSON.stringify({ builds: ready, almostReady: close, stale: quiet, lateComments: late }, null, 2)}\n`);
    return 0;
  } catch (error) {
    // A failed gh call's message holds the command and gh's own error on separate lines; the report wants one.
    process.stderr.write(`morning: ${error.message.replace(/\s+/g, " ").trim()}\n`);
    return 2;
  }
}

process.exit(await main());
