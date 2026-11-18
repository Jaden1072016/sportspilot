# NBA player prop projections: held-out validation

Generated 2026-11-18T19:28:01.452Z by `app/scripts/nba/train-props.mjs`. Snapshot built 2026-11-18T19:27:49Z.

**Method.** Expected minutes and per-minute rates are exponentially weighted from earlier games only, scaled by expected pace and (points only) opponent defense. Counts follow a negative binomial whose spread was fit on 2021-2024 and scored on 2025-2027 (2027 partial). Results are conditional on the player playing. Baselines: "last 10 games" hit rate (what most prop sites show) and a Poisson model with the same average (no extra spread).

Fitted spread (negative binomial size r = r0 x mean^beta; lower = wider): {"points":{"r0":0.25,"beta":1.25},"rebounds":{"r0":1.5,"beta":1.25},"assists":{"r0":3,"beta":1},"fg3m":{"r0":4,"beta":1.25}}

## Points (lines 10, 15, 20, 25, 30+; 59,633 player-games, 298,165 line checks)

| Method | Brier | Log loss |
|---|---|---|
| Last-10-games hit rate | 0.0974 | 0.3197 |
| Poisson (no extra spread) | 0.0975 | 0.3701 |
| SportsPilot without pace/defense | 0.0923 | 0.2961 |
| NBA-PROPS-v1.0 | 0.0920 | 0.2953 |

| Our chance | n | Avg predicted | Actually hit |
|---|---|---|---|
| 0-10% | 169437 | 0.023 | 0.028 |
| 10-20% | 32950 | 0.145 | 0.161 |
| 20-30% | 20239 | 0.247 | 0.270 |
| 30-40% | 15484 | 0.348 | 0.367 |
| 40-50% | 12288 | 0.448 | 0.465 |
| 50-60% | 10253 | 0.550 | 0.563 |
| 60-70% | 9222 | 0.649 | 0.659 |
| 70-80% | 8313 | 0.749 | 0.743 |
| 80-90% | 8083 | 0.852 | 0.835 |
| 90-100% | 11896 | 0.956 | 0.939 |

## Rebounds (lines 4, 6, 8, 10, 12+; 59,633 player-games, 298,165 line checks)

| Method | Brier | Log loss |
|---|---|---|
| Last-10-games hit rate | 0.1039 | 0.3372 |
| Poisson (no extra spread) | 0.0994 | 0.3265 |
| SportsPilot without pace/defense | 0.0984 | 0.3143 |
| NBA-PROPS-v1.0 | 0.0983 | 0.3141 |

| Our chance | n | Avg predicted | Actually hit |
|---|---|---|---|
| 0-10% | 160366 | 0.024 | 0.028 |
| 10-20% | 34265 | 0.145 | 0.145 |
| 20-30% | 23047 | 0.248 | 0.244 |
| 30-40% | 17619 | 0.348 | 0.343 |
| 40-50% | 14492 | 0.448 | 0.436 |
| 50-60% | 12407 | 0.548 | 0.527 |
| 60-70% | 10160 | 0.649 | 0.628 |
| 70-80% | 9312 | 0.749 | 0.725 |
| 80-90% | 7949 | 0.850 | 0.819 |
| 90-100% | 8548 | 0.953 | 0.930 |

## Assists (lines 2, 4, 6, 8, 10+; 59,633 player-games, 298,165 line checks)

| Method | Brier | Log loss |
|---|---|---|
| Last-10-games hit rate | 0.0900 | 0.2978 |
| Poisson (no extra spread) | 0.0853 | 0.2771 |
| SportsPilot without pace/defense | 0.0849 | 0.2714 |
| NBA-PROPS-v1.0 | 0.0848 | 0.2712 |

| Our chance | n | Avg predicted | Actually hit |
|---|---|---|---|
| 0-10% | 175001 | 0.018 | 0.021 |
| 10-20% | 27694 | 0.146 | 0.151 |
| 20-30% | 17924 | 0.248 | 0.252 |
| 30-40% | 14903 | 0.349 | 0.355 |
| 40-50% | 13184 | 0.448 | 0.449 |
| 50-60% | 10733 | 0.549 | 0.535 |
| 60-70% | 9386 | 0.650 | 0.646 |
| 70-80% | 8696 | 0.749 | 0.736 |
| 80-90% | 8973 | 0.851 | 0.843 |
| 90-100% | 11671 | 0.955 | 0.946 |

## Threes (lines 1, 2, 3, 4, 5+; 59,633 player-games, 298,165 line checks)

| Method | Brier | Log loss |
|---|---|---|
| Last-10-games hit rate | 0.1203 | 0.3818 |
| Poisson (no extra spread) | 0.1148 | 0.3642 |
| SportsPilot without pace/defense | 0.1146 | 0.3593 |
| NBA-PROPS-v1.0 | 0.1146 | 0.3592 |

| Our chance | n | Avg predicted | Actually hit |
|---|---|---|---|
| 0-10% | 142645 | 0.025 | 0.035 |
| 10-20% | 36558 | 0.146 | 0.163 |
| 20-30% | 24904 | 0.248 | 0.266 |
| 30-40% | 19323 | 0.348 | 0.358 |
| 40-50% | 16294 | 0.449 | 0.456 |
| 50-60% | 14181 | 0.549 | 0.547 |
| 60-70% | 13380 | 0.650 | 0.648 |
| 70-80% | 12995 | 0.750 | 0.732 |
| 80-90% | 11587 | 0.848 | 0.837 |
| 90-100% | 6298 | 0.934 | 0.913 |

## Limits

- Assumes normal minutes. It does not know about injuries, rest days, blowouts or a teammate being out, which can swing minutes a lot.
- Player data comes from the last data snapshot; players traded since then keep their old team until the snapshot is refreshed.
- Same-game correlations (e.g. a player's points and assists, or two teammates) are not modeled yet, so parlays built from these are still theoretical.
- Calibration on past seasons is not proof of profit against Polymarket prices.
