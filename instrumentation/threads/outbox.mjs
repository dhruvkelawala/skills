// Batched delivery: many spans per atomic, fsynced batch file and per OTLP post, with the pilot's retry rules.
import { readdir, readFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { digest } from '../contract.mjs';
import { durable, locked } from '../delivery.mjs';
import { otlp } from './contract.mjs';

export const DEFAULTS = { batchSpans: 500, maxBatches: 2000, maxAttempts: 8, retryMs: 1000, timeoutMs: 15000 };
const BATCH = /^batch-\d{13}-[a-f0-9]{16}\.json$/;

export class Outbox {
  constructor(config) {
    this.c = { ...DEFAULTS, ...config };
    this.buffer = new Map();
  }

  // Spans wait in memory until a batch fills; `seal` writes the rest. A later span with the same ID replaces the earlier one.
  async add(span) {
    this.buffer.set(span.spanId, span);
    if (this.buffer.size >= this.c.batchSpans) await this.seal();
  }

  async seal() {
    if (!this.buffer.size) return;
    const spans = [...this.buffer.values()];
    this.buffer.clear();
    const name = `batch-${String(Date.now()).padStart(13, '0')}-${digest(JSON.stringify(spans.map((span) => span.spanId))).slice(0, 16)}.json`;
    await durable(join(this.c.directory, name), { spans, attempts: 0, next: 0, exhausted: false });
  }

  async batches() {
    return (await readdir(this.c.directory)).filter((name) => BATCH.test(name)).sort();
  }

  async full() {
    return (await this.batches()).length >= this.c.maxBatches;
  }

  // Posts due batches until the deadline. A batch leaves the outbox only when the backend accepts every span.
  async deliver(deadline = Date.now() + this.c.timeoutMs) {
    const c = this.c;
    const endpoint = new URL('/api/public/otel/v1/traces', c.endpoint);
    if (endpoint.protocol !== 'https:' && !(endpoint.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(endpoint.hostname))) return 0;
    if (!c.publicKey || !c.secretKey) return 0;
    let delivered = 0;
    for (const name of await this.batches()) {
      if (Date.now() >= deadline) break;
      const path = join(c.directory, name);
      const batch = JSON.parse(await readFile(path, 'utf8'));
      if (batch.exhausted || batch.next > Date.now()) continue;
      let ok = false;
      try {
        const response = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Basic ' + Buffer.from(c.publicKey + ':' + c.secretKey).toString('base64') }, body: JSON.stringify(otlp(batch.spans)), redirect: 'error', signal: AbortSignal.timeout(Math.max(1, Math.min(c.timeoutMs, deadline - Date.now()))) });
        const receipt = await response.json().catch(() => ({}));
        ok = response.ok && !(Number(receipt.partialSuccess?.rejectedSpans) > 0) && !receipt.error;
      } catch {}
      if (ok) { await unlink(path); delivered += batch.spans.length; continue; }
      const attempts = batch.attempts + 1;
      await durable(path, { ...batch, attempts, next: Date.now() + Math.min(60000, c.retryMs * 2 ** attempts), exhausted: attempts >= c.maxAttempts });
    }
    return delivered;
  }

  async counts() {
    let pending = 0, exhausted = 0;
    for (const name of await this.batches()) {
      const batch = JSON.parse(await readFile(join(this.c.directory, name), 'utf8'));
      if (batch.exhausted) exhausted++; else pending++;
    }
    return { pending, exhausted };
  }
}

// The pilot's lock fills in the pilot's own defaults, so each outbox is built from the caller's configuration.
export const flush = (config) => locked(config, async () => {
  const outbox = new Outbox(config);
  const delivered = await outbox.deliver(Date.now() + 60000);
  return { status: 'flushed', delivered, ...(await outbox.counts()) };
});

export const status = (config) => locked(config, async () => ({ status: 'available', ...(await new Outbox(config).counts()) }));
