#!/usr/bin/env node
import { readFile, stat } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { metadataEvent, skillRevision } from './contract.mjs';
import { captureRequests } from './accounting.mjs';
import { emit, flush, status } from './delivery.mjs';

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
  if ((await stat(payload.transcript_path)).size > 64 * 1024 * 1024) return { status: 'unavailable' };
  const text = await readFile(payload.transcript_path, 'utf8');
  const lines = text.split('\n');
  const rows = [];
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    try { rows.push(JSON.parse(lines[i])); }
    catch { if (i !== lines.length - 1) return { status: 'unavailable' }; }
  }
  const revision = await skillRevision(config.skillDirectory);
  const events = captureRequests(runtime, rows, { ...config.context, session: payload.session_id, revision });
  let accepted = 0;
  for (const event of events) {
    if (Date.parse(event.time) < Date.parse(config.since)) continue;
    if ((await emit(config, { ...event, eventKey: event.request }, { remember: true })).status === 'accepted') accepted++;
    else return { status: 'unavailable', accepted, delivery: await flush(config), coverage: 'partial' };
  }
  const delivery = await flush(config);
  return { status: 'captured', accepted, delivery, coverage: 'partial' };
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
