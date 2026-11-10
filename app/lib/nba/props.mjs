// Player stat projections (points, rebounds, assists, threes) as count distributions.
// As-of only: built from games before the one being projected. No market prices.
//
// Mean = expected minutes x recent per-minute rate x matchup factors (pace, opponent defense
// for points). Spread = negative binomial with a dispersion fitted per stat on past seasons,
// so "8 rebounds expected" does not turn into "6+ is near certain".

export const PROP_STATS = Object.freeze(['points', 'rebounds', 'assists', 'fg3m']);
export const STAT_LABEL = Object.freeze({ points: 'Points', rebounds: 'Rebounds', assists: 'Assists', fg3m: 'Threes' });
export const LADDERS = Object.freeze({ points: [10, 15, 20, 25, 30], rebounds: [4, 6, 8, 10, 12], assists: [2, 4, 6, 8, 10], fg3m: [1, 2, 3, 4, 5] });
export const PROP_DEFAULTS = Object.freeze({ alphaMin: 0.15, alphaRate: 0.08, minGames: 5 });

/** Negative binomial size as a function of the mean: r = r0 * mu^beta (beta=1 gives variance proportional to the mean). */
export const sizeFor = (d, mu) => Math.max(0.3, d.r0 * Math.pow(Math.max(mu, 0.05), d.beta));

export function createPropState(params = PROP_DEFAULTS) { return { params: { ...PROP_DEFAULTS, ...params }, players: new Map() }; }

/** Update with one game's box score rows (only players who actually played move their rates). */
export function updateProps(state, rows, date = null) {
  const { alphaMin, alphaRate } = state.params;
  for (const r of rows) {
    if (r.didNotPlay || !(r.minutes > 0)) continue;
    let p = state.players.get(r.athleteId);
    if (!p) {
      p = { id: r.athleteId, name: r.name, teamId: r.teamId, games: 0, ewMin: r.minutes, rate: {}, lastDate: date };
      for (const s of PROP_STATS) p.rate[s] = r[s] / Math.max(1, r.minutes);
      state.players.set(r.athleteId, p);
    }
    if (p.teamId !== r.teamId) { p.teamId = r.teamId; }
    p.ewMin += alphaMin * (r.minutes - p.ewMin);
    const w = alphaRate * Math.min(1, r.minutes / 20); // short stints barely move per-minute rates
    for (const s of PROP_STATS) p.rate[s] += w * (r[s] / r.minutes - p.rate[s]);
    p.games++; p.name = r.name; p.lastDate = date;
  }
}

/** Expected value of a stat for a player's next game. ctx: { paceFactor, oppDefFactor } (1 = average). */
export function projectedMean(p, stat, ctx = {}) {
  const pace = Number.isFinite(ctx.paceFactor) ? ctx.paceFactor : 1;
  const def = stat === 'points' && Number.isFinite(ctx.oppDefFactor) ? ctx.oppDefFactor : 1;
  const min = Number.isFinite(ctx.minutes) ? ctx.minutes : p.ewMin;
  return Math.max(0.01, p.rate[stat] * min * pace * def);
}

/** P(X >= k) for a negative binomial with mean mu and size r (variance mu + mu^2 / r). */
export function nbAtLeast(k, mu, r) {
  if (k <= 0) return 1;
  const q = mu / (r + mu);
  let pk = Math.pow(r / (r + mu), r), cdf = 0;
  for (let i = 0; i < k; i++) { cdf += pk; pk *= (i + r) / (i + 1) * q; }
  return Math.max(0, Math.min(1, 1 - cdf));
}
export function nbLogPmf(x, mu, r) {
  return lgamma(x + r) - lgamma(r) - lgamma(x + 1) + r * Math.log(r / (r + mu)) + x * Math.log(mu / (r + mu));
}
function lgamma(z) { // Lanczos
  const g = 7, c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - lgamma(1 - z);
  z -= 1; let x = c[0]; for (let i = 1; i < g + 2; i++) x += c[i] / (z + i);
  const t = z + g + 0.5; return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

/** Full projection card for one player. */
export function projectPlayer(p, ctx, dispersion) {
  const out = { id: p.id, name: p.name, teamId: p.teamId, minutes: Number.isFinite(ctx.minutes) ? ctx.minutes : p.ewMin, games: p.games, stats: {} };
  for (const s of PROP_STATS) {
    const mu = projectedMean(p, s, ctx), r = sizeFor(dispersion[s], mu);
    out.stats[s] = { mean: mu, ladder: LADDERS[s].map(k => ({ line: k, p: nbAtLeast(k, mu, r) })) };
  }
  return out;
}
