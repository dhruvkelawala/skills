import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { defineModels } from '../threads/models.mjs';

test('the Fable 5.2 price is added once to the thread project, at list price per token', async () => {
  const models = [{ modelName: 'claude-opus-5-5' }];
  const posts = [];
  const server = createServer(async (req, res) => {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    if (req.method === 'POST') { posts.push(JSON.parse(raw)); models.push(JSON.parse(raw)); }
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(req.method === 'GET' ? { data: models, meta: { totalPages: 1 } } : {}));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const config = { endpoint: `http://127.0.0.1:${server.address().port}`, publicKey: 'test', secretKey: 'test' };
  try {
    assert.deepEqual(await defineModels(config), { added: ['claude-fable-5-2'], present: ['claude-opus-5-5'] });
    const [fable] = posts;
    assert.match('claude-fable-5-2', new RegExp(fable.matchPattern.replace('(?i)', '')));
    assert.doesNotMatch('claude-fable-5-1', new RegExp(fable.matchPattern.replace('(?i)', '')));
    const prices = fable.pricingTiers[0].prices;
    assert.equal(prices.input, 8e-6);
    assert.equal(prices.output, 40e-6);
    assert.equal(prices.input_cache_read, 0.2e-6);
    assert.equal(prices.input_cache_creation_5m, 10e-6);
    assert.equal(prices.input_cache_creation_1h, 16e-6);
    assert.deepEqual(await defineModels(config), { added: [], present: ['claude-fable-5-2', 'claude-opus-5-5'] });
  } finally { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); }
});
