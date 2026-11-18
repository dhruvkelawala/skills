#!/usr/bin/env node
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { digest } from '../../../instrumentation/contract.mjs';
import { captureTranscript, totals } from '../../../instrumentation/accounting.mjs';
import { runOf } from './observe.mjs';
import { sessionOf, attributeSession } from './attribution.mjs';

const [records, manifestPath] = process.argv.slice(2);
if (!records || !manifestPath) throw new Error('usage: replay-attribution.mjs <record-root> <private-manifest.json>');
const names = await readdir(records, { recursive: true });
const runs = await Promise.all(names.filter((name) => name.endsWith('.md') && name.split('/').length === 2).map((name) => runOf(join(records, name))));
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const results = [];
for (const { runtime, path, original = path } of manifest) {
  const before = await sessionOf(runtime, original);
  const after = original === path ? before : await sessionOf(runtime, path);
  const oldOwner = attributeSession(before && { ...before, markers: [] }, runs);
  const newOwner = attributeSession(after, runs);
  const events = newOwner ? await captureTranscript(runtime, path, { ...newOwner, session: after.id, helper: after.helper }) : [];
  results.push({ session: digest(after?.id ?? path), before: oldOwner?.workflow ?? null, after: newOwner?.workflow ?? null,
    helper: after?.helper ?? null, usage: events.length ? totals(events, 'issue-to-pr').inclusive : null });
}
console.log(JSON.stringify({ mode: 'dry-run', sessions: results.length,
  newlyAttributed: results.filter((r) => !r.before && r.after).length,
  changedOwner: results.filter((r) => r.before && r.before !== r.after).length,
  results }, null, 2));
