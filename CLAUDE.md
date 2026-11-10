# CLAUDE.md — Binding engineering and product rules

Read `START_HERE.md`, every file in `docs/`, and the current source tree before editing. Do not delete the existing runnable prototype. Propose incremental changes and run tests after each stage.

## Mission
Build a premium, NBA-inspired **independent sports intelligence** product for a US user: live NBA first, football second, baseball third. Situational player/team knowledge; pregame and in-game win probabilities; verified player-prop distributions; native-combo-eligible parlays; $0 paid APIs; optional notifications while app is open and eventually when closed. User targets 3×–5× **gross returns**, NOT a promised win rate. Price is a comparison input only, not the independent model feature or prediction target.

## Core constraints
1. **NO PAID APIS.** Public Polymarket US REST and permitted no-key sports data. If free data is inadequate, show 'NOT AVAILABLE'; present a compliant fallback plan rather than purchasing or fabricating data.
2. Do not solicit, hardcode, or expose brokerage or Polymarket account keys. Public REST works for read-only market discovery; Polymarket US market WebSocket **does require authentication** according to current docs. Do not advertise unauthenticated WebSocket access.
3. No live order placement, automated wagers, money transfer, or credential scope in starter. Real-money research signals require separate release gates and user approval; execution remains manual.
4. Real-time games must be marked with **source and timestamp**. Expired/stale, suspended, unverified, missing or unsupported data must disable value signals. Never substitute synthetic figures or guess team matchups.
5. Default to rejecting unqualified opportunities. Never optimize for alert count, fake accuracy, a forced positive EV, or visually impressive but meaningless '90% confidence'.
6. No market-price leakage into independent modeling. Use quote **after** prediction; enforce with tests (the seed test `model does not import odds` must keep passing).
7. Avoid invented official team/player relationships. Cross-provider IDs must map via authoritative IDs or verified human reconciliation with recorded provenance.
8. Detailed player props must include minutes/usage/role/opponent/rest/injuries, variance, correlation, lineup confirmation and out-of-sample calibration; unsupported features must say 'not connected'.
9. Native Combo support **must be verified per market**. Do not treat merely multiplied prices as an executable Combo. Verify comboEnabled, allowed market types, quoted native Combo market and filled size.
10. Alerts/push when app closed require persisted subscriptions, explicit permission, backend scheduler, dedupe, TTL and real end-to-end device tests. This capability is currently **not implemented**. Do not say it is active until demonstrated.
11. Create clean code, small verified commits, fixture-backed contracts, deterministic math tests, exception handling, loading states, status banners, keyboard access, mobile layout and logs.
12. No unverified ROI, no 'guaranteed', 'can't lose', 'insider tips' or untestable accuracy claims.

## MUST show the user in each milestone
- Exactly what works NOW, what does NOT work, and which automated checks passed.
- Demo screenshot/preview + the source code, not a screenshot-only UI.
- Commands user can copy and run. Keep a Claude-chat-first workflow and minimize manual setup.
- Data source used; terms/access restrictions; cadence; how missing data is handled.
- A one-paragraph risk summary. If paid hosting or paid API seems unavoidable, first try a legal, legitimate no-fee fallback and clearly say what is sacrificed.

## Near-term milestone order
1. Preserve visual design and working local terminal; patch real-world free-API parsing using schema fixtures and deployment environment tests.
2. Build safe historical ingestion and reproducible dataset snapshots with collection timestamps.
3. Train separate pregame team strength and live NBA state models. Evaluate with temporal holdouts and calibration; compare with naive and market baselines.
4. Build possession, lineup and player-prop modeling: minutes, usage, opponent distributions, correlated same-game joint simulation.
5. Build exact contract matching + BBO + full-depth + fees + native Combo query, manual validation screen and audited EV.
6. Ship paper trading, evaluated notifications while visible, then persisted off-app monitoring and push on approved compliant free infrastructure.
7. Demonstrate acceptance criteria in `docs/ACCEPTANCE_GATES.md` before any recommendation describes actionable positive EV.

## Ready only when measured
A pretty dashboard is not a calibrated edge. Do not equate 'tests pass' with 'profitable'. At any uncertainty, fail closed and explain why.
