// What T3 knows about its threads, read-only from statev2.sqlite and refreshed on every pass.
import { DatabaseSync } from 'node:sqlite';

const parse = (text) => { try { return JSON.parse(text); } catch { return {}; } };
const LAUNCH_TOOLS = /(^|[._])(t3_thread_launch|create_threads)$/;

// `scan` remembers launches found so far and the turn-item row the next pass starts after, so the
// large turn-item table is read in full only once.
export function readT3(path, scan = {}) {
  const launches = { ...scan.launches };
  const empty = { threads: new Map(), native: new Map(), runs: new Map(), launchers: new Map(Object.entries(launches)), scan: { watermark: scan.watermark ?? 0, launches } };
  if (!path) return empty;
  const db = new DatabaseSync(path, { readOnly: true });
  try {
    const threads = new Map();
    for (const row of db.prepare('SELECT t.thread_id AS id, t.title, t.project_id AS projectId, t.payload_json AS payload, p.title AS project, p.workspace_root AS root FROM orchestration_v2_projection_threads t LEFT JOIN projection_projects p ON p.project_id = t.project_id').all()) {
      threads.set(row.id, { id: row.id, title: row.title, projectId: row.projectId, project: row.project, root: row.root, payload: parse(row.payload) });
    }
    const native = new Map();
    for (const row of db.prepare("SELECT thread_id AS thread, json_extract(payload_json, '$.nativeThreadRef.nativeId') AS nativeId FROM orchestration_v2_projection_provider_threads WHERE thread_id IS NOT NULL").all()) {
      if (row.nativeId) native.set(row.nativeId, row.thread);
    }
    const runs = new Map();
    for (const row of db.prepare("SELECT run_id AS id, thread_id AS thread, json_extract(payload_json, '$.startedAt') AS started FROM orchestration_v2_projection_runs WHERE json_extract(payload_json, '$.startedAt') IS NOT NULL ORDER BY thread_id, json_extract(payload_json, '$.startedAt')").all()) {
      if (!runs.has(row.thread)) runs.set(row.thread, []);
      runs.get(row.thread).push({ id: row.id, started: Date.parse(row.started) });
    }
    // A launch row that has not finished yet holds the watermark back for a day, so its child is found once it does.
    let watermark = scan.watermark ?? 0, unfinished = null;
    for (const row of db.prepare("SELECT rowid, thread_id AS parent, json_extract(payload_json, '$.toolName') AS tool, json_extract(payload_json, '$.status') AS status, json_extract(payload_json, '$.output') AS output, updated_at AS updated FROM orchestration_v2_projection_turn_items WHERE rowid > ? AND type = 'dynamic_tool' ORDER BY rowid").iterate(watermark)) {
      watermark = row.rowid;
      if (!LAUNCH_TOOLS.test(row.tool ?? '')) continue;
      const children = launched(parse(row.output));
      if (!children.length && ['pending', 'running', 'waiting'].includes(row.status) && Date.now() - Date.parse(row.updated) < 86400000) unfinished ??= row.rowid - 1;
      for (const child of children) launches[child] = row.parent;
    }
    const delegates = db.prepare("SELECT thread_id AS parent, child_thread_id AS child FROM orchestration_v2_projection_subagents WHERE origin = 'app_owned' AND child_thread_id IS NOT NULL").all();
    const launchers = new Map(Object.entries(launches));
    for (const { parent, child } of delegates) launchers.set(child, parent);
    return { threads, native, runs, launchers, scan: { watermark: unfinished ?? watermark, launches } };
  } finally { db.close(); }
}

// Thread IDs a launch tool returned: Claude wraps them in `structuredContent`, Codex returns them directly.
function launched(output) {
  const body = output?.structuredContent ?? output ?? {};
  return [body.threadId, ...(Array.isArray(body.threads) ? body.threads.map((thread) => thread?.threadId) : [])].filter((id) => typeof id === 'string');
}

// The run that was active at a time: the last one started at or before it.
export function runAt(t3, thread, time) {
  const list = t3.runs.get(thread);
  const at = Date.parse(time);
  if (!list || !Number.isFinite(at)) return null;
  let low = 0, high = list.length - 1, found = null;
  while (low <= high) {
    const middle = (low + high) >> 1;
    if (list[middle].started <= at) { found = list[middle]; low = middle + 1; } else high = middle - 1;
  }
  return found?.id ?? null;
}

// The raw facts T3 holds for a thread, as session metadata. Roles are derived at query time.
export function threadFacts(t3, id, workflows) {
  const thread = t3.threads.get(id);
  if (!thread) return {};
  const p = thread.payload;
  return {
    title: thread.title, project: thread.project, projectId: thread.projectId, branch: p.branch, worktree: p.worktreePath,
    providerInstance: p.providerInstanceId, interactionMode: p.interactionMode, runtimeMode: p.runtimeMode,
    createdBy: p.createdBy, creationSource: p.creationSource,
    lineageParent: p.lineage?.parentThreadId, lineageRoot: p.lineage?.rootThreadId, lineageRelationship: p.lineage?.relationshipToParent,
    launcher: t3.launchers.get(id), workflow: workflowOf(t3, id, workflows),
  };
}

// An issue-to-pr run owns a thread on its branch in its repository; a thread without one inherits its launcher's or parent's.
function workflowOf(t3, id, workflows, depth = 0) {
  const thread = t3.threads.get(id);
  if (!thread || depth > 10) return null;
  const branch = thread.payload.branch;
  const places = [thread.payload.worktreePath, thread.root].filter(Boolean).flatMap((path) => path.split('/'));
  const own = branch ? workflows.filter((run) => run.branch === branch && places.includes(run.repository.split('/').pop())) : [];
  if (own.length === 1) return own[0].workflow;
  const up = t3.launchers.get(id) ?? thread.payload.lineage?.parentThreadId;
  return up && up !== id ? workflowOf(t3, up, workflows, depth + 1) : null;
}
