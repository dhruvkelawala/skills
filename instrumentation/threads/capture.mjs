// One capture pass: every changed Claude and Codex transcript on the machine, joined to T3's thread data,
// sent to the general thread project. The issue-to-pr pilot's capture is separate and unchanged.
import { homedir } from 'node:os';
import { locked } from '../delivery.mjs';
import { toSpan } from './contract.mjs';
import { Outbox } from './outbox.mjs';
import { readT3, runAt } from './t3.mjs';
import { adapter, appended, identify, transcripts } from './transcripts.mjs';

export async function pass(config, { home = homedir() } = {}) {
  if (!config.enabled) return { status: 'disabled' };
  return locked(config, async () => {
    const summary = { status: 'passed', transcripts: 0, events: 0, unavailable: 0, t3: 'available' };
    const since = Date.parse(config.since);
    if (!Number.isFinite(since)) return { status: 'unavailable' };
    let t3;
    try { t3 = readT3(config.t3Database); } catch { t3 = readT3(null); summary.t3 = 'unavailable'; }
    const outbox = new Outbox(config);

    for (const file of await transcripts(home, since)) {
      try {
        summary.events += await capture(file, { t3, outbox, since });
        summary.transcripts++;
      } catch { summary.unavailable++; }
    }
    await outbox.seal();
    await outbox.deliver();
    return { ...summary, ...(await outbox.counts()) };
  });
}

async function capture(file, { t3, outbox, since }) {
  const who = await identify(file);
  const session = sessionOf(file.runtime, who.parentNative ?? who.native, t3);
  const read = adapter(file.runtime, {});
  let sent = 0;
  for await (const { row } of appended(file.path, 0)) {
    if (!row) continue;
    for (const event of read(row)) {
      if (!(Date.parse(event.start) >= since)) continue;
      const run = session.t3 ? runAt(t3, session.session, event.start) : null;
      const span = toSpan(event, { ...session, run, turn: run ? null : event.turn });
      if (span) { await outbox.add(span); sent++; }
    }
  }
  return sent;
}

// A transcript's session: its T3 thread when T3 knows the native session, otherwise the runtime's own session.
function sessionOf(runtime, native, t3) {
  const thread = t3.native.get(native);
  if (!thread) return { session: `${runtime}:${native}`, t3: false, runtime, nativeSession: native };
  return { session: thread, t3: true, runtime, nativeSession: native };
}
