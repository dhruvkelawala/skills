#!/usr/bin/env node
// The GitHub half of day's morning report, printed as JSON:
//
//   morning.mjs [--repos]
//
//   builds        open issues labelled ready-for-agent with no open blocker, that no open PR closes and no
//                 issue-to-pr run record on this machine has started, ranked by the open issues each one blocks,
//                 then by the repository pushed to last, then oldest first
//   almostReady   open unlabelled issues with ticket's "## What's missing" section, and its gaps
//   active        your open PRs updated in the last 14 days, the one updated last first, with their checks (failing,
//                 pending, passing or none), their review (changes requested, approved, requested or none) and
//                 whether they conflict with their base
//   stale         your open PRs with no update for 14 days, the one that went quiet last first
//   lateComments  your PRs merged in the last 7 days that a person commented on or a bot reviewed after the merge,
//                 newest first
//
// An issue counts when it is in one of your repositories or involves you. Archived repositories are skipped. When
// ~/.agent/day/repos.txt names repositories, one owner/name to a line, only those count, and one whose line ends in
// "weekdays" counts only Monday to Friday. --repos prints the repositories that count today, or null when every one
// does, and reads nothing from GitHub.
// It reads GitHub through search and REST calls only, so it never spends the GraphQL quota that every agent on the
// account shares. Exit codes: 0 printed, 2 a reading failed.

import { execFile } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { parseArgs, promisify } from "node:util";

const execFileP = promisify(execFile);

const READY = "ready-for-agent";
const DAY_MS = 24 * 60 * 60 * 1000;
const STALE_DAYS = 14;
const LATE_DAYS = 7;
const EXCERPT_CHARS = 280;
// Each merged PR takes three reads and each active one four, and a busy week merges well over a hundred PRs.
const PARALLEL_READS = 8;
// The same conclusions pr-watch's gate lets through.
const PASSING = new Set(["success", "neutral", "skipped"]);

const REPOS_FILE = join(homedir(), ".agent", "day", "repos.txt");
// The repositories that count today, or null when every one does. main sets it before any read.
let tracked = null;

const gh = async (...args) => (await execFileP("gh", args, { maxBuffer: 1 << 28 })).stdout.trim();
const pages = async (endpoint) => JSON.parse(await gh("api", "--paginate", "--slurp", endpoint));
const list = async (endpoint) => (await pages(endpoint)).flat();
// Every list starts from a search, so keeping only the tracked repositories here keeps the rest out of every list.
const search = async (q) =>
  (await pages(`search/issues?q=${encodeURIComponent(q)}&per_page=100`)).flatMap((page) => page.items).filter((item) => !tracked || tracked.some((r) => same(r, repoOf(item))));
const same = (a, b) => (a ?? "").toLowerCase() === (b ?? "").toLowerCase();
const repoOf = (item) => item.repository_url.split("/").slice(-2).join("/");

// The repositories repos.txt names, without the weekday-only ones on Saturday and Sunday in this machine's time zone,
// or null when it names none. A # starts a comment.
function trackedToday() {
  const lines = existsSync(REPOS_FILE) ? readFileSync(REPOS_FILE, "utf8").split("\n").map((line) => line.replace(/#.*/, "").trim()).filter(Boolean) : [];
  if (!lines.length) return null;
  const weekend = [0, 6].includes(new Date().getDay());
  return lines.flatMap((line) => {
    const [repo, when, ...rest] = line.split(/\s+/);
    if (!/^[\w.-]+\/[\w.-]+$/.test(repo) || (when && when !== "weekdays") || rest.length) throw new Error(`${REPOS_FILE}: "${line}" is not owner/name, optionally followed by weekdays`);
    return weekend && when ? [] : [repo];
  });
}

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

// Your open PRs, split into the active ones and the ones gone stale.
async function yourPulls(me, now) {
  const quietSince = now - STALE_DAYS * DAY_MS;
  const open = (await search(`is:pr is:open archived:false author:${me}`)).sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  const fields = (p) => ({ repo: repoOf(p), number: p.number, url: p.html_url, title: p.title, draft: Boolean(p.draft), updatedAt: p.updated_at });
  const active = await inBatches(open.filter((p) => Date.parse(p.updated_at) >= quietSince), async (p) => ({ ...fields(p), ...(await standing(repoOf(p), p.number)) }));
  const stale = open
    .filter((p) => Date.parse(p.updated_at) < quietSince)
    .map((p) => ({ ...fields(p), quietDays: Math.floor((now - Date.parse(p.updated_at)) / DAY_MS) }));
  return { active, stale };
}

// Where one PR stands: its checks at its head, its review, and whether it conflicts with its base.
async function standing(repo, number) {
  const pull = JSON.parse(await gh("api", `repos/${repo}/pulls/${number}`));
  const [reviews, runs, status] = await Promise.all([
    list(`repos/${repo}/pulls/${number}/reviews?per_page=100`),
    pages(`repos/${repo}/commits/${pull.head.sha}/check-runs?per_page=100`),
    gh("api", `repos/${repo}/commits/${pull.head.sha}/status?per_page=100`).then(JSON.parse),
  ]);
  // A rerun adds a check run under the same name, and only the newest one counts, as on the PR's page. The combined
  // status already keeps only the newest status for each context.
  const newest = new Map();
  for (const r of runs.flatMap((page) => page.check_runs).sort((a, b) => a.id - b.id)) newest.set(r.name, r);
  const results = [
    ...[...newest.values()].map((r) => (r.status !== "completed" ? "pending" : PASSING.has(r.conclusion) ? "passing" : "failing")),
    ...status.statuses.map((s) => (s.state === "pending" ? "pending" : s.state === "success" ? "passing" : "failing")),
  ];
  // A reviewer's last approval or change request stands until they review again; a comment changes neither.
  const decided = new Map();
  for (const r of reviews) if (["APPROVED", "CHANGES_REQUESTED", "DISMISSED"].includes(r.state)) decided.set(r.user?.login, r.state);
  const states = [...decided.values()];
  const waiting = (pull.requested_reviewers?.length ?? 0) + (pull.requested_teams?.length ?? 0) > 0;
  return {
    checks: ["failing", "pending", "passing"].find((s) => results.includes(s)) ?? "none",
    review: states.includes("CHANGES_REQUESTED") ? "changes requested" : states.includes("APPROVED") ? "approved" : waiting ? "requested" : "none",
    conflicts: pull.mergeable === false,
  };
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
  let args;
  try {
    args = parseArgs({ options: { repos: { type: "boolean" } } }).values;
  } catch {
    process.stderr.write("usage: morning.mjs [--repos]\n");
    return 2;
  }
  try {
    tracked = trackedToday();
    if (args.repos) {
      process.stdout.write(`${JSON.stringify(tracked)}\n`);
      return 0;
    }
    const me = await gh("api", "user", "--jq", ".login");
    const now = Date.now();
    const [ready, close, { active, stale }, late] = await Promise.all([builds(me), almostReady(me), yourPulls(me, now), lateComments(me, now)]);
    process.stdout.write(`${JSON.stringify({ builds: ready, almostReady: close, active, stale, lateComments: late }, null, 2)}\n`);
    return 0;
  } catch (error) {
    // A failed gh call's message holds the command and gh's own error on separate lines; the report wants one.
    process.stderr.write(`morning: ${error.message.replace(/\s+/g, " ").trim()}\n`);
    return 2;
  }
}

process.exit(await main());
