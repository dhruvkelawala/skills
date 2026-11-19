// An independent recount of each session's tokens straight from the transcripts, to check what the capture sent.
// It shares no parsing with the capture: it applies the same ownership rules to its own reading of the files.
import { createReadStream } from 'node:fs';
import { readdir, stat } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { basename, dirname, join } from 'node:path';
import { createInterface } from 'node:readline';

export async function recount({ home, t3Database, from, to }) {
  const start = Date.parse(from), end = Date.parse(to);
  const threads = new Map();
  if (t3Database) {
    const db = new DatabaseSync(t3Database, { readOnly: true });
    try {
      for (const row of db.prepare("SELECT thread_id, json_extract(payload_json, '$.nativeThreadRef.nativeId') AS native FROM orchestration_v2_projection_provider_threads").all()) if (row.thread_id && row.native) threads.set(row.native, row.thread_id);
    } finally { db.close(); }
  }

  const files = [];
  for (const top of await readdir(home)) {
    const runtime = top.startsWith('.claude') ? 'claude' : top.startsWith('.codex') ? 'codex' : null;
    if (!runtime) continue;
    const root = join(home, top, runtime === 'claude' ? 'projects' : 'sessions');
    for (const name of await readdir(root, { recursive: true }).catch(() => [])) {
      if (!name.endsWith('.jsonl')) continue;
      const info = await stat(join(root, name));
      if (info.mtimeMs >= start) files.push({ runtime, path: join(root, name), born: info.birthtimeMs });
    }
  }
  files.sort((a, b) => a.born - b.born || a.path.localeCompare(b.path));

  const owner = new Map();   // request -> session that first holds it
  const usage = new Map();   // request -> tokens
  for (const file of files) {
    let native = basename(file.path, '.jsonl');
    if (file.runtime === 'claude' && basename(dirname(file.path)) === 'subagents') native = basename(dirname(dirname(file.path)));
    const requests = new Map();
    for await (const line of createInterface({ input: createReadStream(file.path), crlfDelay: Infinity })) {
      let row;
      try { row = JSON.parse(line); } catch { continue; }
      if (file.runtime === 'codex' && row.type === 'session_meta') native = row.payload?.source?.subagent && row.payload.parent_thread_id ? row.payload.parent_thread_id : row.payload?.id ?? native.slice(-36);
      const time = Date.parse(row.timestamp);
      if (!(time >= start && time < end)) continue;
      if (file.runtime === 'claude' && row.type === 'assistant' && row.message?.id && row.message.usage) {
        const u = row.message.usage;
        const seen = requests.get(row.message.id) ?? [0, 0, 0, 0];
        requests.set(row.message.id, [u.input_tokens, u.output_tokens, u.cache_read_input_tokens, u.cache_creation_input_tokens].map((n, i) => Math.max(seen[i], Number.isSafeInteger(n) ? n : 0)));
      }
      if (file.runtime === 'codex' && row.type === 'token_usage_record' && row.payload?.response_id) {
        const u = row.payload.usage ?? {};
        requests.set(row.payload.response_id, [u.input_tokens, u.output_tokens].map((n) => Number.isSafeInteger(n) ? n : 0));
      }
    }
    if (file.runtime === 'codex' && !native) continue;
    const session = threads.get(native) ?? `${file.runtime}:${native}`;
    for (const [id, counts] of requests) {
      const key = `${file.runtime}|${id}`;
      if (owner.has(key) && owner.get(key) !== session) continue;
      owner.set(key, session);
      usage.set(key, counts.reduce((sum, n) => sum + n, 0));
    }
  }

  const totals = {};
  for (const [key, session] of owner) {
    totals[session] ??= { requests: 0, tokens: 0 };
    totals[session].requests++;
    totals[session].tokens += usage.get(key);
  }
  return totals;
}
