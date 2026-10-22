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

// Flags that take no value; every other flag consumes the next argument.
const BOOLEAN_FLAGS = new Set(["--web", "-w", "--comments", "-c", "--remove-milestone", "--paginate", "--slurp", "-i", "--include", "--silent", "--verbose"]);
const positionals = args.filter((a, i) => !a.startsWith("-") && !(i > 0 && args[i - 1].startsWith("-") && !BOOLEAN_FLAGS.has(args[i - 1])));

const flag = (...names) => {
  const i = args.findIndex((a) => names.includes(a));
  return i >= 0 ? args[i + 1] : undefined;
};
const flags = (...names) => args.flatMap((a, i) => (names.includes(a) ? [args[i + 1]] : []));
const readFile = (file) => readFileSync(file === "-" ? 0 : file, "utf8");
const fail = (message) => {
  process.stderr.write(`${message}\n`);
  process.exit(1);
};
const asListed = (issue) => ({ ...issue, state: "OPEN", labels: issue.labels.map((name) => ({ name })) });
const issueNumber = (ref) => Number(String(ref ?? "").match(/(?:^#?|\/issues\/)(\d+)$/)?.[1]);
const findIssue = (ref) => created.find((i) => i.number === issueNumber(ref));
const sampleIssue = (ref) => ISSUES.find((i) => i.number === issueNumber(ref));
const allIssues = () => [...created.map(asListed), ...ISSUES];
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

function edit(issue, { title, body, labels, addLabels = [], removeLabels = [] }) {
  if (title !== undefined) issue.title = title;
  if (body !== undefined) issue.body = body;
  issue.labels = [...new Set([...(labels ?? issue.labels), ...addLabels])].filter((l) => !removeLabels.includes(l));
  save();
}

// gh api: -f/--raw-field sends the text as is, -F/--field also reads @file, and `key[]` builds an array.
// With --input the body comes from that file and the fields become query parameters.
function apiBody() {
  const input = flag("--input");
  if (input) return JSON.parse(readFile(input));
  const fields = {};
  args.forEach((a, i) => {
    if (!["-f", "--raw-field", "-F", "--field"].includes(a)) return;
    const pair = args[i + 1];
    const [key, value] = [pair.slice(0, pair.indexOf("=")), pair.slice(pair.indexOf("=") + 1)];
    const parsed = (a === "-F" || a === "--field") && value.startsWith("@") ? readFile(value.slice(1)) : value;
    if (key.endsWith("[]")) (fields[key.slice(0, -2)] ??= []).push(parsed);
    else fields[key] = parsed;
  });
  return fields;
}

function api() {
  const path = (positionals[1] ?? "").replace(/^\//, "").split("?")[0];
  const body = apiBody();
  const method = (flag("-X", "--method") ?? (Object.keys(body).length || flag("--input") ? "POST" : "GET")).toUpperCase();
  const labelList = body.labels ?? (Array.isArray(body) ? body : []);
  if (method !== "GET" && !Array.isArray(labelList)) fail("gh: Invalid request. For 'properties/labels', is not an array. (HTTP 422)");
  if (/^repos\/[^/]+\/[^/]+$/.test(path)) return print(REPO);
  if (/^repos\/[^/]+\/[^/]+\/labels$/.test(path)) return print(LABELS);
  if (/^repos\/[^/]+\/[^/]+\/issues$/.test(path)) {
    if (method === "GET") return print(allIssues());
    if (!body.title) fail("gh: Validation Failed: title missing (HTTP 422)");
    const issue = create(body.title, body.body ?? "", labelList);
    return print({ number: issue.number, html_url: issue.url });
  }
  const [, number, sub, labelName] = path.match(/^repos\/[^/]+\/[^/]+\/issues\/(\d+)(?:\/(labels)(?:\/(.+))?)?$/) ?? [];
  const issue = findIssue(number);
  if (!issue) return sampleIssue(number) && method === "GET" ? print(sampleIssue(number)) : fail("gh: Not Found (HTTP 404)");
  if (sub && method === "POST") edit(issue, { addLabels: labelList });
  if (sub && method === "PUT") edit(issue, { labels: labelList });
  if (sub && method === "DELETE") edit(issue, { removeLabels: labelName ? [decodeURIComponent(labelName)] : issue.labels });
  if (!sub && method === "PATCH") edit(issue, { title: body.title, body: body.body, labels: body.labels });
  print(sub ? issue.labels.map((name) => ({ name })) : { ...asListed(issue), html_url: issue.url });
}

function bodyFlag() {
  const file = flag("--body-file", "-F");
  return file ? readFile(file) : flag("--body", "-b");
}

const [group, verb] = positionals;
const target = positionals[2];
if (args[0] === "--version") console.log("gh version 2.0.0 (fake)");
else if (group === "issue" && verb === "create") {
  if (!flag("--title", "-t")) fail("must provide `--title` and `--body` when not running interactively");
  console.log(create(flag("--title", "-t"), bodyFlag() ?? "", flags("--label", "-l").flatMap((l) => l.split(","))).url);
} else if (group === "issue" && verb === "edit") {
  const issue = findIssue(target) ?? fail(`GraphQL: Could not resolve to an issue or pull request with the number of ${target}.`);
  edit(issue, {
    title: flag("--title", "-t"),
    body: bodyFlag(),
    addLabels: flags("--add-label").flatMap((l) => l.split(",")),
    removeLabels: flags("--remove-label").flatMap((l) => l.split(",")),
  });
  console.log(issue.url);
} else if (group === "issue" && verb === "view") {
  const issue = findIssue(target);
  print(issue ? asListed(issue) : (sampleIssue(target) ?? fail(`GraphQL: Could not resolve to an issue or pull request with the number of ${target}.`)));
} else if (group === "issue" && verb === "list") print(allIssues());
else if (group === "repo" && verb === "view") print(REPO);
else if (group === "label" && verb === "list") print(LABELS);
else if (group === "label" && verb === "create") console.log(`✓ Label "${target}" created in acme/demo`);
else if (group === "api") api();
else if (group === "auth") console.log("github.com\n  ✓ Logged in to github.com account tester");
else fail(`fake gh: unsupported command: gh ${args.join(" ")}`);
