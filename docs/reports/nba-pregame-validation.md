# NBA pregame model: walk-forward validation

Generated 2026-11-12T19:00:19.279Z by `app/scripts/nba/train-pregame.mjs`. Data snapshot built 2026-11-12T19:00:15Z, last game 2026-11-11.

**Method.** For each test season S, every model is fit only on seasons 2010..S-1 and evaluated on S. Team ratings are updated game by game using results available before tip-off. The ESPN-published sportsbook spread is shown as a **comparison baseline only**; it is never a model input.

Rating hyperparameters tuned on 2010-2016 only: k=0.035, carry=0.65, cap=24. Margin RMSE on tuning seasons 11.93 pts.

## All test games (2019-2027, n=10395)

| Model | Brier | Log loss | Accuracy | ECE |
|---|---|---|---|---|
| Home-court only (constant) | 0.2475 | 0.6882 | 0.557 | 0.0278 |
| Win-percentage (legacy v0.1 input) | 0.2237 | 0.6381 | 0.634 | 0.0304 |
| Margin rating only | 0.2171 | 0.6234 | 0.652 | 0.0062 |
| NBA-PREGAME-v1.0 base | 0.2165 | 0.6222 | 0.654 | 0.0143 |

## Same games, where an ESPN market line exists (n=10388)

| Model | Brier | Log loss | Accuracy | ECE |
|---|---|---|---|---|
| Home-court only (constant) | 0.2475 | 0.6882 | 0.557 | 0.0279 |
| Win-percentage (legacy v0.1 input) | 0.2236 | 0.6381 | 0.634 | 0.0305 |
| Margin rating only | 0.2170 | 0.6233 | 0.652 | 0.0062 |
| NBA-PREGAME-v1.0 base | 0.2164 | 0.6221 | 0.654 | 0.0141 |
| Sportsbook spread (comparison only) | 0.2066 | 0.5995 | 0.677 | 0.0116 |

## Lineup-aware variant (lineup-confirmed scenario, n=10394)

Uses who actually played (from the box score) to measure missing rotation value. This is what the model can do **only when a verified inactive list is available before tip**. Late scratches make the live version weaker than this.

| Model | Brier | Log loss | Accuracy | ECE |
|---|---|---|---|---|
| Base (no availability) | 0.2165 | 0.6223 | 0.654 | 0.0142 |
| Lineup-aware | 0.2122 | 0.6120 | 0.663 | 0.0068 |
| Lineup-aware, market-line games only (n=10387) | 0.2121 | 0.6119 | 0.663 | 0.0067 |
| Sportsbook spread on same games | 0.2066 | 0.5995 | 0.677 | 0.0117 |

## Paired bootstrap, log-loss difference (negative = first model better), 95% interval

- Base vs win-percentage baseline: -0.0159 [-0.0198, -0.0116]
- Base vs rating-only: -0.0011 [-0.0024, 0.0002]
- Base vs sportsbook line: 0.0226 [0.0190, 0.0267]
- Lineup-aware vs base: -0.0102 [-0.0134, -0.0071]

## By season (base model vs market line)

| Season | n | Base Brier | Base log loss | Market log loss (n) |
|---|---|---|---|---|
| 2019 | 1312 | 0.2126 | 0.6133 | 0.5974 (1312) |
| 2020 | 1143 | 0.2211 | 0.6322 | 0.6110 (1137) |
| 2021 | 1165 | 0.2268 | 0.6457 | 0.6210 (1165) |
| 2022 | 1323 | 0.2194 | 0.6301 | 0.6061 (1323) |
| 2023 | 1320 | 0.2276 | 0.6479 | 0.6259 (1320) |
| 2024 | 1319 | 0.2106 | 0.6085 | 0.5842 (1319) |
| 2025 | 1321 | 0.2102 | 0.6065 | 0.5860 (1321) |
| 2026 | 1322 | 0.2071 | 0.6021 | 0.5761 (1321) |
| 2027 | 170 | 0.2040 | 0.5889 | 0.5425 (170) |

## Calibration of base model (all test games)

| Band | n | Mean predicted | Observed | Observed 95% CI |
|---|---|---|---|---|
| 0-10% | 33 | 0.076 | 0.091 | 0.031-0.236 |
| 10-20% | 306 | 0.161 | 0.163 | 0.126-0.209 |
| 20-30% | 755 | 0.255 | 0.278 | 0.247-0.311 |
| 30-40% | 1208 | 0.351 | 0.363 | 0.336-0.390 |
| 40-50% | 1525 | 0.452 | 0.464 | 0.439-0.489 |
| 50-60% | 1947 | 0.551 | 0.555 | 0.533-0.577 |
| 60-70% | 1882 | 0.648 | 0.634 | 0.612-0.655 |
| 70-80% | 1590 | 0.748 | 0.732 | 0.710-0.753 |
| 80-90% | 978 | 0.843 | 0.809 | 0.783-0.832 |
| 90-100% | 171 | 0.923 | 0.889 | 0.833-0.928 |

## Calibration of lineup-aware model

| Band | n | Mean predicted | Observed | Observed 95% CI |
|---|---|---|---|---|
| 0-10% | 33 | 0.077 | 0.030 | 0.005-0.153 |
| 10-20% | 308 | 0.161 | 0.133 | 0.100-0.176 |
| 20-30% | 700 | 0.254 | 0.253 | 0.222-0.286 |
| 30-40% | 1246 | 0.355 | 0.355 | 0.329-0.382 |
| 40-50% | 1609 | 0.451 | 0.458 | 0.434-0.482 |
| 50-60% | 1918 | 0.551 | 0.554 | 0.532-0.576 |
| 60-70% | 1909 | 0.650 | 0.652 | 0.630-0.673 |
| 70-80% | 1570 | 0.747 | 0.745 | 0.723-0.766 |
| 80-90% | 959 | 0.843 | 0.810 | 0.784-0.834 |
| 90-100% | 142 | 0.923 | 0.958 | 0.911-0.980 |

## Reading this honestly

- Matching or slightly trailing the sportsbook line on average is expected for a public-data model; the line aggregates information (injury news, sharp money) we do not have. Beating it on average would be a surprising claim that needs much more evidence.
- Value detection does not require beating the market on average. It requires being right *where the model and the price disagree*, which must be measured with real executable prices in paper trading. That evidence does not exist yet.
- The 2027 season row is a partial season (in progress).
