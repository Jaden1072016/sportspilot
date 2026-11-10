import { isoNow } from './utils.mjs';

// Upstream fetch with: timeout, bounded retries + exponential backoff on 429/5xx/network,
// Retry-After respect, short in-memory TTL cache (per server instance), per-host circuit
// breaker, and a concurrency cap. Errors are never converted into fabricated data.

const cache = new Map();          // url -> { data, fetchedAt, expires }
const breakers = new Map();       // host -> { failures, openUntil }
let inFlight = 0;
const MAX_CONCURRENT = 6;
const waiters = [];

async function slot() {
  if (inFlight < MAX_CONCURRENT) { inFlight++; return; }
  await new Promise(r => waiters.push(r));
  inFlight++;
}
function release() { inFlight--; const w = waiters.shift(); if (w) w(); }
const sleep = ms => new Promise(r => setTimeout(r, ms));

export class UpstreamError extends Error {
  constructor(message, { status = null, retryable = false } = {}) { super(message); this.status = status; this.retryable = retryable; }
}

export function _resetHttpState() { cache.clear(); breakers.clear(); }

export async function fetchJSON(url, { timeoutMs = 6500, ttlMs = 0, retries = 2, fetchImpl = globalThis.fetch, now = Date.now } = {}) {
  const t = now();
  const hit = cache.get(url);
  if (ttlMs > 0 && hit && hit.expires > t) return { data: hit.data, fetchedAt: hit.fetchedAt, cached: true };
  const host = new URL(url).host;
  const br = breakers.get(host);
  if (br && br.openUntil > t) throw new UpstreamError(`Upstream ${host} temporarily paused after repeated failures (circuit open)`, { retryable: true });
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    await slot();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetchImpl(url, { signal: controller.signal, headers: { Accept: 'application/json', 'User-Agent': 'SportsPilotResearch/0.2 (+read-only)' } });
      if (!res.ok) {
        const retryable = res.status === 429 || res.status >= 500;
        const ra = Number(res.headers?.get?.('retry-after'));
        lastErr = new UpstreamError(`Upstream HTTP ${res.status}`, { status: res.status, retryable });
        if (!retryable || attempt === retries) throw lastErr;
        await sleep(Number.isFinite(ra) && ra > 0 ? Math.min(ra * 1000, 4000) : 250 * 2 ** attempt);
        continue;
      }
      const type = res.headers?.get?.('content-type') || '';
      if (!type.includes('json')) throw new UpstreamError('Upstream returned non-JSON content');
      const data = await res.json();
      const fetchedAt = isoNow();
      if (ttlMs > 0) cache.set(url, { data, fetchedAt, expires: now() + ttlMs });
      breakers.delete(host);
      return { data, fetchedAt, cached: false };
    } catch (e) {
      lastErr = e instanceof UpstreamError ? e : new UpstreamError(e?.name === 'AbortError' ? 'Upstream timeout' : `Upstream network error: ${e?.message || e}`, { retryable: true });
      if (!lastErr.retryable || attempt === retries) break;
      await sleep(250 * 2 ** attempt);
    } finally { clearTimeout(timer); release(); }
  }
  const b = breakers.get(host) || { failures: 0, openUntil: 0 };
  b.failures++;
  if (b.failures >= 3) { b.openUntil = now() + 60_000; b.failures = 0; }
  breakers.set(host, b);
  throw lastErr;
}

export function jsonResponse(payload, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(payload), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', ...extraHeaders } });
}
export function errorResponse(err, source = 'unknown') {
  const status = err?.status === 429 ? 429 : 503;
  return jsonResponse({ ok: false, source, error: String(err?.message || 'Data source unavailable'), fetchedAt: isoNow(), liveData: false }, status);
}
