# NBA player prop projections: held-out validation

Generated 2026-11-10T07:05:12.460Z by `app/scripts/nba/train-props.mjs`. Snapshot built 2026-11-09T22:06:21Z.

**Method.** Expected minutes and per-minute rates are exponentially weighted from earlier games only, scaled by expected pace and (points only) opponent defense. Counts follow a negative binomial whose spread was fit on 2021-2024 and scored on 2025-2027 (2027 partial). Results are conditional on the player playing. Baselines: "last 10 games" hit rate (what most prop sites show) and a Poisson model with the same average (no extra spread).

Fitted spread (negative binomial size r = r0 x mean^beta; lower = wider): {"points":{"r0":0.25,"beta":1.25},"rebounds":{"r0":1.5,"beta":1.25},"assists":{"r0":3,"beta":1},"fg3m":{"r0":4,"beta":1.25}}

## Points (lines 10, 15, 20, 25, 30+; 58,237 player-games, 291,185 line checks)

| Method | Brier | Log loss |
|---|---|---|
| Last-10-games hit rate | 0.0974 | 0.3199 |
| Poisson (no extra spread) | 0.0976 | 0.3704 |
| SportsPilot without pace/defense | 0.0924 | 0.2963 |
| NBA-PROPS-v1.0 | 0.0921 | 0.2955 |

| Our chance | n | Avg predicted | Actually hit |
|---|---|---|---|
| 0-10% | 165360 | 0.023 | 0.028 |
| 10-20% | 32161 | 0.145 | 0.161 |
| 20-30% | 19753 | 0.247 | 0.270 |
| 30-40% | 15133 | 0.348 | 0.367 |
| 40-50% | 12014 | 0.448 | 0.464 |
| 50-60% | 10049 | 0.550 | 0.562 |
| 60-70% | 9007 | 0.649 | 0.660 |
| 70-80% | 8134 | 0.749 | 0.743 |
| 80-90% | 7908 | 0.851 | 0.835 |
| 90-100% | 11666 | 0.956 | 0.939 |

## Rebounds (lines 4, 6, 8, 10, 12+; 58,237 player-games, 291,185 line checks)

| Method | Brier | Log loss |
|---|---|---|
| Last-10-games hit rate | 0.1039 | 0.3372 |
| Poisson (no extra spread) | 0.0994 | 0.3266 |
| SportsPilot without pace/defense | 0.0984 | 0.3143 |
| NBA-PROPS-v1.0 | 0.0984 | 0.3142 |

| Our chance | n | Avg predicted | Actually hit |
|---|---|---|---|
| 0-10% | 156542 | 0.024 | 0.028 |
| 10-20% | 33416 | 0.145 | 0.145 |
| 20-30% | 22528 | 0.248 | 0.244 |
| 30-40% | 17228 | 0.348 | 0.343 |
| 40-50% | 14150 | 0.448 | 0.436 |
| 50-60% | 12112 | 0.548 | 0.527 |
| 60-70% | 9950 | 0.649 | 0.628 |
| 70-80% | 9116 | 0.749 | 0.727 |
| 80-90% | 7764 | 0.850 | 0.819 |
| 90-100% | 8379 | 0.953 | 0.930 |

## Assists (lines 2, 4, 6, 8, 10+; 58,237 player-games, 291,185 line checks)

| Method | Brier | Log loss |
|---|---|---|
| Last-10-games hit rate | 0.0900 | 0.2978 |
| Poisson (no extra spread) | 0.0853 | 0.2771 |
| SportsPilot without pace/defense | 0.0849 | 0.2714 |
| NBA-PROPS-v1.0 | 0.0848 | 0.2712 |

| Our chance | n | Avg predicted | Actually hit |
|---|---|---|---|
| 0-10% | 170784 | 0.018 | 0.021 |
| 10-20% | 27068 | 0.146 | 0.150 |
| 20-30% | 17521 | 0.248 | 0.251 |
| 30-40% | 14586 | 0.349 | 0.355 |
| 40-50% | 12862 | 0.448 | 0.448 |
| 50-60% | 10469 | 0.549 | 0.534 |
| 60-70% | 9187 | 0.650 | 0.646 |
| 70-80% | 8521 | 0.749 | 0.736 |
| 80-90% | 8744 | 0.851 | 0.843 |
| 90-100% | 11443 | 0.955 | 0.946 |

## Threes (lines 1, 2, 3, 4, 5+; 58,237 player-games, 291,185 line checks)

| Method | Brier | Log loss |
|---|---|---|
| Last-10-games hit rate | 0.1203 | 0.3816 |
| Poisson (no extra spread) | 0.1148 | 0.3639 |
| SportsPilot without pace/defense | 0.1145 | 0.3590 |
| NBA-PROPS-v1.0 | 0.1145 | 0.3590 |

| Our chance | n | Avg predicted | Actually hit |
|---|---|---|---|
| 0-10% | 139243 | 0.025 | 0.035 |
| 10-20% | 35699 | 0.146 | 0.163 |
| 20-30% | 24284 | 0.248 | 0.266 |
| 30-40% | 18926 | 0.348 | 0.357 |
| 40-50% | 15909 | 0.449 | 0.455 |
| 50-60% | 13827 | 0.549 | 0.546 |
| 60-70% | 13081 | 0.650 | 0.649 |
| 70-80% | 12711 | 0.749 | 0.732 |
| 80-90% | 11310 | 0.848 | 0.837 |
| 90-100% | 6195 | 0.934 | 0.913 |

## Limits

- Assumes normal minutes. It does not know about injuries, rest days, blowouts or a teammate being out, which can swing minutes a lot.
- Player data comes from the last data snapshot; players traded since then keep their old team until the snapshot is refreshed.
- Same-game correlations (e.g. a player's points and assists, or two teammates) are not modeled yet, so parlays built from these are still theoretical.
- Calibration on past seasons is not proof of profit against Polymarket prices.
