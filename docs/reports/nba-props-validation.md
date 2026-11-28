# NBA player prop projections: held-out validation

Generated 2026-11-28T19:00:48.161Z by `app/scripts/nba/train-props.mjs`. Snapshot built 2026-11-28T19:00:31Z.

**Method.** Expected minutes and per-minute rates are exponentially weighted from earlier games only, scaled by expected pace and (points only) opponent defense. Counts follow a negative binomial whose spread was fit on 2021-2024 and scored on 2025-2027 (2027 partial). Results are conditional on the player playing. Baselines: "last 10 games" hit rate (what most prop sites show) and a Poisson model with the same average (no extra spread).

Fitted spread (negative binomial size r = r0 x mean^beta; lower = wider): {"points":{"r0":0.25,"beta":1.25},"rebounds":{"r0":1.5,"beta":1.25},"assists":{"r0":3,"beta":1},"fg3m":{"r0":4,"beta":1.25}}

## Points (lines 10, 15, 20, 25, 30+; 61,155 player-games, 305,775 line checks)

| Method | Brier | Log loss |
|---|---|---|
| Last-10-games hit rate | 0.0972 | 0.3192 |
| Poisson (no extra spread) | 0.0972 | 0.3690 |
| SportsPilot without pace/defense | 0.0921 | 0.2955 |
| NBA-PROPS-v1.0 | 0.0919 | 0.2947 |

| Our chance | n | Avg predicted | Actually hit |
|---|---|---|---|
| 0-10% | 173860 | 0.023 | 0.028 |
| 10-20% | 33825 | 0.145 | 0.160 |
| 20-30% | 20767 | 0.247 | 0.270 |
| 30-40% | 15864 | 0.348 | 0.367 |
| 40-50% | 12597 | 0.448 | 0.465 |
| 50-60% | 10510 | 0.550 | 0.564 |
| 60-70% | 9435 | 0.649 | 0.659 |
| 70-80% | 8524 | 0.749 | 0.744 |
| 80-90% | 8251 | 0.852 | 0.836 |
| 90-100% | 12142 | 0.956 | 0.940 |

## Rebounds (lines 4, 6, 8, 10, 12+; 61,155 player-games, 305,775 line checks)

| Method | Brier | Log loss |
|---|---|---|
| Last-10-games hit rate | 0.1038 | 0.3369 |
| Poisson (no extra spread) | 0.0993 | 0.3261 |
| SportsPilot without pace/defense | 0.0983 | 0.3139 |
| NBA-PROPS-v1.0 | 0.0983 | 0.3137 |

| Our chance | n | Avg predicted | Actually hit |
|---|---|---|---|
| 0-10% | 164511 | 0.024 | 0.028 |
| 10-20% | 35218 | 0.145 | 0.145 |
| 20-30% | 23586 | 0.248 | 0.244 |
| 30-40% | 18106 | 0.348 | 0.342 |
| 40-50% | 14832 | 0.448 | 0.436 |
| 50-60% | 12730 | 0.548 | 0.528 |
| 60-70% | 10419 | 0.649 | 0.627 |
| 70-80% | 9505 | 0.749 | 0.727 |
| 80-90% | 8141 | 0.850 | 0.819 |
| 90-100% | 8727 | 0.953 | 0.931 |

## Assists (lines 2, 4, 6, 8, 10+; 61,155 player-games, 305,775 line checks)

| Method | Brier | Log loss |
|---|---|---|
| Last-10-games hit rate | 0.0900 | 0.2976 |
| Poisson (no extra spread) | 0.0852 | 0.2768 |
| SportsPilot without pace/defense | 0.0848 | 0.2711 |
| NBA-PROPS-v1.0 | 0.0848 | 0.2710 |

| Our chance | n | Avg predicted | Actually hit |
|---|---|---|---|
| 0-10% | 179494 | 0.018 | 0.021 |
| 10-20% | 28431 | 0.146 | 0.150 |
| 20-30% | 18381 | 0.248 | 0.252 |
| 30-40% | 15257 | 0.349 | 0.354 |
| 40-50% | 13509 | 0.448 | 0.449 |
| 50-60% | 11050 | 0.549 | 0.536 |
| 60-70% | 9605 | 0.650 | 0.647 |
| 70-80% | 8899 | 0.749 | 0.737 |
| 80-90% | 9226 | 0.851 | 0.843 |
| 90-100% | 11923 | 0.955 | 0.946 |

## Threes (lines 1, 2, 3, 4, 5+; 61,155 player-games, 305,775 line checks)

| Method | Brier | Log loss |
|---|---|---|
| Last-10-games hit rate | 0.1204 | 0.3820 |
| Poisson (no extra spread) | 0.1149 | 0.3642 |
| SportsPilot without pace/defense | 0.1146 | 0.3593 |
| NBA-PROPS-v1.0 | 0.1146 | 0.3593 |

| Our chance | n | Avg predicted | Actually hit |
|---|---|---|---|
| 0-10% | 146237 | 0.026 | 0.035 |
| 10-20% | 37552 | 0.146 | 0.164 |
| 20-30% | 25537 | 0.248 | 0.266 |
| 30-40% | 19835 | 0.348 | 0.358 |
| 40-50% | 16689 | 0.449 | 0.454 |
| 50-60% | 14535 | 0.549 | 0.547 |
| 60-70% | 13783 | 0.650 | 0.648 |
| 70-80% | 13300 | 0.750 | 0.732 |
| 80-90% | 11890 | 0.848 | 0.837 |
| 90-100% | 6417 | 0.934 | 0.914 |

## Limits

- Assumes normal minutes. It does not know about injuries, rest days, blowouts or a teammate being out, which can swing minutes a lot.
- Player data comes from the last data snapshot; players traded since then keep their old team until the snapshot is refreshed.
- Same-game correlations (e.g. a player's points and assists, or two teammates) are not modeled yet, so parlays built from these are still theoretical.
- Calibration on past seasons is not proof of profit against Polymarket prices.
