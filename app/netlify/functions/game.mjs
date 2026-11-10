import { fetchJSON, jsonResponse, errorResponse } from '../../lib/http.mjs';
import { validatedLeague, summaryURL, normalizeSummary } from '../../lib/sports.mjs';
import { requireAllowedId } from '../../lib/utils.mjs';
export default async (request) => {
  try {
    const search = new URL(request.url).searchParams;
    const league = validatedLeague(search.get('league'));
    const id = requireAllowedId(search.get('id'));
    const { data, fetchedAt, cached } = await fetchJSON(summaryURL(league, id), { ttlMs: 15_000 });
    return jsonResponse({ ...normalizeSummary(data, league, id, fetchedAt), cached });
  } catch (e) { return errorResponse(e, 'ESPN game summary'); }
};
