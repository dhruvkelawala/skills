#!/usr/bin/env node
// A spec's tickets, and which of them start now, for issue-to-pr's spec mode.
//
//   spec.mjs tickets <record>                print the spec's open tickets in build order, for the contract
//   spec.mjs next <record>                   print one line per ticket, then `running` or `done`
//   spec.mjs started <record> <n> <thread>   note that ticket #n's build started in that thread
//   spec.mjs body <record> < body.md         check that a one-PR body closes and covers every ticket
//
// GitHub is read through `gh api` (REST). Each ticket's build is read from its run record, which sits
// beside the spec's record. A problem prints on stderr with exit code 1; a bad call exits 2.

import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const USAGE = [
  "usage: spec.mjs tickets <record>",
  "       spec.mjs next <record>",
  "       spec.mjs started <record> <n> <thread>",
  "       spec.mjs body <record> < body.md",
].join("\n");

// The word after `#<n>` on a ticket's line: the planner's own, then the run record's stages.
export const STATES = [
  "starts", "waits", "building", "blocked", "merged",
  "contract", "implemented", "reviewed", "verified", "published", "watching", "awaiting-human", "ready",
];
// A ticket in one of these waits on the user, so it no longer keeps the spec running.
const SETTLED = new Set(["ready", "awaiting-human", "merged", "blocked", "waits"]);

class Problem extends Error {}

export function ticketsOf(record) {
  const lines = record.split("\n");
  const from = lines.findIndex((line) => /^Tickets:\s*$/.test(line));
  if (from < 0) return [];
  const tickets = [];
  for (const line of lines.slice(from + 1)) {
    const ticket = line.match(/^\d+\.\s+(#(\d+) .+)$/);
    const blockers = line.match(/^\s+blocked by: (.+)$/);
    if (ticket) tickets.push({ number: Number(ticket[2]), step: ticket[1], blockedBy: [] });
    else if (blockers && tickets.length) tickets.at(-1).blockedBy = [...blockers[1].matchAll(/#(\d+)/g)].map(([, n]) => Number(n));
    else if (line.trim() && !/^\s/.test(line)) break;
  }
  return tickets;
}

function tickets(path) {
  const { repo, number } = specIssue(readFileSync(path, "utf8"));
  const open = github(repo, `issues/${number}/sub_issues?per_page=100`).filter((issue) => issue.state === "open");
  if (!open.length) throw new Problem(`#${number} has no open sub-issues, so it is not a spec`);
  const foreign = open.find((issue) => !inRepo(repo, issue));
  if (foreign) throw new Problem(`${foreign.html_url} is in another repository; spec mode builds the sub-issues of one repository`);
  const blockersOf = new Map(open.map((issue) => [issue.number, openBlockers(repo, issue.number)]));
  return [
    "Tickets:",
    ...buildOrder(open, blockersOf).flatMap((issue, i) => {
      const blockers = blockersOf.get(issue.number);
      return [`${i + 1}. #${issue.number} ${issue.title}`, ...(blockers.length ? [`   blocked by: ${blockers.map((n) => `#${n}`).join(", ")}`] : [])];
    }),
    "",
  ].join("\n");
}

function openBlockers(repo, number) {
  return github(repo, `issues/${number}/dependencies/blocked_by?per_page=100`)
    .filter((blocker) => blocker.state === "open")
    .map((blocker) => {
      if (!inRepo(repo, blocker)) {
        throw new Problem(`#${number} is blocked by ${blocker.html_url}, in another repository; spec mode stacks within one repository`);
      }
      return blocker.number;
    });
}

// Blockers first; among the tickets free to go, the lowest number first.
function buildOrder(open, blockersOf) {
  const inSpec = new Set(open.map((issue) => issue.number));
  const placed = new Set();
  let rest = [...open].sort((a, b) => a.number - b.number);
  const order = [];
  while (rest.length) {
    const free = rest.find((issue) => blockersOf.get(issue.number).every((n) => !inSpec.has(n) || placed.has(n)));
    if (!free) throw new Problem(`the blocked-by links form a loop among ${rest.map((issue) => `#${issue.number}`).join(", ")}`);
    order.push(free);
    placed.add(free.number);
    rest = rest.filter((issue) => issue !== free);
  }
  return order;
}

function next(path) {
  const record = readFileSync(path, "utf8");
  const tickets = ticketsOf(record);
  if (!tickets.length) throw new Problem("the record has no `Tickets:` list; add the one `spec.mjs tickets` prints to the contract");
  const { repo, number } = specIssue(record);
  const builds = buildsBeside(path);
  const started = new Set([...record.matchAll(/^started: #(\d+) /gm)].map(([, n]) => Number(n)));
  const closed = closedIssues(repo, number, tickets.flatMap((ticket) => [ticket.number, ...ticket.blockedBy]));
  const base = specBase(record);

  const stateOf = (n) => {
    const build = builds.get(n);
    if (closed.has(n) || build?.stage === "merged") return "merged";
    if (!build) return started.has(n) ? "building" : null;
    if (build.stage === "blocked") return "blocked";
    return build.pr ? build.stage : "building";
  };
  const byPr = new Map([...builds].filter(([, build]) => build.pr).map(([n, build]) => [build.pr, n]));
  const below = (n) => {
    const chain = new Set();
    for (let pr = builds.get(n)?.predecessor; byPr.has(pr) && !chain.has(byPr.get(pr)); pr = builds.get(byPr.get(pr)).predecessor) {
      chain.add(byPr.get(pr));
    }
    return chain;
  };

  const lines = tickets.map(({ number: n, blockedBy }) => {
    const state = stateOf(n);
    if (state) return { state, text: ticketLine(n, state, builds.get(n)) };
    const open = blockedBy.filter((b) => stateOf(b) !== "merged");
    const blocked = open.find((b) => stateOf(b) === "blocked");
    if (blocked) return { state: "waits", text: `#${n} waits for #${blocked}, which is blocked` };
    const unpublished = open.find((b) => !builds.get(b)?.pr);
    if (unpublished) return { state: "waits", text: `#${n} waits for #${unpublished}, which has no PR yet` };
    if (!open.length) return { state: "starts", text: `#${n} starts on ${base.branch}${base.pr ? `, stacked on ${base.pr}` : ""}` };
    const top = open.find((b) => open.every((other) => other === b || below(b).has(other)));
    if (!top) return { state: "waits", text: `#${n} waits for ${open.map((b) => `#${b}`).join(" or ")} to merge, because they are in different stacks` };
    return { state: "starts", text: `#${n} starts on ${builds.get(top).branch}, stacked on ${builds.get(top).pr}` };
  });
  const running = lines.some(({ state }) => !SETTLED.has(state));
  return [...lines.map(({ text }) => text), running ? "running" : "done", ""].join("\n");
}

function ticketLine(n, state, build) {
  const reason = state === "blocked" && build?.reason ? ` (${build.reason})` : "";
  return `#${n} ${state}${reason}${build?.pr ? `: ${build.pr}` : ""}`;
}

// Every run record in the folder, by issue number: the build's stage word, PR, branch and predecessor.
function buildsBeside(path) {
  const dir = dirname(path);
  const builds = new Map();
  for (const name of readdirSync(dir).filter((file) => file.endsWith(".md"))) {
    const text = readFileSync(join(dir, name), "utf8");
    const issue = field(text, "issue")?.match(/\/issues\/(\d+)$/)?.[1];
    if (!issue) continue;
    const link = (key) => (/^https?:\/\//.test(field(text, key) ?? "") ? field(text, key) : null);
    const stage = text.match(/^stage: ([^\s:]+):? *(.*)$/m);
    builds.set(Number(issue), {
      stage: stage?.[1],
      reason: stage?.[2],
      pr: link("pr"),
      branch: field(text, "branch"),
      predecessor: link("predecessor_pr"),
    });
  }
  return builds;
}

function closedIssues(repo, spec, numbers) {
  const children = github(repo, `issues/${spec}/sub_issues?per_page=100`).filter((issue) => inRepo(repo, issue));
  const states = new Map(children.map((issue) => [issue.number, issue.state]));
  for (const n of new Set(numbers)) if (!states.has(n)) states.set(n, github(repo, `issues/${n}`).state);
  return new Set([...states].filter(([, state]) => state === "closed").map(([n]) => n));
}

function specBase(record) {
  const branch = field(record, "base_ref")?.replace(/^refs\/remotes\/[^/]+\//, "");
  if (!branch) throw new Problem("the record has no `base_ref:` line");
  return { branch, pr: field(record, "mode") === "stacked" ? field(record, "predecessor_pr") : null };
}

function specIssue(record) {
  const issue = field(record, "issue");
  const match = issue?.match(/^https:\/\/github\.com\/([^/]+\/[^/]+)\/issues\/(\d+)$/);
  if (!match) throw new Problem(`spec mode reads a GitHub issue's sub-issues, and the record's issue is ${issue ?? "missing"}`);
  return { repo: match[1], number: Number(match[2]) };
}

function started(path, n, thread) {
  const record = readFileSync(path, "utf8");
  if (!ticketsOf(record).some((ticket) => ticket.number === n)) throw new Problem(`#${n} is not in the record's \`Tickets:\` list`);
  const earlier = record.match(new RegExp(`^started: #${n} in thread (\\S+)`, "m"));
  if (earlier) throw new Problem(`#${n} already started, in thread ${earlier[1]}`);
  appendFileSync(path, `${record.endsWith("\n") ? "" : "\n"}started: #${n} in thread ${thread}, ${new Date().toISOString()}\n`);
  return `#${n} started in thread ${thread}\n`;
}

// One keyword closes one issue: https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/linking-a-pull-request-to-an-issue
function body(path) {
  const text = readFileSync(0, "utf8");
  const evidence = text.match(/^## Evidence\n([\s\S]*?)(?=^## |(?![\s\S]))/m)?.[1] ?? "";
  const problems = ticketsOf(readFileSync(path, "utf8")).flatMap(({ number }) => [
    ...(new RegExp(`\\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?):? #${number}\\b`, "i").test(text)
      ? [] : [`#${number} never closes: give it its own keyword, as in \`Closes #${number}\``]),
    ...(new RegExp(`#${number}\\b`).test(evidence)
      ? [] : [`#${number} has no evidence: give it a bold \`#${number}\` line under \`## Evidence\`, with its criteria below it`]),
  ]);
  if (problems.length) throw new Problem(`the body does not cover every ticket:\n${problems.map((problem) => `- ${problem}`).join("\n")}`);
  return "the body covers every ticket\n";
}

// A sub-issue or blocker can live in another repository, where its number names a different issue.
const inRepo = (repo, issue) => issue.repository_url === `https://api.github.com/repos/${repo}`;

// The first word of a header line, so a note after it, such as "(merged ...)", is left out.
const field = (text, key) => text.match(new RegExp(`^${key}: (\\S+)`, "m"))?.[1];

function github(repo, path) {
  return JSON.parse(execFileSync("gh", ["api", `repos/${repo}/${path}`], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 }));
}

function main(argv) {
  const [command, path, ...rest] = argv;
  const fits = { tickets: !rest.length, next: !rest.length, body: !rest.length, started: rest.length === 2 && /^\d+$/.test(rest[0]) };
  if (!fits[command] || !path) {
    console.error(USAGE);
    return 2;
  }
  if (!existsSync(path)) {
    console.error(`spec: no run record at ${path}`);
    return 2;
  }
  try {
    if (command === "tickets") process.stdout.write(tickets(path));
    else if (command === "next") process.stdout.write(next(path));
    else if (command === "body") process.stdout.write(body(path));
    else process.stdout.write(started(path, Number(rest[0]), rest[1]));
    return 0;
  } catch (error) {
    console.error(`spec: ${error.message.trim()}`);
    return error instanceof Problem ? 1 : 2;
  }
}

if (process.argv[1] && existsSync(process.argv[1]) && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main(process.argv.slice(2)));
}
