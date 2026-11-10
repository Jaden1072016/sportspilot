# Acceptance gates, QA matrix, and release discipline

## The highest-priority rule
**No code or test suite can promise positive trading returns.** A successful API fetch or model simulation is not evidence of predictive superiority or positive expected value. The user intends real-money decisions. The app must keep uncertain output in a research-only state until audited.

## Gate 0 — Can run and explain its current state (starter complete)
- [x] Node 20+ single-command local run, no paid external packages needed (`npm run dev`).
- [x] Unit tests use Node built-in test runner and pass locally.
- [x] Desktop/mobile polished layout and installable PWA shell.
- [x] Synthetic demo unmissably labeled.
- [x] Strict separation of independent model inputs from market quotes.
- [x] Fail-closed blockers for stale quotes, unknown fees, unvalidated model, unverified mappings and order depth.
- [ ] Actual upstream API contract tested online in intended host/network (not verified in creation environment).
- [ ] Manual iPhone screen-reader, Home Screen and Safari testing.

## Gate 1 — Reliable data
- [ ] NBA scoreboard and game summary live 200/schema tests on at least 10 game days, including pre/in/post, delays, no games, OT and postponed.
- [ ] Historical data reproducibility with timestamps, licensing permission, rate-limit policy and file integrity checks.
- [ ] Player/team ID reconciliation with true roster and contract data; exact side and line verification. Zero silent fuzzy matches.
- [ ] Correct quote side and BBO/depth at minimum 3 market types, 3 sports, normal and halted; correct quote timestamp / source age.
- [ ] Error injection tests: 401/403/429, partial JSON, missing player, source offline, clock inconsistency, 200-OK invalid schema, empty markets, suspended market, market expiration.
- [ ] Revalidation when game score and market quote carry materially different timestamp windows.

## Gate 2 — Real independent probability engine
- [ ] Train without Polymarket odds in feature columns or predicted labels; versioned feature and label registry.
- [ ] Strict chronological split, no hindsight leakage. Freeze model before untouched test and replay.
- [ ] Brier score, log loss, calibration by probability band/time/league, proper confidence intervals and simple baseline comparisons.
- [ ] Evaluate high-return 3–5× price band separately with enough outcomes for meaningful uncertainty.
- [ ] Validate lineup, minutes/usage and injury timestamps as of prediction time; no invented observations.
- [ ] Reproducible simulation seeds, Monte Carlo error measurement, and boundary tests for regulation, overtime, blowout, foul-outs.
- [ ] Prop distribution validation by player groups, thresholds and observed variance.
- [ ] Correlation validation for shared-game parlay legs; native Combo legality verified.

## Gate 3 — Realistic execution and backtesting
- [ ] Calculate dollar-specific executable weighted average ask from order-book depth; not just top BBO.
- [ ] Implement exact currently published fees from provider and minimum order constraints, no generic hardcoded fake rate.
- [ ] Prevent multiple assumptions of filling a fast price at a stale time; log quote time and alert receipt time.
- [ ] Paper positions reconcile to actual resolution and settlement (user independently verifies first batches).
- [ ] Out-of-sample walk-forward paper results show positive risk-adjusted edge **with uncertainty intervals that do not justify overconfidence**; no fabricated target ROI or selective reporting. Compare all alerts and all eligible candidates, including losses.
- [ ] Hard stop after data outage / model drift / repeated mis-mapping / missing settlement.

## Gate 4 — Alerts and mobile
- [ ] While app visible, source-aware update interval and stale expiry; dedupe and test notification.
- [ ] Background worker really runs with app closed; document cost and uptime on chosen free tier.
- [ ] Real signed web push on installed iPhone; consent/revoke, no leaked endpoint or VAPID private key.
- [ ] End-to-end alert latency; expiration, reopen/refresh and misleading stale alert suppression.
- [ ] Battery/network interruption, screen locked, Wi-Fi→cellular change, offline, expired worker and hosting outages.

## Gate 5 — Product quality and integrity
- [ ] No unofficial NBA branding without permission; custom original brand and illustration.
- [ ] Responsive layouts at 375px, 390px, 430px, 768px, 1024px and desktop; landscape support.
- [ ] Keyboard navigation, touch targets, high contrast, reduced motion, semantic labels and focus states.
- [ ] Rate-limit backoff, circuit-breaker, privacy and data retention review.
- [ ] All 'BUY', 'EDGE', 'CONFIDENT', 'BEST' claims reviewed for mathematical support and warnings.
- [ ] No payment info, user passwords, or Polymarket trading credential storage.

## Test inventory (starter)
- Market price does not influence independent score/clock prediction.
- Model missing required records or clock fails closed.
- Mathematical `P/ask - 1`, multiplier, independent parlay joint probability.
- Stale BBO, unknown fees, uncalibrated model suppress signals.
- ESPN and Polymarket schema adapters normalize fixture structures and reject unknown wrappers.

## Critical future property-based / integration tests for Claude
- Market team ID side-swapped but text similar → reject mapping.
- Market says "first half" but game state full game → reject.
- Market says "under 5.5" but model computes 5+ → reject.
- Different overtime settlement rules → reject until verified.
- A 30¢ headline ask but $5 fills at 33¢ weighted average → correct multiple and EV.
- Two legs individually 80% but perfectly correlated → joint is 80%, not 64%; independent multiplication prohibited.
- Game finished but API shows old Q4 → expired, no alerts.
- BBO response lacks trade/source timestamp → data shown but not eligible to trigger trade alert.
- Hot reload from synthetic demo to live data → all synthetic records cleared.
- Player scratched 30 seconds after lineup confirmation → alert invalidated.
- Push sent after quote expired → notification carries EXPIRED, no 'trade now' CTA.

## Every Claude output must include a compact status table
`Module | Implemented | Offline tests | Live verified | Still gated`.
If live verified is 'No', say exactly why. Avoid any guarantee of a 10/10 economic outcome.
