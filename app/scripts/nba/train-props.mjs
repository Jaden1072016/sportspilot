// Fit and validate player stat projections (points, rebounds, assists, threes).
// Usage: node scripts/nba/train-props.mjs
// Dispersion fit on 2021-2024; scored on 2025-2027 (2027 partial). As-of only. Conditional on the
// player actually playing (most prop markets void or are irrelevant if he does not).
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadGames, loadPlayersByGame, loadManifest, PROJECT_ROOT } from './data.mjs';
import { createRatingState, preGame, postGame } from '../../lib/nba/ratings.mjs';
import { createPropState, updateProps, projectedMean, nbAtLeast, nbLogPmf, PROP_STATS, LADDERS, STAT_LABEL, PROP_DEFAULTS, sizeFor } from '../../lib/nba/props.mjs';
import { brier, logLoss, reliability } from '../../lib/stats.mjs';

const MODEL_VERSION = 'NBA-PROPS-v1.0';
const TRAIN = new Set([2021, 2022, 2023, 2024]);
const TEST = new Set([2025, 2026, 2027]);
const pregame = JSON.parse(readFileSync(resolve(PROJECT_ROOT, 'app/models/nba-pregame.json'), 'utf8'));
const games = loadGames(), byGame = loadPlayersByGame(), manifest = loadManifest();
const rs = createRatingState(pregame.ratings.params), ps = createPropState();
const rows = []; // {season, stat, mu, mu0, x, last10:[...]}
const history = new Map(); // athleteId -> {stat: [recent values]}

for (const g of games) {
  const pre = preGame(rs, g);
  const box = byGame.get(g.gameId);
  if (box && (TRAIN.has(g.season) || TEST.has(g.season))) {
    const lgPace = rs.leaguePace, lgO = rs.leagueOrtg;
    for (const r of box) {
      if (r.didNotPlay || !(r.minutes > 0)) continue;
      const p = ps.players.get(r.athleteId);
      if (!p || p.games < ps.params.minGames || p.teamId !== r.teamId) continue;
      const home = r.teamId === g.homeId;
      const opp = rs.teams.get(home ? g.awayId : g.homeId);
      const ctx = { paceFactor: pre.expPace / lgPace, oppDefFactor: opp ? (lgO + opp.def) / lgO : 1 };
      const h = history.get(r.athleteId) || {};
      for (const s of PROP_STATS) rows.push({ season: g.season, stat: s, mu: projectedMean(p, s, ctx), mu0: projectedMean(p, s, {}), x: r[s], last10: (h[s] || []).slice(-10) });
    }
  }
  postGame(rs, g, pre);
  if (box) {
    updateProps(ps, box, g.date);
    for (const r of box) {
      if (r.didNotPlay || !(r.minutes > 0)) continue;
      const h = history.get(r.athleteId) || {}; for (const s of PROP_STATS) { (h[s] ||= []).push(r[s]); if (h[s].length > 10) h[s].shift(); } history.set(r.athleteId, h);
    }
  }
}
console.log(`rows ${rows.length}`);

// Fit dispersion per stat on training seasons (max likelihood over a grid).
const dispersion = {};
for (const s of PROP_STATS) {
  const tr = rows.filter(r => r.stat === s && TRAIN.has(r.season));
  let best = null;
  for (const beta of [0, 0.25, 0.5, 0.75, 1, 1.25, 1.5]) for (const r0 of [0.25, 0.4, 0.6, 0.8, 1, 1.5, 2, 3, 4, 6, 8, 12, 20, 40]) {
    const d = { r0, beta }; let ll = 0; for (const x of tr) ll += nbLogPmf(x.x, x.mu, sizeFor(d, x.mu));
    if (!best || ll > best.ll) best = { d, ll };
  }
  dispersion[s] = best.d;
}
console.log('dispersion', dispersion);

// Evaluate threshold probabilities on test seasons vs baselines.
const fmt = (v, d = 4) => (Number.isFinite(v) ? v.toFixed(d) : '—');
const poissonAtLeast = (k, mu) => { let pk = Math.exp(-mu), c = 0; for (let i = 0; i < k; i++) { c += pk; pk *= mu / (i + 1); } return 1 - c; };
let md = `# NBA player prop projections: held-out validation\n\nGenerated ${new Date().toISOString()} by \`app/scripts/nba/train-props.mjs\`. Snapshot built ${manifest.built_at_utc}.\n\n`;
md += `**Method.** Expected minutes and per-minute rates are exponentially weighted from earlier games only, scaled by expected pace and (points only) opponent defense. Counts follow a negative binomial whose spread was fit on 2021-2024 and scored on 2025-2027 (2027 partial). Results are conditional on the player playing. Baselines: "last 10 games" hit rate (what most prop sites show) and a Poisson model with the same average (no extra spread).\n\nFitted spread (negative binomial size r = r0 x mean^beta; lower = wider): ${JSON.stringify(dispersion)}\n\n`;
const summary = {};
for (const s of PROP_STATS) {
  const te = rows.filter(r => r.stat === s && TEST.has(r.season) && r.last10.length >= 5);
  const P = { nb: [], nb0: [], pois: [], last10: [] }, Y = [];
  for (const r of te) for (const k of LADDERS[s]) {
    P.nb.push(nbAtLeast(k, r.mu, sizeFor(dispersion[s], r.mu))); P.nb0.push(nbAtLeast(k, r.mu0, sizeFor(dispersion[s], r.mu0))); P.pois.push(poissonAtLeast(k, r.mu));
    P.last10.push((r.last10.filter(v => v >= k).length + 0.5) / (r.last10.length + 1)); Y.push(r.x >= k ? 1 : 0);
  }
  const m = k => ({ brier: brier(P[k], Y), logLoss: logLoss(P[k], Y) });
  summary[s] = { n: te.length, thresholds: Y.length, sportspilot: m('nb'), noMatchup: m('nb0'), poisson: m('pois'), last10: m('last10') };
  md += `## ${STAT_LABEL[s]} (lines ${LADDERS[s].join(', ')}+; ${te.length.toLocaleString()} player-games, ${Y.length.toLocaleString()} line checks)\n\n| Method | Brier | Log loss |\n|---|---|---|\n`;
  for (const [k, label] of [['last10', 'Last-10-games hit rate'], ['pois', 'Poisson (no extra spread)'], ['nb0', 'SportsPilot without pace/defense'], ['nb', `${MODEL_VERSION}`]]) md += `| ${label} | ${fmt(m(k).brier)} | ${fmt(m(k).logLoss)} |\n`;
  md += `\n| Our chance | n | Avg predicted | Actually hit |\n|---|---|---|---|\n`;
  for (const b of reliability(P.nb, Y)) if (b.n) md += `| ${b.band} | ${b.n} | ${fmt(b.meanPredicted, 3)} | ${fmt(b.observed, 3)} |\n`;
  md += '\n';
}
md += `## Limits\n\n- Assumes normal minutes. It does not know about injuries, rest days, blowouts or a teammate being out, which can swing minutes a lot.\n- Player data comes from the last data snapshot; players traded since then keep their old team until the snapshot is refreshed.\n- Same-game correlations (e.g. a player's points and assists, or two teammates) are not modeled yet, so parlays built from these are still theoretical.\n- Calibration on past seasons is not proof of profit against Polymarket prices.\n`;

// Current players for deployment: played recently, real role.
const asOf = games.at(-1).date;
const recent = d => d && (Date.parse(asOf) - Date.parse(d)) / 86400000 <= 21;
const current = [...ps.players.values()].filter(p => p.games >= PROP_DEFAULTS.minGames && p.ewMin >= 10 && recent(p.lastDate) && p.teamId >= 1 && p.teamId <= 30)
  .map(p => ({ id: p.id, name: p.name, teamId: p.teamId, ewMin: +p.ewMin.toFixed(2), games: p.games, lastDate: p.lastDate, rate: Object.fromEntries(PROP_STATS.map(s => [s, +p.rate[s].toFixed(5)])) }));
const artifact = { modelVersion: MODEL_VERSION, createdAt: new Date().toISOString(), marketInputs: 'NONE', asOfDate: asOf, dispersion, ladders: LADDERS,
  validation: { trainSeasons: [...TRAIN], testSeasons: [...TEST], conditionalOnPlaying: true, summary }, players: current };
writeFileSync(resolve(PROJECT_ROOT, 'app/models/nba-props.json'), JSON.stringify(artifact));
mkdirSync(resolve(PROJECT_ROOT, 'docs/reports'), { recursive: true });
writeFileSync(resolve(PROJECT_ROOT, 'docs/reports/nba-props-validation.md'), md);
console.log(md);
console.log(`deployed players: ${current.length}`);
