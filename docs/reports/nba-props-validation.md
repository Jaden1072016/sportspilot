# NBA player prop projections: held-out validation

Generated 2026-11-11T18:47:17.777Z by `app/scripts/nba/train-props.mjs`. Snapshot built 2026-11-11T18:47:01Z.

**Method.** Expected minutes and per-minute rates are exponentially weighted from earlier games only, scaled by expected pace and (points only) opponent defense. Counts follow a negative binomial whose spread was fit on 2021-2024 and scored on 2025-2027 (2027 partial). Results are conditional on the player playing. Baselines: "last 10 games" hit rate (what most prop sites show) and a Poisson model with the same average (no extra spread).

Fitted spread (negative binomial size r = r0 x mean^beta; lower = wider): {"points":{"r0":0.25,"beta":1.25},"rebounds":{"r0":1.5,"beta":1.25},"assists":{"r0":3,"beta":1},"fg3m":{"r0":4,"beta":1.25}}

## Points (lines 10, 15, 20, 25, 30+; 58,554 player-games, 292,770 line checks)

| Method | Brier | Log loss |
|---|---|---|
| Last-10-games hit rate | 0.0974 | 0.3197 |
| Poisson (no extra spread) | 0.0975 | 0.3700 |
| SportsPilot without pace/defense | 0.0923 | 0.2961 |
| NBA-PROPS-v1.0 | 0.0921 | 0.2953 |

| Our chance | n | Avg predicted | Actually hit |
|---|---|---|---|
| 0-10% | 166305 | 0.023 | 0.028 |
| 10-20% | 32340 | 0.145 | 0.161 |
| 20-30% | 19853 | 0.248 | 0.270 |
| 30-40% | 15209 | 0.348 | 0.367 |
| 40-50% | 12073 | 0.448 | 0.464 |
| 50-60% | 10094 | 0.550 | 0.562 |
| 60-70% | 9059 | 0.649 | 0.660 |
| 70-80% | 8170 | 0.749 | 0.742 |
| 80-90% | 7952 | 0.852 | 0.835 |
| 90-100% | 11715 | 0.956 | 0.939 |

## Rebounds (lines 4, 6, 8, 10, 12+; 58,554 player-games, 292,770 line checks)

| Method | Brier | Log loss |
|---|---|---|
| Last-10-games hit rate | 0.1039 | 0.3371 |
| Poisson (no extra spread) | 0.0994 | 0.3265 |
| SportsPilot without pace/defense | 0.0984 | 0.3142 |
| NBA-PROPS-v1.0 | 0.0983 | 0.3140 |

| Our chance | n | Avg predicted | Actually hit |
|---|---|---|---|
| 0-10% | 157440 | 0.024 | 0.028 |
| 10-20% | 33598 | 0.145 | 0.145 |
| 20-30% | 22644 | 0.248 | 0.244 |
| 30-40% | 17308 | 0.348 | 0.343 |
| 40-50% | 14232 | 0.448 | 0.435 |
| 50-60% | 12169 | 0.548 | 0.527 |
| 60-70% | 9997 | 0.649 | 0.628 |
| 70-80% | 9159 | 0.749 | 0.726 |
| 80-90% | 7806 | 0.850 | 0.819 |
| 90-100% | 8417 | 0.953 | 0.930 |

## Assists (lines 2, 4, 6, 8, 10+; 58,554 player-games, 292,770 line checks)

| Method | Brier | Log loss |
|---|---|---|
| Last-10-games hit rate | 0.0900 | 0.2978 |
| Poisson (no extra spread) | 0.0853 | 0.2770 |
| SportsPilot without pace/defense | 0.0849 | 0.2713 |
| NBA-PROPS-v1.0 | 0.0848 | 0.2711 |

| Our chance | n | Avg predicted | Actually hit |
|---|---|---|---|
| 0-10% | 171755 | 0.018 | 0.021 |
| 10-20% | 27207 | 0.146 | 0.150 |
| 20-30% | 17610 | 0.248 | 0.251 |
| 30-40% | 14651 | 0.349 | 0.355 |
| 40-50% | 12940 | 0.448 | 0.448 |
| 50-60% | 10526 | 0.549 | 0.534 |
| 60-70% | 9231 | 0.650 | 0.646 |
| 70-80% | 8560 | 0.749 | 0.736 |
| 80-90% | 8795 | 0.851 | 0.843 |
| 90-100% | 11495 | 0.955 | 0.946 |

## Threes (lines 1, 2, 3, 4, 5+; 58,554 player-games, 292,770 line checks)

| Method | Brier | Log loss |
|---|---|---|
| Last-10-games hit rate | 0.1202 | 0.3816 |
| Poisson (no extra spread) | 0.1148 | 0.3639 |
| SportsPilot without pace/defense | 0.1145 | 0.3590 |
| NBA-PROPS-v1.0 | 0.1145 | 0.3589 |

| Our chance | n | Avg predicted | Actually hit |
|---|---|---|---|
| 0-10% | 140027 | 0.025 | 0.035 |
| 10-20% | 35894 | 0.146 | 0.164 |
| 20-30% | 24425 | 0.248 | 0.266 |
| 30-40% | 19013 | 0.348 | 0.357 |
| 40-50% | 16005 | 0.449 | 0.456 |
| 50-60% | 13895 | 0.549 | 0.546 |
| 60-70% | 13147 | 0.650 | 0.649 |
| 70-80% | 12781 | 0.750 | 0.732 |
| 80-90% | 11364 | 0.848 | 0.837 |
| 90-100% | 6219 | 0.934 | 0.913 |

## Limits

- Assumes normal minutes. It does not know about injuries, rest days, blowouts or a teammate being out, which can swing minutes a lot.
- Player data comes from the last data snapshot; players traded since then keep their old team until the snapshot is refreshed.
- Same-game correlations (e.g. a player's points and assists, or two teammates) are not modeled yet, so parlays built from these are still theoretical.
- Calibration on past seasons is not proof of profit against Polymarket prices.
