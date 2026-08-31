import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

let passed = 0, failed = 0;
const test = (name, condition) => {
  if (condition) { console.log(`  ✓  ${name}`); passed++; }
  else { console.error(`  ✗  ${name}`); failed++; }
};

const landing = readFileSync('landing.html', 'utf8');
const routes = JSON.parse(readFileSync('vercel.json', 'utf8')).routes;
console.log('\nlanding page');
test('contains the product hero and both starting paths', /Make portfolio/.test(landing) && /Start with a model portfolio/.test(landing) && /Build a custom portfolio/.test(landing));
test('contains the three-step tutorial', /Three steps/.test(landing) && /Select a basket/.test(landing) && /Set the method/.test(landing) && /Review the evidence/.test(landing));
test('redirects legacy share links to the optimizer', /has\('p'\).*\/optimizer/.test(landing));
test('routes root to landing and /optimizer to the existing app', routes.some(route => route.src === '/' && route.dest === '/landing.html') && routes.some(route => route.src === '/optimizer' && route.dest === '/index.html'));
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
