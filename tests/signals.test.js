/**
 * Signals page — Unit Tests for mapWatchlistToSignal() + tooltip helpers
 * Covered scenarios:
 *  1. mapWatchlistToSignal returns null for missing/broken input
 *  2. Status/bias passthrough from watchlist.json → card shape
 *  3. Null defaults (change, volRating, bias)
 *  4. buildStatusReason / biasTip produce sensible strings
 *  5. Real MSFT row from watchlist.json no longer produces contradictory labels
 *  6. Null-status rows are filtered out
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadSignalsModule() {
  const src = fs.readFileSync(
    path.join(__dirname, '..', 'js', 'pages', 'signals.js'),
    'utf8'
  );
  const sandbox = {
    window: {},
    document: { getElementById: () => null, querySelectorAll: () => [] },
    BT: { pages: {}, components: {} },
    console,
    fetch: () => Promise.resolve({ ok: true, json: () => Promise.resolve([]) }),
    setTimeout, clearTimeout,
  };
  sandbox.window.BT = sandbox.BT;
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  return sandbox.BT.pages.signals;
}

const signals = loadSignalsModule();
const map = signals._mapWatchlistToSignal;
const reasonFor = signals._buildStatusReason;
const biasFor = signals._biasTip;

describe('signals.js mapWatchlistToSignal', () => {
  test('returns null for missing input', () => {
    expect(map(null)).toBeNull();
    expect(map(undefined)).toBeNull();
    expect(map({})).toBeNull();
  });
  test('returns null when symbol missing', () => {
    expect(map({ price: 100, status: 'watching' })).toBeNull();
  });
  test('returns null when status missing', () => {
    expect(map({ symbol: 'FOO', price: 100 })).toBeNull();
  });
  test('returns null when price missing', () => {
    expect(map({ symbol: 'FOO', status: 'watching' })).toBeNull();
  });
  test('maps canonical watchlist row', () => {
    const out = map({
      symbol: 'MSFT', name: 'Microsoft', sector: 'Technology',
      price: 411.22, change: 0.5, bias: 'bull', status: 'watching',
      sma20: 400.1, sma50: 395.0, sma200: 380.0, w20: 390.0,
      rsi: 58.2, atr: 7.5, atrPct: 1.8, volRating: 'Medium',
      volume: 22000000, volumeRatio: 1.1,
      high52w: 468.0, low52w: 344.0, pctFrom52wHigh: -12.1
    });
    expect(out).toBeTruthy();
    expect(out.symbol).toBe('MSFT');
    expect(out.status).toBe('watching');
    expect(out.bias).toBe('bull');
    expect(out.price).toBe(411.22);
    expect(out.sma20).toBe(400.1);
    expect(out.volRating).toBe('Medium');
    expect(out.high52w).toBe(468.0);
  });
  test('fills safe defaults for optional fields', () => {
    const out = map({ symbol: 'X', price: 10, status: 'watching' });
    expect(out.name).toBe('X');
    expect(out.sector).toBe('');
    expect(out.change).toBe(0);
    expect(out.bias).toBe('mixed');
    expect(out.volRating).toBe('Normal');
  });
});

describe('signals.js buildStatusReason', () => {
  test('builds reason with SMA relationships', () => {
    const r = reasonFor({ price: 411, status: 'watching', sma20: 400, sma50: 395, w20: 390 });
    expect(r).toMatch(/SMA20/);
    expect(r).toMatch(/above/);
  });
  test('handles missing SMAs gracefully', () => {
    const r = reasonFor({ price: 411, status: 'watching', sma20: null, sma50: null, w20: null });
    expect(typeof r).toBe('string');
  });
});

describe('signals.js biasTip', () => {
  test('bull bias says "bull stack"', () => {
    expect(biasFor({ price: 411, bias: 'bull', sma20: 400, sma50: 395, w20: 390 }))
      .toMatch(/bull stack/);
  });
  test('bear bias says "bear stack"', () => {
    expect(biasFor({ price: 380, bias: 'bear', sma20: 400, sma50: 395, w20: 390 }))
      .toMatch(/bear stack/);
  });
  test('mixed bias says "mixed"', () => {
    expect(biasFor({ price: 397, bias: 'mixed', sma20: 400, sma50: 395, w20: 390 }))
      .toMatch(/mixed/);
  });
});

describe('signals.js real watchlist.json integration', () => {
  test('MSFT maps to canonical status/bias with no logic contradictions', () => {
    const p = path.join(__dirname, '..', 'data', 'watchlist.json');
    if (!fs.existsSync(p)) return;
    const wl = JSON.parse(fs.readFileSync(p, 'utf8'));
    const list = Array.isArray(wl) ? wl : (wl.tickers || []);
    const msft = list.find(x => x.symbol === 'MSFT');
    if (!msft) return;
    const out = map(msft);
    expect(out).toBeTruthy();
    expect(['exit','triggered','approaching','active','watching']).toContain(out.status);
    expect(['bull','bear','mixed']).toContain(out.bias);
    // Guard against the old "EXIT + BULL + price>SMA20" contradiction
    if (out.status === 'exit' && out.bias === 'bull' && out.price > out.sma20) {
      throw new Error('logic contradiction: exit status + bull bias + price above SMA20');
    }
  });
  test('null-status rows are filtered out', () => {
    const kept = [
      { symbol: 'A', price: 100, status: 'watching' },
      { symbol: 'B', price: 100, status: null },
      { symbol: 'C', price: 100 },
      { symbol: 'D', status: 'watching' },
      { symbol: 'E', price: 100, status: 'triggered' },
    ].map(map).filter(Boolean);
    expect(kept.map(x => x.symbol)).toEqual(['A', 'E']);
  });
});
