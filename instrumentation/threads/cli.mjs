#!/usr/bin/env node
// node instrumentation/threads/cli.mjs pass | backfill <from> | recount <from> <to> | status | flush
// Reads the private configuration named by T3_THREADS_CONFIG. Prints one JSON result and always exits 0.
import { homedir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { configuration } from '../cli.mjs';
import { backfill, pass } from './capture.mjs';
import { recount } from './recount.mjs';
import { flush, status } from './outbox.mjs';

export async function main(args, env = process.env) {
  try {
    const config = await configuration(env.T3_THREADS_CONFIG);
    if (!config.enabled) return { status: 'disabled' };
    if (args[0] === 'pass') return await pass(config);
    if (args[0] === 'backfill' && Number.isFinite(Date.parse(args[1]))) return await backfill(config, { from: args[1] });
    // Per-session totals name local threads, so they stay on this machine.
    if (args[0] === 'recount' && Number.isFinite(Date.parse(args[1])) && Number.isFinite(Date.parse(args[2]))) return await recount({ home: homedir(), t3Database: config.t3Database, from: args[1], to: args[2] });
    if (args[0] === 'status') return await status(config);
    if (args[0] === 'flush') return await flush(config);
    return { status: 'unavailable', reason: 'usage: pass | backfill <from> | recount <from> <to> | status | flush' };
  } catch { return { status: 'unavailable' }; }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  console.log(JSON.stringify(await main(process.argv.slice(2))));
}
