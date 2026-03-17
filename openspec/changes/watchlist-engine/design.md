# Design: Watchlist Engine

## Architecture

```
watchlist-url / override.json
        │
        ▼
┌─────────────────────┐
│  scrape_watchlist.py │  → symbols[] with sections
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│  compute_signals.py  │  → symbols[] with EMAs, RSI, bias, levels
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│  generate_setups.py  │  → setups[] with entry/stop/target/RR
└────────┬────────────┘
         │
         ▼
┌──────────────┐
│  JSON output  │  → data/output/watchlist.json, setups.json
└──────────────┘
```

## Module Design

### `scrape_watchlist.py`
- **Input:** Watchlist URL (env var or config), optional `watchlist-override.json`
- **Process:** HTTP GET → parse HTML/JSON → extract symbols with exchange prefix
- **Output:** List of `Symbol` dicts with `ticker`, `exchange`, `section` fields
- **Error handling:** Retry 3x with exponential backoff, fall back to override file

### `compute_signals.py`
- **Input:** List of symbols from scraper
- **Process:** Batch yfinance download (single call for all tickers), compute indicators per symbol using pandas
- **Key functions:**
  - `compute_ema(series, period)` → EMA values
  - `compute_rsi(series, period=14)` → RSI value
  - `determine_bias(price, ema8, ema21, ema50)` → "Bullish" | "Bearish" | "Mixed"
  - `find_levels(df)` → key support/resistance from recent price action
- **Output:** Enriched symbol dicts with all computed fields

### `generate_setups.py`
- **Input:** Enriched symbols from compute step
- **Process:** Filter for actionable setups (bias != "Mixed", RSI < 75), calculate entry/stop/target zones
- **Logic:**
  - Entry zone: Between current price and EMA 8 (for bullish, pullback area)
  - Stop loss: Below EMA 21 or 2% below EMA 50 (whichever is tighter)
  - Target 1: Prior resistance / 6-month high
  - Target 2: All-time high (if available)
  - R:R = (Target 1 - Entry) / (Entry - Stop)
- **Output:** Setup dicts with all trade parameters

### `run_pipeline.py` (orchestrator)
- Calls scrape → compute → generate in sequence
- Writes JSON files to `data/output/`
- Logs summary: "Generated 68 symbols, 24 setups"
- Exit code 0 on success, 1 on critical failure

## Data Model

```python
@dataclass
class Symbol:
    ticker: str
    name: str
    exchange: str
    sector: str
    section: str          # "Quality Stocks", "Community Trades", etc.
    price: float
    change_pct: float
    ema8: float
    ema21: float
    ema50: float
    rsi: float
    bias: str             # "Bullish", "Bearish", "Mixed"
    pct_from_high: float
    levels: dict          # {ema8, ema21, ema50, high_6m, low_6m}

@dataclass
class Setup:
    ticker: str
    bias: str
    entry: float
    stop: float
    target1: float
    target2: float | None
    rr_ratio: float
    confidence: int       # 0-100
    thesis: str           # One-line AI-generated summary
```

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Watchlist URL unreachable | Fall back to override file, log warning |
| yfinance returns no data for symbol | Skip symbol, log warning |
| EMA computation fails (insufficient data) | Skip symbol, log warning |
| All symbols fail | Exit with code 1, no JSON written |

## File Locations

```
data/
├── pipeline/
│   ├── scrape_watchlist.py
│   ├── compute_signals.py
│   ├── generate_setups.py
│   ├── run_pipeline.py
│   └── requirements.txt
├── config/
│   └── watchlist-override.json
└── output/
    ├── watchlist.json
    └── setups.json
```
