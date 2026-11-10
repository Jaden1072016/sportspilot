import { fetchJSON, jsonResponse, errorResponse } from '../../lib/http.mjs';
import { validatedLeague, validatedDate, scoreboardURL, normalizeScoreboard } from '../../lib/sports.mjs';
export default async (request) => {
  try {
    const q = new URL(request.url).searchParams;
    const league = validatedLeague(q.get('league'));
    const date = validatedDate(q.get('date'));
    const { data, fetchedAt, cached } = await fetchJSON(scoreboardURL(league, date), { ttlMs: date ? 300_000 : 10_000 });
    return jsonResponse({ ...normalizeScoreboard(data, league, fetchedAt), cached });
  } catch (e) { return errorResponse(e, 'ESPN unofficial'); }
};
