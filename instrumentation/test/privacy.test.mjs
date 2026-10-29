import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readdir, readFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const cli = new URL('../cli.mjs', import.meta.url).pathname;
test('the project hook exports only allowlisted metadata before persistence and keeps content canaries private', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'skill-privacy-'));
  const canary = 'PRIVATE_PROMPT_SOURCE_COMMAND_TOOL_ERROR_CANARY_148';
  try {
    const skill = join(dir, 'skill'); await mkdir(skill); await writeFile(join(skill, 'SKILL.md'), canary);
    const transcript = join(dir, 'session.jsonl');
    const rows = [
      { type: 'user', message: { content: canary } },
      { type: 'assistant', message: { id: 'request-1', model: 'claude-sonnet-5-5', content: [{ type: 'tool_use', input: { command: canary } }], usage: { input_tokens: 10, output_tokens: 5 } }, timestamp: '2026-10-29T18:00:01Z' },
      { type: 'user', tool_result: canary, error: canary },
    ];
    await writeFile(transcript, rows.map(JSON.stringify).join('\n'));
    const config = join(dir, 'config.json');
    await writeFile(config, JSON.stringify({ enabled: true, directory: join(dir, 'outbox'), endpoint: 'http://127.0.0.1:1', publicKey: 'test', secretKey: 'test', since: '2026-10-29T18:00:00Z', context: { workflow: 'w', attempt: 'a', invocation: 'root', skill: 'research' }, skillDirectory: skill }), { mode: 0o600 });
    const child = spawnSync(process.execPath, [cli, 'hook', 'claude'], { env: { ...process.env, SKILL_OBSERVABILITY_CONFIG: config }, input: JSON.stringify({ session_id: 's', transcript_path: transcript, prompt: canary, arguments: canary, tool_response: canary, error: canary }), encoding: 'utf8' });
    assert.equal(child.status, 0);
    assert.equal(JSON.parse(child.stdout).accepted, 1);
    const files = await readdir(join(dir, 'outbox'));
    const exported = (await Promise.all(files.map((file) => readFile(join(dir, 'outbox', file), 'utf8')))).join('');
    assert.ok(!exported.includes(canary));
    assert.ok(!child.stdout.includes(canary));
    assert.ok(!child.stderr.includes(canary));
    assert.match(exported, /claude-sonnet-5-5/);
    assert.match(exported, /cacheRead/);
    const disabled = spawnSync(process.execPath, [cli, 'hook', 'claude'], { env: { PATH: process.env.PATH }, input: '{}', encoding: 'utf8' });
    assert.equal(JSON.parse(disabled.stdout).status, 'disabled');
  } finally { await rm(dir, { recursive: true, force: true }); }
});
