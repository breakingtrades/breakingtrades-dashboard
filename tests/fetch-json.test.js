/**
 * fetch-json.test.js — Verify the cache-bust interceptor in fetch-json.js
 *
 * High-risk piece: it monkey-patches window.fetch. If the regex or skip
 * logic is wrong, we break every external API call in the app (Yahoo,
 * TradingView, GitHub Models, ...). These tests pin down:
 *
 *   - data/*.json gets `?t=<minute-bucket>` appended
 *   - data/*.jsonl gets cache-bust (data/, not just .json)
 *   - already-busted URLs (own `?t=`) are passed through untouched
 *   - external https:// URLs are passed through untouched
 *   - URLs that mention 'data/' in a query string but don't START with it
 *     (e.g. 'https://api.x.com/q?key=data/x') are passed through
 *   - Request objects (not strings) are passed through untouched
 *   - The interceptor is idempotent — loading twice doesn't double-wrap
 *
 * Strategy: shim a minimal window + fetch, require fetch-json.js, then
 * call window.fetch and assert on what reached the underlying stub.
 */
'use strict';

const path = require('path');
const fs = require('fs');

function loadModule() {
  // Wipe + re-create the global shim so each test starts fresh.
  const calls = [];
  const stubFetch = function(input, init) {
    calls.push({ input, init });
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}), text: () => Promise.resolve('') });
  };
  const win = {
    fetch: stubFetch,
    BT: undefined,
  };
  // The script reads/writes window.* via `window.X`; expose to globalThis
  // so the module's `window.fetch = ...` assignment writes to our shim.
  global.window = win;
  global.fetch = stubFetch;

  // Force re-evaluation (kill require cache so the IIFE runs again).
  const modPath = path.resolve(__dirname, '../js/lib/fetch-json.js');
  delete require.cache[modPath];
  const src = fs.readFileSync(modPath, 'utf8');
  // The file is plain script (IIFE), not a CommonJS module. Eval in a
  // function so `window` resolves to our shim.
  // eslint-disable-next-line no-new-func
  new Function('window', src)(win);

  return { win, calls, stubFetch };
}

describe('fetch-json.js cache-bust interceptor', () => {

  test('appends ?t= to data/*.json', async () => {
    const { win, calls } = loadModule();
    await win.fetch('data/prices.json');
    expect(calls).toHaveLength(1);
    expect(calls[0].input).toMatch(/^data\/prices\.json\?t=\d+$/);
  });

  test('appends ?t= to data/*.jsonl', async () => {
    const { win, calls } = loadModule();
    await win.fetch('data/events.jsonl');
    expect(calls[0].input).toMatch(/^data\/events\.jsonl\?t=\d+$/);
  });

  test('appends &t= (not ?t=) when URL already has a query', async () => {
    const { win, calls } = loadModule();
    await win.fetch('data/x.json?foo=bar');
    expect(calls[0].input).toMatch(/^data\/x\.json\?foo=bar&t=\d+$/);
  });

  test('idempotent: skips URLs that already contain t=', async () => {
    const { win, calls } = loadModule();
    await win.fetch('data/prices.json?t=12345');
    expect(calls[0].input).toBe('data/prices.json?t=12345');  // unchanged
  });

  test('passes external https:// URLs through untouched', async () => {
    const { win, calls } = loadModule();
    const url = 'https://query1.finance.yahoo.com/v8/finance/chart/SPY?interval=1m&range=1d';
    await win.fetch(url);
    expect(calls[0].input).toBe(url);
  });

  test('passes external http:// URLs through untouched', async () => {
    const { win, calls } = loadModule();
    const url = 'http://api.example.com/data/x.json';  // data/ in path but external host
    await win.fetch(url);
    expect(calls[0].input).toBe(url);
  });

  test('Request objects (not strings) are passed through untouched', async () => {
    const { win, calls } = loadModule();
    const req = { url: 'data/prices.json' };  // mock Request
    await win.fetch(req);
    expect(calls[0].input).toBe(req);  // not mutated
  });

  test('per-minute bucket: same minute → same suffix', async () => {
    const { win, calls } = loadModule();
    await win.fetch('data/a.json');
    await win.fetch('data/b.json');
    const ta = calls[0].input.match(/t=(\d+)/)[1];
    const tb = calls[1].input.match(/t=(\d+)/)[1];
    expect(ta).toBe(tb);  // both in the same minute
  });

  test('preserves init (method/headers/body)', async () => {
    const { win, calls } = loadModule();
    const init = { method: 'GET', headers: { 'X-Test': '1' } };
    await win.fetch('data/x.json', init);
    expect(calls[0].init).toBe(init);
  });

  test('interceptor is idempotent: loading twice does not double-wrap', () => {
    const { win } = loadModule();
    const firstWrap = win.fetch;
    // Re-eval the IIFE with the same window
    const modPath = path.resolve(__dirname, '../js/lib/fetch-json.js');
    const src = fs.readFileSync(modPath, 'utf8');
    // eslint-disable-next-line no-new-func
    new Function('window', src)(win);
    expect(win.fetch).toBe(firstWrap);  // same wrapper, not nested again
  });

  test('exposes BT.fetchJson and BT.fetchText', () => {
    const { win } = loadModule();
    expect(typeof win.BT.fetchJson).toBe('function');
    expect(typeof win.BT.fetchText).toBe('function');
  });

  test('BT._isVaultUrl: correctly classifies common cases', () => {
    const { win } = loadModule();
    const f = win.BT._isVaultUrl;
    // Vault paths
    expect(f('data/prices.json')).toBe(true);
    expect(f('./data/x.json')).toBe(true);
    expect(f('/data/y.jsonl')).toBe(true);
    expect(f('subdir/data/z.json')).toBe(true);  // any depth
    // Non-vault
    expect(f('https://yahoo.com/data/x')).toBe(false);
    expect(f('http://api.com/data/x')).toBe(false);
    expect(f('mydata/x.json')).toBe(false);  // 'data/' not on a path boundary
    expect(f('foo.json')).toBe(false);
    expect(f(null)).toBe(false);
    expect(f({})).toBe(false);
  });

});
