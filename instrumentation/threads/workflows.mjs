// The issue-to-pr runs on this machine, from their run records' headers, so thread traces can be joined to the pilot.
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { digest } from '../contract.mjs';

const field = (record, key) => record.split('\n\n')[0].match(new RegExp(`^${key}: (.+)$`, 'm'))?.[1].trim() ?? '';

export async function issueToPrRuns(home) {
  const root = join(home, '.agent', 'issue-to-pr');
  const runs = [];
  for (const repo of await readdir(root).catch(() => [])) {
    for (const name of await readdir(join(root, repo)).catch(() => [])) {
      if (!name.endsWith('.md')) continue;
      const record = await readFile(join(root, repo, name), 'utf8').catch(() => '');
      const branch = field(record, 'branch'), repository = field(record, 'repo');
      // The same workflow ID the pilot's watcher gives a record without one.
      const workflow = field(record, 'telemetry_workflow') || digest(repository + ':' + field(record, 'issue'));
      if (branch && branch !== 'none' && repository) runs.push({ branch, repository, workflow });
    }
  }
  return runs;
}
