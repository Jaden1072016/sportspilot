import { ageSeconds } from './utils.mjs';
// Value detection. Runs strictly AFTER an independent probability exists.
// Fail-closed: every unmet requirement becomes a named blocker; any blocker => not actionable.

export const DEFAULT_GATES = Object.freeze({
  maxQuoteAgeSec: 10,
  minNetEV: 0.05,             // require 5% modeled edge after costs, not just > 0
  minGrossMultiple: 3, maxGrossMultiple: 5,
  maxSlippage: 0.02,           // dollars per contract above top of book
  edgeMustExceedUncertainty: true,
});

/** Legacy single-quote assessment (kept for compatibility with existing callers/tests). */
export function assessSingle({ probability, ask, feeFraction = null, quoteTime = null, nowMs = Date.now(), modelValidated = false, linkVerified = false, marketOpen = true, availableDepthVerified = false, min = 3, max = 5 }) {
  if (!Number.isFinite(probability) || probability <= 0 || probability >= 1) return { eligible: false, reason: 'Missing or invalid independent probability' };
  if (!Number.isFinite(ask) || ask <= 0 || ask >= 1) return { eligible: false, reason: 'Missing or invalid executable ask' };
  const grossMultiplier = 1 / ask;
  const grossEV = probability * grossMultiplier - 1;
  const quoteAgeSec = ageSeconds(quoteTime, nowMs);
  const feeKnown = Number.isFinite(feeFraction) && feeFraction >= 0 && feeFraction < 1;
  const netEV = feeKnown ? grossEV - feeFraction : null;
  const blockers = [];
  if (!modelValidated) blockers.push('Model not historically validated and calibrated');
  if (!linkVerified) blockers.push('Sports event and selected contract side not independently verified');
  if (!marketOpen) blockers.push('Market not confirmed open');
  if (!availableDepthVerified) blockers.push('Available execution depth not checked');
  if (quoteAgeSec > 10) blockers.push('Quote stale or timestamp unavailable');
  if (!feeKnown) blockers.push('Fees not configured/verified');
  if (grossMultiplier < min || grossMultiplier > max) blockers.push(`Outside selected ${min}–${max}× target`);
  if (netEV === null || netEV <= 0) blockers.push('No verified positive net expected value');
  return { eligible: blockers.length === 0, blockers, grossMultiplier, grossEV, netEV, quoteAgeSec, breakEven: ask, expectedGrossReturn: probability * grossMultiplier };
}

/**
 * Full opportunity evaluation using an order-book fill.
 * @param p        independent model probability for the selected side
 * @param pLow     lower end of the model's uncertainty band for that side (or null)
 * @param fill     result of executableFill()
 * @param book     normalized book (state, quoteTime)
 * @param fee      { fraction, verified } fee assumption on stake; verified=false always blocks
 * @param checks   { modelStatus:'validated'|'research', linkVerified, inputsComplete, gameLive, gameStateAgeSec }
 */
export function evaluateOpportunity({ p, pLow = null, fill, book, fee = { fraction: null, verified: false }, checks = {}, gates = DEFAULT_GATES, nowMs = Date.now() }) {
  const blockers = [], warnings = [];
  if (!Number.isFinite(p) || p <= 0 || p >= 1) return { actionable: false, blockers: ['No independent probability available'], warnings };
  if (!fill?.ok) blockers.push(fill?.reason ? `Can't buy your stake at a real price: ${fill.reason}` : 'No real price available for your stake');
  if (!book) blockers.push('Price not checked yet');
  if (book && !book.open) blockers.push(`Market is not open for trading (status: ${String(book.state || 'unknown').replace('MARKET_STATE_', '')})`);
  const quoteAgeSec = ageSeconds(book?.quoteTime, nowMs);
  if (!(quoteAgeSec <= gates.maxQuoteAgeSec)) blockers.push(Number.isFinite(quoteAgeSec) ? `Price is ${quoteAgeSec.toFixed(0)} seconds old (must be under ${gates.maxQuoteAgeSec})` : 'Price has no timestamp, so we can\'t tell how fresh it is');
  const avg = fill?.ok ? fill.avgPrice : null;
  const grossMultiple = avg ? 1 / avg : null;
  const feeKnown = fee && Number.isFinite(fee.fraction) && fee.fraction >= 0 && fee.fraction < 0.5;
  if (!feeKnown) blockers.push('Fee not set in Settings');
  else if (!fee.verified) blockers.push('Fee not verified against Polymarket\'s published fees');
  const grossEV = avg ? p / avg - 1 : null;
  const netEV = avg && feeKnown ? p * (1 - fee.fraction) / avg - 1 : null;
  const netEVLow = avg && feeKnown && Number.isFinite(pLow) ? pLow * (1 - fee.fraction) / avg - 1 : null;
  if (grossMultiple && (grossMultiple < gates.minGrossMultiple || grossMultiple > gates.maxGrossMultiple)) blockers.push(`Pays ${grossMultiple.toFixed(2)}×, outside your ${gates.minGrossMultiple}–${gates.maxGrossMultiple}× target`);
  if (fill?.ok && fill.slippage > gates.maxSlippage) blockers.push(`Your stake pushes the price up ${(fill.slippage * 100).toFixed(1)}¢, more than your ${(gates.maxSlippage * 100).toFixed(1)}¢ limit`);
  if (netEV !== null && netEV < gates.minNetEV) blockers.push(`Expected profit ${(netEV * 100).toFixed(1)}% is below your ${(gates.minNetEV * 100).toFixed(0)}% minimum`);
  if (gates.edgeMustExceedUncertainty && avg) {
    // Test robustness even when fees are unset (fees then counted as 0, which is the optimistic case).
    const lowCheck = Number.isFinite(pLow) ? pLow * (1 - (feeKnown ? fee.fraction : 0)) / avg - 1 : null;
    if (lowCheck === null) blockers.push('Our range of uncertainty for this chance is unavailable');
    else if (lowCheck <= 0) blockers.push('Too much uncertainty: the edge disappears if our chance is at the low end of its range');
  }
  if (checks.modelStatus !== 'validated') blockers.push('Model is still in testing (RESEARCH status). It has to prove itself in paper trading first');
  if (!checks.linkVerified) blockers.push('Contract not matched to a game yet');
  if (!checks.inputsComplete) blockers.push('Missing information: injury reports are not connected yet');
  if (checks.gameStateAgeSec !== undefined && !(checks.gameStateAgeSec <= 45)) blockers.push('Score data is more than 45 seconds old');
  if (p > 0.97 || p < 0.03) warnings.push('Chance is very close to 0% or 100%, where small model errors matter most');
  return { actionable: blockers.length === 0, blockers, warnings, grossMultiple, grossEV, netEV, netEVLow, quoteAgeSec, avgPrice: avg, breakEven: avg ? avg / (1 - (feeKnown ? fee.fraction : 0)) : null };
}

/** Parlay math under the independence assumption. Never an executable Combo quote. */
export function calculateIndependentParlay(legs) {
  if (!Array.isArray(legs) || legs.length < 2 || legs.length > 20) throw new Error('Enter between 2 and 20 legs');
  if (legs.some(l => !Number.isFinite(l.p) || l.p <= 0 || l.p >= 1 || !Number.isFinite(l.multiplier) || l.multiplier <= 1)) throw new Error('Invalid probability or multiplier');
  const jointP = legs.reduce((v, l) => v * l.p, 1);
  const grossMultiplier = legs.reduce((v, l) => v * l.multiplier, 1);
  return { jointP, grossMultiplier, grossEV: jointP * grossMultiplier - 1, eligible: false, reason: 'Independence is unverified; native Combo quote, fees, and correlations not available.' };
}

/**
 * Joint probability from correlated simulations: legs is an array of predicate functions
 * evaluated on the SAME simulated outcome. Returns P(all legs) and the naive product for comparison.
 */
export function jointFromSimulations(outcomes, predicates) {
  if (!outcomes.length || !predicates.length) throw new Error('Need outcomes and predicates');
  let all = 0; const singles = new Array(predicates.length).fill(0);
  for (const o of outcomes) { let ok = true; predicates.forEach((f, i) => { const v = f(o); if (v) singles[i]++; ok = ok && v; }); if (ok) all++; }
  const n = outcomes.length, ps = singles.map(s => s / n);
  return { joint: all / n, naiveProduct: ps.reduce((a, b) => a * b, 1), singles: ps, n };
}
