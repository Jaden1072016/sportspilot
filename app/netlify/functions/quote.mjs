import {fetchJSON,jsonResponse,errorResponse} from '../../lib/http.mjs';
import {requireAllowedSlug} from '../../lib/utils.mjs';
import {quoteURL,normalizeBBO} from '../../lib/market.mjs';
export default async request => {
  try {
    const slug=requireAllowedSlug(new URL(request.url).searchParams.get('slug'));
    const {data,fetchedAt}=await fetchJSON(quoteURL(slug));
    return jsonResponse(normalizeBBO(data,slug,fetchedAt));
  }catch(e){return errorResponse(e,'Polymarket US BBO');}
};
