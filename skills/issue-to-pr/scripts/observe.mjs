#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { existsSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { header } from './run-record.mjs';
import { configuration } from '../../../instrumentation/cli.mjs';
import { digest, skillRevision } from '../../../instrumentation/contract.mjs';
import { emit, flush } from '../../../instrumentation/delivery.mjs';

export async function observe(recordPath, input, config) {
  if (!config.enabled) return { status: 'disabled' };
  const record = await readFile(recordPath, 'utf8');
  const event = {
    ...config.context, ...input,
    workflow: header(record, 'telemetry_workflow') || digest(header(record, 'repo') + ':' + header(record, 'issue')),
    attempt: header(record, 'telemetry_attempt') || config.context?.attempt,
    invocation: 'issue-to-pr', skill: 'issue-to-pr',
    repository: header(record, 'repo'), head: header(record, 'head'),
    stage: header(record, 'stage').split(':')[0],
    revision: await skillRevision(fileURLToPath(new URL('..', import.meta.url))),
  };
  return { ...(await emit(config, event)), delivery: await flush(config) };
}

if (process.argv[1] && existsSync(process.argv[1]) && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const input = JSON.parse(await readFile(process.argv[3], 'utf8'));
    console.log(JSON.stringify(await observe(process.argv[2], input, await configuration())));
  } catch { console.log(JSON.stringify({ status: 'unavailable' })); }
}
