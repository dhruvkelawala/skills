// Runs the ticket skill in headless Claude Code against a fake gh, one run per thread.
// From the repo root: node --test skills/ticket/evals/ticket.eval.mjs
// Needs the claude CLI signed in, plus git and jq. Each run is a live agent turn, so results can vary between runs.
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync, chmodSync } from "node:fs";
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
  writeFileSync(
    join(repo, "src", "export.ts"),
    `export type Table = { columns: string[]; rows: string[][] };

// demo export <table>: prints the table as CSV, with a header row of column names.
export function exportTable(table: Table): string {
  return [table.columns, ...table.rows].map((row) => row.join(",")).join("\\n");
}
`,
  );
  writeFileSync(
    join(repo, "src", "export.test.ts"),
    `import { test, expect } from "vitest";
import { exportTable } from "./export";

test("exports a header row, then one line per row", () => {
  expect(exportTable({ columns: ["id", "name"], rows: [["1", "Ada"]] })).toBe("id,name\\n1,Ada");
});
`,
  );
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

function agentEnv(bin, ghDir) {
  const env = { ...process.env, PATH: `${bin}:${process.env.PATH}`, FAKE_GH_DIR: ghDir, GH_TOKEN: "eval-invalid", GITHUB_TOKEN: "eval-invalid", GH_PROMPT_DISABLED: "1" };
  // Drop the markers of an enclosing Claude Code session so the run starts as its own session.
  for (const key of Object.keys(env)) if (key === "CLAUDECODE" || key.startsWith("CLAUDE_CODE_")) delete env[key];
  return env;
}

async function runThread(name) {
  const repo = scratchRepo();
  const out = mkdtempSync(join(tmpdir(), `ticket-eval-${name}-`));
  const transcript = join(out, "transcript.jsonl");
  const args = ["-p", THREADS[name], "--output-format", "stream-json", "--verbose", "--allowedTools", "Bash,Read,Write,Edit,Glob,Grep,Skill"];
  const { stdout, code } = await new Promise((resolve, reject) => {
    const child = spawn("claude", args, { cwd: repo, env: agentEnv(fakeGhOnPath(out), out), stdio: ["ignore", "pipe", "inherit"] });
    let text = "";
    child.stdout.on("data", (chunk) => (text += chunk));
    child.on("error", reject);
    child.on("close", (exit) => resolve({ stdout: text, code: exit }));
  });
  writeFileSync(transcript, stdout);
  const events = stdout.split("\n").filter((l) => l.startsWith("{")).map((l) => JSON.parse(l));
  const result = events.findLast((e) => e.type === "result");
  if (code !== 0 || !result || result.is_error) throw new Error(`${name}: the agent run failed (exit ${code}), transcript ${transcript}`);
  const skills = events
    .filter((e) => e.type === "assistant")
    .flatMap((e) => e.message.content)
    .filter((c) => c.type === "tool_use" && c.name === "Skill")
    .map((c) => c.input.skill);
  const reply = result.result ?? "";
  const issuesFile = join(out, "issues.json");
  const created = existsSync(issuesFile) ? JSON.parse(readFileSync(issuesFile, "utf8")) : [];
  return { name, skills, reply, created, transcript };
}

const runs = {};
const reported = new Set();

async function runOnce(t, name) {
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
    for (const result of await Promise.all([runOnce(t, "clear"), runOnce(t, "vague")])) {
      assert.ok(result.skills.includes("ticket"), `${result.name}: ticket did not fire`);
    }
  });

  test("stays out of splitting a spec into tickets", async (t) => {
    const result = await runOnce(t, "spec");
    assert.ok(!result.skills.includes("ticket"), "spec: ticket fired");
  });

  test("clear criteria file one issue labelled ready-for-agent", async (t) => {
    const { created } = await runOnce(t, "clear");
    assert.equal(created.length, 1, "clear: expected one issue");
    assert.ok(created[0].labels.includes("ready-for-agent"), "clear: ready-for-agent missing");
  });

  // `day` lists unlabelled issues by this heading, so the heading text is the contract.
  test("vague criteria file one unlabelled issue that names what's missing", async (t) => {
    const { created } = await runOnce(t, "vague");
    assert.equal(created.length, 1, "vague: expected one issue");
    assert.deepEqual(created[0].labels, [], "vague: issue has labels");
    const [, missing] = created[0].body.split(/^## What's missing$/m);
    assert.ok(missing !== undefined, "vague: no \"## What's missing\" heading");
    assert.ok(missing.split(/^## /m)[0].trim(), "vague: \"## What's missing\" is empty");
  });

  test("replies with one line holding the issue link", async (t) => {
    for (const { name, reply, created } of await Promise.all([runOnce(t, "clear"), runOnce(t, "vague")])) {
      assert.equal(created.length, 1, `${name}: expected one issue`);
      assert.equal(reply.trim().split("\n").length, 1, `${name}: reply is not one line`);
      assert.ok(reply.includes(created[0].url), `${name}: reply lacks ${created[0].url}`);
    }
  });
});
