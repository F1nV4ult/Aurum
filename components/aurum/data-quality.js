/**
 * Aurum — market-data validation and UI-safe quality summaries.
 *
 * This module is deliberately pure. The ingestion layer owns fetching/caching;
 * callers use these checks to reject malformed series and label degraded but
 * still usable data (for example a stale cached series) without guessing.
 */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const finitePositive = value => Number.isFinite(Number(value)) && Number(value) > 0;
const MILLIS_PER_DAY = 24 * 60 * 60 * 1000;

export function validateHistory(ticker, dates, prices, minimumPoints = 30) {
  if (!Array.isArray(dates) || !Array.isArray(prices) || dates.length !== prices.length) {
    throw new Error(`Invalid price history for ${ticker}: dates and prices must be equally sized arrays.`);
  }
  if (dates.length < minimumPoints) {
    throw new Error(`Insufficient data for ${ticker} (${dates.length} points).`);
  }
  let previous = '';
  for (let index = 0; index < dates.length; index++) {
    const date = dates[index];
    const parsed = typeof date === 'string' ? new Date(`${date}T00:00:00Z`) : null;
    if (typeof date !== 'string' || !DATE_RE.test(date) || Number.isNaN(parsed?.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
      throw new Error(`Invalid trading date for ${ticker}.`);
    }
    if (date <= previous) throw new Error(`Price history for ${ticker} is not strictly chronological.`);
    if (!finitePositive(prices[index])) throw new Error(`Invalid adjusted close for ${ticker} on ${date}.`);
    previous = date;
  }
  return { ticker, dates, prices: prices.map(Number) };
}

export function assessDataQuality({ requestedTickers = [], histories = [], failed = [], dates = [], now = Date.now() }) {
  const available = new Set(histories.map(history => history.ticker));
  const missing = [...new Set([...failed, ...requestedTickers.filter(ticker => !available.has(ticker))])];
  const stale = histories.filter(history => history.stale).map(history => history.ticker);
  const sources = [...new Set(histories.map(history => history.source || 'unknown'))];
  const suspicious = [];
  histories.forEach(history => {
    for (let index = 1; index < history.prices.length; index++) {
      const move = Math.abs(Math.log(history.prices[index] / history.prices[index - 1]));
      if (move >= 0.35) { suspicious.push(history.ticker); break; }
    }
  });
  const latestDate = dates.at(-1) || null;
  const latestAgeDays = latestDate ? Math.max(0, Math.floor((now - Date.parse(`${latestDate}T00:00:00Z`)) / MILLIS_PER_DAY)) : null;
  const smallestSeries = histories.reduce((min, history) => Math.min(min, history.dates.length), Infinity);
  const alignment = smallestSeries && Number.isFinite(smallestSeries) ? dates.length / smallestSeries : 0;
  const warnings = [];
  if (missing.length) warnings.push(`${missing.length} requested ticker${missing.length === 1 ? '' : 's'} excluded: ${missing.join(', ')}.`);
  if (stale.length) warnings.push(`Using stale cached data for: ${stale.join(', ')}.`);
  if (alignment < 0.85) warnings.push(`Only ${Math.round(alignment * 100)}% of the shortest history aligns across the retained assets.`);
  if (suspicious.length) warnings.push(`Large single-day adjusted-price move detected for: ${suspicious.join(', ')}. Verify corporate-action data before relying on this run.`);
  const level = missing.length || stale.length || alignment < 0.85 || suspicious.length ? 'warning' : 'ok';
  return { level, missing, stale, suspicious, alignment, latestDate, latestAgeDays, sources, retained: histories.length, requested: requestedTickers.length, warnings };
}
