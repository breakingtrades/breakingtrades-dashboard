/**
 * Expected Moves — Data Integrity & Position Variance Tests
 *
 * These tests validate that EM data produces meaningful, differentiated
 * positions when combined with live price data. Catches the "all 50%"
 * bug where EM anchor === live price for every ticker.
 *
 * Run: cd tests && npx jest expected-moves.test.js
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');

function loadJSON(filename) {
  const p = path.join(DATA_DIR, filename);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function computePosition(livePrice, lower, upper) {
  const range = upper - lower;
  if (range <= 0) return 50;
  return ((livePrice - lower) / range) * 100;
}

const emData = loadJSON('expected-moves.json');
const pricesData = loadJSON('prices.json');

// Skip all tests if data files don't exist (CI without data)
const describeWithData = emData && pricesData ? describe : describe.skip;

// ============================================================
// POSITION VARIANCE — would have caught the "all 50%" bug
// ============================================================
describeWithData('EM Position Variance (anti-regression)', () => {
  let positions;
  let tickerCount;

  beforeAll(() => {
    positions = [];
    const tickers = emData.tickers || {};
    const priceTickers = pricesData.tickers || {};

    for (const [sym, t] of Object.entries(tickers)) {
      const weekly = t.weekly;
      if (!weekly || !weekly.upper || !weekly.lower) continue;

      const p = priceTickers[sym];
      const livePrice = p ? p.price : t.close;
      const pos = computePosition(livePrice, weekly.lower, weekly.upper);

      positions.push({ sym, pos, anchor: t.close, live: livePrice });
    }
    tickerCount = positions.length;
  });

  test('has at least 50 tickers with position data', () => {
    expect(tickerCount).toBeGreaterThanOrEqual(50);
  });

  test('NOT all positions are at exactly 50% (the core regression)', () => {
    // If EM anchor === live price, position is always exactly 50%.
    // At most 50% of tickers should be within ±1% of 50.
    const at50 = positions.filter(p => Math.abs(p.pos - 50) < 1).length;
    const pctAt50 = at50 / tickerCount;

    expect(pctAt50).toBeLessThan(0.5);
  });

  test('position standard deviation > 5 (meaningful spread)', () => {
    const mean = positions.reduce((s, p) => s + p.pos, 0) / tickerCount;
    const variance = positions.reduce((s, p) => s + (p.pos - mean) ** 2, 0) / tickerCount;
    const stdDev = Math.sqrt(variance);

    // A healthy EM page should have stddev > 5 (positions vary)
    // When everything is 50%, stddev ≈ 0
    expect(stdDev).toBeGreaterThan(5);
  });

  test('at least 3 distinct risk levels present', () => {
    function getRiskLevel(pos) {
      if (pos <= 20) return 'LOW';
      if (pos <= 55) return 'MODERATE';
      if (pos <= 70) return 'ELEVATED';
      if (pos <= 85) return 'HIGH';
      if (pos <= 100) return 'EXTENDED';
      return 'ABOVE_EM';
    }

    const levels = new Set(positions.map(p => getRiskLevel(p.pos)));
    // Should have at least 3 different risk levels across all tickers
    expect(levels.size).toBeGreaterThanOrEqual(3);
  });

  test('some tickers are below 30% position (buy zone exists)', () => {
    const buyZone = positions.filter(p => p.pos < 30).length;
    // At least 1 ticker should be in buy zone in a normal market
    expect(buyZone).toBeGreaterThanOrEqual(1);
  });

  test('some tickers are above 70% position (risk zone exists)', () => {
    const riskZone = positions.filter(p => p.pos > 70).length;
    expect(riskZone).toBeGreaterThanOrEqual(1);
  });
});

// ============================================================
// EM ANCHOR vs LIVE PRICE INDEPENDENCE
// ============================================================
describeWithData('EM Anchor vs Live Price Independence', () => {
  test('EM close (anchor) should NOT equal prices.json for majority of tickers', () => {
    // This is the direct test for the root cause.
    // If the EM script uses prices.json as its anchor, they'll match exactly.
    const tickers = emData.tickers || {};
    const priceTickers = pricesData.tickers || {};
    let exactMatches = 0;
    let total = 0;

    for (const [sym, t] of Object.entries(tickers)) {
      const p = priceTickers[sym];
      if (!p) continue;
      total++;

      // "Exact" = within $0.01 (floating point tolerance)
      if (Math.abs(t.close - p.price) < 0.01) {
        exactMatches++;
      }
    }

    // If > 80% of EM anchors exactly match live prices,
    // the EM is using the same price source → position will be ~50% for all.
    const matchRate = exactMatches / Math.max(total, 1);
    expect(matchRate).toBeLessThan(0.8);
  });
});

// ============================================================
// BAND SYMMETRY & SANITY
// ============================================================
describeWithData('EM Band Integrity', () => {
  test('bands are symmetric around anchor (close ± EM)', () => {
    for (const [sym, t] of Object.entries(emData.tickers)) {
      if (!t.weekly) continue;
      const midpoint = (t.weekly.upper + t.weekly.lower) / 2;
      // Midpoint should equal close price (bands are centered on close)
      expect(Math.abs(midpoint - t.close)).toBeLessThan(0.02);
    }
  });

  test('upper > lower for all tiers', () => {
    for (const [sym, t] of Object.entries(emData.tickers)) {
      for (const tier of ['daily', 'weekly', 'monthly', 'quarterly']) {
        if (!t[tier]) continue;
        expect(t[tier].upper).toBeGreaterThan(t[tier].lower);
      }
    }
  });

  test('EM value > 0 for all tickers', () => {
    for (const [sym, t] of Object.entries(emData.tickers)) {
      if (!t.weekly) continue;
      expect(t.weekly.value).toBeGreaterThan(0);
      expect(t.weekly.pct).toBeGreaterThan(0);
    }
  });

  test('tier ordering: daily < weekly < monthly < quarterly (scaled)', () => {
    for (const [sym, t] of Object.entries(emData.tickers)) {
      if (!t.daily || !t.weekly) continue;
      expect(t.daily.value).toBeLessThan(t.weekly.value);

      // Only check scaled tiers (direct straddle overrides can break ordering)
      if (t.monthly && !t.monthly_straddle) {
        expect(t.weekly.value).toBeLessThan(t.monthly.value);
      }
    }
  });
});

// ============================================================
// DATA FRESHNESS
// ============================================================
describeWithData('EM Data Freshness', () => {
  test('EM data updated within last 3 days', () => {
    const updated = new Date(emData.updated);
    const ageDays = (Date.now() - updated.getTime()) / (1000 * 60 * 60 * 24);
    expect(ageDays).toBeLessThan(3);
  });

  test('prices.json updated within last 3 days', () => {
    const updated = new Date(pricesData.updated);
    const ageDays = (Date.now() - updated.getTime()) / (1000 * 60 * 60 * 24);
    expect(ageDays).toBeLessThan(3);
  });

  test('at least 70 tickers in EM data', () => {
    expect(Object.keys(emData.tickers).length).toBeGreaterThanOrEqual(70);
  });

  test('source field is present', () => {
    expect(emData.source).toBeTruthy();
  });
});

// ============================================================
// PIPELINE DATA CONSISTENCY (cross-file checks)
// ============================================================
describeWithData('Pipeline Data Consistency', () => {
  test('prices.json covers majority of EM tickers', () => {
    const emSyms = new Set(Object.keys(emData.tickers));
    const priceSyms = new Set(Object.keys(pricesData.tickers));
    const overlap = [...emSyms].filter(s => priceSyms.has(s)).length;
    const coverage = overlap / emSyms.size;

    // At least 90% of EM tickers should have live prices
    expect(coverage).toBeGreaterThan(0.9);
  });
});
