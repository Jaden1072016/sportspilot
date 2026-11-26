# NBA player prop projections: held-out validation

Generated 2026-11-26T20:18:07.856Z by `app/scripts/nba/train-props.mjs`. Snapshot built 2026-11-26T20:17:52Z.

**Method.** Expected minutes and per-minute rates are exponentially weighted from earlier games only, scaled by expected pace and (points only) opponent defense. Counts follow a negative binomial whose spread was fit on 2021-2024 and scored on 2025-2027 (2027 partial). Results are conditional on the player playing. Baselines: "last 10 games" hit rate (what most prop sites show) and a Poisson model with the same average (no extra spread).

Fitted spread (negative binomial size r = r0 x mean^beta; lower = wider): {"points":{"r0":0.25,"beta":1.25},"rebounds":{"r0":1.5,"beta":1.25},"assists":{"r0":3,"beta":1},"fg3m":{"r0":4,"beta":1.25}}

## Points (lines 10, 15, 20, 25, 30+; 60,925 player-games, 304,625 line checks)

| Method | Brier | Log loss |
|---|---|---|
| Last-10-games hit rate | 0.0972 | 0.3194 |
| Poisson (no extra spread) | 0.0973 | 0.3694 |
| SportsPilot without pace/defense | 0.0922 | 0.2957 |
| NBA-PROPS-v1.0 | 0.0919 | 0.2949 |

| Our chance | n | Avg predicted | Actually hit |
|---|---|---|---|
| 0-10% | 173213 | 0.023 | 0.028 |
| 10-20% | 33687 | 0.145 | 0.160 |
| 20-30% | 20683 | 0.247 | 0.270 |
| 30-40% | 15802 | 0.348 | 0.368 |
| 40-50% | 12553 | 0.448 | 0.465 |
| 50-60% | 10465 | 0.550 | 0.564 |
| 60-70% | 9401 | 0.649 | 0.659 |
| 70-80% | 8494 | 0.749 | 0.744 |
| 80-90% | 8228 | 0.852 | 0.836 |
| 90-100% | 12099 | 0.956 | 0.940 |

## Rebounds (lines 4, 6, 8, 10, 12+; 60,925 player-games, 304,625 line checks)

| Method | Brier | Log loss |
|---|---|---|
| Last-10-games hit rate | 0.1038 | 0.3369 |
| Poisson (no extra spread) | 0.0993 | 0.3262 |
| SportsPilot without pace/defense | 0.0983 | 0.3139 |
| NBA-PROPS-v1.0 | 0.0983 | 0.3138 |

| Our chance | n | Avg predicted | Actually hit |
|---|---|---|---|
| 0-10% | 163903 | 0.024 | 0.028 |
| 10-20% | 35074 | 0.145 | 0.145 |
| 20-30% | 23500 | 0.248 | 0.244 |
| 30-40% | 18038 | 0.348 | 0.343 |
| 40-50% | 14772 | 0.449 | 0.436 |
| 50-60% | 12679 | 0.548 | 0.528 |
| 60-70% | 10380 | 0.649 | 0.626 |
| 70-80% | 9477 | 0.749 | 0.727 |
| 80-90% | 8105 | 0.850 | 0.819 |
| 90-100% | 8697 | 0.953 | 0.931 |

## Assists (lines 2, 4, 6, 8, 10+; 60,925 player-games, 304,625 line checks)

| Method | Brier | Log loss |
|---|---|---|
| Last-10-games hit rate | 0.0900 | 0.2976 |
| Poisson (no extra spread) | 0.0852 | 0.2768 |
| SportsPilot without pace/defense | 0.0848 | 0.2711 |
| NBA-PROPS-v1.0 | 0.0848 | 0.2709 |

| Our chance | n | Avg predicted | Actually hit |
|---|---|---|---|
| 0-10% | 178840 | 0.018 | 0.021 |
| 10-20% | 28319 | 0.146 | 0.150 |
| 20-30% | 18309 | 0.248 | 0.253 |
| 30-40% | 15189 | 0.349 | 0.354 |
| 40-50% | 13469 | 0.448 | 0.449 |
| 50-60% | 10998 | 0.549 | 0.537 |
| 60-70% | 9575 | 0.649 | 0.647 |
| 70-80% | 8859 | 0.749 | 0.737 |
| 80-90% | 9187 | 0.851 | 0.843 |
| 90-100% | 11880 | 0.955 | 0.946 |

## Threes (lines 1, 2, 3, 4, 5+; 60,925 player-games, 304,625 line checks)

| Method | Brier | Log loss |
|---|---|---|
| Last-10-games hit rate | 0.1204 | 0.3821 |
| Poisson (no extra spread) | 0.1149 | 0.3644 |
| SportsPilot without pace/defense | 0.1147 | 0.3595 |
| NBA-PROPS-v1.0 | 0.1147 | 0.3594 |

| Our chance | n | Avg predicted | Actually hit |
|---|---|---|---|
| 0-10% | 145700 | 0.026 | 0.035 |
| 10-20% | 37402 | 0.146 | 0.164 |
| 20-30% | 25442 | 0.248 | 0.266 |
| 30-40% | 19762 | 0.348 | 0.358 |
| 40-50% | 16621 | 0.449 | 0.454 |
| 50-60% | 14485 | 0.549 | 0.547 |
| 60-70% | 13720 | 0.650 | 0.648 |
| 70-80% | 13253 | 0.750 | 0.732 |
| 80-90% | 11841 | 0.848 | 0.837 |
| 90-100% | 6399 | 0.934 | 0.914 |

## Limits

- Assumes normal minutes. It does not know about injuries, rest days, blowouts or a teammate being out, which can swing minutes a lot.
- Player data comes from the last data snapshot; players traded since then keep their old team until the snapshot is refreshed.
- Same-game correlations (e.g. a player's points and assists, or two teammates) are not modeled yet, so parlays built from these are still theoretical.
- Calibration on past seasons is not proof of profit against Polymarket prices.
