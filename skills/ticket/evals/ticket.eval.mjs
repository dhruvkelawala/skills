// Runs the ticket skill in headless Claude Code against a fake gh, one run per thread.
// From the repo root: node --test skills/ticket/evals/ticket.eval.mjs
// Needs the claude CLI signed in, plus git and jq. Each run is a live agent turn, so results can vary between runs.
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const evalsDir = dirname(fileURLToPath(import.meta.url));
const skillDir = dirname(evalsDir);

const THREADS = {
  clear: `Here is our thread so far.

Me: \`demo export\` only writes CSV. I want a \`--format json\` option too.
You: That fits in src/export.ts. JSON output would be an array of row objects with the same columns as the CSV, and csv stays the default.
Me: Yes. And \`--format xml\`, or any other unknown name, should exit with code 2 and print "unknown format: xml".
You: Then the change is src/export.ts and its test file, src/export.test.ts. Nothing else moves.
Me: Not now, I'm in the middle of something else. File this.`,
  vague: `New people keep dropping off during onboarding. Someone on the team thinks the second screen is confusing, but nobody knows for sure. Make an issue for that, I'll look at it later.`,
  spec: `Here's the spec for the billing rewrite.

1. Move plans from the config file into a plans table, with a migration.
2. Add an invoices API: list, read and void.
3. Add an invoices page to the account settings.
4. Send a webhook when an invoice is paid or voided.

Each part ships on its own. Split this spec into tickets.`,
};

function scratchRepo() {
  const repo = mkdtempSync(join(tmpdir(), "ticket-eval-repo-"));
  const git = (...a) => execFileSync("git", ["-c", "user.name=eval", "-c", "user.email=eval@example.com", ...a], { cwd: repo });
  writeFileSync(join(repo, "README.md"), "# demo\n\nA CLI that imports and exports tables.\n");
  mkdirSync(join(repo, "src"));
  writeFileSync(join(repo, "src", "export.ts"), "export function exportTable(rows: string[][]): string {\n  return rows.map((r) => r.join(',')).join('\\n');\n}\n");
  git("init", "-q");
  git("remote", "add", "origin", "https://github.com/acme/demo.git");
  git("add", ".");
  git("commit", "-qm", "init");
  cpSync(skillDir, join(repo, ".claude", "skills", "ticket"), { recursive: true, filter: (src) => !src.startsWith(evalsDir) });
  return repo;
}

function fakeGhOnPath(dir) {
  const bin = join(dir, "bin");
  mkdirSync(bin);
  writeFileSync(join(bin, "gh"), `#!/bin/sh\nexec node "${join(evalsDir, "fake-gh.mjs")}" "$@"\n`);
  chmodSync(join(bin, "gh"), 0o755);
  return bin;
}

function agentEnv(bin, ghLog) {
  const env = { ...process.env, PATH: `${bin}:${process.env.PATH}`, FAKE_GH_LOG: ghLog, GH_TOKEN: "eval-invalid", GITHUB_TOKEN: "eval-invalid", GH_PROMPT_DISABLED: "1" };
  // Drop the markers of an enclosing Claude Code session so the run starts as its own session.
  for (const key of Object.keys(env)) if (key === "CLAUDECODE" || key.startsWith("CLAUDE_CODE_")) delete env[key];
  return env;
}

function readJsonLines(file) {
  try {
    return readFileSync(file, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
  } catch {
    return [];
  }
}

async function runThread(name) {
  const repo = scratchRepo();
  const out = mkdtempSync(join(tmpdir(), `ticket-eval-${name}-`));
  const ghLog = join(out, "gh.jsonl");
  const transcript = join(out, "transcript.jsonl");
  const args = ["-p", THREADS[name], "--output-format", "stream-json", "--verbose", "--allowedTools", "Bash,Read,Write,Edit,Glob,Grep,Skill"];
  const stdout = await new Promise((resolve, reject) => {
    const child = spawn("claude", args, { cwd: repo, env: agentEnv(fakeGhOnPath(out), ghLog), stdio: ["ignore", "pipe", "inherit"] });
    let text = "";
    child.stdout.on("data", (chunk) => (text += chunk));
    child.on("error", reject);
    child.on("close", () => resolve(text));
  });
  writeFileSync(transcript, stdout);
  const events = stdout.split("\n").filter((l) => l.startsWith("{")).map((l) => JSON.parse(l));
  const skills = events
    .filter((e) => e.type === "assistant")
    .flatMap((e) => e.message.content)
    .filter((c) => c.type === "tool_use" && c.name === "Skill")
    .map((c) => c.input.skill);
  const reply = events.findLast((e) => e.type === "result")?.result ?? "";
  const created = readJsonLines(ghLog).flatMap((e) => (e.created ? [e.created] : []));
  return { name, skills, reply, created, transcript };
}

const runs = {};
const reported = new Set();

// Starts each thread once, on first use, and prints what the agent did the first time a test reads it.
async function run(t, name) {
  const result = await (runs[name] ??= runThread(name));
  if (!reported.has(name)) {
    reported.add(name);
    t.diagnostic(`${name}: skills fired [${result.skills.join(", ")}], transcript ${result.transcript}`);
    for (const issue of result.created) t.diagnostic(`${name}: created ${issue.url} labels [${issue.labels.join(", ")}] title "${issue.title}"\n${issue.body}`);
    t.diagnostic(`${name}: reply\n${result.reply}`);
  }
  return result;
}

describe("ticket", { concurrency: true }, () => {
  test("fires on a request to capture one idea", async (t) => {
    for (const result of await Promise.all([run(t, "clear"), run(t, "vague")])) {
      assert.ok(result.skills.includes("ticket"), `${result.name}: ticket did not fire`);
    }
  });

  test("stays out of splitting a spec into tickets", async (t) => {
    const result = await run(t, "spec");
    assert.ok(!result.skills.includes("ticket"), "spec: ticket fired");
  });
});
