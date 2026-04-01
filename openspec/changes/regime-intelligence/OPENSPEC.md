# OpenSpec: AI Researcher — Regime Intelligence Dashboard

> **Status:** ✅ Shipped (Phases 1-3 complete)
> **Priority:** High
> **Author:** Kash + Idan
> **Date:** 2026-03-31 (shipped), updated 2026-04-01
> **Route:** `#airesearcher` (renamed from `#autoresearch`)
> **Location:** `js/pages/autoresearch.js` (internal filename preserved)
> **Data Sources:** Existing `data/*.json` + `data/regime.json` + `data/regime-history.jsonl`
> **Pipeline:** `scripts/update-regime.py` — runs daily in EOD pipeline (Step 6/6)

---

## 0. Lineage — From Autoresearch to Regime Intelligence

The AI Researcher page is the **production output** of the autoresearch system built on Mar 29.

### How Autoresearch Created the Regime Model

1. **Tom's 75 trading rules were analyzed** (`agents/tom-fxevolution/RULES.json`) — 34 identified as having quantifiable thresholds suitable for systematic use. Categorized into: macro (17), macro_analysis (11), technical (10), flow (7), sentiment (5), behavior (5), sector (4).

2. **4 Tier 1 rule filters were implemented** in `backtest_v2.py` as part of the autoresearch backtest engine:
   - **R041:** VIX > 25 → skip single stocks (indexes exempt)
   - **R054:** MA regime — price below D200 + W50 = bearish, block entry
   - **R001/R040:** Bond health — HYG < EMA20 = credit stress, block entry
   - **R013:** Fear & Greed extremes — >75 extreme greed blocks entry

3. **These same thresholds and rule mappings** became the foundation of `update-regime.py` — the 15 weighted signals, the regime classification bands (CRISIS through EUPHORIA), the per-regime playbooks, and the rule-to-regime mappings all derive from the autoresearch rule analysis.

4. **The autoresearch evaluator** (`autoresearch/evaluate-bt.py`) established the scoring methodology: composite weighted score, benchmark across 8 core tickers (SPY, QQQ, NVDA, AAPL, IWM, MSFT, XLE, GLD), baseline of 0.5295.

5. **The regime page replaced the autoresearch dashboard** on the same nav tab — by design. The autoresearch experiment runner (`autoresearch/runner.sh`) remains available for future threshold optimization.

### What Autoresearch Does vs What Regime Scorer Does

| System | Location | Purpose | Uses AI/LLM? |
|--------|----------|---------|-------------|
| **Autoresearch Runner** | `~/projects/breakingtrades/autoresearch/` | Optimizes backtest strategy parameters (EMA lengths, VPR, Tom's rule thresholds). Mutate → evaluate → compare → git commit. | No — pure backtest math |
| **Regime Scorer** | `scripts/update-regime.py` | Reads daily market data, computes weighted regime score from 15 signals, classifies market environment (CRISIS→EUPHORIA). | No — deterministic Python, zero deps |
| **Daily Briefing** | `scripts/generate-briefing.py` | Writes market analysis narrative from data. | **Yes — GPT-4.1** |
| **AI Researcher Page** | `js/pages/autoresearch.js` | Renders regime data + briefing for users. | No — display layer |

### Future Connection (Phase 4)

The autoresearch experiment loop can be used to **validate and optimize** the regime thresholds against historical backtest data: "What VIX cutoff best predicts drawdowns? What MOVE weight produces the best risk-adjusted returns?" The current thresholds are educated estimates from Tom's rule analysis — the runner can make them empirically optimal.

## 1. Problem Statement (Original — Solved)

Market regime signals were scattered across 6 pages. Tom's 75 rules lived in a JSON file, not the dashboard. No single view answered: "What regime are we in? What rules apply? What's the playbook?" The autoresearch system analyzed and codified Tom's rules, which then became the regime scoring model.

## 2. Architecture (Shipped)

```
Data Pipeline (EOD, Mon-Fri 4:20 PM ET)
├── Step 0:  update-prices.py      → data/prices.json (99 tickers incl. 18 regime tickers)
├── Step 0b: update_futures.py     → data/futures.json
├── Step 1:  update-fear-greed.py  → data/fear-greed.json
├── Step 2:  update-vix.py         → data/vix.json
├── Step 3:  export-sector-rotation.py → data/sector-rotation.json
├── Step 3b: update-breadth.py     → data/breadth.json
├── Step 4:  update-expected-moves.py → data/expected-moves.json
├── Step 5:  export-yfinance-fallback.py
└── Step 6:  update-regime.py      → data/regime.json + data/regime-history.jsonl  ← NEW

Dashboard (root — SPA promoted from v2/ on Apr 1)
├── js/pages/autoresearch.js  ← AI Researcher page (route: #airesearcher)
├── css/autoresearch.css      ← Page styles
└── Legacy redirect: #autoresearch → #airesearcher

Autoresearch Engine (separate, in parent repo)
├── ~/projects/breakingtrades/autoresearch/evaluate-bt.py    ← Backtest evaluator
├── ~/projects/breakingtrades/autoresearch/runner.sh          ← Experiment loop
├── ~/projects/breakingtrades/autoresearch/configs/bt-strategy.json ← Mutable config
└── ~/projects/breakingtrades/autoresearch/program.md         ← Agent instructions
```

## 3. Regime Classification Model

### Input Signals (Tier 1 — all free, all in `prices.json` now)

| Signal | Ticker | Weight | Bearish Threshold | Bullish Threshold |
|--------|--------|--------|-------------------|-------------------|
| **MOVE Index** | `^MOVE` | 18% | >100 (accelerating) | <80 (collapsing) |
| **F&G** | `fear-greed.json` | 10% | <25 (extreme fear) | >75 (extreme greed) |
| **VIX** | `^VIX` | 10% | >30 (fear) | <15 (complacent) |
| **Market Breadth** | `breadth.json` | 8% | <25% (oversold) | >75% (overbought) |
| **S&P vs D200** | `^GSPC` vs SMA200 | 8% | Below D200 | Above D200 |
| **HYG/SPY ratio** | computed | 8% | Falling >1% below SMA50 | Rising >1% above SMA50 |
| **XLF/SPY (Financials)** | computed | 6% | Breaking support (R009, R036) | Stable/rising |
| **DXY** | `DX-Y.NYB` | 5% | Rising (risk-off) | Falling (risk-on) |
| **Yield curve** | US10Y-US13W | 5% | Inverted or un-inverting (R008) | Normal spread |
| **Growth/Value** | IWF/IWD ratio | 4% | Value leading (defensive) | Growth leading (risk-on) |
| **RSP/SPY breadth** | RSP/SPY ratio | 4% | Falling (narrow market) | Rising (broad market) |
| **Put/Call ratio** | CBOE P/C | 4% | >0.93 extreme fear (R011) | <0.7 complacent |
| **Copper/Gold** | CPER/GLD ratio | 4% | Falling (risk-off) | Rising (risk-on) |
| **International** | DAX+KOSPI+HSI avg | 4% | All breaking down (R073) | All holding/rising |
| **XLY/XLP (Consumer)** | computed | 2% | Falling = consumer stress (R058) | Rising = risk-on |

### Regime Score → Classification

| Score Range | Regime | Color | Position Sizing | Tom's Mantra |
|-------------|--------|-------|----------------|-------------|
| 0-15 | **CRISIS** | 🔴 Red | 25% of normal | "Patient, react, don't predict" |
| 16-30 | **BEAR** | 🟠 Orange | 50% of normal | "Buy the V, not the dip" |
| 31-45 | **CORRECTION** | 🟡 Yellow | 75% of normal | "Selective longs only" |
| 46-55 | **NEUTRAL** | ⚪ Gray | 100% standard | "Standard playbook" |
| 56-70 | **BULL** | 🟢 Cyan | 100% + momentum | "Trend is your friend" |
| 71-85 | **STRONG BULL** | 💚 Green | Full + pyramiding | "Let winners run" |
| 86-100 | **EUPHORIA** | 🟣 Purple | Reduce to 75% | "When everyone's greedy, be fearful" |

### Tom's Rules Mapped to Regimes

| Regime | Active Rules | Key Actions |
|--------|-------------|-------------|
| **CRISIS** | R001 (bonds), R003 (smart/dumb), R006 (exit below SMA20), R013 (F&G<25=opportunity), R054 (below D200+W50), R056 (buy V not dip), R057 (MOVE=bottom signal) | Reduce exposure, defensive sectors only (XLU/XLP/XLV), no dip buying, watch MOVE for bottom |
| **BEAR** | R006, R008 (yield curve), R025 (defensive rotation), R054, R065 (reversal frequency) | Short bias, tight stops, wait for structure |
| **CORRECTION** | R006, R010 (don't chase), R025, R056 | Reduced size, selective, confirmation needed |
| **NEUTRAL** | R007 (W20 mean reversion), R010, R013 | Standard playbook, EMA 13/26 entries |
| **BULL** | R007, R013 (F&G>75 caution), R029 (trailing stops) | Full position, trend following, trail stops |
| **STRONG BULL** | R004 (AAII bulls>50 contrarian), R013, R026 (leveraged ETF warning) | Pyramiding, but watch for excess |
| **EUPHORIA** | R003 (smart money selling), R004, R013, R026, R052 (18yr bull danger) | Tighten stops, reduce exposure, contrarian signals active |

## 4. Data Schema

### `data/regime.json` (computed daily by `update-regime.py`)

```json
{
  "updated": "2026-03-31T20:30:00Z",
  "regime": "CRISIS",
  "score": 18,
  "previous": { "regime": "CRISIS", "score": 22 },
  "duration_days": 16,
  "since": "2026-03-15",
  "components": {
    "move": { "value": 96.05, "score": 14, "signal": "accelerating", "weight": 20 },
    "vix": { "value": 25.44, "score": 35, "signal": "elevated", "weight": 12 },
    "fear_greed": { "value": 8.7, "score": 8, "signal": "extreme_fear", "weight": 12 },
    "breadth": { "value": 36.8, "score": 30, "signal": "weak", "weight": 10 },
    "sp_vs_d200": { "value": -4.2, "score": 10, "signal": "below", "weight": 10 },
    "hyg_spy": { "value": -2.1, "score": 15, "signal": "stress", "weight": 8 },
    "dxy": { "value": 99.69, "score": 35, "signal": "elevated", "weight": 6 },
    "growth_value": { "value": -0.8, "score": 40, "signal": "value_leading", "weight": 5 },
    "rsp_spy": { "value": -1.2, "score": 30, "signal": "narrowing", "weight": 5 },
    "yield_curve": { "value": 0.42, "score": 50, "signal": "normal", "weight": 4 },
    "copper_gold": { "value": -3.5, "score": 20, "signal": "risk_off", "weight": 4 },
    "international": { "value": -1.8, "score": 25, "signal": "weakening", "weight": 4 }
  },
  "active_rules": ["R001", "R003", "R006", "R013", "R054", "R056", "R057"],
  "playbook": {
    "position_size": 0.25,
    "sector_bias": ["XLU", "XLP", "XLV", "XLE"],
    "avoid_sectors": ["XLK", "XLY", "XLC"],
    "stop_rule": "Daily close below 20 MA = exit (R006)",
    "entry_rule": "Buy the V, not the dip (R056). Wait for MOVE to collapse (R057).",
    "key_watch": "MOVE Index collapse = bottom signal"
  },
  "transition_signals": {
    "target": "BEAR",
    "conditions": [
      { "label": "F&G > 25", "current": 8.7, "target": 25, "met": false },
      { "label": "VIX < 22", "current": 25.44, "target": 22, "met": false },
      { "label": "Breadth > 45%", "current": 36.8, "target": 45, "met": false },
      { "label": "MOVE < 90", "current": 96.05, "target": 90, "met": false },
      { "label": "HYG/SPY stabilizing", "current": -2.1, "target": -0.5, "met": false }
    ],
    "conditions_met": 0,
    "conditions_total": 5
  }
}
```

### `data/regime-history.jsonl` (append-only, one line per day)

```jsonl
{"date":"2026-03-15","regime":"CRISIS","score":12,"move":102,"vix":32,"fg":14.7}
{"date":"2026-03-16","regime":"CRISIS","score":15,"move":98,"vix":29,"fg":12.3}
...
```

## 5. Dashboard Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│  CURRENT REGIME                                                     │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  CRISIS    Score: 18/100    Active since: Mar 15 (16 days)  │    │
│  │  ■■■■■■■■■░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │    │
│  │  CRISIS ← ─ BEAR ─ ─ CORRECTION ─ ─ NEUTRAL ─ ─ BULL ─ → │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                     │
│  REGIME COMPONENTS                                                  │
│  ┌──────────┬──────────┬──────────┬──────────┬──────────┐          │
│  │ MOVE     │ VIX      │ F&G      │ BREADTH  │ S&P/D200 │          │
│  │ 96.05    │ 25.44    │ 8.7      │ 36.8%    │ -4.2%    │          │
│  │ ▲ Accel  │ Elevated │ Ext Fear │ Weak     │ Below    │          │
│  └──────────┴──────────┴──────────┴──────────┴──────────┘          │
│  ┌──────────┬──────────┬──────────┬──────────┬──────────┐          │
│  │ HYG/SPY  │ DXY      │ Grw/Val  │ RSP/SPY  │ Cu/Au    │          │
│  │ -2.1%    │ 99.69    │ Value ↑  │ -1.2%    │ Risk-Off │          │
│  │ Stress   │ Elevated │ Defensive│ Narrowing│ Fear     │          │
│  └──────────┴──────────┴──────────┴──────────┴──────────┘          │
│                                                                     │
│  PLAYBOOK (CRISIS MODE)                       ACTIVE RULES          │
│  ┌────────────────────────────────┐  ┌──────────────────────────┐  │
│  │ Position size: 25% of normal  │  │ R001: Bonds breaking →   │  │
│  │ Sectors: XLU, XLP, XLV, XLE   │  │       reduce exposure    │  │
│  │ Avoid: XLK, XLY, XLC          │  │ R006: Below SMA20 = exit │  │
│  │ Stop: Close below 20 MA       │  │ R054: Below D200+W50 =   │  │
│  │ Entry: Buy V, not dip (R056)  │  │       bears in control   │  │
│  │ Watch: MOVE collapse = bottom │  │ R057: MOVE collapse =    │  │
│  └────────────────────────────────┘  │       bottom confirmed   │  │
│                                      └──────────────────────────┘  │
│                                                                     │
│  MARKET INTERNALS                                                   │
│  ┌──────────┬──────────┬──────────┬──────────┬──────────┐          │
│  │ MOVE     │ Yield    │ DXY      │ Copper   │ Transpts │          │
│  │ 96.05    │ 2Y/10Y   │ 99.69    │ CPER     │ ^DJT     │          │
│  │ ▲ -11%   │ 0.42%    │ ▼ -0.8%  │ ▲ +2.5%  │ ▲ +3.2%  │          │
│  └──────────┴──────────┴──────────┴──────────┴──────────┘          │
│  ┌──────────┬──────────┬──────────┬──────────┬──────────┐          │
│  │ DAX      │ KOSPI    │ Hang Seng│ ASX 200  │ China    │          │
│  │ 22,563   │ 5,290    │ 24,751   │ 8,631    │ FXI 35.9 │          │
│  │ ▲ +1.2%  │ ▲ +0.2%  │ ▼ -0.8%  │ ▲ +2.0%  │ ▲ +2.6%  │          │
│  └──────────┴──────────┴──────────┴──────────┴──────────┘          │
│                                                                     │
│  COMMODITY CHAIN (Late-Cycle Sequence)                              │
│  Gold ✅ → Copper ⚠️ → Energy ✅ → Agriculture 🔄                   │
│                                                                     │
│  TRANSITION SIGNALS (to exit CRISIS)                                │
│  ☐ F&G > 25 (currently 8.7)                                        │
│  ☐ VIX < 22 (currently 25.44)                                      │
│  ☐ Breadth > 45% (currently 36.8%)                                  │
│  ☐ MOVE < 90 (currently 96.05)                                      │
│  ☐ HYG/SPY stabilizing (currently -2.1%)                            │
│  0 of 5 conditions met                                              │
│                                                                     │
│  REGIME HISTORY                                                     │
│  ████████░░░░████░░░░░░░░░░░████████████████                        │
│  BULL    CORR BULL NEUTRAL   CRISIS                                 │
│  Jan     Feb  Mar  Mar 5     Mar 15 → now                           │
└─────────────────────────────────────────────────────────────────────┘
```

## 6. Implementation Status

### Phase 1: Regime Computation Pipeline ✅ Shipped (Mar 31)
1. ✅ `scripts/update-regime.py` — reads all data files, computes regime score, writes `data/regime.json` + appends to `data/regime-history.jsonl`
2. ✅ Added to EOD pipeline (`eod-update.sh` Step 6/6) — runs AFTER prices + F&G + VIX + breadth + EM
3. ⬜ Add to intraday pipeline — runs after price updates (4×/day) — **not yet done**

### Phase 2: Dashboard Page ✅ Shipped (Mar 31)
4. ✅ Rewrote `js/pages/autoresearch.js` → full regime intelligence dashboard
5. ✅ `css/autoresearch.css` → regime page styles (cards, gauges, internals grid, timeline)
6. ✅ Regime score gauge (horizontal bar with indicator, color-coded bands)
7. ✅ Component cards grid (15 signals: MOVE, VIX, F&G, breadth, S&P/D200, HYG/SPY, etc.)
8. ✅ Playbook card + Active Rules card (rule IDs hidden from users)
9. ✅ Market Internals grid (international indices, commodity chain with live prices)
10. ✅ Transition signals checklist ("What needs to change — CORRECTION → NEUTRAL")
11. ✅ Regime history chart (Chart.js, builds daily as data accumulates)

### Phase 2b: UX Polish ✅ Shipped (Apr 1)
- ✅ Renamed to "AI Researcher" (nav, route `#airesearcher`, page title)
- ✅ Page intro banner explaining what the AI analyzes (15 signals)
- ✅ Per-regime descriptions in hero (e.g. "Pullback within a broader trend — reduced size, selective entries, tighter stops")
- ✅ Section subtitles explaining what each panel does and why
- ✅ All text bumped to 14-15px with lighter color for readability
- ✅ Rule IDs stripped everywhere (R006 etc. never shown to users)
- ✅ Legacy `#autoresearch` route auto-redirects to `#airesearcher`
- ✅ Fixed `prices.json` nesting bug (Market Internals + Commodity Chain now show live data)
- ✅ Fixed `change` field name mismatch for price change % display

### Phase 2c: Daily Briefing on Market Page ✅ Shipped (Apr 1)
- ✅ Briefing card at hero position on Market landing page (above heatmap)
- ✅ Full render: headline, body paragraphs, key levels callout, action items, closing quote + timestamp
- ✅ Collapsible, state persists in localStorage
- ✅ Rule IDs stripped from briefing text

### Phase 2d: v2 SPA Promoted to Root ✅ Shipped (Apr 1)
- ✅ Moved v2/ contents to root (index.html, css/, js/, brand/)
- ✅ Archived v1 HTML pages to v1/ directory
- ✅ Fixed all data paths: `../data/` → `data/` (21 references)
- ✅ Root URL now serves SPA with hash router (#market, #signals, etc.)

### Phase 3: Feed Into Signals Page ⬜ Not Started
12. ⬜ Replace hardcoded "CRISIS" / "EXTREME" regime cards with data from `regime.json`
13. ⬜ Regime badge in nav bar (small colored dot showing current regime)

### Phase 4: Autoresearch Integration ⬜ Not Started
14. ⬜ Run autoresearch experiments to validate/optimize regime thresholds
15. ⬜ Tag backtest periods by regime
16. ⬜ Run regime-specific config optimization
17. ⬜ Display backtest proof per regime

## 7. Tier 1 Tickers (DONE — added to `update-prices.py`)

| Ticker | Name | Regime Signal | Status |
|--------|------|--------------|--------|
| `^MOVE` | MOVE Index | Bond volatility — THE bottoming signal | ✅ Fetching: 96.05 |
| `^VIX` | VIX | Equity volatility | ✅ Fetching: 25.25 |
| `IWF` | Russell 1000 Growth | Growth vs Value pair | ✅ Fetching: 426.40 |
| `IWD` | Russell 1000 Value | Growth vs Value pair | ✅ Fetching: 213.67 |
| `RSP` | Equal Weight S&P | Breadth (RSP/SPY) | ✅ Fetching: 191.92 |
| `DX-Y.NYB` | Dollar Index | Risk-off indicator | ✅ Fetching: 99.69 |
| `CPER` | Copper ETF | "Dr. Copper" health | ✅ Fetching: 34.43 |
| `SLV` | Silver ETF | Precious metals chain | ✅ Fetching: 68.14 |
| `SMH` | Semiconductor ETF | Tech health (0.55 vs SPX) | ✅ Fetching: 383.40 |
| `^GSPC` | S&P 500 Index | Regime scoring vs MAs | ✅ Fetching: 6528.52 |
| `^DJT` | Dow Transports | Recession signal | ✅ Fetching: 18609.55 |
| `ADM` | Archer-Daniels-Midland | Agriculture late-cycle | ✅ Fetching: 72.69 |
| `MOS` | Mosaic | Fertilizer/inflation canary | ✅ Fetching: 25.50 |
| `^GDAXI` | DAX | Lead indicator (R073) | ✅ Fetching: 22562.88 |
| `^KS11` | KOSPI | AI bubble proxy (R073) | ✅ Fetching: 5289.93 |
| `^HSI` | Hang Seng | Risk-on tell (R073) | ✅ Fetching: 24750.79 |
| `^AXJO` | ASX 200 | Commodity proxy (R073) | ✅ Fetching: 8630.80 |
| `FXI` | China ETF | China risk appetite | ✅ Fetching: 35.90 |

## 8. Tom's Full Signal Hierarchy (for reference)

### Price Action First (PA = truth)
- Daily close > intraday action (R075)
- S&P below D200 + W50 = bears in control (R054)
- Key levels: round numbers, anchored VWAPs, volume nodes

### Then Macro Regime (bonds/MOVE)
- MOVE Index = THE bottoming/topping signal (R053, R057, R072)
- HYG/LQD breakdown = reduce everything (R001)
- Yield curve un-inversion = MORE dangerous than inversion (R008)
- Global yields all breaking = systemic (AGENT.md)

### Then Flows
- Dark pool > $1B at a level = don't fight it (R002)
- Negative GEX = cascading hedging (R060)
- Close = where fund managers execute (R075)
- Dark pool at resistance = distribution, NOT confirmation (R063)

### Then Sentiment (contrarian)
- SentimenTrader Smart/Dumb Money extremes (R003)
- Put/Call + drawdown combo = strongest buy signal (R011)
- F&G extremes = opportunity/caution (R013)
- AAII survey extremes (R004)

### Then Breadth/Rotation
- A/D line divergence = early warning (R023)
- Defensive leadership = risk rising (R025)
- International breakdowns stacking = outflow to dollars (R073)
- Commodity chain: Gold → Copper → Energy → Agriculture = late cycle

## 9. Business Cycle Positioning (Macro Layer)

Above the tactical regime (CRISIS/BEAR/BULL — days to weeks), sits the **structural business cycle** — the multi-month/multi-year economic wave. Tom already calls this:

- "Officially **late-cycle** — 6 months into Fed cutting cycle" (AGENT.md)
- "Stagflation → deflationary recession path hardening" (AGENT.md)
- Commodity chain Gold→Copper→Energy→Agriculture = "classic late-cycle signal" (AGENT.md)
- "End of business cycle, recession over next year or two" (AGENT.md)
- R008: "Yield curve un-inversion = MORE dangerous. Recessions start AFTER."

### The Four Phases

```
         PEAK
        /    \
       /      \         ← We estimate position on this curve
      /        \           using leading + coincident + lagging indicators
     /    EXPANSION    CONTRACTION
    /              \  /
TROUGH ─────────── TROUGH
   RECOVERY
```

| Phase | What Happens | Sector Leaders | Tom's Signals |
|-------|-------------|----------------|--------------|
| **Recovery/Early** | Rates low, hiring starts, consumer demand growing | Tech, Consumer Disc, Financials | F&G rising, VIX falling, RSP/SPY rising, IWF>IWD |
| **Expansion/Mid** | Full employment, profits rising, GDP strong | Tech, Industrials, Materials | Breadth >60%, all MAs bullish, MOVE low |
| **Peak/Late** | Inflation building, rates rising, costs squeeze profits | Energy, Materials, Staples | Gold→Copper→Energy→Ag sequence, yield curve flattening, MOVE rising |
| **Contraction** | GDP falling, layoffs, consumer pullback, bear market | Utilities, Healthcare, Staples, Cash | Below D200+W50, HYG breaking, MOVE accelerating, F&G<25 |

### How We Compute Cycle Position

**Leading Indicators (predict what's coming):**
| Indicator | Data Source | Signal |
|-----------|-----------|--------|
| Yield curve (2Y/10Y) | `prices.json` (US02Y, US10Y via `^TNX`, `^IRX`) | Inverted → recession in 6-18mo. Un-inverting → recession imminent (R008) |
| MOVE Index trend | `prices.json` (`^MOVE`) | Accelerating → late cycle stress. Collapsing → early recovery |
| S&P vs trendline | `prices.json` (`^GSPC`) | Above = expansion. Below = contraction |
| Sector rotation phase | `sector-rotation.json` | Defensive leading = late/contraction. Cyclical leading = early/expansion |
| Copper/Gold ratio | `prices.json` (CPER/GLD) | Rising = expansion. Falling = contraction |
| Dow Transports | `prices.json` (`^DJT`) | "Horrid" per Tom = recession signal |
| Agriculture strength | `prices.json` (ADM, MOS) | "Confirmed strongest sector" = LATE cycle |
| Housing (future) | Would need Case-Shiller or homebuilder ETF (XHB) | Late cycle canary |

**Coincident Indicators (confirm where we are):**
| Indicator | Source | Signal |
|-----------|--------|--------|
| S&P 500 trend | Existing | Above/below key MAs |
| Breadth | `breadth.json` | >60% = expansion, <30% = contraction |
| VIX level | `vix.json` | <15 = expansion peak, >30 = contraction |

**Lagging Indicators (confirm after the fact):**
| Indicator | Source | Signal |
|-----------|--------|--------|
| Unemployment (future) | FRED API (free) | Rising = confirms contraction |
| CPI/Inflation (future) | FRED API (free) | Rising = confirms peak/late cycle |

### Cycle Position Score

```
Cycle Score = weighted_average(leading_indicators) normalized to 0-100

0-25:    CONTRACTION (recession phase)
25-40:   TROUGH/RECOVERY (bottom forming, early recovery)
40-60:   EXPANSION (mid-cycle growth)
60-80:   PEAK/LATE CYCLE (growth slowing, inflation rising)
80-100:  OVERHEATING (bubble territory, pre-contraction)
```

### Current Estimated Position (Manual — Tom's Call)

Based on Tom's March 2026 analysis:
- **Phase:** LATE CYCLE → CONTRACTION transition
- **Evidence:** Fed cutting cycle (6 months in), commodity chain completing (Gold✅ → Copper⚠️ → Energy✅ → Ag🔄), yield curve un-inverting, MOVE accelerating, stagflation path hardening, Dow Transports "horrid"
- **Distance to trough:** Unknown — Tom says "recession over next year or two"
- **Distance to peak:** PAST peak — "18-year bull run, historically dangerous territory"

### Dashboard Visualization

```
┌──────────────────────────────────────────────────────┐
│  BUSINESS CYCLE POSITION                              │
│                                                       │
│            PEAK                                       │
│           ╱    ╲          ● You are here              │
│          ╱      ╲         │ LATE → CONTRACTION        │
│         ╱        ● ←──────┘                           │
│        ╱    EXP    ╲                                  │
│  TROUGH              TROUGH                           │
│     REC                                               │
│                                                       │
│  Phase: Late Cycle → Contraction                      │
│  Confidence: 78% (based on 8 leading indicators)      │
│  Tom's call: "Recession over next year or two"         │
│                                                       │
│  LEADING INDICATORS                                   │
│  Yield curve:     Un-inverting ⚠️ (recession signal)   │
│  MOVE Index:      Accelerating 🔴 (stress)             │
│  Commodity chain: Gold✅ Copper⚠️ Energy✅ Ag🔄          │
│  Transports:      "Horrid" 🔴                          │
│  Sector rotation: Defensives leading ⚠️                │
│                                                       │
│  HISTORICAL ANALOG                                    │
│  Most similar to: 2007 Q3 (r=0.87)                    │
│  What happened next: Contraction began Oct 2007        │
│  Duration: 18 months to trough (Jun 2009)              │
└──────────────────────────────────────────────────────┘
```

### Two Layers Working Together

| Layer | Timeframe | Question | Updates |
|-------|-----------|----------|---------|
| **Business Cycle** | Months to years | "Where are we structurally? What phase comes next?" | Weekly |
| **Tactical Regime** | Days to weeks | "What's the trading environment RIGHT NOW? What rules apply?" | Daily/intraday |

The cycle tells you the **structural bias** (late cycle = defensive tilt, reduce risk). The regime tells you the **tactical action** (CRISIS = 25% position size, exit below SMA20).

Together: "We're in LATE CYCLE transitioning to CONTRACTION (structural). Currently in CRISIS regime (tactical). This means: defensive sectors only, minimal position sizing, wait for MOVE to collapse before adding."

### Tickers to Add for Cycle Analysis

| Ticker | What | Status |
|--------|------|--------|
| `^TNX` | 10-Year Treasury Yield | Need to add |
| `^IRX` | 13-Week Treasury Bill | Need to add (for yield curve) |
| `^FVX` | 5-Year Treasury Yield | Nice to have |
| `XHB` | Homebuilders ETF | Housing cycle proxy |
| `IGV` | Software ETF | Tom tracks for tech recovery signal |

## 10. Missing Data (Tier 2-3, Future)

| Signal | Source | Cost | Priority |
|--------|--------|------|----------|
| Put/Call ratio | CBOE daily | Free | High — add to pipeline |
| A/D line | Compute from breadth data | Free | High — already have data |
| SentimenTrader | Subscription | $50/mo | Medium |
| Dark pool data | Volume Leaders | $50/mo | Medium |
| GEX/Gamma | MenthorQ | Paid | Low |
| NAAIM Exposure | NAAIM.org | Free (weekly) | Medium |
| Vanda retail flows | Vanda Research | Paid | Low |
