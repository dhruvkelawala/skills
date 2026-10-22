#!/usr/bin/env node
// The two messages a build posts in its thread, the brief and the recap, checked for shape and kept
// in the run record, and the page that shows them for a taste check.
//
//   messages.mjs brief <record>     check the brief on stdin, then append it to the run record
//   messages.mjs recap <record>     the same for a recap
//   messages.mjs page <record>...   print the taste-check page: each record's latest brief and recap
//
// A message with problems is not saved: each problem prints on its own line and the exit code is 1.
// The brief's plan is checked against the record's `Acceptance criteria:` list, or a spec's `Tickets:`
// list, and a spec's recap must give each ticket its line. Sign-offs must not repeat any of the last
// 10 saved in the run records beside this one, which are this repo's runs.

import { appendFileSync, existsSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { STATES, ticketsOf } from "./spec.mjs";

const USAGE = [
  "usage: messages.mjs brief <record> < brief.txt",
  "       messages.mjs recap <record> < recap.txt",
  "       messages.mjs page <record>... > taste.html",
].join("\n");
const KINDS = { brief: "Brief", recap: "Recap" };
const RECAP_LINES = ["Built:", "Review:", "Evidence:", "Couldn't check:", "Next:"];
const RECENT_SIGN_OFFS = 10;
const SIGN_OFF_WORDS = 12;
// Saved as `## Brief, <ISO time>` with the message in a four-backtick fence, so a message may hold ```.
const SAVED = /^## (Brief|Recap), (\S+)\n\n````text\n([\s\S]*?)\n````$/gm;
const LOCAL_LINK = /\bhttps?:\/\/(?:localhost|127\.0\.0\.1)\b|\blocalhost:\d|\bfile:\/\/|(?:^|[\s(<"'`])(?:~\/|\/(?:Users|home|tmp|private|var|Volumes)\/)/;
const INSTRUCTION = /(?:^|\s)\/[a-z]|\b(?:reply|redirect)\b/i;
// A brief's first line, plan steps and lane: a build's, and a spec's built as a stack, where each PR sets its own lane.
const BUILD = { as: "", title: "issue title", step: "criterion", lanes: ["light", "full"] };
const SPEC_BRIEFS = { stack: { as: " as a stack", title: "spec title", step: "ticket", lanes: ["per PR"] } };

function briefProblems(lines, record) {
  const problems = [];
  const tickets = ticketsOf(record).map((ticket) => ticket.step);
  const shape = tickets.length ? SPEC_BRIEFS[record.match(/^spec_mode: (\S+)/m)?.[1]] ?? SPEC_BRIEFS.stack : BUILD;
  if (!new RegExp(`^Building (?:#\\d+|[A-Z][A-Z0-9]*-\\d+)${shape.as}: \\S`).test(lines[0])) {
    problems.push(`the first line must be \`Building #<n>${shape.as}: <${shape.title}>\``);
  }

  const about = sectionText(lines, /^What it['’]s about:/, /^Plan:/);
  if (about === null) problems.push("the brief has no `What it's about:` line");
  else if (!about) problems.push("`What it's about:` is empty");
  else if (sentences(about) > 2) problems.push(`\`What it's about:\` has ${sentences(about)} sentences; keep it to one or two`);

  const plan = planSteps(lines);
  if (!plan.length) problems.push(`the brief has no plan: list each ${shape.step} under \`Plan:\` as a numbered step`);
  else problems.push(...planMismatch(plan, tickets.length ? tickets : criteriaOf(record), shape.step));

  const lane = shape.lanes.length > 1 ? `<${shape.lanes.join(" | ")}>` : shape.lanes[0];
  const stacked = lines.find((line) => line.startsWith("Stacked on:"));
  const match = stacked?.match(/^Stacked on: (.+) · Lane: (.+)$/);
  if (!match || !shape.lanes.includes(match[2])) problems.push(`the brief needs a \`Stacked on: <PR | none> · Lane: ${lane}\` line`);
  else problems.push(...stackedOnMismatch(match[1], record));
  return problems;
}

function recapProblems(message, record, path) {
  const problems = [];
  const lines = message.map((line) => line.replace(/^[-*] /, ""));
  if (!lines[0].trim() || RECAP_LINES.some((label) => lines[0].startsWith(label))) {
    problems.push("the recap starts with the result on its first line");
  }
  const found = RECAP_LINES.map((label) => ({ label, at: lines.findIndex((line) => line.startsWith(label)) }));
  for (const { label, at } of found) {
    if (at < 0) problems.push(`the recap has no \`${label}\` line`);
    else if (!lines[at].slice(label.length).trim()) problems.push(`\`${label}\` is empty`);
  }
  const present = found.filter(({ at }) => at >= 0);
  if (present.some(({ at }, i) => i > 0 && at < present[i - 1].at)) {
    problems.push(`the recap's lines go in this order: ${RECAP_LINES.join(" ")}`);
  }
  if (lines.some((line) => LOCAL_LINK.test(line))) problems.push("links must open in T3: no local paths, file:// or localhost");
  if (/^spec_mode: stack\b/m.test(record)) problems.push(...ticketLineProblems(lines, ticketsOf(record), dirname(path)));
  return problems;
}

// A spec's recap gives every ticket a line, as `spec.mjs next` prints it: its state, and its PR once it has one.
function ticketLineProblems(lines, tickets, dir) {
  return tickets.flatMap(({ number }) => {
    const line = lines.find((text) => new RegExp(`^#${number}\\b`).test(text));
    if (!line) return [`the recap has no line for #${number}: list every ticket with its state, as \`spec.mjs next\` prints it`];
    if (!STATES.includes(line.match(/^#\d+ ([a-z-]+)/)?.[1])) return [`#${number}'s line starts with its state, such as \`#${number} ready\``];
    const record = join(dir, `${number}.md`);
    const pr = existsSync(record) && readFileSync(record, "utf8").match(/^pr: (https?:\/\/\S+)/m)?.[1];
    return pr && !line.includes(pr) ? [`#${number}'s line needs its PR, ${pr}`] : [];
  });
}

function signOffProblems(lines, recent) {
  const problems = [];
  const signOff = lines.at(-1);
  if (lines.length < 3 || lines.at(-2).trim()) problems.push("end with a sign-off on its own line, after a blank line");
  if (!/^(?:\p{Extended_Pictographic}|\p{Regional_Indicator})/u.test(signOff)) problems.push("the sign-off starts with an emoji");
  const words = signOff.split(/\s+/).filter((word) => /[\p{L}\p{N}]/u.test(word)).length;
  if (words >= SIGN_OFF_WORDS) problems.push(`the sign-off has ${words} words; keep it under ${SIGN_OFF_WORDS}`);
  if (INSTRUCTION.test(signOff)) problems.push("the sign-off reads as an instruction; make it a playful nod to the issue or the moment");
  if (recent.some((earlier) => sameSignOff(earlier, signOff))) {
    problems.push(`the sign-off repeats one of the last ${RECENT_SIGN_OFFS} in this repo's run records`);
  }
  return problems;
}

function sectionText(lines, start, end) {
  const from = lines.findIndex((line) => start.test(line));
  if (from < 0) return null;
  const to = lines.findIndex((line, i) => i > from && end.test(line));
  return [lines[from].replace(start, ""), ...lines.slice(from + 1, to < 0 ? from + 1 : to)].join(" ").trim();
}

function sentences(text) {
  return text.split(/(?<=[.!?])\s+(?=[A-Z0-9#`"'(\[])/).length;
}

function planSteps(lines) {
  const from = lines.findIndex((line) => /^Plan:\s*$/.test(line));
  if (from < 0) return [];
  const steps = [];
  for (const line of lines.slice(from + 1)) {
    const step = line.match(/^\s*\d+\.\s+(.+)$/);
    if (step) steps.push(step[1]);
    else if (line.trim()) break;
  }
  return steps;
}

function planMismatch(plan, criteria, noun) {
  if (!criteria.length) return ["the run record has no `Acceptance criteria:` list to check the plan against"];
  const steps = plan.map(normalize);
  const wanted = criteria.map(normalize);
  return [
    ...criteria.filter((_, i) => !steps.includes(wanted[i])).map((criterion) => `missing ${noun}: ${criterion}`),
    ...plan.filter((_, i) => !wanted.includes(steps[i])).map((step) => `not a ${noun}: ${step}`),
    ...plan.filter((_, i) => steps.indexOf(steps[i]) !== i).map((step) => `listed twice: ${step}`),
  ];
}

function stackedOnMismatch(value, record) {
  const predecessor = record.match(/^predecessor_pr: .*\/pull\/(\d+)/m)?.[1];
  if (!predecessor) return value === "none" ? [] : ["`Stacked on:` is `none` for a run that isn't stacked"];
  return new RegExp(`(?:#|/pull/)${predecessor}\\b`).test(value) ? [] : [`\`Stacked on:\` names the predecessor, #${predecessor}`];
}

function criteriaOf(record) {
  const lines = record.split("\n");
  const from = lines.findIndex((line) => /^Acceptance criteria:\s*$/.test(line));
  if (from < 0) return [];
  const criteria = [];
  for (const line of lines.slice(from + 1)) {
    const criterion = line.match(/^\d+\.\s+(.+)$/);
    if (criterion) criteria.push(criterion[1]);
    else if (line.trim() && !/^\s/.test(line)) break;
  }
  return criteria;
}

function savedMessages(text) {
  return [...text.matchAll(SAVED)].map(([, kind, at, message]) => ({ kind, at, message }));
}

function recentSignOffs(record) {
  const dir = dirname(record);
  return readdirSync(dir)
    .filter((name) => name.endsWith(".md"))
    .flatMap((name) => savedMessages(readFileSync(join(dir, name), "utf8")))
    .sort((a, b) => a.at.localeCompare(b.at))
    .slice(-RECENT_SIGN_OFFS)
    .map(({ message }) => message.split("\n").at(-1));
}

const normalize = (text) => text.toLowerCase().replace(/\s+/g, " ").replace(/[\s.!?…]+$/u, "").trim();
const sameSignOff = (a, b) => normalize(a) === normalize(b);

function page(records) {
  const runs = records.map((record, i) => {
    const text = readFileSync(record, "utf8");
    const header = (key) => text.match(new RegExp(`^${key}: (.+)$`, "m"))?.[1] ?? "";
    const latest = (kind) => savedMessages(text).filter((saved) => saved.kind === kind).at(-1)?.message;
    const issue = header("issue");
    const meta = [header("mode").match(/^(?:stacked|standalone)/)?.[0], header("lane").match(/^(?:light|full)/)?.[0]?.concat(" lane")];
    return `<section class="run">
  <h2>${i + 1}. ${issueLink(issue)}<span class="meta">${meta.filter(Boolean).map((part) => `, ${part}`).join("")}</span></h2>
  ${bubble("Brief", latest("Brief"))}
  ${bubble("Recap", latest("Recap"))}
</section>`;
  });
  return `<!doctype html>
<html><head><meta charset="utf-8"><style>
  .runs { display: grid; gap: 24px; font-family: var(--font-sans); color: var(--foreground); }
  .intro { margin: 0; color: var(--muted-foreground); font-size: 14px; }
  .run { display: grid; gap: 10px; }
  .run h2 { margin: 0; font-size: 15px; font-weight: 600; }
  .meta { color: var(--muted-foreground); font-weight: 400; }
  .msg { max-width: 36rem; padding: 16px; border: 1px solid var(--border); border-radius: var(--radius); background: var(--card); color: var(--card-foreground); }
  .kind { margin-bottom: 6px; color: var(--muted-foreground); font-size: 12px; letter-spacing: 0.04em; text-transform: uppercase; }
  .text { white-space: pre-wrap; overflow-wrap: anywhere; font-size: 15px; line-height: 1.45; }
  .missing .text { color: var(--muted-foreground); font-style: italic; }
  a { color: var(--accent); }
  code { padding: 0 4px; border-radius: 4px; background: var(--code-background); color: var(--code-foreground); font-family: var(--font-mono); font-size: 0.9em; }
</style></head><body><main class="runs">
<p class="intro">Taste check: ${runs.length} run${runs.length === 1 ? "" : "s"}. Mark each one good or bad.</p>
${runs.join("\n")}
</main></body></html>
`;
}

function issueLink(issue) {
  const number = issue.match(/\/issues\/(\d+)/)?.[1];
  return number ? `<a href="${escape(issue)}">#${number}</a>` : escape(issue);
}

function bubble(kind, message) {
  if (!message) return `<div class="msg missing"><div class="kind">${kind}</div><div class="text">no ${kind.toLowerCase()} yet</div></div>`;
  return `<div class="msg"><div class="kind">${kind}</div><div class="text">${inline(message)}</div></div>`;
}

const INLINE = /\[([^\]\n]+)\]\((https?:\/\/[^)\s]+)\)|(https?:\/\/[^\s)]+)|`([^`\n]+)`/g;

function inline(message) {
  let html = "";
  let from = 0;
  for (const match of message.matchAll(INLINE)) {
    const [whole, text, url, bare, code] = match;
    html += escape(message.slice(from, match.index));
    if (url) html += `<a href="${escape(url)}">${escape(text)}</a>`;
    else if (bare) html += `<a href="${escape(bare)}">${escape(bare)}</a>`;
    else html += `<code>${escape(code)}</code>`;
    from = match.index + whole.length;
  }
  return html + escape(message.slice(from));
}

const escape = (text) => text.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);

function save(kind, record) {
  const text = readFileSync(0, "utf8").replace(/\s+$/, "");
  const lines = text.split("\n");
  const recordText = readFileSync(record, "utf8");
  const problems = [
    ...(kind === "brief" ? briefProblems(lines, recordText) : recapProblems(lines, recordText, record)),
    ...signOffProblems(lines, recentSignOffs(record)),
  ];
  if (problems.length) {
    console.error(`${kind} not saved:\n${problems.map((problem) => `- ${problem}`).join("\n")}`);
    return 1;
  }
  appendFileSync(record, `\n## ${KINDS[kind]}, ${new Date().toISOString()}\n\n\`\`\`\`text\n${text}\n\`\`\`\`\n`);
  console.log(`${kind} saved to ${record}`);
  return 0;
}

function main(argv) {
  const [command, ...records] = argv;
  if (command === "page" ? !records.length : !KINDS[command] || records.length !== 1) {
    console.error(USAGE);
    return 2;
  }
  const missing = records.find((path) => !existsSync(path));
  if (missing) {
    console.error(`messages: no run record at ${missing}`);
    return 2;
  }
  if (command !== "page") return save(command, records[0]);
  process.stdout.write(page(records));
  return 0;
}

if (process.argv[1] && existsSync(process.argv[1]) && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main(process.argv.slice(2)));
}
