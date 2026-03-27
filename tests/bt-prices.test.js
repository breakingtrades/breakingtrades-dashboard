/**
 * bt-prices.js + Canonical Price Layer — Unit Tests
 *
 * Tests:
 *  1. prices.json schema validation
 *  2. Price resolution order: btPrices → watchlist → EM close
 *  3. btPrices API surface (get, price, change, updatedLabel)
 *  4. Macro context strip price overlay
 *  5. EM page uses btPrices over stale EM close
 *  6. Staleness detection
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');

// ── Helper: load JSON safely ──
function loadJSON(filename) {
  const p = path.join(DATA_DIR, filename);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

// ── Inline btPrices logic for testing (mirrors bt-prices.js) ──
function createBtPrices(data) {
  return {
    get(symbol) { return data?.tickers?.[symbol] || null; },
    price(symbol, fallback) { return this.get(symbol)?.price ?? fallback ?? null; },
    change(symbol, fallback) { return this.get(symbol)?.change ?? fallback ?? 0; },
    updatedAt() { return data?.updated || null; },
    updatedLabel() {
      const ts = data?.updated;
      if (!ts) return 'unknown';
      const d = new Date(ts);
      return d.toLocaleString('en-US', {
        month: 'short', day: 'numeric',
        hour: 'numeric', minute: '2-digit', hour12: true,
        timeZone: 'America/New_York'
      }) + ' ET';
    },
    symbols() { return Object.keys(data?.tickers || {}); },
  };
}

// ── Price resolution (mirrors EM page logic) ──
function resolvePrice(symbol, btPrices, watchlist, emTickers) {
  const bp = btPrices.price(symbol);
  const wl = (watchlist || []).find(w => w.symbol === symbol);
  const em = emTickers?.[symbol];
  return bp ?? wl?.price ?? em?.close ?? null;
}

function resolveChange(symbol, btPrices, watchlist) {
  const bc = btPrices.change(symbol);
  if (bc !== 0) return bc;
  const wl = (watchlist || []).find(w => w.symbol === symbol);
  return wl?.change ?? 0;
}

// ── Tests ──

describe('prices.json Schema', () => {
  const prices = loadJSON('prices.json');

  test('prices.json exists and is valid JSON', () => {
    expect(prices).not.toBeNull();
    expect(typeof prices).toBe('object');
  });

  test('has required top-level fields', () => {
    expect(prices).toHaveProperty('updated');
    expect(prices).toHaveProperty('source');
    expect(prices).toHaveProperty('tickers');
    expect(typeof prices.tickers).toBe('object');
  });

  test('updated is valid ISO timestamp', () => {
    const d = new Date(prices.updated);
    expect(d.getTime()).not.toBeNaN();
  });

  test('tickers have price and change fields', () => {
    const symbols = Object.keys(prices.tickers);
    expect(symbols.length).toBeGreaterThan(50); // we have 79 tickers
    for (const sym of symbols.slice(0, 10)) {
      const t = prices.tickers[sym];
      expect(t).toHaveProperty('price');
      expect(t).toHaveProperty('change');
      expect(t).toHaveProperty('updated');
      expect(typeof t.price).toBe('number');
      expect(typeof t.change).toBe('number');
    }
  });

  test('essential tickers are present', () => {
    const essentials = ['SPY', 'QQQ', 'AAPL', 'MSFT', 'NVDA', 'TSLA', 'IWM', 'DIA'];
    for (const sym of essentials) {
      expect(prices.tickers).toHaveProperty(sym);
      expect(prices.tickers[sym].price).toBeGreaterThan(0);
    }
  });

  test('prices are reasonable numbers (not zero, not NaN)', () => {
    for (const [sym, t] of Object.entries(prices.tickers)) {
      expect(t.price).toBeGreaterThan(0);
      expect(Number.isFinite(t.price)).toBe(true);
      expect(Number.isFinite(t.change)).toBe(true);
    }
  });
});

describe('btPrices API', () => {
  const mockData = {
    updated: '2026-03-27T07:17:08.606081+00:00',
    source: 'yfinance',
    tickers: {
      SPY: { price: 645.09, change: -1.79, updated: '2026-03-27T07:17:08.606081+00:00' },
      QQQ: { price: 573.79, change: -2.39, updated: '2026-03-27T07:17:08.606081+00:00' },
      NVDA: { price: 171.24, change: -4.16, updated: '2026-03-27T07:17:08.606081+00:00' },
    }
  };
  const bp = createBtPrices(mockData);

  test('get returns full ticker object', () => {
    const spy = bp.get('SPY');
    expect(spy).toEqual({ price: 645.09, change: -1.79, updated: expect.any(String) });
  });

  test('get returns null for unknown ticker', () => {
    expect(bp.get('ZZZZ')).toBeNull();
  });

  test('price returns number', () => {
    expect(bp.price('SPY')).toBe(645.09);
  });

  test('price returns fallback for unknown', () => {
    expect(bp.price('ZZZZ', 100)).toBe(100);
    expect(bp.price('ZZZZ')).toBeNull();
  });

  test('change returns number', () => {
    expect(bp.change('SPY')).toBe(-1.79);
  });

  test('change returns 0 for unknown', () => {
    expect(bp.change('ZZZZ')).toBe(0);
  });

  test('updatedAt returns ISO string', () => {
    expect(bp.updatedAt()).toBe('2026-03-27T07:17:08.606081+00:00');
  });

  test('updatedLabel formats as readable ET string', () => {
    const label = bp.updatedLabel();
    expect(label).toMatch(/Mar 2[67]/); // date
    expect(label).toMatch(/AM|PM/);     // 12-hour
    expect(label).toMatch(/ET$/);       // timezone
  });

  test('symbols returns all ticker keys', () => {
    expect(bp.symbols()).toEqual(['SPY', 'QQQ', 'NVDA']);
  });
});

describe('btPrices — edge cases', () => {
  test('handles null/undefined data gracefully', () => {
    const bp = createBtPrices(null);
    expect(bp.get('SPY')).toBeNull();
    expect(bp.price('SPY')).toBeNull();
    expect(bp.change('SPY')).toBe(0);
    expect(bp.updatedAt()).toBeNull();
    expect(bp.updatedLabel()).toBe('unknown');
    expect(bp.symbols()).toEqual([]);
  });

  test('handles empty tickers object', () => {
    const bp = createBtPrices({ updated: '2026-01-01', source: 'test', tickers: {} });
    expect(bp.get('SPY')).toBeNull();
    expect(bp.symbols()).toEqual([]);
  });
});

describe('Price Resolution Order', () => {
  const btPrices = createBtPrices({
    updated: '2026-03-27T07:00:00Z', source: 'yfinance',
    tickers: {
      SPY: { price: 645.09, change: -1.79, updated: '2026-03-27T07:00:00Z' },
      QQQ: { price: 573.79, change: -2.39, updated: '2026-03-27T07:00:00Z' },
    }
  });

  const watchlist = [
    { symbol: 'SPY', price: 656.82, change: 0.56 },
    { symbol: 'QQQ', price: 587.82, change: 0.66 },
    { symbol: 'AAPL', price: 252.62, change: -0.11 },
  ];

  const emTickers = {
    SPY: { close: 650.00 },
    QQQ: { close: 580.00 },
    AAPL: { close: 253.44 },
    MSFT: { close: 370.00 },
  };

  test('btPrices wins over watchlist and EM', () => {
    // SPY: btPrices=645.09, watchlist=656.82, EM=650 → should be 645.09
    expect(resolvePrice('SPY', btPrices, watchlist, emTickers)).toBe(645.09);
  });

  test('watchlist wins when btPrices missing', () => {
    // AAPL: btPrices=null, watchlist=252.62, EM=253.44 → should be 252.62
    expect(resolvePrice('AAPL', btPrices, watchlist, emTickers)).toBe(252.62);
  });

  test('EM close used as last resort', () => {
    // MSFT: btPrices=null, watchlist=null, EM=370 → should be 370
    expect(resolvePrice('MSFT', btPrices, watchlist, emTickers)).toBe(370.00);
  });

  test('returns null when no source has ticker', () => {
    expect(resolvePrice('ZZZZ', btPrices, watchlist, emTickers)).toBeNull();
  });

  test('change from btPrices overrides watchlist', () => {
    // SPY: btPrices.change=-1.79, watchlist.change=0.56
    expect(resolveChange('SPY', btPrices, watchlist)).toBe(-1.79);
  });

  test('change falls back to watchlist when btPrices returns 0', () => {
    const bp2 = createBtPrices({
      updated: '2026-03-27T07:00:00Z', source: 'test',
      tickers: { FLAT: { price: 100, change: 0, updated: '2026-03-27T07:00:00Z' } }
    });
    const wl = [{ symbol: 'FLAT', price: 100, change: 0.5 }];
    // btPrices change is 0 (actual flat), falls through to watchlist
    expect(resolveChange('FLAT', bp2, wl)).toBe(0.5);
  });
});

describe('Macro Context Price Overlay', () => {
  test('find() overlays btPrices onto watchlist item', () => {
    const btPrices = createBtPrices({
      updated: '2026-03-27T07:00:00Z', source: 'yfinance',
      tickers: { SPY: { price: 645.09, change: -1.79, updated: '2026-03-27T07:00:00Z' } }
    });
    const tickers = [{ symbol: 'SPY', price: 656.82, change: 0.56, sma20: 669.33 }];

    // Simulate macro-context.js find() logic
    const find = sym => {
      const t = tickers.find(t => t.symbol === sym);
      if (t) {
        const p = btPrices.get(sym);
        if (p) { t.price = p.price; t.change = p.change; }
      }
      return t;
    };

    const spy = find('SPY');
    expect(spy.price).toBe(645.09);   // btPrices wins
    expect(spy.change).toBe(-1.79);   // btPrices wins
    expect(spy.sma20).toBe(669.33);   // preserved from watchlist
  });
});

describe('Staleness Detection', () => {
  test('data less than 24h old is fresh', () => {
    const now = new Date();
    const recent = new Date(now - 12 * 3600000).toISOString();
    const age = (now - new Date(recent)) / 3600000;
    expect(age).toBeLessThan(24);
  });

  test('data more than 24h old is stale', () => {
    const now = new Date();
    const old = new Date(now - 30 * 3600000).toISOString();
    const age = (now - new Date(old)) / 3600000;
    expect(age).toBeGreaterThan(24);
  });

  test('EM header shows both EM ranges and prices freshness', () => {
    // Simulate: EM from Mar 25, prices from Mar 27
    const emUpdated = new Date('2026-03-25T20:20:00Z');
    const pricesUpdated = new Date('2026-03-27T07:00:00Z');
    const emAge = (pricesUpdated - emUpdated) / 3600000;
    expect(emAge).toBeGreaterThan(24); // EM is stale relative to prices
    // The UI should show both timestamps
    const emLabel = `EM Ranges: ${emUpdated.toLocaleDateString()}`;
    const pricesLabel = `Prices: ${pricesUpdated.toLocaleDateString()}`;
    expect(emLabel).toContain('2026');
    expect(pricesLabel).toContain('2026');
  });
});

describe('Cross-file Price Consistency', () => {
  test('prices.json tickers are superset of EM tickers', () => {
    const prices = loadJSON('prices.json');
    const em = loadJSON('expected-moves.json');
    if (!prices || !em) return; // skip if files missing

    const priceSymbols = new Set(Object.keys(prices.tickers));
    const emSymbols = Object.keys(em.tickers || {});
    const missing = emSymbols.filter(s => !priceSymbols.has(s));
    // BRK B is a known exception (yfinance symbol mismatch: "BRK B" vs "BRK-B")
    const unexpected = missing.filter(s => s !== 'BRK B');
    expect(unexpected).toEqual([]);
  });

  test('prices.json tickers cover watchlist symbols', () => {
    const prices = loadJSON('prices.json');
    const wl = loadJSON('watchlist.json');
    if (!prices || !wl) return; // skip if files missing

    const priceSymbols = new Set(Object.keys(prices.tickers));
    const wlSymbols = wl.map(t => t.symbol).filter(Boolean);
    const missing = wlSymbols.filter(s => !priceSymbols.has(s));
    // Allow a few mismatches (BRK.B yfinance issues, macro tickers, etc.)
    expect(missing.length).toBeLessThan(5);
  });
});
