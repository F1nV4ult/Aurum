/**
 * Refreshes a bounded cohort of Yahoo histories into a committed feature snapshot.
 * It is safe for scheduled execution: the cohort rotates by oldest fetched date.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mergeFeatureSnapshot, selectRefreshCohort } from '../components/aurum/feature-snapshot.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const universe = JSON.parse(await readFile(join(root, 'data', 'aurum-universe.json'), 'utf8')).tickers;
const output = join(root, process.env.FEATURE_SNAPSHOT_PATH || 'data/model-feature-snapshot.json');
const limit = Math.max(1, Math.min(24, Number(process.env.FEATURE_REFRESH_LIMIT || 12)));
const base = process.env.FEATURE_PROXY_BASE || 'https://aurum.novasect.space';
let previous = { assets: {} };
try { previous = JSON.parse(await readFile(output, 'utf8')); } catch { /* first snapshot */ }
const cohort = selectRefreshCohort(universe, previous, limit);
const records = [];
const failed = [];
for (const ticker of cohort) {
  try {
    const url = `${base}/api/yahoo-proxy?symbol=${encodeURIComponent(ticker)}&mode=history&range=1y`;
    const response = await fetch(url);
    if (!response.ok) { failed.push(ticker); continue; }
    const data = await response.json();
    const series = data.series || [];
    records.push({ ticker, dates: series.map(point => point.date), prices: series.map(point => point.adjClose ?? point.close) });
  } catch {
    failed.push(ticker);
  }
}
const next = mergeFeatureSnapshot(previous, records);
next.refresh = { cohort, failed, requested: limit, succeeded: records.length, source: 'Yahoo Finance via Aurum proxy' };
await writeFile(output, JSON.stringify(next, null, 2) + '\n', 'utf8');
console.log(`Feature snapshot refreshed: ${records.length}/${cohort.length} assets.`);
