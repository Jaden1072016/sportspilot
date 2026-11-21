# NBA player prop projections: held-out validation

Generated 2026-11-21T18:06:09.194Z by `app/scripts/nba/train-props.mjs`. Snapshot built 2026-11-21T18:05:50Z.

**Method.** Expected minutes and per-minute rates are exponentially weighted from earlier games only, scaled by expected pace and (points only) opponent defense. Counts follow a negative binomial whose spread was fit on 2021-2024 and scored on 2025-2027 (2027 partial). Results are conditional on the player playing. Baselines: "last 10 games" hit rate (what most prop sites show) and a Poisson model with the same average (no extra spread).

Fitted spread (negative binomial size r = r0 x mean^beta; lower = wider): {"points":{"r0":0.25,"beta":1.25},"rebounds":{"r0":1.5,"beta":1.25},"assists":{"r0":3,"beta":1},"fg3m":{"r0":4,"beta":1.25}}

## Points (lines 10, 15, 20, 25, 30+; 60,176 player-games, 300,880 line checks)

| Method | Brier | Log loss |
|---|---|---|
| Last-10-games hit rate | 0.0973 | 0.3196 |
| Poisson (no extra spread) | 0.0974 | 0.3698 |
| SportsPilot without pace/defense | 0.0922 | 0.2959 |
| NBA-PROPS-v1.0 | 0.0920 | 0.2951 |

| Our chance | n | Avg predicted | Actually hit |
|---|---|---|---|
| 0-10% | 171007 | 0.023 | 0.028 |
| 10-20% | 33269 | 0.145 | 0.161 |
| 20-30% | 20426 | 0.247 | 0.270 |
| 30-40% | 15622 | 0.348 | 0.367 |
| 40-50% | 12396 | 0.448 | 0.465 |
| 50-60% | 10352 | 0.550 | 0.564 |
| 60-70% | 9296 | 0.649 | 0.658 |
| 70-80% | 8385 | 0.749 | 0.744 |
| 80-90% | 8148 | 0.852 | 0.835 |
| 90-100% | 11979 | 0.956 | 0.939 |

## Rebounds (lines 4, 6, 8, 10, 12+; 60,176 player-games, 300,880 line checks)

| Method | Brier | Log loss |
|---|---|---|
| Last-10-games hit rate | 0.1038 | 0.3370 |
| Poisson (no extra spread) | 0.0993 | 0.3262 |
| SportsPilot without pace/defense | 0.0983 | 0.3140 |
| NBA-PROPS-v1.0 | 0.0983 | 0.3138 |

| Our chance | n | Avg predicted | Actually hit |
|---|---|---|---|
| 0-10% | 161850 | 0.024 | 0.028 |
| 10-20% | 34591 | 0.145 | 0.145 |
| 20-30% | 23249 | 0.248 | 0.244 |
| 30-40% | 17791 | 0.348 | 0.342 |
| 40-50% | 14615 | 0.449 | 0.436 |
| 50-60% | 12516 | 0.548 | 0.527 |
| 60-70% | 10258 | 0.649 | 0.626 |
| 70-80% | 9382 | 0.749 | 0.726 |
| 80-90% | 8014 | 0.850 | 0.819 |
| 90-100% | 8614 | 0.953 | 0.930 |

## Assists (lines 2, 4, 6, 8, 10+; 60,176 player-games, 300,880 line checks)

| Method | Brier | Log loss |
|---|---|---|
| Last-10-games hit rate | 0.0900 | 0.2977 |
| Poisson (no extra spread) | 0.0853 | 0.2770 |
| SportsPilot without pace/defense | 0.0849 | 0.2713 |
| NBA-PROPS-v1.0 | 0.0848 | 0.2711 |

| Our chance | n | Avg predicted | Actually hit |
|---|---|---|---|
| 0-10% | 176627 | 0.018 | 0.021 |
| 10-20% | 27954 | 0.146 | 0.151 |
| 20-30% | 18084 | 0.248 | 0.252 |
| 30-40% | 15010 | 0.349 | 0.355 |
| 40-50% | 13324 | 0.448 | 0.449 |
| 50-60% | 10834 | 0.549 | 0.536 |
| 60-70% | 9469 | 0.650 | 0.646 |
| 70-80% | 8761 | 0.749 | 0.737 |
| 80-90% | 9059 | 0.851 | 0.843 |
| 90-100% | 11758 | 0.955 | 0.946 |

## Threes (lines 1, 2, 3, 4, 5+; 60,176 player-games, 300,880 line checks)

| Method | Brier | Log loss |
|---|---|---|
| Last-10-games hit rate | 0.1204 | 0.3820 |
| Poisson (no extra spread) | 0.1148 | 0.3642 |
| SportsPilot without pace/defense | 0.1146 | 0.3593 |
| NBA-PROPS-v1.0 | 0.1146 | 0.3592 |

| Our chance | n | Avg predicted | Actually hit |
|---|---|---|---|
| 0-10% | 143945 | 0.025 | 0.035 |
| 10-20% | 36912 | 0.146 | 0.164 |
| 20-30% | 25124 | 0.248 | 0.266 |
| 30-40% | 19503 | 0.348 | 0.358 |
| 40-50% | 16429 | 0.449 | 0.455 |
| 50-60% | 14315 | 0.549 | 0.547 |
| 60-70% | 13515 | 0.650 | 0.649 |
| 70-80% | 13105 | 0.750 | 0.732 |
| 80-90% | 11694 | 0.848 | 0.837 |
| 90-100% | 6338 | 0.934 | 0.914 |

## Limits

- Assumes normal minutes. It does not know about injuries, rest days, blowouts or a teammate being out, which can swing minutes a lot.
- Player data comes from the last data snapshot; players traded since then keep their old team until the snapshot is refreshed.
- Same-game correlations (e.g. a player's points and assists, or two teammates) are not modeled yet, so parlays built from these are still theoretical.
- Calibration on past seasons is not proof of profit against Polymarket prices.
