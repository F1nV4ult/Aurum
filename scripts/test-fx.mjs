import assert from 'node:assert/strict';
import { normalisePricesToBase } from '../components/aurum/fx.js';

let passed = 0, failed = 0;
function test(name, fn) { try { fn(); console.log(`  ✓  ${name}`); passed++; } catch (error) { console.error(`  ✗  ${name}: ${error.message}`); failed++; } }
const history = { ticker: 'EU', currency: 'EUR', dates: ['2026-01-02', '2026-01-03'], prices: [100, 110] };
const fx = { dates: ['2026-01-02', '2026-01-03'], prices: [1.2, 1.25], source: 'Yahoo Finance' };
console.log('\nFX normalisation');
test('converts non-USD prices using same-date rates', () => { const result = normalisePricesToBase(history, fx, 'USD'); assert.deepEqual(result.prices, [120, 137.5]); assert.equal(result.fx.rate, 1.25); assert.equal(result.fx.date, '2026-01-03'); });
test('keeps same-currency prices unchanged with identity provenance', () => { const result = normalisePricesToBase({ ...history, currency: 'USD' }, null, 'USD'); assert.deepEqual(result.prices, history.prices); assert.equal(result.fx.source, 'identity'); });
test('rejects a missing FX date instead of silently using a stale rate', () => assert.throws(() => normalisePricesToBase(history, { ...fx, dates: ['2026-01-02'], prices: [1.2] }, 'USD'), /Missing EUR\/USD FX rate/));
test('accepts only the four supported base currencies', () => {
  assert.throws(() => normalisePricesToBase(history, fx, 'JPY'), /Unsupported base currency/);
  assert.equal(normalisePricesToBase(history, fx, 'INR').currency, 'INR');
});
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
