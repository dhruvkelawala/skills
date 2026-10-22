// Stands in for gh during the eval: answers as the repo acme/demo and logs every call to $FAKE_GH_LOG.
import { appendFileSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

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

const args = process.argv.slice(2).flatMap((a) => (/^--[\w-]+=/.test(a) ? [a.slice(0, a.indexOf("=")), a.slice(a.indexOf("=") + 1)] : [a]));
const valueOf = (...names) => {
  const i = args.findIndex((a) => names.includes(a));
  return i >= 0 ? args[i + 1] : undefined;
};
const valuesOf = (...names) => args.flatMap((a, i) => (names.includes(a) ? [args[i + 1]] : []));
const readBody = (file) => (file === "-" ? readFileSync(0, "utf8") : readFileSync(file, "utf8"));
const log = (entry) => appendFileSync(process.env.FAKE_GH_LOG, `${JSON.stringify({ args, ...entry })}\n`);
const priorCreates = () => {
  try {
    return readFileSync(process.env.FAKE_GH_LOG, "utf8").split("\n").filter((l) => l.includes('"created":')).length;
  } catch {
    return 0;
  }
};
const print = (data) => {
  const json = JSON.stringify(data);
  const jq = valueOf("--jq", "-q");
  process.stdout.write(jq ? execFileSync("jq", ["-r", jq], { input: json, encoding: "utf8" }) : `${json}\n`);
};
const create = (title, body, labels) => {
  const number = 101 + priorCreates();
  const url = `https://github.com/acme/demo/issues/${number}`;
  log({ created: { title, body, labels, url } });
  return { number, url };
};

const [group, verb] = args;
const apiPath = group === "api" ? (args.slice(1).find((a) => /^\/?repos\//.test(a)) ?? "").replace(/^\//, "").split("?")[0] : "";
const apiFields = valuesOf("-f", "-F", "--field", "--raw-field");
const apiInput = valueOf("--input");

if (group === "issue" && verb === "create") {
  const file = valueOf("--body-file", "-F");
  const body = file ? readBody(file) : (valueOf("--body", "-b") ?? "");
  const labels = valuesOf("--label", "-l").flatMap((l) => l.split(","));
  console.log(create(valueOf("--title", "-t"), body, labels).url);
} else if (group === "api" && /^repos\/[^/]+\/[^/]+\/issues$/.test(apiPath) && (apiFields.length || apiInput)) {
  const fields = apiInput
    ? JSON.parse(readBody(apiInput))
    : Object.fromEntries(apiFields.map((f) => [f.slice(0, f.indexOf("=")), f.slice(f.indexOf("=") + 1)]));
  const body = fields.body?.startsWith("@") ? readBody(fields.body.slice(1)) : (fields.body ?? "");
  const labels = Array.isArray(fields.labels) ? fields.labels : Object.entries(fields).filter(([k]) => k.startsWith("labels")).map(([, v]) => v);
  const { number, url } = create(fields.title, body, labels);
  print({ number, html_url: url });
} else {
  log({});
  if (group === "repo" && verb === "view") print(REPO);
  else if (group === "label" && verb === "list") print(LABELS);
  else if (group === "issue" && verb === "list") print(ISSUES);
  else if (group === "issue" && verb === "view") print(ISSUES.find((i) => String(i.number) === String(args[2])) ?? ISSUES[0]);
  else if (/\/labels/.test(apiPath)) print(LABELS);
  else if (/\/issues/.test(apiPath)) print(ISSUES);
  else if (/^repos\/[^/]+\/[^/]+$/.test(apiPath)) print(REPO);
  else if (group === "auth") console.log("github.com\n  ✓ Logged in to github.com account tester");
}
