import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { metadataEvent, skillRevision } from '../contract.mjs';

test('workflow identity survives resume while invocation, load, completion and actual revision remain distinct', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'skill-revision-'));
  try {
    await writeFile(join(dir, 'SKILL.md'), 'local instructions');
    const revision = await skillRevision(dir);
    assert.match(revision, /^[a-f0-9]{64}$/);
    const base = { workflow: 'workflow-148', attempt: 'attempt-1', invocation: 'root', skill: 'issue-to-pr', revision, eventKey: '1', time: '2026-10-29T18:00:00Z' };
    const loaded = metadataEvent({ ...base, kind: 'skill.loaded' });
    assert.equal(loaded.schema, 'skill-run/v1');
    assert.equal(loaded.model, null);
    assert.equal(loaded.parent, null);
    assert.notEqual(loaded.eventId, metadataEvent({ ...base, kind: 'skill.started' }).eventId);
    assert.notEqual(loaded.eventId, metadataEvent({ ...base, kind: 'skill.finished' }).eventId);
    const resumed = metadataEvent({ ...base, attempt: 'attempt-2', kind: 'skill.started' });
    assert.equal(resumed.workflow, loaded.workflow);
    assert.notEqual(resumed.attempt, loaded.attempt);
    assert.equal(metadataEvent({ ...base, kind: 'skill.loaded' }).eventId, loaded.eventId);
    await writeFile(join(dir, 'SKILL.md'), 'changed local instructions');
    assert.notEqual(await skillRevision(dir), revision);
    assert.throws(() => metadataEvent({ ...base, kind: 'invented' }));
  } finally { await rm(dir, { recursive: true, force: true }); }
});
