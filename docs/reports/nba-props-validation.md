# NBA player prop projections: held-out validation

Generated 2026-11-12T19:00:32.602Z by `app/scripts/nba/train-props.mjs`. Snapshot built 2026-11-12T19:00:15Z.

**Method.** Expected minutes and per-minute rates are exponentially weighted from earlier games only, scaled by expected pace and (points only) opponent defense. Counts follow a negative binomial whose spread was fit on 2021-2024 and scored on 2025-2027 (2027 partial). Results are conditional on the player playing. Baselines: "last 10 games" hit rate (what most prop sites show) and a Poisson model with the same average (no extra spread).

Fitted spread (negative binomial size r = r0 x mean^beta; lower = wider): {"points":{"r0":0.25,"beta":1.25},"rebounds":{"r0":1.5,"beta":1.25},"assists":{"r0":3,"beta":1},"fg3m":{"r0":4,"beta":1.25}}

## Points (lines 10, 15, 20, 25, 30+; 58,774 player-games, 293,870 line checks)

| Method | Brier | Log loss |
|---|---|---|
| Last-10-games hit rate | 0.0973 | 0.3196 |
| Poisson (no extra spread) | 0.0975 | 0.3698 |
| SportsPilot without pace/defense | 0.0923 | 0.2960 |
| NBA-PROPS-v1.0 | 0.0920 | 0.2952 |

| Our chance | n | Avg predicted | Actually hit |
|---|---|---|---|
| 0-10% | 166951 | 0.023 | 0.028 |
| 10-20% | 32455 | 0.145 | 0.161 |
| 20-30% | 19931 | 0.247 | 0.270 |
| 30-40% | 15262 | 0.348 | 0.367 |
| 40-50% | 12121 | 0.448 | 0.464 |
| 50-60% | 10130 | 0.550 | 0.562 |
| 60-70% | 9087 | 0.649 | 0.659 |
| 70-80% | 8200 | 0.749 | 0.743 |
| 80-90% | 7976 | 0.852 | 0.835 |
| 90-100% | 11757 | 0.956 | 0.939 |

## Rebounds (lines 4, 6, 8, 10, 12+; 58,774 player-games, 293,870 line checks)

| Method | Brier | Log loss |
|---|---|---|
| Last-10-games hit rate | 0.1038 | 0.3370 |
| Poisson (no extra spread) | 0.0993 | 0.3262 |
| SportsPilot without pace/defense | 0.0983 | 0.3140 |
| NBA-PROPS-v1.0 | 0.0983 | 0.3138 |

| Our chance | n | Avg predicted | Actually hit |
|---|---|---|---|
| 0-10% | 158032 | 0.024 | 0.028 |
| 10-20% | 33732 | 0.145 | 0.145 |
| 20-30% | 22730 | 0.248 | 0.243 |
| 30-40% | 17366 | 0.348 | 0.342 |
| 40-50% | 14291 | 0.448 | 0.435 |
| 50-60% | 12213 | 0.548 | 0.527 |
| 60-70% | 10032 | 0.649 | 0.627 |
| 70-80% | 9194 | 0.749 | 0.726 |
| 80-90% | 7838 | 0.850 | 0.819 |
| 90-100% | 8442 | 0.953 | 0.930 |

## Assists (lines 2, 4, 6, 8, 10+; 58,774 player-games, 293,870 line checks)

| Method | Brier | Log loss |
|---|---|---|
| Last-10-games hit rate | 0.0900 | 0.2977 |
| Poisson (no extra spread) | 0.0852 | 0.2769 |
| SportsPilot without pace/defense | 0.0848 | 0.2712 |
| NBA-PROPS-v1.0 | 0.0848 | 0.2711 |

| Our chance | n | Avg predicted | Actually hit |
|---|---|---|---|
| 0-10% | 172410 | 0.018 | 0.021 |
| 10-20% | 27313 | 0.146 | 0.150 |
| 20-30% | 17671 | 0.248 | 0.251 |
| 30-40% | 14709 | 0.349 | 0.354 |
| 40-50% | 12992 | 0.448 | 0.448 |
| 50-60% | 10563 | 0.549 | 0.535 |
| 60-70% | 9261 | 0.650 | 0.646 |
| 70-80% | 8590 | 0.749 | 0.735 |
| 80-90% | 8830 | 0.851 | 0.843 |
| 90-100% | 11531 | 0.955 | 0.946 |

## Threes (lines 1, 2, 3, 4, 5+; 58,774 player-games, 293,870 line checks)

| Method | Brier | Log loss |
|---|---|---|
| Last-10-games hit rate | 0.1202 | 0.3815 |
| Poisson (no extra spread) | 0.1147 | 0.3638 |
| SportsPilot without pace/defense | 0.1145 | 0.3590 |
| NBA-PROPS-v1.0 | 0.1145 | 0.3589 |

| Our chance | n | Avg predicted | Actually hit |
|---|---|---|---|
| 0-10% | 140564 | 0.025 | 0.035 |
| 10-20% | 36033 | 0.146 | 0.163 |
| 20-30% | 24523 | 0.248 | 0.266 |
| 30-40% | 19070 | 0.348 | 0.357 |
| 40-50% | 16066 | 0.449 | 0.456 |
| 50-60% | 13950 | 0.549 | 0.546 |
| 60-70% | 13195 | 0.650 | 0.649 |
| 70-80% | 12827 | 0.750 | 0.733 |
| 80-90% | 11406 | 0.848 | 0.837 |
| 90-100% | 6236 | 0.934 | 0.913 |

## Limits

- Assumes normal minutes. It does not know about injuries, rest days, blowouts or a teammate being out, which can swing minutes a lot.
- Player data comes from the last data snapshot; players traded since then keep their old team until the snapshot is refreshed.
- Same-game correlations (e.g. a player's points and assists, or two teammates) are not modeled yet, so parlays built from these are still theoretical.
- Calibration on past seasons is not proof of profit against Polymarket prices.
