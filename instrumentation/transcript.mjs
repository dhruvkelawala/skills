import { createReadStream } from 'node:fs';

export async function* transcriptRows(path) {
  const input = createReadStream(path, { encoding: 'utf8' });
  let pending = '';
  try {
    for await (const chunk of input) {
      pending += chunk;
      let end;
      while ((end = pending.indexOf('\n')) >= 0) {
        const line = pending.slice(0, end);
        pending = pending.slice(end + 1);
        if (line.trim()) yield JSON.parse(line);
      }
    }
    if (pending.trim()) {
      let row;
      try { row = JSON.parse(pending); } catch { return; }
      yield row;
    }
  } finally { input.destroy(); }
}
