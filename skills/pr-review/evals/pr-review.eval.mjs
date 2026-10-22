// Runs the pr-review skill in headless Claude Code on a teammate's PR, with gh, T3's t3-code MCP server and the
// autoreview helper faked at the outer boundary. Two first visits to PR #7 run side by side.
// From the repo root: node --test skills/pr-review/evals/pr-review.eval.mjs
// Needs git, jq, the claude CLI signed in through environment variables (each run gets its own config dir and
// HOME), and the outside code-review skill that scripts/sync-skills.mjs installs. Each turn is a live agent run,
// so results can vary between runs.
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, symlinkSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { BASE_FILES, HEAD_BRANCH, PR, PR_COMMITS, PR_URL } from "./fixture.mjs";

const evalsDir = dirname(fileURLToPath(import.meta.url));
const skillsDir = dirname(dirname(evalsDir));
const codeReview = join(homedir(), ".agents", "skills", "code-review");
const TOOLS = "Bash,Read,Write,Edit,Glob,Grep,Skill,ToolSearch,mcp__t3-code";

const git = (cwd, ...a) => execFileSync("git", ["-c", "user.name=eval", "-c", "user.email=eval@example.com", ...a], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const readLog = (file) => (existsSync(file) ? readFileSync(file, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)) : []);

function writeFiles(root, files) {
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
}

function executable(path, script) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `#!/bin/sh\nexec "${process.execPath}" "${join(evalsDir, script)}" "$@"\n`);
  chmodSync(path, 0o755);
}

// One run's world: the origin repo holding the PR, the author's clone, the user's checkout, and the fakes.
function scratch(kind) {
  if (!existsSync(join(codeReview, "SKILL.md"))) throw new Error(`no code-review skill at ${codeReview}; run scripts/sync-skills.mjs`);
  const root = mkdtempSync(join(tmpdir(), `pr-review-eval-${kind}-`));
  const c = { kind, root, origin: join(root, "origin.git"), author: join(root, "author"), work: join(root, "work"), home: join(root, "home"), config: join(root, "config"), fake: join(root, "fake"), bin: join(root, "bin") };
  for (const d of [c.author, c.home, c.fake, c.bin]) mkdirSync(d, { recursive: true });
  git(root, "init", "-q", "--bare", "-b", "main", c.origin);
  git(c.author, "init", "-q", "-b", "main");
  git(c.author, "remote", "add", "origin", c.origin);
  writeFiles(c.author, BASE_FILES);
  git(c.author, "add", ".");
  git(c.author, "commit", "-qm", "init");
  git(c.author, "push", "-q", "origin", "main");
  git(c.author, "checkout", "-qb", HEAD_BRANCH);
  for (const commit of PR_COMMITS) {
    writeFiles(c.author, commit.files);
    git(c.author, "add", ".");
    git(c.author, "commit", "-qm", commit.message);
  }
  git(c.author, "push", "-q", "origin", `HEAD:refs/heads/${HEAD_BRANCH}`, `HEAD:refs/pull/${PR}/head`);
  git(root, "clone", "-q", c.origin, c.work);
  writeFileSync(join(c.fake, "state.json"), JSON.stringify({ origin: c.origin, phase: "first" }));

  cpSync(skillsDir, join(c.config, "skills"), { recursive: true, filter: (src) => basename(src) !== "evals" });
  symlinkSync(realpathSync(codeReview), join(c.config, "skills", "code-review"));
  executable(join(c.bin, "gh"), "fake-gh.mjs");
  executable(join(c.home, ".agents", "skills", "autoreview", "scripts", "autoreview"), "fake-autoreview.mjs");
  c.mcp = join(root, "mcp.json");
  writeFileSync(c.mcp, JSON.stringify({ mcpServers: { "t3-code": { command: process.execPath, args: [join(evalsDir, "fake-t3.mjs")], env: { FAKE_DIR: c.fake, FAKE_MODELS: join(c.config, "skills", "models.json") } } } }));
  c.env = { ...process.env, HOME: c.home, CLAUDE_CONFIG_DIR: c.config, PATH: `${c.bin}:${process.env.PATH}`, FAKE_DIR: c.fake, GH_TOKEN: "eval-invalid", GITHUB_TOKEN: "eval-invalid", GH_PROMPT_DISABLED: "1" };
  // Drop the markers of an enclosing Claude Code session, and the other agents' homes, so each run stands alone.
  for (const key of Object.keys(c.env)) if (key === "CLAUDECODE" || key.startsWith("CLAUDE_CODE_") || ["AGENTS_HOME", "CODEX_HOME", "PI_CODING_AGENT_DIR"].includes(key)) delete c.env[key];
  return c;
}

async function turn(c, name, prompt, session) {
  const base = git(c.origin, "rev-parse", "main");
  const head = git(c.origin, "rev-parse", `refs/pull/${PR}/head`);
  const args = ["-p", prompt, "--output-format", "stream-json", "--verbose", "--allowedTools", TOOLS, "--mcp-config", c.mcp, "--strict-mcp-config", "--add-dir", c.home, ...(session ? ["--resume", session] : [])];
  const start = Date.now();
  const lines = await new Promise((resolve, reject) => {
    const child = spawn("claude", args, { cwd: c.work, env: c.env, stdio: ["ignore", "pipe", "inherit"] });
    const seen = [];
    let buffer = "";
    child.stdout.on("data", (chunk) => {
      const parts = (buffer + chunk).split("\n");
      buffer = parts.pop();
      for (const line of parts) if (line.startsWith("{")) seen.push({ at: Date.now(), line });
    });
    child.on("error", reject);
    child.on("close", (code) => (code === 0 ? resolve(seen) : reject(new Error(`${c.kind} ${name}: claude exited ${code}`))));
  });
  const end = Date.now();
  const transcript = join(c.root, `${name}.jsonl`);
  writeFileSync(transcript, lines.map((l) => l.line).join("\n"));
  const events = lines.map(({ at, line }) => ({ at, ...JSON.parse(line) }));
  const result = events.findLast((e) => e.type === "result");
  if (!result || result.is_error) throw new Error(`${c.kind} ${name}: the agent run failed, transcript ${transcript}`);
  const texts = events.filter((e) => e.type === "assistant").flatMap((e) => e.message.content.filter((b) => b.type === "text").map((b) => ({ at: e.at, text: b.text })));
  // The intro opens the review with the PR link; a short status line that mentions the link is not one.
  const intro = texts.findIndex((t) => t.text.includes(PR_URL) && t.text.length >= 200);
  const during = (log) => readLog(join(c.fake, log)).filter((e) => e.at >= start && e.at <= end);
  return {
    name: `${c.kind} ${name}`,
    base,
    head,
    sessionId: result.session_id,
    transcript,
    texts,
    introAt: intro >= 0 ? texts[intro].at : undefined,
    reply: texts.slice(Math.max(intro, 0)).map((t) => t.text).join("\n\n"),
    t3: during("t3.jsonl"),
    secondOpinion: during("autoreview.jsonl"),
  };
}

const chains = {};
function chain(kind) {
  if (!chains[kind]) chains[kind] = { first: turn(scratch(kind), "first-visit", `/pr-review ${PR}`) };
  return chains[kind];
}

const reported = new Set();
function describeVisit(t, v) {
  if (reported.has(v.name)) return;
  reported.add(v.name);
  t.diagnostic(`${v.name}: transcript ${v.transcript}`);
  t.diagnostic(`${v.name}: t3 calls ${JSON.stringify(v.t3.map(({ tool, axis, target, mode }) => ({ tool, axis, model: target?.model, mode })))}`);
  t.diagnostic(`${v.name}: second opinion runs ${JSON.stringify(v.secondOpinion.map(({ args, head, base }) => ({ args, head, base })))}`);
  t.diagnostic(`${v.name}: review\n${v.reply}`);
}

const firstVisits = (t) => Promise.all(["push", "rebase"].map((k) => chain(k).first)).then((vs) => (vs.forEach((v) => describeVisit(t, v)), vs));

describe("pr-review", { concurrency: true }, () => {
  test("the review has no Judge line, triage block or diff block", async (t) => {
    for (const v of await firstVisits(t)) {
      const text = v.texts.map((x) => x.text).join("\n");
      assert.doesNotMatch(text, /\bJudge:/, `${v.name}: a Judge line`);
      assert.doesNotMatch(text, /^#\d+ .*\+\d+ -\d+ in \d+ files/m, `${v.name}: a triage header line`);
      assert.doesNotMatch(text, /Design lives in:/i, `${v.name}: a triage design line`);
      const fences = [...text.matchAll(/```[^\n]*\n([\s\S]*?)```/g)].map(([, body]) => body);
      const diffLike = fences.filter((body) => body.split("\n").filter((l) => /^[+-](?![+-])/.test(l)).length >= 2);
      assert.deepEqual(diffLike, [], `${v.name}: a diff block`);
    }
  });

});
