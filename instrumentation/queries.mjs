import { digest } from './contract.mjs';

export function monitorRules({ projectId, workflow, tokenWarning = 100000, triggerIds = [] }) {
  if (!workflow || !projectId || !Number.isSafeInteger(tokenWarning) || tokenWarning < 0) throw new Error('invalid warning configuration');
  const trace = digest(workflow).slice(0, 32);
  const base = { projectId, window: '1h', thresholdOperator: 'GT', warningThreshold: null, triggerIds, tags: ['skill-run/v1'] };
  const scope = { column: 'traceId', operator: '=', value: trace, type: 'string' };
  return [
    { ...base, name: `${workflow}: token warning; evidence trace ${trace}`, view: 'scores-numeric', metric: { measure: 'value', aggregation: 'sum' }, filters: [scope, { column: 'name', operator: '=', value: 'runtime-tokens', type: 'string' }], alertThreshold: tokenWarning },
    { ...base, name: `${workflow}: evidence failure; evidence trace ${trace}`, view: 'scores-boolean', metric: { measure: 'count', aggregation: 'count' }, filters: [scope, { column: 'name', operator: '=', value: 'evidence-failure', type: 'string' }, { column: 'booleanValue', operator: '=', value: true, type: 'boolean' }], alertThreshold: 0 },
  ];
}

export function usageQuery(workflow, fromTimestamp, toTimestamp) {
  return { view: 'scores-numeric', dimensions: [], metrics: [{ measure: 'value', aggregation: 'sum' }, { measure: 'count', aggregation: 'count' }], filters: [{ column: 'traceId', operator: '=', value: digest(workflow).slice(0, 32), type: 'string' }, { column: 'name', operator: '=', value: 'runtime-tokens', type: 'string' }], fromTimestamp, toTimestamp };
}
