import { jsonResponse } from '../../lib/http.mjs';
import { saveSubscription, removeSubscription, sendTest } from '../../lib/scan.mjs';
// POST {subscription} to subscribe, {action:'test', endpoint} to test, {action:'remove', endpoint} to unsubscribe.
export default async (request) => {
  if (request.method !== 'POST') return jsonResponse({ ok: false, error: 'POST only' }, 405);
  try {
    const text = await request.text();
    if (text.length > 4000) throw new Error('Request too large');
    const body = JSON.parse(text || '{}');
    if (body.action === 'test') { await sendTest(String(body.endpoint || '')); return jsonResponse({ ok: true, sent: true }); }
    if (body.action === 'remove') { await removeSubscription(String(body.endpoint || '')); return jsonResponse({ ok: true, removed: true }); }
    const id = await saveSubscription(body.subscription);
    return jsonResponse({ ok: true, id });
  } catch (e) { return jsonResponse({ ok: false, error: String(e.message || e) }, 400); }
};
