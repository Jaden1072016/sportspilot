// Single entry point: ESPN-normalized game + model artifacts -> independent forecast.
// Pure and deterministic (seeded). Imports no market code. Used by the browser and by
// any future server-side scanner so both produce identical numbers.
import { restoreRatings, preGame, postGame } from './ratings.mjs';
import { pregameFeatures, pregameProbability } from './pregame.mjs';
import { simulateLive, analyticLive, calibrateLive, timeState } from './live.mjs';

const MAX_RATING_STALENESS_DAYS = 4;

/** US/Eastern calendar date (YYYY-MM-DD) of a tip time; ESPN game dates use this convention. */
export function easternDate(iso) {
  const t = Date.parse(iso || '');
  if (!Number.isFinite(t)) return null;
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(t));
}
const dayDiff = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
const pct = v => `${(v * 100).toFixed(1)}%`;
const signed = (v, d = 1) => `${v >= 0 ? '+' : ''}${v.toFixed(d)}`;

function hashSeed(...parts) {
  let h = 2166136261;
  for (const ch of parts.join('|')) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/** Normalize ESPN period/clock edge cases into a simulator state. */
export function liveStateFromGame(g) {
  if (g.status !== 'in') return null;
  let period = g.period, clock = g.clockSeconds;
  if (!Number.isInteger(period) || period < 1 || !Number.isFinite(clock)) return null;
  if (g.statusName === 'STATUS_HALFTIME') { period = 3; clock = 720; }
  else if (clock <= 0 && (g.statusName === 'STATUS_END_PERIOD' || g.statusName === 'STATUS_END_OF_PERIOD' || clock === 0)) {
    if (period < 4) { period += 1; clock = 720; }
    else if (g.home.score === g.away.score) { period += 1; clock = 300; }
    else return { final: true };
  }
  return { homeScore: g.home.score, awayScore: g.away.score, period, clockSeconds: clock, possession: g.possession || null };
}

export function createPredictor(pregameModel, liveModel) {
  const ratings = pregameModel ? restoreRatings(pregameModel.ratings) : null;
  const cache = new Map();
  const applied = new Set();

  /** Missing rotation value given a set of athlete ids ruled OUT (injury report). */
  function availFrom(teamId, out) {
    const rot = pregameModel.rotations?.[teamId] || [];
    const total = rot.reduce((s, p) => s + p.value, 0);
    const missingPlayers = rot.filter(p => out.has(String(p.id)));
    return { known: true, total, missing: missingPlayers.reduce((s, p) => s + p.value, 0), missingPlayers };
  }

  function pregameFor(g, outSet = null) {
    const out = { available: false, evidence: [], warnings: [], blockers: [] };
    if (!ratings) { out.blockers.push('Pregame model artifact not loaded'); return out; }
    const hid = Number(g.home.id), aid = Number(g.away.id);
    const h = ratings.teams.get(hid), a = ratings.teams.get(aid);
    if (!h || !a) { out.blockers.push('Team not found in rating table (identity cannot be verified)'); return out; }
    const date = easternDate(g.startTime) || ratings.lastGameDate;
    const stale = dayDiff(ratings.lastGameDate, date);
    if (stale > MAX_RATING_STALENESS_DAYS) out.blockers.push(`Team ratings are ${stale} days old (as of ${ratings.lastGameDate}); refresh the data snapshot`);
    else if (stale > 1) out.warnings.push(`Team ratings were last updated ${ratings.lastGameDate} (${stale} days old)`);
    // preGame() needs a season label; keep the snapshot's current season.
    const pre = preGame(ratings, { season: ratings.season, homeId: hid, awayId: aid, date, neutral: Boolean(g.neutralSite) });
    const aH = outSet ? availFrom(hid, outSet) : null, aA = outSet ? availFrom(aid, outSet) : null;
    const feats = pregameFeatures(pre, aH, aA); // lineup-aware when an injury report is loaded
    const res = pregameProbability(pregameModel, feats);
    if (!res.available) { out.blockers.push(res.why); return out; }
    const minGames = Math.min(pre.homeGames, pre.awayGames);
    Object.assign(out, { available: true, ...res, pre, ratingsAsOf: ratings.lastGameDate, minGames });
    const tH = g.home.abbr, tA = g.away.abbr;
    const vs = (abbr, r) => Math.abs(r) < 0.5 ? `${abbr} is about an average team` : `${abbr} is about ${Math.abs(r).toFixed(1)} points per game ${r > 0 ? 'better' : 'worse'} than an average team`;
    out.evidence.push(`${vs(tH, pre.rHome)}. ${vs(tA, pre.rAway)}.`);
    out.evidence.push(pre.hca ? `${tH} is at home. Home teams score about ${pre.hca.toFixed(1)} extra points on average.` : 'Neutral court, so neither team gets a home boost.');
    if (pre.restHome === 1) out.evidence.push(`${tH} played yesterday (tired legs usually cost a little).`);
    if (pre.restAway === 1) out.evidence.push(`${tA} played yesterday (tired legs usually cost a little).`);
    out.evidence.push(`Projected score: ${tH} ${pre.expHomePts.toFixed(0)}, ${tA} ${pre.expAwayPts.toFixed(0)}.`);
    if (minGames < 10) out.warnings.push(`Early season: only ${minGames} games played, so ratings still lean on last season.`);
    if (feats.availKnown) {
      for (const [abbr, a] of [[tH, aH], [tA, aA]]) if (a.missingPlayers.length) out.evidence.push(`${abbr} is missing ${a.missingPlayers.map(p => p.name).join(', ')} (ruled out). That is about ${a.total ? Math.round(100 * a.missing / a.total) : 0}% of their usual rotation value.`);
      if (!aH.missingPlayers.length && !aA.missingPlayers.length) out.evidence.push('No regular rotation players are ruled out on the injury report.');
      out.warnings.push('Injury report from ESPN. Players listed day-to-day are assumed to play; late scratches can still change things.');
    } else out.warnings.push('Injury report not loaded, so this does not know who is sitting out tonight.');
    // Sensitivity band: shift expected margin by a rating-uncertainty amount. Heuristic, not a calibrated CI.
    const ratingSd = 2.5 + 3.5 * Math.exp(-minGames / 10);
    const z = res.impliedMargin / pregameModel.marginSd;
    const toP = m => 0.5 * (1 + erf(m / pregameModel.marginSd / Math.SQRT2));
    out.band = { low: toP(res.impliedMargin - ratingSd), high: toP(res.impliedMargin + ratingSd), ratingSd, kind: 'rating-uncertainty sensitivity band (heuristic, not a calibrated interval)' };
    out.prior = { expMargin48: res.impliedMargin, pace: pre.expPace, expTotal48: pre.expHomePts + pre.expAwayPts };
    void z;
    return out;
  }

  function liveFor(g, prior, { sims, seed } = {}) {
    const s = liveStateFromGame(g);
    if (!s) return { available: false, why: g.status === 'in' ? 'Live clock/period not parseable' : 'Game not in progress' };
    if (s.final) return { available: false, why: 'Regulation ended; awaiting final' };
    if (!liveModel) return { available: false, why: 'Live model artifact not loaded' };
    if (!prior) return { available: false, why: 'No independent pregame prior for this matchup' };
    const key = [g.id, s.homeScore, s.awayScore, s.period, s.clockSeconds, s.possession, prior.expMargin48.toFixed(3)].join('|');
    if (cache.has(key)) return cache.get(key);
    const prm = liveModel.params;
    const n = sims || liveModel.defaultSims || 4000;
    const sd = seed ?? hashSeed(key);
    const mc = simulateLive(s, prior, prm, { sims: n, seed: sd });
    const an = analyticLive(s, prior, prm);
    if (!mc.available || !an.available) return { available: false, why: mc.why || an.why };
    const ts = timeState(s);
    const pMc = calibrateLive(mc.homeProbability, ts.overtime ? 0 : ts.secLeft, liveModel.mcCalibration);
    const engine = liveModel.defaultEngine;
    const p = engine === 'analytic-ou' ? an.homeProbability : engine === 'monte-carlo-calibrated' ? pMc : (pMc + an.homeProbability) / 2;
    // Prior sensitivity: rerun the fast engine with the prior shifted +/- 3 pts/48.
    const lo = analyticLive(s, { ...prior, expMargin48: prior.expMargin48 - 3 }, prm).homeProbability;
    const hi = analyticLive(s, { ...prior, expMargin48: prior.expMargin48 + 3 }, prm).homeProbability;
    const res = { available: true, engine, homeProbability: p, awayProbability: 1 - p, components: { monteCarloCalibrated: pMc, monteCarloRaw: mc.homeProbability, analytic: an.homeProbability },
      band: { low: Math.min(lo, p) - 2 * mc.monteCarloStdError, high: Math.max(hi, p) + 2 * mc.monteCarloStdError, kind: 'prior ±3 pts sensitivity plus Monte Carlo error (not a calibrated interval)' },
      sims: n, seed: sd, mcStdError: mc.monteCarloStdError, overtimeProbability: mc.overtimeProbability, finalMargin: mc.finalMargin, state: s, timeLeftSeconds: ts.secLeft, overtime: ts.overtime };
    res.band.low = Math.max(0, res.band.low); res.band.high = Math.min(1, res.band.high);
    const m = s.homeScore - s.awayScore, tH = g.home.abbr, tA = g.away.abbr;
    const leader = m > 0 ? tH : tA;
    const minsLeft = ts.secLeft / 60;
    res.evidence = [
      m === 0 ? `Tied with ${minsLeft.toFixed(1)} min left${ts.overtime ? ' in overtime' : ''}` : `${leader} leads by ${Math.abs(m)} with ${minsLeft.toFixed(1)} min left${ts.overtime ? ' in overtime' : ''}`,
      (() => { const e = prior.expMargin48 * ts.secLeft / 2880, better = e >= 0 ? tH : tA; return Math.abs(e) < 0.5 ? 'The teams are about even in strength for the rest of the game.' : `${better} is the stronger team: worth about ${Math.abs(e).toFixed(1)} points over the time left.`; })(),
      'Big leads tend to shrink a little in real NBA games. The model accounts for that instead of assuming the score keeps going the same way.',
      (() => { const med = mc.finalMargin.p50, lo = mc.finalMargin.p10, hi = mc.finalMargin.p90; const say = v => v === 0 ? 'tied' : v > 0 ? `${tH} by ${v}` : `${tA} by ${-v}`; return `Most likely finish: ${say(med)}. Most simulated games end between ${say(lo)} and ${say(hi)}.`; })(),
      `Chance this goes to overtime: ${pct(mc.overtimeProbability)}.`,
    ];
    res.technical = `Simulation ${pct(pMc)}, formula model ${pct(an.homeProbability)}, blended ${pct(p)}. ${n.toLocaleString()} simulated finishes, seed ${sd}.`;
    res.notConnected = ['who is on the court', 'foul trouble', 'injuries during the game', 'timeouts left', g.possession ? null : 'who has the ball'].filter(Boolean);
    if (cache.size > 500) cache.clear();
    cache.set(key, res);
    return res;
  }

  return {
    predict(g, opts = {}) {
      if (g.league !== 'nba') return { league: g.league, pregame: { available: false, blockers: ['NBA-only model in this version'] }, live: { available: false, why: 'NBA-only model in this version' } };
      const pregame = opts.syntheticPrior ? { available: false, synthetic: true, blockers: ['Synthetic demo team: no real ratings'], prior: opts.syntheticPrior, evidence: [], warnings: [] } : pregameFor(g, opts.out || null);
      const prior = pregame.prior && (pregame.available || opts.syntheticPrior) ? pregame.prior : null;
      const live = liveFor(g, prior, opts);
      return { gameId: g.id, pregame, live, pregameModel: pregameModel?.modelVersion || null, liveModel: liveModel?.modelVersion || null };
    },
    get ratingsAsOf() { return ratings?.lastGameDate || null; },
    /**
     * Bring ratings up to date with completed games played after the snapshot (scores only).
     * Only games on dates strictly before `beforeDate` (US/Eastern) are applied, so a game's own
     * result can never feed its own pregame pick. Returns the number of games applied.
     */
    applyResults(games, beforeDate) {
      if (!ratings) return 0;
      const done = games.filter(g => g.league === 'nba' && g.completed && Number.isFinite(g.home.score) && Number.isFinite(g.away.score) && g.home.score !== g.away.score)
        .map(g => ({ g, date: easternDate(g.startTime) }))
        .filter(x => x.date && x.date > ratings.lastGameDate && x.date < beforeDate && !applied.has(x.g.id) && ratings.teams.has(Number(x.g.home.id)) && ratings.teams.has(Number(x.g.away.id)))
        .sort((a, b) => (a.g.startTime < b.g.startTime ? -1 : 1));
      for (const { g, date } of done) {
        const game = { season: ratings.season, homeId: Number(g.home.id), awayId: Number(g.away.id), date, neutral: Boolean(g.neutralSite), homeScore: g.home.score, awayScore: g.away.score, homePoss: NaN, awayPoss: NaN };
        postGame(ratings, game, preGame(ratings, game));
        applied.add(g.id);
      }
      if (done.length) cache.clear();
      return done.length;
    },
  };
}

function erf(x) { // Abramowitz-Stegun 7.1.26
  const s = Math.sign(x), z = Math.abs(x), t = 1 / (1 + 0.3275911 * z);
  return s * (1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-z * z));
}
