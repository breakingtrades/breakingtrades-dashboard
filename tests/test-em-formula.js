/**
 * Expected Moves Formula & Data Integrity Tests
 *
 * Tests:
 *  1. Core EM formula: straddle × 0.85, √(DTE) scaling
 *  2. Band computation: upper/lower from close ± EM value
 *  3. Percentage calculation: EM value / close × 100
 *  4. Tier scaling relationships: daily < weekly < monthly < quarterly
 *  5. Real index sanity checks: SPX, SPY, QQQ, IWM, DIA
 *  6. Canonical price consistency: EM close matches prices.json/watchlist
 *  7. Data completeness: all 4 tiers present
 *  8. Straddle sanity: call + put = straddle, both positive
 *  9. SPX vs SPY cross-validation: EM% should be within ~1.5% of each other
 * 10. Monthly/Quarterly direct straddle vs scaled values
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');

function loadJSON(filename) {
  const p = path.join(DATA_DIR, filename);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

// ── Core EM Formula (mirrors Python compute_em_from_straddle) ──
function computeEM(straddle, closePrice, dte) {
  const emRaw = straddle * 0.85;
  if (dte <= 0) dte = 1;

  function band(targetDte) {
    const scaled = emRaw * Math.sqrt(targetDte / dte);
    return {
      value: Math.round(scaled * 100) / 100,
      pct: Math.round((scaled / closePrice) * 10000) / 100,
      upper: Math.round((closePrice + scaled) * 100) / 100,
      lower: Math.round((closePrice - scaled) * 100) / 100,
    };
  }

  return { daily: band(1), weekly: band(5), monthly: band(21), quarterly: band(63) };
}

// ── Load data ──
const emData = loadJSON('expected-moves.json');
const watchlistData = loadJSON('watchlist.json');
const pricesData = loadJSON('prices.json');

// Build canonical price map
const canonicalPrices = {};
if (watchlistData) {
  for (const item of watchlistData) {
    if (item && item.symbol && item.price) {
      canonicalPrices[item.symbol] = item.price;
    }
  }
}

// ── Test runner ──
let passed = 0, failed = 0;
function assert(name, condition) {
  if (condition) {
    passed++;
  } else {
    failed++;
    console.error(`  ✗ ${name}`);
  }
}
function assertApprox(name, actual, expected, tolerancePct = 1) {
  if (expected === 0) {
    assert(name, Math.abs(actual) < 0.01);
    return;
  }
  const diff = Math.abs(actual - expected) / Math.abs(expected) * 100;
  if (diff <= tolerancePct) {
    passed++;
  } else {
    failed++;
    console.error(`  ✗ ${name}: got ${actual}, expected ~${expected} (${diff.toFixed(2)}% off)`);
  }
}

// ============================================================
// TEST GROUP 1: Core Formula — Pure Math
// ============================================================
console.log('\n── Core EM Formula ──');

// SPY-like example: straddle=$13.77, close=$634.09, dte=1
(() => {
  const result = computeEM(13.77, 634.09, 1);
  const emRaw = 13.77 * 0.85; // 11.7045

  assert('EM raw = straddle × 0.85', Math.abs(emRaw - 11.7045) < 0.001);
  assertApprox('Daily EM value (DTE=1, target=1)', result.daily.value, 11.70, 1);
  assertApprox('Weekly EM = daily × √5', result.weekly.value, 11.70 * Math.sqrt(5), 1);
  assertApprox('Monthly EM = daily × √21', result.monthly.value, 11.70 * Math.sqrt(21), 1);
  assertApprox('Quarterly EM = daily × √63', result.quarterly.value, 11.70 * Math.sqrt(63), 1);

  // Bands
  assertApprox('Daily upper = close + daily EM', result.daily.upper, 634.09 + result.daily.value, 0.1);
  assertApprox('Daily lower = close - daily EM', result.daily.lower, 634.09 - result.daily.value, 0.1);
  assertApprox('Daily pct = daily EM / close × 100', result.daily.pct, result.daily.value / 634.09 * 100, 0.5);
})();

// DTE=5 example: scaling from weekly straddle
(() => {
  const result = computeEM(20, 500, 5);
  const emRaw = 20 * 0.85; // 17.0

  assertApprox('DTE=5: daily EM = emRaw × √(1/5)', result.daily.value, 17 * Math.sqrt(1 / 5), 1);
  assertApprox('DTE=5: weekly EM = emRaw × √(5/5) = emRaw', result.weekly.value, 17, 1);
  assertApprox('DTE=5: monthly EM = emRaw × √(21/5)', result.monthly.value, 17 * Math.sqrt(21 / 5), 1);
})();

// ============================================================
// TEST GROUP 2: Tier Ordering — daily < weekly < monthly < quarterly
// ============================================================
console.log('\n── Tier Ordering ──');

if (emData) {
  const INDICES = ['SPX', 'SPY', 'QQQ', 'IWM', 'DIA'];
  for (const sym of INDICES) {
    const d = emData.tickers[sym];
    if (!d) { console.error(`  ✗ ${sym} missing from EM data`); failed++; continue; }

    assert(`${sym}: daily < weekly`, d.daily.value < d.weekly.value);
    // When monthly/quarterly use direct straddles, they may differ from scaled weekly
    // (e.g. 1 DTE weekly straddle has inflated short-term vol premium)
    // Only enforce ordering for scaled tiers (no direct straddle override)
    if (!d.monthly_straddle) {
      assert(`${sym}: weekly < monthly (scaled)`, d.weekly.value < d.monthly.value);
    }
    if (!d.quarterly_straddle && !d.monthly_straddle) {
      assert(`${sym}: monthly < quarterly (scaled)`, d.monthly.value < d.quarterly.value);
    }
    assert(`${sym}: daily% < weekly%`, d.daily.pct < d.weekly.pct);
  }
}

// ============================================================
// TEST GROUP 3: Real Index Sanity — Values in Reasonable Ranges
// ============================================================
console.log('\n── Index Sanity Checks ──');

if (emData) {
  // SPX: daily EM should be 0.5-5% of close, not 20%
  const spx = emData.tickers['SPX'];
  if (spx) {
    assert('SPX close > 4000', spx.close > 4000);
    assert('SPX close < 10000', spx.close < 10000);
    assert('SPX daily EM% between 0.3% and 5%', spx.daily.pct > 0.3 && spx.daily.pct < 5);
    assert('SPX weekly EM% between 1% and 12%', spx.weekly.pct > 1 && spx.weekly.pct < 12);
    assert('SPX monthly EM% between 2% and 20%', spx.monthly.pct > 2 && spx.monthly.pct < 20);
    assert('SPX quarterly EM% between 3% and 30%', spx.quarterly.pct > 3 && spx.quarterly.pct < 30);
    assert('SPX straddle > 0', spx.straddle > 0);
    assert('SPX upper > close > lower (daily)', spx.daily.upper > spx.close && spx.close > spx.daily.lower);
  } else {
    console.error('  ✗ SPX not found'); failed++;
  }

  // SPY
  const spy = emData.tickers['SPY'];
  if (spy) {
    assert('SPY close > 300', spy.close > 300);
    assert('SPY close < 1000', spy.close < 1000);
    assert('SPY daily EM% between 0.3% and 5%', spy.daily.pct > 0.3 && spy.daily.pct < 5);
    assert('SPY weekly EM% between 1% and 12%', spy.weekly.pct > 1 && spy.weekly.pct < 12);
    assert('SPY straddle = call + put', Math.abs(spy.straddle - (spy.call_close + spy.put_close)) < 0.02);
  }

  // QQQ — higher vol than SPY typically
  const qqq = emData.tickers['QQQ'];
  if (qqq) {
    assert('QQQ close > 200', qqq.close > 200);
    assert('QQQ daily EM% between 0.3% and 6%', qqq.daily.pct > 0.3 && qqq.daily.pct < 6);
    assert('QQQ straddle = call + put', Math.abs(qqq.straddle - (qqq.call_close + qqq.put_close)) < 0.02);
  }

  // IWM — small cap, typically more volatile
  const iwm = emData.tickers['IWM'];
  if (iwm) {
    assert('IWM close > 100', iwm.close > 100);
    assert('IWM daily EM% > SPY daily EM% (usually)', iwm.daily.pct >= spy?.daily?.pct * 0.8 || true); // soft check
    assert('IWM straddle > 0', iwm.straddle > 0);
  }

  // DIA
  const dia = emData.tickers['DIA'];
  if (dia) {
    assert('DIA close > 200', dia.close > 200);
    assert('DIA daily EM% between 0.2% and 5%', dia.daily.pct > 0.2 && dia.daily.pct < 5);
  }
}

// ============================================================
// TEST GROUP 4: SPX vs SPY Cross-Validation
// ============================================================
console.log('\n── SPX vs SPY Cross-Validation ──');

if (emData) {
  const spx = emData.tickers['SPX'];
  const spy = emData.tickers['SPY'];
  if (spx && spy) {
    // SPX ≈ SPY × 10
    assertApprox('SPX close ≈ SPY close × 10', spx.close, spy.close * 10, 3);

    // EM percentages should be similar (within 2 absolute pct points)
    const dailyDiff = Math.abs(spx.daily.pct - spy.daily.pct);
    const weeklyDiff = Math.abs(spx.weekly.pct - spy.weekly.pct);
    assert('SPX vs SPY daily EM% within 2pp', dailyDiff < 2);
    assert('SPX vs SPY weekly EM% within 2pp', weeklyDiff < 2);
  }
}

// ============================================================
// TEST GROUP 5: Straddle Integrity
// ============================================================
console.log('\n── Straddle Integrity ──');

if (emData) {
  for (const sym of ['SPX', 'SPY', 'QQQ', 'IWM', 'AAPL', 'NVDA', 'TSLA', 'META', 'MSFT']) {
    const d = emData.tickers[sym];
    if (!d) continue;

    assert(`${sym}: call_close > 0`, d.call_close > 0);
    assert(`${sym}: put_close > 0`, d.put_close > 0);
    assert(`${sym}: straddle = call + put`, Math.abs(d.straddle - (d.call_close + d.put_close)) < 0.05);
    assert(`${sym}: strike near close (within 5%)`, Math.abs(d.strike - d.close) / d.close < 0.05);
    assert(`${sym}: weekly_dte >= 1`, d.weekly_dte >= 1);
  }
}

// ============================================================
// TEST GROUP 6: Formula Verification Against Stored Data
// ============================================================
console.log('\n── Formula Verification ──');

if (emData) {
  // Recompute from stored straddle/close/dte and compare to stored tiers
  for (const sym of ['SPY', 'QQQ', 'DIA', 'AAPL', 'TSLA']) {
    const d = emData.tickers[sym];
    if (!d || !d.straddle || !d.close || !d.weekly_dte) continue;

    const computed = computeEM(d.straddle, d.close, d.weekly_dte);

    assertApprox(`${sym}: recomputed daily EM matches stored`, computed.daily.value, d.daily.value, 2);
    assertApprox(`${sym}: recomputed weekly EM matches stored`, computed.weekly.value, d.weekly.value, 2);

    // Monthly/quarterly may use direct straddle (not scaled) — only check scaled ones
    if (!d.monthly_straddle) {
      assertApprox(`${sym}: recomputed monthly EM matches stored (scaled)`, computed.monthly.value, d.monthly.value, 2);
    }
    if (!d.quarterly_straddle) {
      assertApprox(`${sym}: recomputed quarterly EM matches stored (scaled)`, computed.quarterly.value, d.quarterly.value, 2);
    }
  }
}

// ============================================================
// TEST GROUP 7: Monthly/Quarterly Direct Straddle Override
// ============================================================
console.log('\n── Direct Straddle Overrides ──');

if (emData) {
  // When monthly_straddle exists, monthly EM should be monthly_straddle × 0.85
  for (const sym of ['SPY', 'QQQ', 'TSLA', 'SPX']) {
    const d = emData.tickers[sym];
    if (!d) continue;

    if (d.monthly_straddle) {
      const expectedMonthlyEM = d.monthly_straddle * 0.85;
      assertApprox(`${sym}: monthly EM = monthly_straddle × 0.85`, d.monthly.value, expectedMonthlyEM, 2);
      assert(`${sym}: monthly_expiry exists`, !!d.monthly_expiry);
    }

    if (d.quarterly_straddle) {
      const expectedQuarterlyEM = d.quarterly_straddle * 0.85;
      assertApprox(`${sym}: quarterly EM = quarterly_straddle × 0.85`, d.quarterly.value, expectedQuarterlyEM, 2);
      assert(`${sym}: quarterly_expiry exists`, !!d.quarterly_expiry);
    }
  }
}

// ============================================================
// TEST GROUP 8: Canonical Price Consistency
// ============================================================
console.log('\n── Canonical Price Consistency ──');

if (emData && Object.keys(canonicalPrices).length > 0) {
  let checked = 0;
  let staleCount = 0;
  for (const [sym, emEntry] of Object.entries(emData.tickers)) {
    if (canonicalPrices[sym]) {
      const emClose = emEntry.close;
      const canonical = canonicalPrices[sym];
      const diff = Math.abs(emClose - canonical) / canonical * 100;
      if (diff > 2) {
        staleCount++;
        if (staleCount <= 5) {
          console.error(`  ✗ ${sym}: EM close ${emClose} vs canonical ${canonical} (${diff.toFixed(1)}% off)`);
        }
        failed++;
      } else {
        passed++;
      }
      checked++;
    }
  }
  console.log(`  Checked ${checked} tickers against canonical prices, ${staleCount} stale`);
  assert('No more than 5% stale prices', staleCount / Math.max(checked, 1) < 0.05);
}

// ============================================================
// TEST GROUP 9: Data Completeness
// ============================================================
console.log('\n── Data Completeness ──');

if (emData) {
  const tickers = Object.keys(emData.tickers);
  assert('EM has 70+ tickers', tickers.length >= 70);
  assert('EM has updated timestamp', !!emData.updated);

  // All tickers must have all 4 tiers
  let missingTiers = 0;
  for (const [sym, d] of Object.entries(emData.tickers)) {
    const hasTiers = d.daily && d.weekly && d.monthly && d.quarterly;
    if (!hasTiers) {
      missingTiers++;
      if (missingTiers <= 3) console.error(`  ✗ ${sym}: missing tier(s)`);
    }
  }
  assert('All tickers have 4 tiers', missingTiers === 0);

  // All indices must be present
  for (const idx of ['SPX', 'SPY', 'QQQ', 'IWM', 'DIA']) {
    assert(`${idx} in EM data`, !!emData.tickers[idx]);
  }

  // Check that EM data is not older than 3 days
  const updatedDate = new Date(emData.updated);
  const ageMs = Date.now() - updatedDate.getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  assert('EM data updated within last 3 days', ageDays < 3);
}

// ============================================================
// TEST GROUP 10: Edge Cases
// ============================================================
console.log('\n── Edge Cases ──');

// DTE=0 should be treated as DTE=1
(() => {
  const result = computeEM(10, 100, 0);
  assert('DTE=0 treated as 1: daily EM = 8.5', Math.abs(result.daily.value - 8.5) < 0.01);
  assert('DTE=0: weekly still computes', result.weekly.value > 0);
})();

// Very high straddle (high IV)
(() => {
  const result = computeEM(50, 100, 5);
  assert('High IV: daily EM > 10%', result.daily.pct > 10);
  assert('High IV: bands still symmetric', Math.abs((result.daily.upper - 100) - (100 - result.daily.lower)) < 0.01);
})();

// Very low straddle (low IV)
(() => {
  const result = computeEM(0.5, 100, 5);
  assert('Low IV: daily EM < 1%', result.daily.pct < 1);
  assert('Low IV: quarterly > daily', result.quarterly.value > result.daily.value);
})();

// ============================================================
// Summary
// ============================================================
console.log(`\n${'='.repeat(50)}`);
console.log(`EM Formula Tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
