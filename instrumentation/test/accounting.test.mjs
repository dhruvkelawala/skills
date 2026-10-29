import { test } from 'node:test';
import assert from 'node:assert/strict';
import { captureRequests, totals } from '../accounting.mjs';

const context = { workflow: 'w', attempt: 'a', invocation: 'root', skill: 'research', session: 'session', provider: 'route', childCoverage: 'partial' };
const claude = (id, output, extra = {}) => ({ type: 'assistant', timestamp: '2026-10-29T18:00:00Z', message: { id, model: 'claude-sonnet-5-5', usage: { input_tokens: 10, output_tokens: output, cache_read_input_tokens: 30, cache_creation: { ephemeral_5m_input_tokens: 5, ephemeral_1h_input_tokens: 7 } } }, ...extra });

test('unique requests reconcile streams, replay, failed attempts and child usage with independent source totals', () => {
  const rows = [claude('r1', 2), claude('r1', 8), claude('r2', 4), { type: 'assistant', uuid: 'failed', timestamp: '2026-10-29T18:00:01Z', isApiErrorMessage: true }];
  const events = captureRequests('claude', rows, context);
  assert.equal(events.length, 3);
  const child = captureRequests('claude', [claude('child', 3)], { ...context, invocation: 'child', parent: 'root', task: 'delegate-1', allocation: 'exclusive' });
  const result = totals([...events, ...events, ...child], 'root');
  assert.deepEqual(result.inclusive, { input: 30, output: 15, cacheRead: 90, cacheWrite: 36, cacheWrite5m: 15, cacheWrite1h: 21, reasoning: null, total: 171 });
  assert.equal(result.requests, 4);
  assert.equal(result.failedRequests, 1);
  assert.equal(result.unknownUsage, 1);
  assert.equal(result.exclusive, null);
  assert.equal(result.ambiguousRequests, 3);
  assert.equal(result.childCoverage, 'partial');
  assert.equal(result.cost, null);
});

test('Codex cumulative snapshots count each request once and keep reasoning inside output', () => {
  const row = (input, output, cached, reasoning) => ({ type: 'event_msg', timestamp: '2026-10-29T18:00:00Z', payload: { type: 'token_count', info: { total_token_usage: { input_tokens: input, output_tokens: output, cached_input_tokens: cached, reasoning_output_tokens: reasoning } } } });
  const first = row(200, 40, 50, 10);
  const events = captureRequests('codex', [first, first, row(300, 60, 75, 15)], context);
  assert.equal(events.length, 2);
  assert.deepEqual(totals(events, 'root').inclusive, { input: 300, output: 60, cacheRead: 75, cacheWrite: null, cacheWrite5m: null, cacheWrite1h: null, reasoning: 15, total: 360 });
  assert.equal(totals(events, 'root').exclusive, null);
  const replay = captureRequests('codex', [first, first, row(300, 60, 75, 15)], { ...context, attempt: 'resumed' });
  assert.equal(totals([...events, ...replay], 'root').requests, 2);
});


test('Claude aggregate cache writes remain measured when their duration is unknown', () => {
  const rows = [{ type: 'assistant', timestamp: '2026-10-29T18:00:00Z', message: { id: 'legacy-cache', usage: { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 20, cache_creation_input_tokens: 40 } } }];
  const events = captureRequests('claude', rows, context);
  assert.equal(events[0].usage.cacheWrite, 40);
  assert.equal(events[0].usage.cacheWrite5m, null);
  assert.equal(events[0].usage.cacheWrite1h, null);
  assert.equal(totals(events, 'root').inclusive.total, 75);
});
