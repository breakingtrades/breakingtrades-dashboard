/**
 * market-breadth.test.js — Market Breadth data + UI logic tests
 *
 * Tests:
 *  1. breadth.json schema validation (required fields, structure, value ranges)
 *  2. Stacked total calculation (sum of 11 sectors, max 1100)
 *  3. Average breadth calculation (total / 11)
 *  4. Zone classification (green zone <200/20%, red zone >1000/90%)
 *  5. Color coding thresholds for MBL table (≤20 oversold, ≥80 overbought)
 *  6. Data completeness (11 sectors, 5 indices × 4 timeframes)
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');

function loadJSON(filename) {
  const p = path.join(DATA_DIR, filename);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

// ── UI Logic mirrors (from market.html) ──
function classifyBadge(val) {
  if (val == null) return 'neutral';
  if (val <= 20) return 'oversold';
  if (val >= 80) return 'overbought';
  return 'neutral';
}

function classifyStackedZone(stacked) {
  if (stacked < 200) return 'green';
  if (stacked > 1000) return 'red';
  return 'neutral';
}

function classifyAverageZone(avg) {
  if (avg < 20) return 'green';
  if (avg > 80) return 'red';
  return 'neutral';
}

const EXPECTED_SECTORS = ['COM', 'CND', 'CNS', 'ENE', 'FIN', 'HLC', 'IND', 'MAT', 'RLE', 'TEC', 'UTL'];
const EXPECTED_INDICES = ['SPX', 'NDX', 'DJI', 'RUT', 'VTI'];
const EXPECTED_TIMEFRAMES = ['20d', '50d', '100d', '200d'];

// ═══════════════════════════════════════════════════════════
// 1. Schema Validation
// ═══════════════════════════════════════════════════════════
describe('breadth.json schema', () => {
  const data = loadJSON('breadth.json');

  test('file exists and parses', () => {
    expect(data).not.toBeNull();
    expect(typeof data).toBe('object');
  });

  test('has required top-level fields', () => {
    expect(data).toHaveProperty('updated');
    expect(data).toHaveProperty('sectors');
    expect(data).toHaveProperty('indices');
    expect(data).toHaveProperty('total');
  });

  test('updated is valid ISO timestamp', () => {
    const d = new Date(data.updated);
    expect(d.getTime()).not.toBeNaN();
  });

  test('total has stacked and average fields', () => {
    expect(data.total).toHaveProperty('stacked');
    expect(data.total).toHaveProperty('average');
    expect(typeof data.total.stacked).toBe('number');
    expect(typeof data.total.average).toBe('number');
  });

  test('each sector has name and above_20d', () => {
    for (const [code, sector] of Object.entries(data.sectors)) {
      expect(sector).toHaveProperty('name');
      expect(sector).toHaveProperty('above_20d');
      expect(typeof sector.name).toBe('string');
      expect(typeof sector.above_20d).toBe('number');
    }
  });

  test('sector above_20d values are in range 0-100', () => {
    for (const [code, sector] of Object.entries(data.sectors)) {
      expect(sector.above_20d).toBeGreaterThanOrEqual(0);
      expect(sector.above_20d).toBeLessThanOrEqual(100);
    }
  });

  test('each index has 4 timeframe values', () => {
    for (const [code, idx] of Object.entries(data.indices)) {
      for (const tf of EXPECTED_TIMEFRAMES) {
        expect(idx).toHaveProperty(tf);
        expect(typeof idx[tf]).toBe('number');
      }
    }
  });

  test('index values are in range 0-100', () => {
    for (const [code, idx] of Object.entries(data.indices)) {
      for (const tf of EXPECTED_TIMEFRAMES) {
        expect(idx[tf]).toBeGreaterThanOrEqual(0);
        expect(idx[tf]).toBeLessThanOrEqual(100);
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════
// 2. Stacked Total Calculation
// ═══════════════════════════════════════════════════════════
describe('stacked total', () => {
  const data = loadJSON('breadth.json');

  test('stacked = sum of all sector above_20d values', () => {
    if (!data) return;
    const sum = Object.values(data.sectors).reduce((acc, s) => acc + s.above_20d, 0);
    expect(data.total.stacked).toBeCloseTo(sum, 0);
  });

  test('stacked is between 0 and 1100', () => {
    if (!data) return;
    expect(data.total.stacked).toBeGreaterThanOrEqual(0);
    expect(data.total.stacked).toBeLessThanOrEqual(1100);
  });

  test('max possible stacked is 11 sectors × 100 = 1100', () => {
    // Pure logic test
    const mockSectors = EXPECTED_SECTORS.reduce((acc, s) => {
      acc[s] = { above_20d: 100 }; return acc;
    }, {});
    const sum = Object.values(mockSectors).reduce((acc, s) => acc + s.above_20d, 0);
    expect(sum).toBe(1100);
  });
});

// ═══════════════════════════════════════════════════════════
// 3. Average Breadth Calculation
// ═══════════════════════════════════════════════════════════
describe('average breadth', () => {
  const data = loadJSON('breadth.json');

  test('average = stacked / 11', () => {
    if (!data) return;
    const expected = data.total.stacked / EXPECTED_SECTORS.length;
    expect(data.total.average).toBeCloseTo(expected, 0);
  });

  test('average is between 0 and 100', () => {
    if (!data) return;
    expect(data.total.average).toBeGreaterThanOrEqual(0);
    expect(data.total.average).toBeLessThanOrEqual(100);
  });

  test('average calculation with known values', () => {
    const stacked = 550;
    const avg = stacked / 11;
    expect(avg).toBe(50);
  });
});

// ═══════════════════════════════════════════════════════════
// 4. Zone Classification Logic
// ═══════════════════════════════════════════════════════════
describe('zone classification', () => {
  test('stacked below 200 = green (oversold)', () => {
    expect(classifyStackedZone(0)).toBe('green');
    expect(classifyStackedZone(100)).toBe('green');
    expect(classifyStackedZone(199)).toBe('green');
  });

  test('stacked above 1000 = red (overbought)', () => {
    expect(classifyStackedZone(1001)).toBe('red');
    expect(classifyStackedZone(1100)).toBe('red');
  });

  test('stacked 200-1000 = neutral', () => {
    expect(classifyStackedZone(200)).toBe('neutral');
    expect(classifyStackedZone(500)).toBe('neutral');
    expect(classifyStackedZone(1000)).toBe('neutral');
  });

  test('average below 20 = green', () => {
    expect(classifyAverageZone(0)).toBe('green');
    expect(classifyAverageZone(10)).toBe('green');
    expect(classifyAverageZone(19)).toBe('green');
  });

  test('average above 80 = red', () => {
    expect(classifyAverageZone(81)).toBe('red');
    expect(classifyAverageZone(100)).toBe('red');
  });

  test('average 20-80 = neutral', () => {
    expect(classifyAverageZone(20)).toBe('neutral');
    expect(classifyAverageZone(50)).toBe('neutral');
    expect(classifyAverageZone(80)).toBe('neutral');
  });
});

// ═══════════════════════════════════════════════════════════
// 5. Color Coding Thresholds (MBL Table Badges)
// ═══════════════════════════════════════════════════════════
describe('badge color coding', () => {
  test('value ≤ 20 = oversold (green badge)', () => {
    expect(classifyBadge(0)).toBe('oversold');
    expect(classifyBadge(10)).toBe('oversold');
    expect(classifyBadge(20)).toBe('oversold');
  });

  test('value ≥ 80 = overbought (red badge)', () => {
    expect(classifyBadge(80)).toBe('overbought');
    expect(classifyBadge(90)).toBe('overbought');
    expect(classifyBadge(100)).toBe('overbought');
  });

  test('value 21-79 = neutral', () => {
    expect(classifyBadge(21)).toBe('neutral');
    expect(classifyBadge(50)).toBe('neutral');
    expect(classifyBadge(79)).toBe('neutral');
  });

  test('null value = neutral', () => {
    expect(classifyBadge(null)).toBe('neutral');
    expect(classifyBadge(undefined)).toBe('neutral');
  });

  test('boundary values: 20 is oversold, 21 is neutral, 79 is neutral, 80 is overbought', () => {
    expect(classifyBadge(20)).toBe('oversold');
    expect(classifyBadge(20.1)).toBe('neutral');
    expect(classifyBadge(79.9)).toBe('neutral');
    expect(classifyBadge(80)).toBe('overbought');
  });
});

// ═══════════════════════════════════════════════════════════
// 6. Data Completeness
// ═══════════════════════════════════════════════════════════
describe('data completeness', () => {
  const data = loadJSON('breadth.json');

  test('all 11 sectors are present', () => {
    if (!data) return;
    const sectorCodes = Object.keys(data.sectors).sort();
    expect(sectorCodes).toEqual(EXPECTED_SECTORS.sort());
  });

  test('all 11 sectors have non-empty names', () => {
    if (!data) return;
    for (const code of EXPECTED_SECTORS) {
      expect(data.sectors[code].name.length).toBeGreaterThan(0);
    }
  });

  test('all 5 indices are present', () => {
    if (!data) return;
    const indexCodes = Object.keys(data.indices).sort();
    expect(indexCodes).toEqual(EXPECTED_INDICES.sort());
  });

  test('each index has all 4 timeframes', () => {
    if (!data) return;
    for (const idx of EXPECTED_INDICES) {
      const timeframes = Object.keys(data.indices[idx]).sort();
      expect(timeframes).toEqual(EXPECTED_TIMEFRAMES.sort());
    }
  });

  test('sector count matches expected (11 GICS sectors)', () => {
    if (!data) return;
    expect(Object.keys(data.sectors)).toHaveLength(11);
  });

  test('index count matches expected (5)', () => {
    if (!data) return;
    expect(Object.keys(data.indices)).toHaveLength(5);
  });
});
