# Build verification: v0.5, 2026-11-10

## Automated
- `cd app && npm test`: 46 tests pass (data adapters, order-book math, opportunity gate, ratings as-of, live simulator, props distributions, injuries, Polymarket event props, alert rules, HTTP resilience, model/market separation).
- Headless browser (desktop 1440 and iPhone 390): every page, demo flow, opportunity blockers, paper trade settle, settings save, Back button and #page links, demo/live isolation. No JS errors, no horizontal overflow.

## Live (deployed site https://dulcet-rugelach-79bef5.netlify.app)
- ESPN scoreboard (today + tomorrow), box score (26 players + injuries block), injury report (94 entries): working.
- Polymarket US: league events, order book with OPEN state + exchange timestamp, event props (298 for BOS at PHI) with fee coefficient: working.
- Moneyline side mapping confirmed against polymarket.us page (first listed side = order book YES).
- Background scanner: scheduled function heartbeat advancing every 2 minutes; dry run returns cleanly. Push keys stored in Netlify Blobs; invalid subscription hosts rejected.
- Daily data refresh (GitHub Actions): first run succeeded, committed models with data through 2026-11-09, Netlify redeployed.
- iPhone layout (375 wide): all 7 pages, no overflow.

## Not yet verified
- A live in-progress NBA game on the deployed site (first chance: tonight 7:30 pm ET).
- Push notification delivery to a real iPhone (needs the user's device).
- Any profitable edge (requires prospective paper trading).
