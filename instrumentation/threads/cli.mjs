#!/usr/bin/env node
// node instrumentation/threads/cli.mjs pass | status | flush
// Reads the private configuration named by T3_THREADS_CONFIG. Prints one JSON result and always exits 0.
import { pathToFileURL } from 'node:url';
import { configuration } from '../cli.mjs';
import { pass } from './capture.mjs';
import { flush, status } from './outbox.mjs';

export async function main(args, env = process.env) {
  try {
    const config = await configuration(env.T3_THREADS_CONFIG);
    if (!config.enabled) return { status: 'disabled' };
    if (args[0] === 'pass') return await pass(config);
    if (args[0] === 'status') return await status(config);
    if (args[0] === 'flush') return await flush(config);
    return { status: 'unavailable', reason: 'usage: pass | status | flush' };
  } catch { return { status: 'unavailable' }; }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  console.log(JSON.stringify(await main(process.argv.slice(2))));
}
