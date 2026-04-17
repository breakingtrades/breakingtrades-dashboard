# Testing

> Last updated: 2026-04-17

BreakingTrades Dashboard has two test surfaces:

- **JavaScript (Jest)** — front-end + Node helpers, under `tests/*.test.js`
- **Python (pytest)** — data pipeline scripts under `scripts/`, tests under `tests/test_*.py`

Both live in the same `tests/` directory.

## Running

```bash
cd breakingtrades-dashboard

# Python (data pipeline)
python3 -m pytest tests/ -v

# JavaScript (front-end + node)
cd tests && npm test
```

All tests should pass in <2 seconds combined. If they don't, don't push.

## Python Test Coverage

### `tests/test_update_regime.py` (12 tests)

Covers `scripts/update-regime.py`, which produces `data/regime.json` for the
Research page.

**`compute_sp_vs_d200` math (5):**
- `test_sp_vs_d200_above_5pct` — regression for the Apr 16 bug: SPY 701.68
  with 200-SMA 662.28 must return `(score=90, pct=+5.95, label="above")`
- `test_sp_vs_d200_below_d200` — negative case
- `test_sp_vs_d200_missing_gspc_returns_no_data` — missing `^GSPC` ticker
- `test_sp_vs_d200_missing_sma_returns_no_sma` — watchlist without `sma200`
- `test_sp_vs_d200_missing_spy_price_returns_no_data` — missing `SPY` ticker

**`assign_signal` carry-forward (7):**
- `test_assign_signal_fresh_write` — normal path
- `test_assign_signal_carries_forward_on_no_data` — stale sentinel + good
  prior → carry forward `{score, value, signal}`, stamp `stale: True`
- `test_assign_signal_carries_forward_on_no_sma` — same for `no_sma`
- `test_assign_signal_no_carry_when_no_prior` — first-ever run fallback
- `test_assign_signal_no_carry_when_prior_also_stale` — don't chain garbage
- `test_assign_signal_no_carry_when_prior_value_zero` — prior `value=0`
  isn't treated as "good data"
- `test_assign_signal_fresh_result_clears_stale` — recovery run clears
  the `stale` flag

### `tests/test_update_prices.py` (3 tests)

Covers `scripts/update-prices.py` safety guards that prevent `prices.json`
from being overwritten with empty/degraded yfinance output.

- `test_empty_result_keeps_prior_file` — simulated full yfinance outage
  (0 tickers) → prior file left untouched
- `test_partial_fetch_merges_with_prior` — simulated partial outage (1 of
  4 tickers) → fresh values merged into prior, `source` flagged
  `yfinance+carryforward`
- `test_full_fetch_no_carryforward_flag` — normal path, plain
  `source: "yfinance"`

Tests use `monkeypatch` + `unittest.mock.patch` on `yfinance.download` —
**no network calls**.

## Writing New Tests

### Python

1. Create `tests/test_<script_name>.py`
2. Scripts have hyphenated filenames (`update-regime.py`), so load via
   `importlib` in a module-scoped fixture:

   ```python
   import importlib.util
   from pathlib import Path

   SCRIPT = Path(__file__).resolve().parent.parent / "scripts" / "update-regime.py"

   @pytest.fixture(scope="module")
   def ur():
       spec = importlib.util.spec_from_file_location("update_regime", SCRIPT)
       mod = importlib.util.module_from_spec(spec)
       spec.loader.exec_module(mod)
       return mod
   ```

3. Never call yfinance / IB / any network API in tests. Use `monkeypatch`
   to inject fixtures or `unittest.mock.patch` for the `yfinance` module.

### JavaScript

See existing `tests/*.test.js` for pattern. Jest config in
`tests/package.json`.

**Signals page (`tests/signals.test.js`, 13 tests):**
- Loads `js/pages/signals.js` inside a `vm.Context` scaffold so the IIFE
  registers on a stub `BT` object, then pulls the `_mapWatchlistToSignal`,
  `_buildStatusReason`, `_biasTip` helpers off `BT.pages.signals`.
- Covers: null/broken input, canonical mapping, safe defaults, tooltip
  strings, and a live-data integration test that reads the real
  `data/watchlist.json` for MSFT and asserts no logic contradictions
  (e.g. "exit + bull + price above SMA20").
- This guards against the class of bug where the hardcoded
  `TICKERS` array shipped labels that contradicted the actual price state.

## Philosophy

The Apr 16 "0% above D200" bug would have been caught by either:

1. A unit test asserting `compute_sp_vs_d200` with realistic SPY/SMA values
   returns > 5 when the ratio > 5%
2. A guard test that `update-prices.py` never writes an empty `tickers` dict

Both exist now. Prefer tests that mirror **what the dashboard UI asserts**
rather than white-box internals. If a number gets rendered in the UI and
you spot-check it, there should be a test asserting the pipeline produces
that number.
