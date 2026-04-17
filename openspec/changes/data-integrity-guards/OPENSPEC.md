# Data Integrity Guards — OpenSpec

> Created: 2026-04-17
> Status: **Implemented**
> Priority: **High**
> Triggered by: Apr 16/17 — Research page "S&P > 5% above D200" showed 0.00 / unmet while SPY was actually +5.95% above

## Problem

On April 16, 2026 the Research page's "Transition Signals" section showed
`S&P > 5% above D200: 0.00 → 5.00, unmet` while SPY was trading at $701.68
against its 200-day SMA of $662.28 (+5.95% above — condition should have
been **met**). The rest of the Research page showed plausible values for
other signals, so the bug was invisible until spot-checked.

## Root Cause (3 tiers)

1. **Tier 1 — Display bug**: `regime.json` had `components.sp_vs_d200.value = 0`
   and `signal = "no_data"`. The dashboard rendered this as `0.00 → 5.00 unmet`,
   indistinguishable from a real "market below its 200-day" reading.

2. **Tier 2 — Stale write in `update-regime.py`**: Every `compute_*` signal
   function follows the pattern `if not data: return 50, 0, 'no_data'`. When
   the input prices dict is empty/degraded, a fresh `0` overwrites whatever
   good value was in `regime.json` from the previous run.

3. **Tier 3 — Root cause in `update-prices.py`**: When `yfinance.download()`
   fails entirely (rate limit, network blip, API outage), the script silently
   writes `{"tickers": {}}` over the last good `prices.json`. This cascades
   through every downstream script that reads prices (regime, breadth, EM,
   expected-moves) and produces the `value = 0` garbage in Tier 2.

## Improvements

### 1. Carry-forward guard in `update-regime.py` ✅
- New helper `assign_signal(signals, key, result, weight, prev_components)`
- On `no_data` / `no_sma` sentinel return with a valid prior value in
  the previous `regime.json`: carry the prior `{score, value, signal}`
  forward and stamp `stale: True` on the component
- Log `[warn] {key}: compute returned no_data; carrying forward …` so
  transient failures are visible in cron output
- Applied to all 15 regime signals (not just `sp_vs_d200`)

### 2. Empty-write protection in `update-prices.py` ✅
- If `yfinance` returns 0 tickers → **refuse to write**, keep prior file
- If fetch returns `<50%` of expected tickers → merge fresh values into
  prior tickers dict, flag `source = "yfinance+carryforward"` for
  observability
- Normal path (full fetch) unchanged, still writes fresh data with
  `source = "yfinance"`

### 3. Regression tests ✅
- `tests/test_update_regime.py` — 12 tests
  - 5 for `compute_sp_vs_d200` math (including the exact Apr 16 scenario:
    SPY 701.68 vs 662.28 SMA must return +5.95% / "above" / score 90)
  - 7 for `assign_signal` carry-forward behavior across all edge cases
- `tests/test_update_prices.py` — 3 tests
  - Empty yfinance result → prior file preserved
  - Partial fetch → merged with prior + carryforward flag
  - Full fetch → normal write, no flag

Total: **15 tests, 0.79s runtime**, all passing.

## Files Changed

```
scripts/update-regime.py         +32 / -14   # assign_signal helper + all 15 signals
scripts/update-prices.py         +24 / -1    # empty/partial write guards
tests/test_update_regime.py      +152       # new
tests/test_update_prices.py      +130       # new
data/regime.json                 regenerated  # fresh sp_vs_d200 = 5.95
```

## Run Tests

```bash
cd breakingtrades-dashboard
python3 -m pytest tests/ -v
```

## Future Hardening (Not Yet Implemented)

| Item | Priority | Notes |
|------|----------|-------|
| Surface `stale: True` badge in Research UI | Low | JSON flag exists, UI doesn't render it yet |
| Pre-push git hook running `pytest tests/` | Medium | Would have caught the original bug before it shipped |
| Apply carry-forward pattern to `update-breadth.py`, `update-expected-moves.py` | Medium | Same `return None` pattern — less impact, but worth consistent treatment |
| Watchlist.js — don't render missing `change` as green | Low | Cosmetic; unlikely to fire now that prices.json is protected |

## Verification

Apr 17 00:30 ET: re-ran `python3 scripts/update-regime.py`. Output:

```
sp_vs_d200: {'score': 90, 'value': 5.95, 'signal': 'above', 'weight': 8}
Transition: BULL → STRONG_BULL, 2 of 3 met
  F&G > 65:              62.2  unmet
  Breadth > 65%:         66.8  met
  S&P > 5% above D200:   5.95  met
```

Also verified the fallback by deleting `^GSPC`/`SPY` from `prices.json` and
re-running: carry-forward fired as expected, logged `[warn]`, preserved the
5.95 value. Restoring prices cleared the `stale` flag on next run.
