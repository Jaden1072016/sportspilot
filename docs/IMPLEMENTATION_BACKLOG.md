# Implementation backlog (single source of truth)

Updated 2026-11-09, milestone v0.2. Priority: correctness and traceability > design > alert volume. $0 paid APIs.

Status key: **Implemented** (code exists) / **Tested offline** (automated tests or historical validation) / **Live verified** (run against the real upstream) / **Gated** (blocked from real-money use).

| Module | Implemented | Tested offline | Live verified | Still gated |
|---|---|---|---|---|
| Historical NBA ingestion (hoopR / ESPN-derived, GitHub releases) | Yes | Yes (row counts, hashes, label sanity) | Yes (downloaded 2026-11-09) | Research-use terms to re-check before commercial use |
| Team ratings (margin Elo, off/def/pace, learned home edge) | Yes | Yes | n/a (offline) | Ratings go stale; refresh snapshot every 1-3 days |
| Pregame win model NBA-PREGAME-v1.0 | Yes | Yes, season walk-forward 2019-2027 | No | Trails sportsbook line on average; research status |
| Lineup-aware pregame variant | Yes (trained) | Yes (lineup-confirmed scenario) | No | Needs verified inactive/injury feed; not used live |
| Live win model NBA-LIVE-v1.0 (MC + closed form ensemble) | Yes | Yes, 20k held-out states 2023-2027 | No | No on-court/foul/possession inputs; research status |
| ESPN scoreboard / summary adapters | Yes (clock, halftime, possession, injuries) | Yes (fixtures) | **No** (blocked in build sandbox) | Run `npm run verify:live` |
| Polymarket US events / BBO / order book adapters | Yes (SDK-aligned schemas) | Yes (fixtures) | **No** | Run `npm run verify:live`; confirm event route |
| Size-weighted fill, YES/NO side math | Yes | Yes | No | |
| Opportunity gate (fail-closed, named blockers) | Yes | Yes | n/a | Fees unverified; model research status |
| Manual contract-to-game mapping with provenance | Yes (local, timestamped) | UI test | No | Automatic mapping not built |
| Prospective pregame log (frozen pre-tip, scored post-final) | Yes | UI only | Starts when you use it live | Needs hundreds of games |
| Paper journal with settlement, P&L, drawdown, fees | Yes | UI test | n/a | |
| In-app alerts (dedupe, expiry, sound, research-watch) | Yes | Partial | No | Qualified alerts cannot fire while gated |
| Player intelligence (rotation value) | Yes | Via pregame validation | n/a | Prop probabilities not built |
| Player-prop distributions | **No** | | | Phase 4 |
| Correlated parlay engine | Partial (joint-from-simulation function + tests) | Yes | | Needs prop model; native Combo needs authenticated RFQ |
| Background scanner + iPhone push | **No** | | | Phase 7 |
| NFL / MLB models | **No** | | | Phases after NBA |
| PWA shell, offline handling, CSP, dist-only publishing | Yes | UI test at 390px and 1440px | Not on a real iPhone | Test on device after deploy |

## Next priorities (in order)
1. [ ] **Run `cd app && npm run verify:live` on your machine** and send me `tests/fixtures/live/<date>/verify-report.json`. Turns every "Live verified: No" for ESPN/Polymarket into evidence and fixes any schema gaps.
2. [ ] Deploy to Netlify; confirm functions and `/api/health`; install on iPhone.
3. [ ] Daily rating refresh without Python: Node catch-up from ESPN `scoreboard?dates=` for games after the snapshot (adapter already supports `date`).
4. [ ] Verified injury/inactive feed (ESPN summary `injuries` block, fail-closed) so the lineup-aware model (log loss 0.612 vs 0.622) can run live.
5. [ ] Phase 4: player minutes model + count distributions (negative binomial vs Poisson vs empirical) for PTS/REB/AST/3PM, validated by threshold and role.
6. [ ] Phase 5: same-game correlated simulation for parlays using `jointFromSimulations`.
7. [ ] Verify Polymarket US fee schedule from the official source; mark fee verified only then.
8. [ ] Server-side scanner (user-owned computer or free scheduled job) + VAPID web push + iPhone end-to-end test.
9. [ ] Promote model out of RESEARCH status only after prospective paper results with honest intervals (see ACCEPTANCE_GATES.md).

## Done in v0.2
- [x] Audit of starter; 11 original tests preserved (one fixture updated to include team ids, now required).
- [x] Fixed: final-minute ESPN clock ("34.5") made the model blank in the last minute.
- [x] Fixed: BBO has no exchange timestamp (per official SDK), so the old freshness gate could never pass; switched to order book with `state` + `transactTime`.
- [x] Fixed: netlify publish "." exposed server code, tests and docs; now `dist/` with an allowlist.
- [x] Fixed: wildcard CORS on API removed; CSP added.
- [x] Fixed: All-Star/Rising Stars exhibitions were labeled regular season in source data; filtered.
- [x] Added: retries/backoff/Retry-After, TTL cache, circuit breaker, concurrency cap.
- [x] Added: walk-forward validation reports in `docs/reports/`.

## What NOT to do (unchanged)
- No paid data keys or signups. No Polymarket International substitution. No renaming market odds as model output. No fake prop/correlation numbers. No "guaranteed" language, auto-trading, or claimed background alerts before end-to-end proof.
