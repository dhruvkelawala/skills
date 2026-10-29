import { mkdir, open, readFile, readdir, rename, unlink, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { digest, metadataEvent } from './contract.mjs';

const defaults = { maxEvents: 1000, maxBytes: 16 * 1024 * 1024, maxAttempts: 8, retryMs: 1000, timeoutMs: 3000 };

export function ingestion(event) {
  const traceId = digest(event.workflow).slice(0, 32);
  const invocationId = digest([event.workflow, event.attempt, event.invocation].join(':')).slice(0, 16);
  const id = event.kind === 'skill.started' ? invocationId : event.eventId.slice(0, 16);
  const parent = event.kind === 'skill.started' ? event.parent && digest([event.workflow, event.attempt, event.parent].join(':')).slice(0, 16) : invocationId;
  const attribute = (key, value) => ({ key, value: { stringValue: typeof value === 'string' ? value : JSON.stringify(value) } });
  const attributes = [attribute('session.id', event.workflow), attribute('langfuse.trace.name', 'skill-workflow'), attribute('langfuse.trace.tags', [event.skill, 'skill-run/v1']), attribute('langfuse.observation.type', event.kind === 'request' ? 'generation' : 'span')];
  for (const [key, value] of Object.entries(event)) if (value !== null) attributes.push(attribute('langfuse.observation.metadata.' + key, value));
  if (event.execution === 'failed' || event.outcome === 'failed') attributes.push(attribute('langfuse.observation.level', 'ERROR'));
  if (event.kind === 'request') {
    if (event.model) attributes.push(attribute('langfuse.observation.model.name', event.model));
    if (event.usage) attributes.push(attribute('langfuse.observation.usage_details', usageDetails(event.usage)));
  }
  const nanos = String(BigInt(Date.parse(event.time)) * 1000000n);
  const span = { traceId, spanId: id, name: event.kind === 'request' ? 'provider.request' : event.kind, kind: 1, startTimeUnixNano: nanos, endTimeUnixNano: nanos, attributes };
  if (parent) span.parentSpanId = parent;
  const trace = { resourceSpans: [{ resource: { attributes: [attribute('service.name', 'skill-observability-pilot')] }, scopeSpans: [{ scope: { name: 'skill-run/v1' }, spans: [span] }] }] };
  const score = event.kind === 'gate' && event.outcome !== 'unknown' ? { id: digest(event.eventId + ':score').slice(0, 32), traceId, observationId: id, name: 'evidence-failure', dataType: 'BOOLEAN', value: event.outcome === 'failed' ? 1 : 0, comment: JSON.stringify({ evidence: event.evidence, judge: event.judge, rubric: event.rubric }) } : null;
  const measured = event.kind === 'request' && event.usage?.input != null && event.usage?.output != null && (event.usage.inputIncludesCache === true || event.usage.inputIncludesCache === false && event.usage.cacheRead != null && event.usage.cacheWrite != null) ? { id: digest(event.request + ':tokens').slice(0, 32), traceId, observationId: id, name: 'runtime-tokens', dataType: 'NUMERIC', value: Object.values(usageDetails(event.usage)).reduce((n, v) => n + v, 0), comment: JSON.stringify({ source: event.request, schema: event.schema, measurement: 'runtime-counter', evidence: 'provider-request', priceBasis: null }) } : null;
  return { trace, scores: [score, measured].filter(Boolean) };
}

function usageDetails(u) {
  if (!u) return undefined;
  const details = {};
  if (u.input != null) details.input = Math.max(0, u.input - (u.inputIncludesCache ? u.cacheRead ?? 0 : 0));
  if (u.output != null) details.output = Math.max(0, u.output - (u.outputIncludesReasoning ? u.reasoning ?? 0 : 0));
  for (const [from, to] of [['cacheRead', 'cache_read'], ['cacheWrite5m', 'cache_write_5m'], ['cacheWrite1h', 'cache_write_1h'], ['reasoning', 'reasoning']]) if (u[from] != null) details[to] = u[from];
  const unsplit = (u.cacheWrite ?? 0) - (u.cacheWrite5m ?? 0) - (u.cacheWrite1h ?? 0);
  if (unsplit > 0) details.cache_write_unknown_duration = unsplit;
  return details;
}

async function durable(path, value) {
  const temp = path + '.tmp-' + process.pid;
  const file = await open(temp, 'w', 0o600);
  try { await file.writeFile(JSON.stringify(value)); await file.sync(); } finally { await file.close(); }
  await rename(temp, path);
  const directory = await open(join(path, '..'), 'r');
  try { await directory.sync(); } finally { await directory.close(); }
}

async function locked(config, action) {
  const c = { ...defaults, ...config };
  if (!c.enabled) return { status: 'disabled' };
  let lock;
  try {
    if (!c.directory) throw new Error('missing directory');
    await mkdir(c.directory, { recursive: true, mode: 0o700 });
    const path = join(c.directory, 'lock');
    try { lock = await open(path, 'wx', 0o600); }
    catch (error) {
      if (error.code !== 'EEXIST') throw error;
      let owner;
      try { owner = JSON.parse(await readFile(path, 'utf8')); } catch {
        if (Date.now() - (await stat(path)).mtimeMs < 10000) return { status: 'busy' };
      }
      if (owner?.pid) {
        try { process.kill(owner.pid, 0); return { status: 'busy' }; } catch (error) { if (error.code !== 'ESRCH') return { status: 'busy' }; }
      }
      await unlink(path);
      lock = await open(path, 'wx', 0o600);
    }
    await lock.writeFile(JSON.stringify({ pid: process.pid }));
    return await action(c);
  } catch { return { status: 'unavailable' }; }
  finally { if (lock) { await lock.close(); await unlink(join(c.directory, 'lock')).catch(() => {}); } }
}

async function entries(c) {
  return Promise.all((await readdir(c.directory)).filter((name) => /^[a-f0-9]{64}\.json$/.test(name)).sort().map(async (name) => ({ path: join(c.directory, name), ...(JSON.parse(await readFile(join(c.directory, name), 'utf8'))) })));
}
async function rejected(c) {
  const path = join(c.directory, 'gaps');
  let count = 0;
  try { count = JSON.parse(await readFile(path, 'utf8')).rejected; } catch {}
  await durable(path, { rejected: count + 1 });
}

export async function emit(config, input) {
  return locked(config, async (c) => {
    const event = metadataEvent(input);
    if (event.kind === 'request') {
      if (!event.request || !/^[a-f0-9]{64}$/.test(event.request)) return { status: 'unavailable' };
      event.eventId = event.request;
    }
    const body = ingestion(event);
    const existing = await entries(c);
    const path = join(c.directory, event.eventId + '.json');
    const old = existing.find((item) => item.path === path);
    const value = { body, attempts: old?.attempts ?? 0, next: old?.next ?? 0, exhausted: old?.exhausted ?? false };
    const bytes = Buffer.byteLength(JSON.stringify(value));
    if ((!old && existing.length >= c.maxEvents) || bytes + existing.filter((e) => e.path !== path).reduce((n, e) => n + Buffer.byteLength(JSON.stringify(e)), 0) > c.maxBytes) {
      await rejected(c); return { status: 'unavailable' };
    }
    await durable(path, value);
    return { status: 'accepted', eventId: event.eventId };
  });
}

export async function flush(config) {
  return locked(config, async (c) => {
    const endpoint = new URL('/api/public/otel/v1/traces', c.endpoint);
    if (endpoint.protocol !== 'https:' && !(endpoint.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(endpoint.hostname))) return { status: 'unavailable' };
    if (!c.publicKey || !c.secretKey) return { status: 'unavailable' };
    let delivered = 0;
    const deadline = Date.now() + c.timeoutMs;
    for (const item of await entries(c)) {
      if (item.exhausted || item.next > Date.now() || Date.now() >= deadline) continue;
      let ok = false;
      try {
        const send = async (url, body) => {
          const response = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Basic ' + Buffer.from(c.publicKey + ':' + c.secretKey).toString('base64') }, body: JSON.stringify(body), redirect: 'error', signal: AbortSignal.timeout(Math.max(1, deadline - Date.now())) });
          const receipt = await response.json();
          return response.ok && !(Number(receipt.partialSuccess?.rejectedSpans) > 0) && !receipt.error;
        };
        ok = await send(endpoint, item.body.trace);
        for (const score of item.body.scores) if (ok) ok = await send(new URL('/api/public/scores', c.endpoint), score);
      } catch {}
      if (ok) { await unlink(item.path); delivered++; }
      else {
        const attempts = item.attempts + 1;
        await durable(item.path, { body: item.body, attempts, next: Date.now() + Math.min(60000, c.retryMs * 2 ** attempts), exhausted: attempts >= c.maxAttempts });
      }
    }
    return { status: 'flushed', delivered, ...(await queueStatus(c)) };
  });
}
async function queueStatus(c) {
  const items = await entries(c);
  let rejected = 0;
  try { rejected = JSON.parse(await readFile(join(c.directory, 'gaps'), 'utf8')).rejected; } catch {}
  return { pending: items.filter((e) => !e.exhausted).length, exhausted: items.filter((e) => e.exhausted).length, rejected };
}
export async function status(config) { return locked(config, async (c) => ({ status: 'available', ...(await queueStatus(c)) })); }
