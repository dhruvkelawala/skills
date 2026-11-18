#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { runOf } from './observe.mjs';
import { setHeader } from './run-record.mjs';
import { HELPER_ROLES, helperId } from '../../../instrumentation/contract.mjs';

const [path, role, id] = process.argv.slice(2);
if (!path || !HELPER_ROLES.includes(role) || !helperId(id)) {
  console.error(`usage: helper-brief.mjs <record> <${HELPER_ROLES.join('|')}> <helper-id>`);
  process.exitCode = 2;
} else {
  const run = await runOf(path);
  const record = await readFile(path, 'utf8');
  if (/^telemetry_helpers:/m.test(record.split('\n\n')[0]) && !run.expectedHelpers) throw new Error('invalid telemetry_helpers; preserve and repair the declared inventory');
  const expected = [...new Set([...(run.expectedHelpers ?? []), id])];
  await writeFile(path, setHeader(record, 'telemetry_helpers', JSON.stringify(expected)));
  console.log(`issue-to-pr-run: ${run.workflow}\nissue-to-pr-helper: ${role}\nissue-to-pr-helper-id: ${id}`);
}
