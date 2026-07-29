import assert from 'node:assert/strict';
import { fetchWithProviderFallback } from '../components/aurum/market-provider.js';

let passed = 0, failed = 0;
async function test(name, fn) {
  try { await fn(); console.log(`  ✓  ${name}`); passed++; }
  catch (error) { console.error(`  ✗  ${name}: ${error.message}`); failed++; }
}
console.log('\nmarket provider adapter');
await test('uses the live primary provider when it succeeds', async () => {
  const result = await fetchWithProviderFallback({ name: 'Yahoo Finance', fetch: async () => ({ ticker: 'AAA' }) }, { name: 'browser cache', fetch: async () => { throw new Error('should not run'); } }, { ticker: 'AAA' });
  assert.equal(result.provider, 'Yahoo Finance'); assert.equal(result.usedFallback, false);
});
await test('uses validated local fallback after a primary failure', async () => {
  const result = await fetchWithProviderFallback({ name: 'Yahoo Finance', fetch: async () => { throw new Error('502'); } }, { name: 'browser cache', fetch: async () => ({ ticker: 'AAA', stale: true }) }, { ticker: 'AAA' });
  assert.equal(result.provider, 'browser cache'); assert.equal(result.usedFallback, true); assert.match(result.primaryError.message, /502/);
});
await test('fails transparently when neither source is available', async () => {
  await assert.rejects(() => fetchWithProviderFallback({ name: 'Yahoo Finance', fetch: async () => { throw new Error('429'); } }, { name: 'browser cache', fetch: async () => { throw new Error('empty'); } }, {}), /Yahoo Finance unavailable.*browser cache unavailable/);
});
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
