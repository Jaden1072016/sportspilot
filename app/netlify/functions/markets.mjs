import { fetchJSON, jsonResponse, errorResponse } from '../../lib/http.mjs';
import { validatedLeague } from '../../lib/sports.mjs';
import { marketListURL, eventsFallbackURL, normalizeEvents } from '../../lib/market.mjs';
// Primary: documented league-events route. Fallback: SDK-documented /v1/events filter.
// Which one the live gateway serves must be confirmed with `npm run verify:live`.
export default async request => {
  let league;
  try {
    league = validatedLeague(new URL(request.url).searchParams.get('league'));
    const { data, fetchedAt } = await fetchJSON(marketListURL(league), { ttlMs: 30_000 });
    return jsonResponse(normalizeEvents(data, league, fetchedAt, 'v2/leagues'));
  } catch (primary) {
    if (!league) return errorResponse(primary, 'Polymarket US public');
    try {
      const { data, fetchedAt } = await fetchJSON(eventsFallbackURL(league), { ttlMs: 30_000 });
      const out = normalizeEvents(data, league, fetchedAt, 'v1/events');
      out.warnings.push(`Primary league route failed (${primary.message}); using /v1/events fallback.`);
      return jsonResponse(out);
    } catch (e) { return errorResponse(e, 'Polymarket US public'); }
  }
};
