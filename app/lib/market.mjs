import { amount, safeNumber, isoNow } from './utils.mjs';
// Polymarket US public gateway (read-only, no key). Schemas follow the official
// polymarket-us SDK (v2.4.1) type definitions: Amount = {value:string,currency:'USD'},
// BBO response = {marketData:{bestBid,bestAsk,bidDepth,askDepth,lastTradePx,...}} (NO timestamp),
// Book response = {marketData:{bids:[{px,qty}],offers:[{px,qty}],state,transactTime}}.
// Market prices live here only. The independent model never imports this module.
const BASE = 'https://gateway.polymarket.us';
export const marketListURL = (league) => `${BASE}/v2/leagues/${encodeURIComponent(league)}/events`;
export const eventsFallbackURL = (league) => `${BASE}/v1/events?active=true&closed=false&limit=100&tagSlug=${encodeURIComponent(league)}`;
export const quoteURL = (slug) => `${BASE}/v1/markets/${encodeURIComponent(slug)}/bbo`;
export const bookURL = (slug) => `${BASE}/v1/markets/${encodeURIComponent(slug)}/book`;

export function flattenEvents(raw) {
  if (Array.isArray(raw)) return raw.flatMap(x => Array.isArray(x.events) ? x.events : [x]);
  if (Array.isArray(raw?.events)) return raw.events;
  if (Array.isArray(raw?.sections)) return raw.sections.flatMap(x => x.events || []);
  if (Array.isArray(raw?.data?.events)) return raw.data.events;
  if (Array.isArray(raw?.data?.sections)) return raw.data.sections.flatMap(x => x.events || []);
  throw new Error('Polymarket event response shape unrecognized');
}

export function normalizeEvents(raw, league, fetchedAt = isoNow(), endpoint = 'v2/leagues') {
  const events = flattenEvents(raw).filter(e => e && typeof e === 'object' && e.closed !== true).map(e => ({
    id: String(e.id || e.slug || ''), slug: e.slug || '', name: e.title || e.name || e.slug || '', gameId: e.gameId ?? null, live: Boolean(e.live),
    startTime: e.startTime || e.eventDate || e.startDate || null,
    markets: (Array.isArray(e.markets) ? e.markets : []).filter(m => m && m.slug && m.active !== false && m.closed !== true).map(m => ({
      id: String(m.id || m.slug), slug: m.slug, question: m.question || m.title || m.slug, outcome: m.outcome || null,
      type: m.sportsMarketTypeV2 || m.sportsMarketType || 'UNKNOWN', line: safeNumber(m.line),
      comboEnabled: m.comboEnabled === true ? true : m.comboEnabled === false ? false : null,
      feeCoefficient: safeNumber(m.feeCoefficient),
      teamProviderIds: (m.team?.providerIds || []).map(p => ({ provider: p.provider, id: String(p.providerId) })),
      teamName: m.team?.name || null,
      marketSides: (m.marketSides || []).map(s => ({ description: s.description || '', team: s.team?.name || null, identifier: s.identifier || null })),
      ask: null, askVerified: false,
    })),
  }));
  return { ok: true, source: 'Polymarket US public', endpoint, league, fetchedAt, events, liveData: true,
    warnings: ['Listings are not executable quotes. Use the order book before any value calculation.', 'Event-to-game links are not verified automatically.'] };
}

export function normalizeBBO(raw, slug, fetchedAt = isoNow()) {
  if (!raw?.marketData) throw new Error('Polymarket BBO schema mismatch');
  const m = raw.marketData;
  const ask = amount(m.bestAsk), bid = amount(m.bestBid);
  return { ok: true, source: 'Polymarket US BBO', slug, fetchedAt,
    quoteTime: m.transactTime || null, // BBO schema has no exchange timestamp; null => age unknown
    bestAsk: ask, bestBid: bid, spread: ask !== null && bid !== null ? ask - bid : null,
    valid: ask !== null && bid !== null && ask > 0 && ask < 1 && bid >= 0 && bid <= ask,
    bidDepth: safeNumber(m.bidDepth), askDepth: safeNumber(m.askDepth), lastTradePx: amount(m.lastTradePx),
    warnings: ['Top of book only, without an exchange timestamp. Not sufficient for an actionable signal; use the order book.'] };
}

const levels = arr => (Array.isArray(arr) ? arr : []).map(l => ({ px: amount(l?.px), qty: safeNumber(l?.qty) }))
  .filter(l => l.px !== null && l.qty !== null && l.px > 0 && l.px < 1 && l.qty > 0);

export function normalizeBook(raw, slug, fetchedAt = isoNow()) {
  if (!raw?.marketData || (!Array.isArray(raw.marketData.bids) && !Array.isArray(raw.marketData.offers))) throw new Error('Polymarket book schema mismatch');
  const m = raw.marketData;
  const bids = levels(m.bids).sort((a, b) => b.px - a.px);
  const offers = levels(m.offers).sort((a, b) => a.px - b.px);
  return { ok: true, source: 'Polymarket US order book', slug, fetchedAt, state: m.state || 'UNKNOWN', open: m.state === 'MARKET_STATE_OPEN',
    quoteTime: m.transactTime || null, bids, offers, bestBid: bids[0]?.px ?? null, bestAsk: offers[0]?.px ?? null,
    lastTradePx: amount(m.stats?.lastTradePx),
    warnings: ['Order book snapshot. Prices can move before you act; re-check in Polymarket before trading.'] };
}

/**
 * Size-weighted fill for spending `stakeUsd` on one side of a binary market.
 * YES buys walk the offers. NO buys are equivalent to selling YES into the bids at price 1 - bid.
 * Returns null fields when depth is insufficient (never extrapolates beyond the book).
 */
export function executableFill(book, side, stakeUsd) {
  if (!book || !(stakeUsd > 0)) return { ok: false, reason: 'Missing book or stake' };
  if (side !== 'YES' && side !== 'NO') return { ok: false, reason: 'Unknown side' };
  const ladder = side === 'YES' ? book.offers.map(l => ({ px: l.px, qty: l.qty })) : book.bids.map(l => ({ px: +(1 - l.px).toFixed(6), qty: l.qty }));
  let remaining = stakeUsd, contracts = 0, spent = 0, worst = null;
  for (const l of ladder) {
    const can = l.px * l.qty;
    const take = Math.min(remaining, can);
    contracts += take / l.px; spent += take; remaining -= take; worst = l.px;
    if (remaining <= 1e-9) break;
  }
  if (remaining > 1e-9) return { ok: false, reason: `Insufficient depth: only $${spent.toFixed(2)} fillable`, fillableUsd: spent };
  const avgPrice = spent / contracts;
  const top = ladder[0].px;
  return { ok: true, side, stakeUsd, contracts, avgPrice, topPrice: top, worstPrice: worst, slippage: avgPrice - top, grossMultiple: 1 / avgPrice };
}

export const eventURL = (slug) => `${BASE}/v1/events/slug/${encodeURIComponent(slug)}`;
const STAT_MAP = { pts: 'points', reb: 'rebounds', ast: 'assists', '3pm': 'fg3m' };
/**
 * Player props and fee coefficient for one event (live-verified shape 2026-11-10).
 * Listing prices (bestBid/bestAsk) carry no exchange timestamp: display only, never a verdict input.
 */
export function normalizeEventDetail(raw, fetchedAt = isoNow()) {
  const e = raw?.event;
  if (!e || !Array.isArray(e.markets)) throw new Error('Polymarket event schema mismatch');
  const props = [], fee = new Set();
  for (const m of e.markets) {
    if (Number.isFinite(Number(m.feeCoefficient))) fee.add(Number(m.feeCoefficient));
    if ((m.sportsMarketTypeV2 || '') !== 'SPORTS_MARKET_TYPE_PROP' || m.closed || m.active === false) continue;
    const md = m.metadata || {};
    const stat = STAT_MAP[String(md.statLabel || '').toLowerCase()] || null;
    const line = safeNumber(m.line);
    if (!md.playerName || line === null) continue;
    props.push({ slug: m.slug, player: md.playerName, team: m.marketSides?.[0]?.team?.name || null, stat, statLabel: md.statLabel || null, line,
      bid: amount(m.bestBidQuote), ask: amount(m.bestAskQuote), comboEnabled: m.comboEnabled === true, title: m.titleShort || m.title || m.question });
  }
  const coefs = [...fee];
  return { ok: true, source: 'Polymarket US public', slug: e.slug, fetchedAt, gameStartTime: e.startTime || null, feeCoefficient: coefs.length === 1 ? coefs[0] : coefs.length ? Math.max(...coefs) : null,
    props, warnings: ['Listing prices may lag the order book and have no timestamp. Check the live order book before acting.'] };
}

/** Estimated taker fee as a fraction of stake: coef x contracts x p(1-p) / stake = coef x (1 - p). Unverified estimate. */
export const feeFractionOfStake = (coef, avgPrice) => (Number.isFinite(coef) && avgPrice > 0 && avgPrice < 1 ? coef * (1 - avgPrice) : null);
