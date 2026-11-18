import { readFile, stat } from 'node:fs/promises';
import { digest } from '../../../instrumentation/contract.mjs';
import { emitBatch } from '../../../instrumentation/delivery.mjs';

export async function captureAutoreview(config, run, path, id) {
  const status = JSON.parse(await readFile(path, 'utf8'));
  if (status.schema_version !== 1 || !['codex', 'claude'].includes(status.engine)) return { status: 'unavailable' };
  const tokens = status.usage?.tokens;
  const claude = status.engine === 'claude';
  const usage = tokens ? {
    input: tokens.input_tokens, output: tokens.output_tokens,
    cacheRead: claude ? tokens.cache_read_input_tokens : tokens.cached_input_tokens,
    cacheWrite: claude ? tokens.cache_creation_input_tokens : null,
    cacheWrite5m: claude ? tokens.ephemeral_5m_input_tokens : null,
    cacheWrite1h: claude ? tokens.ephemeral_1h_input_tokens : null,
    reasoning: claude ? null : tokens.reasoning_output_tokens,
    inputIncludesCache: !claude, outputIncludesReasoning: true,
  } : null;
  const request = digest(JSON.stringify(['autoreview', run.workflow, id]));
  const result = await emitBatch(config, [{ ...config.context, ...run, kind: 'request', request, eventKey: request, session: request,
    helper: 'autoreview', task: id, provider: status.engine, model: status.model,
    time: (await stat(path)).mtime.toISOString(), usage }], { remember: true });
  const measured = usage && Number.isSafeInteger(usage.input) && usage.input >= 0 && Number.isSafeInteger(usage.output) && usage.output >= 0;
  return { ...result, measured: Boolean(measured && status.usage.complete === true), session: request };
}
