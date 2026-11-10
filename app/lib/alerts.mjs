// Alert rules shared by the open app and the background scanner. Model-only research
// notices (never "bet this"). Pure functions: no network, no storage.

const pct = v => `${Math.round(v * 100)}%`;

/** Notable situations in one game, from our own model output only. */
export function gameFindings(g, r) {
  const out = [];
  if (!r) return out;
  if (r.live?.available) {
    const m = g.home.score - g.away.score, homeTrails = m < 0;
    const trail = homeTrails ? g.home.abbr : g.away.abbr, lead = homeTrails ? g.away.abbr : g.home.abbr;
    const pTrail = homeTrails ? r.live.homeProbability : 1 - r.live.homeProbability;
    if (Math.abs(m) >= 6 && pTrail >= 0.2 && pTrail <= 0.45) {
      out.push({ type: 'comeback', key: `${g.id}|comeback|${trail}`, title: `${trail} still alive vs ${lead}`,
        body: `${trail} trails by ${Math.abs(m)} (${g.statusText || ''}) but our model gives them ${pct(pTrail)}.`, text: `${trail} trails by ${Math.abs(m)} but keeps a ${pct(pTrail)} chance (strength + time left).` });
    }
    if (r.pregame?.available && Math.abs(r.live.homeProbability - r.pregame.homeProbability) >= 0.25) {
      const dir = r.live.homeProbability > r.pregame.homeProbability ? 'up' : 'down';
      out.push({ type: 'swing', key: `${g.id}|swing|${dir}`, title: `Big swing: ${g.away.abbr} at ${g.home.abbr}`,
        body: `${g.home.abbr} win chance ${pct(r.pregame.homeProbability)} before tip, ${pct(r.live.homeProbability)} now (${g.statusText || ''}).`, text: `${g.home.abbr} win chance moved ${pct(r.pregame.homeProbability)} → ${pct(r.live.homeProbability)} since tip.` });
    }
  } else if (g.status === 'pre' && r.pregame?.available) {
    const p = r.pregame.homeProbability;
    if (Math.abs(p - 0.5) <= 0.06) out.push({ type: 'coinflip', key: `${g.id}|coinflip`, title: 'Close matchup', body: `${g.away.abbr} at ${g.home.abbr} projects as a coin flip.`, text: `${g.away.abbr} at ${g.home.abbr} projects as a coin flip (${pct(p)} home).`, quiet: true });
  }
  return out;
}

/** True when a key may be sent again (one notice per game situation per window). */
export function shouldSend(lastSentMs, nowMs, windowMs = 20 * 60 * 1000) {
  return !Number.isFinite(lastSentMs) || nowMs - lastSentMs >= windowMs;
}

/** Push services browsers actually use. Anything else is rejected at subscribe time. */
export function allowedPushEndpoint(url) {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:') return false;
    return /(^|\.)push\.apple\.com$|(^|\.)fcm\.googleapis\.com$|(^|\.)push\.services\.mozilla\.com$|(^|\.)notify\.windows\.com$/.test(u.hostname);
  } catch { return false; }
}

/** Game windows (US/Eastern) when scanning is worth doing: weekdays 6pm-2am, weekends 12pm-2am. */
export function inGameWindow(date = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short', hour: 'numeric', hourCycle: 'h23' }).formatToParts(date).map(p => [p.type, p.value]));
  const h = Number(parts.hour), wd = parts.weekday;
  const weekend = wd === 'Sat' || wd === 'Sun';
  return h < 2 || h >= (weekend ? 12 : 18);
}
