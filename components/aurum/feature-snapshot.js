/** Pure helpers for the versioned, persisted market-feature snapshot. */
export const FEATURE_SNAPSHOT_VERSION = 1;

const finite = value => Number.isFinite(Number(value)) ? Number(value) : null;
const percentReturn = (prices, days) => {
  if (prices.length <= days) return null;
  const start = finite(prices[prices.length - days - 1]);
  const end = finite(prices.at(-1));
  return start && end ? end / start - 1 : null;
};

export function deriveFeatures(dates, prices) {
  const clean = prices.map(finite).filter(value => value && value > 0);
  if (clean.length < 30) return null;
  const returns = clean.slice(1).map((price, index) => Math.log(price / clean[index]));
  const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length;
  const variance = returns.reduce((sum, value) => sum + (value - mean) ** 2, 0) / returns.length;
  let peak = clean[0], maxDrawdown = 0;
  clean.forEach(price => { peak = Math.max(peak, price); maxDrawdown = Math.max(maxDrawdown, 1 - price / peak); });
  return {
    latestPrice: clean.at(-1), observations: clean.length,
    return_1m: percentReturn(clean, 21), return_3m: percentReturn(clean, 63),
    return_6m: percentReturn(clean, 126), return_1y: percentReturn(clean, 252),
    annualisedVolatility: Math.sqrt(variance * 252), maxDrawdown,
    latestDate: dates.at(-1) || null,
  };
}

export function selectRefreshCohort(universe, snapshot, limit = 20) {
  const existing = snapshot?.assets || {};
  return Object.keys(universe).sort((a, b) => {
    const at = Date.parse(existing[a]?.fetchedAt || 0);
    const bt = Date.parse(existing[b]?.fetchedAt || 0);
    return at - bt || a.localeCompare(b);
  }).slice(0, Math.max(1, limit));
}

export function mergeFeatureSnapshot(previous, records, now = new Date().toISOString()) {
  const assets = { ...(previous?.assets || {}) };
  records.forEach(record => {
    if (!record?.ticker || !Array.isArray(record.dates) || !Array.isArray(record.prices)) return;
    const features = deriveFeatures(record.dates, record.prices);
    if (features) assets[record.ticker] = { fetchedAt: now, dates: record.dates, prices: record.prices, features };
  });
  return { v: FEATURE_SNAPSHOT_VERSION, generatedAt: now, assets };
}
