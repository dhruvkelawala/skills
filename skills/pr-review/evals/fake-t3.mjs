// Stands in for T3's t3-code MCP server during the eval, over stdio: orchestrator_capabilities lists the
// models the models file names, delegate_task answers each child at once with the fixed report for its
// /code-review axis, and the two guide tools write and read each open PR's review guide, or fail every write when
// FAKE_GUIDES is "off". A child on the teammate-prep job's model is a background prep: it writes the PR's prep
// record under $FAKE_HOME, as the skill's own prep would, with the PR's fixed findings and a draft review.
// Every call, the moment each report is handed back, and what each guide read returned go to $FAKE_DIR/t3.jsonl.
import { createInterface } from "node:readline";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { HEAD_BRANCH, LAYER, LAYER_FINDING, LAYER_TITLE, LAYER_URL, OWNER, PR, PR_TITLE, PR_URL, REPO, findingsFor } from "./fixture.mjs";

const dir = process.env.FAKE_DIR;
const guidesOff = process.env.FAKE_GUIDES === "off";
const { jobs } = JSON.parse(readFileSync(process.env.FAKE_MODELS, "utf8"));
const prepModel = jobs["teammate-prep"].use.model;
const log = (entry) => appendFileSync(join(dir, "t3.jsonl"), `${JSON.stringify({ at: Date.now(), ...entry })}\n`);
const state = () => JSON.parse(readFileSync(join(dir, "state.json"), "utf8"));
const phase = () => state().phase;
const openPrs = () => state().prs ?? [PR];
const PRS = {
  [PR]: { url: PR_URL, title: PR_TITLE, base: "main" },
  [LAYER]: { url: LAYER_URL, title: LAYER_TITLE, base: HEAD_BRANCH },
};

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

// Guides outlive one agent run, so they are kept in $FAKE_DIR/guide.json, by PR. A write starts a run for the
// PR's current head; the first read after it still finds the run going, and the next read finds the guide written.
const guideFile = join(dir, "guide.json");
const loadGuide = (n) => (existsSync(guideFile) ? JSON.parse(readFileSync(guideFile, "utf8")) : {})[n] ?? { guide: null, run: null };
const saveGuide = (n, g) => writeFileSync(guideFile, JSON.stringify({ ...(existsSync(guideFile) ? JSON.parse(readFileSync(guideFile, "utf8")) : {}), [n]: g }));
const git = (...a) => execFileSync("git", ["-C", state().origin, ...a], { encoding: "utf8" });
const currentHead = (n) => git("rev-parse", `refs/pull/${n}/head`).trim();
const prNumber = (ref) => ref?.number ?? Number(/\/pull\/(\d+)/.exec(ref?.url ?? "")?.[1]);
const prRef = { type: "object", properties: { url: { type: "string" }, number: { type: "integer" }, repository: { type: "string" }, host: { type: "string" } } };
const guideStops = {
  [PR]: [
    { title: "withRetry's loop and when it gives up", path: "src/retry.js", startLine: 4, endLine: 13 },
    { title: "fetchJson now goes through withRetry", path: "src/client.js", startLine: 5, endLine: 11 },
    { title: "The retry settings", path: "src/config.js", startLine: 1, endLine: 1 },
    { title: "The retry test", path: "test/retry.test.js", startLine: 5, endLine: 14 },
  ],
  [LAYER]: [
    { title: "The log line", path: "src/log.js", startLine: 2, endLine: 4 },
    { title: "withRetry calls onRetry before each wait", path: "src/retry.js", startLine: 10, endLine: 10 },
  ],
};

// What the skill's own prep leaves for a PR: the prep record, with its head, patch ID, sorted findings and a
// draft of the intro and wrap-up.
function prepare(n) {
  const head = currentHead(n);
  const base = git("rev-parse", `refs/heads/${PRS[n].base}`).trim();
  const patchId = execFileSync("git", ["patch-id", "--stable"], { input: git("diff", `${base}...${head}`), encoding: "utf8" }).split(" ")[0];
  const findings = n === LAYER ? [LAYER_FINDING] : ["spec", "standards", "autoreview"].flatMap((r) => findingsFor(r, phase()).map((f) => ({ ...f, reviewer: r === "autoreview" ? "second opinion" : r === "spec" ? "Spec" : "Standards" })));
  const line = (f) => `- **${f.priority}**, ${f.reviewer}: \`${f.file}:${f.line}\`, \`${f.symbol}\`: ${f.title}. ${f.body}`;
  const record = join(process.env.FAKE_HOME, ".agent", "pr-review", REPO, `${n}.md`);
  mkdirSync(join(record, ".."), { recursive: true });
  writeFileSync(record, [
    `# ${OWNER}/${REPO}#${n} ${PRS[n].title}`, "", `head: ${head}`, `base: ${base}`, `patch-id: ${patchId}`,
    `reported: /code-review Spec and Standards, and the second opinion, all at ${head}`, "",
    "## Findings", "", ...findings.map((f) => `${line(f)} Sorted: ${f.priority}.`), "",
    "## Draft", "", PRS[n].url, "", "The tour is in the Guide tab of the PR panel.", "",
    `${PRS[n].title}.`, "", "**Findings**", "", ...findings.filter((f) => /^P[01]$/.test(f.priority)).map(line), "",
    `**Suggested verdict:** ${findings.some((f) => /^P[01]$/.test(f.priority)) ? "request changes, for the P1" : "approve"}.`, "",
  ].join("\n"));
  return `Prepped #${n} at ${head}. Prep record: ${record}. ${findings.length} finding(s), drafted review in the record.`;
}

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
      const text = `${input.title ?? ""}\n${input.task}`;
      const mentions = openPrs().filter((n) => new RegExp(`(?:#|/pull/|\\bPR )${n}\\b`).test(text));
      if (input.target?.model === prepModel) {
        const number = [...text.matchAll(/\/pull\/(\d+)\b/g)].map(([, n]) => Number(n)).find((n) => openPrs().includes(n)) ?? mentions[0];
        tasks.set(taskId, { axis: "prep", summary: number ? prepare(number) : "No PR named to prep.", delivered: false });
        log({ tool: "delegate_task", taskId, axis: "prep", number: number ?? null, mentions, target: input.target, mode: input.mode ?? "async", title: input.title ?? null });
      } else {
        const axis = axisOf(input.task);
        tasks.set(taskId, { axis, summary: report(axis, findingsFor(axis, phase())), delivered: false });
        log({ tool: "delegate_task", taskId, axis, mentions, target: input.target ?? null, mode: input.mode ?? "async", title: input.title ?? null });
      }
      const base = { taskId, childThreadId: `child-${taskId}`, providerInstanceId: input.target?.providerInstanceId ?? "claudeAgent", model: input.target?.model ?? null };
      return input.mode === "wait" ? { ...base, ...deliver(taskId) } : { ...base, status: "running", workState: "working" };
    },
  },
  write_pull_request_guides: {
    description: "Write review guides for up to 20 pull requests, the tour a maintainer reads in a pull request's Guide tab. Each run reads its change in a temporary checkout and takes minutes, so this returns once the runs are under way; read a guide with read_pull_request_guide to see when it is written. A guide for the same head that is already running is joined, not restarted; a pull request whose guide is current is written again. Fails while review guides are off on this server.",
    inputSchema: { type: "object", properties: { pullRequests: { type: "array", items: prRef, minItems: 1, maxItems: 20 } }, required: ["pullRequests"] },
    call: ({ pullRequests = [] }) => {
      const numbers = pullRequests.map(prNumber);
      const known = numbers.filter((n) => openPrs().includes(n));
      if (guidesOff) {
        for (const n of known) log({ tool: "write_pull_request_guides", numbers, number: n, head: currentHead(n), off: true });
        throw new Error("Review guides are off on this server.");
      }
      const started = known.map((n) => {
        const head = currentHead(n);
        const g = loadGuide(n);
        const joined = g.run?._tag === "Running" && g.run.headSha === head;
        if (!joined) saveGuide(n, { ...g, run: { _tag: "Running", headSha: head, startedAt: new Date().toISOString(), reads: 0 } });
        log({ tool: "write_pull_request_guides", numbers, number: n, head, joined });
        return { number: n, url: PRS[n].url, headSha: head, run: joined ? "joined" : "started" };
      });
      return { pullRequests: numbers.map((n) => started.find((x) => x.number === n) ?? { number: n, error: `no pull request #${n} in ${OWNER}/${REPO}` }) };
    },
  },
  read_pull_request_guide: {
    description: "Read a pull request's stored review guide and its run: run.Running while one is being written, run.Failed with the reason when the last one failed, guide null when none was written. stale is true after a push the guide has not caught up with. Never starts a run.",
    inputSchema: prRef,
    call: (ref) => {
      const n = prNumber(ref);
      if (!openPrs().includes(n)) return { error: `no pull request #${n} in ${OWNER}/${REPO}` };
      const head = currentHead(n);
      const g = loadGuide(n);
      if (g.run?._tag === "Running" && g.run.reads++ > 0) {
        g.guide = { headSha: g.run.headSha, writtenAt: new Date().toISOString(), stops: guideStops[n] };
        g.run = { _tag: "Completed", headSha: g.run.headSha, completedAt: g.guide.writtenAt };
      }
      saveGuide(n, g);
      const stale = Boolean(g.guide && g.guide.headSha !== head);
      const seen = g.run?._tag === "Running" ? "running" : !g.guide ? "none" : stale ? "stale" : "written";
      log({ tool: "read_pull_request_guide", number: n, head, state: seen, guideHead: g.guide?.headSha ?? null });
      const { reads, ...run } = g.run ?? {};
      return { host: "github.com", repository: `${OWNER}/${REPO}`, number: n, url: PRS[n].url, guide: g.guide, run: g.run ? run : null, currentHeadSha: head, stale };
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
