import { runScan } from '../../lib/scan.mjs';
// Netlify scheduled function. Every 2 minutes; runScan itself skips outside game hours.
export default async () => {
  try { const r = await runScan(); console.log('scan', JSON.stringify(r)); }
  catch (e) { console.error('scan failed', e?.message || e); }
  return new Response('ok');
};
export const config = { schedule: '*/2 * * * *' };
