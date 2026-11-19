import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compactionsPerThread, costPerThread, costPerTree } from '../threads/queries.mjs';

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

test('cost per lineage tree sums a thread and everything it launched or delegated, at any depth', () => {
  const trees = costPerTree(rows);
  assert.deepEqual(trees.root, { threads: ['delegated', 'grandchild', 'launched', 'root'], requests: 4, cost: 4.25 });
  assert.deepEqual(trees.alone, { threads: ['alone'], requests: 2, cost: null, unpriced: 1 });
  assert.equal(trees.launched, undefined, 'a launched thread belongs to its launcher tree');
});

test('compactions per thread count compactions apart from handoffs', () => {
  assert.deepEqual(compactionsPerThread(rows), {
    root: { compactions: 2, auto: 1, manual: 1, tokensBefore: 400000, tokensAfter: 30000, handoffs: 0 },
    launched: { compactions: 0, auto: 0, manual: 0, tokensBefore: 0, tokensAfter: 0, handoffs: 1 },
  });
});
