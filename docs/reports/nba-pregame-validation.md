# NBA pregame model: walk-forward validation

Generated 2026-11-27T20:04:17.546Z by `app/scripts/nba/train-pregame.mjs`. Data snapshot built 2026-11-27T20:04:13Z, last game 2026-11-25.

**Method.** For each test season S, every model is fit only on seasons 2010..S-1 and evaluated on S. Team ratings are updated game by game using results available before tip-off. The ESPN-published sportsbook spread is shown as a **comparison baseline only**; it is never a model input.

Rating hyperparameters tuned on 2010-2016 only: k=0.035, carry=0.65, cap=24. Margin RMSE on tuning seasons 11.93 pts.

## All test games (2019-2027, n=10495)

| Model | Brier | Log loss | Accuracy | ECE |
|---|---|---|---|---|
| Home-court only (constant) | 0.2475 | 0.6882 | 0.557 | 0.0279 |
| Win-percentage (legacy v0.1 input) | 0.2236 | 0.6379 | 0.635 | 0.0302 |
| Margin rating only | 0.2172 | 0.6237 | 0.652 | 0.0061 |
| NBA-PREGAME-v1.0 base | 0.2167 | 0.6227 | 0.654 | 0.0151 |

## Same games, where an ESPN market line exists (n=10488)

| Model | Brier | Log loss | Accuracy | ECE |
|---|---|---|---|---|
| Home-court only (constant) | 0.2475 | 0.6883 | 0.557 | 0.0280 |
| Win-percentage (legacy v0.1 input) | 0.2235 | 0.6379 | 0.635 | 0.0303 |
| Margin rating only | 0.2171 | 0.6236 | 0.652 | 0.0062 |
| NBA-PREGAME-v1.0 base | 0.2166 | 0.6226 | 0.654 | 0.0150 |
| Sportsbook spread (comparison only) | 0.2068 | 0.5999 | 0.677 | 0.0117 |

## Lineup-aware variant (lineup-confirmed scenario, n=10494)

Uses who actually played (from the box score) to measure missing rotation value. This is what the model can do **only when a verified inactive list is available before tip**. Late scratches make the live version weaker than this.

| Model | Brier | Log loss | Accuracy | ECE |
|---|---|---|---|---|
| Base (no availability) | 0.2167 | 0.6227 | 0.654 | 0.0151 |
| Lineup-aware | 0.2124 | 0.6125 | 0.662 | 0.0073 |
| Lineup-aware, market-line games only (n=10487) | 0.2123 | 0.6124 | 0.662 | 0.0071 |
| Sportsbook spread on same games | 0.2068 | 0.5999 | 0.677 | 0.0117 |

## Paired bootstrap, log-loss difference (negative = first model better), 95% interval

- Base vs win-percentage baseline: -0.0152 [-0.0197, -0.0098]
- Base vs rating-only: -0.0010 [-0.0024, 0.0003]
- Base vs sportsbook line: 0.0227 [0.0186, 0.0265]
- Lineup-aware vs base: -0.0102 [-0.0133, -0.0070]

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
| 2027 | 270 | 0.2157 | 0.6184 | 0.5776 (270) |

## Calibration of base model (all test games)

| Band | n | Mean predicted | Observed | Observed 95% CI |
|---|---|---|---|---|
| 0-10% | 36 | 0.078 | 0.111 | 0.044-0.253 |
| 10-20% | 312 | 0.161 | 0.163 | 0.127-0.209 |
| 20-30% | 765 | 0.255 | 0.278 | 0.248-0.311 |
| 30-40% | 1224 | 0.351 | 0.364 | 0.338-0.392 |
| 40-50% | 1535 | 0.452 | 0.464 | 0.440-0.490 |
| 50-60% | 1959 | 0.551 | 0.555 | 0.533-0.577 |
| 60-70% | 1892 | 0.648 | 0.634 | 0.612-0.655 |
| 70-80% | 1609 | 0.748 | 0.730 | 0.708-0.751 |
| 80-90% | 990 | 0.843 | 0.809 | 0.783-0.832 |
| 90-100% | 173 | 0.923 | 0.884 | 0.828-0.924 |

## Calibration of lineup-aware model

| Band | n | Mean predicted | Observed | Observed 95% CI |
|---|---|---|---|---|
| 0-10% | 34 | 0.077 | 0.029 | 0.005-0.149 |
| 10-20% | 311 | 0.161 | 0.132 | 0.099-0.174 |
| 20-30% | 714 | 0.254 | 0.255 | 0.224-0.288 |
| 30-40% | 1255 | 0.355 | 0.356 | 0.330-0.383 |
| 40-50% | 1630 | 0.451 | 0.458 | 0.434-0.482 |
| 50-60% | 1926 | 0.551 | 0.555 | 0.533-0.577 |
| 60-70% | 1925 | 0.650 | 0.651 | 0.630-0.672 |
| 70-80% | 1585 | 0.747 | 0.744 | 0.722-0.765 |
| 80-90% | 971 | 0.843 | 0.808 | 0.782-0.832 |
| 90-100% | 143 | 0.923 | 0.958 | 0.911-0.981 |

## Reading this honestly

- Matching or slightly trailing the sportsbook line on average is expected for a public-data model; the line aggregates information (injury news, sharp money) we do not have. Beating it on average would be a surprising claim that needs much more evidence.
- Value detection does not require beating the market on average. It requires being right *where the model and the price disagree*, which must be measured with real executable prices in paper trading. That evidence does not exist yet.
- The 2027 season row is a partial season (in progress).
