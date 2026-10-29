import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { metadataEvent, digest, skillRevision } from '../contract.mjs';
import { captureRequests, totals } from '../accounting.mjs';
import { emit, flush, status } from '../delivery.mjs';
import { usageQuery } from '../queries.mjs';

const privateDir = process.env.SKILL_PILOT_PRIVATE ?? '/Volumes/SumoDeus NVMe/skill-observability-bakeoff';
const work = process.env.SKILL_PILOT_STATE;
if (!work) throw new Error('set SKILL_PILOT_STATE to a private directory');
await mkdir(work, { recursive: true, mode: 0o700 });
const keys = JSON.parse(await readFile(join(privateDir, 'langfuse-credentials.json'), 'utf8'));
const config = { enabled: true, directory: join(work, 'outbox'), endpoint: keys.base_url, publicKey: keys.public_key, secretKey: keys.secret_key, timeoutMs: 10000, retryMs: 0 };
const api = async (path) => {
  const response = await fetch(new URL('/api/public/' + path, config.endpoint), { headers: { authorization: 'Basic ' + Buffer.from(config.publicKey + ':' + config.secretKey).toString('base64') } });
  if (!response.ok) throw new Error('backend read HTTP ' + response.status);
  return response.json();
};
const command = process.argv[2];
const statePath = join(work, 'probe.json');
let state;
if (command === 'seed') {
  const workflow = 'pilot-' + crypto.randomUUID();
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const now = new Date().toISOString();
  const revision = await skillRevision(fileURLToPath(new URL('../../skills/issue-to-pr', import.meta.url)));
  const context = { workflow, attempt: 'first', invocation: 'root', skill: 'issue-to-pr', revision, head, session: 'synthetic-session', childCoverage: 'partial' };
  const row = { type: 'event_msg', timestamp: now, payload: { type: 'token_count', info: { total_token_usage: { input_tokens: 200, output_tokens: 40, cached_input_tokens: 50, reasoning_output_tokens: 10 } } } };
  const canary = 'PILOT_PROMPT_SOURCE_COMMAND_TOOL_ERROR_CANARY_148';
  const events = [metadataEvent({ ...context, kind: 'skill.started', execution: 'running', eventKey: 'start', time: now }), ...captureRequests('codex', [{ type: 'response_item', payload: { content: canary, arguments: canary, error: canary } }, row, row], context), metadataEvent({ ...context, kind: 'gate', eventKey: 'evidence-failure', time: now, outcome: 'failed', judge: 'fixture-file-check', rubric: 'pilot/v1', evidence: [{ uri: 'https://example.org/pilot/failed-evidence', sha256: digest('failed evidence'), head, result: 'fail', expires: new Date(Date.now() + 3600000).toISOString() }], prompt: canary, toolResult: canary, error: canary })];
  state = { workflow, head, events, canary, expected: { total: 240, requests: 1, observations: 3 } };
  assert.equal(totals(events, 'root').inclusive.total, 240);
  await writeFile(statePath, JSON.stringify(state), { mode: 0o600 });
  for (const event of events) assert.equal((await emit(config, { ...event, eventKey: event.request ?? event.kind })).status, 'accepted');
  console.log(JSON.stringify({ phase: 'seed', workflow, expected: state.expected, delivery: await flush(config) }));
} else {
  state = JSON.parse(await readFile(statePath, 'utf8'));
  if (command === 'replay') {
    for (const event of state.events) await emit(config, { ...event, eventKey: event.request ?? event.kind });
    console.log(JSON.stringify({ phase: command, delivery: await flush(config) }));
  } else if (command === 'flush') console.log(JSON.stringify(await flush(config)));
  else if (command === 'status') console.log(JSON.stringify(await status(config)));
  else if (command === 'read') {
    const traceId = digest(state.workflow).slice(0, 32);
    const rows = await api('v2/observations?traceId=' + traceId + '&fields=core,basic,usage,model,input,output,metadata');
    const unique = [...new Map(rows.data.map((o) => [o.id, o])).values()];
    const q = usageQuery(state.workflow, new Date(Date.now() - 3600000).toISOString(), new Date(Date.now() + 60000).toISOString());
    const metrics = await api('v2/metrics?query=' + encodeURIComponent(JSON.stringify(q)));
    assert.equal(metrics.data[0].sum_totalTokens, 240);
    assert.equal(metrics.data[0].count_count, 3);
    const scores = await api('v3/scores?traceId=' + traceId);
    assert.ok(!JSON.stringify({ rows, scores }).includes(state.canary), 'stored fields must suppress every content canary');
    assert.equal(unique.length, 3);
    const generation = unique.find((o) => o.type === 'GENERATION');
    assert.equal(generation.usageDetails.input, 150);
    assert.equal(generation.usageDetails.output, 30);
    assert.equal(generation.usageDetails.cache_read, 50);
    assert.equal(generation.usageDetails.reasoning, 10);
    assert.equal(scores.data.filter((s) => s.name === 'evidence-failure').length, 1);
    const result = { phase: 'backend-only-fixture', capturedHead: state.head, workflow: state.workflow, traceId, uniqueObservations: unique.length, rawRows: rows.data.length, sourceTotals: state.expected, metrics, usageDetails: generation.usageDetails, evidenceFailureScores: scores.data.length, storedCanaryAbsent: true };
    await writeFile(join(work, 'readback.json'), JSON.stringify({ rows, metrics, scores }), { mode: 0o600 });
    console.log(JSON.stringify(result, null, 2));
  } else throw new Error('usage: probe.mjs seed|replay|read|flush|status');
}
