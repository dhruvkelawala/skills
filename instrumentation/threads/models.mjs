// Model prices Langfuse 4.72 lacks, added to the thread project so its generations get a cost.
// Prices are Anthropic list prices per token (claude-api skill, models table cached 2026-11-03):
// Fable 5.2 is $8 input, $40 output, $0.20 cache read, $10 5-minute and $16 1-hour cache writes per million tokens.
const perToken = (dollarsPerMillion) => Number((dollarsPerMillion / 1e6).toPrecision(10));

const FABLE_5_2 = {
  input: perToken(8), output: perToken(40), cacheRead: perToken(0.2), cacheWrite5m: perToken(10), cacheWrite1h: perToken(16),
};

export const MODELS = [{
  modelName: 'claude-fable-5-2',
  // The same shape as Langfuse's own Claude patterns: the Anthropic ID, or the Bedrock ID with its regional prefix.
  matchPattern: '(?i)^((anthropic/)?claude-fable-5-2|(eu\\.|us\\.|apac\\.|au\\.|jp\\.|global\\.)?anthropic\\.claude-fable-5-2(-v1(:0)?)?)$',
  unit: 'TOKENS',
  tokenizerId: 'claude',
  pricingTiers: [{
    name: 'Standard', isDefault: true, priority: 0, conditions: [],
    // Every usage key name Langfuse's Claude definitions price, so each spelling a client sends is covered.
    prices: {
      input: FABLE_5_2.input, input_tokens: FABLE_5_2.input,
      output: FABLE_5_2.output, output_tokens: FABLE_5_2.output,
      input_cache_read: FABLE_5_2.cacheRead, cache_read_input_tokens: FABLE_5_2.cacheRead, input_cached_tokens: FABLE_5_2.cacheRead,
      input_cache_creation: FABLE_5_2.cacheWrite5m, cache_creation_input_tokens: FABLE_5_2.cacheWrite5m,
      input_cache_creation_5m: FABLE_5_2.cacheWrite5m, input_cache_creation_1h: FABLE_5_2.cacheWrite1h,
    },
  }],
}];

// Adds each missing model definition to the project the configuration's keys belong to. Existing ones are left alone.
export async function defineModels(config) {
  const headers = { authorization: 'Basic ' + Buffer.from(config.publicKey + ':' + config.secretKey).toString('base64'), 'content-type': 'application/json' };
  const present = new Set();
  for (let page = 1, pages = 1; page <= pages; page++) {
    const response = await fetch(new URL(`/api/public/models?limit=100&page=${page}`, config.endpoint), { headers });
    if (!response.ok) throw new Error(`models ${response.status}`);
    const body = await response.json();
    for (const model of body.data) present.add(model.modelName);
    pages = body.meta?.totalPages ?? 1;
  }
  const added = [];
  for (const model of MODELS.filter((m) => !present.has(m.modelName))) {
    const response = await fetch(new URL('/api/public/models', config.endpoint), { method: 'POST', headers, body: JSON.stringify(model) });
    if (!response.ok) throw new Error(`model ${model.modelName} ${response.status}`);
    added.push(model.modelName);
  }
  return { added, present: [...present].sort() };
}
