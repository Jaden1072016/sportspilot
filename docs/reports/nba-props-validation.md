# NBA player prop projections: held-out validation

Generated 2026-11-10T18:44:18.121Z by `app/scripts/nba/train-props.mjs`. Snapshot built 2026-11-10T18:44:04Z.

**Method.** Expected minutes and per-minute rates are exponentially weighted from earlier games only, scaled by expected pace and (points only) opponent defense. Counts follow a negative binomial whose spread was fit on 2021-2024 and scored on 2025-2027 (2027 partial). Results are conditional on the player playing. Baselines: "last 10 games" hit rate (what most prop sites show) and a Poisson model with the same average (no extra spread).

Fitted spread (negative binomial size r = r0 x mean^beta; lower = wider): {"points":{"r0":0.25,"beta":1.25},"rebounds":{"r0":1.5,"beta":1.25},"assists":{"r0":3,"beta":1},"fg3m":{"r0":4,"beta":1.25}}

## Points (lines 10, 15, 20, 25, 30+; 58,415 player-games, 292,075 line checks)

| Method | Brier | Log loss |
|---|---|---|
| Last-10-games hit rate | 0.0974 | 0.3198 |
| Poisson (no extra spread) | 0.0975 | 0.3702 |
| SportsPilot without pace/defense | 0.0923 | 0.2962 |
| NBA-PROPS-v1.0 | 0.0921 | 0.2954 |

| Our chance | n | Avg predicted | Actually hit |
|---|---|---|---|
| 0-10% | 165877 | 0.023 | 0.028 |
| 10-20% | 32264 | 0.145 | 0.161 |
| 20-30% | 19812 | 0.247 | 0.270 |
| 30-40% | 15178 | 0.348 | 0.367 |
| 40-50% | 12046 | 0.448 | 0.464 |
| 50-60% | 10077 | 0.550 | 0.562 |
| 60-70% | 9039 | 0.649 | 0.660 |
| 70-80% | 8152 | 0.749 | 0.743 |
| 80-90% | 7935 | 0.852 | 0.835 |
| 90-100% | 11695 | 0.956 | 0.939 |

## Rebounds (lines 4, 6, 8, 10, 12+; 58,415 player-games, 292,075 line checks)

| Method | Brier | Log loss |
|---|---|---|
| Last-10-games hit rate | 0.1039 | 0.3372 |
| Poisson (no extra spread) | 0.0994 | 0.3265 |
| SportsPilot without pace/defense | 0.0984 | 0.3143 |
| NBA-PROPS-v1.0 | 0.0984 | 0.3141 |

| Our chance | n | Avg predicted | Actually hit |
|---|---|---|---|
| 0-10% | 157039 | 0.024 | 0.028 |
| 10-20% | 33517 | 0.145 | 0.145 |
| 20-30% | 22596 | 0.248 | 0.244 |
| 30-40% | 17275 | 0.348 | 0.343 |
| 40-50% | 14199 | 0.448 | 0.436 |
| 50-60% | 12139 | 0.548 | 0.527 |
| 60-70% | 9979 | 0.649 | 0.628 |
| 70-80% | 9140 | 0.749 | 0.726 |
| 80-90% | 7789 | 0.850 | 0.819 |
| 90-100% | 8402 | 0.953 | 0.930 |

## Assists (lines 2, 4, 6, 8, 10+; 58,415 player-games, 292,075 line checks)

| Method | Brier | Log loss |
|---|---|---|
| Last-10-games hit rate | 0.0901 | 0.2978 |
| Poisson (no extra spread) | 0.0853 | 0.2771 |
| SportsPilot without pace/defense | 0.0849 | 0.2714 |
| NBA-PROPS-v1.0 | 0.0848 | 0.2712 |

| Our chance | n | Avg predicted | Actually hit |
|---|---|---|---|
| 0-10% | 171325 | 0.018 | 0.021 |
| 10-20% | 27135 | 0.146 | 0.150 |
| 20-30% | 17581 | 0.248 | 0.251 |
| 30-40% | 14621 | 0.349 | 0.355 |
| 40-50% | 12902 | 0.448 | 0.448 |
| 50-60% | 10501 | 0.549 | 0.534 |
| 60-70% | 9218 | 0.650 | 0.646 |
| 70-80% | 8546 | 0.749 | 0.736 |
| 80-90% | 8770 | 0.851 | 0.843 |
| 90-100% | 11476 | 0.955 | 0.946 |

## Threes (lines 1, 2, 3, 4, 5+; 58,415 player-games, 292,075 line checks)

| Method | Brier | Log loss |
|---|---|---|
| Last-10-games hit rate | 0.1203 | 0.3816 |
| Poisson (no extra spread) | 0.1148 | 0.3638 |
| SportsPilot without pace/defense | 0.1145 | 0.3590 |
| NBA-PROPS-v1.0 | 0.1145 | 0.3589 |

| Our chance | n | Avg predicted | Actually hit |
|---|---|---|---|
| 0-10% | 139687 | 0.025 | 0.035 |
| 10-20% | 35805 | 0.146 | 0.163 |
| 20-30% | 24366 | 0.248 | 0.266 |
| 30-40% | 18969 | 0.348 | 0.357 |
| 40-50% | 15962 | 0.449 | 0.455 |
| 50-60% | 13867 | 0.549 | 0.546 |
| 60-70% | 13118 | 0.650 | 0.649 |
| 70-80% | 12749 | 0.750 | 0.732 |
| 80-90% | 11341 | 0.848 | 0.837 |
| 90-100% | 6211 | 0.934 | 0.913 |

## Limits

- Assumes normal minutes. It does not know about injuries, rest days, blowouts or a teammate being out, which can swing minutes a lot.
- Player data comes from the last data snapshot; players traded since then keep their old team until the snapshot is refreshed.
- Same-game correlations (e.g. a player's points and assists, or two teammates) are not modeled yet, so parlays built from these are still theoretical.
- Calibration on past seasons is not proof of profit against Polymarket prices.
