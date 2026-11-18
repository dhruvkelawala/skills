import { transcriptRows } from '../../../instrumentation/transcript.mjs';

export async function sessionOf(runtime, path) {
  let id, first, worked = new Set();
  for await (const row of transcriptRows(path)) {
    if (runtime === 'claude') {
      id ??= row.sessionId;
      if (row.cwd && row.gitBranch) worked.add(JSON.stringify([row.cwd, row.gitBranch]));
    } else if (row.type === 'session_meta') {
      id ??= row.payload?.id;
      const meta = row.payload;
      const place = meta?.git?.repository_url ?? meta?.cwd;
      if (place && meta.git?.branch) worked.add(JSON.stringify([place, meta.git.branch]));
    }
    first ??= userText(runtime, row);
  }
  const markers = [...(first ?? '').matchAll(/^issue-to-pr-run: ([\w.%:/@+-]{1,200})\s*$/gm)].map((match) => match[1]);
  const roles = [...(first ?? '').matchAll(/^issue-to-pr-helper: (reviewer|verifier|council)\s*$/gm)].map((match) => match[1]);
  const ids = [...(first ?? '').matchAll(/^issue-to-pr-helper-id: ([\w.-]{1,100})\s*$/gm)].map((match) => match[1]);
  return id ? { version: 3, id, worked: [...worked].map(JSON.parse), markers: [...new Set(markers)], helper: new Set(roles).size === 1 ? roles[0] : 'build', helperId: new Set(ids).size === 1 ? ids[0] : null } : null;
}

export function attributeSession(session, runs) {
  if (!session) return null;
  const matches = runs.filter((run) => run.branch && run.branch !== 'none' && session.worked.some(([place, branch]) => branch === run.branch && inRepository(place, run.repository)));
  if (matches.length) return matches.length === 1 ? matches[0] : null;
  if (session.markers?.length !== 1) return null;
  const named = runs.filter((run) => run.workflow === session.markers[0]);
  return named.length === 1 ? named[0] : null;
}

function userText(runtime, row) {
  const message = runtime === 'claude' && row.type === 'user' ? row.message
    : row.type === 'response_item' && row.payload?.type === 'message' && row.payload.role === 'user' ? row.payload : null;
  if (message) {
    if (typeof message.content === 'string') return message.content;
    const text = message.content?.filter((part) => ['text', 'input_text'].includes(part.type)).map((part) => part.text).join('\n');
    if (text) return text;
  }
  if (runtime === 'codex' && row.type === 'event_msg' && row.payload?.type === 'user_message') return row.payload.message;
  return undefined;
}

function inRepository(place, repository) {
  if (place.includes('://') || place.includes('@')) return place.replace(/\.git$/, '').endsWith('/' + repository) || place.replace(/\.git$/, '').endsWith(':' + repository);
  return place.split('/').includes(repository.split('/').pop());
}
