# Requirements: Watchlist Engine

## Functional Requirements

### FR-1: Watchlist Scraping
- FR-1.1: Accept a TradingView shared watchlist URL as input
- FR-1.2: Parse all symbols from the watchlist, preserving section grouping
- FR-1.3: Support manual symbol additions via a `watchlist-override.json` config
- FR-1.4: Handle TradingView format variations (NYSE:D, NASDAQ:AAPL, AMEX:XLU)

### FR-2: Technical Indicator Computation
- FR-2.1: Fetch daily OHLCV data for each symbol (minimum 60 trading days)
- FR-2.2: Compute EMA 8, EMA 21, EMA 50 on closing prices
- FR-2.3: Compute RSI 14 on closing prices
- FR-2.4: Calculate current price's percentage distance from 52-week high
- FR-2.5: Determine EMA alignment bias:
  - **Bullish**: Price > EMA 8 > EMA 21 > EMA 50
  - **Bearish**: Price < EMA 8 < EMA 21 < EMA 50
  - **Mixed**: Any other arrangement
- FR-2.6: Identify key price levels: EMA 8, EMA 21, EMA 50, 6-month high, 6-month low

### FR-3: Trade Setup Generation
- FR-3.1: For each bullish symbol, generate entry zone (EMA 8 pullback area)
- FR-3.2: Calculate stop loss (below EMA 21 or recent swing low)
- FR-3.3: Calculate targets (prior resistance, 6-month high, ATH)
- FR-3.4: Compute risk:reward ratio
- FR-3.5: Output a confidence score (0-100) based on alignment strength

### FR-4: JSON Output
- FR-4.1: Generate `data/output/watchlist.json` with schema:
  ```json
  {
    "generated_at": "ISO-8601",
    "symbols": [{
      "ticker": "D",
      "name": "Dominion Energy",
      "exchange": "NYSE",
      "sector": "Utilities",
      "section": "Quality Stocks",
      "price": 54.32,
      "change_pct": 1.24,
      "ema8": 53.80,
      "ema21": 52.45,
      "ema50": 51.10,
      "rsi": 62.3,
      "bias": "Bullish",
      "pct_from_high": -8.2,
      "levels": { "ema8": 53.80, "ema21": 52.45, "ema50": 51.10, "high_6m": 59.15, "low_6m": 47.20 }
    }]
  }
  ```
- FR-4.2: Generate `data/output/setups.json` with entry/stop/target/RR for each qualifying symbol
- FR-4.3: Include a `generated_at` timestamp in all output files

### FR-5: Automation
- FR-5.1: GitHub Actions workflow triggered daily at 9:35 AM ET (13:35 UTC)
- FR-5.2: Workflow runs pipeline, commits updated JSON to `data/output/`, pushes to main
- FR-5.3: Support manual trigger via `workflow_dispatch`

## Non-Functional Requirements

- **NFR-1:** Pipeline completes in < 60 seconds for 70 symbols
- **NFR-2:** Graceful error handling — skip symbols that fail, log warnings, continue
- **NFR-3:** No API keys required (yfinance is free, no TradingView API)
- **NFR-4:** Python 3.10+ compatible
- **NFR-5:** Dependencies: yfinance, pandas, numpy, requests, beautifulsoup4

## Dependencies

- TradingView shared watchlist must be publicly accessible
- yfinance must not be rate-limited (standard usage well within limits)
- GitHub Actions runner has Python 3.10+ available
