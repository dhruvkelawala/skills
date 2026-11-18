import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { digest } from '../../../instrumentation/contract.mjs';

const pathOf = (config, run) => join(dirname(config.directory), 'coverage', digest(run.workflow) + '.json');
const receipts = (config, run) => readFile(pathOf(config, run), 'utf8').then(JSON.parse, () => ({}));

export async function helperCoverage(config, run) {
  if (!run.expectedHelpers) return 'unknown';
  const captured = await receipts(config, run);
  return run.expectedHelpers.every((id) => captured[id]) ? 'complete' : 'partial';
}

export async function recordHelper(config, run, id, session) {
  if (!id || !run.expectedHelpers?.includes(id)) return;
  const path = pathOf(config, run);
  const captured = await receipts(config, run);
  captured[id] = session;
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const temp = path + '.tmp-' + process.pid;
  await writeFile(temp, JSON.stringify(captured), { mode: 0o600 });
  await rename(temp, path);
}
