/** Aurum — local analysis snapshots (configuration + compact result summary). */
import { normaliseShareState } from './share.js';

export const SNAPSHOT_VERSION = 1;
export const SNAPSHOT_KEY = 'aurum_analysis_snapshots_v1';
const MAX_SNAPSHOTS = 20;

const finite = (value, fallback = null) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const isoNow = () => new Date().toISOString();

export function createSnapshot({ config, result, dataAsOf, riskFreeRate, riskFreeSource, now = isoNow() }) {
  const safeConfig = normaliseShareState(config);
  if (!safeConfig || !result?.optimal) return null;
  const assets = (result.optimal.assets || []).map(asset => ({
    ticker: asset.ticker, weight: finite(asset.weight, 0),
  })).filter(asset => asset.ticker && asset.weight >= 0);
  return {
    v: SNAPSHOT_VERSION,
    id: `s_${Date.parse(now).toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    savedAt: now,
    dataAsOf: typeof dataAsOf === 'string' ? dataAsOf : null,
    engine: 'aurum-v1',
    riskFreeRate: finite(riskFreeRate),
    riskFreeSource: typeof riskFreeSource === 'string' ? riskFreeSource : null,
    config: safeConfig,
    summary: {
      return: finite(result.optimal.return), risk: finite(result.optimal.risk), sharpe: finite(result.optimal.sharpe),
      maxDrawdown: finite(result.optimal.maxDrawdown), cvar95: finite(result.optimal.cvar95), divRatio: finite(result.optimal.divRatio),
      assets,
    },
  };
}

export function readSnapshots(storage) {
  try {
    const items = JSON.parse(storage.getItem(SNAPSHOT_KEY) || '[]');
    return Array.isArray(items) ? items.filter(item => item?.v === SNAPSHOT_VERSION && item.id && item.config && item.summary) : [];
  } catch { return []; }
}

export function writeSnapshots(storage, snapshots) {
  const next = snapshots.slice(0, MAX_SNAPSHOTS);
  storage.setItem(SNAPSHOT_KEY, JSON.stringify(next));
  return next;
}

export function comparison(left, right) {
  if (!left?.summary || !right?.summary) return null;
  const metric = key => ({ left: left.summary[key], right: right.summary[key], delta: finite(right.summary[key]) - finite(left.summary[key]) });
  const weights = new Map(left.summary.assets.map(asset => [asset.ticker, asset.weight]));
  right.summary.assets.forEach(asset => weights.set(asset.ticker, asset.weight));
  const changes = [...weights.keys()].map(ticker => ({
    ticker, left: left.summary.assets.find(a => a.ticker === ticker)?.weight || 0,
    right: right.summary.assets.find(a => a.ticker === ticker)?.weight || 0,
  })).map(item => ({ ...item, delta: item.right - item.left })).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  return { metrics: { return: metric('return'), risk: metric('risk'), sharpe: metric('sharpe'), maxDrawdown: metric('maxDrawdown') }, weights: changes };
}
