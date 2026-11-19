import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { OBSERVATION_FIELDS, SESSION_FIELDS } from '../threads/contract.mjs';

test('the README names exactly the fields the thread contract lets out', async () => {
  const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8');
  const listed = (label) => readme.match(new RegExp(`^- ${label}: (.+)$`, 'm'))?.[1].match(/`(\w+)`/g).map((field) => field.slice(1, -1)).sort();
  assert.deepEqual(listed('Session and trace fields'), Object.keys(SESSION_FIELDS).sort());
  assert.deepEqual(listed('Observation fields'), Object.keys(OBSERVATION_FIELDS).sort());
});
