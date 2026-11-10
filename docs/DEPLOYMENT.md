# Local run, Netlify deployment, iPhone install

## No-install local run (working starter)
1. Install Node.js 20 or later. In terminal, `cd app`.
2. `npm run dev` — runs the provided Node built-in static and API server (no npm dependency installation required).
3. Open http://127.0.0.1:4173 in a browser.
4. Tap SYNTHETIC DEMO for fictional data. Live mode attempts ESPN/Polymarket US endpoints in your runtime's network; failed endpoints display errors.
5. `npm test` and `npm run test:smoke`.

`npm run dev:netlify` is an alternative if `netlify-cli` is installed. Unlike the local server, this uses a third-party CLI and may require logging in. It is NOT needed to run the prototype.

## Deploy on Netlify (the hosting product the user likely meant)
Netlify hosts static PWA files and can execute included JavaScript functions on request. The project includes `netlify.toml`. The simplest path is Git-backed continuous deploy:
1. Create a private Git repository of **the contents of `app/`** (not the outer ZIP folder). No `.env` secrets in git.
2. In Netlify create a new site from the repo.
3. Base directory: repo root; publish directory `.`; function directory `netlify/functions`. `netlify.toml` contains these settings.
4. Build command: leave blank (or `echo static-ready`) because this is plain HTML/JS/CSS. No `npm install` needed for the runtime.
5. Deploy and test `/api/health`, `/api/scores?league=nba`, `/api/markets?league=nba` and one on-demand BBO from the site itself. If a provider returns 403, do not proxy around bans—evaluate compliant replacements or lower cadence.
6. Confirm Netlify's **current** published free plan, bandwidth, function invocation and schedule caps; budget alerts to avoid surprise billing. Never turn on paid auto-upgrades without approval.

Manual ZIP drag/drop for static hosting may not deploy serverless functions the same way as a repository-backed deployment; verify Netlify documentation and do not assume the functions survive drag/drop.

## Install on iPhone
1. Open the deployed HTTPS SportsPilot website in Safari (not a `file://` path).
2. Use Safari Share → **Add to Home Screen** → Add.
3. Open the installed SportsPilot icon and test responsive layout, app manifest, refresh and demo/live badge.
4. PWA install alone is **not** off-app push monitoring; that requires extra backend and push components described in `ALERTS_AND_PUSH.md`.

## No recurring API subscription does not mean guaranteed 24/7 no-cost operation
Public free APIs may impose restrictions, rate limits or terms. Always-on workers and frequent push can exceed free hosting limits. The starter refreshes only while the app is visible; off-app continuous monitoring is deliberately a future integration.

## Troubleshooting
- 'No games': verify actual sports schedule; offseason and no-game days exist. Do not populate fictional live games.
- 'Feed unverified': open API route in same deployed domain, check HTTP/JSON/schema, rate limit, terms. Try again conservatively.
- 'Markets empty': league slug or endpoint response wrapper may have changed; save a licensed sample response and adapt parser with tests; don't assume no markets exist universally.
- 'Unknown player stats': check `?event=` actual ESPN ID and `boxscore.players` schema. No 'predictions' until proper pipeline exists.
- 'BBO age unknown': this is correct if response lacks source transaction time; do not turn current HTTP fetch timestamp into a market event timestamp.
- 'Offline': cached app shell may render but **prices and live scores are never cached**; data will be unavailable.
- 'Push never arrives': expected in the starter. Do not solicit paid push API or market account credentials to 'fix' it.
