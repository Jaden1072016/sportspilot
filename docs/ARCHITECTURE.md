# Architecture and delivery slices

## Current version: runnable read-only research prototype
```
User iPhone / Desktop browser (app/index.html, app/app.js, app/styles.css)
    ├── PWA shell (app/sw.js): caches UI assets ONLY
    ├── /api/scores  ─── ESPN unofficial NBA/NFL/MLB scoreboard
    ├── /api/game    ─── ESPN game summary, observed player box score
    ├── /api/markets ─── Polymarket US public league events + listed markets
    └── /api/quote   ─── Polymarket US public BBO top-of-book quote

app/lib/model.mjs  ← ESPN game score, clock, records; NEVER Polymarket data
app/lib/value.mjs  ← independent probability + separately verified quote
app/tests           ← deterministic math, contract, fail-closed controls
```

The browser fetches read-only internal API endpoints using Netlify functions (production) or the no-install Node.js local server. Backend functions use allowlisted fixed provider URLs, not caller-supplied arbitrary URLs. No credentials are required for these public endpoints. Live data depends on upstream terms, availability, serverless network behavior, and schema. There is no persistent cloud database in this starter.

## Desired complete version
```
Free permitted feeds
   ├─ Scoreboard + play-by-play + box scores
   ├─ Verified roster / injury / starters / minutes / substitutions
   ├─ Historical schedules, results, team and player game logs
   └─ Polymarket US market events, contract sides, depth, rules, fee terms
        ↓
Ingestion worker (rate limits, retries, hashes, UTC clocks, checkpoint)
        ↓
Immutable event snapshots + normalized typed tables (SQLite local or Postgres free tier)
        ↓
Independent NBA modeling stack (never market prices as inputs)
   ├─ Pregame team strength prior, schedule/rest/context
   ├─ In-game score/clock/possession + lineup changes
   ├─ Player minutes/usage/rates/injury and prop distributions
   └─ Correlated simulation across multi-leg same-game outcomes
        ↓
Out-of-sample evaluation + calibration + uncertainty / drift monitoring
        ↓
Market matching (game ID, team/player ID, exact side/line, rule version)
        ↓
Executable quote size/depth/slippage fees and eligible native Combo verification
        ↓
Research ranking / paper execution / audit trail
        ↓
Live dashboard and gated iPhone notifications (after release checks)
```

## Required tables and entities
`provider_source`: provider, endpoint, licensed_usage_state, queried_at, response_hash, source_timestamp, http_status, warnings.

`games`: internal_game_id, sport, season, start_utc, home_internal_id, away_internal_id, provider_ids, status, raw_refs.

`game_state_snapshots`: game_id, observed_at, source_asof, score, quarter, period_clock, possession, available_on_court_players, team fouls, injuries_asof, feature_hash.

`players`: internal_player_id, team_id, provider IDs and normalized aliases, effective date range.

`player_game_logs`: game/player/minutes/usage/PTS/REB/AST, opportunity stats, starter flag, opponent/pace/availability flags, observed_at.

`model_registry`: model_version, train_window, data cut, features, hyperparameters, calibration mapping, evaluation artifact hash, approval, approval timestamp.

`predictions`: prediction_id, model_version, game_id, event state snapshot ID, probability, uncertainty range, source_valid_until, explanations, created_at.

`market_links`: market_slug, Polymarket IDs, verified ESPN game_id, outcome side, exact player/threshold, market rule text hash, comboEnabled, verification method, verified_at.

`quotes`: market_slug, side, depth ladder, source_ts, retrieved_at, exact trade size, weighted-average executable ask, slippage, market status, fee schedule source/version.

`opportunities`: prediction_id, quote_id, expected ROI after modeled fees, payout multiplier, stale status, blockers, alert state, selection details.

`paper_positions`: entry_time, modeled quote, simulated fill, desired size, eventual result, settlement source, net P&L, data provenance.

`push_subscriptions`: opaque device identifier, per-device endpoint encrypted at rest, public keys, consent/time, retention, revoke timestamp, dedupe metadata. Auth and encryption required in production.

## Why source availability matters
1. An ESPN box score does not necessarily reveal *who is currently on the court*; do not label player stats as confirmed rotations.
2. ESPN's win probability fields (if returned) are **not** our independent prediction. Do not train against those probabilities as game outcome labels.
3. Polymarket book top ask describes just one price level; size and slippage can change a $5 real-money outcome.
4. Polymarket market event IDs may not correspond to ESPN event IDs. Never auto-join by similar text alone without checking date, participants, provider IDs, outcome/rules.
5. No active game or no market can be a valid result. The app should handle every empty state gracefully.

## Operating modes
- `SYNTHETIC_DEMO`: fictional team names, explicit label, no actionable signals.
- `LIVE_READ_ONLY`: fetches actual provider endpoints, displays data and experimental baseline, no alerts claiming profitability.
- `PAPER_VALIDATED` (future): validated model + precise simulated fills + settlement reconciliation; requires release gates.
- `RESEARCH_ALERTS` (future): alerts about probabilistic research candidates, with evidence and explicit risk, only after approved model and data gates.

No live account-trading mode is planned.
