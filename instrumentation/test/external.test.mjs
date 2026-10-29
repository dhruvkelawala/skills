import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { recordExternal } from '../external.mjs';

test('an outside skill records its actual revision, artifact and assessed sources without issue-to-pr fields or source copies', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'outside-skill-'));
  const received = [];
  const server = createServer(async (req, res) => {
    let raw = ''; for await (const chunk of req) raw += chunk;
    const body = JSON.parse(raw); received.push(body);
    res.writeHead(207, { 'content-type': 'application/json' }); res.end(JSON.stringify({}));
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  try {
    const skill = join(dir, 'skill'); await mkdir(skill); await writeFile(join(skill, 'SKILL.md'), 'external instructions');
    const artifact = join(dir, 'findings.md'); await writeFile(artifact, 'Private findings with a cited claim.');
    const config = { enabled: true, directory: join(dir, 'outbox'), endpoint: `http://127.0.0.1:${server.address().port}`, publicKey: 'test', secretKey: 'test', context: { workflow: 'research-w', attempt: 'research-a', invocation: 'research', skill: 'research' } };
    const result = await recordExternal(config, { phase: 'finish', skillDirectory: skill, artifact, artifactUri: 'https://github.com/example/repo/blob/main/research/findings.md', sources: [{ uri: 'https://example.org/spec', sha256: 'c'.repeat(64), head: 'a'.repeat(40), result: 'unknown' }], head: 'a'.repeat(40), eventKey: 'finish' });
    assert.equal(result.status, 'accepted');
    const attrs = received[0].resourceSpans[0].scopeSpans[0].spans[0].attributes;
    const event = Object.fromEntries(attrs.filter((a) => a.key.startsWith('langfuse.observation.metadata.')).map((a) => { const value = a.value.stringValue; let parsed; try { parsed = JSON.parse(value); } catch { parsed = value; } return [a.key.slice('langfuse.observation.metadata.'.length), parsed]; }));
    assert.match(event.revision, /^[a-f0-9]{64}$/);
    assert.match(event.artifact.sha256, /^[a-f0-9]{64}$/);
    assert.equal(event.artifact.uri, 'https://github.com/example/repo/blob/main/research/findings.md');
    assert.equal(event.evidence[0].uri, 'https://example.org/spec');
    assert.equal(event.outcome, 'unknown');
    assert.equal(event.execution, 'completed');
    assert.ok(!JSON.stringify(received).includes('Private findings'));
    assert.ok(!JSON.stringify(received).includes('external instructions'));
  } finally { server.closeAllConnections(); await new Promise((r) => server.close(r)); await rm(dir, { recursive: true, force: true }); }
});
