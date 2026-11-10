import { jsonResponse, errorResponse } from '../../lib/http.mjs';
import { runScan, scanStatus } from '../../lib/scan.mjs';
// GET: last scan status. POST: run a scan now (throttled to once a minute; safe to expose).
export default async (request) => {
  try {
    // ?dry=1 runs the full check (ignoring game hours) but never sends alerts or changes state.
    const dry = new URL(request.url).searchParams.get('dry') === '1';
    if (request.method === 'POST') return jsonResponse({ ok: true, result: dry ? await runScan({ dry: true, force: true }) : await runScan() });
    return jsonResponse({ ok: true, status: await scanStatus() });
  } catch (e) { return errorResponse(e, 'scan'); }
};
