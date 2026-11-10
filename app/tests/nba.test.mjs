import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { clockToSeconds, normalizeScoreboard, parseInjuries } from '../lib/sports.mjs';
import { normalizeBook, executableFill, normalizeEvents } from '../lib/market.mjs';
import { evaluateOpportunity, jointFromSimulations } from '../lib/value.mjs';
import { createRatingState, preGame, postGame, snapshotRatings, restoreRatings } from '../lib/nba/ratings.mjs';
import { simulateLive, analyticLive, calibrateLive, timeState } from '../lib/nba/live.mjs';
import { createPredictor, liveStateFromGame } from '../lib/nba/predict.mjs';
import { fitLogistic, predictLogistic, reliability, brier, logLoss, rng } from '../lib/stats.mjs';
import { fetchJSON, _resetHttpState } from '../lib/http.mjs';

const pregameModel = JSON.parse(readFileSync(new URL('../models/nba-pregame.json', import.meta.url)));
const liveModel = JSON.parse(readFileSync(new URL('../models/nba-live.json', import.meta.url)));
const NOW = Date.parse('2026-11-09T23:00:00Z');

// ---------- data adapters ----------
test('ESPN clock formats, including final-minute "SS.s"', () => {
  assert.equal(clockToSeconds('5:23'), 323);
  assert.equal(clockToSeconds('12:00'), 720);
  assert.equal(clockToSeconds('34.5'), 34.5);
  assert.equal(clockToSeconds('0.0'), 0);
  assert.equal(clockToSeconds('12:60'), null);
  assert.equal(clockToSeconds('75'), null);
  assert.equal(clockToSeconds(null), null);
});

const sb = { events: [
  { id: '401800001', name: 'Away at Home', date: '2026-11-10T00:30Z', status: { period: 4, displayClock: '41.7', type: { state: 'in', name: 'STATUS_IN_PROGRESS', shortDetail: '41.7 - 4th' } },
    competitions: [{ situation: { possession: '2' }, competitors: [
      { homeAway: 'home', score: '101', team: { id: '2', abbreviation: 'BOS', displayName: 'Boston' }, records: [{ type: 'total', summary: '6-3' }] },
      { homeAway: 'away', score: '99', team: { id: '18', abbreviation: 'NY', displayName: 'New York' }, records: [{ type: 'total', summary: '5-4' }] }] }] },
  { id: '401800002', status: { type: { state: 'pre' } }, competitions: [{ competitors: [{ homeAway: 'home', team: {} }] }] },
] };
test('scoreboard: ids, final-minute clock, possession mapping, malformed event skipped with warning', () => {
  const r = normalizeScoreboard(sb, 'nba', '2026-11-10T01:00:00Z');
  assert.equal(r.games.length, 1);
  const g = r.games[0];
  assert.equal(g.home.id, '2'); assert.equal(g.clockSeconds, 41.7); assert.equal(g.possession, 'home');
  assert.ok(r.warnings.some(w => w.includes('401800002')));
});
test('injuries: absent block => null (unknown), never an empty "healthy" list', () => {
  assert.equal(parseInjuries({}), null);
  assert.deepEqual(parseInjuries({ injuries: [{ team: { id: '2' }, injuries: [{ athlete: { id: '9', displayName: 'X' }, status: 'Out' }] }] })[0].status, 'Out');
});

// ---------- market math ----------
const book = normalizeBook({ marketData: { state: 'MARKET_STATE_OPEN', transactTime: '2026-11-09T22:59:58Z',
  bids: [{ px: { value: '0.70', currency: 'USD' }, qty: '10' }, { px: { value: '0.68', currency: 'USD' }, qty: '100' }],
  offers: [{ px: { value: '0.30', currency: 'USD' }, qty: '10' }, { px: { value: '0.33', currency: 'USD' }, qty: '100' }] } }, 'm', '2026-11-09T23:00:00Z');
test('order book: 30c headline ask but $5 fills at a worse size-weighted price', () => {
  const f = executableFill(book, 'YES', 5);
  assert.ok(f.ok);
  // $3 buys 10 contracts at 0.30, remaining $2 buys 6.0606 at 0.33 => avg 5/16.0606
  assert.ok(Math.abs(f.avgPrice - 5 / (10 + 2 / 0.33)) < 1e-9);
  assert.ok(f.avgPrice > 0.30 && f.grossMultiple < 1 / 0.30);
});
test('order book: NO side priced from bids as 1 - bid', () => {
  const f = executableFill(book, 'NO', 2);
  assert.ok(f.ok); assert.ok(Math.abs(f.topPrice - 0.30) < 1e-9);
});
test('order book: insufficient depth fails closed, never extrapolates', () => {
  const f = executableFill(book, 'YES', 1000);
  assert.equal(f.ok, false); assert.match(f.reason, /Insufficient depth/);
});
test('book schema mismatch throws', () => { assert.throws(() => normalizeBook({ marketData: {} }, 'x')); });
test('events: comboEnabled only true when explicitly true', () => {
  const e = normalizeEvents({ events: [{ id: 1, markets: [{ slug: 'a' }, { slug: 'b', comboEnabled: true }] }] }, 'nba');
  assert.equal(e.events[0].markets[0].comboEnabled, null); assert.equal(e.events[0].markets[1].comboEnabled, true);
});

// ---------- value gate ----------
const goodChecks = { modelStatus: 'validated', linkVerified: true, inputsComplete: true, gameStateAgeSec: 5 };
const fee = { fraction: 0.01, verified: true };
test('opportunity gate: passes only when every requirement holds', () => {
  const fill = executableFill(book, 'YES', 3); // all at 0.30 => 3.33x
  const r = evaluateOpportunity({ p: 0.42, pLow: 0.38, fill, book, fee, checks: goodChecks, nowMs: NOW });
  assert.equal(r.actionable, true, r.blockers.join('; '));
});
test('opportunity gate: research-status model, unverified fee, stale quote, wide uncertainty each block', () => {
  const fill = executableFill(book, 'YES', 3);
  const base = { p: 0.42, pLow: 0.38, fill, book, fee, checks: goodChecks, nowMs: NOW };
  assert.ok(evaluateOpportunity({ ...base, checks: { ...goodChecks, modelStatus: 'research' } }).blockers.some(b => b.includes('RESEARCH')));
  assert.ok(evaluateOpportunity({ ...base, fee: { fraction: 0.01, verified: false } }).blockers.some(b => b.includes('not verified')));
  assert.ok(evaluateOpportunity({ ...base, nowMs: NOW + 60_000 }).blockers.some(b => b.includes('old')));
  assert.ok(evaluateOpportunity({ ...base, pLow: 0.25 }).blockers.some(b => b.includes('uncertainty')));
  assert.ok(evaluateOpportunity({ ...base, book: { ...book, quoteTime: null } }).blockers.some(b => b.includes('timestamp')));
  assert.ok(evaluateOpportunity({ ...base, book: { ...book, open: false, state: 'MARKET_STATE_HALTED' } }).blockers.some(b => b.includes('HALTED')));
});
test('parlay: two perfectly correlated 80% legs have joint 80%, not 64%', () => {
  const r = rng(5); const outcomes = Array.from({ length: 20000 }, () => r());
  const j = jointFromSimulations(outcomes, [u => u < 0.8, u => u < 0.8]);
  assert.ok(Math.abs(j.joint - 0.8) < 0.01); assert.ok(Math.abs(j.naiveProduct - 0.64) < 0.02);
});

// ---------- ratings ----------
test('ratings are as-of: a game cannot see its own result', () => {
  const s = createRatingState();
  const g = { season: 2026, homeId: 1, awayId: 2, date: '2026-01-01', homeScore: 130, awayScore: 90 };
  const before = preGame(s, g).ratingMargin;
  postGame(s, g);
  const after = preGame(s, { ...g, date: '2026-01-03' }).ratingMargin;
  assert.ok(after > before);
  const round = restoreRatings(snapshotRatings(s));
  assert.equal(preGame(round, { ...g, date: '2026-01-03' }).ratingMargin, after);
});

// ---------- live engines ----------
const prior = { expMargin48: 2, pace: 99, expTotal48: 226 };
test('live simulation is reproducible for a fixed seed', () => {
  const st = { homeScore: 80, awayScore: 78, period: 4, clockSeconds: 300 };
  assert.equal(simulateLive(st, prior, liveModel.params, { sims: 800, seed: 9 }).homeProbability, simulateLive(st, prior, liveModel.params, { sims: 800, seed: 9 }).homeProbability);
});
test('live probability rises with the lead and with time running out for the leader', () => {
  const p = (h, a, per, c) => analyticLive({ homeScore: h, awayScore: a, period: per, clockSeconds: c }, prior, liveModel.params).homeProbability;
  assert.ok(p(90, 80, 4, 300) > p(85, 80, 4, 300));
  assert.ok(p(90, 80, 4, 60) > p(90, 80, 3, 300));
  const mc = simulateLive({ homeScore: 90, awayScore: 80, period: 4, clockSeconds: 60 }, prior, liveModel.params, { sims: 2000, seed: 1 }).homeProbability;
  assert.ok(mc > 0.97);
});
test('end of regulation: leader certain, tie goes to overtime near 50/50', () => {
  const lead = simulateLive({ homeScore: 100, awayScore: 99, period: 4, clockSeconds: 0 }, prior, liveModel.params, { sims: 500, seed: 2 });
  assert.equal(lead.homeProbability, 1);
  const tie = simulateLive({ homeScore: 100, awayScore: 100, period: 4, clockSeconds: 0 }, { ...prior, expMargin48: 0 }, liveModel.params, { sims: 4000, seed: 3 });
  assert.equal(tie.overtimeProbability, 1); assert.ok(Math.abs(tie.homeProbability - 0.5) < 0.04);
});
test('an eight-point deficit early in Q3 is not treated as hopeless', () => {
  const r = simulateLive({ homeScore: 60, awayScore: 68, period: 3, clockSeconds: 600 }, { expMargin48: 4, pace: 99, expTotal48: 226 }, liveModel.params, { sims: 4000, seed: 4 });
  assert.ok(r.homeProbability > 0.2 && r.homeProbability < 0.5, String(r.homeProbability));
});
test('calibration layer is monotonic', () => {
  const c = liveModel.mcCalibration;
  assert.ok(calibrateLive(0.3, 600, c) < calibrateLive(0.6, 600, c));
});
test('timeState handles overtime and invalid input', () => {
  assert.equal(timeState({ period: 5, clockSeconds: 120 }).overtime, true);
  assert.equal(timeState({ period: 0, clockSeconds: 10 }), null);
});

// ---------- predictor ----------
const predictor = createPredictor(pregameModel, liveModel);
const realTeams = pregameModel.ratings.teams.filter(t => t.id >= 1 && t.id <= 30).slice(0, 2);
const mkGame = (over = {}) => ({ id: '1', league: 'nba', status: 'in', statusName: 'STATUS_IN_PROGRESS', period: 3, clockSeconds: 400, startTime: `${pregameModel.ratings.asOfDate}T23:00:00Z`,
  home: { id: String(realTeams[0].id), abbr: realTeams[0].abbr, score: 70 }, away: { id: String(realTeams[1].id), abbr: realTeams[1].abbr, score: 66 }, ...over });
test('predictor: real teams produce pregame and live probabilities with evidence', () => {
  const r = predictor.predict(mkGame());
  assert.ok(r.pregame.available, r.pregame.blockers.join());
  assert.ok(r.live.available, r.live.why);
  assert.ok(r.live.band.low <= r.live.homeProbability && r.live.homeProbability <= r.live.band.high);
  assert.ok(r.live.evidence.length >= 4);
});
test('predictor: unknown team id blocks instead of guessing', () => {
  const r = predictor.predict(mkGame({ home: { id: '999', abbr: 'XXX', score: 1 } }));
  assert.equal(r.pregame.available, false); assert.equal(r.live.available, false);
});
test('predictor: stale ratings block pregame output', () => {
  const r = predictor.predict(mkGame({ startTime: '2027-03-01T23:00:00Z' }));
  assert.ok(r.pregame.blockers.some(b => b.includes('days old')));
});
test('ESPN halftime and end-of-period states map to the next period start', () => {
  assert.deepEqual(liveStateFromGame(mkGame({ statusName: 'STATUS_HALFTIME', period: 2, clockSeconds: 0 })).period, 3);
  assert.equal(liveStateFromGame(mkGame({ statusName: 'STATUS_END_PERIOD', period: 4, clockSeconds: 0 })).final, true);
  assert.equal(liveStateFromGame(mkGame({ statusName: 'STATUS_END_PERIOD', period: 4, clockSeconds: 0, away: { ...mkGame().away, score: 70 } })).period, 5);
});

// ---------- independence from market data ----------
test('model code never imports market modules', () => {
  const dir = new URL('../lib/nba/', import.meta.url);
  const files = readdirSync(dir).map(f => readFileSync(new URL(f, dir), 'utf8'));
  files.push(readFileSync(new URL('../lib/model.mjs', import.meta.url), 'utf8'), readFileSync(new URL('../lib/stats.mjs', import.meta.url), 'utf8'));
  for (const src of files) assert.ok(!/from ['"][^'"]*(market|value)\.mjs['"]/.test(src));
});
test('model artifacts declare no market inputs and carry validation results', () => {
  assert.equal(pregameModel.marketInputs, 'NONE'); assert.equal(liveModel.marketInputs, 'NONE');
  const feats = [...pregameModel.base.features, ...(pregameModel.lineup?.features || [])].join(' ');
  assert.ok(!/price|odds|spread|market|ask|bid/i.test(feats));
  assert.ok(pregameModel.validation.n > 5000); assert.ok(liveModel.validation.testStates > 1000);
});

// ---------- stats ----------
test('logistic regression recovers a known slope', () => {
  const r = rng(11), X = [], y = [];
  for (let i = 0; i < 4000; i++) { const x = r.normal(); X.push([x]); y.push(r() < 1 / (1 + Math.exp(-(0.5 + 1.5 * x))) ? 1 : 0); }
  const b = fitLogistic(X, y);
  assert.ok(Math.abs(b[1] - 1.5) < 0.2 && Math.abs(b[0] - 0.5) < 0.15);
  assert.ok(predictLogistic(b, [2]) > 0.9);
});
test('scoring rules and reliability bins', () => {
  assert.equal(brier([1, 0], [1, 0]), 0);
  assert.ok(logLoss([0.5], [1]) > 0.69 && logLoss([0.5], [1]) < 0.7);
  assert.equal(reliability([0.05, 0.95], [0, 1]).filter(b => b.n).length, 2);
});

// ---------- http resilience ----------
const jsonRes = (status, body, headers = { 'content-type': 'application/json' }) => ({ ok: status < 400, status, headers: { get: k => headers[k.toLowerCase()] ?? null }, json: async () => body });
test('http: retries 429 then succeeds; caches within TTL', async () => {
  _resetHttpState(); let calls = 0;
  const f = async () => (++calls === 1 ? jsonRes(429, {}, { 'retry-after': '0' }) : jsonRes(200, { ok: 1 }));
  const a = await fetchJSON('https://example.test/a', { fetchImpl: f, ttlMs: 5000 });
  assert.equal(a.data.ok, 1); assert.equal(calls, 2);
  const b = await fetchJSON('https://example.test/a', { fetchImpl: f, ttlMs: 5000 });
  assert.equal(b.cached, true); assert.equal(calls, 2);
});
test('http: non-JSON and 404 fail closed without retries on 4xx', async () => {
  _resetHttpState(); let calls = 0;
  await assert.rejects(fetchJSON('https://example.test/b', { fetchImpl: async () => { calls++; return jsonRes(404, {}); } }), /404/);
  assert.equal(calls, 1);
  await assert.rejects(fetchJSON('https://example.test/c', { fetchImpl: async () => jsonRes(200, {}, { 'content-type': 'text/html' }) }), /non-JSON/);
});

test('predictor: catch-up applies only completed games before the cutoff date, once', () => {
  const p2 = createPredictor(pregameModel, liveModel);
  const asOf = p2.ratingsAsOf;
  const next = new Date(Date.parse(asOf) + 86400000 * 1.5).toISOString();
  const fin = { ...mkGame(), id: 'x1', status: 'post', completed: true, startTime: next, home: { ...mkGame().home, score: 120 }, away: { ...mkGame().away, score: 90 } };
  const cutoff = new Date(Date.parse(asOf) + 86400000 * 3).toISOString().slice(0, 10);
  assert.equal(p2.applyResults([fin], asOf), 0, 'same-day cutoff blocks');
  assert.equal(p2.applyResults([fin], cutoff), 1);
  assert.equal(p2.applyResults([fin], cutoff), 0, 'not applied twice');
  assert.ok(p2.ratingsAsOf > asOf);
});

import { nbAtLeast, projectPlayer, sizeFor } from '../lib/nba/props.mjs';
test('props: negative binomial tail is sane and monotonic', () => {
  assert.equal(nbAtLeast(0, 8, 5), 1);
  const a = nbAtLeast(6, 8, 5), b = nbAtLeast(8, 8, 5), c = nbAtLeast(12, 8, 5);
  assert.ok(a > b && b > c && c > 0);
  // 8 expected rebounds does not make 6+ near-certain
  assert.ok(a < 0.8, String(a));
});
test('props artifact: no market inputs, validated, players have rates', () => {
  const pm = JSON.parse(readFileSync(new URL('../models/nba-props.json', import.meta.url)));
  assert.equal(pm.marketInputs, 'NONE');
  for (const s of ['points', 'rebounds', 'assists', 'fg3m']) assert.ok(pm.validation.summary[s].sportspilot.brier < pm.validation.summary[s].last10.brier);
  assert.ok(pm.players.length > 200);
  const card = projectPlayer(pm.players[0], {}, pm.dispersion);
  assert.ok(card.stats.points.ladder.every((x, i, arr) => i === 0 || x.p <= arr[i - 1].p));
  assert.ok(sizeFor(pm.dispersion.points, 20) > 0);
});
