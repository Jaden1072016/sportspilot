// Independent NBA pregame win model. Logistic layer over as-of features.
// Feature list is frozen per model version; market prices are never a feature.
import { predictLogistic, normCdf } from '../stats.mjs';

export const PREGAME_FEATURES = Object.freeze([
  'ratingMargin',      // margin-rating difference incl. learned home edge (points)
  'homeB2B',           // home team played yesterday
  'awayB2B',           // away team played yesterday
  'restAdvantage',     // capped rest-day difference (home minus away), 0..3
  'earlyShrink',       // ratingMargin * exp(-min games played / 10): lets fit discount early-season ratings
]);
export const AVAIL_FEATURE = 'availabilityEdge'; // (away missing value - home missing value), game-score units
export const ROSTER_FEATURE = 'rosterValueEdge'; // available rotation value home minus away, game-score units

const capRest = d => (Number.isFinite(d) ? Math.max(0, Math.min(3, d - 1)) : 1);

export function pregameFeatures(pre, availHome = null, availAway = null) {
  const minGames = Math.min(pre.homeGames, pre.awayGames);
  const x = {
    ratingMargin: pre.ratingMargin,
    homeB2B: pre.restHome === 1 ? 1 : 0,
    awayB2B: pre.restAway === 1 ? 1 : 0,
    restAdvantage: capRest(pre.restHome) - capRest(pre.restAway),
    earlyShrink: pre.ratingMargin * Math.exp(-minGames / 10),
  };
  const availKnown = Boolean(availHome?.known && availAway?.known);
  if (availKnown) {
    x[AVAIL_FEATURE] = (availAway.missing - availHome.missing);
    x[ROSTER_FEATURE] = (availHome.total - availHome.missing) - (availAway.total - availAway.missing);
  }
  return { x, availKnown };
}

/**
 * @param model artifact section { base:{beta,features}, lineup:{beta,features}, marginSd }
 * Returns home win probability plus a feature-attribution table for explanations.
 */
export function pregameProbability(model, feats) {
  const useLineup = feats.availKnown && model.lineup?.beta;
  const spec = useLineup ? model.lineup : model.base;
  const xs = spec.features.map(f => feats.x[f]);
  if (xs.some(v => !Number.isFinite(v))) return { available: false, why: 'Feature missing' };
  const p = predictLogistic(spec.beta, xs);
  const contributions = spec.features.map((f, i) => ({ feature: f, value: xs[i], logitContribution: spec.beta[i + 1] * xs[i] }));
  // Equivalent expected margin under a normal margin model; used as the live simulator prior.
  const z = invNorm(Math.min(0.995, Math.max(0.005, p)));
  return { available: true, homeProbability: p, awayProbability: 1 - p, variant: useLineup ? 'lineup-aware' : 'base (availability not connected)',
    intercept: spec.beta[0], contributions, impliedMargin: z * model.marginSd };
}

/** Acklam inverse normal CDF. */
export function invNorm(p) {
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const pl = 0.02425;
  let q, r;
  if (p < pl) { q = Math.sqrt(-2 * Math.log(p)); return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
  if (p > 1 - pl) { q = Math.sqrt(-2 * Math.log(1 - p)); return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
  q = p - 0.5; r = q * q;
  return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}

export { normCdf };
