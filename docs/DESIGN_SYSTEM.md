# Arena After Dark — custom premium sports UI

## Intended feel
Professional basketball broadcast graphics + precise trading research terminal, **without** copying or using protected NBA logos, game footage, player photos or official NBA app trade dress. Full-bleed court orange basketball graphic, glowing scoreboards, technical but approachable visual hierarchy. Fast mobile interactions and excellent readability. Distinct identity: SportsPilot.

## Exact palette
| Role | HEX | Usage |
|---|---|---|
| Background | `#0B1020` | Arena night canvas |
| Raised surface | `#151D30` | Main analytics panels |
| Deep secondary panel | `#1B2639` | Data rows / cards |
| Main text | `#F3F6FD` | Readable text |
| Secondary text | `#8995A9` | Metadata |
| Court orange | `#FF7548` | Brand, selected state, primary action |
| Amber highlight | `#FFAE6C` | Opportunity explanation emphasis |
| Signal teal | `#57E1BB` | Data connected, positive *verified* state; not 'safe bet' |
| Soft red | `#FF7588` | Halt, stale, unresolved risk |
| Soft blue | `#96B9FF` | Neutral charts |
| Border | `#2B3649` | Subtle separators |

Typography: system/Inter-style sans; 900/800 headings, font 11–13px for high density on desktop and 12–14px for mobile descriptions. Scoreboard monospaced numeral style where possible, no unreadably tiny core values.

## Pages shipped in the starter
- Overview: hero, research status, league navigation, live games, market discovery, release gates.
- Live scanner: selected game, independent research baseline, detailed inputs, player box scores.
- Markets: Polymarket US listings and explicit on-demand BBO quote, no invented join or 'buy'.
- Parlay lab: standalone manual probability/payout mathematics with independence warning.
- Paper journal: add and export simulated hypotheses stored locally.
- Settings: 3–5× target, polling interval, browser notification **test**, missing infrastructure list.

## Proposed eventual premium screens
1. **Game command center:** live score, lineups/on court, box scores, evidence narrative, independent win-probability band, possession funnel, calculated player live projection; market quote on visually separate panel. Every statistic with source badge/time.
2. **Opportunity scanner:** sortable signals filtered by sport/game, target total return, calibrated probability, conservative net edge, quote age, liquidity, projected hold time, and *why it qualified*; empty is a valid good day.
3. **Player intelligence:** individual profile with context-adjusted last 5/10/20 game rates, true projected minutes, confidence bands, matchup charts and injury status.
4. **Correlation-aware parlay workbench:** eligible legs, actual native Combo quote, correlation heatmap, joint simulated win rate, payout breakdown, rules confirmations, no quote → no claim.
5. **Model lab:** historical calibration, probability reliability curve, backtest by probability band/quarter, P&L and drawdown (paper before real), never fake charts.
6. **Alert inbox:** real event with expiration, 'what changed', no guaranteed outcomes, click through to reverify quote.

## Rules
- No fake live tickers, betting predictions, profit badges, green 'sure win' claims, historical charts, or proprietary logos.
- Motion restrained, obey reduced motion preference, do not blink red for inconsequential changes.
- Store dark theme as default; ensure text contrast and mobile touch areas.
- iPhone: bottom navigation visible while scrolling, columns stack, large line/price values, Home Screen icon/manifest.

## Preview images in this ZIP
`docs/desktop-preview.png` and `docs/mobile-preview.png` are generated from the **actual HTML/CSS/JS rendering in synthetic demo mode**. They're mock data screenshots, NOT actual current sports feeds.
