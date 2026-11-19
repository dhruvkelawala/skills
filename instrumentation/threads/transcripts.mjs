// Claude and Codex transcripts: where they live, which session they belong to, and the events their rows hold.
// Adapters read only identities, counters, names, times and flags; content fields are never touched.
import { open, readdir, readFile, stat } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';

const CHUNK = 4 * 1024 * 1024;
const counter = (value) => Number.isSafeInteger(value) && value >= 0 ? value : null;

// Every transcript under the home directory's Claude and Codex folders modified since `since`, oldest first.
// A resumed or forked session copies earlier history into a newer file, so creation order decides who made a request.
export async function transcripts(home, since) {
  const found = [];
  for (const name of await readdir(home).catch(() => [])) {
    const runtime = name.startsWith('.claude') ? 'claude' : name.startsWith('.codex') ? 'codex' : null;
    if (!runtime) continue;
    const root = join(home, name, runtime === 'claude' ? 'projects' : 'sessions');
    for (const relative of await readdir(root, { recursive: true }).catch(() => [])) {
      if (!relative.endsWith('.jsonl')) continue;
      const path = join(root, relative);
      const info = await stat(path).catch(() => null);
      if (info?.isFile() && info.mtimeMs >= since) found.push({ runtime, path, size: info.size, mtime: info.mtimeMs, born: info.birthtimeMs, ino: info.ino });
    }
  }
  return found.sort((a, b) => a.born - b.born || (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}

// The session a transcript records, from its path and first row. A native subagent names its parent session.
export async function identify(file) {
  if (file.runtime === 'claude') {
    const name = basename(file.path, '.jsonl');
    if (basename(dirname(file.path)) === 'subagents') {
      const meta = await readFile(file.path.replace(/\.jsonl$/, '.meta.json'), 'utf8').then(JSON.parse, () => ({}));
      return { native: name, parentNative: basename(dirname(dirname(file.path))), spawnedBy: meta.toolUseId ?? null };
    }
    return { native: name };
  }
  for await (const { row } of appended(file.path, 0)) {
    const meta = row?.type === 'session_meta' ? row.payload : null;
    const parent = meta?.source?.subagent && meta.parent_thread_id;
    return { native: meta?.id ?? basename(file.path, '.jsonl').slice(-36), ...(parent ? { parentNative: parent } : {}) };
  }
  return { native: basename(file.path, '.jsonl').slice(-36) };
}

// Rows after a byte offset, each with the offset just past its line. A trailing partial line is left for the next read.
export async function* appended(path, offset) {
  const file = await open(path, 'r');
  try {
    const buffer = Buffer.alloc(CHUNK);
    let position = offset, carry = Buffer.alloc(0);
    for (;;) {
      const { bytesRead } = await file.read(buffer, 0, CHUNK, position);
      if (!bytesRead) break;
      position += bytesRead;
      const data = carry.length ? Buffer.concat([carry, buffer.subarray(0, bytesRead)]) : buffer.subarray(0, bytesRead);
      let start = 0, end;
      while ((end = data.indexOf(10, start)) >= 0) {
        const line = data.toString('utf8', start, end);
        const next = position - data.length + end + 1;
        start = end + 1;
        let row = null;
        try { row = JSON.parse(line); } catch {}
        yield { row, offset: next };
      }
      carry = Buffer.from(data.subarray(start));
    }
  } finally { await file.close(); }
}

// An adapter turns rows into events and keeps what later rows need in `state`, which the cursor saves.
// `spawns` is shared across transcripts: the turn each native subagent was started in, keyed by what its own transcript names.
export function adapter(runtime, state, spawns = {}) {
  const read = runtime === 'claude' ? claudeRow(state, spawns) : codexRow(state, spawns);
  state.tools ??= {};
  return (row) => {
    if (Number.isFinite(Date.parse(row.timestamp))) { state.first ??= row.timestamp; state.last = row.timestamp; }
    return read(row);
  };
}

// Tool calls still open a day after the transcript last moved were interrupted; they close where they started.
export function abandoned(state) {
  const events = [];
  for (const [source, open] of Object.entries(state.tools ?? {})) {
    if (Date.parse(state.last) - Date.parse(open.start) < 86400000) continue;
    events.push({ kind: 'tool', source, name: open.name, start: open.start, end: open.start, turn: open.turn });
    delete state.tools[source];
  }
  return events;
}

const SPAWNING_TOOLS = new Set(['Agent', 'Task']);

function claudeRow(state, spawns) {
  return (row) => {
    const events = [];
    const at = row.timestamp;
    const content = row.message?.content;
    if (row.type === 'user' && !hasToolResult(content)) state.turn = row.promptId ?? row.uuid ?? state.turn;
    if (row.type === 'user' && Array.isArray(content)) {
      for (const block of content) {
        const open = block?.type === 'tool_result' && state.tools[block.tool_use_id];
        if (!open) continue;
        delete state.tools[block.tool_use_id];
        events.push({ kind: 'tool', source: block.tool_use_id, name: open.name, start: open.start, end: at, error: block.is_error === true, turn: open.turn });
      }
    }
    if (row.type === 'assistant' && row.isApiErrorMessage && row.uuid) events.push({ kind: 'api-error', source: row.uuid, start: at, end: at, turn: state.turn });
    if (row.type === 'assistant') {
      const message = row.message ?? {};
      if (message.model && message.model !== '<synthetic>') state.model = message.model;
      // Streaming writes one row per content block, so a tool call can repeat; only its first sighting opens it.
      for (const block of Array.isArray(message.content) ? message.content : []) {
        if (block?.type !== 'tool_use' || !block.id || state.tools[block.id] || state.seen?.includes(block.id)) continue;
        state.tools[block.id] = { name: block.name, start: at, turn: state.turn };
        state.seen = [...(state.seen ?? []).slice(-99), block.id];
        if (SPAWNING_TOOLS.has(block.name)) spawns[block.id] = { turn: state.turn, day: Math.floor(Date.parse(at) / 86400000) };
      }
      if (message.id && message.usage) {
        const usage = claudeUsage(message.usage);
        if (state.message?.id === message.id) for (const key of Object.keys(usage)) if (typeof usage[key] === 'number') usage[key] = Math.max(usage[key], state.message.usage[key] ?? 0);
        state.message = { id: message.id, usage };
        events.push({ kind: 'generation', source: message.id, start: at, end: at, model: state.model, contextWindow: claudeWindow(state.model), usage, turn: state.turn });
      }
    }
    if (row.type === 'system' && row.subtype === 'compact_boundary' && row.uuid) {
      const meta = row.compactMetadata ?? {};
      events.push({ kind: 'compaction', source: row.uuid, start: at, end: at, trigger: meta.trigger, preTokens: meta.preTokens, postTokens: meta.postTokens, turn: state.turn });
    }
    return events;
  };
}

// Claude transcripts don't log the window, so it comes from the model (claude-api skill, models table cached 2026-11-03).
function claudeWindow(model = '') {
  if (/^claude-haiku-4-5/.test(model)) return 200000;
  if (/^claude-(fable|mythos|opus|sonnet|haiku)-5|^claude-(opus-4-[678]|sonnet-4-6)/.test(model)) return 1000000;
  return null;
}

const hasToolResult = (content) => Array.isArray(content) && content.some((block) => block?.type === 'tool_result');

function claudeUsage(u) {
  const split = u.cache_creation && typeof u.cache_creation === 'object';
  return {
    input: counter(u.input_tokens), output: counter(u.output_tokens), cacheRead: counter(u.cache_read_input_tokens),
    cacheWrite: counter(u.cache_creation_input_tokens),
    cacheWrite5m: split ? counter(u.cache_creation.ephemeral_5m_input_tokens) : null,
    cacheWrite1h: split ? counter(u.cache_creation.ephemeral_1h_input_tokens) : null,
    reasoning: null, inputIncludesCache: false, outputIncludesReasoning: true,
  };
}

// Codex logs each finished tool call as an item with its own start and end.
const CODEX_TOOLS = {
  CommandExecution: () => 'exec', McpToolCall: (item) => `${item.server}.${item.tool}`, FileChange: () => 'apply_patch',
  CollabAgentToolCall: (item) => item.tool, WebSearch: () => 'web_search', ImageView: () => 'view_image', Extension: (item) => item.kind,
};

function codexRow(state, spawns) {
  return (row) => {
    const events = [];
    const at = row.timestamp;
    const p = row.payload ?? {};
    if (row.type === 'event_msg' && p.type === 'item_completed' && p.item?.id) {
      const item = p.item;
      const name = CODEX_TOOLS[item.type]?.(item);
      const time = (ms) => Number.isFinite(ms) ? new Date(ms).toISOString() : at;
      if (name) events.push({ kind: 'tool', source: item.id, name, start: time(p.started_at_ms), end: time(p.completed_at_ms), error: item.status === 'failed', turn: p.turn_id ?? state.turn });
      if (item.type === 'SubAgentActivity' && item.agent_thread_id) spawns[item.agent_thread_id] = { turn: p.turn_id ?? state.turn, day: Math.floor(Date.parse(at) / 86400000) };
    }
    if (row.type === 'event_msg' && ['error', 'stream_error'].includes(p.type)) events.push({ kind: 'api-error', source: `${state.turn}:${at}`, start: at, end: at, turn: state.turn });
    if (row.type === 'session_meta') state.provider = p.model_provider ?? state.provider;
    if (row.type === 'turn_context') {
      state.turn = p.turn_id ?? state.turn;
      state.model = p.model ?? state.model;
      state.effort = p.effort ?? p.collaboration_mode?.settings?.reasoning_effort ?? state.effort;
    }
    if (row.type === 'event_msg' && p.type === 'task_started') state.window = p.model_context_window ?? state.window;
    if (row.type === 'event_msg' && p.type === 'token_count') state.window = p.info?.model_context_window ?? state.window;
    if (row.type === 'token_usage_record' && p.response_id) {
      const u = p.usage ?? {};
      const usage = { input: counter(u.input_tokens), output: counter(u.output_tokens), cacheRead: counter(u.cached_input_tokens), cacheWrite: null, cacheWrite5m: null, cacheWrite1h: null, reasoning: counter(u.reasoning_output_tokens), inputIncludesCache: true, outputIncludesReasoning: true };
      events.push({ kind: 'generation', source: p.response_id, start: at, end: at, model: state.model, effort: state.effort, provider: state.provider, contextWindow: state.window, usage, turn: p.turn_id ?? state.turn });
      state.requested = true;
      // A compaction's size afterwards is the first request's input after it; it is sent again once known.
      if (state.compaction) {
        events.push({ ...state.compaction, postTokens: usage.input });
        state.compaction = null;
      }
    }
    if (row.type === 'compacted') {
      const source = p.window_id ?? `${at}`;
      // T3 hands a session over between providers with a compacted row before the first model call. That is no compaction.
      if (!state.requested) events.push({ kind: 'handoff', source, start: at, end: at, turn: state.turn });
      else {
        state.compaction = { kind: 'compaction', source, start: at, end: at, preTokens: p.latest_token_usage_record?.usage?.input_tokens, turn: state.turn };
        events.push(state.compaction);
      }
    }
    return events;
  };
}
