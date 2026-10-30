import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { emit, flush, status } from '../delivery.mjs';
import { captureHook } from '../cli.mjs';
import { digest } from '../contract.mjs';

const event = { workflow: 'w', attempt: 'a', invocation: 'root', skill: 'research', kind: 'skill.started', eventKey: 'start', time: '2026-10-29T18:00:00Z' };

test('accepted metadata survives rejection and a fresh process; replay uses stable ingestion identities', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'skill-outbox-'));
  const bodies = [];
  let reject = true;
  const server = createServer(async (req, res) => {
    let raw = ''; for await (const chunk of req) raw += chunk;
    bodies.push(JSON.parse(raw));
    res.writeHead(reject ? 503 : 207, { 'content-type': 'application/json' });
    res.end(JSON.stringify(reject ? {} : {}));
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const config = { enabled: true, directory: dir, endpoint: `http://127.0.0.1:${server.address().port}`, publicKey: 'test', secretKey: 'test', maxAttempts: 2, retryMs: 0 };
  try {
    assert.equal((await emit(config, event)).status, 'accepted');
    assert.equal((await flush(config)).pending, 1);
    const child = spawnSync(process.execPath, ['--input-type=module', '-e', `import { status } from ${JSON.stringify(new URL('../delivery.mjs', import.meta.url).href)}; console.log(JSON.stringify(await status(${JSON.stringify(config)})));`], { encoding: 'utf8' });
    assert.equal(child.status, 0);
    assert.equal(JSON.parse(child.stdout).pending, 1);
    reject = false;
    assert.equal((await flush(config)).pending, 0);
    await emit(config, event); await flush(config);
    assert.deepEqual(bodies[1].resourceSpans[0].scopeSpans[0].spans[0].spanId, bodies[2].resourceSpans[0].scopeSpans[0].spans[0].spanId);
    reject = true;
    await emit(config, { ...event, eventKey: 'exhaust' });
    await flush(config); await flush(config);
    assert.equal((await status(config)).exhausted, 1);
    assert.equal((await emit({ ...config, maxEvents: 1 }, { ...event, eventKey: 'overflow' })).status, 'unavailable');
    assert.equal((await status(config)).rejected, 1);
    assert.equal((await emit({ ...config, enabled: false }, event)).status, 'disabled');
  } finally { server.closeAllConnections(); await new Promise((r) => server.close(r)); await rm(dir, { recursive: true, force: true }); }
});

test('a bounded hook advances without resending acknowledged requests or moving their attempt', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'skill-hook-bound-'));
  const delivered = new Set();
  const posts = [];
  const server = createServer(async (req, res) => {
    let raw = ''; for await (const chunk of req) raw += chunk;
    const span = JSON.parse(raw).resourceSpans?.[0].scopeSpans[0].spans[0];
    if (span) { delivered.add(span.spanId); posts.push(span); }
    res.writeHead(200, { 'content-type': 'application/json' }); res.end('{}');
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  try {
    await writeFile(join(dir, 'SKILL.md'), 'instructions');
    const transcript = join(dir, 'session.jsonl');
    const rows = Array.from({ length: 5 }, (_, i) => ({ type: 'assistant', timestamp: '2026-10-29T18:00:01Z', message: { id: 'request-' + i, usage: { input_tokens: 1, output_tokens: 1 } } }));
    await writeFile(transcript, rows.map(JSON.stringify).join('\n'));
    const config = { enabled: true, directory: join(dir, 'outbox'), endpoint: `http://127.0.0.1:${server.address().port}`, publicKey: 'test', secretKey: 'test', maxEvents: 3, since: '2026-10-29T18:00:00Z', skillDirectory: dir, context: { workflow: 'w', attempt: 'a', invocation: 'root', skill: 'research', session: 's' } };
    const result = await captureHook(config, 'claude', { session_id: 's', transcript_path: transcript });
    assert.equal(delivered.size, 3, 'accepted events must flush despite bounded rejection');
    assert.equal(result.status, 'unavailable');
    assert.equal(result.delivery.pending, 0);
    assert.equal((await status(config)).rejected, 1);
    await captureHook(config, 'claude', { session_id: 's', transcript_path: transcript });
    assert.equal(delivered.size, 5, 'later hooks must reach requests beyond the first queue batch');
    const resumed = { ...config, context: { ...config.context, attempt: 'b' } };
    await captureHook(resumed, 'claude', { session_id: 's', transcript_path: transcript });
    assert.equal(posts.length, 5, 'acknowledged requests must not be uploaded again');
    rows[0].message.usage.output_tokens = 2;
    rows.push({ ...rows[1], message: { ...rows[1].message, id: 'new-request' } });
    await writeFile(transcript, rows.map(JSON.stringify).join('\n'));
    await captureHook(resumed, 'claude', { session_id: 's', transcript_path: transcript });
    assert.equal(posts.length, 7, 'late usage updates and new requests must still upload');
    const attempt = (span) => span.attributes.find((a) => a.key === 'langfuse.observation.metadata.attempt').value.stringValue;
    const latest = (id) => posts.filter((span) => span.spanId === digest(JSON.stringify(['claude', 's', id])).slice(0, 16)).at(-1);
    assert.equal(attempt(latest('request-0')), 'a', 'an updated old request keeps its original attempt');
    assert.equal(attempt(latest('new-request')), 'b');
  } finally { server.closeAllConnections(); await new Promise((r) => server.close(r)); await rm(dir, { recursive: true, force: true }); }
});

test('expected failing tests stay distinct from evidence failures at the backend boundary', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'skill-expected-red-'));
  const bodies = [];
  const server = createServer(async (req, res) => {
    let raw = ''; for await (const chunk of req) raw += chunk;
    bodies.push(JSON.parse(raw));
    res.writeHead(200, { 'content-type': 'application/json' }); res.end('{}');
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  try {
    const config = { enabled: true, directory: dir, endpoint: `http://127.0.0.1:${server.address().port}`, publicKey: 'test', secretKey: 'test' };
    const head = 'a'.repeat(40);
    const evidence = [{ uri: 'https://example.org/evidence', sha256: 'b'.repeat(64), head, result: 'fail', expires: '2100-01-01T00:00:00Z' }];
    for (const reason of ['expected-red', 'recovered', 'unrecovered']) {
      await emit(config, { ...event, kind: 'gate', eventKey: reason, head, evidence, outcome: 'failed', reason, judge: 'node-test', rubric: 'acceptance/v1' });
      await flush(config);
    }
    assert.equal(bodies.filter((b) => b.name === 'evidence-failure').length, 1, 'only unrecovered failure should alert');
    assert.equal(bodies.filter((b) => b.resourceSpans?.[0].scopeSpans[0].spans[0].attributes.some((a) => a.key === 'langfuse.observation.level' && a.value.stringValue === 'ERROR')).length, 1);
  } finally { server.closeAllConnections(); await new Promise((r) => server.close(r)); await rm(dir, { recursive: true, force: true }); }
});

test('a hook reaches new requests within the session-end deadline after a large acknowledged history', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'skill-hook-history-'));
  let tailDelivered = false;
  const server = createServer(async (req, res) => {
    let raw = ''; for await (const chunk of req) raw += chunk;
    const span = JSON.parse(raw).resourceSpans?.[0].scopeSpans[0].spans[0];
    if (span?.attributes.some((a) => a.key === 'langfuse.observation.metadata.turn' && a.value.stringValue === 'tail')) tailDelivered = true;
    res.writeHead(200, { 'content-type': 'application/json' }); res.end('{}');
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  try {
    await writeFile(join(dir, 'SKILL.md'), 'instructions');
    const transcript = join(dir, 'session.jsonl');
    const rows = Array.from({ length: 2000 }, (_, i) => ({ type: 'assistant', timestamp: '2026-10-29T18:00:01Z', message: { id: 'request-' + i, usage: { input_tokens: 1, output_tokens: 1 } } }));
    await writeFile(transcript, rows.map(JSON.stringify).join('\n'));
    const config = { enabled: true, directory: join(dir, 'outbox'), endpoint: `http://127.0.0.1:${server.address().port}`, publicKey: 'test', secretKey: 'test', maxEvents: 3000, timeoutMs: 30000, since: '2026-10-29T18:00:00Z', skillDirectory: dir, context: { workflow: 'w', attempt: 'a', invocation: 'root', skill: 'research', session: 's' } };
    const seeded = await captureHook(config, 'claude', { session_id: 's', transcript_path: transcript });
    assert.equal(seeded.delivery.remembered, 2000);
    config.context.turn = 'tail';
    const configPath = join(dir, 'config.json');
    await writeFile(configPath, JSON.stringify(config), { mode: 0o600 });
    rows.push({ ...rows[0], message: { ...rows[0].message, id: 'tail-request' } });
    await writeFile(transcript, rows.map(JSON.stringify).join('\n'));
    const started = performance.now();
    const child = spawn(process.execPath, [new URL('../cli.mjs', import.meta.url).pathname, 'hook', 'claude'], { env: { ...process.env, SKILL_OBSERVABILITY_CONFIG: configPath }, timeout: 3000 });
    const finished = new Promise((resolve) => child.on('close', (code, signal) => resolve({ code, signal })));
    child.stdin.end(JSON.stringify({ session_id: 's', transcript_path: transcript }));
    let output = ''; for await (const chunk of child.stdout) output += chunk;
    const result = await finished;
    assert.equal(tailDelivered, true, 'new requests must reach the receiver before the 3-second host deadline');
    assert.equal(result.code, 0);
    assert.equal(JSON.parse(output).delivery.delivered, 1);
    t.diagnostic(`repeat CLI hook with 2000 acknowledgements and one new request: ${(performance.now() - started).toFixed(0)} ms`);
  } finally { server.closeAllConnections(); await new Promise((r) => server.close(r)); await rm(dir, { recursive: true, force: true }); }
});
