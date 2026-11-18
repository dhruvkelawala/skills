import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { appendFile, mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
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
      { type: 'assistant', sessionId: 'bystander', cwd: join(home, 'code', 'tools'), gitBranch: 'fix/7-cart', timestamp: '2026-11-02T10:00:01Z', message: { id: 'msg-bystander-2', usage } },
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
    assert.ok(requests.every((span) => metadata(span, 'helper') === 'build'));

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

test('each run gets its own attempt, and only records directly in a repository folder are runs', async () => {
  const home = await mkdtemp(join(tmpdir(), 'skill-watch-'));
  const spans = [];
  const server = createServer(async (req, res) => {
    let body = ''; for await (const chunk of req) body += chunk;
    spans.push(...(JSON.parse(body).resourceSpans?.[0].scopeSpans[0].spans ?? []));
    res.writeHead(200, { 'content-type': 'application/json' }); res.end('{}');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const text = (n) => `issue: ${n}\nrepo: example/shop\nbranch: fix/${n}\nstage: building\nhead: abc123\n`;
    await write(join(home, '.agent', 'issue-to-pr', 'shop', '1.md'), text(1));
    await write(join(home, '.agent', 'issue-to-pr', 'shop', '2.md'), text(2));
    await write(join(home, '.agent', 'issue-to-pr', 'shop', 'evidence-1', 'copy', '1.md'), text(1));
    await write(join(home, '.claude', 'projects', '-shop', 'owner.jsonl'), jsonl([
      { type: 'assistant', sessionId: 'owner', cwd: join(home, 'shop'), gitBranch: 'fix/1', timestamp: '2026-11-02T10:00:00Z', message: { id: 'msg-1', usage: { input_tokens: 1, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } } },
    ]));
    const config = { enabled: true, directory: join(home, 'state', 'outbox'), endpoint: `http://127.0.0.1:${server.address().port}`, publicKey: 'test', secretKey: 'test', since: '2000-01-01T00:00:00Z', context: { attempt: 'machine-attempt' } };
    assert.deepEqual(await watch(config, home), { status: 'watched', markers: 2, transcripts: 1, requests: 1, unavailable: 0, pending: 0, exhausted: 0 });
    const attempt = (span) => span.attributes.find((a) => a.key === 'langfuse.observation.metadata.attempt').value.stringValue;
    const attempts = spans.filter((span) => span.name === 'stage').map(attempt);
    assert.equal(new Set(attempts).size, 2);
    assert.ok(!attempts.includes('machine-attempt'));
  } finally { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); await rm(home, { recursive: true, force: true }); }
});

test('the first task run marker owns a helper regardless of its branch', async () => {
  const home = await mkdtemp(join(tmpdir(), 'skill-watch-'));
  const spans = [];
  const server = createServer(async (req, res) => {
    let body = ''; for await (const chunk of req) body += chunk;
    spans.push(...(JSON.parse(body).resourceSpans?.[0].scopeSpans[0].spans ?? []));
    res.writeHead(200, { 'content-type': 'application/json' }); res.end('{}');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    for (const n of [1, 2]) await write(join(home, '.agent', 'issue-to-pr', 'shop', `${n}.md`), `issue: ${n}\nrepo: example/shop\nbranch: fix/${n}\nstage: building\nhead: abc123\ntelemetry_workflow: run-${n}\n`);
    const cases = [
      ['verifier', 'issue-to-pr-run: run-1', null],
      ['other-branch', 'issue-to-pr-run: run-1', null, 'fix/2'],
      ['autoreview', 'issue-to-pr-run: run-1', null, 'fix/2', 'autoreview'],
      ['two-runs', 'issue-to-pr-run: run-1\nissue-to-pr-run: run-2', null],
      ['two-runs-on-branch', 'issue-to-pr-run: run-1\nissue-to-pr-run: run-2', null, 'fix/2'],
      ['late', 'Review this patch.', 'issue-to-pr-run: run-1'],
      ['unknown', 'issue-to-pr-run: unknown', null],
      ['known-and-unknown', 'issue-to-pr-run: run-1\nissue-to-pr-run: unknown', null],
    ];
    for (const runtime of ['claude', 'codex']) for (const [name, first, later, branch = 't3/isolated', role = 'verifier'] of cases) {
      const id = `${runtime}-${name}`;
      const user = (text) => runtime === 'claude' ? { type: 'user', message: { role: 'user', content: text } } : { type: 'response_item', payload: { type: 'message', role: 'user', content: [{ type: 'input_text', text }] } };
      const rows = runtime === 'claude' ? [
        { type: 'assistant', sessionId: id, cwd: join(home, 'shop'), gitBranch: branch, timestamp: '2026-11-18T10:00:00Z', message: { id, usage: { input_tokens: 10, output_tokens: 2, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } } },
      ] : [
        { type: 'session_meta', payload: { id, cwd: join(home, 'shop'), git: { branch } } },
        { type: 'event_msg', timestamp: '2026-11-18T10:00:00Z', payload: { type: 'token_count', info: { total_token_usage: { input_tokens: 10, output_tokens: 2 } } } },
      ];
      if (runtime === 'codex') rows.splice(1, 0, user('# AGENTS.md instructions for /work\n<INSTRUCTIONS>\nissue-to-pr-run: run-2\n</INSTRUCTIONS><environment_context>host setup</environment_context>'));
      rows.splice(runtime === 'codex' ? 2 : 1, 0, user(first + '\nissue-to-pr-helper: ' + role));
      if (name == 'verifier') rows.push(user('issue-to-pr-helper: council'));
      if (later) rows.push(user(later));
      await write(join(home, `.${runtime}`, runtime === 'claude' ? 'projects/shop' : 'sessions', `${id}.jsonl`), jsonl(rows));
    }
    const config = { enabled: true, directory: join(home, 'state', 'outbox'), endpoint: `http://127.0.0.1:${server.address().port}`, publicKey: 'test', secretKey: 'test', since: '2000-01-01T00:00:00Z' };
    await watch(config, home);
    const requests = spans.filter((span) => span.name === 'provider.request');
    const metadata = (span, key) => span.attributes.find((a) => a.key === 'langfuse.observation.metadata.' + key)?.value.stringValue;
    assert.deepEqual(requests.map((span) => metadata(span, 'session')).sort(), ['claude-autoreview', 'claude-other-branch', 'claude-verifier', 'codex-autoreview', 'codex-other-branch', 'codex-verifier']);
    assert.ok(requests.every((span) => metadata(span, 'workflow') === 'run-1'));
    assert.ok(requests.every((span) => metadata(span, 'helper') === (metadata(span, 'session').endsWith('-autoreview') ? 'autoreview' : 'verifier')));
  } finally { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); await rm(home, { recursive: true, force: true }); }
});


test('the watcher captures usage at the end of a transcript over 64 MB within a 48 MB heap', async () => {
  const home = await mkdtemp(join(tmpdir(), 'skill-watch-large-'));
  const spans = [];
  const server = createServer(async (req, res) => {
    let body = ''; for await (const chunk of req) body += chunk;
    spans.push(...(JSON.parse(body).resourceSpans?.[0].scopeSpans[0].spans ?? []));
    res.writeHead(200, { 'content-type': 'application/json' }); res.end('{}');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    await write(join(home, '.agent/issue-to-pr/shop/1.md'), 'issue: 1\nrepo: example/shop\nbranch: fix/1\nstage: building\nhead: abc123\n');
    const path = join(home, '.codex/sessions/large.jsonl');
    await write(path, jsonl([{ type: 'session_meta', payload: { id: 'large', cwd: join(home, 'shop'), git: { branch: 'fix/1' } } }]));
    const block = jsonl([{ type: 'response_item', payload: { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'x'.repeat(1024 * 1024) }] } }]);
    for (let n = 0; n < 65; n++) await appendFile(path, block);
    await appendFile(path, jsonl([{ type: 'event_msg', timestamp: '2026-11-18T10:00:00Z', payload: { type: 'token_count', info: { total_token_usage: { input_tokens: 123, output_tokens: 17 } } } }]));
    assert.ok((await stat(path)).size > 64 * 1024 * 1024);
    const config = { enabled: true, directory: join(home, 'state/outbox'), endpoint: `http://127.0.0.1:${server.address().port}`, publicKey: 'test', secretKey: 'test', since: '2000-01-01T00:00:00Z' };
    const code = `import { watch } from ${JSON.stringify(new URL('./watch.mjs', import.meta.url).href)}; console.log(JSON.stringify(await watch(${JSON.stringify(config)}, ${JSON.stringify(home)})));`;
    const { stdout } = await promisify(execFile)(process.execPath, ['--max-old-space-size=48', '--input-type=module', '-e', code], { timeout: 30000 });
    assert.equal(JSON.parse(stdout).requests, 1);
    assert.equal(spans.filter((span) => span.name === 'provider.request').length, 1);
    const usage = spans.find((span) => span.name === 'provider.request').attributes.find((a) => a.key === 'langfuse.observation.usage_details').value.stringValue;
    assert.deepEqual(JSON.parse(usage), { input: 123, output: 17 });
  } finally { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); await rm(home, { recursive: true, force: true }); }
});

test('autoreview sidecars capture both engines once under the run', async () => {
  const home = await mkdtemp(join(tmpdir(), 'skill-watch-review-'));
  const spans = [];
  const server = createServer(async (req, res) => {
    let body = ''; for await (const chunk of req) body += chunk;
    spans.push(...(JSON.parse(body).resourceSpans?.[0].scopeSpans[0].spans ?? []));
    res.writeHead(200); res.end('{}');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const root = join(home, '.agent/issue-to-pr/shop');
    await write(join(root, '1.md'), 'issue: 1\nrepo: example/shop\nbranch: fix/1\nstage: reviewed\nhead: abc123\ntelemetry_workflow: run-1\ntelemetry_helpers: ["opinion-codex","opinion-claude"]\n');
    const cases = [
      ['codex', { input_tokens: 100, cached_input_tokens: 30, output_tokens: 20, reasoning_output_tokens: 5 }],
      ['claude', { input_tokens: 10, cache_read_input_tokens: 30, cache_creation_input_tokens: 40, output_tokens: 20 }],
    ];
    const sidecar = (engine, tokens, complete) => JSON.stringify({ schema_version: 1, engine, model: [`${engine}-model`], status: 'clean', usage: { tokens, complete, attempts: 1, reported_attempts: 1, unknown_attempts: complete ? 0 : 1, partial_attempts: 0 } });
    for (const [engine, tokens] of cases) await write(join(root, `1.autoreview-opinion-${engine}.json`), sidecar(engine, tokens, engine === 'codex'));
    const config = { enabled: true, directory: join(home, 'state/outbox'), endpoint: `http://127.0.0.1:${server.address().port}`, publicKey: 'test', secretKey: 'test', since: '2000-01-01T00:00:00Z' };
    await watch(config, home);
    const requests = spans.filter((span) => span.name === 'provider.request');
    const metadata = (span, key) => span.attributes.find((a) => a.key === 'langfuse.observation.metadata.' + key)?.value.stringValue;
    assert.equal(requests.length, 2);
    assert.ok(requests.every((span) => metadata(span, 'workflow') === 'run-1' && metadata(span, 'helper') === 'autoreview'));
    assert.deepEqual(requests.map((span) => metadata(span, 'model')).sort(), ['claude-model', 'codex-model']);
    const usages = requests.map((span) => JSON.parse(metadata(span, 'usage')));
    assert.equal(usages.find((u) => u.inputIncludesCache).input, 100);
    assert.equal(usages.find((u) => !u.inputIncludesCache).cacheWrite, 40);
    const coverage = () => metadata(spans.findLast((span) => span.name === 'stage'), 'childCoverage');
    assert.equal(coverage(), 'partial');
    await write(join(root, '1.autoreview-opinion-claude.json'), sidecar(...cases[1], true));
    await write(join(root, '1.md'), (await readFile(join(root, '1.md'), 'utf8')).replace('stage: reviewed', 'stage: verified'));
    await watch(config, home);
    assert.equal(coverage(), 'complete');
    spans.length = 0;
    await watch(config, home);
    assert.equal(spans.filter((span) => span.name === 'provider.request').length, 0);
  } finally { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); await rm(home, { recursive: true, force: true }); }
});
