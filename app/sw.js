const VERSION = 'sportspilot-shell-v0.2.0';
// App shell + model files only. Scores, prices and every /api/ response are NEVER cached,
// so an offline app can never show an old price as if it were current.
const STATIC = ['/', '/index.html', '/styles.css', '/app.js', '/manifest.webmanifest', '/assets/icon-192.png', '/assets/icon-512.png',
  '/lib/stats.mjs', '/lib/utils.mjs', '/lib/value.mjs', '/lib/market.mjs', '/lib/nba/predict.mjs', '/lib/nba/ratings.mjs', '/lib/nba/pregame.mjs', '/lib/nba/live.mjs',
  '/models/nba-pregame.json', '/models/nba-live.json'];
self.addEventListener('install', event => event.waitUntil(caches.open(VERSION).then(cache => cache.addAll(STATIC)).then(() => self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', event => {
  const u = new URL(event.request.url);
  if (u.origin !== location.origin || u.pathname.startsWith('/api/') || u.pathname.startsWith('/.netlify/')) return;
  if (event.request.method !== 'GET') return;
  // Network first; cache is only an offline fallback for the shell and model files.
  event.respondWith(fetch(event.request).then(r => { if (r.ok) { const c = r.clone(); caches.open(VERSION).then(cache => cache.put(event.request, c)); } return r; }).catch(() => caches.match(event.request)));
});
// Push handlers are intentionally absent until background push is built and verified end to end.
