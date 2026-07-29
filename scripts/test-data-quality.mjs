import assert from 'node:assert/strict';
import { assessDataQuality, validateHistory } from '../components/aurum/data-quality.js';

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  ✓  ${name}`); passed++; }
  catch (error) { console.error(`  ✗  ${name}: ${error.message}`); failed++; }
}

const dates = Array.from({ length: 40 }, (_, index) => new Date(Date.UTC(2026, 0, index + 1)).toISOString().slice(0, 10));
const prices = Array.from({ length: 40 }, (_, index) => 100 + index);
console.log('\ndata quality');
test('accepts a chronological, positive history', () => assert.equal(validateHistory('AAA', dates, prices).prices.length, 40));
test('rejects non-positive prices before optimisation', () => assert.throws(() => validateHistory('AAA', dates, prices.map((price, index) => index === 10 ? 0 : price)), /Invalid adjusted close/));
test('rejects duplicate or unordered dates', () => assert.throws(() => validateHistory('AAA', [...dates.slice(0, 5), dates[4], ...dates.slice(6)], prices), /strictly chronological/));
test('reports stale, missing and suspicious data', () => {
  const report = assessDataQuality({ requestedTickers: ['AAA', 'BBB'], failed: ['BBB'], dates, histories: [{ ticker: 'AAA', dates, prices: [...prices.slice(0, 20), 250, ...prices.slice(21)], stale: true }] });
  assert.equal(report.level, 'warning'); assert.deepEqual(report.missing, ['BBB']); assert.deepEqual(report.stale, ['AAA']); assert.deepEqual(report.suspicious, ['AAA']);
});
test('reports healthy aligned data without warnings', () => {
  const report = assessDataQuality({ requestedTickers: ['AAA'], dates, histories: [{ ticker: 'AAA', dates, prices }] });
  assert.equal(report.level, 'ok'); assert.equal(report.alignment, 1); assert.equal(report.warnings.length, 0);
});
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
