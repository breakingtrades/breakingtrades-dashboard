# Design: Watchlist Export Engine

## Overview
Single Python script that bridges existing BreakingTrades data → dashboard-ready JSON.

## Data Sources (all existing, no new downloads)

| Source | Location | What |
|--------|----------|------|
| Watchlist snapshot | `~/projects/breakingtrades/fxevolution/watchlists/fxevolution-watchlist-YYYY-MM-DD.txt` | Latest scraped watchlist with sections |
| OHLCV data | `~/projects/breakingtrades/data/{ticker}_{tf}.csv` | 5 timeframes: 1h, 4h, daily, weekly, monthly |
| Tom agent config | `~/projects/breakingtrades/agents/tom-fxevolution/` | AGENT.md, RULES.json, SOUL.md |
| Screener | `~/projects/breakingtrades/screener.py` | Existing EMA analysis (can import) |

## Moving Average Configuration

### Tom's actual system (not generic EMA 8/21/50):
- **SMA 20** — Primary. "King for exits." 15+ years using it.
- **SMA 50** — Trend direction.
- **Weekly SMA 20** — "Most important weekly level." Mean reversion zone.
- **SMA 100/150/200** — Longer-term structure (weekly/monthly charts).

### Bias Determination Rules:
```python
def determine_bias(price, sma20, sma50, weekly_sma20):
    """
    BULLISH:  Price > SMA20 > SMA50, AND price > Weekly SMA20
    BEARISH:  Price < SMA20 < SMA50, AND price < Weekly SMA20
    MIXED:    Everything else
    
    STRONG BULL: All MAs stacked + price near highs
    WEAK BULL:   Daily bullish but price testing SMA20
    """
```

### Exit Signal Detection:
- Daily close below SMA 20 = EXIT signal (Tom's #1 rule)
- Track consecutive closes below SMA 20 (1 = warning, 2+ = confirmed exit)

## Setup Status Engine

### State Machine:
```
WATCHING ──→ APPROACHING ──→ TRIGGERED ──→ ACTIVE
                                              ↓
                                     TRAILING / STOPPED / TARGET HIT
```

### Computation:
```python
def compute_setup_status(ticker_data, setup_config):
    price = current_price
    entry_low, entry_high = setup_config['entry_zone']
    stop = setup_config['stop']
    t1, t2 = setup_config['target1'], setup_config['target2']
    
    distance_to_entry = (price - entry_high) / price * 100
    
    if price <= stop:
        return 'STOPPED_OUT'
    elif price >= t2:
        return 'HIT_T2'
    elif price >= t1:
        return 'TRAILING'  # raise stop
    elif entry_low <= price <= entry_high:
        return 'TRIGGERED'
    elif distance_to_entry <= 2.0:  # within 2%
        return 'APPROACHING'
    else:
        return 'WATCHING'
```

### Trailing Stop Logic:
- Price reaches 50% to T1 → stop moves to breakeven
- Price reaches T1 → stop moves to 50% above entry
- Price reaches T2 → close position

## Output JSON Schema

### `data/watchlist.json`
```json
{
  "generated": "2026-03-17T14:00:00Z",
  "source_date": "2026-03-17",
  "sections": [
    {
      "name": "Quality Stocks",
      "tickers": [
        {
          "symbol": "D",
          "name": "Dominion Energy",
          "price": 63.60,
          "sma20": 63.14,
          "sma50": 61.96,
          "weekly_sma20": 62.50,
          "rsi14": 58.3,
          "bias": "BULLISH",
          "bias_strength": "STRONG",
          "pct_from_high": -4.9,
          "six_mo_high": 66.86,
          "six_mo_low": 55.26,
          "exit_signal": false,
          "days_below_sma20": 0
        }
      ]
    }
  ]
}
```

### `data/setups.json`
```json
{
  "generated": "2026-03-17T14:00:00Z",
  "setups": [
    {
      "symbol": "D",
      "status": "WATCHING",
      "bias": "BULLISH",
      "entry_zone": [62.50, 63.00],
      "stop": 61.50,
      "target1": 66.86,
      "target2": 70.00,
      "risk_reward": "1:3",
      "current_price": 63.60,
      "distance_to_entry_pct": 0.94,
      "thesis": "Bullish SMA stack. Entry on pullback to SMA20.",
      "trailing_stop": null,
      "days_in_status": 3
    }
  ]
}
```

### `data/macro.json`
```json
{
  "generated": "2026-03-17T14:00:00Z",
  "regime": "TRANSITIONAL",
  "vix": {"value": 22.5, "regime": "NORMAL", "sma20": 21.0},
  "dxy": {"value": 103.5, "bias": "BULLISH", "sma20": 102.8},
  "us10y": {"value": 4.25, "direction": "FALLING"},
  "us02y": {"value": 4.10, "direction": "FALLING"},
  "yield_spread": {"value": 0.15, "status": "NORMAL"},
  "pair_ratios": {
    "xly_xlp": {"value": 1.85, "bias": "BEARISH", "signal": "Defensive rotation"},
    "hyg_spy": {"value": 0.165, "bias": "MIXED", "signal": "Credit stable"},
    "rsp_spy": {"value": 0.268, "bias": "BEARISH", "signal": "Narrow breadth"}
  }
}
```

## Script: `scripts/export-dashboard-data.py`

```python
#!/usr/bin/env python3
"""
Export BreakingTrades data → dashboard JSON.
Reads from parent project, writes to this repo's data/ directory.

Usage:
    cd ~/projects/breakingtrades/breakingtrades-dashboard
    python3 scripts/export-dashboard-data.py

    # With auto-commit:
    python3 scripts/export-dashboard-data.py --commit --push
"""
# Implementation in Phase 1
```

## Cron / GitHub Actions

**Local cron (Mac):**
```
35 9 * * 1-5 cd ~/projects/breakingtrades && python3 update_data.py && cd breakingtrades-dashboard && python3 scripts/export-dashboard-data.py --commit --push
```

**GitHub Actions (backup):**
- Not possible for data export (needs local CSV access)
- Could work for Tom agent briefing generation (API-based)
