import assert from 'node:assert/strict';
import { fetchWithBackoff } from '../components/aurum/ingestion.js';

let checks = 0;
const test = async (name, fn) => {
  await fn(); checks++;
  console.log(`  ✓ ${name}`);
};
const response = status => ({ status, ok: status >= 200 && status < 300 });

console.log('Aurum ingestion retry tests');

await test('retries a transient 502 then returns the successful response', async () => {
  let calls = 0; const waits = [];
  const result = await fetchWithBackoff('/history', {
    fetchImpl: async () => (++calls === 1 ? response(502) : response(200)),
    sleep: async ms => waits.push(ms),
  });
  assert.equal(result.status, 200); assert.equal(calls, 2); assert.deepEqual(waits, [250]);
});

await test('does not retry a 429 rate-limit response', async () => {
  let calls = 0;
  const result = await fetchWithBackoff('/history', {
    fetchImpl: async () => { calls++; return response(429); },
    sleep: async () => assert.fail('429 must not sleep/retry'),
  });
  assert.equal(result.status, 429); assert.equal(calls, 1);
});

await test('retries a network error with exponential delays', async () => {
  let calls = 0; const waits = [];
  const result = await fetchWithBackoff('/history', {
    fetchImpl: async () => { calls++; if (calls < 3) throw new Error('offline'); return response(200); },
    sleep: async ms => waits.push(ms),
  });
  assert.equal(result.status, 200); assert.equal(calls, 3); assert.deepEqual(waits, [250, 500]);
});

await test('returns the final transient response after bounded attempts', async () => {
  let calls = 0;
  const result = await fetchWithBackoff('/history', {
    fetchImpl: async () => { calls++; return response(503); }, sleep: async () => {},
  });
  assert.equal(result.status, 503); assert.equal(calls, 3);
});

console.log(`\n${checks} ingestion retry checks passed.`);
