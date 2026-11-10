# Security, permissions and operational integrity

## No credentials or trading
This project ships **zero user secrets**, account passwords or API keys. Public read-only Polymarket US REST and unofficial no-key ESPN data are the only current upstream services. All real trades are made manually on the user's own platform after independent verification. Never add account trading/withdrawal endpoints without a separate explicit redesign and authorized user consent.

## Current protections
- Fixed allowlisted upstream host paths; user input limited to conservative market-slug and ESPN numeric event-ID patterns.
- No open generic URL fetch proxy and no embedded private keys.
- Timeout/fail closed on upstream errors and non-JSON responses.
- HTML escaping on fetched free-source names/labels before insertion into UI.
- Service worker deliberately avoids caching dynamic scores, odds or API error responses.
- PWA permission request only after explicit browser UI gesture.
- Browser localStorage only for preferences and simulated journal; not intended for sensitive or shared data.
- Public backend `push-register` returns 501 rather than accepting unsecured subscriptions.

## Work still required before production
- Strict runtime schema validators (e.g., Zod if free dependency is acceptable), structured error logging without sensitive data, rate-limiting at backend, provider backoff, retries/circuit breaker.
- CSP, XSS review, accessibility, dependency and security scanning, supply-chain lockfile once adding dependencies.
- Secure persistent session auth if push subscriptions or personal datasets are added; encrypt at rest, rotate VAPID keys and de-register push devices.
- Polymarket and ESPN provider terms, geographical availability, licensed redistribution and free-tier rate limits. Unofficial no-key access is not necessarily consent to commercial or high-frequency use.
- Market contract settlement rules, age/eligibility and jurisdiction restrictions applicable to user; follow official provider policies.
- Prohibit using material non-public information, hacked feeds or confidential team records in any supposed 'insider' advantage. Public expert-level basketball analysis is the intended meaning.
- To scale from 1 device to multiple: central caching by sport, bounded upstream request rate, backoff 429 and fairness rather than 1 feed request per browser refresh.
- Store model revisions, input hashes, quote snapshots and technical errors for replay; never log account passwords, tokens or exact push endpoint unredacted.

## Risk messaging
Distributions are uncertain. Multiple 3–5× opportunities can all lose. A positive modeled expected value is conditional on correct model inputs and estimates. Alerts are not guaranteed fill prices. Do not present paper returns as historical realized money or promise profit.
