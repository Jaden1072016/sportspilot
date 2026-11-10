// Deterministic numerical utilities shared by models, validation scripts and tests.
// No market data is ever read here.

/** Seeded PRNG (mulberry32). Same seed => same simulation, so results are reproducible. */
export function rng(seed = 1) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  let spare = null;
  next.normal = () => {
    if (spare !== null) { const s = spare; spare = null; return s; }
    let u = 0, v = 0;
    while (u === 0) u = next();
    v = next();
    const r = Math.sqrt(-2 * Math.log(u));
    spare = r * Math.sin(2 * Math.PI * v);
    return r * Math.cos(2 * Math.PI * v);
  };
  return next;
}

/** Standard normal CDF (Abramowitz-Stegun 7.1.26 via erf, |err| < 1.5e-7). */
export function normCdf(x) {
  const z = Math.abs(x) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * z);
  const erf = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-z * z);
  return x >= 0 ? 0.5 * (1 + erf) : 0.5 * (1 - erf);
}

export const sigmoid = (x) => 1 / (1 + Math.exp(-x));
export const clampP = (p, eps = 1e-6) => Math.min(1 - eps, Math.max(eps, p));

export function brier(ps, ys) {
  let s = 0;
  for (let i = 0; i < ps.length; i++) s += (ps[i] - ys[i]) ** 2;
  return s / ps.length;
}

export function logLoss(ps, ys) {
  let s = 0;
  for (let i = 0; i < ps.length; i++) {
    const p = clampP(ps[i], 1e-4);
    s -= ys[i] ? Math.log(p) : Math.log(1 - p);
  }
  return s / ps.length;
}

export function accuracy(ps, ys) {
  let c = 0, n = 0;
  for (let i = 0; i < ps.length; i++) { if (ps[i] === 0.5) continue; n++; if ((ps[i] > 0.5) === Boolean(ys[i])) c++; }
  return n ? c / n : NaN;
}

/** Reliability table: predicted vs observed frequency by probability band, with Wilson 95% interval. */
export function reliability(ps, ys, bins = 10) {
  const rows = Array.from({ length: bins }, (_, i) => ({ lo: i / bins, hi: (i + 1) / bins, n: 0, sumP: 0, wins: 0 }));
  for (let i = 0; i < ps.length; i++) {
    const b = Math.min(bins - 1, Math.floor(ps[i] * bins));
    rows[b].n++; rows[b].sumP += ps[i]; rows[b].wins += ys[i] ? 1 : 0;
  }
  return rows.map(r => {
    const obs = r.n ? r.wins / r.n : null;
    const [wl, wh] = r.n ? wilson(r.wins, r.n) : [null, null];
    return { band: `${Math.round(r.lo * 100)}-${Math.round(r.hi * 100)}%`, n: r.n, meanPredicted: r.n ? r.sumP / r.n : null, observed: obs, ci95: [wl, wh] };
  });
}

/** Expected calibration error (sample-weighted mean |pred - obs| across bands). */
export function ece(ps, ys, bins = 10) {
  const t = reliability(ps, ys, bins);
  const n = ps.length;
  return t.reduce((s, r) => s + (r.n ? (r.n / n) * Math.abs(r.meanPredicted - r.observed) : 0), 0);
}

export function wilson(k, n, z = 1.96) {
  if (!n) return [null, null];
  const p = k / n, d = 1 + z * z / n;
  const c = (p + z * z / (2 * n)) / d;
  const h = (z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))) / d;
  return [Math.max(0, c - h), Math.min(1, c + h)];
}

/** Paired bootstrap CI for the difference in a metric between two forecasts on the same outcomes. */
export function bootstrapDiff(metric, pa, pb, ys, { reps = 400, seed = 7 } = {}) {
  const r = rng(seed), n = ys.length, diffs = [];
  const a = new Float64Array(n), b = new Float64Array(n), y = new Uint8Array(n);
  for (let k = 0; k < reps; k++) {
    for (let i = 0; i < n; i++) { const j = Math.floor(r() * n); a[i] = pa[j]; b[i] = pb[j]; y[i] = ys[j]; }
    diffs.push(metric(a, y) - metric(b, y));
  }
  diffs.sort((x, z) => x - z);
  return { mean: metric(pa, ys) - metric(pb, ys), ci95: [diffs[Math.floor(reps * 0.025)], diffs[Math.floor(reps * 0.975)]] };
}

/** Fit L2-regularised logistic regression by Newton/IRLS. X rows are feature arrays (no intercept column). */
export function fitLogistic(X, y, { l2 = 1e-3, iters = 50, w = null } = {}) {
  const d = X[0].length + 1, n = X.length;
  let beta = new Array(d).fill(0);
  for (let it = 0; it < iters; it++) {
    const g = new Array(d).fill(0);
    const H = Array.from({ length: d }, () => new Array(d).fill(0));
    for (let i = 0; i < n; i++) {
      const xi = [1, ...X[i]];
      let z = 0; for (let j = 0; j < d; j++) z += beta[j] * xi[j];
      const p = sigmoid(z), wi = (w ? w[i] : 1);
      const r = (p - y[i]) * wi, s = p * (1 - p) * wi;
      for (let j = 0; j < d; j++) { g[j] += r * xi[j]; for (let k = 0; k <= j; k++) H[j][k] += s * xi[j] * xi[k]; }
    }
    for (let j = 1; j < d; j++) { g[j] += l2 * n * beta[j]; H[j][j] += l2 * n; }
    for (let j = 0; j < d; j++) for (let k = j + 1; k < d; k++) H[j][k] = H[k][j];
    const step = solve(H, g);
    let maxStep = 0;
    beta = beta.map((b, j) => { maxStep = Math.max(maxStep, Math.abs(step[j])); return b - step[j]; });
    if (maxStep < 1e-9) break;
  }
  return beta; // [intercept, ...coefficients]
}

export function predictLogistic(beta, x) {
  let z = beta[0];
  for (let j = 0; j < x.length; j++) z += beta[j + 1] * x[j];
  return sigmoid(z);
}

function solve(A, b) {
  const n = b.length, M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    const piv = M[c][c] || 1e-12;
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c] / piv;
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((row, i) => row[n] / (row[i] || 1e-12));
}

export function mean(a) { let s = 0; for (const v of a) s += v; return a.length ? s / a.length : NaN; }
export function sd(a) { const m = mean(a); let s = 0; for (const v of a) s += (v - m) ** 2; return Math.sqrt(s / Math.max(1, a.length - 1)); }
