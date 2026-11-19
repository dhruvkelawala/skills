// What T3 knows about its threads, read-only from statev2.sqlite and refreshed on every pass.
import { DatabaseSync } from 'node:sqlite';

const parse = (text) => { try { return JSON.parse(text); } catch { return {}; } };

export function readT3(path) {
  const empty = { threads: new Map(), native: new Map(), runs: new Map() };
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
    return { threads, native, runs };
  } finally { db.close(); }
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
