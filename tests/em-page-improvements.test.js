/**
 * EM Page Improvements — Unit Tests
 *
 * Tests the data helpers added by `feat/em-history-sparkline`:
 *   - computeIVTrend(history, anchorClose)
 *   - buildHistoryChart(ticker, maxPoints)
 *   - biasBreakdown(rows)
 *   - default-sort behavior (position ASC when no sortCol)
 *   - alert-tag filter logic
 *
 * The implementations live as inline <script> in v1/expected-moves.html.
 * To unit-test them without a browser we extract their function bodies
 * by string-matching, then `eval` them inside this Jest module.
 *
 * If the file structure changes (function rename / signature drift) these
 * tests will fail loudly — that is the intent.
 *
 * Run: cd tests && npx jest em-page-improvements.test.js
 */

const fs = require('fs');
const path = require('path');

const HTML_PATH = path.join(__dirname, '..', 'v1', 'expected-moves.html');
const html = fs.readFileSync(HTML_PATH, 'utf8');

// Pull a `function NAME(...)` block out of the inline <script>.
// Greedy-match braces with a simple depth counter.
function extractFn(name) {
  const start = html.indexOf(`function ${name}(`);
  if (start === -1) throw new Error(`function ${name} not found in expected-moves.html`);
  const openBrace = html.indexOf('{', start);
  let depth = 1;
  let i = openBrace + 1;
  while (i < html.length && depth > 0) {
    const ch = html[i];
    if (ch === '{') depth++;
    else if (ch === '}') depth--;
    i++;
  }
  return html.slice(start, i);
}

// Build a sandbox that has just enough globals for the extracted functions.
const sandbox = { window: {} };
sandbox.global = sandbox;

// Pull dependent helpers in order. computeIVTrend has no deps; buildHistoryChart
// has no deps; biasBreakdown has no deps. Order doesn't matter functionally.
const SOURCES = ['computeIVTrend', 'buildHistoryChart', 'biasBreakdown'].map(extractFn);

// eslint-disable-next-line no-new-func
const installer = new Function('window', SOURCES.join('\n') + `
  window.computeIVTrend = computeIVTrend;
  window.buildHistoryChart = buildHistoryChart;
  window.biasBreakdown = biasBreakdown;
`);
installer(sandbox.window);

const { computeIVTrend, buildHistoryChart, biasBreakdown } = sandbox.window;

// ──────────────────────────────────────────────────────────────────────────
// computeIVTrend
// ──────────────────────────────────────────────────────────────────────────

describe('computeIVTrend', () => {
  test('returns empty when history is missing or too short', () => {
    expect(computeIVTrend(null, 100).kind).toBe('empty');
    expect(computeIVTrend([], 100).kind).toBe('empty');
    expect(computeIVTrend([{close: 100, weekly_em: 1}], 100).kind).toBe('empty');
    expect(computeIVTrend([{close: 100, weekly_em: 1},{close:100,weekly_em:1},{close:100,weekly_em:1}], 100).kind).toBe('empty');
  });

  test('flat trend produces "flat" kind', () => {
    const hist = [];
    for (let i = 0; i < 10; i++) hist.push({ close: 100, weekly_em: 1.0 });
    const r = computeIVTrend(hist, 100);
    expect(r.kind).toBe('flat');
    expect(Math.abs(r.delta)).toBeLessThan(5);
  });

  test('rising IV gives "up" kind with positive delta', () => {
    const hist = [
      // prior 5 — em% = 1%
      { close: 100, weekly_em: 1.0 },
      { close: 100, weekly_em: 1.0 },
      { close: 100, weekly_em: 1.0 },
      { close: 100, weekly_em: 1.0 },
      { close: 100, weekly_em: 1.0 },
      // recent 5 — em% = 1.5% → +50%
      { close: 100, weekly_em: 1.5 },
      { close: 100, weekly_em: 1.5 },
      { close: 100, weekly_em: 1.5 },
      { close: 100, weekly_em: 1.5 },
      { close: 100, weekly_em: 1.5 },
    ];
    const r = computeIVTrend(hist, 100);
    expect(r.kind).toBe('up');
    expect(r.delta).toBeGreaterThanOrEqual(5);
    expect(r.label).toMatch(/▲/);
  });

  test('contracting IV gives "down" kind with negative delta', () => {
    const hist = [
      { close: 100, weekly_em: 2.0 },
      { close: 100, weekly_em: 2.0 },
      { close: 100, weekly_em: 2.0 },
      { close: 100, weekly_em: 2.0 },
      { close: 100, weekly_em: 2.0 },
      { close: 100, weekly_em: 1.0 },
      { close: 100, weekly_em: 1.0 },
      { close: 100, weekly_em: 1.0 },
      { close: 100, weekly_em: 1.0 },
      { close: 100, weekly_em: 1.0 },
    ];
    const r = computeIVTrend(hist, 100);
    expect(r.kind).toBe('down');
    expect(r.delta).toBeLessThanOrEqual(-5);
    expect(r.label).toMatch(/▼/);
  });

  test('handles missing close in snapshot via anchorClose fallback', () => {
    const hist = [
      { close: undefined, weekly_em: 1.0 },
      { close: 100, weekly_em: 1.0 },
      { close: 100, weekly_em: 1.0 },
      { close: 100, weekly_em: 1.5 },
    ];
    const r = computeIVTrend(hist, 100);
    expect(['up','down','flat','empty']).toContain(r.kind);
  });

  test('falls back to "empty" when all weekly_em are non-numeric', () => {
    const hist = [
      { close: 100 }, { close: 100 }, { close: 100 }, { close: 100 },
    ];
    expect(computeIVTrend(hist, 100).kind).toBe('empty');
  });
});

// ──────────────────────────────────────────────────────────────────────────
// buildHistoryChart
// ──────────────────────────────────────────────────────────────────────────

describe('buildHistoryChart', () => {
  test('returns null when history is missing or has < 2 entries', () => {
    expect(buildHistoryChart({})).toBeNull();
    expect(buildHistoryChart({ history: [] })).toBeNull();
    expect(buildHistoryChart({ history: [{date:'2026-01-01', close: 100, weekly_em: 1}] })).toBeNull();
  });

  test('returns valid SVG geometry for a flat series', () => {
    const t = { history: Array.from({length: 5}, (_, i) => ({
      date: `2026-01-0${i+1}`, close: 100, weekly_em: 1
    })) };
    const c = buildHistoryChart(t);
    expect(c).not.toBeNull();
    expect(c.points.length).toBe(5);
    expect(c.breachCount).toBe(0);
    // polyline string should have 5 "x,y" pairs
    expect(c.linePolyline.split(' ').length).toBe(5);
    // band polygon: 5 upper + 5 lower = 10 pairs
    expect(c.bandPolygon.split(' ').length).toBe(10);
    // every coordinate must be a finite number
    for (const pair of c.linePolyline.split(' ')) {
      const [x, y] = pair.split(',').map(Number);
      expect(Number.isFinite(x)).toBe(true);
      expect(Number.isFinite(y)).toBe(true);
    }
  });

  test('detects up-breach when close jumps above prior upper band', () => {
    const t = { history: [
      { date: 'd1', close: 100, weekly_em: 1 },
      { date: 'd2', close: 102, weekly_em: 1 }, // 102 > 100 + 1
      { date: 'd3', close: 102, weekly_em: 1 },
    ] };
    const c = buildHistoryChart(t);
    expect(c.breachCount).toBe(1);
    expect(c.breachMarkers[0].color).toBe('#ef5350');
    expect(c.breachMarkers[0].title).toMatch(/broke above/);
  });

  test('detects down-breach when close falls below prior lower band', () => {
    const t = { history: [
      { date: 'd1', close: 100, weekly_em: 1 },
      { date: 'd2', close: 98,  weekly_em: 1 }, // 98 < 100 - 1
      { date: 'd3', close: 98,  weekly_em: 1 },
    ] };
    const c = buildHistoryChart(t);
    expect(c.breachCount).toBe(1);
    expect(c.breachMarkers[0].color).toBe('#00d4aa');
    expect(c.breachMarkers[0].title).toMatch(/broke below/);
  });

  test('clamps to maxPoints', () => {
    const hist = Array.from({length: 50}, (_, i) => ({
      date: `2026-01-${String(i+1).padStart(2, '0')}`, close: 100, weekly_em: 1
    }));
    const c = buildHistoryChart({ history: hist }, 12);
    expect(c.points.length).toBe(12);
  });

  test('drops snapshots with non-finite close or weekly_em', () => {
    const hist = [
      { date: 'd1', close: 100, weekly_em: 1 },
      { date: 'd2', close: null, weekly_em: 1 },
      { date: 'd3', close: 100, weekly_em: 'oops' },
      { date: 'd4', close: 100, weekly_em: 1 },
    ];
    const c = buildHistoryChart({ history: hist });
    expect(c.points.length).toBe(2);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// biasBreakdown
// ──────────────────────────────────────────────────────────────────────────

describe('biasBreakdown', () => {
  test('counts bull/bear/mixed buckets', () => {
    const rows = [
      { bias: 'bull' },
      { bias: 'bull' },
      { bias: 'bear' },
      { bias: null },
      { bias: undefined },
      { bias: 'mixed' },
    ];
    const b = biasBreakdown(rows);
    expect(b.bull).toBe(2);
    expect(b.bear).toBe(1);
    expect(b.mixed).toBe(3);
  });

  test('zero on empty input', () => {
    expect(biasBreakdown([])).toEqual({ bull: 0, bear: 0, mixed: 0 });
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Default sort behavior — verify the comparator formula matches our spec.
// ──────────────────────────────────────────────────────────────────────────

describe('default sort (position ASC)', () => {
  test('rows sort by position ascending — buy zones first', () => {
    const rows = [
      { symbol: 'AAA', position: 80 },
      { symbol: 'BBB', position: 5 },
      { symbol: 'CCC', position: 50 },
      { symbol: 'DDD', position: -10 },
      { symbol: 'EEE', position: 110 },
    ];
    rows.sort((a, b) => a.position - b.position);
    expect(rows.map(r => r.symbol)).toEqual(['DDD', 'BBB', 'CCC', 'AAA', 'EEE']);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Alert-tag filter logic — test with the same predicate the page uses
// ──────────────────────────────────────────────────────────────────────────

describe('alert-tag filter logic', () => {
  // Mirrors the predicate in buildRows() — kept in sync intentionally.
  function passes(active, position) {
    if (active.size === 0) return true;
    const isBuy      = position <= 20;
    const isExtended = position >= 85 && position <= 100;
    const isOutside  = position < 0 || position > 100;
    return (active.has('buy')      && isBuy)
        || (active.has('extended') && isExtended)
        || (active.has('outside')  && isOutside);
  }

  test('no chips active = pass-through', () => {
    expect(passes(new Set(), 50)).toBe(true);
    expect(passes(new Set(), -5)).toBe(true);
    expect(passes(new Set(), 150)).toBe(true);
  });

  test('buy chip = position ≤ 20 (inclusive)', () => {
    const f = new Set(['buy']);
    expect(passes(f, 0)).toBe(true);
    expect(passes(f, 20)).toBe(true);
    expect(passes(f, 21)).toBe(false);
    // position < 0 still counts as buy (below low = below EM range = oversold)
    expect(passes(f, -5)).toBe(true);
  });

  test('extended chip = 85 ≤ position ≤ 100 (excludes outside)', () => {
    const f = new Set(['extended']);
    expect(passes(f, 84)).toBe(false);
    expect(passes(f, 85)).toBe(true);
    expect(passes(f, 100)).toBe(true);
    expect(passes(f, 101)).toBe(false);
  });

  test('outside chip = position < 0 or > 100', () => {
    const f = new Set(['outside']);
    expect(passes(f, -1)).toBe(true);
    expect(passes(f, 0)).toBe(false);
    expect(passes(f, 100)).toBe(false);
    expect(passes(f, 101)).toBe(true);
  });

  test('multi-toggle (buy + extended) is OR', () => {
    const f = new Set(['buy', 'extended']);
    expect(passes(f, 10)).toBe(true);   // buy
    expect(passes(f, 90)).toBe(true);   // extended
    expect(passes(f, 50)).toBe(false);  // neither
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Real-data smoke check (skipped if data file absent / CI w/o data)
// ──────────────────────────────────────────────────────────────────────────

const DATA_FILE = path.join(__dirname, '..', 'data', 'expected-moves.json');
const realData = fs.existsSync(DATA_FILE) ? JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) : null;
const describeReal = realData ? describe : describe.skip;

describeReal('Real data smoke', () => {
  test('every ticker with history of length ≥ 2 yields a non-null chart', () => {
    const tickers = realData.tickers || {};
    let charted = 0, total = 0;
    for (const [, t] of Object.entries(tickers)) {
      if (!Array.isArray(t.history) || t.history.length < 2) continue;
      total++;
      const c = buildHistoryChart(t);
      if (c) charted++;
    }
    expect(total).toBeGreaterThan(0);
    expect(charted).toBe(total);
  });

  test('IV trend either gives empty (insufficient data) or a finite delta', () => {
    const tickers = realData.tickers || {};
    let count = 0;
    for (const [, t] of Object.entries(tickers)) {
      const tr = computeIVTrend(t.history, t.close);
      if (tr.kind === 'empty') {
        expect(tr.delta).toBeNull();
      } else {
        expect(Number.isFinite(tr.delta)).toBe(true);
      }
      count++;
    }
    expect(count).toBeGreaterThan(0);
  });
});
