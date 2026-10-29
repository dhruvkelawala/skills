import { test } from 'node:test';
import assert from 'node:assert/strict';
import { metadataEvent } from '../contract.mjs';
import { summarize } from '../workflow.mjs';

const head = 'a'.repeat(40);
const at = (seconds) => new Date(Date.UTC(2026, 9, 29, 18, 0, seconds)).toISOString();
const event = (kind, seconds, extra = {}) => metadataEvent({ workflow: 'w', attempt: 'a', invocation: 'root', skill: 'issue-to-pr', eventKey: String(seconds), kind, time: at(seconds), head, ...extra });
const evidence = [{ uri: 'https://github.com/example/repo/blob/evidence/proof.json', sha256: 'b'.repeat(64), head, result: 'pass', expires: at(120) }];

test('waiting and resumed attempts preserve execution time, repair categories and evidence validity', () => {
  const events = [event('skill.started', 0, { execution: 'running' }), event('gate', 5, { reason: 'expected-red', outcome: 'failed' }), event('waiting', 10, { execution: 'waiting-human' }), event('resumed', 70, { attempt: 'b', execution: 'running' }), event('repair', 71, { attempt: 'b', reason: 'autonomous' }), event('repair', 72, { attempt: 'b', reason: 'user-requested' }), event('stage', 73, { attempt: 'b', reason: 'recovered' }), event('gate', 75, { attempt: 'b', outcome: 'verified', evidence, judge: 'node-test', rubric: 'acceptance/v1' }), event('skill.finished', 80, { attempt: 'b', execution: 'completed', outcome: 'verified', evidence })];
  const result = summarize(events, { head, now: at(90) });
  assert.equal(result.activeMs, 20000);
  assert.equal(result.waitMs, 60000);
  assert.equal(result.execution, 'completed');
  assert.equal(result.outcome, 'verified');
  assert.deepEqual(result.repairs, { autonomous: 1, requested: 1 });
  assert.equal(summarize(events, { head: 'c'.repeat(40), now: at(90) }).outcome, 'unknown');
  assert.equal(summarize(events, { head, now: at(121) }).outcome, 'unknown');
  assert.equal(summarize([...events, event('skill.finished', 85, { attempt: 'b', execution: 'completed', outcome: 'verified' })], { head, now: at(90) }).outcome, 'unknown');
  assert.equal(summarize([event('skill.started', 0), event('interrupted', 4, { execution: 'interrupted' })], { head, now: at(90) }).execution, 'interrupted');
});
