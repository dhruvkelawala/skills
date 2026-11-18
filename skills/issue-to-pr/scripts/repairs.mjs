#!/usr/bin/env node
import { existsSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { header, setHeader } from "./run-record.mjs";

const USAGE = [
  'usage: repairs.mjs add <record> --commit <sha> --fix "<what it fixed>" [--problem <key>] [--priority P0|P1|P2|P3] [--asked]',
  "       repairs.mjs more <record> [--problem <key>]",
].join("\n");
const MORE = 10;
const STRIKES = 3;

function add(path, { commit, fix, priority, asked, problem }) {
  const record = readFileSync(path, "utf8");
  const { used, budget } = counter(record);
  const sha = commit.slice(0, 7);
  const problemLabel = problem === undefined ? "" : `, problem ${problem}`;
  if (!asked && ["P2", "P3"].includes(priority)) {
    console.log(`Not recorded: ${sha} fixes only ${priority} findings. Add the finding to the PR's follow-ups list instead.`);
    return 1;
  }
  if (asked) {
    writeFileSync(path, withLine(record, `- fix ${sha}, asked for, not counted${problemLabel}: ${fix}`));
    console.log(`Fixed: ${fix} (${sha}), as asked, so it doesn't count. Repairs: ${used} of ${budget}.`);
    return 0;
  }
  if (problem !== undefined) {
    const lines = record.split("\n");
    const attempts = lines.filter((line) => {
      const match = line.match(/^- fix [0-9a-f]{7}, repair \d+ of \d+, problem (\S+): /i);
      return match?.[1] === problem;
    });
    const grants = lines.filter((line) => line === `- more: problem ${problem} allows ${STRIKES} more repairs`).length;
    if (attempts.length >= STRIKES * (grants + 1)) {
      console.log(`Not recorded: three strikes: ${problem}. The problem failed again after these repairs:\n${attempts.slice(-STRIKES).join("\n")}\nStop and ask for a different approach or "more" for this problem.`);
      return 1;
    }
  }
  if (used >= budget) {
    console.log(`Not recorded: the repair budget is spent (${used} of ${budget}), so ${sha} waits unpushed until "more".`);
    return 1;
  }
  const now = used + 1;
  writeFileSync(path, withLine(setHeader(record, "repairs", `${now}/${budget}`), `- fix ${sha}, repair ${now} of ${budget}${problemLabel}: ${fix}`));
  const spent = now === budget ? ` That spends the budget, so the PR comes back to you, and "more" adds ${MORE}.` : "";
  console.log(`Fixed: ${fix} (${sha}). Repair ${now} of ${budget}.${spent}`);
  return 0;
}

function more(path, problem) {
  const record = readFileSync(path, "utf8");
  const { used, budget } = counter(record);
  if (problem !== undefined) {
    writeFileSync(path, withLine(record, `- more: problem ${problem} allows ${STRIKES} more repairs`));
    console.log(`"more": ${STRIKES} more attempts for ${problem}. Repairs: ${used} of ${budget}.`);
    return 0;
  }
  writeFileSync(path, withLine(setHeader(record, "repairs", `${used}/${budget + MORE}`), `- more: the budget is ${budget + MORE}`));
  console.log(`"more": ${budget + MORE - used} of ${budget + MORE} repairs left.`);
  return 0;
}

function counter(record) {
  const [, used, budget] = header(record, "repairs").match(/^(\d+)\/(\d+)\b/) ?? [];
  if (!budget) throw new Error("the run record has no `repairs: <used>/<budget>` line in its header");
  return { used: Number(used), budget: Number(budget) };
}

const withLine = (record, line) => `${record.replace(/\n*$/, "\n")}${line}\n`;

function parse(argv) {
  const [command, path, ...rest] = argv;
  const options = { asked: false };
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === "--asked") options.asked = true;
    else if (["--commit", "--fix", "--priority", "--problem"].includes(rest[i]) && rest[i + 1] !== undefined) options[rest[i].slice(2)] = rest[++i];
    else return null;
  }
  if (options.problem !== undefined && !/^[a-z0-9][a-z0-9._:/-]*$/i.test(options.problem)) return null;
  if (command === "more") return path && (rest.length === 0 || (rest.length === 2 && rest[0] === "--problem")) ? { command, path, problem: options.problem } : null;
  if (command !== "add" || !path || !/^[0-9a-f]{7,40}$/i.test(options.commit ?? "") || !options.fix?.trim()) return null;
  if (options.priority !== undefined && !/^P[0-3]$/.test(options.priority)) return null;
  return { command, path, ...options, fix: options.fix.replace(/\s+/g, " ").trim() };
}

function main(argv) {
  const args = parse(argv);
  if (!args) {
    console.error(USAGE);
    return 2;
  }
  if (!existsSync(args.path)) {
    console.error(`repairs: no run record at ${args.path}`);
    return 2;
  }
  try {
    return args.command === "add" ? add(args.path, args) : more(args.path, args.problem);
  } catch (error) {
    console.error(`repairs: ${error.message}`);
    return 2;
  }
}

if (process.argv[1] && existsSync(process.argv[1]) && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main(process.argv.slice(2)));
}
