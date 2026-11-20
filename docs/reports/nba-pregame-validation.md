# NBA pregame model: walk-forward validation

Generated 2026-11-20T19:10:32.900Z by `app/scripts/nba/train-pregame.mjs`. Data snapshot built 2026-11-20T19:10:30Z, last game 2026-11-19.

**Method.** For each test season S, every model is fit only on seasons 2010..S-1 and evaluated on S. Team ratings are updated game by game using results available before tip-off. The ESPN-published sportsbook spread is shown as a **comparison baseline only**; it is never a model input.

Rating hyperparameters tuned on 2010-2016 only: k=0.035, carry=0.65, cap=24. Margin RMSE on tuning seasons 11.93 pts.

## All test games (2019-2027, n=10451)

| Model | Brier | Log loss | Accuracy | ECE |
|---|---|---|---|---|
| Home-court only (constant) | 0.2476 | 0.6883 | 0.557 | 0.0282 |
| Win-percentage (legacy v0.1 input) | 0.2237 | 0.6382 | 0.635 | 0.0304 |
| Margin rating only | 0.2171 | 0.6236 | 0.652 | 0.0064 |
| NBA-PREGAME-v1.0 base | 0.2166 | 0.6225 | 0.654 | 0.0148 |

## Same games, where an ESPN market line exists (n=10444)

| Model | Brier | Log loss | Accuracy | ECE |
|---|---|---|---|---|
| Home-court only (constant) | 0.2476 | 0.6883 | 0.556 | 0.0283 |
| Win-percentage (legacy v0.1 input) | 0.2236 | 0.6381 | 0.635 | 0.0306 |
| Margin rating only | 0.2171 | 0.6235 | 0.652 | 0.0064 |
| NBA-PREGAME-v1.0 base | 0.2165 | 0.6224 | 0.654 | 0.0146 |
| Sportsbook spread (comparison only) | 0.2067 | 0.5997 | 0.677 | 0.0115 |

## Lineup-aware variant (lineup-confirmed scenario, n=10450)

Uses who actually played (from the box score) to measure missing rotation value. This is what the model can do **only when a verified inactive list is available before tip**. Late scratches make the live version weaker than this.

| Model | Brier | Log loss | Accuracy | ECE |
|---|---|---|---|---|
| Base (no availability) | 0.2166 | 0.6225 | 0.654 | 0.0147 |
| Lineup-aware | 0.2123 | 0.6124 | 0.663 | 0.0072 |
| Lineup-aware, market-line games only (n=10443) | 0.2123 | 0.6123 | 0.663 | 0.0071 |
| Sportsbook spread on same games | 0.2067 | 0.5998 | 0.677 | 0.0116 |

## Paired bootstrap, log-loss difference (negative = first model better), 95% interval

- Base vs win-percentage baseline: -0.0157 [-0.0202, -0.0112]
- Base vs rating-only: -0.0011 [-0.0022, 0.0003]
- Base vs sportsbook line: 0.0226 [0.0190, 0.0267]
- Lineup-aware vs base: -0.0102 [-0.0129, -0.0069]

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
| 2027 | 226 | 0.2119 | 0.6097 | 0.5668 (226) |

## Calibration of base model (all test games)

| Band | n | Mean predicted | Observed | Observed 95% CI |
|---|---|---|---|---|
| 0-10% | 34 | 0.077 | 0.088 | 0.030-0.230 |
| 10-20% | 311 | 0.161 | 0.164 | 0.127-0.209 |
| 20-30% | 761 | 0.255 | 0.277 | 0.247-0.310 |
| 30-40% | 1217 | 0.351 | 0.363 | 0.337-0.391 |
| 40-50% | 1531 | 0.452 | 0.464 | 0.440-0.489 |
| 50-60% | 1954 | 0.551 | 0.555 | 0.533-0.577 |
| 60-70% | 1886 | 0.648 | 0.634 | 0.612-0.656 |
| 70-80% | 1602 | 0.748 | 0.730 | 0.708-0.751 |
| 80-90% | 983 | 0.843 | 0.809 | 0.783-0.832 |
| 90-100% | 172 | 0.923 | 0.884 | 0.827-0.923 |

## Calibration of lineup-aware model

| Band | n | Mean predicted | Observed | Observed 95% CI |
|---|---|---|---|---|
| 0-10% | 34 | 0.077 | 0.029 | 0.005-0.149 |
| 10-20% | 311 | 0.161 | 0.132 | 0.099-0.174 |
| 20-30% | 707 | 0.254 | 0.253 | 0.223-0.287 |
| 30-40% | 1250 | 0.355 | 0.355 | 0.329-0.382 |
| 40-50% | 1621 | 0.451 | 0.457 | 0.433-0.481 |
| 50-60% | 1922 | 0.551 | 0.555 | 0.533-0.577 |
| 60-70% | 1917 | 0.650 | 0.652 | 0.630-0.673 |
| 70-80% | 1579 | 0.747 | 0.745 | 0.723-0.766 |
| 80-90% | 967 | 0.843 | 0.808 | 0.782-0.831 |
| 90-100% | 142 | 0.923 | 0.958 | 0.911-0.980 |

## Reading this honestly

- Matching or slightly trailing the sportsbook line on average is expected for a public-data model; the line aggregates information (injury news, sharp money) we do not have. Beating it on average would be a surprising claim that needs much more evidence.
- Value detection does not require beating the market on average. It requires being right *where the model and the price disagree*, which must be measured with real executable prices in paper trading. That evidence does not exist yet.
- The 2027 season row is a partial season (in progress).
