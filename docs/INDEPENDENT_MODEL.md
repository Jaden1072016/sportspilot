# Independent model specification (the actual product moat)

## Principle
The user's goal is knowledgeable sports intelligence: predict the *underlying event*, not repeat the current market. Predictions must be generated strictly from information available before the forecast timestamp. Polymarket prices are excluded from independent model features and may enter only the downstream quote comparison and performance-baseline evaluation stages.

## What is built (v0.2)
Code: `app/lib/nba/`. Training/validation: `app/scripts/nba/`. Reports: `docs/reports/`.

**NBA-PREGAME-v1.0** (`ratings.mjs`, `availability.mjs`, `pregame.mjs`)
- Margin rating per team (Elo on point margin, residual capped, 65% season carry-over), learned league home edge (fell from ~3 to ~1.8 pts after 2020), offense/defense/pace per 100 possessions.
- Logistic layer over frozen features: rating margin, back-to-back flags, rest advantage, early-season discount. Lineup-aware variant adds missing and available rotation value (Game Score per minute vs replacement, exponentially weighted).
- Season walk-forward 2019-2027 (10,386 games): log loss 0.622 base, 0.612 lineup-aware (lineup-confirmed scenario) vs 0.638 win-percentage baseline and 0.600 sportsbook line (comparison only).

**NBA-LIVE-v1.0** (`live.mjs`, `predict.mjs`)
- Possession Monte Carlo: per-possession scoring distribution scaled to the pregame expected efficiency, fitted lead mean-reversion (real NBA leads shrink), late-game intentional fouling, clock milking, 3-point chasing when down 3, overtime. Seeded and reproducible.
- Closed-form Ornstein-Uhlenbeck normal model with late-game variance boost.
- Deployed: average of calibrated simulation and closed form. Fit on 2019-2022 states, scored on 20,000 states from 2023-2027: log loss 0.3614 vs 0.3747 legacy v0.1 and 0.3840 score-and-clock only. Sides priced at 20-33% won 26.7% vs 26.7% predicted.
- Output: probability, prior-sensitivity band (not a calibrated interval), Monte Carlo error, overtime probability, final-margin range, evidence lines built from computed numbers, and an explicit list of inputs not connected.

The old `NBA-SCORECLOCK-BASELINE-v0.1` (`lib/model.mjs`) is kept only as a comparison baseline.

## Target NBA pregame model
1. Gather 3–5 seasons of licensed/permitted historical game data when available; adjust for player/team migrations, no leakage after prediction time.
2. Elo-ish rolling team strength and Bayesian regularized offense/defense; home-court, rest/travel, injuries, lineup availability, pace, matchup effects, rolling effective field-goal percentage, turnovers, offensive rebounds, free throw rate.
3. Use date-ordered walk-forward fits and season-level holdouts; tune using log loss, Brier score and calibration rather than backtest profit alone.
4. Compute a prior distribution for winning and expected pace. Robustly shrink small samples to league priors.
5. Separate point estimates from uncertainty. Missing lineup status reduces confidence, not magically reweights predictions toward the desired side.

## Target NBA in-game state model
At every accepted event-state snapshot:
- Period, regulation/overtime rules, exact game clock, score, timeout availability, bonus/fouls, possession if available, game pace, minutes played, which players are actually on the floor (verified—not simply 'started'), availability/injuries, projected next rotations, relative strength of active units.
- Infer possession-level points distributions, team pace and foul/late-game strategy; simulate the *remaining* game, not merely extend scoring averages.
- Use conditional models: lineup changes, deliberate fouling, risk of benching starters in blowouts, overtime, ejections, and substitution variance.
- Simulate at least 5k samples per meaningful state change once calibrations are established. Simulation count is a numerical approximation quality parameter, not proof of forecast accuracy.
- Report win probability, sensitivity/credible interval calibrated against historical outcomes, top explanatory features, data completeness and reasons for blocked output.
- Detect drift/discontinuities, e.g., sudden injury, red-hot shooting streak vs long-run skill, stale scoreboard after TV broadcast; show 'PAUSED' rather than invented state.

## Player props: points/rebounds/assists
Estimate outcomes through a hierarchical joint model, not raw average and low thresholds.
- Minutes distribution conditioned on starter/bench role, foul/trouble, rotations, score margin, injury and blowout probabilities.
- Opportunity rates: FGA/min, usage, free-throw attempts, assist chances, rebound chances, pace and opponent defensive scheme.
- Conditional scoring rates with uncertainty; points often overdispersed versus Poisson, rebounds/assists count models should be validated against negative binomial, zero inflation if appropriate, and empirical bootstrap.
- `P(stat >= threshold)` must honor rules such as 4.5 implies 5+, and whether overtime counts according to the actual contract.
- Adjust for recent role changes only when evidence supports them. Highlight stat provider inaccuracies/settlement corrections.
- Provide feature attribution: expected minutes, projected attempts/opportunities, opponent adjustment and uncertainty; avoid speculative 'hot hand' over-weighting.

## Correlated parlay model
- For legs A/B, `P(A ∩ B) = P(A)P(B)` is valid only if independent. Same-game scoring/assists/pace/game-script legs commonly are NOT.
- Simulate whole games with common latent pace, team scoring, rotation, minutes and game script, then evaluate all leg outcomes against that SAME simulated game to estimate joint probability.
- For cross-game legs, independence may be approximate but shared injury news, travel/weather, simultaneous slate data and selection bias can still create dependencies.
- Never multiply quoted single-leg payouts as though they are a real native Combo quote. Use an actual Combo instrument quote and official eligibility if supported.
- At a 3–5× gross payout target, fair market implied break-even before fees is 33.3%–20% respectively. A 4× payout can still lose frequently even with positive EV.

## Downstream market and risk math
For a binary YES outcome with a valid buy-ask `a` in dollars per $1 settlement, no fees and no slippage:
- Gross payout multiple = `1 / a`.
- Gross expected ROI = `p_model / a - 1`.
- Gross expected profit on $5 = `$5 × (p_model/a - 1)`.

But actual trading requires precise fee schedule, sizes in depth, minimum orders, slippage, partial fills, market status, trade settlement rules and quote age. Code currently exposes `feeFraction` as a deliberately simplified hypothetical input **not a verified actual Polymarket fee model**. Implement authoritative fee formula before anything 'actionable'.

Guard against:
- Stale quote / contradictory game state clocks / unverified outcome mapping.
- Probability closer to 0 or 1 due to numerical saturation; clipped output is not evidence of confidence.
- Correlated selections, multiple testing, cherry-picked thresholds, and one-season overfitting.
- Market odds as feature leakage, accidentally using final injury reports for past pregame predictions.
- Backtests that buy at a midpoint or opening price unavailable at alert time.

## Backtesting release evidence
- Train/validation/test split chronological, with timestamped feature availability and at least one untouched recent season. Freeze a feature list and parameter revision before test.
- Brier score + log loss; reliability curve / calibration errors by probability decile, by quarter, by close-game state, by season; include statistical uncertainty and bootstrapped intervals.
- Compare to season record baselines, simple score/clock model and market implied probability (baseline only, not model feature).
- Simulated slippage, exact quote ask available at timestamp, size constraints, fees, stale signal rate and cash drawdown; paper trading before live.
- Track by side/price band/quarter, particularly 3–5× outcomes which have sparse wins and wide confidence intervals. Don't advertise superiority after too few samples.
- Audit every prediction that qualified and every suppressed prediction; report drawdowns, win-rate confidence intervals, false positive rate and sample size.

## Expert-level narrative engine
A credible 'fan-level analyst' explanation must cite observed inputs: verified lineup, expected minutes, opponent matchup, real injury report, score/game state, rotation history. If a field is missing, say missing. No fictional coaching plans or 'insider info'. AI text explains measured model signals; it never substitutes unsupported odds for math.
