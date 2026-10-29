import { validEvidence } from './contract.mjs';

export function summarize(events, { head, now = new Date().toISOString() }) {
  const unique = [...new Map(events.map((e) => [e.eventId, e])).values()].sort((a, b) => Date.parse(a.time) - Date.parse(b.time));
  let activeMs = 0, waitMs = 0, execution = 'unknown', previous = null, outcome = 'unknown';
  const repairs = { autonomous: 0, requested: 0 };
  for (const e of unique.filter((e) => !e.parent)) {
    const time = Date.parse(e.time);
    if (e.execution) {
      if (previous !== null) {
        if (execution === 'running') activeMs += Math.max(0, time - previous);
        if (execution.startsWith('waiting-')) waitMs += Math.max(0, time - previous);
      }
      execution = e.execution;
      previous = time;
    }
    if (e.kind === 'repair') {
      if (e.reason === 'user-requested') repairs.requested++;
      if (e.reason === 'autonomous') repairs.autonomous++;
    }
    if (e.kind === 'skill.finished') outcome = validEvidence(e.evidence, head, now) ? e.outcome : 'unknown';
  }
  if (previous !== null) {
    if (execution === 'running') activeMs += Math.max(0, Date.parse(now) - previous);
    if (execution.startsWith('waiting-')) waitMs += Math.max(0, Date.parse(now) - previous);
  }
  return { activeMs, waitMs, execution, outcome, repairs };
}
