/**
 * Aurum — share-link state codec
 *
 * A share link carries only the configuration needed to reproduce an analysis.
 * It deliberately excludes fetched prices, results, browser storage, and any
 * server credentials. Versioning lets future clients reject incompatible links
 * safely instead of partially applying unknown state.
 */

export const SHARE_VERSION = 1;
export const SHARE_PARAM = 'p';

const MODES = new Set(['maxSharpe', 'minVariance', 'blackLitterman', 'riskParity', 'hrp', 'minCVaR', 'maxDiversification']);
const COV_METHODS = new Set(['ledoitWolf', 'ewma', 'sample']);
const BENCHMARKS = new Set(['SPY', 'QQQ', 'DIA', 'IWM', 'ACWI', 'AGG']);
const TICKER_RE = /^[A-Z0-9.\-^]{1,20}$/;
const MAX_TICKERS = 45;
const MAX_VIEWS = 10;

const numberIn = (value, fallback, min, max) => {
  const n = Number(value);
  return Number.isFinite(n) && n >= min && n <= max ? n : fallback;
};

const ticker = value => {
  const symbol = String(value || '').trim().toUpperCase();
  return TICKER_RE.test(symbol) ? symbol : '';
};

function sanitiseViews(views, selected) {
  if (!Array.isArray(views)) return [];
  return views.slice(0, MAX_VIEWS).flatMap(view => {
    const type = view?.type === 'relative' ? 'relative' : 'absolute';
    const primary = ticker(view?.ticker);
    const secondary = ticker(view?.ticker2);
    if (!selected.includes(primary)) return [];
    if (type === 'relative' && (!selected.includes(secondary) || secondary === primary)) return [];
    return [{
      type,
      ticker: primary,
      ticker2: type === 'relative' ? secondary : '',
      return: numberIn(view?.return, 0.10, -1, 5),
      confidence: numberIn(view?.confidence, 0.65, 0, 1),
    }];
  });
}

function sanitiseHoldings(holdings, selected) {
  if (!holdings || typeof holdings !== 'object' || Array.isArray(holdings)) return {};
  return Object.fromEntries(selected.flatMap(symbol => {
    const value = Number(holdings[symbol]);
    return Number.isFinite(value) && value >= 0 && value <= 100 ? [[symbol, value]] : [];
  }));
}

/** Return a validated, minimal v1 shareable configuration or null. */
export function normaliseShareState(input) {
  if (!input || typeof input !== 'object' || input.v !== SHARE_VERSION) return null;
  const tickers = [...new Set((Array.isArray(input.t) ? input.t : []).map(ticker).filter(Boolean))].slice(0, MAX_TICKERS);
  if (!tickers.length) return null;

  const constraints = input.c && typeof input.c === 'object' ? input.c : {};
  const rebalance = input.r && typeof input.r === 'object' ? input.r : {};
  return {
    v: SHARE_VERSION,
    t: tickers,
    m: MODES.has(input.m) ? input.m : 'maxSharpe',
    c: {
      w: numberIn(constraints.w, 30, 5, 100),
      s: numberIn(constraints.s, 40, 10, 100),
      k: COV_METHODS.has(constraints.k) ? constraints.k : 'ledoitWolf',
      r: constraints.r === true,
      b: BENCHMARKS.has(constraints.b) ? constraints.b : 'SPY',
    },
    r: {
      e: rebalance.e === true,
      t: numberIn(rebalance.t, 100, 0, 100),
      c: numberIn(rebalance.c, 10, 0, 500),
      h: sanitiseHoldings(rebalance.h, tickers),
    },
    q: sanitiseViews(input.q, tickers),
  };
}

export function encodeShareState(input) {
  const state = normaliseShareState(input);
  if (!state) return null;
  return btoa(JSON.stringify(state)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function decodeShareState(encoded) {
  if (typeof encoded !== 'string' || !/^[A-Za-z0-9_-]{1,12000}$/.test(encoded)) return null;
  try {
    const padded = encoded.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((encoded.length + 3) % 4);
    return normaliseShareState(JSON.parse(atob(padded)));
  } catch {
    return null;
  }
}

export function buildShareUrl(input, baseUrl) {
  const encoded = encodeShareState(input);
  if (!encoded) return null;
  const url = new URL(baseUrl);
  url.searchParams.set(SHARE_PARAM, encoded);
  return url.toString();
}

export function readShareState(url) {
  try { return decodeShareState(new URL(url).searchParams.get(SHARE_PARAM)); }
  catch { return null; }
}
