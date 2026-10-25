import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const PR_BODY = fileURLToPath(new URL("./pr-body.mjs", import.meta.url));
const fixture = (name) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");

// pingdotgg/t3code#24832's body as it merged (MIT): the problem, the change, one Before | After
// table and a Proof line. 219 words, by `wc -w` once its images, link targets, table pipes, the
// `/` and the 🤖 are deleted by hand.
const T3_BODY = fixture("t3code-24832.md");
const T3_WORDS = 219;

const check = (body) => spawnSync(process.execPath, [PR_BODY], { input: body, encoding: "utf8" });

function passes(body) {
  const result = check(body);
  assert.equal(result.status, 0, result.stderr);
  return Number(result.stdout.match(/(\d+) words/)?.[1]);
}

function problemsOf(body) {
  const result = check(body);
  assert.equal(result.status, 1, `expected a refusal, got: ${result.stdout}${result.stderr}`);
  return result.stderr.split("\n").filter((line) => line.startsWith("- ")).map((line) => line.slice(2));
}

// The T3 body with the first line that contains `match` edited, and that line's number.
function editLine(match, edit) {
  const lines = T3_BODY.split("\n");
  const at = lines.findIndex((line) => line.includes(match));
  lines[at] = edit(lines[at]);
  return { body: lines.join("\n"), line: at + 1 };
}

const words = (n) => Array.from({ length: n }, () => "word").join(" ");

test("a T3 Code body passes, and its count leaves out images, link targets and markup", () => {
  assert.equal(passes(T3_BODY), T3_WORDS);
});

test("400 words above <details> pass, and image markup, URLs and the body below <details> are not counted", () => {
  assert.equal(passes(editLine("Generated with", (line) => `${line} ${words(400 - T3_WORDS)}`).body), 400);
  const shot = (n) => `![The queue sheet at the largest text size, with the Steer pill beside row ${n}](https://files.tslop.org/2026/10/queue-steer-row-${n}-6c52bffe.png)`;
  const longer = [
    T3_BODY,
    Array.from({ length: 10 }, (_, n) => shot(n)).join("\n"),
    '<img alt="The same sheet in dark mode, with the arrow icon on the pill" src="https://files.tslop.org/2026/10/queue-steer-dark.png" width="300">',
    "https://files.tslop.org/2026/10/queue-steer-near-miss.mov",
    "<details>",
    "<summary>Verification</summary>",
    `Run at \`1fa6265\` against base \`5ab2c3c\`. ${words(600)}`,
    "</details>",
  ].join("\n\n");
  assert.equal(passes(longer), T3_WORDS);
});

// A full two-tier body from issue-to-pr, with commit SHAs, fenced excerpts and images below <details>.
test("Lore #78's body, rewritten to the template, passes the check", () => {
  passes(fixture("lore-78.md"));
});

// The body agents copy: the pr skill's worked example, in its `## Worked example` section.
test("the pr skill's worked example passes, with under 250 words above <details>", () => {
  const skill = readFileSync(new URL("../../pr/SKILL.md", import.meta.url), "utf8");
  const example = skill.match(/^## Worked example\n[\s\S]*?^````markdown\n([\s\S]*?)^````$/m)?.[1];
  assert.ok(example, "pr/SKILL.md has a `## Worked example` section with the body in a ````markdown fence");
  const words = passes(example);
  assert.ok(words < 250, `the worked example has ${words} words above <details>`);
});

const REFUSALS = [
  {
    rule: "the 401st word above <details>",
    ...editLine("Generated with", (line) => `${line} ${words(401 - T3_WORDS)}`),
    problem: /reaches 401 words/,
  },
  {
    rule: "a paragraph that runs past 400 words",
    ...editLine("The other half of the report", (line) => `${line} ${words(400)}`),
    problem: /reaches 401 words here.*619/,
  },
  {
    rule: "a backticked commit SHA above <details>",
    ...editLine("already fixed on `main`", (line) => line.replace("on `main`", "on `main` at `1fa6265`")),
    problem: /`1fa6265` is a commit SHA/,
  },
  {
    rule: "alt text that is the image's file name",
    ...editLine("![before]", (line) => line.replace("![before]", "![queue-steer-before-crop-6c52bffe.png]")),
    problem: /"queue-steer-before-crop-6c52bffe\.png" is its file name/,
  },
  {
    rule: "alt text of the form <file> @ <sha>, in an <img> tag",
    ...editLine("![near miss steered]", () => '<img alt="queue-steer-near-miss.png @ 1fa6265" src="https://files.tslop.org/2026/10/queue-steer-near-miss-steered-473259c6.png" width="300">'),
    problem: /"queue-steer-near-miss\.png @ 1fa6265" is a file name and a commit/,
  },
  {
    rule: "alt text that is a file name below <details>",
    ...belowDetails("![queue-steer-full.png](https://files.tslop.org/2026/10/queue-steer-full.png)"),
    problem: /"queue-steer-full\.png" is its file name/,
  },
];

// The T3 body with a <details> block holding `content`, and the line `content` lands on.
function belowDetails(content) {
  const body = `${T3_BODY}\n<details>\n<summary>Full screenshots</summary>\n\n${content}\n\n</details>\n`;
  return { body, line: body.split("\n").indexOf(content) + 1 };
}

for (const { rule, body, line, problem } of REFUSALS) {
  test(`the check refuses ${rule}, naming line ${line}`, () => {
    const problems = problemsOf(body);
    assert.equal(problems.length, 1, problems.join("\n"));
    assert.match(problems[0], new RegExp(`^line ${line}: `));
    assert.match(problems[0], problem);
  });
}
