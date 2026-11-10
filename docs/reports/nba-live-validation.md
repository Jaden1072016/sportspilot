# NBA live win probability: held-out validation

Generated 2026-11-09T22:11:24.153Z by `app/scripts/nba/validate-live.mjs`. Snapshot built 2026-11-09T22:06:21Z.

**Method.** In-game states sampled from ESPN play-by-play (coarse early, dense in the final 5 minutes, plus overtime). Parameters fit on 2019-2022 states only; scored on 20000 randomly sampled states from 2023-2027 games (2027 partial). The team-strength prior for every game is the out-of-sample pregame prediction (no game's own result used). Market prices are not used anywhere. Possession is not in the historical state sample, so it is treated as unknown (50/50), which is also the live default when ESPN does not report it.

Fitted analytic params: {"aSigma":18,"aKappa":0.6,"aS0":0,"aLate":1.5}. Fitted Monte Carlo params: {"kappa":0.15,"s0":0} (400 sims/state during fit, 1000 at evaluation).

### All held-out states (n=20000)

| Engine | Brier | Log loss | Accuracy | ECE |
|---|---|---|---|---|
| Legacy v0.1 score/clock/record baseline | 0.1246 | 0.3747 | 0.809 | 0.0271 |
| Score + clock only (no team strength) | 0.1293 | 0.3840 | 0.799 | 0.0265 |
| Analytic OU model with SportsPilot prior | 0.1199 | 0.3615 | 0.819 | 0.0117 |
| Possession Monte Carlo (raw) | 0.1206 | 0.3643 | 0.817 | 0.0186 |
| Possession Monte Carlo (calibrated) | 0.1200 | 0.3624 | 0.817 | 0.0065 |
| Ensemble: mean of calibrated MC and analytic | 0.1198 | 0.3614 | 0.818 | 0.0090 |

### First half (n=6195)

| Engine | Brier | Log loss | Accuracy | ECE |
|---|---|---|---|---|
| Legacy v0.1 score/clock/record baseline | 0.2035 | 0.5902 | 0.674 | 0.0468 |
| Score + clock only (no team strength) | 0.2165 | 0.6198 | 0.646 | 0.0489 |
| Analytic OU model with SportsPilot prior | 0.1936 | 0.5672 | 0.699 | 0.0228 |
| Possession Monte Carlo (raw) | 0.1943 | 0.5684 | 0.692 | 0.0172 |
| Possession Monte Carlo (calibrated) | 0.1940 | 0.5676 | 0.694 | 0.0117 |
| Ensemble: mean of calibrated MC and analytic | 0.1936 | 0.5666 | 0.697 | 0.0129 |

### Third quarter (n=3222)

| Engine | Brier | Log loss | Accuracy | ECE |
|---|---|---|---|---|
| Legacy v0.1 score/clock/record baseline | 0.1571 | 0.4749 | 0.770 | 0.0319 |
| Score + clock only (no team strength) | 0.1613 | 0.4858 | 0.760 | 0.0313 |
| Analytic OU model with SportsPilot prior | 0.1518 | 0.4598 | 0.778 | 0.0171 |
| Possession Monte Carlo (raw) | 0.1529 | 0.4651 | 0.779 | 0.0335 |
| Possession Monte Carlo (calibrated) | 0.1521 | 0.4613 | 0.776 | 0.0208 |
| Ensemble: mean of calibrated MC and analytic | 0.1519 | 0.4601 | 0.777 | 0.0158 |

### Fourth quarter, 12:00-5:00 (n=1975)

| Engine | Brier | Log loss | Accuracy | ECE |
|---|---|---|---|---|
| Legacy v0.1 score/clock/record baseline | 0.1148 | 0.3527 | 0.822 | 0.0260 |
| Score + clock only (no team strength) | 0.1163 | 0.3558 | 0.826 | 0.0216 |
| Analytic OU model with SportsPilot prior | 0.1129 | 0.3465 | 0.827 | 0.0219 |
| Possession Monte Carlo (raw) | 0.1133 | 0.3496 | 0.828 | 0.0274 |
| Possession Monte Carlo (calibrated) | 0.1126 | 0.3463 | 0.827 | 0.0171 |
| Ensemble: mean of calibrated MC and analytic | 0.1127 | 0.3462 | 0.827 | 0.0187 |

### Fourth quarter, final 5:00 to 1:00 (n=4349)

| Engine | Brier | Log loss | Accuracy | ECE |
|---|---|---|---|---|
| Legacy v0.1 score/clock/record baseline | 0.0686 | 0.2187 | 0.902 | 0.0168 |
| Score + clock only (no team strength) | 0.0691 | 0.2190 | 0.901 | 0.0170 |
| Analytic OU model with SportsPilot prior | 0.0677 | 0.2151 | 0.901 | 0.0164 |
| Possession Monte Carlo (raw) | 0.0679 | 0.2174 | 0.902 | 0.0168 |
| Possession Monte Carlo (calibrated) | 0.0676 | 0.2169 | 0.902 | 0.0152 |
| Ensemble: mean of calibrated MC and analytic | 0.0675 | 0.2156 | 0.901 | 0.0144 |

### Final minute of regulation (n=4154)

| Engine | Brier | Log loss | Accuracy | ECE |
|---|---|---|---|---|
| Legacy v0.1 score/clock/record baseline | 0.0439 | 0.1472 | 0.940 | 0.0173 |
| Score + clock only (no team strength) | 0.0426 | 0.1369 | 0.941 | 0.0103 |
| Analytic OU model with SportsPilot prior | 0.0424 | 0.1362 | 0.942 | 0.0100 |
| Possession Monte Carlo (raw) | 0.0431 | 0.1402 | 0.941 | 0.0163 |
| Possession Monte Carlo (calibrated) | 0.0423 | 0.1367 | 0.941 | 0.0097 |
| Ensemble: mean of calibrated MC and analytic | 0.0422 | 0.1359 | 0.941 | 0.0093 |

### Close games: final 6:00, margin within 6 (n=2930)

| Engine | Brier | Log loss | Accuracy | ECE |
|---|---|---|---|---|
| Legacy v0.1 score/clock/record baseline | 0.1570 | 0.4823 | 0.773 | 0.0492 |
| Score + clock only (no team strength) | 0.1560 | 0.4720 | 0.772 | 0.0387 |
| Analytic OU model with SportsPilot prior | 0.1536 | 0.4659 | 0.773 | 0.0328 |
| Possession Monte Carlo (raw) | 0.1550 | 0.4710 | 0.772 | 0.0409 |
| Possession Monte Carlo (calibrated) | 0.1532 | 0.4637 | 0.774 | 0.0213 |
| Ensemble: mean of calibrated MC and analytic | 0.1531 | 0.4640 | 0.772 | 0.0278 |

### Comeback zone: 30:00-10:00 left, margin 8-15 (n=1892)

| Engine | Brier | Log loss | Accuracy | ECE |
|---|---|---|---|---|
| Legacy v0.1 score/clock/record baseline | 0.1459 | 0.4599 | 0.811 | 0.0262 |
| Score + clock only (no team strength) | 0.1485 | 0.4683 | 0.811 | 0.0210 |
| Analytic OU model with SportsPilot prior | 0.1417 | 0.4468 | 0.811 | 0.0183 |
| Possession Monte Carlo (raw) | 0.1434 | 0.4527 | 0.812 | 0.0449 |
| Possession Monte Carlo (calibrated) | 0.1421 | 0.4482 | 0.811 | 0.0296 |
| Ensemble: mean of calibrated MC and analytic | 0.1418 | 0.4469 | 0.811 | 0.0205 |

### Overtime (n=105)

| Engine | Brier | Log loss | Accuracy | ECE |
|---|---|---|---|---|
| Legacy v0.1 score/clock/record baseline | 0.1606 | 0.4642 | 0.762 | 0.0974 |
| Score + clock only (no team strength) | 0.1632 | 0.4783 | 0.695 | 0.0713 |
| Analytic OU model with SportsPilot prior | 0.1586 | 0.4673 | 0.771 | 0.0940 |
| Possession Monte Carlo (raw) | 0.1582 | 0.4605 | 0.750 | 0.0734 |
| Possession Monte Carlo (calibrated) | 0.1596 | 0.4701 | 0.733 | 0.0788 |
| Ensemble: mean of calibrated MC and analytic | 0.1587 | 0.4680 | 0.762 | 0.0661 |

Comeback zone, trailing team: Monte Carlo mean predicted 0.166, score/clock-only mean predicted 0.200, observed win rate 0.189 (n=1892).

## Paired bootstrap, log-loss difference (negative = Monte Carlo better), 95% interval

- vs legacy v0.1: -0.0123 [-0.0145, -0.0100]
- vs score+clock only: -0.0216 [-0.0237, -0.0189]
- vs analytic OU: 0.0009 [-0.0000, 0.0018]

## Calibration, Monte Carlo engine (held-out)

| Band | n | Mean predicted | Observed | Observed 95% CI |
|---|---|---|---|---|
| 0-10% | 3491 | 0.020 | 0.016 | 0.013-0.021 |
| 10-20% | 1073 | 0.151 | 0.155 | 0.134-0.178 |
| 20-30% | 1140 | 0.250 | 0.244 | 0.220-0.270 |
| 30-40% | 1247 | 0.352 | 0.376 | 0.350-0.403 |
| 40-50% | 1456 | 0.451 | 0.477 | 0.451-0.502 |
| 50-60% | 1582 | 0.550 | 0.559 | 0.534-0.583 |
| 60-70% | 1534 | 0.651 | 0.654 | 0.630-0.677 |
| 70-80% | 1615 | 0.750 | 0.741 | 0.719-0.762 |
| 80-90% | 1596 | 0.851 | 0.849 | 0.831-0.866 |
| 90-100% | 5266 | 0.980 | 0.980 | 0.976-0.984 |

## Calibration in the 3x-5x payout band (model probability 20%-33%)

Sides the model priced at 20%-33% (n=3665): mean predicted 0.267, observed 0.267. States within a game are correlated, so the effective sample is smaller than n.

## Limits

- No lineup / on-court / foul-trouble inputs yet: ESPN live feeds do not reliably expose who is on the floor. These are listed as not connected in the app.
- States from the same game are correlated; intervals above treat states as independent and are therefore too narrow.
- Good calibration is necessary but not sufficient for profitable trading. The live market also sees the score; edge must be measured against executable prices in paper trading.

## Engine selection

Deployed engine: **ensemble** (lowest held-out log loss, rounded to 3 decimals, then lowest calibration error). Selection on the held-out set is a mild form of test-set reuse; the next untouched check is prospective live logging.
