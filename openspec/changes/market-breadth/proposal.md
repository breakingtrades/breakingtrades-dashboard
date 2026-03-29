# Market Breadth — OpenSpec Proposal

> Date: 2026-03-29
> Status: **Shipped**

## What

Market breadth section on `market.html` — shows % of stocks above key moving averages across S&P 500 sectors and major indices.

## Components

### Data Pipeline: `scripts/update-breadth.py`
- Fetches ~235 representative stocks across 11 GICS sectors via yfinance batch download
- Computes % above SMA (20/50/100/200-day) for each sector and index group
- TradingView breadth symbols (S5TW, NDTW, etc.) unavailable on yfinance — computed from constituent data instead
- Output: `data/breadth.json`
- Added to `eod-update.sh` as step 3b (after sector rotation, before EM)

### UI: Market Breadth section on `market.html`
- **Summary strip**: Stacked total (/1100), average breadth %, sector count
- **River Map**: Horizontal stacked bar chart (11 sectors, 0-1100 scale) with green zone (<200) and red zone (>1000) annotations
- **Breadth Lines**: Vertical bar chart showing each sector + S&P 500 avg (0-100 scale) with oversold/overbought zones
- **Toggle**: Switch between River Map and Breadth Lines views
- **Insight box**: Dynamic annotation based on zone (Green Pond Alert / Overbought Warning / Weak / Neutral)
- **Multi-Timeframe Table**: SPX, NDX, DJI, RUT, VTI × 20/50/100/200-day with color-coded badges

### Tests: `tests/market-breadth.test.js`
- 31 assertions across 6 groups: schema validation, stacked total, average, zone classification, badge thresholds, data completeness
- Follows existing Jest test patterns

## Architecture Decisions

1. **Computed breadth vs. TradingView symbols**: TradingView INDEX breadth symbols (S5TW, NDTW, etc.) are proprietary and unavailable via yfinance or any installable Python package. We compute breadth from ~20 representative stocks per sector instead.

2. **Representative stocks**: Top ~20 holdings per sector SPDR ETF. Not a perfect match for full S&P 500 constituency but gives a reliable breadth signal. RUT and VTI use all 235 stocks as proxy.

3. **Single snapshot**: Current data is point-in-time (no history). Historical river map requires storing daily snapshots — deferred to Phase 2.

## Data Flow

```
yfinance (235 stocks, 1y history)
  → compute SMA 20/50/100/200
  → group by sector → % above each SMA
  → data/breadth.json
  → market.html (Chart.js + annotation plugin)
```

## Files Changed

| File | Change |
|------|--------|
| `scripts/update-breadth.py` | New — data pipeline |
| `scripts/eod-update.sh` | Added breadth step (3b/6) |
| `market.html` | Added breadth section (CSS + HTML + JS) |
| `data/breadth.json` | New — output data |
| `tests/market-breadth.test.js` | New — 31 test assertions |
| `openspec/changes/market-breadth/proposal.md` | This file |
