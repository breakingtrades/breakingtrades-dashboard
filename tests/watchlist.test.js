/**
 * tests/watchlist.test.js — Filter/sort/aggregate engine for watchlist refresh
 *
 * Tests the pure-function engine exported from js/pages/watchlist.js:
 *   - classifyAlerts(ticker) -> string[]
 *   - applyFilters(list, filters) -> list
 *   - computeStats(list) -> stats object
 *   - sectorAggregates(list) -> aggregates[]
 */
'use strict';

// Stub globals the module expects before requiring it
global.window = undefined; // force module.exports path

const engine = require('../js/pages/watchlist.js');
const { classifyAlerts, applyFilters, computeStats, sectorAggregates } = engine;

function makeTicker(overrides) {
  return Object.assign({
    symbol: 'TEST', name: 'Test Co', sector: 'Technology', group: 'Quality Stocks',
    bias: 'bull', status: 'watching', price: 100, change: 1.0,
    sma20: 95, sma50: 90, rsi: 55, atrPct: 2.0, volumeRatio: 1.0,
    bbWidthPercentile: 40, pctFrom52wHigh: -5, earningsDays: null,
    smaCrossover: null,
  }, overrides || {});
}

describe('classifyAlerts', () => {
  test('empty alerts for neutral ticker', () => {
    expect(classifyAlerts(makeTicker())).toEqual([]);
  });
  test('earnings7 implies earnings14', () => {
    const a = classifyAlerts(makeTicker({ earningsDays: 5 }));
    expect(a).toContain('earnings7');
    expect(a).toContain('earnings14');
  });
  test('earnings14 without earnings7 when 8-14 days out', () => {
    const a = classifyAlerts(makeTicker({ earningsDays: 10 }));
    expect(a).toContain('earnings14');
    expect(a).not.toContain('earnings7');
  });
  test('RSI overbought/oversold', () => {
    expect(classifyAlerts(makeTicker({ rsi: 75 }))).toContain('rsiOB');
    expect(classifyAlerts(makeTicker({ rsi: 25 }))).toContain('rsiOS');
    expect(classifyAlerts(makeTicker({ rsi: 50 }))).not.toContain('rsiOB');
    expect(classifyAlerts(makeTicker({ rsi: 50 }))).not.toContain('rsiOS');
  });
  test('Bollinger squeeze threshold <15', () => {
    expect(classifyAlerts(makeTicker({ bbWidthPercentile: 10 }))).toContain('bbSqueeze');
    expect(classifyAlerts(makeTicker({ bbWidthPercentile: 20 }))).not.toContain('bbSqueeze');
  });
  test('volume spike >2x', () => {
    expect(classifyAlerts(makeTicker({ volumeRatio: 2.5 }))).toContain('volSpike');
    expect(classifyAlerts(makeTicker({ volumeRatio: 1.5 }))).not.toContain('volSpike');
  });
  test('SMA crossovers', () => {
    expect(classifyAlerts(makeTicker({ smaCrossover: 'death_cross' }))).toContain('deathCross');
    expect(classifyAlerts(makeTicker({ smaCrossover: 'golden_cross' }))).toContain('goldenCross');
  });
  test('null-safe for missing fields', () => {
    const empty = { symbol: 'X' };
    expect(() => classifyAlerts(empty)).not.toThrow();
    expect(classifyAlerts(empty)).toEqual([]);
  });
});

describe('applyFilters — AND logic', () => {
  const list = [
    makeTicker({ symbol: 'AAPL', sector: 'Technology', bias: 'bull',  status: 'watching',    group: 'Quality Stocks', rsi: 72 }),
    makeTicker({ symbol: 'MSFT', sector: 'Technology', bias: 'bull',  status: 'approaching', group: 'Quality Stocks' }),
    makeTicker({ symbol: 'XLE',  sector: 'Energy',     bias: 'bear',  status: 'watching',    group: 'Sector ETFs',    rsi: 25 }),
    makeTicker({ symbol: 'SPY',  sector: 'Index',      bias: 'mixed', status: 'active',      group: 'Macro/Index',    volumeRatio: 2.5 }),
    makeTicker({ symbol: 'NVDA', sector: 'Technology', bias: 'bull',  status: 'active',      group: 'Semiconductors', earningsDays: 10 }),
  ];

  test('default filters returns full list', () => {
    const f = { bias: 'all', status: 'all', sector: 'all', group: 'all', alert: 'all', search: '' };
    expect(applyFilters(list, f).length).toBe(5);
  });
  test('bias=bull', () => {
    const r = applyFilters(list, { bias: 'bull', status: 'all', sector: 'all', group: 'all', alert: 'all', search: '' });
    expect(r.map(x => x.symbol).sort()).toEqual(['AAPL', 'MSFT', 'NVDA']);
  });
  test('sector=Technology AND status=active', () => {
    const r = applyFilters(list, { bias: 'all', status: 'active', sector: 'Technology', group: 'all', alert: 'all', search: '' });
    expect(r.map(x => x.symbol)).toEqual(['NVDA']);
  });
  test('alert=rsiOB', () => {
    const r = applyFilters(list, { bias: 'all', status: 'all', sector: 'all', group: 'all', alert: 'rsiOB', search: '' });
    expect(r.map(x => x.symbol)).toEqual(['AAPL']);
  });
  test('alert=volSpike', () => {
    const r = applyFilters(list, { bias: 'all', status: 'all', sector: 'all', group: 'all', alert: 'volSpike', search: '' });
    expect(r.map(x => x.symbol)).toEqual(['SPY']);
  });
  test('alert=earnings14', () => {
    const r = applyFilters(list, { bias: 'all', status: 'all', sector: 'all', group: 'all', alert: 'earnings14', search: '' });
    expect(r.map(x => x.symbol)).toEqual(['NVDA']);
  });
  test('search matches symbol case-insensitive', () => {
    const r = applyFilters(list, { bias: 'all', status: 'all', sector: 'all', group: 'all', alert: 'all', search: 'msf' });
    expect(r.map(x => x.symbol)).toEqual(['MSFT']);
  });
  test('search matches name', () => {
    const r = applyFilters(list, { bias: 'all', status: 'all', sector: 'all', group: 'all', alert: 'all', search: 'test co' });
    expect(r.length).toBe(5);
  });
  test('conflicting filters returns empty', () => {
    const r = applyFilters(list, { bias: 'bear', status: 'active', sector: 'all', group: 'all', alert: 'all', search: '' });
    expect(r.length).toBe(0);
  });
  test('group filter', () => {
    const r = applyFilters(list, { bias: 'all', status: 'all', sector: 'all', group: 'Semiconductors', alert: 'all', search: '' });
    expect(r.map(x => x.symbol)).toEqual(['NVDA']);
  });
});

describe('computeStats', () => {
  const list = [
    makeTicker({ bias: 'bull', status: 'watching' }),
    makeTicker({ bias: 'bull', status: 'approaching' }),
    makeTicker({ bias: 'bear', status: 'active' }),
    makeTicker({ bias: 'mixed', status: 'exit' }),
    makeTicker({ bias: 'bull', status: 'watching', earningsDays: 5 }),
    makeTicker({ bias: 'bear', status: 'watching', earningsDays: 20 }),
  ];
  test('counts bias correctly', () => {
    const s = computeStats(list);
    expect(s.total).toBe(6);
    expect(s.bull).toBe(3);
    expect(s.bear).toBe(2);
    expect(s.mixed).toBe(1);
  });
  test('counts status correctly', () => {
    const s = computeStats(list);
    expect(s.watching).toBe(3);
    expect(s.approaching).toBe(1);
    expect(s.active).toBe(1);
    expect(s.exit).toBe(1);
  });
  test('counts earnings ≤14d', () => {
    const s = computeStats(list);
    expect(s.earnings14).toBe(1);
  });
  test('empty list safe', () => {
    const s = computeStats([]);
    expect(s.total).toBe(0);
    expect(s.bull).toBe(0);
  });
});

describe('sectorAggregates', () => {
  const list = [
    makeTicker({ sector: 'Technology', bias: 'bull',  change: 2.0, rsi: 60 }),
    makeTicker({ sector: 'Technology', bias: 'bull',  change: 1.0, rsi: 70 }),
    makeTicker({ sector: 'Technology', bias: 'bear',  change: -1.0, rsi: 40 }),
    makeTicker({ sector: 'Energy',     bias: 'bear',  change: -2.0, rsi: 35 }),
    makeTicker({ sector: 'Energy',     bias: 'mixed', change: 0.5,  rsi: null }),
  ];
  test('aggregates per sector', () => {
    const a = sectorAggregates(list);
    const tech = a.find(x => x.sector === 'Technology');
    expect(tech.count).toBe(3);
    expect(tech.bull).toBe(2);
    expect(tech.pctBull).toBe(67);
    expect(tech.avgChg).toBeCloseTo(0.6667, 2);
    expect(tech.avgRsi).toBeCloseTo(56.67, 1);
  });
  test('handles null RSI in avg', () => {
    const a = sectorAggregates(list);
    const en = a.find(x => x.sector === 'Energy');
    expect(en.count).toBe(2);
    expect(en.avgRsi).toBe(35); // only 1 non-null
  });
  test('sorted descending by count', () => {
    const a = sectorAggregates(list);
    expect(a[0].count).toBeGreaterThanOrEqual(a[a.length - 1].count);
  });
  test('empty list returns empty array', () => {
    expect(sectorAggregates([])).toEqual([]);
  });
});

describe('Filter persistence shape', () => {
  test('Default filter keys are stable', () => {
    const defaultShape = ['bias', 'status', 'sector', 'group', 'alert', 'search'];
    // Simulate reading back from prefs; applyFilters should handle full shape
    const f = {};
    defaultShape.forEach(k => { f[k] = k === 'search' ? '' : 'all'; });
    const list = [makeTicker()];
    expect(applyFilters(list, f).length).toBe(1);
  });
});
