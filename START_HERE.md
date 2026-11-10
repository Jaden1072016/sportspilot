# SPORTSPILOT

> **v0.2 status (2026-11-09):** independent NBA pregame and live models are built and validated on held-out seasons (see `docs/reports/`). The app runs them for every game. Real-money signals remain gated. Current checklist: `docs/IMPLEMENTATION_BACKLOG.md`. First thing to run: `cd app && npm test && npm run verify:live && npm run dev`.

# SPORTSPILOT — ORIGINAL CLAUDE HANDOFF
**November 9, 2026 · NBA-first · zero paid sports APIs · phone-first · research only**

This ZIP contains a **runnable, polished, dependency-free starter research app** AND a development specification for Claude. It is not merely a mockup and it is **not yet a validated real-money trading system**. The near-term user goal is to make the independent prediction capability substantially stronger than a recycled market-odds view.

## Open this first
1. Unzip the package.
2. Open Claude and upload the ZIP if supported, or upload `CLAUDE.md`, `prompts/CLAUDE_MASTER_PROMPT.md`, and the `app` folder as a Claude Project. If the current Claude interface cannot ingest ZIP contents, unzip first and supply the key files.
3. Paste the entire text of `prompts/CLAUDE_MASTER_PROMPT.md` as the initial instruction.
4. Claude should read `CLAUDE.md`, the documentation in `docs/`, and the existing code **before** replacing or generating anything.
5. To run locally (Node.js 20+), open a terminal in `app` and run `npm run dev`. This uses **no npm install and no paid API keys**. Open `http://127.0.0.1:4173`.
6. Choose **SYNTHETIC DEMO** to see sample game cards without external data. All fictional data is prominently labeled. Choose **LIVE DATA** to try public feeds; if providers refuse access or change schema, the interface will say so rather than silently swapping fake values.
7. Run `npm test` and `npm run test:smoke` from the `app` directory. Requires only Node's built-in test runner.

## What is already implemented
- Responsive custom basketball-inspired interface in dark navy, electric orange, teal; desktop sidebar, mobile bottom navigation.
- Installable PWA manifest, icons, basic offline *shell* caching (never caches prices or game-data responses).
- NBA, NFL, MLB scoreboard public-source adapter; basketball model currently NBA only.
- Polymarket **US** public event listing and top-of-book market-price adapters.
- Strict separation of independent score/clock model from market price input.
- Experimental NBA baseline with transparent assumptions and sensitivity range; intentionally not certified.
- Basic player box-score fetch; these are observations, not prop forecasts.
- Manual parlay mathematics: probability product **only under independence**, explicitly not a real Combo quote.
- Paper hypothesis journal, JSON export, local settings, synthetic demo and browser notification test.
- Automated unit tests and fail-closed signal gate for uncalibrated models, stale prices, missing fees, unlinked contract sides, unverified depth.
- No login, trading credentials, orders, or auto-execution. No real-money alert is falsely presented as active.

## What is NOT implemented yet (Claude must build and validate)
- Historical data ingestion and **independently trained, calibrated, walk-forward-tested model**.
- Trusted lineup, injury, minutes, usage, team efficiency, opponent, pace, matchup, and fatigue feature pipelines.
- Player-prop probability distributions and joint-correlated parlay optimizer.
- Verified cross-provider game, team, player, contract/outcome-side mapping; correct YES versus NO execution.
- Full order-book depth / size-weighted average fill, verified fee model, slippage and Combo pricing.
- Persistent backend, continuously running **app-closed background scanner**, secure web-push subscription store and real push delivery.
- Resolved outcomes + automated settlement reconciliation, model monitoring, alert deduplication and robust paper-trading report.
- Live deployment on a real phone with 24/7 service-level validation.

## Non-negotiable promise to user
- User wants an expert/fan-level **independent** decision-support model, NOT a Polymarket clone.
- Polymarket supplies market availability, executable quote (when separately verified), rules, and settlement details, **never** target labels/features that leak its opinion into independent forecasts.
- Primarily live NBA moneylines, plus player-stat props/parlays; NFL second, MLB third.
- Gross payout target **3×–5×** stake; a $5 stake corresponds to $15–$25 total returned and $10–$20 gross profit if successful. This payout target does not imply high win probability.
- NO paid API subscriptions, hidden charges, unauthorized scraping, or fabricated credentials. No secrets included.
- Claude-first editing; simple mobile PWA install and Netlify deployment (Netlify is probably the hosting product the user was referring to).
- Always communicate source, quote timestamp, model revision, uncertainty, limitations, and exact reason if an opportunity is blocked.

## Verification status
- Code syntax and unit tests executed in generation environment. External sports and Polymarket upstream API responses were **not live-tested** in the build container due to network restrictions. The source endpoints were cross-referenced against public documentation as of the package date; Claude must run and verify them in its actual deployment environment.
- No claim of profitable edge is made. The baseline is illustrative and uncalibrated. Do not enable real-money alert badges without completing `docs/ACCEPTANCE_GATES.md`.

## Key documents
- `CLAUDE.md`: binding project rules and delivery checklist
- `prompts/CLAUDE_MASTER_PROMPT.md`: a single detailed prompt to paste into Claude
- `docs/ARCHITECTURE.md`: components, source of truth, storage, and milestone sequence
- `docs/INDEPENDENT_MODEL.md`: NBA team game-state and player-prop modeling specification
- `docs/DATA_AND_ENDPOINTS.md`: public source endpoints, permission limitations, WebSocket caveats
- `docs/ACCEPTANCE_GATES.md`: tests, release criteria, failure states
- `docs/ALERTS_AND_PUSH.md`: iPhone active alerts and app-closed push requirements
- `docs/DEPLOYMENT.md`: local run, Netlify deploy, free plan limitations, iPhone install
- `docs/DESIGN_SYSTEM.md`: visual tokens and accessibility
- `docs/SECURITY.md`: data safety, rate limits, legal and integrity considerations
- `docs/IMPLEMENTATION_BACKLOG.md`: prioritized Claude checklist
