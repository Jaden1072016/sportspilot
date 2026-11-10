import { jsonResponse, errorResponse } from '../../lib/http.mjs';
import { vapidKeys } from '../../lib/scan.mjs';
export default async () => {
  try { const k = await vapidKeys(); return jsonResponse({ ok: true, publicKey: k.publicKey }); }
  catch (e) { return errorResponse(e, 'push setup'); }
};
