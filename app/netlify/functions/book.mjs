import { fetchJSON, jsonResponse, errorResponse } from '../../lib/http.mjs';
import { requireAllowedSlug } from '../../lib/utils.mjs';
import { bookURL, normalizeBook } from '../../lib/market.mjs';
// Never cached: execution-relevant prices must be fresh.
export default async request => {
  try {
    const slug = requireAllowedSlug(new URL(request.url).searchParams.get('slug'));
    const { data, fetchedAt } = await fetchJSON(bookURL(slug), { ttlMs: 0, retries: 1 });
    return jsonResponse(normalizeBook(data, slug, fetchedAt));
  } catch (e) { return errorResponse(e, 'Polymarket US order book'); }
};
