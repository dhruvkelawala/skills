// Stands in for T3's t3-code MCP server during the eval, over stdio: orchestrator_capabilities lists the
// models the models file names, delegate_task answers each child at once with the fixed report for its
// /code-review axis, and the two guide tools write and read PR #7's review guide, or fail every write when
// FAKE_GUIDES is "off". Every call, the moment each report is handed back, and what each guide read returned go to
// $FAKE_DIR/t3.jsonl.
import { createInterface } from "node:readline";
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { OWNER, PR, PR_URL, REPO, findingsFor } from "./fixture.mjs";

const dir = process.env.FAKE_DIR;
const guidesOff = process.env.FAKE_GUIDES === "off";
const { jobs } = JSON.parse(readFileSync(process.env.FAKE_MODELS, "utf8"));
const log = (entry) => appendFileSync(join(dir, "t3.jsonl"), `${JSON.stringify({ at: Date.now(), ...entry })}\n`);
const state = () => JSON.parse(readFileSync(join(dir, "state.json"), "utf8"));
const phase = () => state().phase;

const entries = Object.values(jobs).flatMap((job) => Object.values(job).filter((e) => e?.driver));
const models = (driver) => [...new Set(entries.filter((e) => e.driver === driver).map((e) => e.model))];
const effort = { id: "effort", label: "Reasoning", type: "select", options: ["low", "medium", "high", "xhigh", "max"].map((id) => ({ id, label: id })) };
const PROVIDERS = [
  { providerInstanceId: "claudeAgent", driverKind: "claudeAgent", displayName: "Claude", models: models("claudeAgent") },
  { providerInstanceId: "codex", driverKind: "codex", displayName: "Codex", models: models("codex") },
].map((p) => ({ ...p, canRunChildTask: true, canRunCrossProviderChildTask: true, constraints: {}, models: p.models.map((id) => ({ id, label: id, options: [effort] })) }));

// /code-review's Spec brief asks for scope creep; its Standards brief carries the smell baseline.
const axisOf = (task) => (/scope creep/i.test(task) ? "spec" : /smell|standard/i.test(task) ? "standards" : "spec");
const report = (axis, findings) =>
  findings.length
    ? `## ${axis === "spec" ? "Spec" : "Standards"}\n\n${findings.map((f) => `- **${f.priority}** \`${f.file}:${f.line}\`: ${f.title}. ${f.body}`).join("\n")}`
    : `## ${axis === "spec" ? "Spec" : "Standards"}\n\nNo findings.`;

// The guide outlives one agent run, so it is kept in $FAKE_DIR/guide.json. A write starts a run for the PR's
// current head; the first read after it still finds the run going, and the next read finds the guide written.
const guideFile = join(dir, "guide.json");
const loadGuide = () => (existsSync(guideFile) ? JSON.parse(readFileSync(guideFile, "utf8")) : { guide: null, run: null });
const saveGuide = (g) => writeFileSync(guideFile, JSON.stringify(g));
const currentHead = () => execFileSync("git", ["-C", state().origin, "rev-parse", `refs/pull/${PR}/head`], { encoding: "utf8" }).trim();
const prNumber = (ref) => ref?.number ?? Number(/\/pull\/(\d+)/.exec(ref?.url ?? "")?.[1]);
const prRef = { type: "object", properties: { url: { type: "string" }, number: { type: "integer" }, repository: { type: "string" }, host: { type: "string" } } };
const guideStops = [
  { title: "withRetry's loop and when it gives up", path: "src/retry.js", startLine: 4, endLine: 13 },
  { title: "fetchJson now goes through withRetry", path: "src/client.js", startLine: 5, endLine: 11 },
  { title: "The retry settings", path: "src/config.js", startLine: 1, endLine: 1 },
  { title: "The retry test", path: "test/retry.test.js", startLine: 5, endLine: 14 },
];

const tasks = new Map();
const TOOLS = {
  orchestrator_capabilities: {
    description: "List the provider instances and their models.",
    inputSchema: { type: "object", properties: {} },
    call: () => ({ parentThreadId: "eval-thread", inheritedProviderInstanceId: "claudeAgent", runtimeMode: "full-access", providers: PROVIDERS, features: { appOwnedSubagents: true, asyncPolling: true } }),
  },
  delegate_task: {
    description: "Delegate one task to a child agent of this thread, run with only the task prompt. mode 'wait' returns the child's result; mode 'async' (the default) returns a taskId whose result task_status reads.",
    inputSchema: {
      type: "object",
      properties: {
        task: { type: "string" },
        title: { type: "string" },
        mode: { type: "string", enum: ["async", "wait"] },
        target: { type: "object", properties: { providerInstanceId: { type: "string" }, model: { type: "string" }, options: {} } },
        role: { type: "string" },
        clientRequestId: { type: "string" },
      },
      required: ["task"],
    },
    call: (input) => {
      const taskId = `task-${tasks.size + 1}`;
      const axis = axisOf(input.task);
      tasks.set(taskId, { axis, summary: report(axis, findingsFor(axis, phase())), delivered: false });
      log({ tool: "delegate_task", taskId, axis, target: input.target ?? null, mode: input.mode ?? "async", title: input.title ?? null });
      const base = { taskId, childThreadId: `child-${taskId}`, providerInstanceId: input.target?.providerInstanceId ?? "claudeAgent", model: input.target?.model ?? null };
      return input.mode === "wait" ? { ...base, ...deliver(taskId) } : { ...base, status: "running", workState: "working" };
    },
  },
  write_pull_request_guides: {
    description: "Write review guides for up to 20 pull requests, the tour a maintainer reads in a pull request's Guide tab. Each run reads its change in a temporary checkout and takes minutes, so this returns once the runs are under way; read a guide with read_pull_request_guide to see when it is written. A guide for the same head that is already running is joined, not restarted; a pull request whose guide is current is written again. Fails while review guides are off on this server.",
    inputSchema: { type: "object", properties: { pullRequests: { type: "array", items: prRef, minItems: 1, maxItems: 20 } }, required: ["pullRequests"] },
    call: ({ pullRequests = [] }) => {
      const numbers = pullRequests.map(prNumber);
      const head = currentHead();
      if (guidesOff) {
        log({ tool: "write_pull_request_guides", numbers, number: numbers.includes(PR) ? PR : null, head, off: true });
        throw new Error("Review guides are off on this server.");
      }
      const g = loadGuide();
      const joined = g.run?._tag === "Running" && g.run.headSha === head;
      if (numbers.includes(PR) && !joined) saveGuide({ ...g, run: { _tag: "Running", headSha: head, startedAt: new Date().toISOString(), reads: 0 } });
      log({ tool: "write_pull_request_guides", numbers, number: numbers.includes(PR) ? PR : null, head, joined });
      return { pullRequests: numbers.map((n) => (n === PR ? { number: PR, url: PR_URL, headSha: head, run: joined ? "joined" : "started" } : { number: n, error: `no pull request #${n} in ${OWNER}/${REPO}` })) };
    },
  },
  read_pull_request_guide: {
    description: "Read a pull request's stored review guide and its run: run.Running while one is being written, run.Failed with the reason when the last one failed, guide null when none was written. stale is true after a push the guide has not caught up with. Never starts a run.",
    inputSchema: prRef,
    call: (ref) => {
      if (prNumber(ref) !== PR) return { error: `no pull request #${prNumber(ref)} in ${OWNER}/${REPO}` };
      const head = currentHead();
      const g = loadGuide();
      if (g.run?._tag === "Running" && g.run.reads++ > 0) {
        g.guide = { headSha: g.run.headSha, writtenAt: new Date().toISOString(), stops: guideStops };
        g.run = { _tag: "Completed", headSha: g.run.headSha, completedAt: g.guide.writtenAt };
      }
      saveGuide(g);
      const stale = Boolean(g.guide && g.guide.headSha !== head);
      const seen = g.run?._tag === "Running" ? "running" : !g.guide ? "none" : stale ? "stale" : "written";
      log({ tool: "read_pull_request_guide", number: PR, head, state: seen, guideHead: g.guide?.headSha ?? null });
      const { reads, ...run } = g.run ?? {};
      return { host: "github.com", repository: `${OWNER}/${REPO}`, number: PR, url: PR_URL, guide: g.guide, run: g.run ? run : null, currentHeadSha: head, stale };
    },
  },
  task_status: {
    description: "Read a delegated task: its state and, once done, its summary.",
    inputSchema: { type: "object", properties: { taskId: { type: "string" } }, required: ["taskId"] },
    call: ({ taskId }) => (tasks.has(taskId) ? { taskId, ...deliver(taskId) } : { error: `unknown task ${taskId}` }),
  },
};

function deliver(taskId) {
  const task = tasks.get(taskId);
  if (!task.delivered) log({ tool: "report", taskId, axis: task.axis });
  task.delivered = true;
  return { status: "completed", workState: "result_available", summary: task.summary };
}

const send = (message) => process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", ...message })}\n`);
createInterface({ input: process.stdin }).on("line", (line) => {
  const { id, method, params } = JSON.parse(line);
  if (method === "initialize") send({ id, result: { protocolVersion: params.protocolVersion, capabilities: { tools: {} }, serverInfo: { name: "t3-code", version: "eval" } } });
  else if (method === "tools/list") send({ id, result: { tools: Object.entries(TOOLS).map(([name, t]) => ({ name, description: t.description, inputSchema: t.inputSchema })) } });
  else if (method === "tools/call") {
    const tool = TOOLS[params.name];
    let text, isError = !tool;
    try {
      text = JSON.stringify(tool ? tool.call(params.arguments ?? {}) : { error: `unknown tool ${params.name}` });
    } catch (err) {
      [text, isError] = [err.message, true];
    }
    send({ id, result: { content: [{ type: "text", text }], isError } });
  } else if (id !== undefined) send({ id, result: {} });
});
