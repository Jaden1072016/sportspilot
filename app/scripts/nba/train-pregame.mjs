// Walk-forward training + validation of the independent NBA pregame model.
// Usage: node scripts/nba/train-pregame.mjs
// Writes: models/nba-pregame.json (deployable artifact), ../data/derived/pregame_preds.csv,
//         ../docs/reports/nba-pregame-validation.md
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadGames, loadPlayersByGame, loadMarketBaseline, loadManifest, PROJECT_ROOT } from './data.mjs';
import { createRatingState, preGame, postGame, snapshotRatings, DEFAULT_RATING_PARAMS } from '../../lib/nba/ratings.mjs';
import { createAvailabilityState, missingValue, updateAvailability, rotation } from '../../lib/nba/availability.mjs';
import { pregameFeatures, PREGAME_FEATURES, AVAIL_FEATURE, ROSTER_FEATURE, invNorm } from '../../lib/nba/pregame.mjs';
import { fitLogistic, predictLogistic, brier, logLoss, accuracy, ece, reliability, bootstrapDiff, normCdf, sd } from '../../lib/stats.mjs';

const MODEL_VERSION = 'NBA-PREGAME-v1.0';
const FIRST_TRAIN_SEASON = 2010;   // 2008-09 used as rating warm-up only
const FIRST_LINEUP_SEASON = 2017;  // player data starts 2016; 2016 is availability warm-up
const TEST_SEASONS = [2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026, 2027];

const games = loadGames();
const playersByGame = loadPlayersByGame();
const market = loadMarketBaseline();
const manifest = loadManifest();
console.log(`games ${games.length}, player-games ${playersByGame.size}, last ${games.at(-1).date}`);

// ---------- 1. Tune rating hyperparameters on early seasons only (2010-2016) ----------
function runRatings(params, collect) {
  const st = createRatingState(params);
  const rows = [];
  for (const g of games) {
    const pre = preGame(st, g);
    if (collect) rows.push({ g, pre });
    postGame(st, g, pre);
  }
  return { st, rows };
}
function tuneScore(params) {
  const { rows } = runRatings(params, true);
  let se = 0, n = 0;
  for (const { g, pre } of rows) if (g.season >= FIRST_TRAIN_SEASON && g.season <= 2016) { se += (g.homeScore - g.awayScore - pre.ratingMargin) ** 2; n++; }
  return Math.sqrt(se / n);
}
let best = { ...DEFAULT_RATING_PARAMS }, bestScore = tuneScore(best);
for (const k of [0.025, 0.03, 0.035, 0.04, 0.05, 0.06]) for (const carry of [0.55, 0.65, 0.75]) for (const cap of [16, 20, 24]) {
  const p = { ...DEFAULT_RATING_PARAMS, k, carry, cap };
  const s = tuneScore(p);
  if (s < bestScore) { bestScore = s; best = p; }
}
console.log('rating params', best, 'margin RMSE 2010-16', bestScore.toFixed(3));

// ---------- 2. Sequential as-of feature generation ----------
const st = createRatingState(best);
const av = createAvailabilityState();
const recs = new Map(); // team -> {w,l} season record as-of (legacy-baseline)
const rows = [];
for (const g of games) {
  const pre = preGame(st, g);
  const box = playersByGame.get(g.gameId);
  let availH = null, availA = null;
  if (box && g.season >= 2016) {
    // Lineup-confirmed scenario: who actually played. Live use requires a verified inactive list.
    const playedH = new Set(box.filter(r => r.teamId === g.homeId && !r.didNotPlay && r.minutes > 0).map(r => r.athleteId));
    const playedA = new Set(box.filter(r => r.teamId === g.awayId && !r.didNotPlay && r.minutes > 0).map(r => r.athleteId));
    availH = missingValue(av, g.homeId, playedH); availA = missingValue(av, g.awayId, playedA);
  }
  const key = id => `${g.season}:${id}`;
  const rh = recs.get(key(g.homeId)) || { w: 0, l: 0 }, ra = recs.get(key(g.awayId)) || { w: 0, l: 0 };
  const feats = pregameFeatures(pre, availH, availA);
  rows.push({ g, pre, feats, y: g.homeScore > g.awayScore ? 1 : 0,
    recordDiff: (rh.w + 1) / (rh.w + rh.l + 2) - (ra.w + 1) / (ra.w + ra.l + 2), spread: market.get(g.gameId) });
  postGame(st, g, pre);
  if (box) updateAvailability(av, g.gameId, box);
  const hw = g.homeScore > g.awayScore;
  recs.set(key(g.homeId), { w: rh.w + (hw ? 1 : 0), l: rh.l + (hw ? 0 : 1) });
  recs.set(key(g.awayId), { w: ra.w + (hw ? 0 : 1), l: ra.l + (hw ? 1 : 0) });
}

// ---------- 3. Walk-forward evaluation ----------
const vec = (r, feats) => feats.map(f => r.feats.x[f]);
const LINEUP_FEATURES = process.env.NO_ROSTER ? [...PREGAME_FEATURES, AVAIL_FEATURE] : [...PREGAME_FEATURES, AVAIL_FEATURE, ROSTER_FEATURE];
function fitAll(train) {
  const base = fitLogistic(train.map(r => vec(r, PREGAME_FEATURES)), train.map(r => r.y), { l2: 1e-4 });
  const lt = train.filter(r => r.feats.availKnown && r.g.season >= FIRST_LINEUP_SEASON);
  const lineup = lt.length > 2000 ? fitLogistic(lt.map(r => vec(r, LINEUP_FEATURES)), lt.map(r => r.y), { l2: 1e-4 }) : null;
  const hw = train.reduce((s, r) => s + r.y, 0) / train.length;
  const recBeta = fitLogistic(train.map(r => [r.recordDiff]), train.map(r => r.y), { l2: 1e-4 });
  // Rating-only probit scale: sd of margin residual.
  const res = train.map(r => r.g.homeScore - r.g.awayScore - r.pre.ratingMargin);
  const ms = train.filter(r => Number.isFinite(r.spread)).map(r => r.g.homeScore - r.g.awayScore - r.spread);
  return { base, lineup, hw, recBeta, ratingSd: sd(res), marketSd: ms.length > 500 ? sd(ms) : 12 };
}
const preds = [];
for (const S of TEST_SEASONS) {
  const train = rows.filter(r => r.g.season >= FIRST_TRAIN_SEASON && r.g.season < S);
  const test = rows.filter(r => r.g.season === S);
  const m = fitAll(train);
  for (const r of test) {
    const pBase = predictLogistic(m.base, vec(r, PREGAME_FEATURES));
    const pLineup = m.lineup && r.feats.availKnown ? predictLogistic(m.lineup, vec(r, LINEUP_FEATURES)) : null;
    preds.push({ r, season: S, y: r.y, pBase, pLineup,
      pHome: m.hw, pRecord: predictLogistic(m.recBeta, [r.recordDiff]), pRating: normCdf(r.pre.ratingMargin / m.ratingSd),
      pMarket: Number.isFinite(r.spread) ? normCdf(r.spread / m.marketSd) : null });
  }
  console.log(`season ${S}: trained on ${train.length}, tested ${test.length}`);
}

// ---------- 4. Metrics ----------
function metrics(list, key) {
  const ps = list.map(x => x[key]), ys = list.map(x => x.y);
  return { n: list.length, brier: brier(ps, ys), logLoss: logLoss(ps, ys), accuracy: accuracy(ps, ys), ece: ece(ps, ys) };
}
const fmt = (v, d = 4) => (Number.isFinite(v) ? v.toFixed(d) : '—');
const all = preds;
const withMarket = preds.filter(p => p.pMarket !== null);
const withLineup = preds.filter(p => p.pLineup !== null);
const keys = [['pHome', 'Home-court only (constant)'], ['pRecord', 'Win-percentage (legacy v0.1 input)'], ['pRating', 'Margin rating only'], ['pBase', `${MODEL_VERSION} base`]];
let md = `# NBA pregame model: walk-forward validation\n\nGenerated ${new Date().toISOString()} by \`app/scripts/nba/train-pregame.mjs\`. Data snapshot built ${manifest.built_at_utc}, last game ${manifest.last_game_date}.\n\n`;
md += `**Method.** For each test season S, every model is fit only on seasons ${FIRST_TRAIN_SEASON}..S-1 and evaluated on S. Team ratings are updated game by game using results available before tip-off. The ESPN-published sportsbook spread is shown as a **comparison baseline only**; it is never a model input.\n\n`;
md += `Rating hyperparameters tuned on 2010-2016 only: k=${best.k}, carry=${best.carry}, cap=${best.cap}. Margin RMSE on tuning seasons ${bestScore.toFixed(2)} pts.\n\n`;
md += `## All test games (${TEST_SEASONS[0]}-${TEST_SEASONS.at(-1)}, n=${all.length})\n\n| Model | Brier | Log loss | Accuracy | ECE |\n|---|---|---|---|---|\n`;
for (const [k, label] of keys) { const m = metrics(all, k); md += `| ${label} | ${fmt(m.brier)} | ${fmt(m.logLoss)} | ${fmt(m.accuracy, 3)} | ${fmt(m.ece)} |\n`; }
md += `\n## Same games, where an ESPN market line exists (n=${withMarket.length})\n\n| Model | Brier | Log loss | Accuracy | ECE |\n|---|---|---|---|---|\n`;
for (const [k, label] of [...keys, ['pMarket', 'Sportsbook spread (comparison only)']]) { const m = metrics(withMarket, k); md += `| ${label} | ${fmt(m.brier)} | ${fmt(m.logLoss)} | ${fmt(m.accuracy, 3)} | ${fmt(m.ece)} |\n`; }
md += `\n## Lineup-aware variant (lineup-confirmed scenario, n=${withLineup.length})\n\nUses who actually played (from the box score) to measure missing rotation value. This is what the model can do **only when a verified inactive list is available before tip**. Late scratches make the live version weaker than this.\n\n| Model | Brier | Log loss | Accuracy | ECE |\n|---|---|---|---|---|\n`;
for (const [k, label] of [['pBase', 'Base (no availability)'], ['pLineup', 'Lineup-aware']]) { const m = metrics(withLineup, k); md += `| ${label} | ${fmt(m.brier)} | ${fmt(m.logLoss)} | ${fmt(m.accuracy, 3)} | ${fmt(m.ece)} |\n`; }
const wlm = withLineup.filter(p => p.pMarket !== null);
if (wlm.length) { const m = metrics(wlm, 'pMarket'), l = metrics(wlm, 'pLineup'); md += `| Lineup-aware, market-line games only (n=${wlm.length}) | ${fmt(l.brier)} | ${fmt(l.logLoss)} | ${fmt(l.accuracy, 3)} | ${fmt(l.ece)} |\n| Sportsbook spread on same games | ${fmt(m.brier)} | ${fmt(m.logLoss)} | ${fmt(m.accuracy, 3)} | ${fmt(m.ece)} |\n`; }

const ys = all.map(p => p.y);
const dRec = bootstrapDiff(logLoss, all.map(p => p.pBase), all.map(p => p.pRecord), ys);
const dRat = bootstrapDiff(logLoss, all.map(p => p.pBase), all.map(p => p.pRating), ys);
const dMkt = bootstrapDiff(logLoss, withMarket.map(p => p.pBase), withMarket.map(p => p.pMarket), withMarket.map(p => p.y));
const dLin = bootstrapDiff(logLoss, withLineup.map(p => p.pLineup), withLineup.map(p => p.pBase), withLineup.map(p => p.y));
md += `\n## Paired bootstrap, log-loss difference (negative = first model better), 95% interval\n\n`;
md += `- Base vs win-percentage baseline: ${fmt(dRec.mean)} [${fmt(dRec.ci95[0])}, ${fmt(dRec.ci95[1])}]\n`;
md += `- Base vs rating-only: ${fmt(dRat.mean)} [${fmt(dRat.ci95[0])}, ${fmt(dRat.ci95[1])}]\n`;
md += `- Base vs sportsbook line: ${fmt(dMkt.mean)} [${fmt(dMkt.ci95[0])}, ${fmt(dMkt.ci95[1])}]\n`;
md += `- Lineup-aware vs base: ${fmt(dLin.mean)} [${fmt(dLin.ci95[0])}, ${fmt(dLin.ci95[1])}]\n`;

md += `\n## By season (base model vs market line)\n\n| Season | n | Base Brier | Base log loss | Market log loss (n) |\n|---|---|---|---|---|\n`;
for (const S of TEST_SEASONS) {
  const s = all.filter(p => p.season === S), sm = s.filter(p => p.pMarket !== null);
  const b = metrics(s, 'pBase'); const mk = sm.length ? metrics(sm, 'pMarket') : null;
  md += `| ${S} | ${s.length} | ${fmt(b.brier)} | ${fmt(b.logLoss)} | ${mk ? `${fmt(mk.logLoss)} (${sm.length})` : '—'} |\n`;
}
md += `\n## Calibration of base model (all test games)\n\n| Band | n | Mean predicted | Observed | Observed 95% CI |\n|---|---|---|---|---|\n`;
for (const r of reliability(all.map(p => p.pBase), ys)) if (r.n) md += `| ${r.band} | ${r.n} | ${fmt(r.meanPredicted, 3)} | ${fmt(r.observed, 3)} | ${fmt(r.ci95[0], 3)}-${fmt(r.ci95[1], 3)} |\n`;
md += `\n## Calibration of lineup-aware model\n\n| Band | n | Mean predicted | Observed | Observed 95% CI |\n|---|---|---|---|---|\n`;
for (const r of reliability(withLineup.map(p => p.pLineup), withLineup.map(p => p.y))) if (r.n) md += `| ${r.band} | ${r.n} | ${fmt(r.meanPredicted, 3)} | ${fmt(r.observed, 3)} | ${fmt(r.ci95[0], 3)}-${fmt(r.ci95[1], 3)} |\n`;
md += `\n## Reading this honestly\n\n- Matching or slightly trailing the sportsbook line on average is expected for a public-data model; the line aggregates information (injury news, sharp money) we do not have. Beating it on average would be a surprising claim that needs much more evidence.\n- Value detection does not require beating the market on average. It requires being right *where the model and the price disagree*, which must be measured with real executable prices in paper trading. That evidence does not exist yet.\n- The 2027 season row is a partial season (in progress).\n`;

// ---------- 5. Final fit on all completed data for deployment ----------
const finalTrain = rows.filter(r => r.g.season >= FIRST_TRAIN_SEASON);
const fm = fitAll(finalTrain);
const marginSd = fm.ratingSd;
const lastSeasonGames = rows.filter(r => r.g.season === TEST_SEASONS.at(-1)).length;
const rotations = {};
for (const t of st.teams.keys()) rotations[t] = rotation(av, t).slice(0, 12).map(p => ({ id: p.id, name: p.name, ewMin: +p.ewMin.toFixed(1), gsPerMin: +p.gsPerMin.toFixed(3), value: +p.value.toFixed(2) }));
const baseM = metrics(all, 'pBase'), mktM = metrics(withMarket, 'pMarket'), baseOnMkt = metrics(withMarket, 'pBase');
const artifact = {
  modelVersion: MODEL_VERSION, createdAt: new Date().toISOString(), dataSnapshot: { builtAt: manifest.built_at_utc, lastGameDate: manifest.last_game_date, gamesSha256: manifest.files['games.csv'].sha256 },
  featuresFrozen: { base: PREGAME_FEATURES, lineup: LINEUP_FEATURES }, marketInputs: 'NONE',
  base: { features: PREGAME_FEATURES, beta: fm.base.map(v => +v.toFixed(6)) },
  lineup: fm.lineup ? { features: LINEUP_FEATURES, beta: fm.lineup.map(v => +v.toFixed(6)) } : null,
  marginSd: +marginSd.toFixed(3),
  validation: { method: 'season walk-forward', testSeasons: TEST_SEASONS, n: all.length, base: baseM, marketComparisonN: withMarket.length, baseOnMarketGames: baseOnMkt, marketLineOnSameGames: mktM,
    lineupAware: withLineup.length ? metrics(withLineup, 'pLineup') : null, logLossVsMarket: dMkt, currentSeasonGames: lastSeasonGames },
  ratings: snapshotRatings(st), rotations,
};
mkdirSync(resolve(PROJECT_ROOT, 'app/models'), { recursive: true });
writeFileSync(resolve(PROJECT_ROOT, 'app/models/nba-pregame.json'), JSON.stringify(artifact));
mkdirSync(resolve(PROJECT_ROOT, 'docs/reports'), { recursive: true });
writeFileSync(resolve(PROJECT_ROOT, 'docs/reports/nba-pregame-validation.md'), md);
mkdirSync(resolve(PROJECT_ROOT, 'data/derived'), { recursive: true });
// Out-of-sample pregame priors for live-model validation (only test seasons, so priors are never in-sample).
const lines = ['game_id,season,p_base,implied_margin,exp_pace,exp_total,record_diff'];
for (const p of preds) {
  const r = p.r; const z = Math.max(-2.6, Math.min(2.6, invNorm(p.pBase)));
  lines.push([r.g.gameId, p.season, p.pBase.toFixed(5), (z * marginSd).toFixed(3), r.pre.expPace.toFixed(2), (r.pre.expHomePts + r.pre.expAwayPts).toFixed(2), r.recordDiff.toFixed(4)].join(','));
}
writeFileSync(resolve(PROJECT_ROOT, 'data/derived/pregame_preds.csv'), lines.join('\n') + '\n');
console.log(md);
