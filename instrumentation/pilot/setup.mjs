import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { digest } from '../contract.mjs';

const [action, runtime, project, config] = process.argv.slice(2);
if (!['create', 'remove'].includes(action) || !['claude', 'codex'].includes(runtime) || !project || !config) throw new Error('usage: setup.mjs create|remove claude|codex <project> <private-config>');
const quote = (value) => "'" + value.replaceAll("'", "'\\''") + "'";
const cli = fileURLToPath(new URL('../cli.mjs', import.meta.url));
const command = `SKILL_OBSERVABILITY_CONFIG=${quote(resolve(config))} ${quote(process.execPath)} ${quote(cli)} hook ${runtime}`;
const hook = { type: 'command', command, timeout: 15 };
const endHook = runtime === 'codex' ? { ...hook, timeout: 3 } : hook;
const contents = JSON.stringify({ hooks: { Stop: [{ hooks: [hook] }], SessionEnd: [{ hooks: [endHook] }] } }, null, 2) + '\n';
const path = join(resolve(project), runtime === 'claude' ? '.claude/settings.local.json' : '.codex/hooks.json');
if (action === 'create') {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, contents, { flag: 'wx', mode: 0o600 });
} else {
  if (digest(await readFile(path)) !== digest(contents)) throw new Error('hook changed; preserve it for manual review');
  await unlink(path);
}
console.log(JSON.stringify({ action, path, sha256: digest(contents), command, trusted: 'unassessed' }));
