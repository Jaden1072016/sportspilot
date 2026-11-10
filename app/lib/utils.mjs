export const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
export const safeNumber = (x) => {
  if (x === null || x === undefined || x === '') return null;
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
};
export const amount = (x) => safeNumber(x && typeof x === 'object' && 'value' in x ? x.value : x);
export const isoNow = () => new Date().toISOString();
export function ageSeconds(iso, nowMs=Date.now()) {
  const t = Date.parse(iso || '');
  return Number.isFinite(t) ? Math.max(0, (nowMs - t)/1000) : Infinity;
}
export function requireAllowedId(id) {
  if (typeof id !== 'string' || !/^[0-9]{5,15}$/.test(id)) throw new Error('Invalid ESPN event ID');
  return id;
}
export function requireAllowedSlug(slug) {
  if (typeof slug !== 'string' || !/^[a-z0-9][a-z0-9-]{0,180}$/i.test(slug)) throw new Error('Invalid Polymarket slug');
  return slug;
}
