// Thread questions answered from the project's observations (GET /api/public/v2/observations).
// Replays can repeat rows for a while, so each observation counts once by ID. A null cost means a request has no price.

const unique = (rows) => [...new Map(rows.map((row) => [row.id, row])).values()];
const isRequest = (row) => row.type === 'GENERATION';

function addCost(total, row) {
  total.requests++;
  if (row.totalCost == null) total.unpriced = (total.unpriced ?? 0) + 1;
  else total.priced += row.totalCost;
  return total;
}

const settle = ({ priced, ...total }) => ({ ...total, cost: total.unpriced ? null : priced });

export function costPerThread(rows) {
  const threads = {};
  for (const row of unique(rows).filter(isRequest)) addCost(threads[row.sessionId] ??= { requests: 0, priced: 0 }, row);
  return Object.fromEntries(Object.entries(threads).map(([thread, total]) => [thread, settle(total)]));
}

// A thread's tree root: follow the thread that launched or delegated it, then its lineage parent, to the top.
function roots(rows) {
  const up = new Map();
  for (const row of unique(rows)) {
    const parent = row.metadata?.launcher ?? row.metadata?.lineageParent;
    if (parent && parent !== row.sessionId) up.set(row.sessionId, parent);
  }
  const rootOf = (thread, seen = new Set()) => up.has(thread) && !seen.has(thread) ? rootOf(up.get(thread), seen.add(thread)) : thread;
  return rootOf;
}

export function costPerTree(rows) {
  const rootOf = roots(rows);
  const trees = {};
  for (const row of unique(rows).filter(isRequest)) {
    const tree = trees[rootOf(row.sessionId)] ??= { threads: new Set(), requests: 0, priced: 0 };
    tree.threads.add(row.sessionId);
    addCost(tree, row);
  }
  return Object.fromEntries(Object.entries(trees).map(([root, { threads, ...total }]) => [root, { threads: [...threads].sort(), ...settle(total) }]));
}

export function compactionsPerThread(rows) {
  const threads = {};
  for (const row of unique(rows)) {
    const kind = row.metadata?.kind;
    if (!['compaction', 'handoff'].includes(kind)) continue;
    const thread = threads[row.sessionId] ??= { compactions: 0, auto: 0, manual: 0, tokensBefore: 0, tokensAfter: 0, handoffs: 0 };
    if (kind === 'handoff') { thread.handoffs++; continue; }
    thread.compactions++;
    if (row.metadata.trigger === 'auto') thread.auto++;
    if (row.metadata.trigger === 'manual') thread.manual++;
    thread.tokensBefore += Number(row.metadata.preTokens ?? 0);
    thread.tokensAfter += Number(row.metadata.postTokens ?? 0);
  }
  return threads;
}

// Every observation in a time range, page by page.
export async function observations(config, { from, to }) {
  const auth = 'Basic ' + Buffer.from(config.publicKey + ':' + config.secretKey).toString('base64');
  const rows = [];
  let cursor;
  do {
    const url = new URL('/api/public/v2/observations', config.endpoint);
    url.search = new URLSearchParams({ limit: '1000', fields: 'core,basic,usage,model,metadata', fromStartTime: from, toStartTime: to, ...(cursor ? { cursor } : {}) });
    const response = await fetch(url, { headers: { authorization: auth } });
    if (!response.ok) throw new Error(`observations ${response.status}`);
    const page = await response.json();
    rows.push(...page.data);
    cursor = page.data.length ? page.meta?.cursor : null;
  } while (cursor);
  return rows;
}
