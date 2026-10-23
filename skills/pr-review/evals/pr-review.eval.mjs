// Runs the pr-review skill in headless Claude Code on a teammate's PR, with gh, T3's t3-code MCP server and the
// autoreview helper faked at the outer boundary. Two chains run side by side. Each one reviews PR #7, says
// "approve", and then the author either pushes a fix or rebases onto a newer main before the review comes back.
// From the repo root: node --test skills/pr-review/evals/pr-review.eval.mjs
// Needs git, jq, the claude CLI signed in through environment variables (each chain gets its own config dir and
// HOME), and the outside code-review skill that scripts/sync-skills.mjs installs. Each turn is a live agent run,
// so results can vary between runs. A third chain, with T3's review guides off, runs only the first visit. A fourth
// chain is a sitting: PR #7 and a smaller layer #5 stacked on it wait on the user, who runs a bare /pr-review.
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, symlinkSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { BASE_FILES, FIX_COMMIT, HEAD_BRANCH, LAYER, LAYER_BRANCH, LAYER_COMMITS, MAIN_COMMIT, PR, PR_COMMITS, PR_URL, findingsAt } from "./fixture.mjs";

const evalsDir = dirname(fileURLToPath(import.meta.url));
const skillsDir = dirname(dirname(evalsDir));
const { jobs } = JSON.parse(readFileSync(join(skillsDir, "models.json"), "utf8"));
const reviewersModel = jobs.reviewers.use.model;
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

// One chain's world: the origin repo holding the PR, the author's clone, the user's checkout, and the fakes.
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
  pushPr(c);
  if (kind === "queue") {
    git(c.author, "checkout", "-qb", LAYER_BRANCH);
    for (const commit of LAYER_COMMITS) {
      writeFiles(c.author, commit.files);
      git(c.author, "add", ".");
      git(c.author, "commit", "-qm", commit.message);
    }
    git(c.author, "push", "-q", "origin", `HEAD:refs/heads/${LAYER_BRANCH}`, `HEAD:refs/pull/${LAYER}/head`);
    git(c.author, "checkout", "-q", HEAD_BRANCH);
  }
  git(root, "clone", "-q", c.origin, c.work);
  writeFileSync(join(c.fake, "state.json"), JSON.stringify({ origin: c.origin, phase: "first", prs: kind === "queue" ? [PR, LAYER] : [PR] }));

  cpSync(skillsDir, join(c.config, "skills"), { recursive: true, filter: (src) => basename(src) !== "evals" });
  symlinkSync(realpathSync(codeReview), join(c.config, "skills", "code-review"));
  executable(join(c.bin, "gh"), "fake-gh.mjs");
  executable(join(c.home, ".agents", "skills", "autoreview", "scripts", "autoreview"), "fake-autoreview.mjs");
  c.mcp = join(root, "mcp.json");
  writeFileSync(c.mcp, JSON.stringify({ mcpServers: { "t3-code": { command: process.execPath, args: [join(evalsDir, "fake-t3.mjs")], env: { FAKE_DIR: c.fake, FAKE_HOME: c.home, FAKE_MODELS: join(c.config, "skills", "models.json"), FAKE_GUIDES: kind === "off" ? "off" : "on" } } } }));
  c.env = { ...process.env, HOME: c.home, CLAUDE_CONFIG_DIR: c.config, PATH: `${c.bin}:${process.env.PATH}`, FAKE_DIR: c.fake, GH_TOKEN: "eval-invalid", GITHUB_TOKEN: "eval-invalid", GH_PROMPT_DISABLED: "1" };
  // Drop the markers of an enclosing Claude Code session, and the other agents' homes, so each run stands alone.
  for (const key of Object.keys(c.env)) if (key === "CLAUDECODE" || key.startsWith("CLAUDE_CODE_") || ["AGENTS_HOME", "CODEX_HOME", "PI_CODING_AGENT_DIR"].includes(key)) delete c.env[key];
  return c;
}

function pushPr(c, force = false) {
  git(c.author, "push", "-q", ...(force ? ["--force"] : []), "origin", `HEAD:refs/heads/${HEAD_BRANCH}`, `HEAD:refs/pull/${PR}/head`);
}

function setPhase(c, phase) {
  const file = join(c.fake, "state.json");
  writeFileSync(file, JSON.stringify({ ...JSON.parse(readFileSync(file, "utf8")), phase }));
}

// The author's next move after the first review: a push that fixes the findings, or a rebase that keeps the patch.
function authorMoves(c) {
  if (c.kind === "push") {
    for (const [path, [from, to]] of Object.entries(FIX_COMMIT.edit)) writeFileSync(join(c.author, path), readFileSync(join(c.author, path), "utf8").replace(from, to));
    for (const [path, text] of Object.entries(FIX_COMMIT.append)) writeFileSync(join(c.author, path), readFileSync(join(c.author, path), "utf8") + text);
    git(c.author, "commit", "-qam", FIX_COMMIT.message);
    pushPr(c);
    setPhase(c, "fixed");
  } else {
    git(c.author, "checkout", "-q", "main");
    writeFiles(c.author, MAIN_COMMIT.files);
    git(c.author, "add", ".");
    git(c.author, "commit", "-qm", MAIN_COMMIT.message);
    git(c.author, "push", "-q", "origin", "main");
    git(c.author, "checkout", "-q", HEAD_BRANCH);
    git(c.author, "rebase", "-q", "main");
    pushPr(c, true);
  }
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
    intro: intro >= 0 ? texts[intro].text : "",
    reply: texts.slice(Math.max(intro, 0)).map((t) => t.text).join("\n\n"),
    t3: during("t3.jsonl"),
    secondOpinion: during("autoreview.jsonl"),
  };
}

const chains = {};
function chain(kind) {
  if (!chains[kind] && kind === "queue") {
    const c = scratch(kind);
    chains[kind] = { first: turn(c, "sitting", "/pr-review") };
  }
  if (!chains[kind]) {
    const c = scratch(kind);
    const first = turn(c, "first-visit", `/pr-review ${PR}`);
    let back;
    chains[kind] = {
      first,
      back: () =>
        (back ??= first.then(async (visit) => {
          await turn(c, "approve", "approve", visit.sessionId);
          const seen = git(c.work, "rev-parse", "--verify", "-q", `refs/pr-review/${PR}-seen`);
          if (seen !== visit.head) throw new Error(`${kind}: "approve" left refs/pr-review/${PR}-seen at "${seen}", not ${visit.head}`);
          authorMoves(c);
          return turn(c, "return-visit", `/pr-review ${PR}`);
        })),
    };
  }
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

const reviewerTasks = (v) => v.t3.filter((e) => e.tool === "delegate_task" && e.target?.model === reviewersModel);
const reportsOf = (v, tasks) => v.t3.filter((e) => e.tool === "report" && tasks.some((d) => d.taskId === e.taskId));
const secondOpinionsAt = (v) => v.secondOpinion.filter((e) => e.head === v.head && e.base === v.base);
const axes = (entries) => [...new Set(entries.map((e) => e.axis))].sort();
// A chat tour runs from the intro to the wrap-up's Findings, and each stop is a numbered item that names a file and line.
const tourStops = (v) => v.reply.split(/^\s*(?:\d+\.\s+)?(?:#+\s*)?(?:\*\*)?Findings\b/m)[0].split("\n").filter((line) => /^\s*\d+[.)]\s.*[\w-]+\.\w+:\d+/.test(line));
const namesFile = (line, file) => line.includes(`${basename(file)}:`);
const fileLinks = (v) => [...v.reply.matchAll(/\]\(([^)\s]+)\)/g)].map(([, target]) => target).filter((t) => !/^https?:\/\//.test(t) || /\/(?:blob|tree)\//.test(t));
const guideWrites = (v) => v.t3.filter((e) => e.tool === "write_pull_request_guides" && e.number === PR && e.head === v.head);
const guideWritten = (v) => v.t3.filter((e) => e.tool === "read_pull_request_guide" && e.state === "written" && e.guideHead === v.head);
function assertGuideReady(v) {
  const writes = guideWrites(v);
  assert.ok(writes.length, `${v.name}: no write_pull_request_guides for #${PR} at ${v.head}`);
  const written = guideWritten(v);
  assert.ok(written.length, `${v.name}: no read_pull_request_guide found the guide written for ${v.head}`);
  assert.ok(v.introAt, `${v.name}: no intro opening with ${PR_URL}`);
  assert.ok(writes[0].at < v.introAt && written[0].at < v.introAt, `${v.name}: the intro came before the guide was started and read back written`);
}
// A PR's review in chat: the message that holds its link and the wrap-up's suggested verdict.
const reviewOf = (v, url) => v.texts.find((x) => x.text.includes(url) && /\bverdict\b/i.test(x.text));
const mentionAt = (text, n) => text.search(new RegExp(`(?:#|/pull/)${n}\\b`));
const firstVisits = (t) => Promise.all(["push", "rebase"].map((k) => chain(k).first)).then((vs) => (vs.forEach((v) => describeVisit(t, v)), vs));

describe("pr-review", { concurrency: true }, () => {
  test("runs /code-review's two reviewers and the second opinion, and has their reports before the intro", async (t) => {
    for (const v of await firstVisits(t)) {
      const tasks = reviewerTasks(v);
      assert.deepEqual(axes(tasks), ["spec", "standards"], `${v.name}: /code-review's two reviewers did not both run on the reviewers job`);
      const reports = reportsOf(v, tasks);
      assert.deepEqual(axes(reports), ["spec", "standards"], `${v.name}: the agent never read both reviewers' reports`);
      const second = secondOpinionsAt(v);
      assert.ok(second.length, `${v.name}: no second opinion on ${v.base}...${v.head}`);
      assert.ok(v.introAt, `${v.name}: no intro opening with ${PR_URL}`);
      const ready = Math.max(...reports.map((e) => e.at), ...second.map((e) => e.at));
      assert.ok(ready < v.introAt, `${v.name}: the intro came before both reviewers had reported`);
    }
  });

  test("starts the PR's guide in prep and reads it written for the head before the intro", async (t) => {
    for (const v of await firstVisits(t)) assertGuideReady(v);
  });

  test("with a guide, the intro points at the Guide tab and chat has no tour stops or file links, but names each P1", async (t) => {
    for (const v of await firstVisits(t)) {
      assert.ok(guideWritten(v).length, `${v.name}: no guide written for ${v.head}`);
      assert.match(v.intro, /\bGuide\b/, `${v.name}: the intro does not point at the Guide tab`);
      assert.deepEqual(tourStops(v), [], `${v.name}: tour stops in chat`);
      assert.deepEqual(fileLinks(v), [], `${v.name}: file links in chat`);
      for (const { file, priority } of findingsAt("first").filter((f) => /^P[01]$/.test(f.priority))) {
        assert.ok(v.reply.split("\n").some((line) => namesFile(line, file) && line.includes(priority)), `${v.name}: no line names ${file} with its ${priority}`);
      }
    }
  });

  test("with guides off, the chat tour has a stop for every flagged file, with its lines and function or test name", async (t) => {
    const v = await chain("off").first;
    describeVisit(t, v);
    const tried = v.t3.filter((e) => e.tool === "write_pull_request_guides" && e.number === PR && e.off);
    assert.ok(tried.length, `${v.name}: never tried to start the guide`);
    assert.ok(v.introAt && tried[0].at < v.introAt, `${v.name}: no intro after the guide failed to start`);
    const stops = tourStops(v);
    for (const { file, priority, symbol } of findingsAt("first")) {
      assert.ok(stops.some((stop) => namesFile(stop, file) && stop.includes(symbol) && stop.includes(priority)), `${v.name}: no tour stop names ${file}:<line>, ${symbol} and its ${priority}`);
    }
  });

  test("the review has no Judge line, triage block or diff block", async (t) => {
    for (const v of await firstVisits(t)) {
      assert.ok(v.introAt && /\bverdict\b/i.test(v.reply), `${v.name}: no intro and wrap-up to check`);
      const text = v.texts.map((x) => x.text).join("\n");
      assert.doesNotMatch(text, /\bJudge:/, `${v.name}: a Judge line`);
      assert.doesNotMatch(text, /^#\d+ .*\+\d+ -\d+ in \d+ files/m, `${v.name}: a triage header line`);
      assert.doesNotMatch(text, /Design lives in:/i, `${v.name}: a triage design line`);
      const fences = [...text.matchAll(/```[^\n]*\n([\s\S]*?)```/g)].map(([, body]) => body);
      const diffLike = fences.filter((body) => body.split("\n").filter((l) => /^[+-](?![+-])/.test(l)).length >= 2);
      assert.deepEqual(diffLike, [], `${v.name}: a diff block`);
    }
  });

  test("a return visit after a real push reruns both reviewers on the new head", async (t) => {
    const v = await chain("push").back();
    describeVisit(t, v);
    const tasks = reviewerTasks(v);
    assert.deepEqual(axes(tasks), ["spec", "standards"], `${v.name}: /code-review's reviewers did not rerun`);
    assert.deepEqual(axes(reportsOf(v, tasks)), ["spec", "standards"], `${v.name}: the agent never read both reviewers' reports`);
    assert.ok(secondOpinionsAt(v).length, `${v.name}: no second opinion on ${v.base}...${v.head}`);
  });

  test("a return visit rewrites the guide written for the old head before its intro", async (t) => {
    for (const kind of ["push", "rebase"]) {
      const first = await chain(kind).first;
      assert.ok(guideWritten(first).length, `${first.name}: no guide written to go stale`);
      const v = await chain(kind).back();
      describeVisit(t, v);
      assert.notEqual(v.head, first.head, `${v.name}: the head did not move`);
      assertGuideReady(v);
    }
  });

  test("with no argument, shows the queue with the stack bottom first and starts on it", async (t) => {
    const v = await chain("queue").first;
    describeVisit(t, v);
    const review = reviewOf(v, PR_URL);
    assert.ok(review, `${v.name}: no review of #${PR}`);
    const listed = v.texts.find((x) => mentionAt(x.text, PR) >= 0 && mentionAt(x.text, LAYER) >= 0);
    assert.ok(listed && listed.at <= review.at, `${v.name}: no queue naming #${PR} and #${LAYER} before the first review`);
    assert.ok(mentionAt(listed.text, PR) < mentionAt(listed.text, LAYER), `${v.name}: the queue puts #${LAYER} before #${PR}, the stack bottom it sits on`);
    const reports = reportsOf(v, reviewerTasks(v));
    assert.deepEqual(axes(reports), ["spec", "standards"], `${v.name}: /code-review's two reviewers did not report on #${PR}`);
    assert.ok(secondOpinionsAt(v).length, `${v.name}: no second opinion on ${v.base}...${v.head}`);
    assert.ok(Math.max(...reports.map((e) => e.at)) < review.at, `${v.name}: the review of #${PR} came before its reviewers reported`);
    for (const { file, priority } of findingsAt("first").filter((f) => /^P[01]$/.test(f.priority))) {
      assert.ok(review.text.split("\n").some((line) => namesFile(line, file) && line.includes(priority)), `${v.name}: no line names ${file} with its ${priority}`);
    }
  });


  test("a return visit after a pure rebase runs no reviewer", async (t) => {
    const v = await chain("rebase").back();
    describeVisit(t, v);
    assert.ok(v.introAt, `${v.name}: no review opening with ${PR_URL}`);
    assert.match(v.reply, /rebas/i, `${v.name}: the review does not say the PR was rebased`);
    assert.deepEqual(v.t3.filter((e) => e.tool === "delegate_task"), [], `${v.name}: a reviewer ran`);
    assert.deepEqual(v.secondOpinion, [], `${v.name}: the second opinion ran`);
  });
});
