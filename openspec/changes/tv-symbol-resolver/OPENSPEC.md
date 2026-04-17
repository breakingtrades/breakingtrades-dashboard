# Change: tv-symbol-resolver

**Status:** Implemented
**Commit:** _(pending)_
**Date:** 2026-04-17

## Problem
Each page (`expected-moves.js`, `watchlist.js`, `signals.js`) maintained its own hardcoded `EXCHANGE_MAP` mapping ticker → exchange, then concatenated `EXCHANGE:SYMBOL` for TradingView widgets. Three problems:

1. **Maps drifted** — NBIS, BILI, SMCI etc. were added to some pages and forgotten on others.
2. **Default was wrong** — unknown tickers fell back to `'NYSE'`, which breaks for every Nasdaq ADR (`NYSE:BILI` = "No matching symbol").
3. **Not scalable** — every new ticker needed a code edit across 3 files.

## Solution
New shared utility `js/lib/tv-symbol.js` exposes `BT.tvSymbol(symbol)`:

- Small **HINTS** table for the handful of cases where TV needs help (indices, ETFs with ambiguous venues).
- **Default behavior: return the bare symbol.** TradingView resolves the exchange automatically for every listed ticker.
- All 3 pages + `detail-modal.js` delegate to `BT.tvSymbol()`.

Net effect: new tickers (NBIS, BILI, future AI names) Just Work™ without code changes.

## Files Changed
- `js/lib/tv-symbol.js` (new, 56 LOC)
- `js/pages/expected-moves.js` — EXCHANGE_MAP trimmed to indices/ETFs; uses `BT.tvSymbol()`
- `js/pages/watchlist.js` — same
- `js/pages/signals.js` — same; passes `tvSymbol` to detail modal
- `js/components/detail-modal.js` — accepts `options.tvSymbol`, falls back to `BT.tvSymbol()` then legacy `exchange` param (backward compatible)
- `index.html` — loads `js/lib/tv-symbol.js`
- `tests/tv-symbol.test.js` (new, 5 tests)

## Behavior
| Input | Before | After |
|---|---|---|
| `NBIS` | `NYSE:NBIS` → ❌ | `NBIS` → ✅ TV resolves to NASDAQ |
| `BILI` | `NYSE:BILI` → ❌ | `BILI` → ✅ TV resolves to NASDAQ |
| `SPY` | `AMEX:SPY` → ✅ | `AMEX:SPY` → ✅ (hinted) |
| `QQQ` | `NASDAQ:QQQ` → ✅ | `NASDAQ:QQQ` → ✅ (hinted) |
| New ticker X | `NYSE:X` → likely ❌ | `X` → ✅ TV auto-resolves |

## Tests
- 5 new unit tests for `BT.tvSymbol`
- Full suite: 123/123 pass
