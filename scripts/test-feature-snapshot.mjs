import assert from 'node:assert/strict';
import { deriveFeatures, mergeFeatureSnapshot, selectRefreshCohort } from '../components/aurum/feature-snapshot.js';

const dates = Array.from({ length: 40 }, (_, i) => `2026-01-${String(i + 1).padStart(2, '0')}`);
const prices = Array.from({ length: 40 }, (_, i) => 100 + i);
const features = deriveFeatures(dates, prices);
assert.equal(features.observations, 40);
assert.equal(features.latestPrice, 139);
assert.ok(features.annualisedVolatility >= 0);
const snapshot = mergeFeatureSnapshot(null, [{ ticker: 'AAPL', dates, prices }], '2026-07-30T00:00:00.000Z');
assert.equal(snapshot.v, 1);
assert.equal(snapshot.assets.AAPL.features.latestDate, dates.at(-1));
const cohort = selectRefreshCohort({ MSFT: {}, AAPL: {}, NVDA: {} }, snapshot, 2);
assert.deepEqual(cohort, ['MSFT', 'NVDA']);
console.log('3 feature snapshot checks passed.');
