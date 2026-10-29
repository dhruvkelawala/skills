import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { emit, flush, status } from '../delivery.mjs';

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
