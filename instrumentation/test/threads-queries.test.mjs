import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compactionsPerThread, costPerThread, costPerTree } from '../threads/queries.mjs';
import { pass } from '../threads/capture.mjs';
import { claude, fixture } from './threads-fixture.mjs';

// Rows in the shape GET /api/public/v2/observations returns, with repeats as replays can leave them.
const row = (id, sessionId, type, name, totalCost, metadata = {}) => ({ id, sessionId, type, name, totalCost, metadata });
const rows = [
  row('g1', 'root', 'GENERATION', 'provider.request', 1.5, { lineageRoot: 'root' }),
  row('g1', 'root', 'GENERATION', 'provider.request', 1.5, { lineageRoot: 'root' }),
  row('g2', 'launched', 'GENERATION', 'provider.request', 2, { launcher: 'root', lineageRoot: 'launched' }),
  row('g3', 'grandchild', 'GENERATION', 'provider.request', 0.25, { launcher: 'launched', lineageRoot: 'grandchild' }),
  row('g4', 'delegated', 'GENERATION', 'provider.request', 0.5, { lineageParent: 'root', lineageRoot: 'root', lineageRelationship: 'subagent' }),
  row('g5', 'alone', 'GENERATION', 'provider.request', null, {}),
  row('g6', 'alone', 'GENERATION', 'provider.request', 3, {}),
  row('c1', 'root', 'EVENT', 'compaction', null, { kind: 'compaction', trigger: 'auto', preTokens: '300000', postTokens: '20000' }),
  row('c2', 'root', 'EVENT', 'compaction', null, { kind: 'compaction', trigger: 'manual', preTokens: '100000', postTokens: '10000' }),
  row('h1', 'launched', 'EVENT', 'handoff', null, { kind: 'handoff' }),
  row('t1', 'root', 'SPAN', 'Bash', null, { kind: 'tool' }),
];

test('cost per thread counts each observation once and keeps unpriced threads unknown', () => {
  assert.deepEqual(costPerThread(rows), {
    root: { requests: 1, cost: 1.5 }, launched: { requests: 1, cost: 2 }, grandchild: { requests: 1, cost: 0.25 },
    delegated: { requests: 1, cost: 0.5 }, alone: { requests: 2, cost: null, unpriced: 1 },
  });
});

test('cost per lineage tree groups what a pass sends: a thread plus everything it launched or delegated', async () => {
  const f = await fixture();
  const native = (n) => `efefefef-0000-4000-8000-00000000000${n}`;
  try {
    f.thread({ id: 'root', nativeId: native(0) });
    f.thread({ id: 'launched', nativeId: native(1), createdBy: 'agent', creationSource: 'mcp' });
    f.thread({ id: 'grandchild', nativeId: native(2), createdBy: 'agent', creationSource: 'mcp' });
    f.thread({ id: 'delegated', nativeId: native(3), lineage: { parentThreadId: 'root', relationshipToParent: 'subagent', rootThreadId: 'root' } });
    f.thread({ id: 'alone', nativeId: native(4) });
    f.launch('root', 'launched');
    f.launch('launched', 'grandchild');
    for (const n of [0, 1, 2, 3, 4]) await f.write(`.claude-test/projects/-w/${native(n)}.jsonl`, [claude.request('2026-11-19T10:00:01Z', `m${n}`)]);
    await pass(f.config(), { home: f.home });
    // GET /api/public/v2/observations returns the session and each observation's own metadata, priced by the backend.
    const rows = f.spans.map((span) => ({
      id: span.spanId, sessionId: span.attributes['session.id'], type: span.attributes['langfuse.observation.type'].toUpperCase(), totalCost: 1,
      metadata: Object.fromEntries(Object.entries(span.attributes).filter(([key]) => key.startsWith('langfuse.observation.metadata.')).map(([key, value]) => [key.slice('langfuse.observation.metadata.'.length), value])),
    }));
    const trees = costPerTree(rows);
    assert.deepEqual(trees.root, { threads: ['delegated', 'grandchild', 'launched', 'root'], requests: 4, cost: 4 });
    assert.deepEqual(trees.alone, { threads: ['alone'], requests: 1, cost: 1 });
    assert.equal(trees.launched, undefined, 'a launched thread belongs to its launcher tree');
    assert.deepEqual(costPerTree([{ id: 'x', sessionId: 'alone', type: 'GENERATION', totalCost: null, metadata: {} }]).alone, { threads: ['alone'], requests: 1, cost: null, unpriced: 1 });
  } finally { await f.close(); }
});

test('compactions per thread count compactions apart from handoffs', () => {
  assert.deepEqual(compactionsPerThread(rows), {
    root: { compactions: 2, auto: 1, manual: 1, tokensBefore: 400000, tokensAfter: 30000, handoffs: 0 },
    launched: { compactions: 0, auto: 0, manual: 0, tokensBefore: 0, tokensAfter: 0, handoffs: 1 },
  });
});
