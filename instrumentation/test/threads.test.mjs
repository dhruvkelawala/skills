import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile, utimes, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { backfill, pass } from '../threads/capture.mjs';
import { recount } from '../threads/recount.mjs';
import { main } from '../threads/cli.mjs';
import { observationId } from '../threads/contract.mjs';
import { claude, codex, fixture, sessionTotals } from './threads-fixture.mjs';

const CLAUDE_SESSION = '11111111-1111-4111-8111-111111111111';
const CODEX_SESSION = '01a1aaaa-0000-7000-8000-000000000001';

test('a pass sends every changed Claude and Codex transcript, inside T3 or not, and reports delivery counts', async () => {
  const f = await fixture();
  try {
    f.project('p1', 'Synthetic project', '/work/synthetic');
    f.thread({ id: 'thread-a', nativeId: CLAUDE_SESSION, runs: [['2026-11-19T10:00:00Z', null]] });
    await f.write(`.claude-test/projects/-work-synthetic/${CLAUDE_SESSION}.jsonl`, [
      claude.prompt('2026-11-19T10:00:01Z', 'prompt-1'),
      claude.request('2026-11-19T10:00:02Z', 'msg-1'),
    ]);
    await f.write(`.codex-test/sessions/2026/11/19/rollout-2026-11-19T10-00-00-${CODEX_SESSION}.jsonl`, [
      codex.meta('2026-11-19T10:00:00Z', CODEX_SESSION),
      codex.turn('2026-11-19T10:00:00Z', 't1'),
      codex.request('2026-11-19T10:00:03Z', 'resp-1'),
    ]);
    const old = await f.write('.claude-test/projects/-work-synthetic/22222222-2222-4222-8222-222222222222.jsonl', [claude.request('2026-10-01T10:00:00Z', 'msg-old')]);
    await utimes(old, new Date('2026-10-01T10:00:00Z'), new Date('2026-10-01T10:00:00Z'));

    f.reject = true;
    const failed = await pass(f.config(), { home: f.home });
    assert.equal(failed.status, 'passed');
    assert.equal(failed.pending, 1, 'undelivered batch stays pending');
    assert.equal(failed.exhausted, 0);
    assert.equal(failed.unavailable, 0);

    f.reject = false;
    const result = await pass(f.config(), { home: f.home });
    assert.deepEqual([result.pending, result.exhausted, result.unavailable], [0, 0, 0]);
    const totals = sessionTotals(f.spans);
    assert.deepEqual(Object.keys(totals).sort(), [`codex:${CODEX_SESSION}`, 'thread-a']);
    assert.equal(totals['thread-a'].requests, 1);
    assert.equal(totals['thread-a'].tokens, 10 + 5 + 100 + 20);
    assert.equal(totals[`codex:${CODEX_SESSION}`].tokens, 1000 + 50);
    const outside = f.spans.find((span) => span.attributes['session.id'] === `codex:${CODEX_SESSION}`);
    assert.equal(outside.attributes['langfuse.trace.metadata.t3'], 'false');
    const inside = f.spans.find((span) => span.attributes['session.id'] === 'thread-a');
    assert.equal(inside.attributes['langfuse.trace.metadata.t3'], 'true');
    assert.equal(Object.values(totals).reduce((n, t) => n + t.requests, 0), 2, 'a transcript unchanged since `since` is not read');
  } finally { await f.close(); }
});

test('each request appears once across reruns, resumed sessions and transcripts that copy earlier history', async () => {
  const f = await fixture();
  const original = '55555555-5555-4555-8555-555555555555';
  const resumed = '66666666-6666-4666-8666-666666666666';
  const fork = '01a1bbbb-0000-7000-8000-000000000002';
  const forkCopy = '01a1bbbb-0000-7000-8000-000000000003';
  const pause = () => new Promise((resolve) => setTimeout(resolve, 20));
  try {
    const history = [claude.prompt('2026-11-19T10:00:00Z', 'p1'), claude.request('2026-11-19T10:00:01Z', 'msg-1'), claude.request('2026-11-19T10:00:02Z', 'msg-2')];
    await f.write(`.claude-test/projects/-w/${original}.jsonl`, history);
    await f.write(`.codex-test/sessions/2026/11/19/rollout-a-${fork}.jsonl`, [codex.meta('2026-11-19T10:00:00Z', fork), codex.request('2026-11-19T10:00:03Z', 'resp-1')]);
    await pause();
    // A resumed session's transcript starts with a copy of the history it resumes, and is read after the original.
    await f.write(`.claude-test/projects/-w/${resumed}.jsonl`, [...history, claude.prompt('2026-11-19T11:00:00Z', 'p2'), claude.request('2026-11-19T11:00:01Z', 'msg-3')]);
    await f.write(`.codex-test/sessions/2026/11/19/rollout-b-${forkCopy}.jsonl`, [codex.meta('2026-11-19T11:00:00Z', forkCopy), codex.request('2026-11-19T10:00:03Z', 'resp-1'), codex.request('2026-11-19T11:00:04Z', 'resp-2')]);

    await pass(f.config(), { home: f.home });
    await pass(f.config(), { home: f.home });
    const generations = (spans) => new Set(spans.filter((span) => span.attributes['langfuse.observation.type'] === 'generation').map((span) => span.spanId));
    assert.equal(generations(f.spans).size, 5, 'msg-1, msg-2, msg-3, resp-1 and resp-2, once each');
    const totals = sessionTotals(f.spans);
    assert.equal(totals[`claude:${original}`]?.requests, 2, 'copied requests stay with the session that made them');
    assert.equal(totals[`claude:${resumed}`].requests, 1);
    assert.equal(totals[`codex:${fork}`].requests, 1);
    assert.equal(totals[`codex:${forkCopy}`].requests, 1);
    const postedUnder = (session) => new Set(f.spans.filter((span) => span.attributes['session.id'] === session && span.attributes['langfuse.observation.type'] === 'generation').map((span) => span.spanId)).size;
    assert.equal(postedUnder(`claude:${resumed}`), 1, 'a copied request is never sent under the copying session');
    assert.equal(postedUnder(`codex:${forkCopy}`), 1);

    await f.append(`.claude-test/projects/-w/${resumed}.jsonl`, [claude.request('2026-11-19T11:00:05Z', 'msg-4')]);
    await pass(f.config(), { home: f.home });
    assert.equal(generations(f.spans).size, 6);
    assert.equal(sessionTotals(f.spans)[`claude:${original}`]?.requests, 2, 'a later pass does not move copied requests');
    assert.equal(sessionTotals(f.spans)[`claude:${resumed}`].requests, 2, 'the appended request belongs to the resumed session');
  } finally { await f.close(); }
});

test('traces carry the T3 thread, project, branch, lineage, launcher and issue-to-pr workflow', async () => {
  const f = await fixture();
  const native = (n) => `aaaaaaaa-0000-4000-8000-00000000000${n}`;
  try {
    f.project('p1', 'Synthetic project', '/work/synthetic');
    f.thread({ id: 'root', nativeId: native(0), title: 'Build synthetic issue', branch: 'feat/9-synthetic', worktreePath: '/work/.t3/worktrees/synthetic/feat-9', runs: [['2026-11-19T09:00:00Z', null]] });
    f.thread({ id: 'launched', nativeId: native(1), title: 'Launched build', createdBy: 'agent', creationSource: 'mcp', runs: [['2026-11-19T09:30:00Z', null]] });
    f.thread({ id: 'delegated', nativeId: native(2), title: 'Delegated reviewer', createdBy: 'agent', creationSource: 'mcp', lineage: { parentThreadId: 'root', relationshipToParent: 'subagent', rootThreadId: 'root' } });
    f.thread({ id: 'late', nativeId: native(3), title: 'Late launch' });
    f.launch('root', 'launched');
    f.delegate('root', 'delegated');
    f.launch('root', 'late', 'mcp__t3-code__t3_thread_launch', 'running');
    await f.write('.agent/issue-to-pr/synthetic/9.md', []);
    await writeFile(join(f.home, '.agent/issue-to-pr/synthetic/9.md'), 'issue: https://example.invalid/9\nrepo: owner/synthetic\nbranch: feat/9-synthetic\ntelemetry_workflow: wf-9\n\n## Contract\n');
    for (const n of [0, 1, 2, 3]) await f.write(`.claude-test/projects/-w/${native(n)}.jsonl`, [claude.prompt('2026-11-19T10:00:00Z', `p${n}`), claude.request('2026-11-19T10:00:01Z', `m${n}`)]);

    await pass(f.config(), { home: f.home });
    const traceOf = (session) => f.spans.findLast((span) => span.attributes['session.id'] === session && span.attributes['langfuse.observation.type'] === 'generation').attributes;
    const root = traceOf('root');
    assert.equal(root['langfuse.trace.name'], 'Build synthetic issue');
    assert.equal(root['langfuse.trace.metadata.title'], 'Build synthetic issue');
    assert.equal(root['langfuse.trace.metadata.project'], 'Synthetic project');
    assert.equal(root['langfuse.trace.metadata.branch'], 'feat/9-synthetic');
    assert.equal(root['langfuse.trace.metadata.worktree'], '/work/.t3/worktrees/synthetic/feat-9');
    assert.equal(root['langfuse.trace.metadata.lineageRoot'], 'root');
    assert.equal(root['langfuse.trace.metadata.run'], 'run:root:0');
    assert.equal(root['langfuse.trace.metadata.workflow'], 'wf-9');
    const launched = traceOf('launched');
    assert.equal(launched['langfuse.trace.metadata.launcher'], 'root');
    assert.equal(launched['langfuse.trace.metadata.creationSource'], 'mcp');
    assert.equal(launched['langfuse.trace.metadata.workflow'], 'wf-9', 'a launched thread joins its launcher workflow');
    const delegated = traceOf('delegated');
    assert.equal(delegated['langfuse.trace.metadata.launcher'], 'root');
    assert.equal(delegated['langfuse.trace.metadata.lineageParent'], 'root');
    assert.equal(delegated['langfuse.trace.metadata.lineageRelationship'], 'subagent');
    assert.equal(traceOf('late')['langfuse.trace.metadata.launcher'], undefined);

    f.complete('root', 'late');
    await f.append(`.claude-test/projects/-w/${native(3)}.jsonl`, [claude.request('2026-11-19T10:05:00Z', 'm3b')]);
    await pass(f.config(), { home: f.home });
    assert.equal(traceOf('late')['langfuse.trace.metadata.launcher'], 'root', 'a launch that finishes after a pass is still found');
  } finally { await f.close(); }
});

test('compactions arrive as events with trigger and token sizes, and handoffs stay apart from them', async () => {
  const f = await fixture();
  const codexSession = '01a1cccc-0000-7000-8000-000000000001';
  try {
    await f.write('.claude-test/projects/-w/77777777-7777-4777-8777-777777777777.jsonl', [
      claude.prompt('2026-11-19T10:00:00Z', 'p1'),
      claude.request('2026-11-19T10:00:01Z', 'msg-1'),
      { type: 'system', subtype: 'compact_boundary', uuid: 'compact-1', timestamp: '2026-11-19T10:10:00Z', content: 'SUMMARY_TEXT', compactMetadata: { trigger: 'auto', preTokens: 334397, postTokens: 20255, durationMs: 42242 } },
    ]);
    await f.write(`.codex-test/sessions/2026/11/19/rollout-c-${codexSession}.jsonl`, [
      codex.meta('2026-11-19T10:00:00Z', codexSession),
      { type: 'compacted', timestamp: '2026-11-19T10:00:01Z', payload: { message: '', window_number: 0, window_id: 'window-0', replacement_history: [{ text: 'HANDOFF_TEXT' }] } },
      codex.request('2026-11-19T10:00:02Z', 'resp-1', 't1', { input_tokens: 240037 }),
      { type: 'compacted', timestamp: '2026-11-19T10:30:00Z', payload: { message: 'SUMMARY_TEXT', window_number: 1, window_id: 'window-1', latest_token_usage_record: { usage: { input_tokens: 240037 } } } },
      codex.request('2026-11-19T10:30:05Z', 'resp-2', 't1', { input_tokens: 18000 }),
    ]);
    await pass(f.config(), { home: f.home });
    const events = (kind) => [...new Map(f.spans.filter((span) => span.attributes['langfuse.observation.metadata.kind'] === kind).map((span) => [span.spanId, span.attributes])).values()];
    const compactions = events('compaction');
    assert.equal(compactions.length, 2);
    const claudeCompaction = compactions.find((c) => c['langfuse.trace.metadata.runtime'] === 'claude');
    assert.equal(claudeCompaction['langfuse.observation.type'], 'event');
    assert.equal(claudeCompaction['langfuse.observation.metadata.trigger'], 'auto');
    assert.equal(claudeCompaction['langfuse.observation.metadata.preTokens'], '334397');
    assert.equal(claudeCompaction['langfuse.observation.metadata.postTokens'], '20255');
    const codexCompaction = compactions.find((c) => c['langfuse.trace.metadata.runtime'] === 'codex');
    assert.equal(codexCompaction['langfuse.observation.metadata.preTokens'], '240037');
    assert.equal(codexCompaction['langfuse.observation.metadata.postTokens'], '18000', 'after is the next request input');
    assert.equal(codexCompaction['langfuse.observation.metadata.trigger'], undefined, 'Codex does not log a trigger');
    const handoffs = events('handoff');
    assert.equal(handoffs.length, 1, 'a compacted row before the first model call is a handoff');
    assert.equal(handoffs[0]['session.id'], `codex:${codexSession}`);
  } finally { await f.close(); }
});

test('tool calls and native subagents arrive as spans, and no content reaches the outbox or the network', async () => {
  const f = await fixture();
  const C = 'PRIVATE_CANARY_176';
  const parent = '88888888-8888-4888-8888-888888888888';
  const codexParent = '01a1dddd-0000-7000-8000-000000000001';
  const codexChild = '01a1dddd-0000-7000-8000-000000000002';
  const item = (time, started, completed, item) => ({ type: 'event_msg', timestamp: time, payload: { type: 'item_completed', turn_id: 't1', started_at_ms: Date.parse(started), completed_at_ms: Date.parse(completed), item } });
  try {
    await f.write(`.claude-test/projects/-w/${parent}.jsonl`, [
      claude.prompt('2026-11-19T10:00:00Z', 'p1', C),
      { ...claude.request('2026-11-19T10:00:01Z', 'msg-1', {}, [{ type: 'text', text: C }, { type: 'tool_use', id: 'toolu_bash', name: 'Bash', input: { command: C } }]), wireToolInputs: { toolu_bash: { command: C } } },
      { type: 'user', timestamp: '2026-11-19T10:00:06Z', promptId: 'p1', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'toolu_bash', is_error: true, content: C }] }, toolUseResult: { stdout: C, stderr: C } },
      { type: 'api-request-blob', message: { role: 'assistant', content: [{ type: 'tool_use', id: 'toolu_blob', name: 'Bash', input: { command: C } }] } },
      claude.request('2026-11-19T10:00:07Z', 'msg-2', {}, [{ type: 'tool_use', id: 'toolu_agent', name: 'Agent', input: { prompt: C } }]),
      { type: 'user', timestamp: '2026-11-19T10:01:07Z', promptId: 'p1', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'toolu_agent', content: [{ type: 'text', text: C }] }] } },
      { type: 'assistant', timestamp: '2026-11-19T10:01:08Z', uuid: 'api-error-1', isApiErrorMessage: true, message: { model: '<synthetic>', content: [{ type: 'text', text: C }] }, error: C },
      { type: 'system', subtype: 'compact_boundary', uuid: 'compact-1', timestamp: '2026-11-19T10:02:00Z', content: C, compactMetadata: { trigger: 'manual', preTokens: 10, postTokens: 5 } },
    ]);
    await f.write(`.claude-test/projects/-w/${parent}/subagents/agent-a1.jsonl`, [claude.prompt('2026-11-19T10:00:08Z', 'child', C), claude.request('2026-11-19T10:00:09Z', 'msg-child')]);
    await writeFile(join(f.home, `.claude-test/projects/-w/${parent}/subagents/agent-a1.meta.json`), JSON.stringify({ agentType: 'general-purpose', description: C, toolUseId: 'toolu_agent' }));
    await f.write(`.codex-test/sessions/2026/11/19/rollout-d-${codexParent}.jsonl`, [
      codex.meta('2026-11-19T10:00:00Z', codexParent, { base_instructions: { text: C }, cwd: C }),
      codex.turn('2026-11-19T10:00:00Z', 't1'),
      { type: 'response_item', timestamp: '2026-11-19T10:00:01Z', payload: { type: 'function_call', name: 'exec', arguments: C, call_id: 'call-1' } },
      { type: 'response_item', timestamp: '2026-11-19T10:00:02Z', payload: { type: 'function_call_output', call_id: 'call-1', output: [{ type: 'input_text', text: C }] } },
      item('2026-11-19T10:00:03Z', '2026-11-19T10:00:01Z', '2026-11-19T10:00:03Z', { type: 'CommandExecution', id: 'item-exec', status: 'failed', command: C, aggregated_output: C, exit_code: 1, cwd: C }),
      item('2026-11-19T10:00:04Z', '2026-11-19T10:00:03Z', '2026-11-19T10:00:04Z', { type: 'McpToolCall', id: 'item-mcp', status: 'completed', server: 't3-code', tool: 'send_to_user', arguments: C, result: C }),
      item('2026-11-19T10:00:05Z', '2026-11-19T10:00:05Z', '2026-11-19T10:00:05Z', { type: 'AgentMessage', id: 'item-msg', content: C }),
      codex.request('2026-11-19T10:00:06Z', 'resp-1'),
      { type: 'event_msg', timestamp: '2026-11-19T10:00:07Z', payload: { type: 'task_complete', turn_id: 't1', last_agent_message: C } },
    ]);
    await f.write(`.codex-test/sessions/2026/11/19/rollout-e-${codexChild}.jsonl`, [
      codex.meta('2026-11-19T10:00:10Z', codexChild, { source: { subagent: { other: 'guardian' } }, parent_thread_id: codexParent }),
      codex.request('2026-11-19T10:00:11Z', 'resp-child'),
      codex.request('2026-11-19T10:00:20Z', 'resp-child-2'),
    ]);

    f.reject = true;
    await pass(f.config(), { home: f.home });
    const outbox = await readdir(join(f.home, 'outbox'));
    const stored = (await Promise.all(outbox.filter((name) => name.endsWith('.json')).map((name) => readFile(join(f.home, 'outbox', name), 'utf8')))).join('');
    assert.ok(stored.includes('provider.request'), 'the outbox holds the batch');
    assert.ok(!stored.includes(C), 'no content in the outbox');
    f.reject = false;
    await pass(f.config(), { home: f.home });
    assert.ok(f.bodies.length > 1);
    assert.ok(!f.bodies.join('').includes(C), 'no content in the network payload');

    const spans = [...new Map(f.spans.map((span) => [span.spanId, span])).values()];
    const tools = spans.filter((span) => span.attributes['langfuse.observation.metadata.kind'] === 'tool');
    const named = (name) => tools.find((span) => span.name === name);
    assert.deepEqual(tools.map((span) => span.name).sort(), ['Agent', 'Bash', 'exec', 't3-code.send_to_user'], 'one span per tool call, none from request blobs');
    const seconds = (span) => Number(BigInt(span.endTimeUnixNano) - BigInt(span.startTimeUnixNano)) / 1e9;
    assert.equal(seconds(named('Bash')), 5);
    assert.equal(named('Bash').attributes['langfuse.observation.metadata.error'], 'true');
    assert.equal(named('Bash').attributes['langfuse.observation.level'], 'ERROR');
    assert.equal(named('Agent').attributes['langfuse.observation.metadata.error'], 'false');
    assert.equal(seconds(named('exec')), 2);
    assert.equal(named('exec').attributes['langfuse.observation.metadata.error'], 'true');
    assert.equal(named('t3-code.send_to_user').attributes['langfuse.observation.metadata.error'], 'false');

    const generation = (id) => spans.find((span) => span.attributes['langfuse.observation.type'] === 'generation' && span.spanId === observationId('generation', id[0], id[1]));
    const claudeChild = generation(['claude', 'msg-child']);
    assert.equal(claudeChild.parentSpanId, named('Agent').spanId, 'a Claude subagent request sits under its Agent span');
    assert.equal(claudeChild.attributes['session.id'], `claude:${parent}`);
    assert.equal(claudeChild.traceId, named('Agent').traceId);
    const subagent = spans.find((span) => span.attributes['langfuse.observation.metadata.kind'] === 'subagent');
    assert.equal(subagent.attributes['session.id'], `codex:${codexParent}`);
    assert.equal(subagent.attributes['langfuse.observation.metadata.childSession'], codexChild);
    assert.equal(seconds(subagent), 10);
    assert.equal(generation(['codex', 'resp-child']).parentSpanId, subagent.spanId, 'a Codex subagent request sits under its subagent span');
    assert.equal(spans.filter((span) => span.attributes['langfuse.observation.metadata.kind'] === 'api-error').length, 1);
  } finally { await f.close(); }
});

test('a steady-state pass reads only what was appended, carries turn state across reads, and defers past its budget', async () => {
  const f = await fixture();
  const session = '01a1eeee-0000-7000-8000-000000000001';
  const path = `.codex-test/sessions/2026/11/19/rollout-f-${session}.jsonl`;
  try {
    await f.write(path, [codex.meta('2026-11-19T10:00:00Z', session), codex.turn('2026-11-19T10:00:00Z', 't1'), codex.request('2026-11-19T10:00:01Z', 'resp-1')]);
    await f.write('.claude-test/projects/-w/99999999-9999-4999-8999-999999999999.jsonl', [claude.prompt('2026-11-19T10:00:00Z', 'p1'), claude.request('2026-11-19T10:00:01Z', 'msg-1', {}, [{ type: 'tool_use', id: 'toolu_long', name: 'Bash', input: {} }])]);
    const first = await pass(f.config(), { home: f.home });
    assert.ok(first.bytes > 0);
    const posts = f.bodies.length;

    const idle = await pass(f.config(), { home: f.home });
    assert.equal(idle.bytes, 0, 'unchanged transcripts are not read again');
    assert.equal(f.bodies.length, posts, 'and nothing is sent again');

    const line = JSON.stringify(codex.request('2026-11-19T10:05:00Z', 'resp-2')) + '\n';
    await f.append(path, [codex.request('2026-11-19T10:05:00Z', 'resp-2')]);
    await f.append('.claude-test/projects/-w/99999999-9999-4999-8999-999999999999.jsonl', [{ type: 'user', timestamp: '2026-11-19T10:06:01Z', message: { content: [{ type: 'tool_result', tool_use_id: 'toolu_long' }] } }]);
    const tail = JSON.stringify({ type: 'user', timestamp: '2026-11-19T10:06:01Z', message: { content: [{ type: 'tool_result', tool_use_id: 'toolu_long' }] } }) + '\n';
    await writeFile(join(f.home, path), '{"type":"token_usage_rec', { flag: 'a' });
    const next = await pass(f.config(), { home: f.home });
    assert.equal(next.bytes, Buffer.byteLength(line) + Buffer.byteLength(tail), 'only complete appended lines are read');
    const resp2 = f.spans.find((span) => span.spanId === observationId('generation', 'codex', 'resp-2'));
    assert.equal(resp2.attributes['langfuse.observation.model.name'], 'gpt-6.1-sol', 'the model from an earlier read carries over');
    const tool = f.spans.find((span) => span.spanId === observationId('tool', 'claude', 'toolu_long'));
    assert.equal(Number(BigInt(tool.endTimeUnixNano) - BigInt(tool.startTimeUnixNano)) / 1e9, 360, 'a tool call opened before the cursor closes after it');

    await f.write('.claude-test/projects/-w/aaaaaaaa-9999-4999-8999-999999999999.jsonl', [claude.request('2026-11-19T11:00:00Z', 'msg-late')]);
    const hurried = await pass(f.config({ budgetMs: 0 }), { home: f.home });
    assert.ok(hurried.deferred >= 1, 'transcripts past the budget wait for the next pass');
    await pass(f.config(), { home: f.home });
    assert.ok(f.spans.some((span) => span.spanId === observationId('generation', 'claude', 'msg-late')));
  } finally { await f.close(); }
});

test('a backfill streams through a small outbox, and its per-thread totals equal an independent recount', async () => {
  const f = await fixture();
  const from = '2026-10-20T00:00:00Z', to = '2026-11-19T12:00:00Z';
  const ids = { t3: '12121212-1212-4212-8212-121212121212', resumed: '13131313-1313-4313-8313-131313131313', codex: '01a1ffff-0000-7000-8000-000000000001', codexChild: '01a1ffff-0000-7000-8000-000000000002' };
  try {
    f.thread({ id: 'thread-t3', nativeId: ids.t3, runs: [['2026-10-25T00:00:00Z', null]] });
    const history = [claude.prompt('2026-10-19T23:00:00Z', 'p0'), claude.request('2026-10-19T23:00:01Z', 'before-window', { output_tokens: 999 }), claude.prompt('2026-10-25T10:00:00Z', 'p1')];
    for (let n = 0; n < 6; n++) history.push(claude.request(`2026-10-25T10:00:0${n}Z`, `msg-${n}`, { output_tokens: 5 + n }), claude.request(`2026-10-25T10:00:0${n}Z`, `msg-${n}`, { output_tokens: 50 + n }));
    await f.write(`.claude-test/projects/-w/${ids.t3}.jsonl`, history);
    await f.write(`.claude-test/projects/-w/${ids.t3}/subagents/agent-b1.jsonl`, [claude.request('2026-10-25T10:01:00Z', 'msg-sub', { input_tokens: 7 })]);
    await new Promise((resolve) => setTimeout(resolve, 20));
    await f.write(`.claude-test/projects/-w/${ids.resumed}.jsonl`, [...history, claude.request('2026-11-02T10:00:00Z', 'msg-new')]);
    await f.write(`.codex-test/sessions/2026/11/10/rollout-g-${ids.codex}.jsonl`, [codex.meta('2026-11-10T10:00:00Z', ids.codex), codex.request('2026-11-10T10:00:01Z', 'resp-1', 't1', { input_tokens: 4321 }), codex.request('2026-11-10T10:00:02Z', 'resp-2')]);
    await f.write(`.codex-test/sessions/2026/11/10/rollout-h-${ids.codexChild}.jsonl`, [codex.meta('2026-11-10T10:00:03Z', ids.codexChild, { source: { subagent: { other: 'guardian' } }, parent_thread_id: ids.codex }), codex.request('2026-11-10T10:00:04Z', 'resp-child', 't9', { output_tokens: 77 })]);

    const result = await backfill(f.config({ since: '2026-11-15T00:00:00Z', batchSpans: 2, maxBatches: 3, flushAt: 1 }), { home: f.home, from });
    assert.equal(result.deferred, 0, 'a backfill delivers as it goes instead of filling the outbox');
    assert.deepEqual([result.pending, result.exhausted, result.unavailable], [0, 0, 0]);

    const expected = await recount({ home: f.home, t3Database: f.database, from, to });
    assert.deepEqual(sessionTotals(f.spans), expected);
    assert.equal(expected['thread-t3'].requests, 7, 'six requests streamed in two rows each, plus the subagent request');
    assert.equal(expected[`claude:${ids.resumed}`].requests, 1, 'copied history counts once');
    assert.equal(expected[`codex:${ids.codex}`].requests, 3, 'a Codex subagent counts in its parent');
  } finally { await f.close(); }
});

test('the thread CLI reads only its own configuration, never the pilot one', async () => {
  const f = await fixture();
  try {
    const pilot = join(f.home, 'pilot.json');
    await writeFile(pilot, JSON.stringify(f.config()), { mode: 0o600 });
    const saved = process.env.SKILL_OBSERVABILITY_CONFIG;
    process.env.SKILL_OBSERVABILITY_CONFIG = pilot;
    try { assert.deepEqual(await main(['status'], { SKILL_OBSERVABILITY_CONFIG: pilot }), { status: 'disabled' }); }
    finally { if (saved === undefined) delete process.env.SKILL_OBSERVABILITY_CONFIG; else process.env.SKILL_OBSERVABILITY_CONFIG = saved; }
    const own = join(f.home, 'threads.json');
    await writeFile(own, JSON.stringify(f.config()), { mode: 0o600 });
    assert.equal((await main(['status'], { T3_THREADS_CONFIG: own })).status, 'available');
  } finally { await f.close(); }
});

test('generations carry the context window: Codex from its own log, Claude from the model', async () => {
  const f = await fixture();
  const session = '01a1abab-0000-7000-8000-000000000001';
  try {
    await f.write(`.codex-test/sessions/2026/11/19/rollout-w-${session}.jsonl`, [
      codex.meta('2026-11-19T10:00:00Z', session),
      { type: 'event_msg', timestamp: '2026-11-19T10:00:00Z', payload: { type: 'task_started', turn_id: 't1', model_context_window: 258400 } },
      codex.request('2026-11-19T10:00:01Z', 'resp-w'),
    ]);
    await f.write('.claude-test/projects/-w/abababab-0000-4000-8000-000000000001.jsonl', [claude.request('2026-11-19T10:00:01Z', 'msg-w')]);
    await pass(f.config(), { home: f.home });
    const window = (runtime, source) => f.spans.find((span) => span.spanId === observationId('generation', runtime, source)).attributes['langfuse.observation.metadata.contextWindow'];
    assert.equal(window('codex', 'resp-w'), '258400');
    assert.equal(window('claude', 'msg-w'), '1000000');
  } finally { await f.close(); }
});

test('a backfill after normal passes still sends the older rows those passes skipped', async () => {
  const f = await fixture();
  const path = '.claude-test/projects/-w/bcbcbcbc-0000-4000-8000-000000000001.jsonl';
  try {
    await f.write(path, [claude.prompt('2026-10-25T10:00:00Z', 'p1'), claude.request('2026-10-25T10:00:01Z', 'msg-october'), claude.request('2026-11-19T10:00:01Z', 'msg-november')]);
    await pass(f.config({ since: '2026-11-19T00:00:00Z' }), { home: f.home });
    const sent = (source) => f.spans.some((span) => span.spanId === observationId('generation', 'claude', source));
    assert.ok(sent('msg-november') && !sent('msg-october'));
    await backfill(f.config({ since: '2026-11-19T00:00:00Z' }), { home: f.home, from: '2026-10-20T00:00:00Z' });
    assert.ok(sent('msg-october'), 'the backfill reads the transcript from its start');
    await f.append(path, [claude.request('2026-11-19T11:00:00Z', 'msg-later')]);
    const next = await pass(f.config({ since: '2026-11-19T00:00:00Z' }), { home: f.home });
    assert.ok(sent('msg-later'));
    assert.ok(next.bytes < 1000, 'normal passes keep their own cursors after a backfill');
  } finally { await f.close(); }
});

test('a pass that cannot read T3 sends nothing and waits, so T3 sessions are never filed outside T3', async () => {
  const f = await fixture();
  const native = 'cdcdcdcd-0000-4000-8000-000000000001';
  try {
    f.thread({ id: 'thread-known', nativeId: native });
    await f.write(`.claude-test/projects/-w/${native}.jsonl`, [claude.request('2026-11-19T10:00:01Z', 'msg-known')]);
    const broken = join(f.home, 'broken.sqlite');
    await writeFile(broken, 'not a database');
    const skipped = await pass(f.config({ t3Database: broken }), { home: f.home });
    assert.equal(skipped.t3, 'unavailable');
    assert.equal(f.spans.length, 0, 'nothing is sent without T3');
    await pass(f.config(), { home: f.home });
    assert.deepEqual(Object.keys(sessionTotals(f.spans)), ['thread-known'], 'the next pass files the request under its thread');
  } finally { await f.close(); }
});
