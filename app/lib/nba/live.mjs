// Independent NBA in-game win probability.
// Inputs: score, period, clock, optional possession, and an independent pregame prior
// (expected margin and pace from the SportsPilot pregame model). Never market prices.
//
// Two engines, both validated on held-out seasons (see docs/reports/nba-live-validation.md):
//  - simulateLive: possession-level Monte Carlo with game-level strength uncertainty,
//    fitted lead mean-reversion ("score effects"), late-game intentional fouling,
//    clock management, 3-point chasing, and overtime.
//  - analyticLive: closed-form Ornstein-Uhlenbeck normal approximation (fast baseline).
import { rng as makeRng, normCdf } from '../stats.mjs';

export const REG_SECONDS = 2880, PERIOD_SECONDS = 720, OT_SECONDS = 300;

export const DEFAULT_LIVE_PARAMS = Object.freeze({
  kappa: 0.6,          // mean reversion of the lead, per 48 minutes (fitted)
  s0: 4.0,             // sd of tonight's true strength around the pregame prior, pts/48 (fitted)
  sigmaRef: 15,        // per-48 noise used for Bayesian updating of strength from the observed margin
  ftPct: 0.775,        // league free-throw rate used in foul-game possessions
  foulWindow: 50,      // seconds left when trailing team starts fouling
  basePpp: 1.14,       // league points per possession (pregame prior overrides via expTotal)
  // analytic engine
  aSigma: 15.0, aKappa: 0.6, aS0: 4.0, aLate: 1.0,
});

/** Convert a game state to seconds left in regulation (or in the current OT period). */
export function timeState({ period, clockSeconds }) {
  if (!Number.isInteger(period) || period < 1 || !Number.isFinite(clockSeconds) || clockSeconds < 0) return null;
  if (period <= 4) {
    const c = Math.min(PERIOD_SECONDS, clockSeconds);
    return { overtime: false, secLeft: (4 - period) * PERIOD_SECONDS + c, periodLeft: c, elapsedFrac: 1 - ((4 - period) * PERIOD_SECONDS + c) / REG_SECONDS };
  }
  const c = Math.min(OT_SECONDS, clockSeconds);
  return { overtime: true, secLeft: c, periodLeft: c, elapsedFrac: 1 };
}

function posterior(prior, margin, elapsedFrac, p) {
  // Strength rate r (pts/48) ~ N(mu, s0^2); observed margin M ~ N(r f, sigmaRef^2 f).
  const mu = prior.expMargin48, f = Math.max(0, Math.min(1, elapsedFrac));
  if (p.s0 <= 0) return { mean: mu, sd: 0 };
  const prec = 1 / (p.s0 * p.s0) + f / (p.sigmaRef * p.sigmaRef);
  return { mean: (mu / (p.s0 * p.s0) + margin / (p.sigmaRef * p.sigmaRef)) / prec, sd: Math.sqrt(1 / prec) };
}

/**
 * Monte Carlo simulation of the remainder of the game.
 * state: { homeScore, awayScore, period, clockSeconds, possession?: 'home'|'away'|null }
 * prior: { expMargin48 (home, incl. home edge), pace (possessions per team per 48), expTotal48 }
 */
export function simulateLive(state, prior, params = DEFAULT_LIVE_PARAMS, { sims = 5000, seed = 12345 } = {}) {
  const p = { ...DEFAULT_LIVE_PARAMS, ...params };
  const ts = timeState(state);
  if (!ts) return { available: false, why: 'Period or clock invalid' };
  if (![state.homeScore, state.awayScore].every(Number.isFinite)) return { available: false, why: 'Score missing' };
  if (![prior?.expMargin48, prior?.pace].every(Number.isFinite)) return { available: false, why: 'Independent pregame prior missing' };
  const r = makeRng(seed);
  const margin0 = state.homeScore - state.awayScore;
  const post = posterior(prior, margin0, ts.elapsedFrac, p);
  const pace = Math.max(85, Math.min(110, prior.pace));
  const base = Number.isFinite(prior.expTotal48) ? Math.max(0.95, Math.min(1.3, prior.expTotal48 / (2 * pace))) : p.basePpp;
  const meanDur = REG_SECONDS / (2 * pace);
  let homeWins = 0, ot = 0;
  const finalMargins = new Int16Array(sims);
  for (let s = 0; s < sims; s++) {
    const rate = post.mean + post.sd * r.normal();
    let m = margin0, left = ts.secLeft;
    // In regulation, `left` is seconds left in regulation; late-game logic uses it directly.
    let off = state.possession === 'home' ? 1 : state.possession === 'away' ? -1 : (r() < 0.5 ? 1 : -1);
    let overtimes = 0;
    for (;;) {
      if (left <= 0) {
        if (m !== 0) break;
        overtimes++; if (overtimes > 6) { m = r() < 0.5 ? 1 : -1; break; }
        left = OT_SECONDS; off = r() < 0.5 ? 1 : -1;
      }
      const lead = m * off;              // offense's lead (positive = offense ahead)
      const late = left <= 120;
      let pts = 0, dur;
      if (late && lead >= 3 && lead <= 12 && left <= p.foulWindow) {
        // Offense leads, trailing defense fouls quickly: two free throws.
        dur = 2 + r() * 4;
        pts = (r() < p.ftPct ? 1 : 0) + (r() < p.ftPct ? 1 : 0);
      } else {
        const drift = rate - p.kappa * m;                // home-minus-away pts per 48 at this state
        const ppp = base + off * drift / (2 * pace);
        let q1 = 0.045, q2 = 0.36, q3 = 0.125;
        if (late && lead < 0) {
          // Trailing offense late: quick shots, more threes; down exactly 3 near the end: must shoot 3.
          if (lead === -3 && left <= 24) { q2 = 0.10; q3 = 0.36; q1 = 0.02; }
          else if (lead <= -4) { q2 = 0.30; q3 = 0.17; }
          dur = Math.min(left, 4 + r() * 6);
        } else if (late && lead > 0) {
          dur = Math.min(left, 18 + r() * 6);           // leading offense milks clock
        } else {
          dur = meanDur * gamma3(r);
        }
        const scale = ppp / (q1 + 2 * q2 + 3 * q3);
        const u = r();
        const a1 = q1 * scale, a2 = a1 + q2 * scale, a3 = a2 + q3 * scale;
        let made = u < a1 ? 1 : u < a2 ? 2 : u < a3 ? 3 : 0;
        if (dur > left) { made = left >= 3 ? made : (r() < 0.35 ? made : 0); dur = left; }
        pts = made;
      }
      m += off * pts;
      left -= dur;
      off = -off;
    }
    if (m > 0) homeWins++;
    if (overtimes > 0) ot++;
    finalMargins[s] = Math.max(-32768, Math.min(32767, m));
  }
  const pHome = homeWins / sims;
  const mcSe = Math.sqrt(pHome * (1 - pHome) / sims);
  const sorted = Array.from(finalMargins).sort((a, b) => a - b);
  const q = x => sorted[Math.min(sims - 1, Math.floor(x * sims))];
  return { available: true, engine: 'possession-monte-carlo', homeProbability: pHome, awayProbability: 1 - pHome, sims, seed,
    monteCarloStdError: mcSe, overtimeProbability: ot / sims,
    finalMargin: { p10: q(0.1), p50: q(0.5), p90: q(0.9) },
    strengthPosterior: post, timeLeftSeconds: ts.secLeft, overtimeNow: ts.overtime };
}

function gamma3(r) { // mean-1 gamma(shape 3) possession duration multiplier
  return -(Math.log(1 - r()) + Math.log(1 - r()) + Math.log(1 - r())) / 3;
}

/** Closed-form OU normal approximation. Fast; used as a baseline and for quick screening. */
export function analyticLive(state, prior, params = DEFAULT_LIVE_PARAMS) {
  const p = { ...DEFAULT_LIVE_PARAMS, ...params };
  const ts = timeState(state);
  if (!ts) return { available: false, why: 'Period or clock invalid' };
  const m = state.homeScore - state.awayScore;
  const tau = ts.secLeft / REG_SECONDS; // fraction of 48 min remaining (OT uses its own clock)
  const post = posterior(prior, m, ts.elapsedFrac, { s0: p.aS0, sigmaRef: p.sigmaRef });
  const k = Math.max(1e-6, p.aKappa);
  const e = Math.exp(-k * tau);
  const mean = m * e + (post.mean / k) * (1 - e);
  const lateBoost = 1 + p.aLate * Math.exp(-ts.secLeft / 40); // end-game fouling/possession speed-up
  const varNoise = (p.aSigma * p.aSigma / (2 * k)) * (1 - Math.exp(-2 * k * tau)) * lateBoost * lateBoost;
  const varRate = post.sd * post.sd * ((1 - e) / k) ** 2;
  const sdTot = Math.sqrt(varNoise + varRate);
  if (sdTot < 1e-9) return { available: true, engine: 'analytic-ou', homeProbability: m > 0 ? 1 : m < 0 ? 0 : 0.5 };
  const pWin = 1 - normCdf((0.5 - mean) / sdTot);
  const pTie = normCdf((0.5 - mean) / sdTot) - normCdf((-0.5 - mean) / sdTot);
  const otEdge = normCdf((post.mean * OT_SECONDS / REG_SECONDS) / (p.aSigma * Math.sqrt(OT_SECONDS / REG_SECONDS)));
  return { available: true, engine: 'analytic-ou', homeProbability: Math.min(1, Math.max(0, pWin + pTie * otEdge)), mean, sd: sdTot };
}

/**
 * Post-hoc calibration of the simulator (fitted on training seasons only):
 * logit(p') = c0 + c1*logit(p) + c2*logit(p)*sqrt(timeFraction)
 */
export function calibrateLive(p, secLeft, coef) {
  if (!coef) return p;
  const q = Math.min(0.999, Math.max(0.001, p));
  const l = Math.log(q / (1 - q)), t = Math.sqrt(Math.max(0, secLeft) / REG_SECONDS);
  const z = coef[0] + coef[1] * l + coef[2] * l * t;
  return 1 / (1 + Math.exp(-z));
}

/** Legacy v0.1 score/clock/record baseline, kept for comparison only. */
export function legacyBaseline(state, recordStrength) {
  const ts = timeState(state);
  if (!ts) return null;
  const remainingMinutes = ts.secLeft / 60;
  const possessionsLeft = Math.max(0.1, remainingMinutes * 100 / 48);
  const d = state.homeScore - state.awayScore;
  const implied = d + recordStrength * 0.20 * possessionsLeft;
  return Math.min(0.995, Math.max(0.005, normCdf(implied / (1.85 * Math.sqrt(possessionsLeft)))));
}
