import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { digest, skillRevision } from './contract.mjs';
import { configuration } from './cli.mjs';
import { emit, flush } from './delivery.mjs';

export async function recordExternal(config, input) {
  if (!config.enabled) return { status: 'disabled' };
  try {
    const kind = { load: 'skill.loaded', start: 'skill.started', finish: 'skill.finished' }[input.phase];
    if (!kind) return { status: 'unavailable' };
    const artifact = input.artifact ? { uri: input.artifactUri, sha256: digest(await readFile(input.artifact)) } : null;
    const event = { ...config.context, kind, eventKey: input.eventKey, time: input.time,
      revision: await skillRevision(input.skillDirectory), head: input.head,
      execution: input.phase === 'finish' ? 'completed' : input.phase === 'start' ? 'running' : null,
      artifact, evidence: input.sources, outcome: input.outcome ?? 'unknown', judge: input.judge, rubric: input.rubric };
    return { ...(await emit(config, event)), delivery: await flush(config) };
  } catch { return { status: 'unavailable' }; }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  try { console.log(JSON.stringify(await recordExternal(await configuration(), JSON.parse(await readFile(process.argv[2], 'utf8'))))); }
  catch { console.log(JSON.stringify({ status: 'unavailable' })); }
}
