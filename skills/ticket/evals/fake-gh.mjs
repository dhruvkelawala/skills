// Stands in for gh during the eval: answers as the repo acme/demo, keeps the issues it creates in
// $FAKE_GH_DIR/issues.json, and logs every call to $FAKE_GH_DIR/calls.jsonl.
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

const REPO = { name: "demo", nameWithOwner: "acme/demo", full_name: "acme/demo", url: "https://github.com/acme/demo", hasIssuesEnabled: true };
const LABELS = [{ name: "ready-for-agent", description: "Ready to build with /issue-to-pr", color: "0e8a16" }, { name: "bug" }];
const ISSUES = [
  {
    number: 41,
    title: "Show the import progress as a percentage",
    state: "OPEN",
    labels: [{ name: "ready-for-agent" }],
    body: "## What to build\n\n`demo import` prints a dot per row. It should print the percentage done instead, updated in place.\n\n## Acceptance criteria\n\n- Importing a 200-row file prints 0% to 100% on one line.\n- Piped output prints only the final summary.\n\n## In scope\n\n`src/import.ts` and its tests.\n",
  },
  {
    number: 40,
    title: "Export drops rows with an empty first column",
    state: "CLOSED",
    labels: [],
    body: "## What's wrong\n\nRows whose first column is empty are missing from `demo export`.\n\n## Acceptance criteria\n\n- Exporting a table with an empty first column keeps every row.\n\n## In scope\n\n`src/export.ts`.\n",
  },
];

const dir = process.env.FAKE_GH_DIR;
const issuesFile = join(dir, "issues.json");
const created = existsSync(issuesFile) ? JSON.parse(readFileSync(issuesFile, "utf8")) : [];
const save = () => writeFileSync(issuesFile, JSON.stringify(created, null, 2));

const args = process.argv.slice(2).flatMap((a) => (/^--[\w-]+=/.test(a) ? [a.slice(0, a.indexOf("=")), a.slice(a.indexOf("=") + 1)] : [a]));
appendFileSync(join(dir, "calls.jsonl"), `${JSON.stringify(args)}\n`);

const flag = (...names) => {
  const i = args.findIndex((a) => names.includes(a));
  return i >= 0 ? args[i + 1] : undefined;
};
const flags = (...names) => args.flatMap((a, i) => (names.includes(a) ? [args[i + 1]] : []));
const readFile = (file) => readFileSync(file === "-" ? 0 : file, "utf8");
const asListed = (issue) => ({ ...issue, state: "OPEN", labels: issue.labels.map((name) => ({ name })) });
const findIssue = (number) => created.find((i) => i.number === Number(number));
const print = (data) => {
  const json = JSON.stringify(data);
  const jq = flag("--jq", "-q");
  process.stdout.write(jq ? execFileSync("jq", ["-r", jq], { input: json, encoding: "utf8" }) : `${json}\n`);
};

function create(title, body, labels) {
  const number = 101 + created.length;
  const issue = { number, title, body, labels, url: `https://github.com/acme/demo/issues/${number}` };
  created.push(issue);
  save();
  return issue;
}

function edit(issue, { title, body, addLabels = [], removeLabels = [] }) {
  if (title !== undefined) issue.title = title;
  if (body !== undefined) issue.body = body;
  issue.labels = [...new Set([...issue.labels, ...addLabels])].filter((l) => !removeLabels.includes(l));
  save();
}

// gh api fields: -f/--raw-field sends the text as is; -F/--field reads @file and parses literals.
function apiFields() {
  const fields = {};
  const add = (pair, typed) => {
    const [key, value] = [pair.slice(0, pair.indexOf("=")), pair.slice(pair.indexOf("=") + 1)];
    const parsed = typed && value.startsWith("@") ? readFile(value.slice(1)) : value;
    if (key.endsWith("[]")) (fields[key.slice(0, -2)] ??= []).push(parsed);
    else fields[key] = parsed;
  };
  args.forEach((a, i) => {
    if (a === "-f" || a === "--raw-field") add(args[i + 1], false);
    if (a === "-F" || a === "--field") add(args[i + 1], true);
  });
  const input = flag("--input");
  return input ? { ...fields, ...JSON.parse(readFile(input)) } : fields;
}

function api() {
  const path = (args.slice(1).find((a) => /^\/?repos\//.test(a)) ?? "").replace(/^\//, "").split("?")[0];
  const fields = apiFields();
  const method = (flag("-X", "--method") ?? (Object.keys(fields).length ? "POST" : "GET")).toUpperCase();
  const [, number, sub] = path.match(/^repos\/[^/]+\/[^/]+\/issues\/(\d+)(?:\/(\w+))?$/) ?? [];
  if (method === "POST" && /^repos\/[^/]+\/[^/]+\/issues$/.test(path)) {
    const issue = create(fields.title, fields.body ?? "", fields.labels ?? []);
    return print({ number: issue.number, html_url: issue.url });
  }
  if (number && findIssue(number)) {
    const issue = findIssue(number);
    if (sub === "labels" && method === "POST") edit(issue, { addLabels: fields.labels ?? [] });
    if (!sub && method === "PATCH") edit(issue, { title: fields.title, body: fields.body, addLabels: fields.labels ?? [] });
    return print(sub === "labels" ? issue.labels.map((name) => ({ name })) : { ...asListed(issue), html_url: issue.url });
  }
  if (/\/labels/.test(path)) return print(LABELS);
  if (/\/issues/.test(path)) return print([...created.map(asListed), ...ISSUES]);
  if (/^repos\/[^/]+\/[^/]+$/.test(path)) return print(REPO);
}

const [group, verb, target] = args;
if (group === "issue" && verb === "create") {
  const file = flag("--body-file", "-F");
  const body = file ? readFile(file) : (flag("--body", "-b") ?? "");
  console.log(create(flag("--title", "-t"), body, flags("--label", "-l").flatMap((l) => l.split(","))).url);
} else if (group === "issue" && verb === "edit" && findIssue(target)) {
  const file = flag("--body-file", "-F");
  edit(findIssue(target), {
    title: flag("--title", "-t"),
    body: file ? readFile(file) : flag("--body", "-b"),
    addLabels: flags("--add-label").flatMap((l) => l.split(",")),
    removeLabels: flags("--remove-label").flatMap((l) => l.split(",")),
  });
  console.log(findIssue(target).url);
} else if (group === "issue" && verb === "view") {
  const issue = findIssue(target);
  print(issue ? asListed(issue) : (ISSUES.find((i) => String(i.number) === String(target)) ?? ISSUES[0]));
} else if (group === "issue" && verb === "list") print([...created.map(asListed), ...ISSUES]);
else if (group === "repo" && verb === "view") print(REPO);
else if (group === "label" && verb === "list") print(LABELS);
else if (group === "api") api();
else if (group === "auth") console.log("github.com\n  ✓ Logged in to github.com account tester");
