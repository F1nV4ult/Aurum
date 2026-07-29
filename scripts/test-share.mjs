import { buildShareUrl, decodeShareState, encodeShareState, readShareState, SHARE_VERSION } from '../components/aurum/share.js';

let passed = 0, failed = 0;
const check = (condition, name) => {
  if (condition) { console.log('  ✓  ' + name); passed++; }
  else { console.error('  ✗  ' + name); failed++; }
};

const fixture = {
  v: SHARE_VERSION, t: ['AAPL', 'MSFT', 'SAP.DE'], m: 'blackLitterman',
  c: { w: 25, s: 45, k: 'ewma', r: true, b: 'ACWI' },
  r: { e: true, t: 35, c: 12, h: { AAPL: 60, MSFT: 40, INVALID: 50 } },
  q: [{ type: 'relative', ticker: 'AAPL', ticker2: 'MSFT', return: 0.08, confidence: 0.7 }],
};

console.log('\nshare-link codec');
const encoded = encodeShareState(fixture);
const decoded = decodeShareState(encoded);
check(typeof encoded === 'string' && !/[+/=]/.test(encoded), 'encodes URL-safe payload');
check(decoded?.m === 'blackLitterman' && decoded.t.length === 3, 'round-trips selected tickers and mode');
check(decoded?.c.k === 'ewma' && decoded?.c.b === 'ACWI', 'round-trips risk model and benchmark');
check(decoded?.r.h.AAPL === 60 && !('INVALID' in decoded.r.h), 'keeps only selected-holding weights');
check(decoded?.q.length === 1 && decoded.q[0].ticker2 === 'MSFT', 'round-trips valid Black-Litterman views');
check(decodeShareState('bad payload!') === null, 'rejects malformed payloads');
const unknownVersion = Buffer.from(JSON.stringify({ ...fixture, v: 999 })).toString('base64url');
check(decodeShareState(unknownVersion) === null, 'rejects unknown versions');
check(decodeShareState(encodeShareState({ ...fixture, t: [] })) === null, 'rejects empty portfolios');

const url = buildShareUrl(fixture, 'https://aurum.example/index.html?ref=test#old');
check(readShareState(url)?.t.join(',') === 'AAPL,MSFT,SAP.DE', 'reads state from a share URL');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
