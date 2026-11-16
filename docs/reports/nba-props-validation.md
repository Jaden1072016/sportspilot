# NBA player prop projections: held-out validation

Generated 2026-11-16T21:07:36.028Z by `app/scripts/nba/train-props.mjs`. Snapshot built 2026-11-16T21:07:21Z.

**Method.** Expected minutes and per-minute rates are exponentially weighted from earlier games only, scaled by expected pace and (points only) opponent defense. Counts follow a negative binomial whose spread was fit on 2021-2024 and scored on 2025-2027 (2027 partial). Results are conditional on the player playing. Baselines: "last 10 games" hit rate (what most prop sites show) and a Poisson model with the same average (no extra spread).

Fitted spread (negative binomial size r = r0 x mean^beta; lower = wider): {"points":{"r0":0.25,"beta":1.25},"rebounds":{"r0":1.5,"beta":1.25},"assists":{"r0":3,"beta":1},"fg3m":{"r0":4,"beta":1.25}}

## Points (lines 10, 15, 20, 25, 30+; 59,355 player-games, 296,775 line checks)

| Method | Brier | Log loss |
|---|---|---|
| Last-10-games hit rate | 0.0974 | 0.3198 |
| Poisson (no extra spread) | 0.0975 | 0.3703 |
| SportsPilot without pace/defense | 0.0923 | 0.2962 |
| NBA-PROPS-v1.0 | 0.0921 | 0.2954 |

| Our chance | n | Avg predicted | Actually hit |
|---|---|---|---|
| 0-10% | 168640 | 0.023 | 0.028 |
| 10-20% | 32787 | 0.145 | 0.161 |
| 20-30% | 20136 | 0.247 | 0.271 |
| 30-40% | 15412 | 0.348 | 0.367 |
| 40-50% | 12233 | 0.448 | 0.465 |
| 50-60% | 10212 | 0.550 | 0.563 |
| 60-70% | 9178 | 0.649 | 0.659 |
| 70-80% | 8277 | 0.749 | 0.743 |
| 80-90% | 8049 | 0.852 | 0.835 |
| 90-100% | 11851 | 0.956 | 0.939 |

## Rebounds (lines 4, 6, 8, 10, 12+; 59,355 player-games, 296,775 line checks)

| Method | Brier | Log loss |
|---|---|---|
| Last-10-games hit rate | 0.1038 | 0.3371 |
| Poisson (no extra spread) | 0.0993 | 0.3264 |
| SportsPilot without pace/defense | 0.0984 | 0.3142 |
| NBA-PROPS-v1.0 | 0.0983 | 0.3140 |

| Our chance | n | Avg predicted | Actually hit |
|---|---|---|---|
| 0-10% | 159629 | 0.024 | 0.028 |
| 10-20% | 34082 | 0.145 | 0.145 |
| 20-30% | 22946 | 0.248 | 0.244 |
| 30-40% | 17531 | 0.348 | 0.342 |
| 40-50% | 14436 | 0.448 | 0.436 |
| 50-60% | 12334 | 0.548 | 0.527 |
| 60-70% | 10116 | 0.649 | 0.628 |
| 70-80% | 9274 | 0.749 | 0.726 |
| 80-90% | 7914 | 0.850 | 0.819 |
| 90-100% | 8513 | 0.953 | 0.930 |

## Assists (lines 2, 4, 6, 8, 10+; 59,355 player-games, 296,775 line checks)

| Method | Brier | Log loss |
|---|---|---|
| Last-10-games hit rate | 0.0900 | 0.2978 |
| Poisson (no extra spread) | 0.0853 | 0.2771 |
| SportsPilot without pace/defense | 0.0849 | 0.2714 |
| NBA-PROPS-v1.0 | 0.0848 | 0.2712 |

| Our chance | n | Avg predicted | Actually hit |
|---|---|---|---|
| 0-10% | 174159 | 0.018 | 0.021 |
| 10-20% | 27572 | 0.146 | 0.151 |
| 20-30% | 17839 | 0.248 | 0.252 |
| 30-40% | 14845 | 0.349 | 0.355 |
| 40-50% | 13124 | 0.448 | 0.449 |
| 50-60% | 10676 | 0.549 | 0.535 |
| 60-70% | 9348 | 0.650 | 0.646 |
| 70-80% | 8663 | 0.749 | 0.736 |
| 80-90% | 8924 | 0.851 | 0.843 |
| 90-100% | 11625 | 0.955 | 0.946 |

## Threes (lines 1, 2, 3, 4, 5+; 59,355 player-games, 296,775 line checks)

| Method | Brier | Log loss |
|---|---|---|
| Last-10-games hit rate | 0.1204 | 0.3819 |
| Poisson (no extra spread) | 0.1149 | 0.3643 |
| SportsPilot without pace/defense | 0.1146 | 0.3594 |
| NBA-PROPS-v1.0 | 0.1146 | 0.3593 |

| Our chance | n | Avg predicted | Actually hit |
|---|---|---|---|
| 0-10% | 141984 | 0.025 | 0.035 |
| 10-20% | 36391 | 0.146 | 0.164 |
| 20-30% | 24774 | 0.248 | 0.266 |
| 30-40% | 19242 | 0.348 | 0.358 |
| 40-50% | 16222 | 0.449 | 0.455 |
| 50-60% | 14103 | 0.549 | 0.547 |
| 60-70% | 13316 | 0.650 | 0.648 |
| 70-80% | 12942 | 0.750 | 0.732 |
| 80-90% | 11525 | 0.848 | 0.837 |
| 90-100% | 6276 | 0.934 | 0.913 |

## Limits

- Assumes normal minutes. It does not know about injuries, rest days, blowouts or a teammate being out, which can swing minutes a lot.
- Player data comes from the last data snapshot; players traded since then keep their old team until the snapshot is refreshed.
- Same-game correlations (e.g. a player's points and assists, or two teammates) are not modeled yet, so parlays built from these are still theoretical.
- Calibration on past seasons is not proof of profit against Polymarket prices.
