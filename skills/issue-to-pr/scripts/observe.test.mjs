import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

test('the installed CLI delivers owner-header metadata without changing the run record', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'skill-observe-'));
  const posts = [];
  const server = createServer(async (req, res) => {
    let body = ''; for await (const chunk of req) body += chunk;
    posts.push(JSON.parse(body));
    res.writeHead(200, { 'content-type': 'application/json' }); res.end('{}');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const installed = join(directory, 'issue-to-pr');
    await symlink(fileURLToPath(new URL('..', import.meta.url)), installed, 'dir');
    const record = join(directory, '148.md');
    const original = 'repo: example/skills\nissue: https://github.com/example/skills/issues/148\nhead: owner-head\nstage: watching: external\ntelemetry_workflow: owner-workflow\ntelemetry_attempt: owner-attempt\n\n## Contract\nPreserve this record.\n';
    await writeFile(record, original);
    const marker = join(directory, 'marker.json');
    await writeFile(marker, JSON.stringify({ kind: 'resumed', eventKey: 'resume', execution: 'running', head: 'wrong-input-head', workflow: 'wrong-input-workflow' }));
    const config = join(directory, 'config.json');
    await writeFile(config, JSON.stringify({ enabled: true, directory: join(directory, 'outbox'), endpoint: `http://127.0.0.1:${server.address().port}`, publicKey: 'test', secretKey: 'test', context: { workflow: 'wrong-config-workflow', attempt: 'wrong-config-attempt' } }), { mode: 0o600 });
    const { stdout } = await promisify(execFile)(process.execPath, [join(installed, 'scripts', 'observe.mjs'), record, marker], { env: { ...process.env, SKILL_OBSERVABILITY_CONFIG: config }, timeout: 10000 });
    assert.notEqual(stdout.trim(), '', 'installed invocation must print its delivery status');
    const result = JSON.parse(stdout);
    assert.equal(result.status, 'accepted');
    assert.equal(result.delivery.delivered, 1);
    const span = posts[0].resourceSpans[0].scopeSpans[0].spans[0];
    const metadata = Object.fromEntries(span.attributes.filter((a) => a.key.startsWith('langfuse.observation.metadata.')).map((a) => [a.key.slice('langfuse.observation.metadata.'.length), a.value.stringValue]));
    assert.equal(metadata.workflow, 'owner-workflow');
    assert.equal(metadata.attempt, 'owner-attempt');
    assert.equal(metadata.head, 'owner-head');
    assert.equal(metadata.repository, 'example/skills');
    assert.equal(metadata.stage, 'watching');
    assert.equal(metadata.invocation, 'issue-to-pr');
    assert.equal(metadata.kind, 'resumed');
    assert.equal(await readFile(record, 'utf8'), original);
  } finally { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); await rm(directory, { recursive: true, force: true }); }
});
