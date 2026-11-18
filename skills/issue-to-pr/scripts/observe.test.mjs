import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { currentSession, observe } from './observe.mjs';

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

test('each marker also captures the owning session transcript for either runtime', async () => {
  const transcripts = {
    claude: (root) => ({ env: { CLAUDE_CODE_SESSION_ID: 'claude-session', CLAUDE_CONFIG_DIR: root }, path: join(root, 'projects', '-work', 'claude-session.jsonl'),
      rows: [{ type: 'assistant', timestamp: '2026-11-01T10:00:00Z', message: { id: 'msg-1', model: 'claude-opus-5-5', usage: { input_tokens: 100, output_tokens: 20, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } } }] }),
    codex: (root) => ({ env: { CODEX_THREAD_ID: 'codex-thread', CODEX_HOME: root }, path: join(root, 'sessions', '2026', '11', '01', 'rollout-2026-11-01T10-00-00-codex-thread.jsonl'),
      rows: [{ type: 'event_msg', timestamp: '2026-11-01T10:00:00Z', payload: { type: 'token_count', info: { total_token_usage: { input_tokens: 100, cached_input_tokens: 0, output_tokens: 20, reasoning_output_tokens: 5 } } } }] }),
  };
  for (const [runtime, transcript] of Object.entries(transcripts)) {
    const directory = await mkdtemp(join(tmpdir(), 'skill-observe-'));
    const posts = [];
    const server = createServer(async (req, res) => {
      let body = ''; for await (const chunk of req) body += chunk;
      posts.push(JSON.parse(body));
      res.writeHead(200, { 'content-type': 'application/json' }); res.end('{}');
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    try {
      const { env, path, rows } = transcript(directory);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, rows.map((row) => JSON.stringify(row)).join('\n') + '\n');
      const record = join(directory, '150.md');
      await writeFile(record, 'repo: example/skills\nissue: 150\nhead: owner-head\nstage: building\ntelemetry_workflow: owner-workflow\ntelemetry_attempt: owner-attempt\n');
      const config = { enabled: true, directory: join(directory, 'outbox'), endpoint: `http://127.0.0.1:${server.address().port}`, publicKey: 'test', secretKey: 'test', since: '2026-11-01T00:00:00Z', context: { workflow: 'wrong-config-workflow' } };
      const result = await observe(record, { kind: 'stage', eventKey: 'building', execution: 'running' }, config, env);
      assert.equal(result.status, 'accepted', runtime);
      assert.equal(result.usage.status, 'captured', runtime);
      assert.equal(result.usage.accepted, 1, runtime);
      const spans = posts.flatMap((post) => post.resourceSpans?.[0].scopeSpans[0].spans ?? []);
      const request = spans.find((span) => span.name === 'provider.request');
      const attribute = (key) => request.attributes.find((a) => a.key === key)?.value.stringValue;
      assert.equal(attribute('session.id'), 'owner-workflow', runtime);
      assert.equal(attribute('langfuse.observation.metadata.session'), `${runtime}-${runtime === 'claude' ? 'session' : 'thread'}`, runtime);
    } finally { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); await rm(directory, { recursive: true, force: true }); }
  }
});

test('a marker outside an agent session records no usage', async () => {
  assert.equal(await currentSession({}), null);
  assert.equal(await currentSession({ CLAUDE_CODE_SESSION_ID: '../escape' }), null);
});

test('helper coverage becomes complete only after every declared helper has captured counters', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'skill-coverage-'));
  const posts = [];
  const server = createServer(async (req, res) => {
    let body = ''; for await (const chunk of req) body += chunk;
    posts.push(JSON.parse(body)); res.writeHead(200); res.end('{}');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const record = join(directory, '.agent/issue-to-pr/shop/1.md');
    await mkdir(dirname(record), { recursive: true });
    await writeFile(record, 'repo: example/shop\nissue: 1\nhead: abc123\nstage: done\ntelemetry_workflow: run-1\n');
    const briefs = {};
    const brief = async (id, role) => briefs[id] = (await promisify(execFile)(process.execPath, [fileURLToPath(new URL('./helper-brief.mjs', import.meta.url)), record, role, id])).stdout.trim();
    await brief('review-standards', 'reviewer');
    const config = { enabled: true, directory: join(directory, 'state/outbox'), endpoint: `http://127.0.0.1:${server.address().port}`, publicKey: 'test', secretKey: 'test', since: '2000-01-01T00:00:00Z' };
    const mark = (eventKey) => observe(record, { kind: 'stage', eventKey, childCoverage: 'complete' }, config, {});
    const coverage = () => {
      const span = posts.filter((p) => p.resourceSpans).at(-1).resourceSpans[0].scopeSpans[0].spans[0];
      return span.attributes.find((a) => a.key === 'langfuse.observation.metadata.childCoverage')?.value.stringValue;
    };
    await mark('before');
    assert.equal(coverage(), 'partial');
    const { watch } = await import('./watch.mjs');
    const path = join(directory, '.claude/projects/shop/child.jsonl');
    await mkdir(dirname(path), { recursive: true });
    const rows = (id, withUsage = true) => [
      { type: 'user', sessionId: id, message: { content: briefs[id] } },
      ...(withUsage ? [{ type: 'assistant', sessionId: id, timestamp: '2026-11-18T10:00:00Z', message: { id, usage: { input_tokens: 10, output_tokens: 2, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } } }] : []),
    ].map(JSON.stringify).join('\n') + '\n';
    await writeFile(path, rows('review-standards'));
    await watch(config, directory);
    assert.equal(coverage(), 'complete', 'the first watcher marker includes receipts from the same pass');
    await brief('verify', 'verifier');
    await writeFile(path + '-verify.jsonl', rows('verify', false));
    await watch(config, directory);
    assert.equal(coverage(), 'partial');
    const partial = posts.filter((p) => p.resourceSpans).at(-1).resourceSpans[0].scopeSpans[0].spans[0];
    await writeFile(path + '-verify.jsonl', rows('verify'));
    await watch(config, directory);
    assert.equal(coverage(), 'complete');
    const complete = posts.filter((p) => p.resourceSpans).at(-1).resourceSpans[0].scopeSpans[0].spans[0];
    assert.equal(complete.spanId, partial.spanId, 'receipt changes refresh the existing stage observation');
    assert.equal((await watch(config, directory)).markers, 0, 'unchanged coverage does not emit another marker');
    const noInventory = join(directory, 'unknown.md');
    await writeFile(noInventory, 'repo: example/shop\nissue: 2\nhead: abc123\nstage: building\n');
    await observe(noInventory, { kind: 'stage', eventKey: 'unknown' }, config, {});
    assert.equal(coverage(), 'unknown');
    const malformed = 'repo: example/shop\nissue: 2\ntelemetry_helpers: ["unfinished"\n';
    await writeFile(noInventory, malformed);
    await assert.rejects(promisify(execFile)(process.execPath, [fileURLToPath(new URL('./helper-brief.mjs', import.meta.url)), noInventory, 'reviewer', 'next']), /invalid telemetry_helpers/);
    assert.equal(await readFile(noInventory, 'utf8'), malformed);
  } finally { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); await rm(directory, { recursive: true, force: true }); }
});
