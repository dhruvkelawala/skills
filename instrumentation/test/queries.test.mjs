import { test } from 'node:test';
import assert from 'node:assert/strict';
import { monitorRules } from '../queries.mjs';

test('backend warning predicates stay scoped to one workflow and configurable warning budget', () => {
  const rules = monitorRules({ projectId: 'pilot', workflow: 'w', tokenWarning: 123 });
  assert.equal(rules.length, 2);
  const usage = rules.find((r) => r.view === 'observations');
  const evidence = rules.find((r) => r.view === 'scores-boolean');
  assert.equal(usage.alertThreshold, 123);
  assert.equal(usage.metric.measure, 'totalTokens');
  assert.equal(evidence.alertThreshold, 0);
  assert.ok(evidence.filters.some((f) => f.column === 'name' && f.value === 'evidence-failure'));
  assert.ok(evidence.filters.some((f) => f.column === 'booleanValue' && f.value === true));
  for (const rule of rules) {
    assert.ok(rule.filters.some((f) => f.column === 'traceId' && /^[a-f0-9]{32}$/.test(f.value)));
    assert.match(rule.name, /w/);
  }
  assert.throws(() => monitorRules({ projectId: 'pilot', workflow: 'w', tokenWarning: -1 }));
});
