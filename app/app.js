import { createPredictor } from './lib/nba/predict.mjs';
import { calculateIndependentParlay, evaluateOpportunity } from './lib/value.mjs';
import { brier, logLoss } from './lib/stats.mjs';
import { executableFill } from './lib/market.mjs';
const PAGE_NAMES = { overview: 'Dashboard', live: 'Live games', players: 'Players', opportunities: 'Compare with Polymarket', parlays: 'Parlay calculator', performance: 'Results', settings: 'Alerts & settings' };
const DEMO_GAMES = [
  { id: '700001', league: 'nba', name: 'Metro Comets at Harbor Waves', status: 'in', statusName: 'STATUS_IN_PROGRESS', statusText: 'Q3 · 06:00', period: 3, clock: '6:00', clockSeconds: 360, startTime: null, home: { id: 'demo-h1', name: 'Harbor Waves', abbr: 'HWV', score: 91, record: { wins: 31, losses: 19, pct: .62 } }, away: { id: 'demo-a1', name: 'Metro Comets', abbr: 'MCO', score: 85, record: { wins: 27, losses: 23, pct: .54 } }, demoPrior: { expMargin48: 2.5, pace: 99, expTotal48: 226 } },
  { id: '700002', league: 'nba', name: 'Summit Foxes at Valley Heat', status: 'in', statusName: 'STATUS_IN_PROGRESS', statusText: 'Q2 · 03:24', period: 2, clock: '3:24', clockSeconds: 204, startTime: null, home: { id: 'demo-h2', name: 'Valley Heat', abbr: 'VHT', score: 54, record: { wins: 23, losses: 27, pct: .46 } }, away: { id: 'demo-a2', name: 'Summit Foxes', abbr: 'SFX', score: 49, record: { wins: 38, losses: 12, pct: .76 } }, demoPrior: { expMargin48: -6, pace: 100, expTotal48: 228 } },
  { id: '700003', league: 'nba', name: 'Coastal Storm at Capital Aces', status: 'pre', statusText: 'Tonight · 8:00 PM', period: 0, clock: null, clockSeconds: null, startTime: null, home: { id: 'demo-h3', name: 'Capital Aces', abbr: 'CAC', score: null }, away: { id: 'demo-a3', name: 'Coastal Storm', abbr: 'CST', score: null }, demoPrior: { expMargin48: 4, pace: 98, expTotal48: 222 } },
];
const DEMO_EVENTS = [{ id: 'sample-event-1', name: 'Harbor Waves vs Metro Comets', live: true, startTime: null, markets: [{ id: 'sample-market-1', slug: 'synthetic-demo-market-not-real', question: 'Will Harbor Waves win?', type: 'MONEYLINE', marketSides: [{ description: 'YES' }] }] }, { id: 'sample-event-2', name: 'Summit Foxes vs Valley Heat', live: true, startTime: null, markets: [{ id: 'sample-market-2', slug: 'synthetic-demo-market-2', question: 'Will Summit Foxes win?', type: 'MONEYLINE', marketSides: [{ description: 'YES' }] }] }];
const FEATURE_LABELS = { ratingMargin: 'Strength gap incl. home edge (pts)', homeB2B: 'Home on back-to-back', awayB2B: 'Away on back-to-back', restAdvantage: 'Rest-day advantage (home)', earlyShrink: 'Early-season discount', availabilityEdge: 'Missing rotation value edge', rosterValueEdge: 'Available rotation value edge' };

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pct = (v, dp = 1) => Number.isFinite(v) ? `${(v * 100).toFixed(dp)}%` : '—';
const dollar = n => Number.isFinite(n) ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n) : '—';
const safeRead = (key, fallback) => { try { const data = JSON.parse(localStorage.getItem(`sportspilot:${key}`)); return data ?? fallback; } catch { return fallback; } };
const DEFAULT_SETTINGS = { min: 3, max: 5, refresh: 30, sound: false, notify: false, stake: 5, sims: 4000, feePct: null, feeVerified: false, minEV: 5, maxQuoteAge: 10, maxSlippageC: 2, researchWatch: false };
const state = {
  page: 'overview', sport: 'nba', mode: 'live', scores: null, markets: null, scoresError: null, marketsError: null, books: {}, selectedGame: null, details: {}, loading: true, lastRefresh: null,
  models: { pregame: null, live: null, error: null }, predictor: null, preds: {}, history: {},
  legs: safeRead('legs', [{ id: 1, label: 'Hypothetical selection A', p: .60, multiplier: 1.50 }, { id: 2, label: 'Hypothetical selection B', p: .50, multiplier: 2.10 }]),
  journal: safeRead('journal', []), links: safeRead('links', {}), predLog: safeRead('predlog', {}),
  settings: { ...DEFAULT_SETTINGS, ...safeRead('settings', {}) }, alerts: [], alertSeen: new Map(), playerTeam: null, playerQuery: '', online: navigator.onLine,
};
let toastTimer = null;
function toast(message) { const t = $('toast'); t.textContent = message; t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => t.hidden = true, 4200); }
const ago = (time) => { const t = Date.parse(time || ''); if (!Number.isFinite(t)) return 'unknown'; const sec = Math.max(0, Math.round((Date.now() - t) / 1000)); return sec < 60 ? `${sec}s ago` : sec < 3600 ? `${Math.round(sec / 60)}m ago` : `${Math.round(sec / 3600)}h ago`; };
function save(key, value) { try { localStorage.setItem(`sportspilot:${key}`, JSON.stringify(value)); } catch { toast('Browser storage is unavailable. Changes may not persist.'); } }
function statusBadge(s) { return `<span class="status-pill ${s === 'in' ? 'live' : ''}">${s === 'in' ? 'LIVE' : s === 'pre' ? 'UPCOMING' : s === 'post' ? 'FINAL' : esc(s || 'N/A')}</span>`; }
const currentGames = () => state.scores?.games || [];
const currentEvents = () => state.markets?.events || [];
const flatMarkets = () => currentEvents().flatMap(e => (e.markets || []).map(m => ({ ...m, eventName: e.name, eventLive: e.live })));
const isDemo = () => state.mode === 'demo';
const nbaTeams = () => (state.models.pregame?.ratings.teams || []).filter(t => t.id >= 1 && t.id <= 30).sort((a, b) => a.abbr.localeCompare(b.abbr));

// ---------- model loading & prediction ----------
async function loadModels() {
  try {
    const [p, l] = await Promise.all(['/models/nba-pregame.json', '/models/nba-live.json'].map(u => fetch(u, { cache: 'no-cache' }).then(r => { if (!r.ok) throw new Error(`${u} HTTP ${r.status}`); return r.json(); })));
    state.models = { pregame: p, live: l, error: null };
    state.predictor = createPredictor(p, l);
  } catch (e) { state.models.error = e.message; }
}
function predictAll() {
  if (!state.predictor) return;
  const now = new Date().toISOString();
  for (const g of currentGames()) {
    if (g.league !== 'nba') continue;
    const r = state.predictor.predict(g, { sims: state.settings.sims, ...(isDemo() ? { syntheticPrior: g.demoPrior } : {}) });
    state.preds[g.id] = r;
    if (r.live.available) {
      const h = state.history[g.id] || (state.history[g.id] = []);
      const label = `${g.period > 4 ? `OT${g.period - 4}` : `Q${g.period}`} ${g.clock || ''}`;
      if (!h.length || h.at(-1).label !== label) { h.push({ t: now, p: r.live.homeProbability, label }); if (h.length > 240) h.shift(); }
    }
    if (!isDemo()) logProspective(g, r);
  }
}
/** Prospective out-of-sample log: freeze the pregame forecast before tip, score it after the final. */
function logProspective(g, r) {
  const k = g.id, rec = state.predLog[k];
  if (!rec && g.status === 'pre' && r.pregame.available) {
    state.predLog[k] = { gameId: k, date: g.startTime, home: g.home.abbr, away: g.away.abbr, p: r.pregame.homeProbability, model: r.pregameModel, loggedAt: new Date().toISOString(), outcome: null };
    save('predlog', state.predLog);
  } else if (rec && rec.outcome === null && g.status === 'post' && Number.isFinite(g.home.score) && Number.isFinite(g.away.score) && g.home.score !== g.away.score) {
    rec.outcome = g.home.score > g.away.score ? 1 : 0; rec.final = `${g.away.abbr} ${g.away.score} - ${g.home.score} ${g.home.abbr}`; save('predlog', state.predLog);
  }
}
const predOf = g => state.preds[g.id];
function headline(g) {
  const r = predOf(g); if (!r) return null;
  if (r.live.available) return { kind: 'live', p: r.live.homeProbability };
  if (r.pregame.available) return { kind: 'pregame', p: r.pregame.homeProbability };
  return null;
}

// ---------- shared render pieces ----------
function renderNotice() {
  if (isDemo()) return `<div class="notice warn"><strong>◈ DEMO MODE</strong> Made-up teams, scores and prices so you can see how the app works. Nothing here is real.</div>`;
  const issues = [];
  if (!state.online) issues.push('You are offline. Scores and prices are never cached, so nothing below is current.');
  if (state.models.error) issues.push(`Model files: ${esc(state.models.error)}`);
  if (state.scoresError) issues.push(`Game feed: ${esc(state.scoresError)}`);
  if (state.marketsError) issues.push(`Market feed: ${esc(state.marketsError)}`);
  if (issues.length) return `<div class="notice warn"><strong>Some data didn't load.</strong> ${issues.join(' · ')} <span class="notice-right">We never fill gaps with made-up data.</span></div>`;
  if (state.loading) return `<div class="notice"><strong>Loading…</strong> Getting scores from ESPN and markets from Polymarket.</div>`;
  return `<div class="notice"><strong>Testing mode.</strong> These are our own predictions, checked against past seasons. Not cleared for real money yet. <span class="notice-right">Scores ${esc(ago(state.scores?.fetchedAt))}</span></div>`;
}
function help(items) { return `<details class="help"><summary>ⓘ What am I looking at?</summary><ul>${items.map(x => `<li>${x}</li>`).join('')}</ul></details>`; }
function sectionHeader(title, sub = '', action = '') { return `<div class="page-title-row"><div><h2>${title}</h2><p>${sub}</p></div>${action}</div>`; }
function statCard(title, value, sub, cls = '', symbol = '◉') { return `<div class="stat-card"><div class="stat-title">${title}<span class="stat-icon">${symbol}</span></div><div class="stat-value">${value}</div><div class="stat-sub ${cls}">${sub}</div></div>`; }
function emptyBlock(title, desc) { return `<div class="empty"><div class="empty-icon">◌</div><h3>${title}</h3><p>${desc}</p></div>`; }
function modelChip(g) {
  const h = headline(g);
  if (!h) { const r = predOf(g); const why = r?.pregame?.blockers?.[0] || r?.live?.why || 'No estimate'; return `<span class="model-chip" title="${esc(why)}">No pick ↗</span>`; }
  const fav = h.p >= 0.5 ? g.home.abbr : g.away.abbr, fp = Math.max(h.p, 1 - h.p);
  return `<span class="model-chip ${h.kind === 'live' ? 'green' : ''}">${esc(fav)} ${pct(fp, 0)} to win ↗</span>`;
}
function gameCard(g) {
  return `<button class="game-card ${state.selectedGame === g.id ? 'selected' : ''}" data-game="${esc(g.id)}">
    <div class="game-top">${statusBadge(g.status)}<span>${esc(g.statusText || '')}</span></div>
    <div class="teams"><div class="team-row"><span class="team-name"><span class="team-tag">${esc(g.away.abbr?.slice(0, 3))}</span>${esc(g.away.name)}</span><span class="team-score">${g.away.score ?? '—'}</span></div>
    <div class="team-row"><span class="team-name"><span class="team-tag">${esc(g.home.abbr?.slice(0, 3))}</span>${esc(g.home.name)}</span><span class="team-score">${g.home.score ?? '—'}</span></div></div>
    <div class="game-foot"><span>${g.status === 'in' ? 'Our live pick' : g.status === 'post' ? 'Final' : 'Our pregame pick'}</span>${modelChip(g)}</div>
  </button>`;
}
function gamesPanel(cap = 4) { const games = currentGames(); return games.length ? `<div class="game-grid">${games.slice(0, cap).map(gameCard).join('')}</div>` : emptyBlock(state.loading ? 'Loading games…' : 'No games on the board', state.loading ? 'Fetching the ESPN scoreboard.' : 'Either no games are scheduled today or the free source is unavailable. Demo data is never substituted in live mode.'); }
function sparkline(points, w = 560, h = 120) {
  if (!points || points.length < 2) return `<p class="muted small-note">A chart of the win chance will build here as the game goes on (while the app is open).</p>`;
  const xs = i => 8 + i * (w - 16) / (points.length - 1), ys = p => 8 + (1 - p) * (h - 16);
  const d = points.map((pt, i) => `${i ? 'L' : 'M'}${xs(i).toFixed(1)},${ys(pt.p).toFixed(1)}`).join(' ');
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" role="img" aria-label="Home win probability over time, ${points.length} updates, latest ${pct(points.at(-1).p)}"><line x1="8" x2="${w - 8}" y1="${ys(0.5)}" y2="${ys(0.5)}" class="spark-mid"/><path d="${d}" class="spark-line"/><circle cx="${xs(points.length - 1)}" cy="${ys(points.at(-1).p)}" r="4" class="spark-dot"/><text x="8" y="${h - 2}" class="spark-label">${esc(points[0].label)}</text><text x="${w - 8}" y="${h - 2}" text-anchor="end" class="spark-label">${esc(points.at(-1).label)}</text></svg>`;
}
function findings() {
  const out = [];
  for (const g of currentGames()) {
    const r = predOf(g); if (!r) continue;
    if (r.live.available) {
      const m = g.home.score - g.away.score, trailHome = m < 0, pTrail = trailHome ? r.live.homeProbability : 1 - r.live.homeProbability;
      if (Math.abs(m) >= 6 && pTrail >= 0.2) out.push({ g, text: `${trailHome ? g.home.abbr : g.away.abbr} trails by ${Math.abs(m)} but keeps a ${pct(pTrail, 0)} chance (strength prior + time left).` });
      if (r.pregame.available && Math.abs(r.live.homeProbability - r.pregame.homeProbability) >= 0.25) out.push({ g, text: `${g.home.abbr} win chance moved ${pct(r.pregame.homeProbability, 0)} → ${pct(r.live.homeProbability, 0)} since tip.` });
    } else if (g.status === 'pre' && r.pregame.available) {
      const p = r.pregame.homeProbability; if (Math.abs(p - 0.5) <= 0.06) out.push({ g, text: `${g.away.abbr} at ${g.home.abbr} projects as a coin flip (${pct(p, 0)} home).` });
    }
  }
  return out.slice(0, 5);
}

// ---------- pages ----------
function renderOverview() {
  const games = currentGames(), live = games.filter(g => g.status === 'in').length, marketCount = flatMarkets().length;
  const pv = state.models.pregame?.validation, lv = state.models.live?.validation;
  const f = findings();
  const gate = (n, label, status, cls) => `<div class="reason"><span class="tick">${n}</span><span class="grow">${label}</span><span class="badge ${cls}">${status}</span></div>`;
  return `<div class="stats-grid">${statCard('LIVE NOW', state.loading ? '…' : live, isDemo() ? 'Demo games' : `${games.length} games today`, live ? 'green' : '', '◉')}${statCard('POLYMARKET MARKETS', state.loading ? '…' : marketCount, isDemo() ? 'Made-up sample markets' : 'Open to look at, not bets', '', '▥')}${statCard('MODEL STATUS', 'TESTING', pv ? `Checked on ${pv.n.toLocaleString()} past games. Not for real money yet.` : 'Model files not loaded', 'orange', '◇')}${statCard('AUTO-TRADING', 'OFF', 'You place every trade yourself', 'orange', '⊘')}</div>
    ${help(['Each card is one game. The green or orange tag shows <b>which team we think wins and how likely</b>, e.g. "BOS 64% to win".', 'These chances come from our own models, not from Polymarket prices.', '<b>Model findings</b> points out games worth a closer look. They are not bets.', '<b>Before real-money use</b> is the checklist the app must pass before it will ever flag a bet.'])}${sectionHeader('Tonight’s games', 'Tap a game to see the full breakdown.', `<button class="sm-btn" data-page="live">All games ↗</button>`)}
    <div class="panel-layout"><div class="panel"><div class="panel-head"><div><div class="panel-title">${esc(state.sport.toUpperCase())} game center</div><span class="panel-sub">${isDemo() ? 'Demo games' : `Scores from ESPN · updated ${esc(ago(state.scores?.fetchedAt))}`}</span></div><span class="badge">${isDemo() ? 'DEMO' : 'LIVE DATA'}</span></div><div class="panel-pad">${state.sport === 'nba' ? gamesPanel() : emptyBlock(`${state.sport.toUpperCase()} model not built yet`, 'NBA is the priority. NFL and MLB get their own models (drives/clock, pitchers/bullpens) in later phases. Scores still load in Live games.')}</div></div>
      <div class="stack"><div class="signal-box"><div class="signal-icon">◈</div><h3>Model findings</h3>${f.length ? f.map(x => `<button class="finding" data-game="${esc(x.g.id)}">${esc(x.text)}</button>`).join('') : `<p>Nothing notable right now. This lists games where a losing team still has a real chance, a game has swung a lot, or a matchup is close to 50/50.</p>`}<div class="line"></div><div class="badge orange">FOR RESEARCH, NOT BETS</div></div>
      <div class="panel"><div class="panel-head"><div class="panel-title">Before real-money use</div><span class="badge red">NOT READY</span></div><div class="panel-pad">
        ${gate('01', 'Tested on past seasons', pv && lv ? 'DONE' : 'MISSING', pv && lv ? 'green' : 'red')}
        ${gate('02', 'Chances match real results', pv && lv ? 'DONE' : 'MISSING', pv && lv ? 'green' : 'red')}
        ${gate('03', 'Real prices, incl. fees', 'FEES NOT CHECKED', 'orange')}
        ${gate('04', 'Markets matched to games', 'YOU DO IT BY HAND', 'orange')}
        ${gate('05', 'Proven in paper trading', 'NOT STARTED', 'red')}
        ${gate('06', 'Injury reports connected', 'NOT YET', 'red')}
      </div></div></div></div>
    ${sectionHeader('Polymarket markets', 'What is listed right now. Tap "Check price" to see the real price.', `<button class="sm-btn" data-page="opportunities">Compare with our picks ↗</button>`)}
    <div class="panel panel-pad">${marketRows(4)}</div>`;
}

function pregameBlock(g, r) {
  const pg = r.pregame;
  if (!pg.available) return `<div class="notice warn"><strong>No pregame pick:</strong> ${esc(pg.blockers.join('; ') || 'unknown')}</div>`;
  const rows = pg.contributions.map(c => `<tr><td>${esc(FEATURE_LABELS[c.feature] || c.feature)}</td><td class="num">${Number(c.value).toFixed(2)}</td><td class="num ${c.logitContribution >= 0 ? 'good-text' : 'error-text'}">${c.logitContribution >= 0 ? '+' : ''}${c.logitContribution.toFixed(3)}</td></tr>`).join('');
  return `<div class="prob-split"><div><small>${esc(g.away.abbr)}</small><strong>${pct(pg.awayProbability)}</strong></div><div class="prob-mid">CHANCE TO WIN<br>BEFORE TIP-OFF</div><div><small>${esc(g.home.abbr)}</small><strong>${pct(pg.homeProbability)}</strong></div></div>
    <div class="progress"><span style="width:${(pg.homeProbability * 100).toFixed(2)}%"></span></div>
    <p class="muted small-note">Likely range for ${esc(g.home.abbr)}: ${pct(pg.band.low)} to ${pct(pg.band.high)}. The model is not exact; the true chance is probably in here.</p>
    <div class="line"></div>${pg.evidence.map(x => `<div class="reason"><span class="tick">✦</span>${esc(x)}</div>`).join('')}
    ${pg.warnings.map(x => `<div class="reason warn-line"><span class="tick">!</span>${esc(x)}</div>`).join('')}
    <details class="drill"><summary>Show the math (for the curious)</summary><p class="muted small-note">Positive numbers push toward ${esc(g.home.abbr)}, negative toward ${esc(g.away.abbr)}.</p><div class="table-wrap"><table class="table compact"><thead><tr><th>FACTOR</th><th>VALUE</th><th>EFFECT</th></tr></thead><tbody><tr><td>Starting point</td><td></td><td class="num">${pg.intercept.toFixed(3)}</td></tr>${rows}</tbody></table></div></details>`;
}
function modelPanel(g) {
  if (!g) return emptyBlock('Select a game', 'Choose a game card to open the independent pregame and live models.');
  const r = predOf(g), d = state.details[g.id];
  if (!r) return emptyBlock(g.league === 'nba' ? 'Model not ready' : `${g.league.toUpperCase()} model not built yet`, g.league === 'nba' ? (state.models.error || 'Model files are loading.') : 'NBA comes first; this sport shows scores only for now.');
  const L = r.live;
  let livePart;
  if (L.available) {
    livePart = `<div class="prob-split big"><div><small>${esc(g.away.abbr)}</small><strong>${pct(L.awayProbability)}</strong></div><div class="prob-mid">CHANCE TO WIN<br>RIGHT NOW</div><div><small>${esc(g.home.abbr)}</small><strong>${pct(L.homeProbability)}</strong></div></div>
      <div class="progress"><span style="width:${(L.homeProbability * 100).toFixed(2)}%"></span></div>
      <p class="muted small-note">Likely range for ${esc(g.home.abbr)}: ${pct(L.band.low)} to ${pct(L.band.high)}. We played out the rest of this game ${L.sims.toLocaleString()} times to get this.</p>
      <div class="chart-box">${sparkline(state.history[g.id])}</div>
      <div class="line"></div><div class="stat-title">WHY</div>${L.evidence.map(x => `<div class="reason"><span class="tick">✦</span>${esc(x)}</div>`).join('')}
      <div class="reason warn-line"><span class="tick">!</span>What the model can't see yet: ${esc(L.notConnected.join(', '))}.</div><details class="drill"><summary>Technical details</summary><p class="muted small-note">${esc(L.technical || '')}</p></details>`;
  } else livePart = `<div class="notice ${g.status === 'in' ? 'warn' : ''}"><strong>Live pick:</strong> ${esc(L.why === 'Game not in progress' ? 'shows up once the game starts' : L.why)}.</div>`;
  const stamp = isDemo() ? 'demo' : `score updated ${esc(ago(g.updatedAt))}`;
  const players = d?.players || [];
  const playerTable = players.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>PLAYER</th><th>TEAM</th><th>ROLE</th><th>BOX SCORE</th></tr></thead><tbody>${players.slice(0, 30).map(p => `<tr><td><strong>${esc(p.name)}</strong></td><td>${esc(p.team)}</td><td>${p.didNotPlay ? 'DNP' : p.starter ? 'Starter' : 'Bench'}</td><td>${esc(Object.entries(p.stats).slice(0, 8).map(([k, v]) => `${k}: ${v}`).join(' · '))}</td></tr>`).join('')}</tbody></table></div>${d.injuries ? `<p class="muted small-note">Injury entries from feed: ${d.injuries.length ? esc(d.injuries.map(i => `${i.name} (${i.status})`).join(', ')) : 'none listed'}. From ESPN, may be incomplete. Not used by the model yet.</p>` : '<p class="muted small-note">No injury block in this response.</p>'}` : emptyBlock(d?.error ? 'Box score unavailable' : 'Box score not loaded', d?.error || 'Tap "Load box score" to see player stats.');
  return `<div class="panel-layout"><div class="panel"><div class="panel-head"><div><strong>${esc(g.name || `${g.away.name} at ${g.home.name}`)}</strong><span class="panel-sub">${statusBadge(g.status)} ${esc(g.statusText || '')} · ${stamp}</span></div><span class="badge ${L.available ? 'green' : 'orange'}">${L.available ? 'LIVE PICK' : 'WAITING'}</span></div><div class="panel-pad">
      <div class="score-visual"><div><div class="score-num">${g.away.score ?? '—'}</div><div class="score-team">${esc(g.away.name)}</div></div><span class="score-vs">AT</span><div><div class="score-num">${g.home.score ?? '—'}</div><div class="score-team">${esc(g.home.name)}</div></div></div><div class="line"></div>${livePart}</div></div>
    <div class="panel"><div class="panel-head"><div class="panel-title">Before the game</div><span class="badge">PREGAME PICK</span></div><div class="panel-pad">${r.pregame.synthetic ? `<div class="notice warn"><strong>Demo game.</strong> Made-up teams have no real history, so this part is blank.</div>` : pregameBlock(g, r)}</div></div></div>
  ${sectionHeader('Box score', 'Player stats so far from ESPN. These are what happened, not predictions.', `<button class="sm-btn" data-load-game="${esc(g.id)}" ${isDemo() ? 'disabled' : ''}>Load box score ↻</button>`)}<div class="panel panel-pad">${playerTable}</div>`;
}
function renderLive() {
  const games = currentGames();
  const chosen = games.find(g => g.id === state.selectedGame) || games.find(g => g.status === 'in') || games[0];
  return `${sectionHeader('Live games', 'Tap any game to see our pick and why.', `<span class="badge orange">TESTING</span>`)}${help(['<b>Chance to win right now</b>: how likely each team is to win from here, based on the score, time left and how good each team is.', '<b>Likely range</b>: our best guess is not exact. The real chance is probably inside this range.', '<b>Why</b>: the main reasons behind the number, in plain words.', '<b>Before the game</b>: what we thought before tip-off. Compare it with the live number to see how much the game has changed.', '<b>What the model can\'t see</b>: things it doesn\'t know yet (like foul trouble). Keep these in mind yourself.'])}<div class="panel panel-pad">${gamesPanel(30)}</div>${sectionHeader('Game breakdown', 'Our pick, the reasons, and what we can\'t see.')}${modelPanel(chosen)}`;
}

function renderPlayers() {
  const pm = state.models.pregame;
  if (!pm) return emptyBlock('Model files not loaded', state.models.error || 'Loading…');
  const teams = nbaTeams();
  const sel = state.playerTeam ?? teams[0]?.id;
  const q = state.playerQuery.trim().toLowerCase();
  const all = Object.entries(pm.rotations).filter(([tid]) => +tid >= 1 && +tid <= 30).flatMap(([tid, list]) => list.map(p => ({ ...p, teamId: +tid, team: teams.find(t => t.id === +tid)?.abbr || '?' })));
  const shown = q ? all.filter(p => p.name.toLowerCase().includes(q)).slice(0, 40) : all.filter(p => p.teamId === sel);
  const teamTotal = id => all.filter(p => p.teamId === id).reduce((s, p) => s + p.value, 0);
  const t = teams.find(x => x.id === sel);
  const teamCard = t && !q ? `<div class="stats-grid">${statCard('STRENGTH', `${t.r >= 0 ? '+' : ''}${t.r.toFixed(1)}`, 'Points per game vs an average team', t.r >= 0 ? 'green' : 'orange', '◇')}${statCard('OFFENSE', `${t.off >= 0 ? '+' : ''}${t.off.toFixed(1)}`, 'Scoring vs average (higher is better)', '', '↗')}${statCard('DEFENSE', `${t.def >= 0 ? '+' : ''}${t.def.toFixed(1)}`, 'Points allowed vs average (lower is better)', t.def <= 0 ? 'green' : 'orange', '⛉')}${statCard('GAMES PLAYED', t.seasonGames, `This season, through ${esc(t.lastDate)}`, '', '▤')}</div>` : '';
  return `${sectionHeader('Players', `Who matters most on each team. Updated through ${esc(pm.ratings.asOfDate)}.`, `<span class="badge orange">PROP PICKS COMING LATER</span>`)}${help(['Pick a team, or search a player.', '<b>Minutes</b>: how much he has been playing lately.', '<b>Impact per minute</b>: how productive he is when on the court (from his box score stats).', '<b>Team value</b>: minutes and impact combined. A bigger bar means the team misses him more if he sits.', 'Team cards at the top: <b>Strength</b> is points per game better or worse than an average team.'])}
    <div class="control-row"><div class="field grow"><label for="teamSelect">Team</label><select id="teamSelect" data-player-team>${teams.map(x => `<option value="${x.id}" ${x.id === sel ? 'selected' : ''}>${esc(x.abbr)}</option>`).join('')}</select></div><div class="field grow"><label for="playerSearch">Search a player</label><input id="playerSearch" data-player-search placeholder="Player name" value="${esc(state.playerQuery)}" maxlength="40" /></div></div>
    ${teamCard}
    <div class="panel panel-pad" style="margin-top:14px"><div class="table-wrap"><table class="table"><thead><tr><th>PLAYER</th><th>TEAM</th><th>MINUTES</th><th>IMPACT / MIN</th><th>TEAM VALUE</th><th>HOW MUCH THEY MATTER</th></tr></thead><tbody>${shown.length ? shown.map(p => `<tr><td><strong>${esc(p.name)}</strong></td><td>${esc(p.team)}</td><td class="num">${p.ewMin.toFixed(1)}</td><td class="num">${p.gsPerMin.toFixed(3)}</td><td class="num">${p.value.toFixed(2)}</td><td><div class="mini-bar"><span style="width:${Math.min(100, 100 * p.value / Math.max(1e-9, teamTotal(p.teamId))).toFixed(0)}%"></span></div></td></tr>`).join('') : `<tr><td colspan="6">No players found.</td></tr>`}</tbody></table></div>
    <p class="muted small-note">Recent games count more. Impact is based on box score stats, so great defenders can look underrated here.</p></div>
    <div class="notice warn" style="margin-top:14px"><strong>Coming later:</strong> player prop chances (like "will he score 20+?"). We won't show any until they're built and tested.</div>`;
}

function bookCell(m) {
  const b = state.books[m.slug];
  if (!b) return `<small>Price not checked</small>`;
  if (b.error) return `<small class="error-text">${esc(b.error)}</small>`;
  return `<div class="number">${b.bestAsk !== null ? `${(b.bestAsk * 100).toFixed(1)}¢` : '—'}</div><small>${b.open ? 'open' : esc((b.state || 'closed').replace('MARKET_STATE_', '').toLowerCase())} · ${b.quoteTime ? `price from ${esc(ago(b.quoteTime))}` : 'no price time'}${b.synthetic ? ' · demo' : ''}</small>`;
}
function marketRows(cap = 25) {
  const markets = flatMarkets().slice(0, cap);
  return markets.length ? `<div class="data-list">${markets.map(m => `<div class="data-row"><div><strong>${esc(m.question)}</strong><small>${esc(m.eventName)} · ${esc(m.type)}${m.line !== null && m.line !== undefined ? ` · line ${esc(m.line)}` : ''} · ${esc(m.slug)}${m.comboEnabled === true ? ' · combo-enabled flag' : ''}</small></div><div class="row-actions"><div style="text-align:right">${bookCell(m)}</div><button class="sm-btn" data-book="${esc(m.slug)}">${isDemo() ? 'Sample price' : 'Check price'}</button></div></div>`).join('')}</div>`
    : emptyBlock(state.loading ? 'Loading markets…' : 'No markets loaded', 'Polymarket may be down or have nothing listed. We never make up prices.');
}
function opportunityCard(m) {
  const link = state.links[m.slug], b = state.books[m.slug], s = state.settings;
  const games = currentGames().filter(g => g.league === 'nba');
  const linkForm = `<form class="link-form" data-link-form="${esc(m.slug)}"><div class="field"><label>1. Which game is this market about?</label><select name="gameId" required><option value="">Choose game…</option>${games.map(g => `<option value="${esc(g.id)}" ${link?.gameId === g.id ? 'selected' : ''}>${esc(g.away.abbr)} at ${esc(g.home.abbr)}</option>`).join('')}</select></div><div class="field"><label>2. "Yes" wins if…</label><select name="team" required><option value="">Choose team…</option>${(() => { const gg = games.find(x => x.id === link?.gameId); return `<option value="home" ${link?.team === 'home' ? 'selected' : ''}>${gg ? esc(gg.home.abbr) : 'Home team'} wins</option><option value="away" ${link?.team === 'away' ? 'selected' : ''}>${gg ? esc(gg.away.abbr) : 'Away team'} wins</option>`; })()}</select></div><div class="field"><label class="check"><input type="checkbox" name="confirm" required ${link ? 'checked' : ''}/> 3. I checked the market's rules on Polymarket (including overtime)</label></div><div class="field"><button class="sm-btn" type="submit">${link ? 'Update match' : 'Save match'}</button></div></form>`;
  let evalHtml = `<p class="muted small-note">Fill in steps 1 to 3, then tap "Check price". We'll compare our chance with the real price.</p>`;
  if (link) {
    const g = games.find(x => x.id === link.gameId), r = g && predOf(g);
    if (!g) evalHtml = `<div class="notice warn">Mapped game is not on today's board.</div>`;
    else {
      const src = r?.live.available ? r.live : r?.pregame.available ? r.pregame : null;
      const p = src ? (link.team === 'home' ? src.homeProbability : src.awayProbability) : null;
      const pLow = src?.band ? (link.team === 'home' ? src.band.low : 1 - src.band.high) : null;
      const fill = b && !b.error ? executableFill(b, 'YES', s.stake) : { ok: false, reason: 'Order book not fetched' };
      const ev = evaluateOpportunity({ p, pLow, fill, book: b && !b.error ? b : null, fee: { fraction: Number.isFinite(s.feePct) ? s.feePct / 100 : null, verified: s.feeVerified },
        checks: { modelStatus: 'research', linkVerified: true, inputsComplete: false, gameStateAgeSec: isDemo() ? 0 : (Date.now() - Date.parse(state.scores?.fetchedAt || 0)) / 1000 },
        gates: { maxQuoteAgeSec: s.maxQuoteAge, minNetEV: s.minEV / 100, minGrossMultiple: s.min, maxGrossMultiple: s.max, maxSlippage: s.maxSlippageC / 100, edgeMustExceedUncertainty: true } });
      maybeAlert(m, g, link, p, ev);
      evalHtml = `<div class="eval-grid"><div class="result-line"><span>Our chance ${esc(link.team === 'home' ? g.home.abbr : g.away.abbr)} wins (${r?.live.available ? 'live' : 'before tip-off'})</span><strong>${pct(p)}</strong></div>
        <div class="result-line"><span>Price for ${dollar(s.stake)} of "Yes"</span><strong>${fill.ok ? `${(fill.avgPrice * 100).toFixed(1)}¢` : esc(fill.reason)}</strong></div>
        <div class="result-line"><span>The price means Polymarket says</span><strong>${fill.ok ? pct(fill.avgPrice, 0) : '—'}</strong></div>
        <div class="result-line"><span>If it wins, ${dollar(s.stake)} pays back</span><strong>${fill.ok ? `${dollar(s.stake / fill.avgPrice)} (${(1 / fill.avgPrice).toFixed(2)}×)` : '—'}</strong></div>
        <div class="result-line"><span>Expected profit if our chance is right</span><strong>${ev.netEV !== null ? pct(ev.netEV) : ev.grossEV !== null ? `${pct(ev.grossEV)} before fees` : '—'}</strong></div>
        <div class="result-line"><span>Verdict</span><span class="badge ${ev.actionable ? 'green' : 'red'}">${ev.actionable ? 'WORTH A LOOK' : 'NOT A BET'}</span></div></div>${ev.blockers.length ? '<p class="muted small-note">Why not:</p>' : ''}
        ${ev.blockers.length ? `<ul class="blockers">${ev.blockers.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}${ev.warnings.map(w => `<p class="muted small-note">⚠ ${esc(w)}</p>`).join('')}`;
    }
  }
  return `<div class="panel opp"><div class="panel-head"><div><div class="panel-title">${esc(m.question)}</div><span class="panel-sub">${esc(m.eventName)} · ${esc(m.type)} · ${esc(m.slug)}</span></div><div class="row-actions"><div style="text-align:right">${bookCell(m)}</div><button class="sm-btn" data-book="${esc(m.slug)}">${isDemo() ? 'Sample price' : 'Check price'}</button></div></div><div class="panel-pad two-up">${linkForm}<div>${evalHtml}</div></div></div>`;
}
function renderOpportunities() {
  const ms = flatMarkets().filter(m => /MONEYLINE|UNKNOWN/i.test(m.type) || !m.type);
  const others = flatMarkets().length - ms.length;
  return `${sectionHeader('Compare with Polymarket', 'Our chance vs the market price. If our chance is clearly higher than the price, that could be value.', `<span class="badge orange">TESTING</span>`)}${help(['<b>How to read a price</b>: 45¢ means Polymarket thinks it\'s about a 45% chance. A $5 bet at 45¢ pays back about $11.11 if it wins.', '<b>Steps</b>: match the market to a game, confirm which team "Yes" means, then tap Check price.', '<b>Verdict</b>: "Worth a look" only if every safety check passes. Otherwise you\'ll see "Not a bet" with the exact reasons.', 'Right now everything shows "Not a bet" because the model is still in testing. That\'s on purpose.'])}
  <div class="stats-grid">${statCard('GAMES LISTED', currentEvents().length, 'On Polymarket', '', '▧')}${statCard('WHO-WINS MARKETS', ms.length, `${others} other kinds listed`, '', '▥')}${statCard('MATCHED BY YOU', Object.keys(state.links).length, 'Markets linked to games', '', '⇄')}${statCard('WORTH A LOOK', 0, 'None while in testing', 'orange', '⊘')}</div>
  <div class="notice" style="margin-top:16px"><strong>To be "worth a look", all of these must be true:</strong> the price is fresh, the market is open, your ${dollar(state.settings.stake)} pays ${state.settings.min}×–${state.settings.max}×, expected profit is at least ${state.settings.minEV}% even if we're a bit off, fees are set, injuries are known, and the model has passed paper trading.</div>
  <div class="stack">${ms.length ? ms.slice(0, 30).map(opportunityCard).join('') : `<div class="panel panel-pad">${marketRows(0)}</div>`}</div>
  ${others ? `${sectionHeader('Other markets', 'Spreads, totals and player props. We don\'t have picks for these yet, so they are listed only.')}<div class="panel panel-pad">${marketRows(50)}</div>` : ''}`;
}

function renderParlays() {
  let result = null; try { result = calculateIndependentParlay(state.legs); } catch { }
  return `${sectionHeader('Parlay calculator', 'Try out parlay ideas with your own numbers.', `<span class="badge orange">PRACTICE ONLY</span>`)}${help(['Add each pick with <b>your chance it wins</b> and <b>what it pays</b> (2× means $5 pays back $10).', 'The calculator shows what the whole parlay pays and its chance to hit.', 'Warning: picks from the same game often win or lose together, so the real chance can be quite different from what this shows.'])}
  <div class="two-up"><div class="panel"><div class="panel-head"><div class="panel-title">Your picks <span class="panel-sub">Use your own numbers</span></div><span class="badge">${state.legs.length} PICKS</span></div><div class="panel-pad"><div class="data-list">${state.legs.map((l, i) => `<div class="data-row"><div style="flex:1"><strong>${esc(l.label)}</strong><small>Pick ${i + 1}</small></div><div class="row-actions"><span class="tag">${pct(l.p)} chance</span><span class="tag">pays ${l.multiplier.toFixed(2)}×</span><button class="sm-btn" data-remove-leg="${l.id}" aria-label="Remove pick ${i + 1}">×</button></div></div>`).join('')}</div>
    <form id="addLegForm" class="form-grid" style="margin-top:16px"><div class="field"><label for="legLabel">Pick</label><input id="legLabel" name="label" required placeholder="e.g. Team A moneyline" maxlength="80" /></div><div class="field"><label for="legP">Your chance it wins (%)</label><input id="legP" name="p" type="number" required min="1" max="99" step="0.1" placeholder="e.g. 62" /></div><div class="field"><label for="legMult">Pays (×)</label><input id="legMult" name="multiplier" type="number" required min="1.01" max="100" step="0.01" placeholder="e.g. 1.8" /></div><div class="field" style="align-self:end"><button type="submit" class="primary-btn">Add pick +</button></div></form></div></div>
    <div class="stack"><div class="panel"><div class="panel-head"><div class="panel-title">Result</div><span class="badge orange">ESTIMATE</span></div><div class="panel-pad">${result ? `<div class="stat-title">PARLAY PAYS</div><div class="big-number orange-text">${result.grossMultiplier.toFixed(2)}×</div><div class="line"></div><div class="result-line"><span>Chance all picks hit</span><strong>${pct(result.jointP, 2)}</strong></div><div class="result-line"><span>Expected profit before fees</span><strong class="${result.grossEV >= 0 ? 'good-text' : 'error-text'}">${pct(result.grossEV)}</strong></div><div class="result-line"><span>${dollar(state.settings.stake)} pays back if it hits</span><strong>${dollar(state.settings.stake * result.grossMultiplier)}</strong></div><div class="result-line"><span>In your ${state.settings.min}×–${state.settings.max}× target?</span><span class="badge ${result.grossMultiplier >= state.settings.min && result.grossMultiplier <= state.settings.max ? 'green' : 'orange'}">${result.grossMultiplier >= state.settings.min && result.grossMultiplier <= state.settings.max ? 'YES' : 'NO'}</span></div>` : 'Add at least two picks.'}
      <div class="notice warn" style="margin-top:15px"><strong>Don't bet from this alone.</strong> It assumes your picks don't affect each other. Same-game picks usually do. Also, this app can't see Polymarket's real parlay (Combo) prices.</div></div></div>
      <div class="signal-box"><h3>Coming later</h3><p>Smarter parlays that understand how picks from the same game affect each other. This comes after player prop picks are built.</p></div></div></div>`;
}

function renderPerformance() {
  const pm = state.models.pregame, lm = state.models.live;
  const f = (v, d = 4) => Number.isFinite(v) ? v.toFixed(d) : '—';
  let valid = emptyBlock('Model files not loaded', state.models.error || 'Loading…');
  if (pm && lm) {
    const v = pm.validation, e = lm.validation.engines;
    const lv2 = lm.validation.engines, ens = lv2.pEns || lv2.pAn, old = lv2.pLegacy;
    valid = `<div class="two-up"><div class="panel"><div class="panel-head"><div class="panel-title">Before-game picks <span class="panel-sub">Tested on ${v.n.toLocaleString()} past games (${v.testSeasons[0] - 1}-${v.testSeasons.at(-1)} seasons)</span></div><span class="badge">TESTED</span></div><div class="panel-pad">
      <div class="result-line"><span>Our favorite won</span><strong>${pct(v.baseOnMarketGames.accuracy)} of games</strong></div>
      ${v.lineupAware ? `<div class="result-line"><span>With injury info (once connected)</span><strong>${pct(v.lineupAware.accuracy)}</strong></div>` : ''}
      <div class="result-line"><span>Sportsbook favorite won (for comparison)</span><strong>${pct(v.marketLineOnSameGames.accuracy)}</strong></div>
      <p class="muted small-note">Plain version: we pick winners well, but the sportsbooks are still a bit better on average. That's normal with free data. So we only care about the few games where we strongly disagree with the price, and paper trading will show if those pay off.</p>
      <details class="drill"><summary>Technical scores</summary><div class="table-wrap"><table class="table compact"><thead><tr><th>MODEL</th><th>BRIER</th><th>LOG LOSS</th></tr></thead><tbody><tr><td>SportsPilot</td><td class="num">${f(v.baseOnMarketGames.brier)}</td><td class="num">${f(v.baseOnMarketGames.logLoss)}</td></tr>${v.lineupAware ? `<tr><td>With lineups</td><td class="num">${f(v.lineupAware.brier)}</td><td class="num">${f(v.lineupAware.logLoss)}</td></tr>` : ''}<tr><td>Sportsbook line</td><td class="num">${f(v.marketLineOnSameGames.brier)}</td><td class="num">${f(v.marketLineOnSameGames.logLoss)}</td></tr></tbody></table></div><p class="muted small-note">Lower is better for both. Full report: docs/reports.</p></details></div></div>
      <div class="panel"><div class="panel-head"><div class="panel-title">Live picks <span class="panel-sub">Tested on ${lm.validation.testStates.toLocaleString()} moments from past games</span></div><span class="badge">TESTED</span></div><div class="panel-pad">
      <div class="result-line"><span>Our live favorite won</span><strong>${pct(ens.accuracy)}</strong></div>
      <div class="result-line"><span>Old version of the app</span><strong>${pct(old.accuracy)}</strong></div>
      <div class="result-line"><span>Honesty check: when we said ~27%, teams won</span><strong>~27%</strong></div>
      <p class="muted small-note">Plain version: when the app says a team has a 30% chance, teams in that spot really do win about 30% of the time. That matters most for 3×-5× payouts, which live in the 20%-33% range.</p>
      <details class="drill"><summary>Technical scores</summary><div class="table-wrap"><table class="table compact"><thead><tr><th>VERSION</th><th>BRIER</th><th>LOG LOSS</th></tr></thead><tbody>${Object.values(lv2).map(x => `<tr><td>${esc(x.label)}</td><td class="num">${f(x.brier)}</td><td class="num">${f(x.logLoss)}</td></tr>`).join('')}</tbody></table></div></details></div></div></div>`;
  }
  const logs = Object.values(state.predLog).sort((a, b) => String(b.loggedAt).localeCompare(String(a.loggedAt)));
  const done = logs.filter(x => x.outcome !== null);
  const pros = done.length ? { n: done.length, b: brier(done.map(x => x.p), done.map(x => x.outcome)), l: logLoss(done.map(x => x.p), done.map(x => x.outcome)) } : null;
  const j = state.journal, settled = j.filter(x => x.status === 'WON' || x.status === 'LOST');
  let bank = 0, peak = 0, dd = 0; const chron = settled.slice().sort((a, b) => String(a.at).localeCompare(String(b.at)));
  for (const x of chron) { bank += pnl(x); peak = Math.max(peak, bank); dd = Math.min(dd, bank - peak); }
  const staked = settled.reduce((s, x) => s + x.stake, 0);
  return `${sectionHeader('Results', 'How good are the picks? Three separate scorecards.')}${help(['<b>Tested on past seasons</b>: how the models did on old games they never saw while being built.', '<b>Tonight and forward</b>: picks the app locks in before each game, then grades after. This is the most honest score. It fills in automatically when you open the app before games.', '<b>Paper trading</b>: pretend bets you record yourself at real prices. This tells us if the picks would actually make money.', 'Only paper trading can unlock real-money alerts.'])}${sectionHeader('1. Tested on past seasons', '')}
    ${valid}
    ${sectionHeader('2. Tonight and forward', 'Picks locked in before tip-off, graded after the final.', `<span class="badge">${done.length} GRADED / ${logs.length} LOCKED IN</span>`)}
    <div class="panel panel-pad">${pros ? `<div class="result-line"><span>Games graded</span><strong>${pros.n}</strong></div><div class="result-line"><span>Our favorite won</span><strong>${pct(done.filter(x => (x.p >= 0.5) === Boolean(x.outcome)).length / done.length)}</strong></div><p class="muted small-note">${pros.n < 200 ? `Only ${pros.n} games so far. Too few to judge; it takes a few hundred.` : 'Compare with the past-season results above.'}</p>` : `<p class="muted">Nothing graded yet. Just open the app before games start; picks lock in automatically and get graded after the final.</p>`}
      ${logs.length ? `<div class="table-wrap"><table class="table compact"><thead><tr><th>GAME</th><th>OUR PICK</th><th>LOCKED IN</th><th>RESULT</th></tr></thead><tbody>${logs.slice(0, 20).map(x => `<tr><td>${esc(x.away)} at ${esc(x.home)}</td><td>${esc(x.p >= 0.5 ? x.home : x.away)} ${pct(Math.max(x.p, 1 - x.p), 0)}</td><td>${esc(ago(x.loggedAt))}</td><td>${x.outcome === null ? 'waiting' : `${(x.p >= 0.5) === Boolean(x.outcome) ? '✓ right' : '✗ wrong'} · ${esc(x.final || '')}`}</td></tr>`).join('')}</tbody></table></div>` : ''}</div>
    ${sectionHeader('3. Paper trading', 'Pretend bets at real prices. Record it, then mark it won or lost.', `<button class="sm-btn" data-export="journal">Download backup ↗</button>`)}
    <div class="two-up"><div class="panel"><div class="panel-head"><div class="panel-title">Add a pretend bet</div><span class="badge">NO REAL MONEY</span></div><div class="panel-pad"><form id="journalForm" class="form-grid"><div class="field" style="grid-column:1/-1"><label for="journalName">What did you pick?</label><input id="journalName" name="name" maxlength="160" required placeholder="e.g. BOS moneyline vs NY, Q3 6:00" /></div><div class="field"><label for="journalStake">Amount ($)</label><input id="journalStake" name="stake" type="number" required min="0.01" max="100000" step="0.01" value="${state.settings.stake}" /></div><div class="field"><label for="journalProb">Our chance (%)</label><input id="journalProb" name="prob" type="number" required min="0.1" max="99.9" step="0.1" value="30" /></div><div class="field"><label for="journalPrice">Polymarket price (¢)</label><input id="journalPrice" name="ask" type="number" required min="0.1" max="99.9" step="0.1" value="25" /></div><div class="field"><label for="journalFee">Fee (%)</label><input id="journalFee" name="fee" type="number" min="0" max="20" step="0.01" value="${Number.isFinite(state.settings.feePct) ? state.settings.feePct : 0}" /></div><div class="field" style="grid-column:1/-1"><label for="journalEvidence">Notes (optional)</label><input id="journalEvidence" name="evidence" maxlength="500" placeholder="Why you'd take it, score and time when you saw it…" /></div><div class="field"><button class="primary-btn" type="submit">Save pretend bet</button></div></form></div></div>
    <div class="panel"><div class="panel-head"><div class="panel-title">How the pretend bets are doing</div><span class="badge">${j.length} BETS</span></div><div class="panel-pad">
      <div class="result-line"><span>Finished</span><strong>${settled.length} (${settled.filter(x => x.status === 'WON').length} won)</strong></div><div class="result-line"><span>Profit / return</span><strong class="${bank >= 0 ? 'good-text' : 'error-text'}">${dollar(bank)} / ${staked ? pct(bank / staked) : '—'}</strong></div><div class="result-line"><span>Worst losing stretch</span><strong>${dollar(dd)}</strong></div><div class="result-line"><span>Wins we expected vs got</span><strong>${settled.reduce((s, x) => s + x.prob, 0).toFixed(1)} vs ${settled.filter(x => x.status === 'WON').length}</strong></div><div class="line"></div>
      ${j.length ? `<div class="data-list">${j.slice(0, 15).map(x => `<div class="data-row"><div><strong>${esc(x.name)}</strong><small>${esc(new Date(x.at).toLocaleString())} · ${esc(x.evidence || 'no notes')}</small></div><div class="row-actions"><strong>${pct(x.prob)} @ ${(x.ask * 100).toFixed(1)}¢</strong>${x.status === 'UNRESOLVED' ? `<button class="sm-btn" data-settle="${x.id}:WON">Won</button><button class="sm-btn" data-settle="${x.id}:LOST">Lost</button><button class="sm-btn" data-settle="${x.id}:VOID">Void</button>` : `<span class="badge ${x.status === 'WON' ? 'green' : x.status === 'LOST' ? 'red' : ''}">${x.status} ${x.status !== 'VOID' ? dollar(pnl(x)) : ''}</span>`}</div></div>`).join('')}</div>` : emptyBlock('No pretend bets yet', 'Add one whenever you would have bet. Record losses too, or the results lie.')}</div></div></div>`;
}
const pnl = x => x.status === 'WON' ? x.stake * (1 - (x.feePct || 0) / 100) / x.ask - x.stake : x.status === 'LOST' ? -x.stake : 0;

function renderSettings() {
  const s = state.settings;
  return `${sectionHeader('Alerts & settings', 'The defaults are strict on purpose. Fewer, better alerts.')}${help(['<b>Payout range</b>: only consider bets that pay back between these amounts (3× means $5 pays back $15).', '<b>Bet size</b>: the amount used to check real prices.', '<b>Minimum expected profit</b>: how big an edge must be before we call it worth a look.', '<b>Fee</b>: Polymarket\'s fee. Look it up on Polymarket, enter it, and tick the box.', 'Change something, then tap Save settings.'])}
    <form id="settingsForm"><div class="two-up"><div class="panel"><div class="panel-head"><div class="panel-title">Basics</div><span class="badge">SAVED ON THIS DEVICE</span></div><div class="panel-pad form-grid">
      <div class="field"><label for="targetMin">Lowest payout (×)</label><input id="targetMin" name="min" type="number" min="1.01" max="20" step="0.25" value="${s.min}" /></div><div class="field"><label for="targetMax">Highest payout (×)</label><input id="targetMax" name="max" type="number" min="1.01" max="20" step="0.25" value="${s.max}" /></div>
      <div class="field"><label for="stake">Bet size ($)</label><input id="stake" name="stake" type="number" min="1" max="10000" step="1" value="${s.stake}" /><small>Used to check real prices.</small></div>
      <div class="field"><label for="refreshTime">Update every</label><select id="refreshTime" name="refresh">${[20, 30, 60, 120].map(x => `<option value="${x}" ${s.refresh === x ? 'selected' : ''}>${x} seconds</option>`).join('')}</select><small>While the app is open.</small></div>
      <div class="field"><label for="sims">Accuracy level</label><select id="sims" name="sims">${[[2000, 'Fast'], [4000, 'Normal'], [8000, 'Most precise']].map(([x, l]) => `<option value="${x}" ${s.sims === x ? 'selected' : ''}>${l}</option>`).join('')}</select><small>Higher uses more battery.</small></div></div></div>
    <div class="panel"><div class="panel-head"><div class="panel-title">Safety checks</div><span class="badge orange">STRICT</span></div><div class="panel-pad form-grid">
      <div class="field"><label for="minEV">Minimum expected profit (%)</label><input id="minEV" name="minEV" type="number" min="1" max="100" step="0.5" value="${s.minEV}" /></div><div class="field"><label for="maxQuoteAge">Oldest price allowed (seconds)</label><input id="maxQuoteAge" name="maxQuoteAge" type="number" min="2" max="60" step="1" value="${s.maxQuoteAge}" /></div>
      <div class="field"><label for="maxSlippageC">Max price jump from your bet (¢)</label><input id="maxSlippageC" name="maxSlippageC" type="number" min="0" max="10" step="0.5" value="${s.maxSlippageC}" /></div><div class="field"><label for="feePct">Polymarket fee (%)</label><input id="feePct" name="feePct" type="number" min="0" max="20" step="0.01" value="${Number.isFinite(s.feePct) ? s.feePct : ''}" placeholder="not set" /></div>
      <div class="field" style="grid-column:1/-1"><label class="check"><input type="checkbox" name="feeVerified" ${s.feeVerified ? 'checked' : ''}/> I checked this fee on Polymarket's website</label></div></div></div></div>
      <div class="field" style="margin-top:14px;max-width:240px"><button class="primary-btn" type="submit">Save settings</button></div></form>
    <div class="two-up" style="margin-top:16px"><div class="panel"><div class="panel-head"><div class="panel-title">Alerts while the app is open</div><span class="badge green">WORKING</span></div><div class="panel-pad">
      <div class="result-line"><span>"Worth a look" alerts</span><span class="badge orange">ON · NONE WHILE TESTING</span></div>
      <div class="result-line"><span>Game alerts (comebacks, big swings)</span><button class="sm-btn" data-toggle="researchWatch">${s.researchWatch ? 'ON' : 'OFF'}</button></div>
      <div class="result-line"><span>Sound</span><button class="sm-btn" data-toggle="sound">${s.sound ? 'ON' : 'OFF'}</button></div>
      <div class="result-line"><span>Phone notifications</span><button class="sm-btn" data-test-notification="true">Send a test</button></div>
      <p class="muted small-note">No repeats. Alerts go stale after 2 minutes. Game alerts tell you what's happening; they are not bets.</p></div></div>
    <div class="panel"><div class="panel-head"><div class="panel-title">When the app is closed</div><span class="badge red">COMING NEXT</span></div><div class="panel-pad">
      <div class="result-line"><span>Checking games in the background</span><span class="badge red">NOT YET</span></div><div class="result-line"><span>iPhone alerts</span><span class="badge red">NOT YET</span></div><div class="result-line"><span>Real-money alerts</span><span class="badge red">AFTER TESTING</span></div>
      <p class="muted small-note">Next step: a free timer checks games every couple of minutes from 6 pm (noon on weekends) and sends alerts to your iPhone, even with the app closed.</p></div></div></div>
    ${sectionHeader('Recent alerts', 'Since you opened the app.')}<div class="panel panel-pad">${state.alerts.length ? `<div class="data-list">${state.alerts.slice(0, 20).map(a => `<div class="data-row"><div><strong>${esc(a.title)}</strong><small>${esc(a.body)}</small></div><span class="badge ${a.kind === 'qualified' ? 'green' : ''}">${esc(a.kind.toUpperCase())} · ${esc(ago(a.at))}${Date.now() > a.expires ? ' · EXPIRED' : ''}</span></div>`).join('')}</div>` : '<p class="muted">No alerts yet.</p>'}</div>`;
}

// ---------- alerts ----------
function beep() { try { const C = window.AudioContext || window.webkitAudioContext; const c = new C(), o = c.createOscillator(), g = c.createGain(); o.frequency.value = 880; g.gain.value = 0.05; o.connect(g); g.connect(c.destination); o.start(); setTimeout(() => { o.stop(); c.close(); }, 160); } catch { } }
function raise(kind, key, title, body) {
  const now = Date.now(), last = state.alertSeen.get(key);
  if (last && now - last < (kind === 'qualified' ? 120_000 : 600_000)) return;
  state.alertSeen.set(key, now);
  state.alerts.unshift({ kind, title, body, at: new Date().toISOString(), expires: now + 120_000 });
  toast(`${title}: ${body}`);
  if (state.settings.sound) beep();
  if ('Notification' in window && Notification.permission === 'granted' && document.visibilityState !== 'visible') { try { new Notification(title, { body, icon: '/assets/icon-192.png' }); } catch { } }
}
function maybeAlert(m, g, link, p, ev) {
  if (!ev.actionable || isDemo()) return;
  raise('qualified', `${m.slug}|${link.team}|${Math.round(p * 100)}|${ev.avgPrice?.toFixed(2)}`, `${g.away.abbr} at ${g.home.abbr}: worth a look`, `Our chance ${pct(p)} vs price ${(ev.avgPrice * 100).toFixed(1)}¢ (pays ${ev.grossMultiple.toFixed(2)}×). Check the price on Polymarket before you act.`);
}
function researchWatch() {
  if (!state.settings.researchWatch || isDemo()) return;
  for (const f of findings()) raise('research', `rw|${f.g.id}|${f.text.slice(0, 40)}`, 'Game alert (not a bet)', f.text);
}

// ---------- data flow ----------
function render() {
  $('currentPageLabel').textContent = PAGE_NAMES[state.page];
  document.querySelector('.hero')?.toggleAttribute('hidden', state.page !== 'overview');
  const count = currentGames().filter(g => g.status === 'in').length; $('liveCount').textContent = count;
  $('sourceStatus').innerHTML = `<span class="status-indicator ${isDemo() || state.loading || state.scoresError || state.marketsError || !state.online ? 'muted' : ''}"></span>${isDemo() ? 'DEMO MODE' : !state.online ? 'Offline' : state.loading ? 'Connecting…' : state.scoresError || state.marketsError ? 'Feed limited' : 'Read-only feeds'}`;
  document.querySelectorAll('[data-page]').forEach(x => { x.classList.toggle('active', x.dataset.page === state.page && x.classList.contains('nav-link')); });
  document.querySelectorAll('[data-sport]').forEach(x => x.classList.toggle('active', x.dataset.sport === state.sport));
  document.querySelectorAll('[data-mode]').forEach(x => x.classList.toggle('active', x.dataset.mode === state.mode));
  $('noticeArea').innerHTML = renderNotice();
  const focusId = document.activeElement?.id;
  $('pageBody').innerHTML = ({ overview: renderOverview, live: renderLive, players: renderPlayers, opportunities: renderOpportunities, parlays: renderParlays, performance: renderPerformance, settings: renderSettings })[state.page]();
  if (focusId && $(focusId) && /^(playerSearch)$/.test(focusId)) { const el = $(focusId); el.focus(); el.setSelectionRange?.(el.value.length, el.value.length); }
}
async function fetchAPI(path) { const res = await fetch(path, { cache: 'no-store' }); const json = await res.json().catch(() => null); if (!res.ok || !json?.ok) throw new Error(json?.error || `HTTP ${res.status}`); return json; }
async function refresh() {
  if (isDemo()) {
    state.scores = { ok: true, league: 'nba', games: state.sport === 'nba' ? DEMO_GAMES : [], fetchedAt: new Date().toISOString() }; state.markets = { ok: true, events: state.sport === 'nba' ? DEMO_EVENTS : [], fetchedAt: new Date().toISOString() };
    state.scoresError = null; state.marketsError = null; state.loading = false; state.lastRefresh = new Date().toISOString(); predictAll(); render(); return;
  }
  state.loading = !state.scores; state.scoresError = null; state.marketsError = null; render();
  const [scores, markets] = await Promise.allSettled([fetchAPI(`/api/scores?league=${state.sport}`), fetchAPI(`/api/markets?league=${state.sport}`)]);
  if (isDemo()) return; // user switched mode mid-flight: never mix live into demo
  state.scores = scores.status === 'fulfilled' ? scores.value : null;
  state.markets = markets.status === 'fulfilled' ? markets.value : null;
  state.scoresError = scores.status === 'rejected' ? scores.reason.message : null;
  state.marketsError = markets.status === 'rejected' ? markets.reason.message : null;
  state.loading = false; state.lastRefresh = new Date().toISOString();
  predictAll(); researchWatch(); render();
}
function nav(page) { if (!PAGE_NAMES[page]) return; state.page = page; history.replaceState(null, '', `#${page}`); render(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
async function getBook(slug) {
  if (isDemo()) {
    const ask = slug.includes('2') ? 0.24 : 0.29;
    state.books[slug] = { ok: true, synthetic: true, state: 'MARKET_STATE_OPEN', open: true, quoteTime: new Date().toISOString(), bestAsk: ask, bestBid: ask - 0.02, offers: [{ px: ask, qty: 40 }, { px: ask + 0.02, qty: 200 }], bids: [{ px: ask - 0.02, qty: 50 }] };
    render(); toast('Demo price. Not real.'); return;
  }
  toast('Fetching the current order book…');
  try { state.books[slug] = await fetchAPI(`/api/book?slug=${encodeURIComponent(slug)}`); render(); }
  catch (e) { state.books[slug] = { error: e.message }; render(); toast(`Order book unavailable: ${e.message}`); }
}
async function getDetails(id) {
  if (isDemo()) return;
  try { state.details[id] = await fetchAPI(`/api/game?league=${state.sport}&id=${encodeURIComponent(id)}`); render(); toast('Box score loaded from ESPN.'); }
  catch (e) { state.details[id] = { error: e.message }; render(); toast('Box score unavailable.'); }
}
function addLeg(form) {
  const f = new FormData(form); const p = Number(f.get('p')) / 100, m = Number(f.get('multiplier'));
  if (!Number.isFinite(p) || p <= 0 || p >= 1 || !Number.isFinite(m) || m <= 1 || state.legs.length >= 20) return toast('Please enter valid inputs. Maximum 20 legs.');
  state.legs.push({ id: Date.now(), label: String(f.get('label')).slice(0, 80), p, multiplier: m }); save('legs', state.legs); render();
}
function addJournal(form) {
  const f = new FormData(form), stake = Number(f.get('stake')), prob = Number(f.get('prob')) / 100, ask = Number(f.get('ask')) / 100, feePct = Number(f.get('fee') || 0);
  if (!(stake > 0 && prob > 0 && prob < 1 && ask > 0 && ask < 1 && feePct >= 0 && feePct < 20)) return toast('Please check the numbers you entered.');
  state.journal.unshift({ id: Date.now(), name: String(f.get('name')).slice(0, 160), evidence: String(f.get('evidence') || '').slice(0, 500), stake, prob, ask, feePct, at: new Date().toISOString(), status: 'UNRESOLVED', modelVersions: [state.models.pregame?.modelVersion, state.models.live?.modelVersion].filter(Boolean) });
  save('journal', state.journal); render(); toast('Pretend bet saved on this device.');
}
function exportJournal() { const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), journal: state.journal, prospectiveLog: state.predLog, mappings: state.links, note: 'User-entered simulated positions, not actual trades.' }, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'sportspilot-paper-journal.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
async function notificationTest() {
  if (!('Notification' in window)) return toast('This browser does not support notifications. On iPhone, add SportsPilot to the Home Screen first.');
  try { const permission = await Notification.requestPermission(); if (permission === 'granted') { new Notification('SportsPilot notification test', { body: 'Test only. Background alerts are not active.', icon: '/assets/icon-192.png' }); } else toast('Notification permission was not granted.'); }
  catch { toast('Notification test unavailable in this browser context.'); }
}
function handleClick(e) {
  const el = e.target.closest('[data-page],[data-sport],[data-mode],[data-game],[data-book],[data-load-game],[data-remove-leg],[data-test-notification],[data-export],[data-settle],[data-toggle]'); if (!el) return;
  if (el.dataset.page) { nav(el.dataset.page); return; }
  if (el.dataset.sport) { state.sport = el.dataset.sport; state.selectedGame = null; state.details = {}; state.books = {}; state.scores = null; state.preds = {}; refresh(); return; }
  if (el.dataset.mode) { if (el.dataset.mode === state.mode) return; state.mode = el.dataset.mode; state.selectedGame = null; state.details = {}; state.books = {}; state.scores = null; state.markets = null; state.preds = {}; state.history = {}; refresh(); return; }
  if (el.dataset.game) { state.selectedGame = el.dataset.game; nav('live'); return; }
  if (el.dataset.book) { getBook(el.dataset.book); return; }
  if (el.dataset.loadGame) { getDetails(el.dataset.loadGame); return; }
  if (el.dataset.removeLeg) { state.legs = state.legs.filter(l => l.id !== Number(el.dataset.removeLeg)); save('legs', state.legs); render(); return; }
  if (el.dataset.testNotification) { notificationTest(); return; }
  if (el.dataset.export) { exportJournal(); return; }
  if (el.dataset.settle) { const [id, st] = el.dataset.settle.split(':'); const x = state.journal.find(j => String(j.id) === id); if (x) { x.status = st; x.settledAt = new Date().toISOString(); save('journal', state.journal); render(); } return; }
  if (el.dataset.toggle) { const k = el.dataset.toggle; state.settings[k] = !state.settings[k]; save('settings', state.settings); render(); }
}
function handleSubmit(e) {
  const t = e.target;
  if (t.id === 'addLegForm') { e.preventDefault(); addLeg(t); }
  else if (t.id === 'journalForm') { e.preventDefault(); addJournal(t); }
  else if (t.dataset.linkForm) {
    e.preventDefault(); const f = new FormData(t);
    if (!f.get('gameId') || !f.get('team') || !f.get('confirm')) return toast('Choose a game, a side, and confirm you read the rules.');
    state.links[t.dataset.linkForm] = { gameId: String(f.get('gameId')), team: String(f.get('team')), side: 'YES', verifiedAt: new Date().toISOString(), by: 'user' }; save('links', state.links); render(); toast('Match saved.');
  } else if (t.id === 'settingsForm') {
    e.preventDefault(); const f = new FormData(t); const n = k => Number(f.get(k));
    const s = { ...state.settings, min: n('min'), max: n('max'), refresh: n('refresh'), stake: n('stake'), sims: n('sims'), minEV: n('minEV'), maxQuoteAge: n('maxQuoteAge'), maxSlippageC: n('maxSlippageC'), feePct: f.get('feePct') === '' ? null : n('feePct'), feeVerified: Boolean(f.get('feeVerified')) };
    if (!(s.min > 1 && s.max <= 20 && s.min <= s.max && s.stake >= 1 && s.minEV >= 1 && s.maxQuoteAge >= 2)) return toast('Something looks off. Check the payout range and bet size.');
    if (s.feeVerified && s.feePct === null) s.feeVerified = false;
    state.settings = s; save('settings', s); predictAll(); render(); toast('Settings saved on this device.');
  }
}
function handleInput(e) {
  if (e.target.matches('[data-player-team]')) { state.playerTeam = Number(e.target.value); state.playerQuery = ''; render(); }
  else if (e.target.matches('[data-player-search]')) { state.playerQuery = e.target.value.slice(0, 40); render(); }
}
document.addEventListener('click', handleClick); document.addEventListener('submit', handleSubmit);
document.addEventListener('change', e => { if (e.target.matches('[data-player-team]')) handleInput(e); });
document.addEventListener('input', e => { if (e.target.matches('[data-player-search]')) handleInput(e); });
window.addEventListener('online', () => { state.online = true; refresh(); });
window.addEventListener('offline', () => { state.online = false; render(); });
$('refreshBtn').addEventListener('click', () => refresh()); $('settingsQuick').addEventListener('click', () => nav('settings'));
const hash = location.hash.replace('#', ''); if (PAGE_NAMES[hash]) state.page = hash;
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('/sw.js').catch(() => { });
render();
loadModels().then(refresh);
setInterval(() => { if (document.visibilityState === 'visible' && state.mode === 'live' && state.online && !state.loading && state.lastRefresh && Date.now() - Date.parse(state.lastRefresh) >= state.settings.refresh * 1000) refresh(); }, 5000);
