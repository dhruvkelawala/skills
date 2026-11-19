// One capture pass: every changed Claude and Codex transcript on the machine, joined to T3's thread data,
// sent to the general thread project. The issue-to-pr pilot's capture is separate and unchanged.
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { digest } from '../contract.mjs';
import { durable, locked } from '../delivery.mjs';
import { toSpan } from './contract.mjs';
import { Outbox } from './outbox.mjs';
import { readT3, runAt, threadFacts } from './t3.mjs';
import { issueToPrRuns } from './workflows.mjs';
import { adapter, appended, identify, transcripts } from './transcripts.mjs';

export async function pass(config, { home = homedir() } = {}) {
  if (!config.enabled) return { status: 'disabled' };
  return locked(config, async () => {
    const summary = { status: 'passed', transcripts: 0, events: 0, copied: 0, unavailable: 0, t3: 'available' };
    const since = Date.parse(config.since);
    if (!Number.isFinite(since)) return { status: 'unavailable' };
    const statePath = join(config.directory, 'state.json');
    const state = await readFile(statePath, 'utf8').then(JSON.parse, () => ({}));
    state.owners = prune(state.owners ?? {}, since);
    let t3;
    try { t3 = readT3(config.t3Database, state.t3); } catch { t3 = readT3(null, state.t3); summary.t3 = 'unavailable'; }
    state.t3 = t3.scan;
    const workflows = await issueToPrRuns(home);
    const outbox = new Outbox(config);

    for (const file of await transcripts(home, since)) {
      try {
        const result = await capture(file, { t3, workflows, outbox, since, owners: state.owners });
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

async function capture(file, { t3, workflows, outbox, since, owners }) {
  const who = await identify(file);
  const session = sessionOf(file.runtime, who.parentNative ?? who.native, t3, workflows);
  const read = adapter(file.runtime, {});
  const mine = digest(session.session).slice(0, 12);
  let sent = 0, copied = 0;
  for await (const { row } of appended(file.path, 0)) {
    if (!row) continue;
    for (const event of read(row)) {
      if (!(Date.parse(event.start) >= since)) continue;
      const run = session.t3 ? runAt(t3, session.session, event.start) : null;
      const span = toSpan(event, { ...session, run, turn: run ? null : event.turn });
      if (!span) continue;
      // The first session to send an observation owns it; a later transcript holding the same request is a copy.
      const owner = owners[span.spanId];
      if (owner && owner[0] !== mine) { copied++; continue; }
      owners[span.spanId] = [mine, day(event.start)];
      await outbox.add(span);
      sent++;
    }
  }
  return { sent, copied };
}

const day = (time) => Math.floor(Date.parse(time) / 86400000);

// Ownership older than `since` can no longer be claimed by a copy, because rows before `since` are never sent.
function prune(owners, since) {
  const first = day(new Date(since).toISOString());
  for (const [id, [, seen]] of Object.entries(owners)) if (seen < first) delete owners[id];
  return owners;
}

// A transcript's session: its T3 thread when T3 knows the native session, otherwise the runtime's own session.
function sessionOf(runtime, native, t3, workflows) {
  const thread = t3.native.get(native);
  if (!thread) return { session: `${runtime}:${native}`, t3: false, runtime, nativeSession: native };
  return { ...threadFacts(t3, thread, workflows), session: thread, t3: true, runtime, nativeSession: native };
}
