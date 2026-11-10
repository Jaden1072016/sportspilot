// Live endpoint verification. Run on YOUR machine (or deployed host): npm run verify:live
// Calls each public endpoint ONCE (polite, no loops), runs the real response through the
// app's own normalizers, saves the raw JSON as dated fixtures, and prints a pass/fail table.
// It never sends credentials and never places orders.
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchJSON } from '../lib/http.mjs';
import { scoreboardURL, summaryURL, normalizeScoreboard, normalizeSummary } from '../lib/sports.mjs';
import { marketListURL, eventsFallbackURL, quoteURL, bookURL, normalizeEvents, normalizeBBO, normalizeBook } from '../lib/market.mjs';
import { createPredictor } from '../lib/nba/predict.mjs';
import { readFileSync } from 'node:fs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'tests/fixtures/live', new Date().toISOString().slice(0, 10));
mkdirSync(OUT, { recursive: true });
const results = [];
async function check(name, url, normalize, save = true) {
  const t0 = Date.now();
  try {
    const { data, fetchedAt } = await fetchJSON(url, { retries: 1, timeoutMs: 10000 });
    if (save) writeFileSync(resolve(OUT, `${name}.json`), JSON.stringify(data, null, 1));
    const norm = normalize(data, fetchedAt);
    results.push({ name, ok: true, ms: Date.now() - t0, note: norm.note });
    return { data, norm };
  } catch (e) {
    results.push({ name, ok: false, ms: Date.now() - t0, note: e.message });
    return null;
  }
}

const sb = await check('espn-nba-scoreboard', scoreboardURL('nba'), (d, f) => { const n = normalizeScoreboard(d, 'nba', f); return { ...n, note: `${n.games.length} games; states ${[...new Set(n.games.map(g => g.status))].join('/')}; possession field ${n.games.some(g => g.possession) ? 'present' : 'absent'}` }; });
const first = sb?.norm.games.find(g => g.status === 'in') || sb?.norm.games[0];
if (first) await check('espn-nba-summary', summaryURL('nba', first.id), (d, f) => { const n = normalizeSummary(d, 'nba', first.id, f); return { note: `${n.players.length} player rows; injuries block ${n.injuries === null ? 'ABSENT' : `${n.injuries.length} entries`}` }; });
const yday = new Date(Date.now() - 86400000).toISOString().slice(0, 10).replaceAll('-', '');
await check('espn-nba-scoreboard-yesterday', scoreboardURL('nba', yday), (d, f) => ({ note: `${normalizeScoreboard(d, 'nba', f).games.length} games on ${yday}` }));
let ev = await check('polymarket-v2-league-events', marketListURL('nba'), (d, f) => { const n = normalizeEvents(d, 'nba', f); return { ...n, note: `${n.events.length} events, ${n.events.reduce((s, e) => s + e.markets.length, 0)} markets` }; });
if (!ev) ev = await check('polymarket-v1-events-fallback', eventsFallbackURL('nba'), (d, f) => { const n = normalizeEvents(d, 'nba', f, 'v1/events'); return { ...n, note: `${n.events.length} events` }; });
const market = ev?.norm.events.flatMap(e => e.markets)[0];
if (market) {
  await check('polymarket-bbo', quoteURL(market.slug), (d, f) => { const n = normalizeBBO(d, market.slug, f); return { note: `${market.slug}: ask ${n.bestAsk} bid ${n.bestBid}; timestamp ${n.quoteTime ? 'present' : 'ABSENT (expected per SDK)'}` }; });
  await check('polymarket-book', bookURL(market.slug), (d, f) => { const n = normalizeBook(d, market.slug, f); return { note: `${n.state}; ${n.bids.length} bid / ${n.offers.length} offer levels; transactTime ${n.quoteTime || 'ABSENT'}` }; });
  const keys = Object.keys(ev.data?.events?.[0] || {}).join(','); results.push({ name: 'polymarket-event-keys', ok: true, ms: 0, note: keys.slice(0, 200) });
  const mk = Object.keys((ev.data?.events?.[0]?.markets || [])[0] || {}).join(','); results.push({ name: 'polymarket-market-keys', ok: true, ms: 0, note: mk.slice(0, 300) });
}
if (sb?.norm.games.length) {
  const pm = JSON.parse(readFileSync(resolve(ROOT, 'models/nba-pregame.json'))), lm = JSON.parse(readFileSync(resolve(ROOT, 'models/nba-live.json')));
  const p = createPredictor(pm, lm);
  for (const g of sb.norm.games.slice(0, 15)) {
    const r = p.predict(g);
    const pre = r.pregame.available ? `pregame home ${(r.pregame.homeProbability * 100).toFixed(1)}%` : `pregame blocked: ${r.pregame.blockers[0]}`;
    const live = r.live.available ? `live home ${(r.live.homeProbability * 100).toFixed(1)}%` : `live: ${r.live.why}`;
    results.push({ name: `model ${g.away.abbr}@${g.home.abbr}`, ok: true, ms: 0, note: `${g.statusText} | ${pre} | ${live}` });
  }
}
console.table(results.map(r => ({ check: r.name, result: r.ok ? 'PASS' : 'FAIL', ms: r.ms, detail: r.note })));
writeFileSync(resolve(OUT, 'verify-report.json'), JSON.stringify({ ranAt: new Date().toISOString(), results }, null, 2));
console.log(`\nRaw responses saved to ${OUT}. Share verify-report.json (and failing raw files) with Claude to fix any schema gaps.`);
process.exitCode = results.some(r => !r.ok) ? 1 : 0;
