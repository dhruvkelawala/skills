// Synthetic CLI evidence for #176: drives instrumentation/threads/cli.mjs as a subprocess against a synthetic home,
// a synthetic T3 database and a local OTLP collector. Prints sanitized JSON; no real transcript is read.
import { spawn } from 'node:child_process';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
// Run from the repository root: node synthetic-cli-evidence.mjs
const repo = process.cwd();
const { fixture, claude, codex, sessionTotals } = await import(repo + '/instrumentation/test/threads-fixture.mjs');
const f = await fixture();
const C = 'PRIVATE_CANARY_176_EVIDENCE';
const cli = async (args, extra = {}) => {
  const path = join(f.home, 'threads.json');
  await writeFile(path, JSON.stringify(f.config(extra)), { mode: 0o600 });
  // Asynchronous, so the in-process collector can answer while the CLI posts.
  const child = spawn(process.execPath, [repo + '/instrumentation/threads/cli.mjs', ...args], { env: { PATH: process.env.PATH, HOME: f.home, T3_THREADS_CONFIG: path } });
  let stdout = '';
  child.stdout.on('data', (d) => { stdout += d; });
  await new Promise((r) => child.on('close', r));
  return JSON.parse(stdout);
};
const meta = (span, k) => span.attributes['langfuse.observation.metadata.' + k];
const trace = (span, k) => span.attributes['langfuse.trace.metadata.' + k];
const unique = () => [...new Map(f.spans.map((s) => [s.spanId, s])).values()];
const out = {};
try {
  f.project('p1', 'Synthetic project', '/work/synthetic');
  f.thread({ id: 'root', nativeId: '11111111-0000-4000-8000-000000000000', title: 'Synthetic build', branch: 'feat/9-synthetic', worktreePath: '/work/.t3/worktrees/synthetic/feat-9', runs: [['2026-11-19T09:00:00Z', null]] });
  f.thread({ id: 'launched', nativeId: '11111111-0000-4000-8000-000000000001', title: 'Synthetic launched', createdBy: 'agent', creationSource: 'mcp', runs: [['2026-11-19T09:30:00Z', null]] });
  f.launch('root', 'launched');
  await f.write('.agent/issue-to-pr/synthetic/9.md', []);
  await writeFile(join(f.home, '.agent/issue-to-pr/synthetic/9.md'), 'issue: https://example.invalid/9\nrepo: owner/synthetic\nbranch: feat/9-synthetic\ntelemetry_workflow: wf-synthetic\n\n');
  const history = [claude.prompt('2026-11-19T10:00:00Z', 'p1', C), { ...claude.request('2026-11-19T10:00:01Z', 'msg-1', {}, [{ type: 'text', text: C }, { type: 'tool_use', id: 'toolu_1', name: 'Bash', input: { command: C } }]) },
    { type: 'user', timestamp: '2026-11-19T10:00:04Z', message: { content: [{ type: 'tool_result', tool_use_id: 'toolu_1', is_error: true, content: C }] }, toolUseResult: { stdout: C } },
    { type: 'system', subtype: 'compact_boundary', uuid: 'compact-1', timestamp: '2026-11-19T10:05:00Z', content: C, compactMetadata: { trigger: 'auto', preTokens: 300000, postTokens: 20000 } }];
  await f.write('.claude-x/projects/-w/11111111-0000-4000-8000-000000000000.jsonl', history);
  await f.write('.claude-x/projects/-w/11111111-0000-4000-8000-000000000001.jsonl', [claude.request('2026-11-19T10:01:00Z', 'msg-launched')]);
  await f.write('.codex-x/sessions/2026/11/19/rollout-a-01a1aaaa-0000-7000-8000-00000000000a.jsonl', [codex.meta('2026-11-19T10:00:00Z', '01a1aaaa-0000-7000-8000-00000000000a'),
    { type: 'compacted', timestamp: '2026-11-19T10:00:00.5Z', payload: { message: '', window_id: 'w0', replacement_history: [{ text: C }] } },
    codex.request('2026-11-19T10:00:01Z', 'resp-1', 't1', { input_tokens: 240000 }),
    { type: 'compacted', timestamp: '2026-11-19T10:10:00Z', payload: { message: C, window_id: 'w1', latest_token_usage_record: { usage: { input_tokens: 240000 } } } },
    codex.request('2026-11-19T10:10:05Z', 'resp-2', 't1', { input_tokens: 18000 })]);
  await new Promise((r) => setTimeout(r, 20));
  // A resumed session copying the root's history.
  await f.write('.claude-x/projects/-w/22222222-0000-4000-8000-000000000000.jsonl', [...history, claude.request('2026-11-19T11:00:00Z', 'msg-resumed')]);

  out.criterion1_first_pass = await cli(['pass']);
  out.criterion1_sessions = sessionTotals(f.spans);
  out.criterion1_t3_tags = Object.fromEntries(Object.keys(out.criterion1_sessions).map((s) => [s, trace(f.spans.find((x) => x.attributes['session.id'] === s), 't3')]));
  const posts = f.bodies.length;
  out.criterion3_rerun = await cli(['pass']);
  out.criterion3_posts_added_by_rerun = f.bodies.length - posts;
  out.criterion3_distinct_generations = unique().filter((s) => s.attributes['langfuse.observation.type'] === 'generation').length;
  out.criterion3_copied_under_resumed = new Set(f.spans.filter((s) => s.attributes['session.id'] === 'claude:22222222-0000-4000-8000-000000000000' && s.attributes['langfuse.observation.type'] === 'generation').map((s) => s.spanId)).size;
  const rootGen = unique().find((s) => s.attributes['session.id'] === 'root' && s.attributes['langfuse.observation.type'] === 'generation');
  out.criterion4_root_trace = Object.fromEntries(['title', 'project', 'branch', 'worktree', 'lineageRoot', 'run', 'workflow'].map((k) => [k, trace(rootGen, k)]));
  const launchedGen = unique().find((s) => s.attributes['session.id'] === 'launched');
  out.criterion4_launched_trace = Object.fromEntries(['launcher', 'createdBy', 'creationSource', 'workflow'].map((k) => [k, trace(launchedGen, k)]));
  out.criterion5_events = unique().filter((s) => ['compaction', 'handoff'].includes(meta(s, 'kind'))).map((s) => ({ session: s.attributes['session.id'], type: s.attributes['langfuse.observation.type'], kind: meta(s, 'kind'), trigger: meta(s, 'trigger') ?? null, preTokens: meta(s, 'preTokens') ?? null, postTokens: meta(s, 'postTokens') ?? null }));
  out.criterion6_tools = unique().filter((s) => meta(s, 'kind') === 'tool').map((s) => ({ name: s.name, seconds: Number(BigInt(s.endTimeUnixNano) - BigInt(s.startTimeUnixNano)) / 1e9, error: meta(s, 'error'), level: s.attributes['langfuse.observation.level'] ?? null }));
  const stored = (await Promise.all((await readdir(join(f.home, 'outbox'))).filter((n) => n.endsWith('.json')).map((n) => readFile(join(f.home, 'outbox', n), 'utf8')))).join('');
  out.criterion6_canary_in_network_payload = f.bodies.join('').includes(C);
  out.criterion6_canary_in_outbox = stored.includes(C);
  out.criterion6_canary_planted_in = 'prompt, reply text, tool_use input, tool_result content, toolUseResult, compaction summaries, Codex replacement history';
  out.status = await cli(['status']);
} finally { await f.close(); }
console.log(JSON.stringify(out, null, 1));
