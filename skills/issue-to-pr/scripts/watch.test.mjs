import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { watch } from './watch.mjs';

const write = async (path, text) => { await mkdir(dirname(path), { recursive: true }); await writeFile(path, text); };
const jsonl = (rows) => rows.map((row) => JSON.stringify(row)).join('\n') + '\n';

test('the watcher sends a run\'s stage and its own sessions\' usage, once', async () => {
  const home = await mkdtemp(join(tmpdir(), 'skill-watch-'));
  const spans = [];
  const server = createServer(async (req, res) => {
    let body = ''; for await (const chunk of req) body += chunk;
    spans.push(...(JSON.parse(body).resourceSpans?.[0].scopeSpans[0].spans ?? []));
    res.writeHead(200, { 'content-type': 'application/json' }); res.end('{}');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    await write(join(home, '.agent', 'issue-to-pr', 'shop', '7.md'), 'issue: 7\nrepo: example/shop\nbranch: fix/7-cart\nstage: awaiting-human (owner review)\nhead: abc123\n\n## Contract\n');
    const worktree = join(home, '.t3', 'worktrees', 'shop', 'fix-7-cart');
    const usage = { input_tokens: 100, output_tokens: 20, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 };
    await write(join(home, '.claude', 'projects', '-shop', 'owner.jsonl'), jsonl([
      { type: 'assistant', sessionId: 'owner', cwd: worktree, gitBranch: 'fix/7-cart', timestamp: '2026-11-02T10:00:00Z', message: { id: 'msg-owner', usage } },
    ]));
    await write(join(home, '.codex', 'sessions', '2026', '11', '02', 'rollout-x-helper.jsonl'), jsonl([
      { type: 'session_meta', payload: { id: 'helper', cwd: worktree, git: { branch: 'fix/7-cart', repository_url: 'https://github.com/example/shop.git' } } },
      { type: 'event_msg', timestamp: '2026-11-02T10:01:00Z', payload: { type: 'token_count', info: { total_token_usage: { input_tokens: 50, cached_input_tokens: 0, output_tokens: 5, reasoning_output_tokens: 1 } } } },
    ]));
    await write(join(home, '.claude', 'projects', '-other', 'bystander.jsonl'), jsonl([
      { type: 'assistant', sessionId: 'bystander', cwd: join(home, 'code', 'shop'), gitBranch: 'main', timestamp: '2026-11-02T10:00:00Z', message: { id: 'msg-bystander', usage } },
    ]));
    await write(join(home, '.codex', 'sessions', '2026', '11', '02', 'rollout-x-namesake.jsonl'), jsonl([
      { type: 'session_meta', payload: { id: 'namesake', cwd: join(home, 'other', 'shop'), git: { branch: 'fix/7-cart', repository_url: 'https://github.com/other/shop.git' } } },
      { type: 'event_msg', timestamp: '2026-11-02T10:01:00Z', payload: { type: 'token_count', info: { total_token_usage: { input_tokens: 9, cached_input_tokens: 0, output_tokens: 9, reasoning_output_tokens: 0 } } } },
    ]));
    const config = { enabled: true, directory: join(home, 'state', 'outbox'), endpoint: `http://127.0.0.1:${server.address().port}`, publicKey: 'test', secretKey: 'test', since: '2000-01-01T00:00:00Z', context: { attempt: 'attempt' } };

    assert.deepEqual(await watch(config, home), { status: 'watched', markers: 1, transcripts: 2, requests: 2, unavailable: 0, pending: 0, exhausted: 0 });
    const metadata = (span, key) => span.attributes.find((a) => a.key === 'langfuse.observation.metadata.' + key)?.value.stringValue;
    const stage = spans.find((span) => span.name === 'stage');
    assert.equal(metadata(stage, 'stage'), 'awaiting-human');
    assert.equal(metadata(stage, 'execution'), 'waiting-human');
    const requests = spans.filter((span) => span.name === 'provider.request');
    assert.deepEqual(requests.map((span) => metadata(span, 'session')).sort(), ['helper', 'owner']);
    assert.ok(requests.every((span) => metadata(span, 'workflow') === metadata(stage, 'workflow')));

    spans.length = 0;
    assert.deepEqual(await watch(config, home), { status: 'watched', markers: 0, transcripts: 0, requests: 0, unavailable: 0, pending: 0, exhausted: 0 });
    assert.equal(spans.length, 0);
  } finally { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); await rm(home, { recursive: true, force: true }); }
});

test('a transcript whose capture fails is tried again on the next run', async () => {
  const home = await mkdtemp(join(tmpdir(), 'skill-watch-'));
  try {
    await write(join(home, '.agent', 'issue-to-pr', 'shop', '7.md'), 'issue: 7\nrepo: example/shop\nbranch: fix/7-cart\nstage: building\nhead: abc123\n');
    const count = (input) => ({ type: 'event_msg', timestamp: '2026-11-02T10:01:00Z', payload: { type: 'token_count', info: { total_token_usage: { input_tokens: input, cached_input_tokens: 0, output_tokens: 1, reasoning_output_tokens: 0 } } } });
    await write(join(home, '.codex', 'sessions', 'rollout-x-reset.jsonl'), jsonl([
      { type: 'session_meta', payload: { id: 'reset', cwd: join(home, 'shop'), git: { branch: 'fix/7-cart', repository_url: 'https://github.com/example/shop.git' } } },
      count(50), count(10),
    ]));
    const config = { enabled: true, directory: join(home, 'state', 'outbox'), endpoint: 'http://127.0.0.1:9', publicKey: 'test', secretKey: 'test', timeoutMs: 200, since: '2000-01-01T00:00:00Z', context: { attempt: 'attempt' } };
    for (let i = 0; i < 2; i++) {
      const summary = await watch(config, home);
      assert.equal(summary.unavailable, 1);
      assert.equal(summary.pending, 1, 'the undelivered stage marker shows as pending');
    }
  } finally { await rm(home, { recursive: true, force: true }); }
});

test('a session seen before its record names the branch is captured once the record does', async () => {
  const home = await mkdtemp(join(tmpdir(), 'skill-watch-'));
  const spans = [];
  const server = createServer(async (req, res) => {
    let body = ''; for await (const chunk of req) body += chunk;
    spans.push(...(JSON.parse(body).resourceSpans?.[0].scopeSpans[0].spans ?? []));
    res.writeHead(200, { 'content-type': 'application/json' }); res.end('{}');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const record = join(home, '.agent', 'issue-to-pr', 'shop', '7.md');
    await write(record, 'issue: 7\nrepo: example/shop\nstage: contract\nhead: abc123\n');
    await write(join(home, '.claude', 'projects', '-shop', 'owner.jsonl'), jsonl([
      { type: 'assistant', sessionId: 'owner', cwd: join(home, 'shop'), gitBranch: 'fix/7-cart', timestamp: '2026-11-02T10:00:00Z', message: { id: 'msg-owner', usage: { input_tokens: 1, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } } },
    ]));
    const config = { enabled: true, directory: join(home, 'state', 'outbox'), endpoint: `http://127.0.0.1:${server.address().port}`, publicKey: 'test', secretKey: 'test', since: '2000-01-01T00:00:00Z', context: { attempt: 'attempt' } };
    assert.equal((await watch(config, home)).requests, 0);
    await write(record, 'issue: 7\nrepo: example/shop\nbranch: fix/7-cart\nstage: building\nhead: abc123\n');
    assert.equal((await watch(config, home)).requests, 1);
    assert.equal(spans.filter((span) => span.name === 'provider.request').length, 1);
  } finally { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); await rm(home, { recursive: true, force: true }); }
});

test('a session that worked on two runs is not counted, and a repeated stage sends a new marker', async () => {
  const home = await mkdtemp(join(tmpdir(), 'skill-watch-'));
  const spans = [];
  const server = createServer(async (req, res) => {
    let body = ''; for await (const chunk of req) body += chunk;
    spans.push(...(JSON.parse(body).resourceSpans?.[0].scopeSpans[0].spans ?? []));
    res.writeHead(200, { 'content-type': 'application/json' }); res.end('{}');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const record = (n, stage) => write(join(home, '.agent', 'issue-to-pr', 'shop', `${n}.md`), `issue: ${n}\nrepo: example/shop\nbranch: fix/${n}\nstage: ${stage}\nhead: abc123\n`);
    await record(1, 'building'); await record(2, 'building');
    const usage = { input_tokens: 1, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 };
    await write(join(home, '.claude', 'projects', '-shop', 'stack.jsonl'), jsonl([1, 2].map((n) => (
      { type: 'assistant', sessionId: 'stack', cwd: join(home, 'shop'), gitBranch: `fix/${n}`, timestamp: '2026-11-02T10:00:00Z', message: { id: `msg-${n}`, usage } }))));
    const config = { enabled: true, directory: join(home, 'state', 'outbox'), endpoint: `http://127.0.0.1:${server.address().port}`, publicKey: 'test', secretKey: 'test', since: '2000-01-01T00:00:00Z', context: { attempt: 'attempt' } };
    assert.deepEqual(await watch(config, home), { status: 'watched', markers: 2, transcripts: 0, requests: 0, unavailable: 0, pending: 0, exhausted: 0 });
    const later = async (stage) => { await new Promise((resolve) => setTimeout(resolve, 5)); await record(1, stage); return watch(config, home); };
    await later('awaiting-human');
    assert.equal((await later('building')).markers, 1);
    assert.equal(new Set(spans.filter((span) => span.name === 'stage').map((span) => span.spanId)).size, 4);
  } finally { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); await rm(home, { recursive: true, force: true }); }
});
