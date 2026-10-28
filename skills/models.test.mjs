import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const SKILLS = fileURLToPath(new URL(".", import.meta.url));
const { jobs } = JSON.parse(readFileSync(join(SKILLS, "models.json"), "utf8"));

test("Codex builds use the high-effort independent verifier and retain the reviewer switch", () => {
  assert.equal(jobs.verifier.onCodexThread.model, "claude-opus-5-5");
  assert.equal(jobs.verifier.onCodexThread.effort, "high");
  assert.equal(jobs.reviewers.use.model, "claude-opus-5-5");
});

const skillText = readdirSync(SKILLS, { recursive: true })
  .filter((path) => path.endsWith(".md"))
  .map((path) => ({ path, text: readFileSync(join(SKILLS, path), "utf8") }));

test("every job a skill names is in models.json", () => {
  const missing = skillText.flatMap(({ path, text }) =>
    [...text.matchAll(/`([a-z][a-z0-9-]*)` job\b/g)]
      .map(([, job]) => job)
      .filter((job) => !Object.hasOwn(jobs, job))
      .map((job) => `${path}: ${job}`),
  );
  assert.deepEqual(missing, []);
});

test("no skill text names a model", () => {
  const ids = Object.values(jobs).flatMap((job) =>
    Object.values(job).flatMap((entry) => [entry].flat().flatMap((one) => one?.model ?? [])),
  );
  const modelShapes = /\b(?:sonnet|opus|haiku|fable|gpt-\d[\w.-]*|claude-[a-z]+-\d[\w-]*|deepseek[\w/-]*|gemini[\w.-]*)\b/gi;
  const named = skillText.flatMap(({ path, text }) => [
    ...ids.filter((id) => text.includes(id)).map((id) => `${path}: ${id}`),
    ...[...text.matchAll(modelShapes)].map(([name]) => `${path}: ${name}`),
  ]);
  assert.deepEqual(named, []);
});
