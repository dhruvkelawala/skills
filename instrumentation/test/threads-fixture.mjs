// Synthetic transcripts, a synthetic T3 database and a local OTLP collector. No real titles or transcripts.
import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { appendFile, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

// The transcripts carry fixed 2026 dates, so retention is set wide enough that they stay inside it on any run date.
export async function fixture() {
  const home = await mkdtemp(join(tmpdir(), 't3-threads-'));
  const database = join(home, 'statev2.sqlite');
  const db = new DatabaseSync(database);
  db.exec(`
    CREATE TABLE projection_projects (project_id TEXT PRIMARY KEY, title TEXT NOT NULL, workspace_root TEXT NOT NULL);
    CREATE TABLE orchestration_v2_projection_threads (thread_id TEXT PRIMARY KEY, project_id TEXT NOT NULL, title TEXT NOT NULL, payload_json TEXT NOT NULL);
    CREATE TABLE orchestration_v2_projection_provider_threads (provider_thread_id TEXT PRIMARY KEY, thread_id TEXT, payload_json TEXT NOT NULL);
    CREATE TABLE orchestration_v2_projection_runs (run_id TEXT PRIMARY KEY, thread_id TEXT NOT NULL, ordinal INTEGER NOT NULL, completed_at TEXT, payload_json TEXT NOT NULL);
    CREATE TABLE orchestration_v2_projection_subagents (subagent_id TEXT PRIMARY KEY, thread_id TEXT NOT NULL, child_thread_id TEXT, origin TEXT NOT NULL);
    CREATE TABLE orchestration_v2_projection_turn_items (turn_item_id TEXT PRIMARY KEY, thread_id TEXT NOT NULL, type TEXT NOT NULL, payload_json TEXT NOT NULL, updated_at TEXT NOT NULL);
  `);
  const spans = [], bodies = [];
  let reject = false;
  const server = createServer(async (req, res) => {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    bodies.push(raw);
    // `reject` is true to fail every post, or a number of posts to fail before the collector recovers.
    if (reject) { if (typeof reject === 'number') reject--; res.writeHead(503, { 'content-type': 'application/json' }); res.end('{}'); return; }
    for (const resource of JSON.parse(raw).resourceSpans ?? []) {
      for (const scope of resource.scopeSpans) for (const span of scope.spans) {
        spans.push({ ...span, raw: JSON.stringify(span), attributes: Object.fromEntries(span.attributes.map(({ key, value }) => [key, value.stringValue])) });
      }
    }
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end('{}');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const endpoint = `http://127.0.0.1:${server.address().port}`;

  return {
    home, database, spans, bodies, endpoint,
    set reject(value) { reject = value; },
    config: (extra = {}) => ({ enabled: true, directory: join(home, 'outbox'), endpoint, publicKey: 'test', secretKey: 'test', since: '2026-11-01T00:00:00Z', t3Database: database, retryMs: 0, retentionDays: 36500, ...extra }),
    project(id, title, root) { db.prepare('INSERT INTO projection_projects VALUES (?, ?, ?)').run(id, title, root); },
    thread({ id, project = 'p1', title = 'Synthetic thread', nativeId, branch = null, worktreePath = null, lineage = {}, createdBy = 'user', creationSource = 'web', runs = [] }) {
      const payload = { id, title, projectId: project, branch, worktreePath, providerInstanceId: 'claude-test', interactionMode: 'default', runtimeMode: 'full-access', createdBy, creationSource, lineage: { parentThreadId: null, relationshipToParent: null, rootThreadId: id, ...lineage } };
      db.prepare('INSERT INTO orchestration_v2_projection_threads VALUES (?, ?, ?, ?)').run(id, project, title, JSON.stringify(payload));
      if (nativeId) db.prepare('INSERT INTO orchestration_v2_projection_provider_threads VALUES (?, ?, ?)').run(`pt:${id}`, id, JSON.stringify({ nativeThreadRef: { nativeId } }));
      runs.forEach(([started, completed], ordinal) => db.prepare('INSERT INTO orchestration_v2_projection_runs VALUES (?, ?, ?, ?, ?)').run(`run:${id}:${ordinal}`, id, ordinal, completed, JSON.stringify({ startedAt: started })));
    },
    delegate(parent, child) { db.prepare('INSERT INTO orchestration_v2_projection_subagents VALUES (?, ?, ?, ?)').run(`sub:${child}`, parent, child, 'app_owned'); },
    launch(parent, child, toolName = 'mcp__t3-code__t3_thread_launch', status = 'completed') {
      const output = status === 'completed' ? { structuredContent: { threadId: child } } : null;
      db.prepare('INSERT INTO orchestration_v2_projection_turn_items VALUES (?, ?, ?, ?, ?)').run(`item:${parent}:${child}`, parent, 'dynamic_tool', JSON.stringify({ toolName, status, input: { message: 'SECRET' }, output }), new Date().toISOString());
    },
    complete(parent, child) { db.prepare("UPDATE orchestration_v2_projection_turn_items SET payload_json = json_set(payload_json, '$.status', 'completed', '$.output', json(?)) WHERE turn_item_id = ?").run(JSON.stringify({ structuredContent: { threadId: child } }), `item:${parent}:${child}`); },
    async write(path, rows) { const full = join(home, path); await mkdir(dirname(full), { recursive: true }); await writeFile(full, rows.map((row) => JSON.stringify(row) + '\n').join('')); return full; },
    async append(path, rows) { await appendFile(join(home, path), rows.map((row) => JSON.stringify(row) + '\n').join('')); },
    async close() { db.close(); server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); await rm(home, { recursive: true, force: true }); },
  };
}

// Transcript rows in the shapes the pinned runtimes write.
export const claude = {
  prompt: (time, promptId, text = 'synthetic prompt') => ({ type: 'user', timestamp: time, promptId, uuid: `u-${promptId}`, message: { role: 'user', content: text } }),
  request: (time, id, usage = {}, content = []) => ({ type: 'assistant', timestamp: time, uuid: `a-${id}-${time}`, message: { id, model: 'claude-opus-5-5', content, usage: { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 100, cache_creation_input_tokens: 20, cache_creation: { ephemeral_5m_input_tokens: 0, ephemeral_1h_input_tokens: 20 }, ...usage } } }),
};

export const codex = {
  meta: (time, id, extra = {}) => ({ type: 'session_meta', timestamp: time, payload: { id, session_id: id, model_provider: 'openai', ...extra } }),
  turn: (time, turn) => ({ type: 'turn_context', timestamp: time, payload: { turn_id: turn, model: 'gpt-6.1-sol', effort: 'xhigh' } }),
  request: (time, response, turn = 't1', usage = {}) => ({ type: 'token_usage_record', timestamp: time, payload: { response_id: response, turn_id: turn, usage: { input_tokens: 1000, cached_input_tokens: 600, cache_write_input_tokens: 0, output_tokens: 50, reasoning_output_tokens: 10, ...usage } } }),
};

// Sums each session's tokens from the collected generations the way Langfuse prices them.
export function sessionTotals(spans) {
  const latest = new Map();
  for (const span of spans) if (span.attributes['langfuse.observation.type'] === 'generation') latest.set(span.spanId, span);
  const totals = {};
  for (const span of latest.values()) {
    const session = span.attributes['session.id'];
    const usage = JSON.parse(span.attributes['langfuse.observation.usage_details'] ?? '{}');
    totals[session] ??= { requests: 0, tokens: 0 };
    totals[session].requests++;
    totals[session].tokens += Object.values(usage).reduce((sum, value) => sum + value, 0);
  }
  return totals;
}
