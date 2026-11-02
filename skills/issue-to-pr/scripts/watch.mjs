#!/usr/bin/env node
// Sends each issue-to-pr run's stages and token usage to the observability backend without the agent's help.
// A launchd job runs it every few minutes over this machine's run records and session transcripts.
import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { existsSync, realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runOf, SKILL } from './observe.mjs';
import { captureHook, configuration } from '../../../instrumentation/cli.mjs';
import { digest } from '../../../instrumentation/contract.mjs';
import { emit, flush } from '../../../instrumentation/delivery.mjs';

const EXECUTION = { 'awaiting-human': 'waiting-human', watching: 'waiting-external', blocked: 'failed', stopped: 'cancelled', merged: 'completed', landed: 'completed', done: 'completed' };
const FINISHED = new Set(['stopped', 'merged', 'landed', 'done']);

export async function watch(config, home = homedir()) {
  if (!config.enabled) return { status: 'disabled' };
  const since = Date.parse(config.since);
  const statePath = join(dirname(config.directory), 'watch.json');
  const state = await readFile(statePath, 'utf8').then(JSON.parse, () => ({ records: {}, transcripts: {} }));
  const summary = { status: 'watched', markers: 0, transcripts: 0, requests: 0, unavailable: 0 };

  const runs = [];
  for (const record of await files(join(home, '.agent', 'issue-to-pr'), '.md', since)) {
    const run = await runOf(record.path, config);
    runs.push(run);
    const eventKey = `${run.stage}@${run.head}`;
    if (!run.stage || state.records[record.path] === eventKey) continue;
    const kind = FINISHED.has(run.stage) ? 'skill.finished' : 'stage';
    const marker = { ...config.context, ...run, kind, eventKey, execution: EXECUTION[run.stage] ?? 'running', time: new Date(record.mtime).toISOString() };
    if ((await emit(outbox(config, run), marker)).status !== 'accepted') continue;
    state.records[record.path] = eventKey;
    summary.markers++;
  }

  for (const name of await readdir(home)) {
    const runtime = name.startsWith('.claude') ? 'claude' : name.startsWith('.codex') ? 'codex' : null;
    if (!runtime) continue;
    for (const transcript of await files(join(home, name, runtime === 'claude' ? 'projects' : 'sessions'), '.jsonl', since)) {
      if (state.transcripts[transcript.path] === transcript.mtime) continue;
      state.transcripts[transcript.path] = transcript.mtime;
      const session = await sessionOf(runtime, transcript.path);
      const run = session && runs.find((r) => r.branch && session.branches.has(r.branch) && session.places.some((place) => inRepository(place, r.repository)));
      if (!run) continue;
      const result = await captureHook({ ...outbox(config, run), skillDirectory: SKILL, context: { ...config.context, ...run, session: session.id } }, runtime, { session_id: session.id, transcript_path: transcript.path }).catch(() => ({ status: 'unavailable' }));
      summary.transcripts++;
      if (result.status === 'captured') summary.requests += result.accepted;
      else summary.unavailable++;
    }
  }

  for (const run of runs) await flush(outbox(config, run));
  await writeFile(statePath, JSON.stringify(state), { mode: 0o600 });
  return summary;
}

// Each run gets its own outbox: delivered requests stay in an outbox so later reads skip them, and they count against its size.
function outbox(config, run) {
  return { ...config, directory: join(dirname(config.directory), 'runs', digest(run.workflow).slice(0, 16)), maxBytes: 256 * 1024 * 1024 };
}

// Which session a transcript belongs to, and the branches and places it worked in.
async function sessionOf(runtime, path) {
  if ((await stat(path)).size > 64 * 1024 * 1024) return null;
  const rows = (await readFile(path, 'utf8')).split('\n').flatMap((line) => { try { return [JSON.parse(line)]; } catch { return []; } });
  if (runtime === 'claude') {
    const id = rows.find((row) => row.sessionId)?.sessionId;
    return id ? { id, branches: new Set(rows.map((row) => row.gitBranch).filter(Boolean)), places: [...new Set(rows.map((row) => row.cwd).filter(Boolean))] } : null;
  }
  const meta = rows.find((row) => row.type === 'session_meta')?.payload;
  return meta?.id ? { id: meta.id, branches: new Set([meta.git?.branch].filter(Boolean)), places: [meta.cwd, meta.git?.repository_url].filter(Boolean) } : null;
}

function inRepository(place, repository) {
  const name = repository.split('/').pop();
  return place.split('/').includes(name) || place.replace(/\.git$/, '').endsWith('/' + repository);
}

async function files(root, extension, since) {
  const names = await readdir(root, { recursive: true }).catch(() => []);
  const found = [];
  for (const name of names.filter((n) => n.endsWith(extension))) {
    const path = join(root, name);
    const { mtimeMs } = await stat(path).catch(() => ({ mtimeMs: 0 }));
    if (mtimeMs >= since) found.push({ path, mtime: mtimeMs });
  }
  return found;
}

if (process.argv[1] && existsSync(process.argv[1]) && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log(JSON.stringify(await watch(await configuration()))); }
  catch { console.log(JSON.stringify({ status: 'unavailable' })); }
}
