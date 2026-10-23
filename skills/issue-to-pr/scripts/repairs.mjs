#!/usr/bin/env node
// The repair budget a PR has for its whole life, kept in its run record. Every fix from the build to
// the merge goes in as one line, and the header's `repairs: <used>/<budget>` counts the ones nobody
// asked for.
//
//   repairs.mjs add <record> --commit <sha> --fix "<what it fixed>" [--asked]
//   repairs.mjs more <record>
//
// `add` appends the fix and prints the line to post in the thread. `--asked` marks a fix the user or
// a human reviewer asked for, which doesn't count. A counted fix with the budget spent is refused
// with exit 1 and not recorded. `more` adds 10 to the budget. A bad argument, or a record with no
// `repairs:` line, exits 2.

import { existsSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const USAGE = [
  'usage: repairs.mjs add <record> --commit <sha> --fix "<what it fixed>" [--asked]',
  "       repairs.mjs more <record>",
].join("\n");
const MORE = 10;
const COUNTER = /^repairs: (\d+)\/(\d+)\b.*$/m;

function add(path, { commit, fix, asked }) {
  const record = readFileSync(path, "utf8");
  const { used, budget } = counter(record);
  const sha = commit.slice(0, 7);
  if (asked) {
    writeFileSync(path, withLine(record, `- fix ${sha}, asked for, not counted: ${fix}`));
    console.log(`Fixed: ${fix} (${sha}), as asked, so it doesn't count. Repairs: ${used} of ${budget}.`);
    return 0;
  }
  if (used >= budget) {
    console.log(`Not recorded: the repair budget is spent (${used} of ${budget}), so ${sha} waits unpushed until "more".`);
    return 1;
  }
  const now = used + 1;
  writeFileSync(path, withLine(withCounter(record, now, budget), `- fix ${sha}, repair ${now} of ${budget}: ${fix}`));
  const spent = now === budget ? ` That spends the budget, so the PR comes back to you, and "more" adds ${MORE}.` : "";
  console.log(`Fixed: ${fix} (${sha}). Repair ${now} of ${budget}.${spent}`);
  return 0;
}

function more(path) {
  const record = readFileSync(path, "utf8");
  const { used, budget } = counter(record);
  writeFileSync(path, withLine(withCounter(record, used, budget + MORE), `- more: the budget is ${budget + MORE}`));
  console.log(`"more": ${budget + MORE - used} of ${budget + MORE} repairs left.`);
  return 0;
}

// The counter is the header's line, the record's lines before its first blank line.
function counter(record) {
  const [, used, budget] = record.split("\n\n")[0].match(COUNTER) ?? [];
  if (!budget) throw new Error("the run record has no `repairs: <used>/<budget>` line in its header");
  return { used: Number(used), budget: Number(budget) };
}

const withCounter = (record, used, budget) => record.replace(COUNTER, () => `repairs: ${used}/${budget}`);
const withLine = (record, line) => `${record.replace(/\n*$/, "\n")}${line}\n`;

function parse(argv) {
  const [command, path, ...rest] = argv;
  const options = { asked: false };
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === "--asked") options.asked = true;
    else if (["--commit", "--fix"].includes(rest[i]) && rest[i + 1] !== undefined) options[rest[i].slice(2)] = rest[++i];
    else return null;
  }
  if (command === "more") return path && rest.length === 0 ? { command, path } : null;
  if (command !== "add" || !path || !/^[0-9a-f]{7,40}$/i.test(options.commit ?? "") || !options.fix?.trim()) return null;
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
    return args.command === "add" ? add(args.path, args) : more(args.path);
  } catch (error) {
    console.error(`repairs: ${error.message}`);
    return 2;
  }
}

if (process.argv[1] && existsSync(process.argv[1]) && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main(process.argv.slice(2)));
}
