import { fetchJSON, jsonResponse, errorResponse } from '../../lib/http.mjs';
import { validatedLeague, injuriesURL, normalizeInjuries } from '../../lib/sports.mjs';
export default async (request) => {
  try {
    const league = validatedLeague(new URL(request.url).searchParams.get('league'));
    const { data, fetchedAt, cached } = await fetchJSON(injuriesURL(league), { ttlMs: 300_000 });
    return jsonResponse({ ...normalizeInjuries(data, fetchedAt), cached });
  } catch (e) { return errorResponse(e, 'ESPN injuries'); }
};
