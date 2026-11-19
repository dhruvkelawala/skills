import { test } from 'node:test';
import assert from 'node:assert/strict';
import { utimes } from 'node:fs/promises';
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
