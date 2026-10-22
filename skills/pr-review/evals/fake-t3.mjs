// Stands in for T3's t3-code MCP server during the eval, over stdio: orchestrator_capabilities lists the
// models the models file names, and delegate_task answers each child at once with the fixed report for its
// /code-review axis. Every call, and the moment each report is handed back, goes to $FAKE_DIR/t3.jsonl.
import { createInterface } from "node:readline";
import { appendFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { findingsFor } from "./fixture.mjs";

const dir = process.env.FAKE_DIR;
const { jobs } = JSON.parse(readFileSync(process.env.FAKE_MODELS, "utf8"));
const log = (entry) => appendFileSync(join(dir, "t3.jsonl"), `${JSON.stringify({ at: Date.now(), ...entry })}\n`);
const phase = () => JSON.parse(readFileSync(join(dir, "state.json"), "utf8")).phase;

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
    const result = tool ? tool.call(params.arguments ?? {}) : { error: `unknown tool ${params.name}` };
    send({ id, result: { content: [{ type: "text", text: JSON.stringify(result) }], isError: !tool } });
  } else if (id !== undefined) send({ id, result: {} });
});
