# SportsPilot app (v0.2.0)

Zero-runtime-dependency PWA. Node 20+.

```bash
npm run dev          # http://127.0.0.1:4173
npm test             # 39 unit/contract tests
npm run test:smoke   # file check
npm run verify:live  # one polite call to each real ESPN / Polymarket US endpoint; saves fixtures
npm run build        # dist/ (what Netlify publishes)
npm run model:all    # retrain + revalidate from ../data/snapshot (live validation takes ~5 min)
```

Refresh the data snapshot (needs Python with pandas + pyarrow):
```bash
cd .. && python3 pipeline/ingest_hoopr.py --download && cd app && npm run model:all
```

Key code: `lib/nba/` (models), `lib/sports.mjs` (ESPN), `lib/market.mjs` (Polymarket US), `lib/value.mjs` (gate), `models/` (artifacts), `scripts/nba/` (training/validation).
Research tool only: no orders, no credentials, no guaranteed outcomes.
