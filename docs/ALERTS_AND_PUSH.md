# Alerts and push (v0.4)

## While the app is open
Comeback and big-swing research notices (toast, optional sound). De-duplicated, expire after 2 minutes.

## While the app is closed
- `app/netlify/functions/scan-cron.mjs` is a Netlify scheduled function (every 2 minutes). It exits immediately outside game hours (weekdays 6 pm to 2 am ET, weekends from noon).
- It loads the ESPN scoreboard and injury report, runs the same models the app uses, and sends research notices (comeback, big swing) at most once per game situation per 20 minutes.
- Subscriptions and VAPID keys live in Netlify Blobs (free). Keys are generated on first use; no secrets in code or settings. Expired subscriptions are deleted automatically.
- iPhone: alerts only work for the Home Screen app (iOS 16.4+). Settings page: Turn on, then Send me a test alert.
- "Worth a look" (bet) alerts stay off until the model passes the paper-trading gate.

## Verification status
Server code bundles and unit tests pass. End-to-end delivery to a real iPhone has NOT been confirmed yet.
