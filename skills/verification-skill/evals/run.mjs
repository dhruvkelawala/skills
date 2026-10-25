#!/usr/bin/env node
// Replays `/verification-skill create` on a case repo at the commit before its verify skill existed, has a second
// agent score what it wrote against the lessons the repo's own history taught, and appends the score to results.md.
//
//   node skills/verification-skill/evals/run.mjs           list the cases
//   node skills/verification-skill/evals/run.mjs <case>    run one case end to end
//
// README.md says what a run does and what it needs.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const evalsDir = dirname(fileURLToPath(import.meta.url));
const casesDir = join(evalsDir, "cases");
const USAGE = "usage: node skills/verification-skill/evals/run.mjs [<case>]";
// A short SHA with at least one digit, or a PR number, inside parentheses.
const CITATION = /\([^)]*(?:\b(?=[0-9a-f]*\d)[0-9a-f]{7,40}\b|#\d+)[^)]*\)/;

class Refused extends Error {}

function caseNames() {
  return existsSync(casesDir) ? readdirSync(casesDir).filter((f) => f.endsWith(".md")).map((f) => f.slice(0, -3)).sort() : [];
}

function readCase(name) {
  const file = join(casesDir, `${name}.md`);
  if (!existsSync(file)) throw new Refused(`no case "${name}"; the cases are ${caseNames().join(", ") || "none"}`);
  const text = readFileSync(file, "utf8");
  const field = (label) => text.match(new RegExp(`^- ${label}: (.+)$`, "m"))?.[1].trim();
  const [repo, checkout, base] = ["Repo", "Checkout", "Base"].map(field);
  const lessons = (text.split(/^## Lessons$/m)[1] ?? "")
    .split("\n")
    .map((line) => line.match(/^(\d+)\. (.+)$/))
    .filter(Boolean)
    .map(([, n, lesson]) => ({ n: Number(n), text: lesson }));

  const problems = [];
  for (const [label, value] of [["Repo", repo], ["Checkout", checkout], ["Base", base]]) if (!value) problems.push(`no "- ${label}:" line`);
  if (base && !/^[0-9a-f]{40}$/.test(base)) problems.push("Base must be a full commit SHA");
  if (!lessons.length) problems.push('no numbered lessons under "## Lessons"');
  lessons.forEach((lesson, i) => {
    if (lesson.n !== i + 1) problems.push(`lesson ${lesson.n} should be numbered ${i + 1}`);
    if (!CITATION.test(lesson.text)) problems.push(`lesson ${lesson.n} cites no commit or PR`);
  });
  if (problems.length) throw new Refused(`${file}: ${problems.join("; ")}`);
  return { name, repo, checkout: checkout.replace(/^~(?=\/)/, homedir()), base, lessons };
}

function list() {
  const lines = caseNames().map((name) => {
    const { repo, base, lessons } = readCase(name);
    return `  ${name.padEnd(10)} ${repo} at ${base.slice(0, 8)}, ${lessons.length} lessons`;
  });
  console.log(`${USAGE}\n\ncases:\n${lines.join("\n")}`);
}

try {
  const name = process.argv[2];
  if (!name) list();
  else {
    readCase(name);
    throw new Error("running a case is not built yet");
  }
} catch (error) {
  console.error(error instanceof Refused ? error.message : error);
  process.exitCode = error instanceof Refused ? 2 : 1;
}
