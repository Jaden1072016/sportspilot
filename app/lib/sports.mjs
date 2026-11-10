import { safeNumber, isoNow } from './utils.mjs';
const LEAGUES = { nba: 'basketball/nba', nfl: 'football/nfl', mlb: 'baseball/mlb' };
export function validatedLeague(input) {
  const league = String(input || 'nba').toLowerCase();
  if (!LEAGUES[league]) throw new Error('Unsupported league');
  return league;
}
export function validatedDate(input) {
  if (input == null || input === '') return null;
  if (!/^\d{8}$/.test(String(input))) throw new Error('Invalid date (YYYYMMDD)');
  return String(input);
}
export function scoreboardURL(league, date = null) {
  const base = `https://site.api.espn.com/apis/site/v2/sports/${LEAGUES[validatedLeague(league)]}/scoreboard`;
  return date ? `${base}?dates=${validatedDate(date)}` : base;
}
export function summaryURL(league, eventId) { return `https://site.api.espn.com/apis/site/v2/sports/${LEAGUES[validatedLeague(league)]}/summary?event=${encodeURIComponent(eventId)}`; }

/**
 * Parse an ESPN display clock into seconds. ESPN uses "M:SS" normally and "SS.s" in the
 * final minute (e.g. "34.5", "0.0"). Returns null when unparseable.
 */
export function clockToSeconds(clock) {
  if (typeof clock !== 'string') return null;
  const s = clock.trim();
  let m = /^(\d{1,2}):(\d{2})(?:\.(\d+))?$/.exec(s);
  if (m) { if (+m[2] >= 60) return null; return +m[1] * 60 + +m[2] + (m[3] ? +`0.${m[3]}` : 0); }
  m = /^(\d{1,2})(?:\.(\d+))?$/.exec(s);
  if (m) { const v = +m[1] + (m[2] ? +`0.${m[2]}` : 0); return v < 60 ? v : null; }
  return null;
}

export function parseRecord(raw) {
  if (!raw) return null;
  const item = (Array.isArray(raw) ? raw : []).find(v => v.type === 'total' || v.name === 'overall') || (Array.isArray(raw) ? raw[0] : raw);
  const text = item?.summary || item?.displayValue || '';
  const match = /^(\d+)\s*-\s*(\d+)/.exec(String(text));
  if (!match) return null;
  const w = +match[1], l = +match[2]; return w + l ? { wins: w, losses: l, pct: w / (w + l) } : null;
}

export function normalizeScoreboard(raw, league = 'nba', fetchedAt = isoNow()) {
  if (!raw || !Array.isArray(raw.events)) throw new Error('ESPN scoreboard schema mismatch');
  const games = [];
  const warnings = ['Unofficial ESPN endpoint; provider access or format may change', 'Scores may be delayed; do not use as execution-time price'];
  for (const e of raw.events) {
    const competition = e.competitions?.[0] || {};
    const sides = (competition.competitors || []);
    const home = sides.find(s => s.homeAway === 'home'), away = sides.find(s => s.homeAway === 'away');
    if (!home || !away || !home.team?.id || !away.team?.id) { warnings.push(`Event ${e.id}: missing home/away team identity; skipped`); continue; }
    const team = (c) => ({ name: c.team?.displayName || c.team?.name || 'Unknown', abbr: c.team?.abbreviation || '???', id: String(c.team.id), score: safeNumber(c.score), record: parseRecord(c.records), logo: null });
    const status = e.status || competition.status || {};
    const state = status.type?.state || 'pre';
    const clock = status.displayClock ?? null;
    const sit = competition.situation || null;
    const possTeam = sit?.possession != null ? String(sit.possession) : null;
    games.push({ id: String(e.id), league, name: e.name || '', startTime: e.date || null, status: state,
      statusName: status.type?.name || null, completed: Boolean(status.type?.completed),
      statusText: status.type?.shortDetail || status.type?.detail || 'Scheduled', period: safeNumber(status.period), clock, clockSeconds: clockToSeconds(clock),
      neutralSite: Boolean(competition.neutralSite),
      possession: possTeam ? (possTeam === String(home.team.id) ? 'home' : possTeam === String(away.team.id) ? 'away' : null) : null,
      home: team(home), away: team(away), updatedAt: fetchedAt });
  }
  return { ok: true, source: 'ESPN unofficial (undocumented)', league, fetchedAt, games, liveData: true, warnings };
}

function parseBoxscorePlayers(raw) {
  const teams = raw?.boxscore?.players;
  if (!Array.isArray(teams)) return [];
  const out = [];
  for (const team of teams) for (const cat of (team.statistics || [])) {
    const labels = cat.labels || cat.names || [];
    for (const a of (cat.athletes || [])) {
      const stats = Object.fromEntries((a.stats || []).map((v, i) => [String(labels[i] || `stat${i}`), String(v)]));
      out.push({ name: a.athlete?.displayName || 'Unknown', team: team.team?.abbreviation || '?', teamId: team.team?.id ? String(team.team.id) : null, athleteId: String(a.athlete?.id || ''), starter: Boolean(a.starter), didNotPlay: Boolean(a.didNotPlay), stats });
    }
  }
  return out;
}

/** Injuries block of an ESPN summary, if present. Unverified source: absent => null (unknown), never "healthy". */
export function parseInjuries(raw) {
  const blocks = raw?.injuries;
  if (!Array.isArray(blocks)) return null;
  const out = [];
  for (const b of blocks) for (const i of (b.injuries || [])) {
    const id = i.athlete?.id; if (!id) continue;
    out.push({ teamId: b.team?.id ? String(b.team.id) : null, athleteId: String(id), name: i.athlete?.displayName || 'Unknown', status: String(i.status || i.type?.description || 'UNKNOWN'), detail: i.details?.detail || i.shortComment || null, date: i.date || null });
  }
  return out;
}

export function normalizeSummary(raw, league, id, fetchedAt = isoNow()) {
  if (!raw || typeof raw !== 'object') throw new Error('Game summary schema mismatch');
  const header = raw.header?.competitions?.[0];
  const clock = header?.status?.displayClock ?? null;
  return { ok: true, source: 'ESPN unofficial (undocumented)', league, eventId: id, fetchedAt, liveData: true, players: parseBoxscorePlayers(raw),
    injuries: parseInjuries(raw),
    situation: { details: header?.status?.type?.detail || null, period: header?.status?.period ?? null, clock, clockSeconds: clockToSeconds(clock) },
    warnings: ['These player stats describe box scores only; they are not verified forward player-prop projections.', 'Starting status is only as accurate as the provider. On-court lineup state is not verified by this adapter.', 'Injury entries come from an unofficial feed and may be incomplete or late.'] };
}

export const injuriesURL = (league) => `https://site.api.espn.com/apis/site/v2/sports/${LEAGUES[validatedLeague(league)]}/injuries`;
/**
 * League-wide injury report (ESPN, unofficial). Statuses seen live: "Out", "Day-To-Day".
 * Athlete ids come from the player-card link (/id/<n>/), which matches ESPN box-score ids.
 */
export function normalizeInjuries(raw, fetchedAt = isoNow()) {
  if (!raw || !Array.isArray(raw.injuries)) throw new Error('ESPN injuries schema mismatch');
  const players = [];
  for (const t of raw.injuries) for (const i of (t.injuries || [])) {
    const href = (i.athlete?.links || []).map(l => l.href || '').find(h => /\/id\/\d+/.test(h)) || '';
    const id = (/\/id\/(\d+)/.exec(href) || [])[1];
    if (!id) continue;
    players.push({ teamId: String(i.athlete?.team?.id ?? t.id ?? ''), athleteId: id, name: i.athlete?.displayName || 'Unknown', status: String(i.status || i.type?.description || 'Unknown'),
      out: /^out$/i.test(String(i.status || '')) || i.type?.name === 'INJURY_STATUS_OUT', detail: i.shortComment || null, returnDate: i.details?.returnDate || null, updated: i.date || null });
  }
  return { ok: true, source: 'ESPN injuries (unofficial)', fetchedAt, players, liveData: true, warnings: ['Unofficial feed; late scratches and game-time decisions may be missing.'] };
}
