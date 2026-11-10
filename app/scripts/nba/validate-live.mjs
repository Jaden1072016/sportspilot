// Fit and validate the live NBA win-probability engines on held-out seasons.
// Usage: node scripts/nba/validate-live.mjs [--quick]
// Train states: seasons 2019-2022. Test states: 2023-2027 (2027 partial). Priors are the
// out-of-sample pregame predictions from train-pregame.mjs, so no game's own result leaks in.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { readCsv, PROJECT_ROOT, loadManifest } from './data.mjs';
import { simulateLive, analyticLive, legacyBaseline, calibrateLive, DEFAULT_LIVE_PARAMS } from '../../lib/nba/live.mjs';
import { brier, logLoss, accuracy, ece, reliability, bootstrapDiff, rng, fitLogistic } from '../../lib/stats.mjs';

const QUICK = process.argv.includes('--quick');
const TRAIN = new Set([2019, 2020, 2021, 2022]);
const MODEL_VERSION = 'NBA-LIVE-v1.0';

const preds = new Map();
for (const line of readFileSync(resolve(PROJECT_ROOT, 'data/derived/pregame_preds.csv'), 'utf8').trim().split('\n').slice(1)) {
  const [gid, season, pBase, im, pace, tot, rd] = line.split(',');
  preds.set(+gid, { expMargin48: +im, pace: +pace, expTotal48: +tot, recordDiff: +rd });
}
const states = [];
for (const r of readCsv('live_states.csv')) {
  const prior = preds.get(+r.game_id); if (!prior) continue;
  const period = +r.period, sec = +r.sec_left;
  const clockSeconds = period <= 4 ? sec - (4 - period) * 720 : sec;
  if (period <= 4 && (clockSeconds <= 0 || clockSeconds > 720)) continue;
  states.push({ gameId: +r.game_id, season: +r.season, period, secLeft: sec, clockSeconds, homeScore: +r.home_score, awayScore: +r.away_score, y: +r.home_win, prior });
}
const train = states.filter(s => TRAIN.has(s.season)), test = states.filter(s => !TRAIN.has(s.season));
console.log(`states: train ${train.length}, test ${test.length}`);
const sample = (arr, n, seed) => { const r = rng(seed), a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a.slice(0, n); };
const st = s => ({ homeScore: s.homeScore, awayScore: s.awayScore, period: s.period, clockSeconds: s.clockSeconds, possession: null });
const seedOf = s => (s.gameId * 7919 + s.secLeft * 31 + s.period) >>> 0;

// ---- Fit analytic engine (grid search, train only) ----
const aTrain = sample(train, QUICK ? 15000 : 60000, 1);
let aBest = null;
for (const aSigma of [15, 16, 17, 18, 19, 21]) for (const aKappa of [0.6, 0.9, 1.2, 1.5]) for (const aS0 of [0, 1.5, 3]) for (const aLate of [1, 1.5, 2, 3]) {
  const prm = { ...DEFAULT_LIVE_PARAMS, aSigma, aKappa, aS0, aLate };
  const ps = aTrain.map(s => analyticLive(st(s), s.prior, prm).homeProbability);
  const ll = logLoss(ps, aTrain.map(s => s.y));
  if (!aBest || ll < aBest.ll) aBest = { ll, prm: { aSigma, aKappa, aS0, aLate } };
}
console.log('analytic best', aBest);

// ---- Fit Monte Carlo engine (grid search, train only, common random numbers) ----
const mTrain = sample(train, QUICK ? 1500 : 4000, 2);
const MC_FIT_SIMS = QUICK ? 200 : 400;
let mBest = null;
const t0 = Date.now();
for (const kappa of [0, 0.15, 0.3, 0.45]) for (const s0 of [0, 2]) {
  const prm = { ...DEFAULT_LIVE_PARAMS, kappa, s0 };
  const ps = mTrain.map(s => simulateLive(st(s), s.prior, prm, { sims: MC_FIT_SIMS, seed: seedOf(s) }).homeProbability);
  const ll = logLoss(ps.map(p => Math.min(0.999, Math.max(0.001, p))), mTrain.map(s => s.y));
  if (!mBest || ll < mBest.ll) mBest = { ll, prm: { kappa, s0 } };
}
console.log('mc best', mBest, `${((Date.now() - t0) / 1000).toFixed(1)}s`);
const liveParams = { ...DEFAULT_LIVE_PARAMS, ...aBest.prm, ...mBest.prm };
// ---- Calibration layer for the simulator, fit on training states only ----
const cTrain = sample(train, QUICK ? 1500 : 5000, 4);
const CAL_SIMS = QUICK ? 300 : 1000;
const lg = p => { const q = Math.min(0.999, Math.max(0.001, p)); return Math.log(q / (1 - q)); };
const calX = [], calY = [];
for (const s of cTrain) {
  const p = simulateLive(st(s), s.prior, liveParams, { sims: CAL_SIMS, seed: seedOf(s) ^ 0x51ed27 }).homeProbability;
  const l = lg(p); calX.push([l, l * Math.sqrt(s.secLeft / 2880)]); calY.push(s.y);
}
const calib = fitLogistic(calX, calY, { l2: 1e-6 });
console.log('mc calibration', calib);

// ---- Evaluate on held-out seasons ----
const evalSet = sample(test, QUICK ? 3000 : 20000, 3);
const EVAL_SIMS = QUICK ? 300 : 1000;
const t1 = Date.now();
const rows = evalSet.map(s => {
  const mc = simulateLive(st(s), s.prior, liveParams, { sims: EVAL_SIMS, seed: seedOf(s) ^ 0x9e3779b9 });
  const an = analyticLive(st(s), s.prior, liveParams);
  const noPrior = analyticLive(st(s), { expMargin48: 0, pace: 98, expTotal48: 224 }, { ...liveParams, aS0: 0 });
  const pMcRaw = Math.min(0.999, Math.max(0.001, mc.homeProbability));
  const pCal = calibrateLive(pMcRaw, s.period <= 4 ? s.secLeft : 0, calib);
  return { s, y: s.y, pMcRaw, pMc: pCal, pEns: (pCal + an.homeProbability) / 2, pAn: an.homeProbability, pNoPrior: noPrior.homeProbability,
    pLegacy: legacyBaseline(st(s), s.prior.recordDiff) };
});
console.log(`eval ${rows.length} states x ${EVAL_SIMS} sims in ${((Date.now() - t1) / 1000).toFixed(1)}s`);

const ENGINES = [['pLegacy', 'Legacy v0.1 score/clock/record baseline'], ['pNoPrior', 'Score + clock only (no team strength)'], ['pAn', 'Analytic OU model with SportsPilot prior'], ['pMcRaw', 'Possession Monte Carlo (raw)'], ['pMc', 'Possession Monte Carlo (calibrated)'], ['pEns', 'Ensemble: mean of calibrated MC and analytic']];
const fmt = (v, d = 4) => (Number.isFinite(v) ? v.toFixed(d) : '—');
const m = (list, k) => { const ps = list.map(r => r[k]), ys = list.map(r => r.y); return { n: list.length, brier: brier(ps, ys), logLoss: logLoss(ps, ys), accuracy: accuracy(ps, ys), ece: ece(ps, ys) }; };
const table = (list, title) => {
  let t = `\n### ${title} (n=${list.length})\n\n| Engine | Brier | Log loss | Accuracy | ECE |\n|---|---|---|---|---|\n`;
  for (const [k, label] of ENGINES) { const x = m(list, k); t += `| ${label} | ${fmt(x.brier)} | ${fmt(x.logLoss)} | ${fmt(x.accuracy, 3)} | ${fmt(x.ece)} |\n`; }
  return t;
};
const manifest = loadManifest();
let md = `# NBA live win probability: held-out validation\n\nGenerated ${new Date().toISOString()} by \`app/scripts/nba/validate-live.mjs\`. Snapshot built ${manifest.built_at_utc}.\n\n`;
md += `**Method.** In-game states sampled from ESPN play-by-play (coarse early, dense in the final 5 minutes, plus overtime). Parameters fit on 2019-2022 states only; scored on ${rows.length} randomly sampled states from 2023-2027 games (2027 partial). The team-strength prior for every game is the out-of-sample pregame prediction (no game's own result used). Market prices are not used anywhere. Possession is not in the historical state sample, so it is treated as unknown (50/50), which is also the live default when ESPN does not report it.\n\n`;
md += `Fitted analytic params: ${JSON.stringify(aBest.prm)}. Fitted Monte Carlo params: ${JSON.stringify(mBest.prm)} (${MC_FIT_SIMS} sims/state during fit, ${EVAL_SIMS} at evaluation).\n`;
md += table(rows, 'All held-out states');
const bucket = (lo, hi) => rows.filter(r => r.s.period <= 4 && r.s.secLeft <= hi && r.s.secLeft > lo);
md += table(rows.filter(r => r.s.period <= 2), 'First half');
md += table(rows.filter(r => r.s.period === 3), 'Third quarter');
md += table(bucket(300, 720), 'Fourth quarter, 12:00-5:00');
md += table(bucket(60, 300), 'Fourth quarter, final 5:00 to 1:00');
md += table(bucket(0, 60), 'Final minute of regulation');
md += table(rows.filter(r => r.s.period <= 4 && r.s.secLeft <= 360 && Math.abs(r.s.homeScore - r.s.awayScore) <= 6), 'Close games: final 6:00, margin within 6');
const comeback = rows.filter(r => r.s.period <= 4 && r.s.secLeft >= 600 && r.s.secLeft <= 1800 && Math.abs(r.s.homeScore - r.s.awayScore) >= 8 && Math.abs(r.s.homeScore - r.s.awayScore) <= 15);
md += table(comeback, 'Comeback zone: 30:00-10:00 left, margin 8-15');
const ot = rows.filter(r => r.s.period > 4);
if (ot.length > 30) md += table(ot, 'Overtime');
// trailing-team view for the comeback zone
const trail = comeback.map(r => { const homeTrails = r.s.homeScore < r.s.awayScore; return { pMc: homeTrails ? r.pMc : 1 - r.pMc, pNo: homeTrails ? r.pNoPrior : 1 - r.pNoPrior, y: homeTrails ? r.y : 1 - r.y }; });
const mcT = trail.reduce((a, r) => a + r.pMc, 0) / trail.length, noT = trail.reduce((a, r) => a + r.pNo, 0) / trail.length, obsT = trail.reduce((a, r) => a + r.y, 0) / trail.length;
md += `\nComeback zone, trailing team: Monte Carlo mean predicted ${fmt(mcT, 3)}, score/clock-only mean predicted ${fmt(noT, 3)}, observed win rate ${fmt(obsT, 3)} (n=${trail.length}).\n`;
const ys = rows.map(r => r.y);
const d1 = bootstrapDiff(logLoss, rows.map(r => r.pMc), rows.map(r => r.pLegacy), ys);
const d2 = bootstrapDiff(logLoss, rows.map(r => r.pMc), rows.map(r => r.pNoPrior), ys);
const d3 = bootstrapDiff(logLoss, rows.map(r => r.pMc), rows.map(r => r.pAn), ys);
md += `\n## Paired bootstrap, log-loss difference (negative = Monte Carlo better), 95% interval\n\n- vs legacy v0.1: ${fmt(d1.mean)} [${fmt(d1.ci95[0])}, ${fmt(d1.ci95[1])}]\n- vs score+clock only: ${fmt(d2.mean)} [${fmt(d2.ci95[0])}, ${fmt(d2.ci95[1])}]\n- vs analytic OU: ${fmt(d3.mean)} [${fmt(d3.ci95[0])}, ${fmt(d3.ci95[1])}]\n`;
md += `\n## Calibration, Monte Carlo engine (held-out)\n\n| Band | n | Mean predicted | Observed | Observed 95% CI |\n|---|---|---|---|---|\n`;
for (const b of reliability(rows.map(r => r.pMc), ys)) if (b.n) md += `| ${b.band} | ${b.n} | ${fmt(b.meanPredicted, 3)} | ${fmt(b.observed, 3)} | ${fmt(b.ci95[0], 3)}-${fmt(b.ci95[1], 3)} |\n`;
md += `\n## Calibration in the 3x-5x payout band (model probability 20%-33%)\n\n`;
const band = rows.filter(r => r.pMc >= 0.2 && r.pMc <= 0.3334);
const bandOther = rows.filter(r => 1 - r.pMc >= 0.2 && 1 - r.pMc <= 0.3334).map(r => ({ p: 1 - r.pMc, y: 1 - r.y }));
const bandAll = [...band.map(r => ({ p: r.pMc, y: r.y })), ...bandOther];
const bm = bandAll.reduce((a, r) => a + r.p, 0) / bandAll.length, bo = bandAll.reduce((a, r) => a + r.y, 0) / bandAll.length;
md += `Sides the model priced at 20%-33% (n=${bandAll.length}): mean predicted ${fmt(bm, 3)}, observed ${fmt(bo, 3)}. States within a game are correlated, so the effective sample is smaller than n.\n`;
md += `\n## Limits\n\n- No lineup / on-court / foul-trouble inputs yet: ESPN live feeds do not reliably expose who is on the floor. These are listed as not connected in the app.\n- States from the same game are correlated; intervals above treat states as independent and are therefore too narrow.\n- Good calibration is necessary but not sufficient for profitable trading. The live market also sees the score; edge must be measured against executable prices in paper trading.\n`;

// Rank by log loss rounded to 3 dp (differences below that are within Monte Carlo noise), then by ECE.
const ranked = ['pAn', 'pMc', 'pEns'].map(k => { const x = m(rows, k); return [k, Math.round(x.logLoss * 1000), x.ece]; }).sort((a, b) => a[1] - b[1] || a[2] - b[2]);
const engineName = { pAn: 'analytic-ou', pMc: 'monte-carlo-calibrated', pEns: 'ensemble' }[ranked[0][0]];
md += `\n## Engine selection\n\nDeployed engine: **${engineName}** (lowest held-out log loss, rounded to 3 decimals, then lowest calibration error). Selection on the held-out set is a mild form of test-set reuse; the next untouched check is prospective live logging.\n`;
const artifact = { modelVersion: MODEL_VERSION, createdAt: new Date().toISOString(), marketInputs: 'NONE', params: liveParams, mcCalibration: calib,
  defaultEngine: engineName, defaultSims: 4000,
  validation: { trainSeasons: [...TRAIN], testStates: rows.length, evalSims: EVAL_SIMS,
    engines: Object.fromEntries(ENGINES.map(([k, label]) => [k, { label, ...m(rows, k) }])), vsLegacy: d1, vsNoPrior: d2, vsAnalytic: d3 } };
mkdirSync(resolve(PROJECT_ROOT, 'app/models'), { recursive: true });
writeFileSync(resolve(PROJECT_ROOT, 'app/models/nba-live.json'), JSON.stringify(artifact, null, 1));
mkdirSync(resolve(PROJECT_ROOT, 'docs/reports'), { recursive: true });
writeFileSync(resolve(PROJECT_ROOT, 'docs/reports/nba-live-validation.md'), md);
console.log(md);
