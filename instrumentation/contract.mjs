import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

export const digest = (value) => createHash('sha256').update(value).digest('hex');
const KINDS = new Set(['skill.loaded', 'skill.started', 'skill.finished', 'stage', 'waiting', 'resumed', 'interrupted', 'gate', 'repair', 'request', 'capture.gap']);
const token = (value) => typeof value === 'string' && /^[\w.:/@+-]{1,200}$/.test(value) ? value : null;
const choice = (value, choices) => choices.includes(value) ? value : null;
const number = (value) => Number.isSafeInteger(value) && value >= 0 ? value : null;

export async function skillRevision(directory) {
  const entries = [];
  async function visit(path, prefix = '') {
    for (const item of (await readdir(path, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      if (['.git', 'node_modules', '__pycache__'].includes(item.name) || item.name.startsWith('.env')) continue;
      const relative = prefix + item.name;
      if (item.isDirectory()) await visit(join(path, item.name), relative + '/');
      else if (item.isFile()) entries.push([relative, digest(await readFile(join(path, item.name)))]);
      else throw new Error('unsupported skill dependency; provide a directory with regular files');
    }
  }
  await visit(directory);
  if (!entries.some(([name]) => name === 'SKILL.md')) throw new Error('missing SKILL.md');
  return digest(JSON.stringify(entries));
}

export function metadataEvent(input) {
  if (!KINDS.has(input.kind)) throw new Error('unknown event kind');
  for (const key of ['workflow', 'attempt', 'invocation', 'skill', 'eventKey']) {
    if (!token(input[key])) throw new Error('missing or invalid event identity');
  }
  const time = new Date(input.time ?? Date.now()).toISOString();
  const event = {
    schema: 'skill-run/v1',
    eventId: digest(JSON.stringify([input.workflow, input.attempt, input.invocation, input.kind, input.eventKey])),
    time, kind: input.kind,
  };
  for (const key of ['workflow', 'attempt', 'invocation', 'parent', 'skill', 'provider', 'model', 'effort', 'session', 'turn', 'task', 'repository', 'head', 'stage']) event[key] = token(input[key]);
  event.revision = /^[a-f0-9]{64}$/.test(input.revision ?? '') ? input.revision : null;
  event.execution = choice(input.execution, ['running', 'waiting-human', 'waiting-external', 'completed', 'failed', 'cancelled', 'interrupted']);
  event.outcome = choice(input.outcome, ['verified', 'failed', 'unknown']) ?? 'unknown';
  event.reason = choice(input.reason, ['expected-red', 'recovered', 'unrecovered', 'autonomous', 'user-requested', 'unavailable', 'exhausted', 'ambiguous', 'missing-child']);
  event.evidence = evidence(input.evidence);
  event.artifact = evidence(input.artifact ? [input.artifact] : [])[0] ?? null;
  if (event.outcome !== 'unknown' && !validEvidence(event.evidence, event.head, time)) event.outcome = 'unknown';
  if (event.outcome === 'verified' && event.evidence.some((e) => e.result !== 'pass')) event.outcome = 'unknown';
  if (event.outcome === 'failed' && !event.evidence.some((e) => e.result === 'fail')) event.outcome = 'unknown';
  event.judge = token(input.judge);
  event.rubric = token(input.rubric);
  event.usage = usage(input.usage);
  event.request = token(input.request);
  event.allocation = choice(input.allocation, ['exclusive', 'ambiguous']) ?? 'ambiguous';
  event.childCoverage = choice(input.childCoverage, ['complete', 'partial', 'unknown']) ?? 'unknown';
  return event;
}

function evidence(items) {
  if (!Array.isArray(items)) return [];
  return items.slice(0, 100).flatMap((item) => {
    let uri;
    try { uri = new URL(item.uri); } catch { return []; }
    if (uri.protocol !== 'https:' || uri.username || uri.password || uri.search || uri.hash) return [];
    if (!/^[a-f0-9]{64}$/.test(item.sha256 ?? '')) return [];
    return [{ uri: uri.href, sha256: item.sha256, head: token(item.head), result: choice(item.result, ['pass', 'fail', 'unknown']) ?? 'unknown', expires: Number.isFinite(Date.parse(item.expires)) ? new Date(item.expires).toISOString() : null }];
  });
}

function usage(value) {
  if (!value) return null;
  const result = {};
  for (const key of ['input', 'output', 'cacheRead', 'cacheWrite', 'cacheWrite5m', 'cacheWrite1h', 'reasoning']) result[key] = number(value[key]);
  result.inputIncludesCache = typeof value.inputIncludesCache === 'boolean' ? value.inputIncludesCache : null;
  result.outputIncludesReasoning = typeof value.outputIncludesReasoning === 'boolean' ? value.outputIncludesReasoning : null;
  return result;
}

export function validEvidence(items, head, time) {
  return Boolean(head && items?.length && items.every((e) => e.head === head && e.sha256 && e.result !== 'unknown' && e.expires && Date.parse(e.expires) > Date.parse(time)));
}
