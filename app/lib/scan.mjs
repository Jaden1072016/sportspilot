// Server-only background scanner + web push. Runs in Netlify Functions.
// Storage: Netlify Blobs (free). Keys: VAPID keys are generated once and kept in the store,
// so no secrets live in code or environment variables.
import * as webpush from 'web-push';
import { getStore } from '@netlify/blobs';
import { fetchJSON } from './http.mjs';
import { scoreboardURL, normalizeScoreboard, injuriesURL, normalizeInjuries } from './sports.mjs';
import { createPredictor } from './nba/predict.mjs';
import { gameFindings, shouldSend, allowedPushEndpoint, inGameWindow } from './alerts.mjs';
import pregameModel from '../models/nba-pregame.json' with { type: 'json' };
import liveModel from '../models/nba-live.json' with { type: 'json' };

const SUBJECT = 'https://github.com/Jaden1072016/sportspilot';
let predictor = null;
export const store = () => getStore({ name: 'sportspilot', consistency: 'strong' });

export async function vapidKeys(s = store()) {
  let k = await s.get('vapid', { type: 'json' });
  if (!k?.publicKey) { k = webpush.generateVAPIDKeys(); await s.setJSON('vapid', k); }
  webpush.setVapidDetails(SUBJECT, k.publicKey, k.privateKey);
  return k;
}

async function subId(endpoint) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(endpoint));
  return [...new Uint8Array(d)].slice(0, 12).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function saveSubscription(sub) {
  if (!sub || typeof sub.endpoint !== 'string' || !allowedPushEndpoint(sub.endpoint) || !sub.keys?.p256dh || !sub.keys?.auth) throw new Error('Invalid push subscription');
  const clean = { endpoint: sub.endpoint, keys: { p256dh: String(sub.keys.p256dh).slice(0, 200), auth: String(sub.keys.auth).slice(0, 100) } };
  const id = await subId(clean.endpoint);
  await store().setJSON(`sub/${id}`, { sub: clean, createdAt: new Date().toISOString() });
  return id;
}
export async function removeSubscription(endpoint) { await store().delete(`sub/${await subId(endpoint)}`); }

async function allSubs(s) {
  const { blobs } = await s.list({ prefix: 'sub/' });
  const out = [];
  for (const b of blobs) { const v = await s.get(b.key, { type: 'json' }); if (v?.sub) out.push({ key: b.key, sub: v.sub }); }
  return out;
}

async function send(s, item, payload) {
  try {
    await webpush.sendNotification(item.sub, JSON.stringify(payload), { TTL: 600, urgency: 'high' });
    return true;
  } catch (e) {
    if (e?.statusCode === 404 || e?.statusCode === 410) await s.delete(item.key); // expired subscription
    return false;
  }
}

export async function sendTest(endpoint) {
  const s = store(); await vapidKeys(s);
  const v = await s.get(`sub/${await subId(endpoint)}`, { type: 'json' });
  if (!v?.sub) throw new Error('This device is not subscribed');
  const ok = await send(s, { key: `sub/${await subId(endpoint)}`, sub: v.sub }, { title: 'SportsPilot test', body: 'Alerts are working on this device.', url: '/#settings', tag: 'test' });
  if (!ok) throw new Error('Push service rejected the test');
  return true;
}

/** One scan: throttled to once a minute, only in game windows unless forced. */
export async function runScan({ force = false, now = Date.now() } = {}) {
  const s = store();
  if (!force && !inGameWindow(new Date(now))) return { ran: false, reason: 'outside game hours' };
  const last = Number(await s.get('scan/last'));
  if (!force && Number.isFinite(last) && now - last < 60_000) return { ran: false, reason: 'throttled' };
  await s.set('scan/last', String(now));
  const { data, fetchedAt } = await fetchJSON(scoreboardURL('nba'), { ttlMs: 0 });
  const games = normalizeScoreboard(data, 'nba', fetchedAt).games;
  const live = games.filter(g => g.status === 'in');
  const summary = { ran: true, at: new Date(now).toISOString(), live: live.length, findings: 0, sent: 0, subscribers: 0 };
  await s.setJSON('scan/status', summary);
  if (!live.length) return summary;
  let out = null;
  try { const inj = normalizeInjuries((await fetchJSON(injuriesURL('nba'), { ttlMs: 300_000 })).data); out = new Set(inj.players.filter(p => p.out).map(p => p.athleteId)); } catch { /* injuries optional */ }
  predictor ||= createPredictor(pregameModel, liveModel);
  const findings = live.flatMap(g => gameFindings(g, predictor.predict(g, { sims: 2000, out }))).filter(f => !f.quiet);
  summary.findings = findings.length;
  if (!findings.length) { await s.setJSON('scan/status', summary); return summary; }
  await vapidKeys(s);
  const subs = await allSubs(s);
  summary.subscribers = subs.length;
  for (const f of findings) {
    const lastSent = Number(await s.get(`sent/${f.key}`));
    if (!shouldSend(lastSent, now)) continue;
    await s.set(`sent/${f.key}`, String(now));
    for (const item of subs) if (await send(s, item, { title: f.title, body: `${f.body} Research notice, not a bet.`, url: '/#live', tag: f.key })) summary.sent++;
  }
  await s.setJSON('scan/status', summary);
  return summary;
}

export async function scanStatus() { return (await store().get('scan/status', { type: 'json' })) || null; }
