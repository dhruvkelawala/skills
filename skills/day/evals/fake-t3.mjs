// Stands in for T3's t3-code MCP server during day's eval, over stdio. It knows two projects (app, whose checkout's
// origin is maker/app, and notes, which is not a git checkout), the threads the night records name with their runs,
// and maker/app's two open PRs with their review guides. A delegate_task on the teammate-prep job's model is the
// queue's first PR being prepped as pr-review's background prep does it: the child starts the PR's guide at once,
// and when it is collected (task_status, or mode "wait") it has written the prep record under $FAKE_HOME and its
// guide is written for the PR's head, as pr-review's prep finishes only then. Any other child reports no findings.
// Every call, and the moment a child's result is collected, go to $FAKE_DIR/t3.jsonl. Guides, tasks and launches
// outlive one agent run, so they are kept in $FAKE_DIR/t3-state.json.
import { createInterface } from "node:readline";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CONTINUED, LAYER, LAYER_HEAD, OLD_STOP, PR, PR_HEAD, PROJECT, REPO, REPO_URL, RESTARTED, STOPPED, threadRuns } from "./fixture.mjs";

const dir = process.env.FAKE_DIR;
const home = process.env.FAKE_HOME;
const work = process.env.FAKE_WORK;
const now = Number(process.env.FAKE_NOW);
const { jobs } = JSON.parse(readFileSync(process.env.FAKE_MODELS, "utf8"));
const prepModel = jobs["teammate-prep"].use.model;
const log = (entry) => appendFileSync(join(dir, "t3.jsonl"), `${JSON.stringify({ at: Date.now(), ...entry })}\n`);
const stateFile = join(dir, "t3-state.json");
const load = () => (existsSync(stateFile) ? JSON.parse(readFileSync(stateFile, "utf8")) : { guides: {}, tasks: {}, launches: 0 });
const save = (s) => writeFileSync(stateFile, JSON.stringify(s, null, 2));

const PRS = { [PR]: { url: `${REPO_URL}/pull/${PR}`, head: PR_HEAD }, [LAYER]: { url: `${REPO_URL}/pull/${LAYER}`, head: LAYER_HEAD } };
const prNumber = (ref) => ref?.number ?? Number(/\/pull\/(\d+)/.exec(ref?.url ?? "")?.[1]);
const prRef = { type: "object", properties: { url: { type: "string" }, number: { type: "integer" }, repository: { type: "string" }, host: { type: "string" } } };

const entries = Object.values(jobs).flatMap((job) => Object.values(job).filter((e) => e?.driver));
const models = (driver) => [...new Set(entries.filter((e) => e.driver === driver).map((e) => e.model))];
const effort = { id: "effort", label: "Reasoning", type: "select", options: ["low", "medium", "high", "xhigh", "max"].map((id) => ({ id, label: id })) };
const PROVIDERS = [
  { providerInstanceId: "claudeAgent", driverKind: "claudeAgent", displayName: "Claude", models: models("claudeAgent") },
  { providerInstanceId: "codex", driverKind: "codex", displayName: "Codex", models: models("codex") },
].map((p) => ({ ...p, canRunChildTask: true, canRunCrossProviderChildTask: true, constraints: {}, models: p.models.map((id) => ({ id, label: id, options: [effort] })) }));

const iso = (ms) => new Date(ms).toISOString();
const THREADS = [STOPPED, RESTARTED, OLD_STOP, CONTINUED].map((t) => ({ ...t, projectId: PROJECT.id }));
function threadOf(threadId) {
  const t = THREADS.find((x) => x.threadId === threadId);
  if (!t) return null;
  const runs = threadRuns(now)[threadId];
  const latest = runs[0];
  return {
    threadId, projectId: t.projectId, title: t.title, createdBy: "agent", status: latest.status, latestRunId: latest.runId,
    activeRunId: latest.status === "running" ? latest.runId : null, pullRequests: [], branch: null, worktreePath: null,
    runCount: runs.length, pendingRequestCount: 0, archived: false, settled: false, snoozed: false,
    createdAt: iso(now - 5 * 24 * 60 * 60 * 1000), updatedAt: latest.completedAt ?? latest.startedAt,
  };
}

function startGuide(s, n) {
  const g = s.guides[n] ?? { guide: null, run: null };
  const head = PRS[n].head;
  const joined = g.run?._tag === "Running" && g.run.headSha === head;
  if (!joined) s.guides[n] = { ...g, run: { _tag: "Running", headSha: head, startedAt: new Date().toISOString() } };
  return joined;
}

function finishGuide(s, n) {
  const writtenAt = new Date().toISOString();
  s.guides[n] = { guide: { headSha: PRS[n].head, writtenAt, stops: [{ title: "withRetry's loop", path: "src/retry.js", startLine: 4, endLine: 13 }] }, run: { _tag: "Completed", headSha: PRS[n].head, completedAt: writtenAt } };
}

// What pr-review's prep leaves for a PR: its record, with the head, who reported, the sorted findings and a draft.
function writePrepRecord(n) {
  const path = join(home, ".agent", "pr-review", REPO.split("/")[1], `${n}.md`);
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, `# Prep record: ${REPO}#${n}

head: ${PRS[n].head}
patch ID: 0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f
reviewers reported: Standards, Spec, second opinion
guide: written for ${PRS[n].head}

## Findings
- P1, second opinion, src/retry.js:12: the loop retries a 4xx forever. Sorted: P1.
- P2, Standards, src/config.js:1: the retry count is a bare number. Sorted: style and smell.

## Draft
Intro: ${PRS[n].url}. The tour is in the Guide tab. withRetry wraps fetchJson and retries a 503 three times.
Wrap-up: P1 at src/retry.js:12 (second opinion). Suggested verdict: request changes, for the P1.
`);
  return path;
}

function collect(taskId) {
  const s = load();
  const task = s.tasks[taskId];
  if (!task.delivered) {
    if (task.axis === "prep") {
      task.record = writePrepRecord(task.number);
      finishGuide(s, task.number);
    }
    task.delivered = true;
    save(s);
    log({ tool: "report", taskId, axis: task.axis, number: task.number });
  }
  const summary = task.axis === "prep" ? `Prepped ${PRS[task.number].url} at ${PRS[task.number].head}. Prep record: ${task.record}. Guide written for the head.` : "No findings.";
  return { status: "completed", workState: "result_available", summary };
}

const TOOLS = {
  orchestrator_capabilities: {
    description: "List the provider instances and models that can run delegated child tasks.",
    inputSchema: { type: "object", properties: {} },
    call: () => (log({ tool: "orchestrator_capabilities" }), { providers: PROVIDERS }),
  },
  delegate_task: {
    description: "Start a delegated child task on a provider instance and model. mode 'async' returns at once with a taskId; read it with task_status. mode 'wait' returns when the child finishes.",
    inputSchema: {
      type: "object",
      properties: { task: { type: "string" }, target: { type: "object", properties: { providerInstanceId: { type: "string" }, model: { type: "string" }, options: { type: "object" } } }, mode: { type: "string", enum: ["async", "wait"] }, clientRequestId: { type: "string" }, title: { type: "string" } },
      required: ["task"],
    },
    call: (input) => {
      const s = load();
      const taskId = `task-${Object.keys(s.tasks).length + 1}`;
      const number = prNumber({ url: input.task ?? "" });
      const axis = input.target?.model === prepModel && PRS[number] ? "prep" : "other";
      s.tasks[taskId] = { axis, number, delivered: false };
      if (axis === "prep") startGuide(s, number);
      save(s);
      log({ tool: "delegate_task", taskId, axis, number, target: input.target ?? null, mode: input.mode ?? "async" });
      const base = { taskId, childThreadId: `child-${taskId}`, providerInstanceId: input.target?.providerInstanceId ?? "claudeAgent", model: input.target?.model ?? null };
      return input.mode === "wait" ? { ...base, ...collect(taskId) } : { ...base, status: "running", workState: "working" };
    },
  },
  task_status: {
    description: "Read a delegated task: its state and, once done, its summary.",
    inputSchema: { type: "object", properties: { taskId: { type: "string" } }, required: ["taskId"] },
    call: ({ taskId }) => (log({ tool: "task_status", taskId }), load().tasks[taskId] ? { taskId, ...collect(taskId) } : { error: `unknown task ${taskId}` }),
  },
  write_pull_request_guides: {
    description: "Write review guides for up to 20 pull requests, the tour a maintainer reads in a pull request's Guide tab. Each run takes minutes, so this returns once the runs are under way; read a guide with read_pull_request_guide to see when it is written. A guide for the same head that is already running is joined, not restarted.",
    inputSchema: { type: "object", properties: { pullRequests: { type: "array", items: prRef, minItems: 1, maxItems: 20 } }, required: ["pullRequests"] },
    call: ({ pullRequests = [] }) => {
      const s = load();
      const result = pullRequests.map(prNumber).map((n) => {
        if (!PRS[n]) return { number: n, error: `no pull request #${n} in ${REPO}` };
        const joined = startGuide(s, n);
        log({ tool: "write_pull_request_guides", number: n, head: PRS[n].head, joined });
        return { number: n, url: PRS[n].url, headSha: PRS[n].head, run: joined ? "joined" : "started" };
      });
      save(s);
      return { pullRequests: result };
    },
  },
  read_pull_request_guide: {
    description: "Read a pull request's stored review guide and its run: run.Running while one is being written, run.Failed with the reason when the last one failed, guide null when none was written. stale is true after a push the guide has not caught up with. Never starts a run.",
    inputSchema: prRef,
    call: (ref) => {
      const n = prNumber(ref);
      if (!PRS[n]) return { error: `no pull request #${n} in ${REPO}` };
      const g = load().guides[n] ?? { guide: null, run: null };
      const stale = Boolean(g.guide && g.guide.headSha !== PRS[n].head);
      const state = g.run?._tag === "Running" ? "running" : !g.guide ? "none" : stale ? "stale" : "written";
      log({ tool: "read_pull_request_guide", number: n, head: PRS[n].head, state, guideHead: g.guide?.headSha ?? null });
      return { host: "github.com", repository: REPO, number: n, url: PRS[n].url, guide: g.guide, run: g.run, currentHeadSha: PRS[n].head, stale };
    },
  },
  t3_project_list: {
    description: "List registered projects in this environment.",
    inputSchema: { type: "object", properties: { cursor: { type: "integer" }, limit: { type: "integer" } } },
    call: () => {
      log({ tool: "t3_project_list" });
      return {
        projects: [
          { id: "project-notes", title: "notes", workspaceRoot: join(home, "notes"), repositoryIdentity: null },
          { id: PROJECT.id, title: PROJECT.title, workspaceRoot: work, repositoryIdentity: null },
        ],
        nextCursor: null,
      };
    },
  },
  t3_thread_list: {
    description: "List T3 threads in a project, newest first. Filter by status, title or settled state, and paginate with the returned cursor.",
    inputSchema: { type: "object", properties: { projectId: { type: "string" }, titleContains: { type: "string" }, settled: { type: "boolean" }, statuses: { type: "array", items: { type: "string" } }, cursor: { type: "integer" }, limit: { type: "integer" } } },
    call: ({ projectId, titleContains, settled }) => {
      log({ tool: "t3_thread_list", projectId: projectId ?? null, titleContains: titleContains ?? null });
      if (settled) return { threads: [], nextCursor: null };
      const threads = THREADS.filter((t) => (!projectId || t.projectId === projectId) && (!titleContains || t.title.toLowerCase().includes(titleContains.toLowerCase()))).map((t) => threadOf(t.threadId));
      return { projectId: projectId ?? PROJECT.id, threads, nextCursor: null, total: threads.length };
    },
  },
  t3_thread_read: {
    description: "Read durable state and a paginated timeline from any T3 thread in this environment, with its recentRuns.",
    inputSchema: { type: "object", properties: { threadId: { type: "string" }, limit: { type: "integer" }, runLimit: { type: "integer" }, afterPosition: { type: "integer" }, view: { type: "string" } }, required: ["threadId"] },
    call: ({ threadId }) => {
      log({ tool: "t3_thread_read", threadId });
      const thread = threadOf(threadId);
      if (!thread) return { error: `unknown thread ${threadId}` };
      return { thread, recentRuns: threadRuns(now)[threadId], items: [], nextPosition: 0, hasMore: false };
    },
  },
  t3_thread_launch: {
    description: "Create an ordinary TOP-LEVEL thread with an explicit workspace binding before its agent starts. Set workspaceStrategy to {type:'worktree',baseRef,branch,startFromOrigin} for a new worktree. Put the task in message. Each call creates a new launch with no retry key; retain threadId.",
    inputSchema: {
      type: "object",
      properties: { title: { type: "string" }, message: { type: "string" }, projectId: { type: "string" }, workspaceStrategy: { type: "object" }, modelSelection: { type: "object" }, runtimeMode: { type: "string" }, interactionMode: { type: "string" } },
      required: ["title"],
    },
    call: (input) => {
      const s = load();
      s.launches += 1;
      save(s);
      const threadId = `launched-${s.launches}`;
      log({ tool: "t3_thread_launch", threadId, title: input.title, message: input.message ?? null, projectId: input.projectId ?? null, workspaceStrategy: input.workspaceStrategy ?? null });
      return { threadId, title: input.title, projectId: input.projectId ?? PROJECT.id, status: "preparing" };
    },
  },
};

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
