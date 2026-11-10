# Build verification report: v0.2, 2026-11-09

## Executed in the Claude build workspace
- `npm test`: 39 tests pass (11 original + 28 new): clock parsing, scoreboard ids/possession, injuries fail-closed, order-book size-weighted fills, YES/NO side math, insufficient depth, opportunity gate blockers, correlated-parlay joint (80% not 64%), as-of ratings, seeded simulation reproducibility, end-of-game and overtime boundaries, halftime/end-of-period mapping, unknown-team and stale-rating blocks, static check that model code never imports market code, artifacts declare no market inputs, logistic regression recovery, HTTP retry/cache/fail-closed.
- `npm run model:all`: rebuilt both model artifacts from the 2026-11-09 data snapshot. Reports: `docs/reports/nba-pregame-validation.md`, `docs/reports/nba-live-validation.md`.
- Headless Chrome (real app via `scripts/local.mjs`) at 1440x900 and 390x844: every page, demo game model, sample order book, contract mapping, opportunity blockers, paper position settle, settings save, demo-to-live switch. No JavaScript errors; no synthetic data leaked into live mode; no horizontal overflow on iPhone width.
- Local server: `/api/health` OK; model files served; data, scripts and server files return 404.

## Not verified (and why)
- ESPN and Polymarket US live endpoints: the build workspace network only reaches GitHub and package registries. Polymarket schemas were aligned to the official `polymarket-us` SDK v2.4.1 type definitions instead. **Run `npm run verify:live` on your machine.**
- Netlify deploy, real iPhone install, real notifications, background push.
- Any profitable edge. Validation shows calibration and accuracy, not returns against executable prices.

## Release state
RESEARCH. Independent models validated on history; not cleared for real-money signals.
