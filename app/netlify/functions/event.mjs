import { fetchJSON, jsonResponse, errorResponse } from '../../lib/http.mjs';
import { requireAllowedSlug } from '../../lib/utils.mjs';
import { eventURL, normalizeEventDetail } from '../../lib/market.mjs';
export default async (request) => {
  try {
    const slug = requireAllowedSlug(new URL(request.url).searchParams.get('slug'));
    const { data, fetchedAt, cached } = await fetchJSON(eventURL(slug), { ttlMs: 30_000 });
    return jsonResponse({ ...normalizeEventDetail(data, fetchedAt), cached });
  } catch (e) { return errorResponse(e, 'Polymarket US event'); }
};
