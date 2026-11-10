// Player availability / rotation value tracker (as-of). Measures how much of a team's
// established rotation value is missing from a game. Box-score based; no market data.
//
// Player value per minute uses Hollinger Game Score (a public box-score formula):
//   GS = PTS + 0.4 FGM - 0.7 FGA - 0.4 (FTA - FTM) + 0.7 ORB + 0.3 DRB + STL + 0.7 AST + 0.7 BLK - 0.4 PF - TOV
// It is a crude value proxy. It does not measure defense well. Treat output as an
// availability signal, not a player rating.

export const AVAIL_PARAMS = Object.freeze({ alpha: 0.12, replacementPerMin: 0.16, regularMinutes: 14, lookbackTeamGames: 10, minAppearances: 3 });

export function gameScore(p) {
  return p.points + 0.4 * p.fgm - 0.7 * p.fga - 0.4 * (p.fta - p.ftm) + 0.7 * p.oreb + 0.3 * (p.rebounds - p.oreb)
    + p.steals + 0.7 * p.assists + 0.7 * p.blocks - 0.4 * p.fouls - p.turnovers;
}

export function createAvailabilityState(params = AVAIL_PARAMS) {
  return { params: { ...AVAIL_PARAMS, ...params }, players: new Map(), teamGames: new Map() };
}

function valueOf(pl, params) {
  return Math.max(0, pl.ewMin * (pl.ewGsPerMin - params.replacementPerMin));
}

/** Players regarded as part of a team's current rotation before this game. */
export function rotation(state, teamId) {
  const recent = state.teamGames.get(teamId) || [];
  const window = new Set(recent.slice(-state.params.lookbackTeamGames));
  const out = [];
  for (const pl of state.players.values()) {
    if (pl.teamId !== teamId || pl.appearances < state.params.minAppearances) continue;
    if (!window.has(pl.lastGameId)) continue;
    if (pl.ewMin < state.params.regularMinutes) continue;
    out.push({ id: pl.id, name: pl.name, ewMin: pl.ewMin, gsPerMin: pl.ewGsPerMin, value: valueOf(pl, state.params) });
  }
  return out.sort((a, b) => b.value - a.value);
}

/**
 * Pre-game: given the set of athlete ids who will play (or are confirmed available),
 * return missing rotation value. In historical validation the set comes from the box
 * score of the game (i.e. lineup-confirmed scenario). Live, it must come from a verified
 * injury/inactive report; if unknown, pass null and the result is {known:false}.
 */
export function missingValue(state, teamId, availableIds) {
  const rot = rotation(state, teamId);
  const total = rot.reduce((s, p) => s + p.value, 0);
  if (availableIds == null) return { known: false, total, missing: null, missingShare: null, missingPlayers: [], rotationSize: rot.length };
  const missingPlayers = rot.filter(p => !availableIds.has(p.id));
  const missing = missingPlayers.reduce((s, p) => s + p.value, 0);
  return { known: true, total, missing, missingShare: total > 0 ? missing / total : 0, missingPlayers, rotationSize: rot.length };
}

/** Update after a game with the player box score rows for both teams. */
export function updateAvailability(state, gameId, rows) {
  const a = state.params.alpha;
  const teams = new Set();
  for (const r of rows) {
    teams.add(r.teamId);
    if (r.didNotPlay || !(r.minutes > 0)) continue;
    let pl = state.players.get(r.athleteId);
    if (!pl) { pl = { id: r.athleteId, name: r.name, teamId: r.teamId, ewMin: r.minutes, ewGsPerMin: gameScore(r) / Math.max(1, r.minutes), appearances: 0, lastGameId: null }; state.players.set(r.athleteId, pl); }
    if (pl.teamId !== r.teamId) { pl.teamId = r.teamId; pl.appearances = 0; } // traded/signed: rebuild role with new team
    pl.ewMin += a * (r.minutes - pl.ewMin);
    const w = a * Math.min(1, r.minutes / 24); // short stints move per-minute value less
    pl.ewGsPerMin += w * (gameScore(r) / Math.max(1, r.minutes) - pl.ewGsPerMin);
    pl.appearances++; pl.lastGameId = gameId; pl.name = r.name;
  }
  for (const t of teams) { const list = state.teamGames.get(t) || []; list.push(gameId); if (list.length > 40) list.shift(); state.teamGames.set(t, list); }
}
