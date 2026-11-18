#!/usr/bin/env node
import { readFile, stat } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { metadataEvent, skillRevision } from './contract.mjs';
import { captureTranscript } from './accounting.mjs';
import { emit, emitBatch, flush, status } from './delivery.mjs';

export async function configuration(path = process.env.SKILL_OBSERVABILITY_CONFIG) {
  if (!path) return { enabled: false };
  if ((await stat(path)).mode & 0o077) throw new Error('private configuration required');
  const config = JSON.parse(await readFile(path, 'utf8'));
  if (config.enabled !== true) return { enabled: false };
  return config;
}

export async function captureHook(config, runtime, payload) {
  if (!config.enabled) return { status: 'disabled' };
  if (!Number.isFinite(Date.parse(config.since))) return { status: 'unavailable' };
  if (!payload.transcript_path || !payload.session_id) return { status: 'unavailable' };
  if (payload.session_id !== config.context?.session) return { status: 'unavailable' };
  const revision = await skillRevision(config.skillDirectory);
  let events;
  try { events = await captureTranscript(runtime, payload.transcript_path, { ...config.context, revision }); }
  catch { return { status: 'unavailable' }; }
  const batch = await emitBatch(config, events.filter((event) => Date.parse(event.time) >= Date.parse(config.since)).map((event) => ({ ...event, eventKey: event.request })), { remember: true });
  const delivery = await flush(config);
  return { status: batch.status === 'accepted' ? 'captured' : 'unavailable', accepted: batch.accepted ?? 0, delivery, coverage: config.context?.childCoverage ?? 'unknown', measured: events.some((event) => event.usage?.input != null && event.usage?.output != null) };
}

async function stdin() {
  let text = '';
  for await (const chunk of process.stdin) { text += chunk; if (text.length > 1024 * 1024) throw new Error('input too large'); }
  return JSON.parse(text);
}

export async function main(args) {
  try {
    const config = await configuration();
    if (!config.enabled) return { status: 'disabled' };
    if (args[0] === 'hook') return await captureHook(config, args[1], await stdin());
    if (args[0] === 'flush') return await flush(config);
    if (args[0] === 'status') return await status(config);
    if (args[0] === 'event') {
      const input = args[1] ? JSON.parse(await readFile(args[1], 'utf8')) : await stdin();
      const event = metadataEvent({ ...config.context, ...input, revision: await skillRevision(config.skillDirectory) });
      const result = await emit(config, { ...event, eventKey: input.eventKey });
      return { ...result, delivery: await flush(config) };
    }
    return { status: 'unavailable' };
  } catch { return { status: 'unavailable' }; }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  console.log(JSON.stringify(await main(process.argv.slice(2))));
}
