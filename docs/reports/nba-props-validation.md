# NBA player prop projections: held-out validation

Generated 2026-11-25T20:32:16.360Z by `app/scripts/nba/train-props.mjs`. Snapshot built 2026-11-25T20:31:59Z.

**Method.** Expected minutes and per-minute rates are exponentially weighted from earlier games only, scaled by expected pace and (points only) opponent defense. Counts follow a negative binomial whose spread was fit on 2021-2024 and scored on 2025-2027 (2027 partial). Results are conditional on the player playing. Baselines: "last 10 games" hit rate (what most prop sites show) and a Poisson model with the same average (no extra spread).

Fitted spread (negative binomial size r = r0 x mean^beta; lower = wider): {"points":{"r0":0.25,"beta":1.25},"rebounds":{"r0":1.5,"beta":1.25},"assists":{"r0":3,"beta":1},"fg3m":{"r0":4,"beta":1.25}}

## Points (lines 10, 15, 20, 25, 30+; 60,737 player-games, 303,685 line checks)

| Method | Brier | Log loss |
|---|---|---|
| Last-10-games hit rate | 0.0972 | 0.3195 |
| Poisson (no extra spread) | 0.0974 | 0.3696 |
| SportsPilot without pace/defense | 0.0922 | 0.2958 |
| NBA-PROPS-v1.0 | 0.0919 | 0.2950 |

| Our chance | n | Avg predicted | Actually hit |
|---|---|---|---|
| 0-10% | 172673 | 0.023 | 0.028 |
| 10-20% | 33587 | 0.145 | 0.161 |
| 20-30% | 20609 | 0.247 | 0.270 |
| 30-40% | 15766 | 0.348 | 0.368 |
| 40-50% | 12502 | 0.448 | 0.465 |
| 50-60% | 10432 | 0.550 | 0.564 |
| 60-70% | 9378 | 0.649 | 0.658 |
| 70-80% | 8466 | 0.749 | 0.745 |
| 80-90% | 8204 | 0.852 | 0.836 |
| 90-100% | 12068 | 0.956 | 0.940 |

## Rebounds (lines 4, 6, 8, 10, 12+; 60,737 player-games, 303,685 line checks)

| Method | Brier | Log loss |
|---|---|---|
| Last-10-games hit rate | 0.1037 | 0.3369 |
| Poisson (no extra spread) | 0.0993 | 0.3261 |
| SportsPilot without pace/defense | 0.0983 | 0.3139 |
| NBA-PROPS-v1.0 | 0.0982 | 0.3138 |

| Our chance | n | Avg predicted | Actually hit |
|---|---|---|---|
| 0-10% | 163404 | 0.024 | 0.028 |
| 10-20% | 34944 | 0.145 | 0.145 |
| 20-30% | 23440 | 0.248 | 0.244 |
| 30-40% | 17976 | 0.348 | 0.343 |
| 40-50% | 14730 | 0.449 | 0.436 |
| 50-60% | 12637 | 0.548 | 0.528 |
| 60-70% | 10348 | 0.649 | 0.626 |
| 70-80% | 9456 | 0.749 | 0.727 |
| 80-90% | 8075 | 0.850 | 0.819 |
| 90-100% | 8675 | 0.953 | 0.930 |

## Assists (lines 2, 4, 6, 8, 10+; 60,737 player-games, 303,685 line checks)

| Method | Brier | Log loss |
|---|---|---|
| Last-10-games hit rate | 0.0900 | 0.2976 |
| Poisson (no extra spread) | 0.0852 | 0.2769 |
| SportsPilot without pace/defense | 0.0848 | 0.2712 |
| NBA-PROPS-v1.0 | 0.0848 | 0.2710 |

| Our chance | n | Avg predicted | Actually hit |
|---|---|---|---|
| 0-10% | 178301 | 0.018 | 0.021 |
| 10-20% | 28232 | 0.146 | 0.151 |
| 20-30% | 18245 | 0.248 | 0.253 |
| 30-40% | 15136 | 0.349 | 0.354 |
| 40-50% | 13433 | 0.448 | 0.449 |
| 50-60% | 10962 | 0.549 | 0.537 |
| 60-70% | 9545 | 0.650 | 0.647 |
| 70-80% | 8825 | 0.749 | 0.737 |
| 80-90% | 9156 | 0.851 | 0.843 |
| 90-100% | 11850 | 0.955 | 0.946 |

## Threes (lines 1, 2, 3, 4, 5+; 60,737 player-games, 303,685 line checks)

| Method | Brier | Log loss |
|---|---|---|
| Last-10-games hit rate | 0.1204 | 0.3821 |
| Poisson (no extra spread) | 0.1149 | 0.3644 |
| SportsPilot without pace/defense | 0.1147 | 0.3595 |
| NBA-PROPS-v1.0 | 0.1146 | 0.3594 |

| Our chance | n | Avg predicted | Actually hit |
|---|---|---|---|
| 0-10% | 145279 | 0.026 | 0.035 |
| 10-20% | 37280 | 0.146 | 0.164 |
| 20-30% | 25358 | 0.248 | 0.267 |
| 30-40% | 19693 | 0.348 | 0.358 |
| 40-50% | 16573 | 0.449 | 0.455 |
| 50-60% | 14440 | 0.549 | 0.547 |
| 60-70% | 13667 | 0.650 | 0.648 |
| 70-80% | 13211 | 0.750 | 0.732 |
| 80-90% | 11802 | 0.848 | 0.838 |
| 90-100% | 6382 | 0.934 | 0.914 |

## Limits

- Assumes normal minutes. It does not know about injuries, rest days, blowouts or a teammate being out, which can swing minutes a lot.
- Player data comes from the last data snapshot; players traded since then keep their old team until the snapshot is refreshed.
- Same-game correlations (e.g. a player's points and assists, or two teammates) are not modeled yet, so parlays built from these are still theoretical.
- Calibration on past seasons is not proof of profit against Polymarket prices.
