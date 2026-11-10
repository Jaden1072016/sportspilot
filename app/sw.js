const VERSION = 'sportspilot-shell-v0.4.0';
// App shell + model files only. Scores, prices and every /api/ response are NEVER cached,
// so an offline app can never show an old price as if it were current.
const STATIC = ['/', '/index.html', '/styles.css', '/app.js', '/manifest.webmanifest', '/assets/icon-192.png', '/assets/icon-512.png',
  '/lib/stats.mjs', '/lib/utils.mjs', '/lib/value.mjs', '/lib/market.mjs', '/lib/nba/predict.mjs', '/lib/nba/ratings.mjs', '/lib/nba/pregame.mjs', '/lib/nba/live.mjs',
  '/models/nba-pregame.json', '/models/nba-live.json', '/models/nba-props.json', '/lib/nba/props.mjs', '/lib/alerts.mjs'];
self.addEventListener('install', event => event.waitUntil(caches.open(VERSION).then(cache => cache.addAll(STATIC)).then(() => self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', event => {
  const u = new URL(event.request.url);
  if (u.origin !== location.origin || u.pathname.startsWith('/api/') || u.pathname.startsWith('/.netlify/')) return;
  if (event.request.method !== 'GET') return;
  // Network first; cache is only an offline fallback for the shell and model files.
  event.respondWith(fetch(event.request).then(r => { if (r.ok) { const c = r.clone(); caches.open(VERSION).then(cache => cache.put(event.request, c)); } return r; }).catch(() => caches.match(event.request)));
});
// Background alerts (research notices). Payload: {title, body, url, tag}.
self.addEventListener('push', event => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch { d = { title: 'SportsPilot', body: event.data ? event.data.text() : '' }; }
  event.waitUntil(self.registration.showNotification(d.title || 'SportsPilot', { body: d.body || '', tag: d.tag || undefined, icon: '/assets/icon-192.png', badge: '/assets/icon-192.png', data: { url: d.url || '/' } }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) if ('focus' in c) { c.navigate(url).catch(() => {}); return c.focus(); }
    return self.clients.openWindow(url);
  }));
});
