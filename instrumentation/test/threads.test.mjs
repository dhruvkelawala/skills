import { test } from 'node:test';
import assert from 'node:assert/strict';
import { utimes, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pass } from '../threads/capture.mjs';
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
    const ownersBefore = f.spans.length;

    await f.append(`.claude-test/projects/-w/${resumed}.jsonl`, [claude.request('2026-11-19T11:00:05Z', 'msg-4')]);
    await pass(f.config(), { home: f.home });
    assert.equal(generations(f.spans).size, 6);
    assert.equal(sessionTotals(f.spans)[`claude:${original}`]?.requests, 2, 'a later pass does not move copied requests');
    assert.ok(f.spans.length > ownersBefore);
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
