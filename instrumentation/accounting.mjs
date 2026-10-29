import { digest, metadataEvent } from './contract.mjs';

const KEYS = ['input', 'output', 'cacheRead', 'cacheWrite', 'cacheWrite5m', 'cacheWrite1h', 'reasoning'];
const counter = (value) => Number.isSafeInteger(value) && value >= 0 ? value : null;

// Bounded adapters for the pinned runtimes' usage records; content is never projected.
export function captureRequests(runtime, rows, context) {
  if (!['claude', 'codex'].includes(runtime)) throw new Error('unsupported runtime');
  if (!context.session) throw new Error('capture requires session identity');
  const requests = new Map();
  let previous = {}, turn = context.turn, model = context.model, provider = context.provider, effort = context.effort;
  for (const row of rows) {
    let source, usage, failed = false;
    const p = row.payload;
    if (runtime === 'claude') {
      if (row.type !== 'assistant') continue;
      source = row.message?.id ?? (row.isApiErrorMessage ? row.uuid : null);
      if (!source) continue;
      failed = row.isApiErrorMessage === true;
      const u = row.message?.usage;
      model = row.message?.model ?? model;
      usage = u ? { input: counter(u.input_tokens), output: counter(u.output_tokens), cacheRead: counter(u.cache_read_input_tokens), cacheWrite: counter(u.cache_creation_input_tokens) ?? (u.cache_creation ? (counter(u.cache_creation.ephemeral_5m_input_tokens) ?? 0) + (counter(u.cache_creation.ephemeral_1h_input_tokens) ?? 0) : null), cacheWrite5m: counter(u.cache_creation?.ephemeral_5m_input_tokens), cacheWrite1h: counter(u.cache_creation?.ephemeral_1h_input_tokens), reasoning: null, inputIncludesCache: false, outputIncludesReasoning: true } : null;
      if (usage && u.cache_creation_input_tokens > 0 && !u.cache_creation) {
        usage.cacheWrite5m = null;
        usage.cacheWrite1h = null;
      }
    } else {
      if (row.type === 'session_meta') provider = p?.model_provider ?? provider;
      if (row.type === 'turn_context') { turn = p?.turn_id ?? turn; model = p?.model ?? model; effort = p?.effort ?? p?.reasoning_effort ?? effort; }
      if (row.type !== 'event_msg' || p?.type !== 'token_count' || !p.info?.total_token_usage) continue;
      const u = p.info.total_token_usage;
      const current = { input: counter(u.input_tokens), output: counter(u.output_tokens), cacheRead: counter(u.cached_input_tokens), cacheWrite: null, cacheWrite5m: null, cacheWrite1h: null, reasoning: counter(u.reasoning_output_tokens) };
      if (KEYS.every((key) => current[key] === (previous[key] ?? null))) continue;
      const reset = KEYS.some((key) => current[key] !== null && previous[key] != null && current[key] < previous[key]);
      if (reset) throw new Error('cumulative usage reset; capture unavailable without request identity');
      source = p.request_id ?? digest(JSON.stringify(current));
      usage = Object.fromEntries(KEYS.map((key) => [key, current[key] === null ? null : current[key] - (previous[key] ?? 0)]));
      usage.inputIncludesCache = true;
      usage.outputIncludesReasoning = true;
      previous = current;
    }
    const request = digest(JSON.stringify([runtime, context.session, source]));
    const event = metadataEvent({ ...context, provider, model, effort, turn, kind: 'request', request, eventKey: request, usage, time: row.timestamp, execution: failed ? 'failed' : null });
    event.eventId = request;
    const old = requests.get(request);
    if (old?.usage && event.usage) {
      for (const key of KEYS) {
        if (old.usage[key] != null) event.usage[key] = Math.max(old.usage[key], event.usage[key] ?? 0);
      }
    }
    requests.set(request, event);
  }
  return [...requests.values()];
}

export function totals(events, invocation) {
  const requests = new Map();
  const descendants = new Set([invocation]);
  let changed;
  do {
    changed = false;
    for (const event of events) if (descendants.has(event.parent) && !descendants.has(event.invocation)) { descendants.add(event.invocation); changed = true; }
  } while (changed);
  for (const event of events) {
    if (event.kind !== 'request' || !descendants.has(event.invocation)) continue;
    const key = event.request;
    const old = requests.get(key);
    if (!old || Date.parse(event.time) > Date.parse(old.time)) requests.set(key, event);
  }
  const values = [...requests.values()];
  function sum(list) {
    const result = Object.fromEntries(KEYS.map((key) => {
      const known = list.filter((event) => event.usage?.[key] != null);
      return [key, known.length ? known.reduce((n, event) => n + event.usage[key], 0) : null];
    }));
    result.total = list.some((e) => e.usage) ? list.reduce((n, e) => {
      const u = e.usage;
      return n + (u?.input ?? 0) + (u?.output ?? 0) + (u?.inputIncludesCache === false ? (u.cacheRead ?? 0) + (u.cacheWrite ?? 0) : 0);
    }, 0) : null;
    return result;
  }
  return { requests: values.length, failedRequests: values.filter((e) => e.execution === 'failed').length,
    unknownUsage: values.filter((e) => !e.usage).length,
    ambiguousRequests: values.filter((e) => e.allocation !== 'exclusive').length,
    inclusive: sum(values), exclusive: values.some((e) => e.invocation === invocation && e.allocation !== 'exclusive') ? null : sum(values.filter((e) => e.invocation === invocation)),
    childCoverage: values.some((e) => e.childCoverage === 'partial') ? 'partial' : values.every((e) => e.childCoverage === 'complete') && values.length ? 'complete' : 'unknown', cost: null };
}
