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

export async function pass(config, { home = homedir() } = {}) {
  if (!config.enabled) return { status: 'disabled' };
  return locked(config, async () => {
    const summary = { status: 'passed', transcripts: 0, events: 0, copied: 0, unavailable: 0, t3: 'available' };
    const since = Date.parse(config.since);
    if (!Number.isFinite(since)) return { status: 'unavailable' };
    const statePath = join(config.directory, 'state.json');
    const state = await readFile(statePath, 'utf8').then(JSON.parse, () => ({}));
    state.owners = prune(state.owners ?? {}, since, ([, seen]) => seen);
    state.spawns = prune(state.spawns ?? {}, since, (spawn) => spawn.day);
    let t3;
    try { t3 = readT3(config.t3Database, state.t3); } catch { t3 = readT3(null, state.t3); summary.t3 = 'unavailable'; }
    state.t3 = t3.scan;
    const workflows = await issueToPrRuns(home);
    const outbox = new Outbox(config);

    for (const file of await transcripts(home, since)) {
      try {
        const result = await capture(file, { t3, workflows, outbox, since, owners: state.owners, spawns: state.spawns });
        summary.events += result.sent;
        summary.copied += result.copied;
        summary.transcripts++;
      } catch { summary.unavailable++; }
    }
    await outbox.seal();
    await durable(statePath, state);
    await outbox.deliver();
    return { ...summary, ...(await outbox.counts()) };
  });
}

async function capture(file, { t3, workflows, outbox, since, owners, spawns }) {
  const who = await identify(file);
  const session = sessionOf(file.runtime, who.parentNative ?? who.native, t3, workflows);
  const progress = {};
  const read = adapter(file.runtime, progress, spawns);
  const mine = digest(session.session).slice(0, 12);
  let sent = 0, copied = 0;

  // A native subagent's transcript joins its parent's session, under the span that started it and in that span's turn.
  // Claude's Agent tool call is that span; a Codex subagent gets a span of its own covering its transcript.
  const spawnedBy = who.spawnedBy ? observationId('tool', 'claude', who.spawnedBy) : observationId('subagent', file.runtime, who.native);
  const spawn = who.parentNative ? spawns[who.spawnedBy ?? who.native] : null;
  const send = async (event) => {
    if (who.parentNative) event = { ...event, parent: event.kind === 'subagent' ? null : spawnedBy, turn: spawn?.turn ?? event.turn };
    if (!(Date.parse(event.start) >= since)) return;
    const run = session.t3 ? runAt(t3, session.session, event.start) : null;
    const span = toSpan(event, { ...session, run, turn: run ? null : event.turn });
    if (!span) return;
    // The first session to send an observation owns it; a later transcript holding the same request is a copy.
    const owner = owners[span.spanId];
    if (owner && owner[0] !== mine) { copied++; return; }
    owners[span.spanId] = [mine, day(event.start)];
    await outbox.add(span);
    sent++;
  };

  for await (const { row } of appended(file.path, 0)) {
    if (!row) continue;
    for (const event of read(row)) await send(event);
  }
  for (const event of abandoned(progress)) await send(event);
  if (who.parentNative && !who.spawnedBy && progress.first) {
    await send({ kind: 'subagent', source: who.native, start: progress.first, end: progress.last, childSession: who.native, childThread: t3.native.get(who.native), turn: progress.turn });
  }
  return { sent, copied };
}

const day = (time) => Math.floor(Date.parse(time) / 86400000);

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
