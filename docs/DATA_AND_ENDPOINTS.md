# Free market + sports data source contracts (checked 2026-11-09)

## Grounding sources — official where possible
- Polymarket US API introduction: https://docs.polymarket.us/api-reference/introduction
- Polymarket US market methods: https://docs.polymarket.us/api-reference/market/overview
- Polymarket US league events: https://docs.polymarket.us/api-reference/sports/get-events-by-league-slug
- Polymarket US market WS: https://docs.polymarket.us/api-reference/websocket/markets
- Polymarket US Combos overview: https://docs.polymarket.us/api-reference/combos/overview
- Polymarket US rates: https://docs.polymarket.us/api-reference/rate-limits
- Polymarket US terms/trading limits: https://docs.polymarket.us/learn/trading/access-and-limits/trading-restrictions
- ESPN JSON endpoints are **undocumented third-party interfaces**, not official supported public developer API. Independent reference: https://github.com/AndrewC776/ESPN-API ; secondary overview: https://sportsapis.dev/espn-api
- `nba_api` (optional future Python client to NBA-owned publicly accessible interfaces; may be blocked): https://github.com/swar/nba_api
- MLB (optional later): MLB Stats API data requires examining https://www.mlb.com/official-information/terms-of-use and source limits; do not assume unrestricted commercial reuse.

## Historical data (verified 2026-11-09)
- sportsdataverse / hoopR data releases on GitHub: ESPN NBA schedules, team box scores (2008-2027), player box scores (2016-2027), play-by-play (2019-2027). No key. Ingest with `python3 pipeline/ingest_hoopr.py --download` (needs pandas + pyarrow). Snapshot and hashes in `data/snapshot/manifest.json`.
- ESPN-published sportsbook spreads in play-by-play are stored in `market_baseline.csv` and used ONLY as a comparison baseline.
- All-Star exhibitions are labeled regular season in source; ingestion keeps ESPN team ids 1-30 only.

## Polymarket US schema notes from the official SDK (polymarket-us v2.4.1)
- BBO `marketData`: bestBid, bestAsk (Amount {value,currency}), bidDepth, askDepth, lastTradePx. **No timestamp.**
- Book `marketData`: bids/offers [{px: Amount, qty: string}], state (MARKET_STATE_OPEN, HALTED, SUSPENDED, ...), transactTime.
- `/v1/events` supports tagSlug, gameId, startTime filters; used as fallback if `/v2/leagues/{slug}/events` fails.
- Native Combos are created through authenticated RFQ endpoints; no-key access cannot see a Combo price.

## Polymarket US PUBLIC REST: NO KEY for read-only use
Base: `https://gateway.polymarket.us`
- League event listing: `GET /v2/leagues/nba/events` (NFL and MLB use analogous league slugs). Expected top-level `events` array or sectional wrapper; parse defensively, validate against actual response.
- Markets: `GET /v1/markets?active=true&categories=sports&limit=50` (alternative discovery).
- Top-of-book: `GET /v1/markets/{slug}/bbo`; current `marketData.bestAsk.value`, `marketData.bestBid.value`.
- Order book: `GET /v1/markets/{slug}/book` bids and offers with price+size and `transactTime`.
- Sports event and player lookup: see official docs; add only when verified.
- `sportsMarketTypeV2`: moneyline/spread/total/prop; verify market-side semantics.
- `comboEnabled` and native Combo creation/RFQ support need correct exact rules; market listing cannot prove a specific joint Combo is tradable at a guessed price.
- Scrutinize book `state` (OPEN vs HALTED, SUSPENDED, EXPIRED), side identity, minimum size, fees, tick size and order limits.

**Polymarket US WebSocket caveat:** `wss://api.polymarket.us/v1/ws/markets` requires an API key in the connection handshake according to official docs. That is not a no-key public socket. This package does **not** use it or include credentials. REST polling is the initial free no-key solution. If a user later intentionally enables a permitted free authenticated read-only channel, implement secrets on the server only, with limited scope, without mixing in trading functions. Do not claim such access already exists.

**Polymarket International is a different API/product.** Do not silently substitute Gamma/CLOB international event prices, WebSockets or settlement assumptions for Polymarket US.

## ESPN unofficial feeds (NO KEY; may fail/restrict)
- NBA scoreboard: `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard`
- NFL scoreboard: `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard`
- MLB scoreboard: `https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard`
- NBA game summary: `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event={ESPN_EVENT_ID}`
- NBA roster example (future): `/basketball/nba/teams/{teamId}/roster`
- Player and injury reports (future): provider-specific verified routes; any missing/late data disables dependent models.

This feed is not a documented, supported paid/unpaid commercial API product. Rate limits, CORS, coverage, terms and shape may change. Use cautious 30–120-second polling; do not bypass blocks, protections or paywalls. For more frequent game situations, use a licensed official no-cost route if actually available, or disclose limited refresh cadence.

## No API key included
No secrets exist in the ZIP. Public REST access needs none. `app/.env.example` contains comments, not credentials.

## Validation and fallback requirements for Claude
- Test real sample responses by league in deployed environment; create data fixtures with retrieval date and permissible retention terms.
- Distinguish provider event timestamp, HTTP response time, our model prediction timestamp, quote transaction timestamp and user notification timestamp.
- Do not claim a quote is fresh just because our HTTP response arrived recently. If `transactTime` is absent, treat market timestamp as unknown for real-money alert purposes.
- Errors 401/403/429/500, schema mismatches and empty arrays must never trigger fabricated odds or phantom opportunities.
- Backoff and circuit breaker on 429/5xx; no distributed unlimited bursts across devices.
- Enforce canonical ID maps, never fuzzy-match a similar team/player/market without verified evidence.
- Respect provider terms, redistribution licenses, attribution requirements and jurisdiction rules before production use.
