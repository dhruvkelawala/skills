// One capture pass: every changed Claude and Codex transcript on the machine, joined to T3's thread data,
// sent to the general thread project. The issue-to-pr pilot's capture is separate and unchanged.
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { digest } from '../contract.mjs';
import { durable, locked } from '../delivery.mjs';
import { observationId, toSpan } from './contract.mjs';
import { Outbox } from './outbox.mjs';
import { readT3, runAt, threadFacts } from './t3.mjs';
import { issueToPrRuns } from './workflows.mjs';
import { abandoned, adapter, appended, identify, transcripts } from './transcripts.mjs';

const DAY = 86400000;

// A backfill is one pass from `from` without a time budget. Its spans stream through the outbox as it reads.
// It keeps its own cursors: the regular passes' cursors sit past rows older than their `since`, which a backfill must read.
export const backfill = (config, { home = homedir(), from }) => pass({ ...config, since: from, budgetMs: Infinity, stateFile: 'backfill-state.json' }, { home });

// A pass stops opening transcripts once `budgetMs` has passed, so it fits the 5-minute schedule; the rest wait for the next.
// Each transcript has a cursor, so a pass reads only what was appended since the last one.
export async function pass(config, { home = homedir() } = {}) {
  if (!config.enabled) return { status: 'disabled' };
  return locked(config, async () => {
    const started = Date.now();
    const summary = { status: 'passed', transcripts: 0, bytes: 0, events: 0, copied: 0, deferred: 0, unavailable: 0, t3: 'available' };
    // Rows older than the retention window are never sent, which bounds the ownership the state remembers.
    const since = Math.max(Date.parse(config.since), started - (config.retentionDays ?? 45) * DAY);
    if (!Number.isFinite(since)) return { status: 'unavailable' };
    const statePath = join(config.directory, config.stateFile ?? 'state.json');
    const state = await readFile(statePath, 'utf8').then(JSON.parse, () => ({}));
    state.owners = prune(state.owners ?? {}, since, ([, seen]) => seen);
    state.spawns = prune(state.spawns ?? {}, since, (spawn) => spawn.day);
    let t3;
    const outbox = new Outbox(config);
    // Without T3, every T3 session would be filed under its native ID for good, so the pass waits for the next one.
    try { t3 = readT3(config.t3Database, state.t3); } catch {
      await outbox.deliver();
      return { ...summary, status: 'unavailable', t3: 'unavailable', ...(await outbox.counts()) };
    }
    state.t3 = t3.scan;
    const workflows = await issueToPrRuns(home);

    const cursors = {};
    for (const file of await transcripts(home, since)) {
      const cursor = state.cursors?.[file.path];
      cursors[file.path] = cursor;
      if (cursor && cursor.ino === file.ino && cursor.size === file.size && cursor.mtime === file.mtime) continue;
      if (Date.now() >= started + (config.budgetMs ?? 240000) || await outbox.full()) { summary.deferred++; continue; }
      try {
        const result = await capture(file, cursor, { t3, workflows, outbox, since, owners: state.owners, spawns: state.spawns });
        cursors[file.path] = result.cursor;
        summary.bytes += result.bytes;
        summary.events += result.sent;
        summary.copied += result.copied;
        summary.transcripts++;
      } catch { summary.unavailable++; }
      if ((await outbox.batches()).length >= (config.flushAt ?? 20)) await outbox.deliver();
    }
    state.cursors = cursors;
    await outbox.seal();
    await durable(statePath, state);
    await outbox.deliver();
    return { ...summary, ...(await outbox.counts()) };
  });
}

async function capture(file, cursor, { t3, workflows, outbox, since, owners, spawns }) {
  // A replaced or truncated transcript starts again from the top; ownership keeps its requests from repeating.
  const fresh = !cursor || cursor.ino !== file.ino || file.size < cursor.offset;
  const who = fresh ? await identify(file) : cursor.who;
  const start = fresh ? 0 : cursor.offset;
  const progress = fresh ? {} : cursor.progress;
  const session = sessionOf(file.runtime, who.parentNative ?? who.native, t3, workflows);
  const read = adapter(file.runtime, progress, spawns);
  const mine = digest(file.path).slice(0, 12);
  // Streaming writes a request's counts across several rows, so a transcript's spans wait here and only the last
  // version of each reaches the outbox. Two versions in different batches could land in either order.
  const spans = new Map();
  let copied = 0;

  // A native subagent's transcript joins its parent's session, under the span that started it and in that span's turn.
  // Claude's Agent tool call is that span; a Codex subagent gets a span of its own covering its transcript.
  const spawnedBy = who.spawnedBy ? observationId('tool', 'claude', who.spawnedBy) : observationId('subagent', file.runtime, who.native);
  const spawn = who.parentNative ? spawns[who.spawnedBy ?? who.native] : null;
  const send = (event) => {
    if (who.parentNative) event = { ...event, parent: event.kind === 'subagent' ? null : spawnedBy, turn: spawn?.turn ?? event.turn };
    if (!(Date.parse(event.start) >= since)) return;
    const run = session.t3 ? runAt(t3, session.session, event.start) : null;
    const span = toSpan(event, { ...session, run, turn: run ? null : event.turn });
    if (!span) return;
    // The first transcript to send an observation owns it; a later one holding the same request is a copy,
    // whether it is a resumed session or a forked subagent in the same session.
    const owner = owners[span.spanId];
    if (owner && owner[0] !== mine) { copied++; return; }
    owners[span.spanId] = [mine, day(event.start)];
    spans.set(span.spanId, span);
  };

  let offset = start;
  for await (const { row, offset: next } of appended(file.path, start)) {
    offset = next;
    if (!row) continue;
    for (const event of read(row)) send(event);
  }
  for (const event of abandoned(progress)) send(event);
  if (who.parentNative && !who.spawnedBy && progress.first) {
    send({ kind: 'subagent', source: who.native, start: progress.first, end: progress.last, childSession: who.native, childThread: t3.native.get(who.native), turn: progress.turn });
  }
  for (const span of spans.values()) await outbox.add(span);
  return { sent: spans.size, copied, bytes: offset - start, cursor: { ino: file.ino, size: file.size, mtime: file.mtime, offset, who, progress } };
}

const day = (time) => Math.floor(Date.parse(time) / DAY);

// Entries from before `since` are dropped: rows that old are never sent, so no copy can claim them.
function prune(entries, since, dayOf) {
  const first = day(new Date(since).toISOString());
  for (const [key, value] of Object.entries(entries)) if (!(dayOf(value) >= first)) delete entries[key];
  return entries;
}

// A transcript's session: its T3 thread when T3 knows the native session, otherwise the runtime's own session.
function sessionOf(runtime, native, t3, workflows) {
  const thread = t3.native.get(native);
  if (!thread) return { session: `${runtime}:${native}`, t3: false, runtime, nativeSession: native };
  return { ...threadFacts(t3, thread, workflows), session: thread, t3: true, runtime, nativeSession: native };
}
