# NBA player prop projections: held-out validation

Generated 2026-11-22T18:35:50.977Z by `app/scripts/nba/train-props.mjs`. Snapshot built 2026-11-22T18:35:33Z.

**Method.** Expected minutes and per-minute rates are exponentially weighted from earlier games only, scaled by expected pace and (points only) opponent defense. Counts follow a negative binomial whose spread was fit on 2021-2024 and scored on 2025-2027 (2027 partial). Results are conditional on the player playing. Baselines: "last 10 games" hit rate (what most prop sites show) and a Poisson model with the same average (no extra spread).

Fitted spread (negative binomial size r = r0 x mean^beta; lower = wider): {"points":{"r0":0.25,"beta":1.25},"rebounds":{"r0":1.5,"beta":1.25},"assists":{"r0":3,"beta":1},"fg3m":{"r0":4,"beta":1.25}}

## Points (lines 10, 15, 20, 25, 30+; 60,302 player-games, 301,510 line checks)

| Method | Brier | Log loss |
|---|---|---|
| Last-10-games hit rate | 0.0973 | 0.3195 |
| Poisson (no extra spread) | 0.0974 | 0.3696 |
| SportsPilot without pace/defense | 0.0922 | 0.2958 |
| NBA-PROPS-v1.0 | 0.0920 | 0.2950 |

| Our chance | n | Avg predicted | Actually hit |
|---|---|---|---|
| 0-10% | 171385 | 0.023 | 0.028 |
| 10-20% | 33341 | 0.145 | 0.161 |
| 20-30% | 20461 | 0.247 | 0.270 |
| 30-40% | 15659 | 0.348 | 0.367 |
| 40-50% | 12422 | 0.448 | 0.465 |
| 50-60% | 10364 | 0.550 | 0.564 |
| 60-70% | 9320 | 0.649 | 0.658 |
| 70-80% | 8400 | 0.749 | 0.744 |
| 80-90% | 8161 | 0.852 | 0.836 |
| 90-100% | 11997 | 0.956 | 0.940 |

## Rebounds (lines 4, 6, 8, 10, 12+; 60,302 player-games, 301,510 line checks)

| Method | Brier | Log loss |
|---|---|---|
| Last-10-games hit rate | 0.1038 | 0.3371 |
| Poisson (no extra spread) | 0.0993 | 0.3263 |
| SportsPilot without pace/defense | 0.0983 | 0.3141 |
| NBA-PROPS-v1.0 | 0.0983 | 0.3139 |

| Our chance | n | Avg predicted | Actually hit |
|---|---|---|---|
| 0-10% | 162205 | 0.024 | 0.028 |
| 10-20% | 34666 | 0.145 | 0.145 |
| 20-30% | 23292 | 0.248 | 0.245 |
| 30-40% | 17831 | 0.348 | 0.342 |
| 40-50% | 14640 | 0.448 | 0.436 |
| 50-60% | 12547 | 0.548 | 0.527 |
| 60-70% | 10276 | 0.649 | 0.627 |
| 70-80% | 9400 | 0.749 | 0.726 |
| 80-90% | 8029 | 0.850 | 0.819 |
| 90-100% | 8624 | 0.953 | 0.930 |

## Assists (lines 2, 4, 6, 8, 10+; 60,302 player-games, 301,510 line checks)

| Method | Brier | Log loss |
|---|---|---|
| Last-10-games hit rate | 0.0900 | 0.2977 |
| Poisson (no extra spread) | 0.0853 | 0.2769 |
| SportsPilot without pace/defense | 0.0848 | 0.2712 |
| NBA-PROPS-v1.0 | 0.0848 | 0.2711 |

| Our chance | n | Avg predicted | Actually hit |
|---|---|---|---|
| 0-10% | 177009 | 0.018 | 0.021 |
| 10-20% | 28018 | 0.146 | 0.151 |
| 20-30% | 18118 | 0.248 | 0.252 |
| 30-40% | 15034 | 0.349 | 0.354 |
| 40-50% | 13354 | 0.448 | 0.449 |
| 50-60% | 10861 | 0.549 | 0.536 |
| 60-70% | 9484 | 0.650 | 0.646 |
| 70-80% | 8773 | 0.749 | 0.737 |
| 80-90% | 9085 | 0.851 | 0.843 |
| 90-100% | 11774 | 0.955 | 0.946 |

## Threes (lines 1, 2, 3, 4, 5+; 60,302 player-games, 301,510 line checks)

| Method | Brier | Log loss |
|---|---|---|
| Last-10-games hit rate | 0.1204 | 0.3820 |
| Poisson (no extra spread) | 0.1149 | 0.3642 |
| SportsPilot without pace/defense | 0.1146 | 0.3593 |
| NBA-PROPS-v1.0 | 0.1146 | 0.3592 |

| Our chance | n | Avg predicted | Actually hit |
|---|---|---|---|
| 0-10% | 144239 | 0.025 | 0.035 |
| 10-20% | 37001 | 0.146 | 0.164 |
| 20-30% | 25170 | 0.248 | 0.266 |
| 30-40% | 19548 | 0.348 | 0.358 |
| 40-50% | 16460 | 0.449 | 0.455 |
| 50-60% | 14344 | 0.549 | 0.547 |
| 60-70% | 13550 | 0.650 | 0.649 |
| 70-80% | 13132 | 0.750 | 0.732 |
| 80-90% | 11718 | 0.848 | 0.837 |
| 90-100% | 6348 | 0.934 | 0.914 |

## Limits

- Assumes normal minutes. It does not know about injuries, rest days, blowouts or a teammate being out, which can swing minutes a lot.
- Player data comes from the last data snapshot; players traded since then keep their old team until the snapshot is refreshed.
- Same-game correlations (e.g. a player's points and assists, or two teammates) are not modeled yet, so parlays built from these are still theoretical.
- Calibration on past seasons is not proof of profit against Polymarket prices.
