# Quarterly EM History — Spec

> Status: **Implemented** · Date: 2026-04-03

## Why

Options-implied expected moves are forward-looking projections. Without historical validation, there's no way to know:
- How accurate the EM projections actually are over time
- Whether a ticker's IV consistently over- or under-prices moves
- How the current quarter's EM range compares to past quarters

This feature backfills 4 quarters (Q1–Q4 2025) of EM data from IB historical implied volatility and displays it in the ticker detail modal, showing projected ranges alongside actual outcomes.

## What Changes

### 1. New Data File: `data/em-quarterly-history.json`

**Source:** IB Gateway historical IV (`OPTION_IMPLIED_VOLATILITY` bars) + historical price bars at each quarter-end date.

**Schema:**
```json
{
  "updated": "ISO-8601",
  "source": "ib_historical_iv",
  "tickers": {
    "AAPL": {
      "quarters": [
        {
          "quarter": "Q1-2025",
          "date": "2025-03-31",
          "close": 222.13,
          "iv": 29.17,
          "quarterly": {
            "em": 20.70, "pct": 9.32,
            "upper": 242.83, "lower": 201.43,
            "dte": 81, "expiry": "20250620"
          },
          "monthly": {
            "em": 9.48, "pct": 4.27,
            "upper": 231.61, "lower": 212.65,
            "dte": 17, "expiry": "20250417"
          },
          "outcome": {
            "actual_close": 205.17,
            "actual_date": "2025-06-30",
            "status": "within",
            "deviation_pct": -7.63
          }
        }
      ],
      "accuracy": { "within": 2, "total": 3, "pct": 67 }
    }
  },
  "summary": {
    "total_tickers": 78,
    "quarters": ["Q1-2025", "Q2-2025", "Q3-2025", "Q4-2025"],
    "overall_accuracy": { "within": 124, "total": 220, "pct": 56.4 }
  }
}
```

**EM formula:** `close × IV × √(DTE/365) × (2/√(2π)) × 0.85` — same `straddle × 0.85` method used in live EM, but derived from aggregate IV instead of specific ATM straddle prices (historical straddles not available via IB bars).

**Quarter definitions:**
| Quarter | End Date | Q Expiry (DTE) | M Expiry (DTE) |
|---------|----------|----------------|----------------|
| Q1-2025 | 2025-03-31 | 20250620 (81d) | 20250417 (17d) |
| Q2-2025 | 2025-06-30 | 20250919 (81d) | 20250718 (18d) |
| Q3-2025 | 2025-09-30 | 20251219 (80d) | 20251017 (17d) |
| Q4-2025 | 2025-12-31 | 20260320 (79d) | 20260116 (16d) |

**Outcome logic:** For each quarter, the "outcome" is the close price at the *next* quarter-end. Q4-2025 has no outcome yet (current quarter shows live price instead).

**Coverage:** 75–78 tickers per quarter (96–97%). Missing tickers vary per quarter (commodity ETFs like USO/SLV and random IB timeouts). Every ticker has data for at least 3 of 4 quarters.

**Overall accuracy:** 56.4% of quarterly EM ranges contained the actual outcome — consistent with 1σ options pricing (~68% theoretical, reduced by the 0.85 discount factor and quarter-end-to-quarter-end measurement vs actual expiry).

### 2. EM Detail Modal — Quarterly History Section

Added below the existing tier cards (Daily/Weekly/Monthly/Quarterly) in the ticker detail modal (`openEMDetail()`).

**Visual design:**
- **Header:** "📅 Quarterly EM History" with accuracy badge (e.g., "2/3 within range (67%)")
- **Price scale bar** spanning min→max across all quarters (unified for comparison)
- **Per-quarter row:**
  - Left: Quarter label (Q1-2025) + date + IV%
  - Center: Horizontal range bar on unified scale
    - Teal gradient bar = projected EM range (lower → upper)
    - White dot = quarter-end close (anchor price)
    - Green diamond ✓ = outcome within range
    - Red diamond ✗ = outcome outside range
    - Gold diamond = current price (latest quarter, no outcome yet)
  - Below bar: low bound | close ±pct | outcome | high bound
- **Legend** at bottom explaining marker types
- **Responsive:** stacks vertically on mobile (≤768px)

**Behavior:**
- Renders only when `em-quarterly-history.json` loads successfully
- Graceful degradation: if file missing or ticker not in history, section is omitted (no error)
- Lucide icons refreshed after render via `lucide.createIcons()`

### 3. Files Modified

| File | Change |
|------|--------|
| `data/em-quarterly-history.json` | **NEW** — 78 tickers × 4 quarters, IB historical IV |
| `js/pages/expected-moves.js` | Added `emHistoryData` var, loads new JSON in `loadData()`, new `buildQuarterlyHistory()` function, called from `openEMDetail()` |
| `css/expected-moves.css` | New `.em-qh-*` class family (section, header, scale, row, track, range, markers, values, legend) + mobile responsive |

### 4. CSS Classes (`.em-qh-*` namespace)

| Class | Purpose |
|-------|---------|
| `.em-qh-section` | Outer container, border + bg |
| `.em-qh-header` | Flex row: title + accuracy badge |
| `.em-qh-title` | Uppercase label with Lucide icon |
| `.em-qh-scale` | Min/max price labels above chart |
| `.em-qh-row` | Per-quarter flex row (label + bar) |
| `.em-qh-label` | Quarter name + date + IV |
| `.em-qh-bar-container` | Wraps track + values |
| `.em-qh-track` | Relative container for range + markers |
| `.em-qh-range` | Gradient bar (teal→red tint) |
| `.em-qh-marker` | Absolute-positioned marker wrapper |
| `.em-qh-dot` | White circle (quarter-end close) |
| `.em-qh-diamond` | Rotated square (outcome/current) |
| `.em-qh-values` | Flex row below track (lo/close/outcome/hi) |
| `.em-qh-legend` | Bottom legend strip |

All sizing uses CSS variables (`var(--space-*)`, `var(--font-size-*)`, `var(--border)`, etc.) per design system.

## Pipeline Integration

**Script:** `scripts/capture-quarterly-em.py`
- Standalone: `python3 scripts/capture-quarterly-em.py [--quarter Q1-2026] [--dry-run]`
- Auto-detects most recently completed quarter if `--quarter` omitted
- Requires IB Gateway on port 4002

**EOD integration:** `scripts/eod-update.sh` Step 7/7
- Runs automatically on first 3 trading days after each quarter end (Mar 31, Jun 30, Sep 30, Dec 31)
- Only executes if IB Gateway is running (checks port 4002)
- Skips silently when IB unavailable or not a post-quarter-end day

**Quarter definitions** are hardcoded through Q4-2026 in the script. Add new years by appending to the `QUARTERS` dict.

## Test Plan

- [x] `node -c js/pages/expected-moves.js` — syntax valid
- [x] CSS brace count balanced (95/95)
- [x] Data file serves correctly (78 tickers, 206KB)
- [x] Per-ticker accuracy math verified (NVDA: 1/3 = 33%, correct)
- [x] Outcome status logic verified (Q1→Q2 AAPL: $222→$205, within $201-$243 = ✓)
- [x] Graceful fallback when history file missing (returns empty string, no render)
- [ ] Visual verification (browser timeout during dev — verify on deploy)
