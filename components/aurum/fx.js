/** Aurum — pure base-currency price normalisation. */

const finitePositive = value => Number.isFinite(Number(value)) && Number(value) > 0;
export const BASE_CURRENCIES = new Set(['USD', 'EUR', 'GBP', 'INR']);

export function normalisePricesToBase(history, fxHistory, baseCurrency = 'USD') {
  const from = String(history?.currency || 'USD').toUpperCase();
  const to = String(baseCurrency || 'USD').toUpperCase();
  if (!BASE_CURRENCIES.has(to)) throw new Error(`Unsupported base currency: ${to}.`);
  if (!Array.isArray(history?.dates) || !Array.isArray(history?.prices) || history.dates.length !== history.prices.length) {
    throw new Error('Invalid instrument history for FX normalisation.');
  }
  if (from === to) return { ...history, currency: to, fx: { from, to, rate: 1, date: history.dates.at(-1), source: 'identity' } };
  if (!Array.isArray(fxHistory?.dates) || !Array.isArray(fxHistory?.prices) || fxHistory.dates.length !== fxHistory.prices.length) {
    throw new Error(`No valid ${from}/${to} FX history is available.`);
  }
  const rates = new Map(fxHistory.dates.map((date, index) => [date, Number(fxHistory.prices[index])]));
  const prices = history.prices.map((price, index) => {
    const rate = rates.get(history.dates[index]);
    if (!finitePositive(rate)) throw new Error(`Missing ${from}/${to} FX rate for ${history.dates[index]}.`);
    return Number(price) * rate;
  });
  const latestDate = history.dates.at(-1);
  return { ...history, prices, currency: to, fx: { from, to, rate: rates.get(latestDate), date: latestDate, source: fxHistory.source || 'Yahoo Finance' } };
}
