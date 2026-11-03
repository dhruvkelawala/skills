#!/usr/bin/env node
import { readdir, readFile } from 'node:fs/promises';
import { existsSync, realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { header } from './run-record.mjs';
import { captureHook, configuration } from '../../../instrumentation/cli.mjs';
import { digest, skillRevision } from '../../../instrumentation/contract.mjs';
import { emit, flush } from '../../../instrumentation/delivery.mjs';

export const SKILL = fileURLToPath(new URL('..', import.meta.url));
const revision = skillRevision(SKILL);

export async function observe(recordPath, input, config, env = process.env) {
  if (!config.enabled) return { status: 'disabled' };
  const run = await runOf(recordPath);
  const result = { ...(await emit(config, { ...config.context, ...input, ...run })), delivery: await flush(config) };
  let usage = { status: 'unavailable' };
  try {
    const session = await currentSession(env);
    if (session) {
      const context = { ...config.context, ...run, session: session.session_id };
      usage = await captureHook({ ...config, skillDirectory: SKILL, context }, session.runtime, session);
    }
  } catch {}
  return { ...result, usage };
}

// A run's identity and progress, from its record's header.
export async function runOf(recordPath) {
  const record = await readFile(recordPath, 'utf8');
  const workflow = header(record, 'telemetry_workflow') || digest(header(record, 'repo') + ':' + header(record, 'issue'));
  return {
    workflow,
    // A record without its own attempt gets one per run, never the machine-wide default.
    attempt: header(record, 'telemetry_attempt') || digest('attempt:' + workflow).slice(0, 32),
    invocation: 'issue-to-pr', skill: 'issue-to-pr',
    repository: header(record, 'repo'), branch: header(record, 'branch'), head: header(record, 'head'),
    stage: header(record, 'stage').match(/^[a-z-]+/)?.[0] ?? null,
    revision: await revision,
  };
}

// The owning session's own transcript, found from the ID its runtime exports to shell commands.
export async function currentSession(env = process.env) {
  const list = (root, options) => readdir(root, options).catch(() => []);
  const id = env.CLAUDE_CODE_SESSION_ID ?? env.CODEX_THREAD_ID;
  if (!id || !/^[\w-]+$/.test(id)) return null;
  if (env.CLAUDE_CODE_SESSION_ID) {
    const root = join(env.CLAUDE_CONFIG_DIR ?? join(homedir(), '.claude'), 'projects');
    const file = (await list(root)).map((project) => join(root, project, `${id}.jsonl`)).find(existsSync);
    return file ? { runtime: 'claude', session_id: id, transcript_path: file } : null;
  }
  const root = join(env.CODEX_HOME ?? join(homedir(), '.codex'), 'sessions');
  const file = (await list(root, { recursive: true })).find((path) => path.endsWith(`-${id}.jsonl`));
  return file ? { runtime: 'codex', session_id: id, transcript_path: join(root, file) } : null;
}

if (process.argv[1] && existsSync(process.argv[1]) && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const input = JSON.parse(await readFile(process.argv[3], 'utf8'));
    console.log(JSON.stringify(await observe(process.argv[2], input, await configuration())));
  } catch { console.log(JSON.stringify({ status: 'unavailable' })); }
}
