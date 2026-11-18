#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { runOf } from './observe.mjs';
import { setHeader } from './run-record.mjs';

const [path, role, id] = process.argv.slice(2);
if (!path || !['reviewer', 'verifier', 'council', 'autoreview'].includes(role) || !/^[\w.-]{1,100}$/.test(id ?? '')) {
  console.error('usage: helper-brief.mjs <record> <reviewer|verifier|council|autoreview> <helper-id>');
  process.exitCode = 2;
} else {
  const run = await runOf(path);
  const expected = [...new Set([...(run.expectedHelpers ?? []), id])];
  await writeFile(path, setHeader(await readFile(path, 'utf8'), 'telemetry_helpers', JSON.stringify(expected)));
  console.log(`issue-to-pr-run: ${run.workflow}\nissue-to-pr-helper: ${role}\nissue-to-pr-helper-id: ${id}`);
}
