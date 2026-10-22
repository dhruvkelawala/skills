#!/usr/bin/env node
// The two messages a build posts in its thread, the brief and the recap, checked for shape and kept
// in the run record.
//
//   messages.mjs brief <record>    check the brief on stdin, then append it to the run record
//   messages.mjs recap <record>    the same for a recap
//
// A message with problems is not saved: each problem prints on its own line and the exit code is 1.
// The brief's plan is checked against the record's `Acceptance criteria:` list. Sign-offs must not
// repeat any of the last 10 saved in the run records beside this one, which are this repo's runs.

import { appendFileSync, existsSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const USAGE = "usage: messages.mjs brief <record> < brief.txt\n       messages.mjs recap <record> < recap.txt";
const KINDS = { brief: "Brief", recap: "Recap" };
const RECAP_LINES = ["Built:", "Review:", "Evidence:", "Couldn't check:", "Next:"];
const RECENT_SIGN_OFFS = 10;
const SIGN_OFF_WORDS = 12;
// Saved as `## Brief, <ISO time>` with the message in a four-backtick fence, so a message may hold ```.
const SAVED = /^## (Brief|Recap), (\S+)\n\n````text\n([\s\S]*?)\n````$/gm;
const LOCAL = /\blocalhost\b|\b127\.0\.0\.1\b|\bfile:\/\/|(?:^|[\s(<"'`])(?:~\/|\/(?:Users|home|tmp|private|var|Volumes)\/)/;
const INSTRUCTION = /(?:^|\s)\/[a-z]|\b(?:reply|redirect)\b/i;

function briefProblems(lines, record) {
  const problems = [];
  if (!/^Building (?:#\d+|[A-Z][A-Z0-9]*-\d+): \S/.test(lines[0])) {
    problems.push("the first line must be `Building #<n>: <issue title>`");
  }

  const about = sectionText(lines, /^What it['’]s about:/, /^Plan:/);
  if (about === null) problems.push("the brief has no `What it's about:` line");
  else if (!about) problems.push("`What it's about:` is empty");
  else if (sentences(about) > 2) problems.push(`\`What it's about:\` has ${sentences(about)} sentences; keep it to one or two`);

  const plan = planSteps(lines);
  if (!plan.length) problems.push("the brief has no plan: list each acceptance criterion under `Plan:` as a numbered step");
  else problems.push(...planMismatch(plan, criteriaOf(record)));

  const stacked = lines.find((line) => line.startsWith("Stacked on:"));
  const match = stacked?.match(/^Stacked on: (.+) · Lane: (?:light|full)$/);
  if (!match) problems.push("the brief needs a `Stacked on: <PR | none> · Lane: <light | full>` line");
  else problems.push(...stackedOnMismatch(match[1], record));
  return problems;
}

function recapProblems(lines) {
  const problems = [];
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
  return problems;
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

function planMismatch(plan, criteria) {
  if (!criteria.length) return ["the run record has no `Acceptance criteria:` list to check the plan against"];
  const steps = plan.map(normalize);
  const wanted = criteria.map(normalize);
  return [
    ...criteria.filter((_, i) => !steps.includes(wanted[i])).map((criterion) => `missing criterion: ${criterion}`),
    ...plan.filter((_, i) => !wanted.includes(steps[i])).map((step) => `not a criterion: ${step}`),
    ...plan.filter((_, i) => steps.indexOf(steps[i]) !== i).map((step) => `listed twice: ${step}`),
  ];
}

function stackedOnMismatch(value, record) {
  const predecessor = record.match(/^predecessor_pr: .*\/pull\/(\d+)/m)?.[1];
  if (!predecessor) return value === "none" ? [] : ["`Stacked on:` is `none` for a run that isn't stacked"];
  return new RegExp(`(?:#|/pull/)${predecessor}\\b`).test(value) ? [] : [`\`Stacked on:\` names the predecessor, #${predecessor}`];
}

// The criteria are the numbered lines under `Acceptance criteria:`; indented lines below each, such as
// its surface and capture, are details.
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

function main(argv) {
  const [kind, record, ...rest] = argv;
  if (!KINDS[kind] || !record || rest.length) {
    console.error(USAGE);
    return 2;
  }
  if (!existsSync(record)) {
    console.error(`messages: no run record at ${record}`);
    return 2;
  }
  const text = readFileSync(0, "utf8").replace(/\s+$/, "");
  const lines = text.split("\n");
  const problems = [
    ...(kind === "brief" ? briefProblems(lines, readFileSync(record, "utf8")) : recapProblems(lines)),
    ...signOffProblems(lines, recentSignOffs(record)),
    ...(lines.some((line) => LOCAL.test(line)) ? ["links must open in T3: no local paths, file:// or localhost"] : []),
  ];
  if (problems.length) {
    console.error(`${KINDS[kind].toLowerCase()} not saved:\n${problems.map((problem) => `- ${problem}`).join("\n")}`);
    return 1;
  }
  appendFileSync(record, `\n## ${KINDS[kind]}, ${new Date().toISOString()}\n\n\`\`\`\`text\n${text}\n\`\`\`\`\n`);
  console.log(`${KINDS[kind].toLowerCase()} saved to ${record}`);
  return 0;
}

if (process.argv[1] && existsSync(process.argv[1]) && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main(process.argv.slice(2)));
}
