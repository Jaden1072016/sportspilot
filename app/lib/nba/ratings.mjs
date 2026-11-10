// NBA team-strength engine. Sequential, as-of: a game's prediction only ever uses games
// that finished earlier. Inputs are scores and box-score possessions; never market prices.
//
// Margin rating r: points better than an average team on a neutral floor.
// Off/Def ratings: points per 100 possessions relative to league average (def: allowed).
// Pace rating: possessions per game relative to league average.

export const DEFAULT_RATING_PARAMS = Object.freeze({
  k: 0.06,          // margin rating learning rate per game
  cap: 24,          // clip on margin residual so blowouts do not dominate
  carry: 0.7,       // fraction of rating kept across seasons (regression to mean)
  hcaInit: 3.0,     // starting home-court edge, points
  kHca: 0.002,      // slow learning of league home-court edge (it fell after 2020)
  kEff: 0.04,       // off/def learning rate
  kPace: 0.05,      // pace learning rate
  kLeague: 0.004,   // league-average drift (efficiency, pace)
});

export function createRatingState(params = DEFAULT_RATING_PARAMS) {
  return { params: { ...DEFAULT_RATING_PARAMS, ...params }, season: null, hca: params.hcaInit ?? DEFAULT_RATING_PARAMS.hcaInit,
    leagueOrtg: 108, leaguePace: 97, teams: new Map(), lastGameDate: null, gamesProcessed: 0 };
}

function team(state, id) {
  let t = state.teams.get(id);
  if (!t) { t = { id, r: 0, off: 0, def: 0, pace: 0, games: 0, seasonGames: 0, lastDate: null, abbr: null }; state.teams.set(id, t); }
  return t;
}

function daysBetween(a, b) {
  if (!a || !b) return null;
  return Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
}

function rollSeason(state, season) {
  if (state.season === season) return;
  if (state.season !== null) {
    for (const t of state.teams.values()) { t.r *= state.params.carry; t.off *= state.params.carry; t.def *= state.params.carry; t.pace *= state.params.carry; t.seasonGames = 0; }
  }
  state.season = season;
}

/** Pure read of the pre-game state for a matchup. Does not mutate ratings except season rollover. */
export function preGame(state, g) {
  rollSeason(state, g.season);
  const h = team(state, g.homeId), a = team(state, g.awayId);
  const hca = g.neutral ? 0 : state.hca;
  const restH = daysBetween(h.lastDate, g.date), restA = daysBetween(a.lastDate, g.date);
  const pace = state.leaguePace + h.pace + a.pace;
  const homeOrtg = state.leagueOrtg + h.off + a.def + hca / 2 * (100 / pace);
  const awayOrtg = state.leagueOrtg + a.off + h.def - hca / 2 * (100 / pace);
  return {
    ratingMargin: h.r - a.r + hca,
    rHome: h.r, rAway: a.r, hca,
    restHome: restH, restAway: restA,
    expPace: pace,
    expHomePts: homeOrtg * pace / 100, expAwayPts: awayOrtg * pace / 100,
    homeGames: h.seasonGames, awayGames: a.seasonGames,
  };
}

/** Update ratings with a completed game's result. */
export function postGame(state, g, pre = preGame(state, g)) {
  const p = state.params;
  const h = team(state, g.homeId), a = team(state, g.awayId);
  const margin = g.homeScore - g.awayScore;
  const err = Math.max(-p.cap, Math.min(p.cap, margin - pre.ratingMargin));
  h.r += p.k * err; a.r -= p.k * err;
  if (!g.neutral) state.hca += p.kHca * err;
  const poss = Number.isFinite(g.homePoss) && Number.isFinite(g.awayPoss) ? (g.homePoss + g.awayPoss) / 2 : null;
  if (poss && poss > 70 && poss < 140) {
    const ho = 100 * g.homeScore / poss, ao = 100 * g.awayScore / poss;
    const eh = state.leagueOrtg + h.off + a.def, ea = state.leagueOrtg + a.off + h.def;
    const rh = Math.max(-25, Math.min(25, ho - eh)), ra = Math.max(-25, Math.min(25, ao - ea));
    h.off += p.kEff * rh; a.def += p.kEff * rh; a.off += p.kEff * ra; h.def += p.kEff * ra;
    const pe = poss - pre.expPace;
    h.pace += p.kPace * pe / 2; a.pace += p.kPace * pe / 2;
    state.leagueOrtg += p.kLeague * ((ho + ao) / 2 - state.leagueOrtg);
    state.leaguePace += p.kLeague * (poss - state.leaguePace);
  }
  h.games++; a.games++; h.seasonGames++; a.seasonGames++;
  h.lastDate = g.date; a.lastDate = g.date;
  if (g.homeAbbr) h.abbr = g.homeAbbr; if (g.awayAbbr) a.abbr = g.awayAbbr;
  state.lastGameDate = g.date; state.gamesProcessed++;
}

/** Serializable snapshot used by the deployed app (ratings as of the last processed game). */
export function snapshotRatings(state) {
  return {
    season: state.season, asOfDate: state.lastGameDate, gamesProcessed: state.gamesProcessed,
    hca: state.hca, leagueOrtg: state.leagueOrtg, leaguePace: state.leaguePace, params: state.params,
    teams: [...state.teams.values()].map(t => ({ id: t.id, abbr: t.abbr, r: +t.r.toFixed(3), off: +t.off.toFixed(3), def: +t.def.toFixed(3), pace: +t.pace.toFixed(3), seasonGames: t.seasonGames, lastDate: t.lastDate })),
  };
}

export function restoreRatings(snap) {
  const s = createRatingState(snap.params);
  Object.assign(s, { season: snap.season, hca: snap.hca, leagueOrtg: snap.leagueOrtg, leaguePace: snap.leaguePace, lastGameDate: snap.asOfDate, gamesProcessed: snap.gamesProcessed });
  for (const t of snap.teams) s.teams.set(t.id, { ...t, games: t.seasonGames });
  return s;
}
