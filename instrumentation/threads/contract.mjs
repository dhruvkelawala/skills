// The t3-thread/v1 contract: the only fields that leave the machine, and how they map onto OTLP for Langfuse.
// A field missing from these lists is dropped.
import { digest } from '../contract.mjs';
import { usageDetails } from '../delivery.mjs';

export const SCHEMA = 't3-thread/v1';
export const KINDS = ['generation', 'tool', 'subagent', 'compaction', 'handoff', 'api-error'];

const text = (max) => (value) => typeof value === 'string' && value.length > 0 && value.length <= max && !/[\u0000-\u001f\u007f]/.test(value) ? value : null;
const id = (value) => typeof value === 'string' && /^[\w.:%/@+-]{1,300}$/.test(value) ? value : null;
const count = (value) => Number.isSafeInteger(value) && value >= 0 ? value : null;
const flag = (value) => typeof value === 'boolean' ? value : null;
const one = (choices) => (value) => choices.includes(value) ? value : null;

// Session and trace metadata: what T3 knows about the thread, and which turn the trace is.
export const SESSION_FIELDS = {
  session: id, t3: flag, runtime: one(['claude', 'codex']), nativeSession: id,
  title: text(300), project: text(300), projectId: id, branch: text(300), worktree: text(1000),
  providerInstance: id, interactionMode: id, runtimeMode: id, createdBy: id, creationSource: id,
  lineageParent: id, lineageRoot: id, lineageRelationship: id, launcher: id, workflow: id,
  run: id, turn: id,
};

// Observation metadata: counters, names, times and flags. Never prompts, replies, tool input or output.
export const OBSERVATION_FIELDS = {
  kind: one(KINDS), name: text(300), model: id, effort: id, provider: id, contextWindow: count,
  error: flag, trigger: id, preTokens: count, postTokens: count, childSession: id, childThread: id,
};

// Session fields also copied onto each observation, so cost per lineage tree works from observation rows.
export const LINEAGE_EDGES = ['launcher', 'lineageParent'];

const USAGE = ['input', 'output', 'cacheRead', 'cacheWrite', 'cacheWrite5m', 'cacheWrite1h', 'reasoning'];

export const traceId = (session, trace) => digest(`trace|${session}|${trace}`).slice(0, 32);
export const observationId = (kind, runtime, source) => digest(`${SCHEMA}|${kind}|${runtime}|${source}`).slice(0, 16);

const nanos = (time) => String(BigInt(Date.parse(time)) * 1000000n);
const attribute = (key, value) => ({ key, value: { stringValue: typeof value === 'string' ? value : JSON.stringify(value) } });

function allowed(fields, input) {
  const result = {};
  for (const [key, check] of Object.entries(fields)) {
    const value = check(input?.[key]);
    if (value !== null) result[key] = value;
  }
  return result;
}

function usage(value) {
  if (!value) return null;
  const result = {};
  for (const key of USAGE) result[key] = count(value[key]);
  result.inputIncludesCache = flag(value.inputIncludesCache);
  result.outputIncludesReasoning = flag(value.outputIncludesReasoning);
  return result;
}

// One OTLP span from an adapter event and its session. Only allowlisted fields are copied.
export function toSpan(event, session) {
  const meta = allowed(SESSION_FIELDS, session);
  const observation = allowed(OBSERVATION_FIELDS, event);
  const start = Number.isFinite(Date.parse(event.start)) ? event.start : null;
  if (!observation.kind || !meta.session || !start || !id(event.source)) return null;
  const end = Number.isFinite(Date.parse(event.end)) && Date.parse(event.end) >= Date.parse(start) ? event.end : start;
  const type = observation.kind === 'generation' ? 'generation' : ['tool', 'subagent'].includes(observation.kind) ? 'span' : 'event';
  const attributes = [
    attribute('session.id', meta.session),
    attribute('langfuse.trace.name', meta.title ?? `${meta.runtime ?? 'agent'} session`),
    attribute('langfuse.trace.tags', [SCHEMA, meta.runtime ?? 'unknown', `t3:${meta.t3 === true}`]),
    attribute('langfuse.observation.type', type),
  ];
  for (const [key, value] of Object.entries(meta)) attributes.push(attribute('langfuse.trace.metadata.' + key, value));
  for (const [key, value] of Object.entries(observation)) attributes.push(attribute('langfuse.observation.metadata.' + key, value));
  // Observation queries can't see trace metadata, so the lineage edges ride on every observation too.
  for (const key of LINEAGE_EDGES) if (meta[key]) attributes.push(attribute('langfuse.observation.metadata.' + key, meta[key]));
  if (observation.kind === 'generation') {
    if (observation.model) attributes.push(attribute('langfuse.observation.model.name', observation.model));
    const details = usageDetails(usage(event.usage));
    if (details) attributes.push(attribute('langfuse.observation.usage_details', details));
  }
  if (observation.error === true || observation.kind === 'api-error') attributes.push(attribute('langfuse.observation.level', 'ERROR'));
  const span = {
    traceId: traceId(meta.session, meta.run ?? meta.turn ?? 'session'),
    spanId: observationId(observation.kind, meta.runtime, event.source),
    name: observation.kind === 'tool' ? observation.name ?? 'tool' : observation.kind === 'generation' ? 'provider.request' : observation.kind,
    kind: 1, startTimeUnixNano: nanos(start), endTimeUnixNano: nanos(end), attributes,
  };
  if (id(event.parent)) span.parentSpanId = event.parent;
  return span;
}

export function otlp(spans) {
  return { resourceSpans: [{ resource: { attributes: [attribute('service.name', 't3-thread-capture')] }, scopeSpans: [{ scope: { name: SCHEMA }, spans }] }] };
}
