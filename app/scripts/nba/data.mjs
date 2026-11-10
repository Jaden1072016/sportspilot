// Snapshot loaders for offline training/validation. Reads ../data/snapshot CSVs.
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
export const SNAPSHOT = resolve(PROJECT_ROOT, 'data/snapshot');

export function readCsv(name) {
  const path = resolve(SNAPSHOT, name);
  if (!existsSync(path)) throw new Error(`Missing ${path}. Run: python3 pipeline/ingest_hoopr.py --download`);
  const text = readFileSync(path, 'utf8').trimEnd().split('\n');
  const head = text[0].split(',');
  return text.slice(1).map(line => {
    const cells = line.split(',');
    const o = {};
    for (let i = 0; i < head.length; i++) o[head[i]] = cells[i];
    return o;
  });
}

export function loadGames() {
  return readCsv('games.csv').map(r => ({
    gameId: +r.game_id, season: +r.season, seasonType: +r.season_type, date: r.date, tipUtc: r.tip_utc,
    homeId: +r.home_id, awayId: +r.away_id, homeAbbr: r.home_abbr, awayAbbr: r.away_abbr,
    homeScore: +r.home_score, awayScore: +r.away_score, neutral: r.neutral === '1',
    homePoss: r.home_poss === '' ? NaN : +r.home_poss, awayPoss: r.away_poss === '' ? NaN : +r.away_poss,
  })).sort((a, b) => (a.tipUtc < b.tipUtc ? -1 : a.tipUtc > b.tipUtc ? 1 : a.gameId - b.gameId));
}

export function loadPlayersByGame() {
  const by = new Map();
  for (const r of readCsv('players.csv')) {
    const row = { gameId: +r.game_id, teamId: +r.team_id, athleteId: +r.athlete_id, name: r.name, minutes: +r.minutes, points: +r.points,
      rebounds: +r.rebounds, oreb: +r.oreb, assists: +r.assists, fg3m: +r.fg3m, fg3a: +r.fg3a, fgm: +r.fgm, fga: +r.fga, ftm: +r.ftm, fta: +r.fta,
      steals: +r.steals, blocks: +r.blocks, turnovers: +r.turnovers, fouls: +r.fouls, starter: r.starter === '1', didNotPlay: r.did_not_play === '1', pos: r.pos };
    if (!by.has(row.gameId)) by.set(row.gameId, []);
    by.get(row.gameId).push(row);
  }
  return by;
}

/** COMPARISON ONLY. Never pass into a feature builder. */
export function loadMarketBaseline() {
  const m = new Map();
  for (const r of readCsv('market_baseline.csv')) m.set(+r.game_id, +r.home_spread_line);
  return m;
}

export function loadManifest() { return JSON.parse(readFileSync(resolve(SNAPSHOT, 'manifest.json'), 'utf8')); }
