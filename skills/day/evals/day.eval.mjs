// Runs day's morning report in headless Claude Code, with gh, T3's t3-code MCP server and the disk and memory
// readings faked at the outer boundary, in the world fixture.mjs describes. One chain of two turns: `/day morning`,
// then the user's reply "start 1 and 3".
// From the repo root: node --test skills/day/evals/day.eval.mjs
// Needs the claude CLI signed in through environment variables (the chain gets its own config dir and HOME), plus
// git and jq. Each turn is a live agent run, so results can vary between runs.
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { BUILDS, OLD_STOP, PR, PR_HEAD, PROJECT, REPO, REPO_URL, RESTARTED, STOPPED, nightRecords, world } from "./fixture.mjs";

const evalsDir = dirname(fileURLToPath(import.meta.url));
const skillsDir = dirname(dirname(evalsDir));
const { jobs } = JSON.parse(readFileSync(join(skillsDir, "models.json"), "utf8"));
const prepModel = jobs["teammate-prep"].use.model;
const TOOLS = "Bash,Read,Write,Edit,Glob,Grep,Skill,ToolSearch,mcp__t3-code";
const SECTIONS = ["Builds to start", "Almost ready", "Review queue", "Going stale", "Late comments", "Stopped last night", "Strain"];
const GB_IN_KIB = 1e9 / 1024;

const readLog = (file) => (existsSync(file) ? readFileSync(file, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)) : []);

function script(path, body) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `#!/bin/sh\n${body}\n`);
  chmodSync(path, 0o755);
}

// The chain's world: the user's checkout of maker/app (the app project's root), HOME with the night records, the
// skills under the chain's own config dir, gh and T3 faked, and a machine with 38 GB free and normal memory.
function scratch() {
  const now = Date.now();
  const root = mkdtempSync(join(tmpdir(), "day-eval-"));
  const c = { root, now, work: join(root, "work"), home: join(root, "home"), config: join(root, "config"), fake: join(root, "fake"), bin: join(root, "bin") };
  for (const d of [c.work, c.home, c.fake, c.bin, join(c.home, "notes"), join(c.home, ".agent", "day")]) mkdirSync(d, { recursive: true });
  execFileSync("git", ["init", "-q", "-b", "main", c.work]);
  execFileSync("git", ["-C", c.work, "remote", "add", "origin", `${REPO_URL}.git`]);
  writeFileSync(join(c.fake, "world.json"), JSON.stringify(world(now)));
  for (const { name, text } of nightRecords(now)) writeFileSync(join(c.home, ".agent", "day", name), text);

  cpSync(skillsDir, join(c.config, "skills"), { recursive: true, filter: (src) => basename(src) !== "evals" });
  script(join(c.bin, "gh"), `exec "${process.execPath}" "${join(evalsDir, "fake-gh.mjs")}" "$@"`);
  script(join(c.bin, "df"), `printf 'Filesystem 1024-blocks Used Available Capacity Mounted on\\n/dev/disk3s5 971350180 751611340 ${Math.round(38 * GB_IN_KIB)} 81%% /System/Volumes/Data\\n'`);
  script(join(c.bin, "sysctl"), `echo 1`);
  script(join(c.bin, "du"), `home="$3"; printf '117187500\\t%s/Library/Developer\\n292968750\\t%s/Library\\n97656250\\t%s/code\\n500000000\\t%s\\n' "$home" "$home" "$home" "$home"`);
  c.mcp = join(root, "mcp.json");
  writeFileSync(c.mcp, JSON.stringify({ mcpServers: { "t3-code": { command: process.execPath, args: [join(evalsDir, "fake-t3.mjs")], env: { FAKE_DIR: c.fake, FAKE_HOME: c.home, FAKE_WORK: c.work, FAKE_NOW: String(now), FAKE_MODELS: join(c.config, "skills", "models.json") } } } }));
  c.env = { ...process.env, HOME: c.home, CLAUDE_CONFIG_DIR: c.config, PATH: `${c.bin}:${process.env.PATH}`, FAKE_GH_WORLD: join(c.fake, "world.json"), FAKE_GH_LOG: join(c.fake, "gh.jsonl"), GH_TOKEN: "eval-invalid", GITHUB_TOKEN: "eval-invalid", GH_PROMPT_DISABLED: "1" };
  // Drop the markers of an enclosing Claude Code session, and the other agents' homes, so each run stands alone.
  for (const key of Object.keys(c.env)) if (key === "CLAUDECODE" || key.startsWith("CLAUDE_CODE_") || ["AGENTS_HOME", "CODEX_HOME", "PI_CODING_AGENT_DIR"].includes(key)) delete c.env[key];
  return c;
}

async function turn(c, name, prompt, session) {
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
    child.on("close", (code) => (code === 0 ? resolve(seen) : reject(new Error(`${name}: claude exited ${code}`))));
  });
  const end = Date.now();
  const transcript = join(c.root, `${name}.jsonl`);
  writeFileSync(transcript, lines.map((l) => l.line).join("\n"));
  const events = lines.map(({ at, line }) => ({ at, ...JSON.parse(line) }));
  const result = events.findLast((e) => e.type === "result");
  if (!result || result.is_error) throw new Error(`${name}: the agent run failed, transcript ${transcript}`);
  const texts = events.filter((e) => e.type === "assistant").flatMap((e) => e.message.content.filter((b) => b.type === "text").map((b) => ({ at: e.at, text: b.text })));
  const t3 = readLog(join(c.fake, "t3.jsonl")).filter((e) => e.at >= start && e.at <= end);
  return { name, sessionId: result.session_id, transcript, texts, t3 };
}

let chain;
function morning() {
  if (!chain) {
    const c = scratch();
    const report = turn(c, "morning", "/day morning");
    let reply;
    chain = { c, report, reply: () => (reply ??= report.then((r) => turn(c, "reply", "start 1 and 3", r.sessionId))) };
  }
  return chain;
}

// The report is the turn's last message that links into the repository; a section starts on a line that begins
// with its name.
const reportOf = (r) => r.texts.findLast((x) => x.text.includes(`${REPO_URL}/`));
const sectionAt = (text, name) => text.search(new RegExp(`^\\W*${name}\\b`, "im"));
const sectionText = (text, name) => {
  const start = sectionAt(text, name);
  if (start < 0) return "";
  const ends = SECTIONS.map((s) => sectionAt(text, s)).filter((i) => i > start);
  return text.slice(start, ends.length ? Math.min(...ends) : undefined);
};
// The issue a numbered line of the report links to.
const issueOnLine = (text, n) => Number(new RegExp(`^\\s*${n}[.)]\\s.*?${REPO_URL}/issues/(\\d+)`, "m").exec(text)?.[1]);

const reported = new Set();
function describeTurn(t, r) {
  if (reported.has(r.name)) return;
  reported.add(r.name);
  t.diagnostic(`${r.name}: transcript ${r.transcript}`);
  t.diagnostic(`${r.name}: t3 calls ${JSON.stringify(r.t3.map(({ tool, axis, number, state, title, message }) => ({ tool, axis, number, state, title, message })))}`);
  t.diagnostic(`${r.name}: reply\n${r.texts.map((x) => x.text).join("\n\n")}`);
}

describe("day morning", { concurrency: true }, () => {
  test("the report has the seven sections in order, and leaves out an empty one", async (t) => {
    const r = await morning().report;
    describeTurn(t, r);
    const report = reportOf(r);
    assert.ok(report, `${r.name}: no report`);
    const present = SECTIONS.filter((s) => s !== "Late comments");
    const at = present.map((s) => sectionAt(report.text, s));
    present.forEach((s, i) => assert.ok(at[i] >= 0, `${r.name}: no "${s}" section`));
    assert.deepEqual([...at].sort((a, b) => a - b), at, `${r.name}: sections out of order: ${present.join(", ")}`);
    assert.equal(sectionAt(report.text, "Late comments"), -1, `${r.name}: an empty "Late comments" section`);
    const stopped = sectionText(report.text, "Stopped last night");
    assert.ok(stopped.includes(`t3-thread://v1/${STOPPED.threadId}`), `${r.name}: the run still stopped is not listed`);
    for (const gone of [RESTARTED, OLD_STOP]) assert.ok(!stopped.includes(gone.threadId), `${r.name}: lists ${gone.threadId}, restarted or from an older night`);
  });

  test("the report starts no build; the reply starts one /issue-to-pr thread per build it names", async (t) => {
    const r = await morning().report;
    describeTurn(t, r);
    assert.deepEqual(r.t3.filter((e) => e.tool === "t3_thread_launch"), [], `${r.name}: a thread was launched before any reply`);
    const report = reportOf(r);
    assert.ok(report, `${r.name}: no report`);
    const named = [1, 3].map((n) => issueOnLine(report.text, n));
    assert.ok(named.every((n) => BUILDS.includes(n)), `${r.name}: lines 1 and 3 are not builds to start: ${named}`);

    const v = await morning().reply();
    describeTurn(t, v);
    const launches = v.t3.filter((e) => e.tool === "t3_thread_launch");
    assert.equal(launches.length, 2, `${v.name}: ${launches.length} launches for two builds`);
    for (const n of named) {
      const url = `${REPO_URL}/issues/${n}`;
      const launch = launches.find((e) => e.message?.includes(url));
      assert.ok(launch, `${v.name}: no thread launched for ${url}`);
      assert.match(launch.message, new RegExp(`^/issue-to-pr ${url}\\b`), `${v.name}: #${n}'s thread does not start with /issue-to-pr`);
      assert.equal(launch.projectId, PROJECT.id, `${v.name}: #${n}'s thread is not in the project whose checkout is ${REPO}`);
      const w = launch.workspaceStrategy ?? {};
      assert.deepEqual([w.type, w.baseRef, w.startFromOrigin], ["worktree", "main", true], `${v.name}: #${n}'s thread is not in a new worktree from origin's main`);
      assert.match(w.branch ?? "", new RegExp(`^[a-z]+/${n}-[a-z0-9-]+$`), `${v.name}: #${n}'s branch is not <type>/${n}-<description>`);
    }
  });

  test("the first PR in the review queue has its prep and its guide ready when the report posts", async (t) => {
    const r = await morning().report;
    describeTurn(t, r);
    const report = reportOf(r);
    assert.ok(report, `${r.name}: no report`);
    const record = join(morning().c.home, ".agent", "pr-review", REPO.split("/")[1], `${PR}.md`);
    assert.ok(existsSync(record), `${r.name}: no prep record for #${PR}`);
    assert.ok(readFileSync(record, "utf8").includes(PR_HEAD), `${r.name}: #${PR}'s prep record is not for its head`);
    assert.ok(statSync(record).mtimeMs <= report.at, `${r.name}: #${PR}'s prep record was written after the report`);
    const written = r.t3.filter((e) => e.tool === "read_pull_request_guide" && e.number === PR && e.state === "written" && e.guideHead === PR_HEAD);
    assert.ok(written.length && written[0].at <= report.at, `${r.name}: #${PR}'s guide was not read back written for its head before the report`);
    const preps = r.t3.filter((e) => e.tool === "delegate_task" && e.axis === "prep" && e.number === PR);
    t.diagnostic(`${r.name}: prep children for #${PR} on ${prepModel}: ${preps.length}`);
  });
});
