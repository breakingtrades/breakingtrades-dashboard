# Change: Watchlist Ticker Detail Modal

**Status:** 📝 SPEC (not started)
**Target pages:** `watchlist.html`

## Why

Clicking a ticker on the Watchlist page does nothing. On the Signals page (`index.html`), clicking a ticker opens a rich detail modal with TradingView charts, technical analysis, and setup levels. The Watchlist page should have a similar modal — adapted for its data (computed technicals, no human-curated entry/stop/targets).

## What Changes

### 1. Enrich `watchlist.json` — additional computed fields per ticker

New fields added to the export scripts (`export-dashboard-data.py` + `export-yfinance-fallback.py`):

| Field | Type | Computation |
|-------|------|-------------|
| `rsi` | float | RSI-14 (Wilder's smoothing) on daily close |
| `atr` | float | ATR-14 on daily OHLC |
| `atrPct` | float | `atr / price * 100` |
| `volRating` | string | LOW (<1.5%), MEDIUM (1.5-3%), HIGH (>3%) |
| `volume` | int | Latest daily volume |
| `volumeAvg20` | int | 20-day average volume |
| `volumeRatio` | float | `volume / volumeAvg20` (>1.5 = unusual) |
| `high52w` | float | 52-week high |
| `low52w` | float | 52-week low |
| `pctFrom52wHigh` | float | `(price - high52w) / high52w * 100` (always ≤0) |
| `bbWidth` | float | Bollinger Band width: `(upperBB - lowerBB) / sma20 * 100` |
| `bbWidthPercentile` | float | Current BB width vs 6-month range (0-100, low = compressed) |
| `earningsDate` | string|null | Next earnings date from yfinance `.info['earningsTimestampStart']` |
| `earningsDays` | int|null | Days until earnings (null if >90 or unknown) |
| `smaCrossover` | string|null | `"golden_cross"`, `"death_cross"`, `"compression"`, or null |
| `smaCrossoverDate` | string|null | Approximate date of last crossover |

### 2. New modal in `watchlist.html`

**Trigger:** `onclick="openDetail('SYMBOL')"` on each ticker row (both Widget and Table views)

**Modal layout (top to bottom):**

```
┌────────────────────────────────────────────────────────┐
│ AAPL — Apple · Technology                    ✕ close   │
│ $249.17 ▼ -1.67% · BEAR · Sector Risk: Low            │
├────────────────────────────────────────────────────────┤
│ ┌─────────────────────┐ ┌─────────────────────┐       │
│ │  Daily Chart (TV)   │ │  Weekly Chart (TV)  │       │
│ │  SMA 20/50 overlay  │ │  SMA 20/50 overlay  │       │
│ │  Earnings "E" marks │ │                     │       │
│ │  400px height       │ │  400px height       │       │
│ └─────────────────────┘ └─────────────────────┘       │
├────────────────────────────────────────────────────────┤
│ ┌──────────┐ ┌─────────────────┐ ┌──────────────────┐ │
│ │ TA Gauge │ │ Key Levels      │ │ Volatility       │ │
│ │ (TV wdg) │ │ SMA20  $261.41  │ │ ATR    $4.23     │ │
│ │ Buy/Sell │ │ SMA50  $261.54  │ │ ATR%   1.7%      │ │
│ │ Neutral  │ │ SMA200 $245.99  │ │ Rating Low       │ │
│ │ 300px    │ │ W20    $265.47  │ │ Vol    42.1M     │ │
│ │          │ │ 52wH   $280.32  │ │ vs Avg 0.8x     │ │
│ │          │ │ 52wL   $195.11  │ │ BB W%  12th pctl │ │
│ └──────────┘ └─────────────────┘ └──────────────────┘ │
├────────────────────────────────────────────────────────┤
│ 📊 Technical Signals (auto-generated from data)       │
│ • Death cross: SMA20 < SMA50 (since ~Mar 5)          │
│ • Trading 11.1% below 52-week high ($280.32)          │
│ • SMA compression: 20/50 within 0.05%                 │
│ • Volume below average (0.8x) — low conviction        │
│ • RSI 42 — neutral zone                               │
│ • ⚠️ Earnings: Apr 24 (37 days)                       │
│ • Bollinger squeeze (12th percentile) — watch for move │
├────────────────────────────────────────────────────────┤
│ 🤖 Tom's Take (future — slot reserved)                │
│ (placeholder until per-ticker Tom analysis is built)   │
└────────────────────────────────────────────────────────┘
```

### 3. TradingView Chart Configuration

```javascript
{
  "symbol": "NASDAQ:AAPL",
  "interval": "D",           // "W" for weekly
  "timezone": userTZ,        // from tz-picker
  "theme": "dark",
  "style": "1",              // candlestick
  "locale": "en",
  "toolbar_bg": "#0a0a0f",
  "hide_side_toolbar": false,
  "allow_symbol_change": false,
  "calendar": true,          // ← earnings + dividends + splits on timeline
  "studies": [
    "MASimple@tv-basicstudies|20",
    "MASimple@tv-basicstudies|50"
  ],
  "width": "100%",
  "height": "400"
}
```

`"calendar": true` enables the earnings "E" markers, dividend "D" markers, and split markers directly on the chart x-axis. No custom rendering needed — TradingView handles it.

### 4. Technical Signals auto-generation

Signals are generated client-side from the enriched data — a `generateSignals(ticker)` function returns an array of strings:

| Condition | Signal Text |
|-----------|-------------|
| `sma20 < sma50` | "Death cross: SMA20 < SMA50 (since ~{date})" |
| `sma20 > sma50` after being below | "Golden cross: SMA20 > SMA50 (since ~{date})" |
| `abs(sma20 - sma50) / price < 0.01` | "SMA compression: 20/50 within {pct}%" |
| `pctFrom52wHigh < -20` | "In correction territory: {pct}% below 52-week high" |
| `pctFrom52wHigh < -10` | "Trading {pct}% below 52-week high (${high})" |
| `volumeRatio > 1.5` | "Unusual volume ({ratio}x average) — watch for breakout" |
| `volumeRatio < 0.6` | "Volume below average ({ratio}x) — low conviction" |
| `rsi > 70` | "RSI {val} — overbought zone ⚠️" |
| `rsi < 30` | "RSI {val} — oversold zone 🟢" |
| `bbWidthPercentile < 15` | "Bollinger squeeze ({pctl}th percentile) — watch for move" |
| `earningsDays != null && earningsDays <= 14` | "⚠️ Earnings: {date} ({days} days)" |
| `earningsDays != null && earningsDays <= 45` | "Earnings: {date} ({days} days)" |
| `price > sma200 && price < sma20` | "Pullback to SMA20 — long-term trend intact" |
| `price < sma200` | "Below SMA200 — long-term support broken" |

Max 6 signals shown (sorted by importance).

## Existing Elements Modified

- `watchlist.html`: Add modal HTML + CSS + JS, add `onclick` to ticker rows
- `scripts/export-dashboard-data.py`: Add RSI, ATR, volume, 52wk, BB, earnings, crossover fields
- `scripts/export-yfinance-fallback.py`: Same additions
- `data/watchlist.json`: Schema expanded (backwards compatible — new fields are additive)

## Files Touched

| File | Action | What |
|------|--------|------|
| `watchlist.html` | Modified | Modal HTML/CSS/JS, onclick on rows |
| `scripts/export-dashboard-data.py` | Modified | Add computed fields |
| `scripts/export-yfinance-fallback.py` | Modified | Add computed fields |
| `data/watchlist.json` | Modified | New fields per ticker |
| (no new files) | | |

## Dependencies

- TradingView Advanced Chart widget (CDN, free)
- TradingView Technical Analysis widget (CDN, free)
- yfinance for earnings dates + OHLCV for ATR/BB/RSI computation
- Existing `tz-picker` for chart timezone

## Future Slots

- **Tom's per-ticker take** — placeholder div in modal, populated when `data/tom/takes/{TICKER}.json` exists
- **Expected move overlay** — from IB options data when available (Mac enrichment)
- **Dark pool flow indicator** — from IB when available
