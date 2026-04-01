# OpenSpec: Regime Intelligence Dashboard (Autoresearch Tab)

> **Status:** Planned
> **Priority:** High
> **Author:** Kash + Idan
> **Date:** 2026-03-31
> **Location:** `v2/js/pages/autoresearch.js` (replace current empty page)
> **Data Sources:** Existing `data/*.json` + new `data/regime.json` + `data/regime-history.jsonl`

---

## 1. Problem Statement

The Autoresearch tab is currently an empty page waiting for backtesting data. Meanwhile:

- Market regime signals are scattered across 6 pages (F&G on market+signals, VIX on market, breadth on market, pairs on signals, sector rotation on market)
- The signals page has hardcoded "CRISIS" / "EXTREME" regime cards — not computed, never updates
- Tom's 75 rules (R001-R075) encode a complete regime-aware decision framework but it lives in a text file, not the dashboard
- The backtest engine (`backtest_v2.py`) has VIX/F&G/MA regime filters as toggleable configs but they're not connected to a live regime classification
- No single view answers: "What regime are we in? What rules apply? What's the playbook?"

## 2. Architecture

```
Existing Data Pipeline (unchanged)
├── prices.json (95 tickers incl. 18 regime tickers — DONE)
├── fear-greed.json
├── vix.json
├── breadth.json
├── sector-rotation.json
├── sector-risk.json
├── watchlist.json (SMA50 for pair ratios)
└── expected-moves.json

New: Regime Computation (EOD pipeline addition)
├── scripts/update-regime.py     ← Reads all above, computes regime score
├── data/regime.json             ← Current regime snapshot
└── data/regime-history.jsonl    ← Daily regime log (append-only)

Dashboard (v2/js/pages/autoresearch.js → becomes regime page)
├── Current Regime card (computed, not hardcoded)
├── Regime Components breakdown
├── Active Tom Rules for current regime
├── Playbook card
├── Regime History timeline
├── Transition Signals checklist
├── Market Internals grid
└── (Future) Autoresearch validation per regime
```

## 3. Regime Classification Model

### Input Signals (Tier 1 — all free, all in `prices.json` now)

| Signal | Ticker | Weight | Bearish Threshold | Bullish Threshold |
|--------|--------|--------|-------------------|-------------------|
| **MOVE Index** | `^MOVE` | 20% | >100 (accelerating) | <80 (collapsing) |
| **VIX** | `^VIX` | 12% | >30 (fear) | <15 (complacent) |
| **Fear & Greed** | `fear-greed.json` | 12% | <25 (extreme fear) | >75 (extreme greed) |
| **Market Breadth** | `breadth.json` | 10% | <25% (oversold) | >75% (overbought) |
| **S&P vs D200** | `^GSPC` vs SMA200 | 10% | Below D200 | Above D200 |
| **HYG/SPY ratio** | computed | 8% | Falling >1% below SMA50 | Rising >1% above SMA50 |
| **DXY** | `DX-Y.NYB` | 6% | Rising (risk-off) | Falling (risk-on) |
| **Growth/Value** | IWF/IWD ratio | 5% | Value leading (defensive) | Growth leading (risk-on) |
| **RSP/SPY breadth** | RSP/SPY ratio | 5% | Falling (narrow market) | Rising (broad market) |
| **Yield curve** | US02Y/US10Y | 4% | Inverted or un-inverting | Normal spread |
| **Copper/Gold** | CPER/GLD ratio | 4% | Falling (risk-off) | Rising (risk-on) |
| **International** | DAX+KOSPI+HSI avg | 4% | All breaking down | All holding/rising |

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

## 6. Implementation Plan

### Phase 1: Regime Computation Pipeline
1. `scripts/update-regime.py` — reads all data files, computes regime score, writes `data/regime.json` + appends to `data/regime-history.jsonl`
2. Add to EOD pipeline (`eod-update.sh`) — runs AFTER prices + F&G + VIX + breadth
3. Add to intraday pipeline — runs after price updates (4×/day)

### Phase 2: Dashboard Page
4. Rewrite `v2/js/pages/autoresearch.js` → regime intelligence dashboard
5. Add `v2/css/autoresearch.css` → regime page styles (cards, gauges, internals grid, timeline)
6. Regime score gauge (similar to F&G gauge — semicircle with needle)
7. Component cards grid (MOVE, VIX, F&G, breadth, etc.)
8. Playbook card + Active Rules card
9. Market Internals grid (international indices, commodity chain)
10. Transition signals checklist
11. Regime history timeline (Chart.js area chart)

### Phase 3: Feed Into Signals Page
12. Replace hardcoded "CRISIS" / "EXTREME" regime cards with data from `regime.json`
13. Regime badge in nav bar (small colored dot showing current regime)

### Phase 4: Autoresearch Integration (Future)
14. Tag backtest periods by regime
15. Run regime-specific config optimization
16. Display backtest proof per regime

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

## 9. Missing Data (Tier 2-3, Future)

| Signal | Source | Cost | Priority |
|--------|--------|------|----------|
| Put/Call ratio | CBOE daily | Free | High — add to pipeline |
| A/D line | Compute from breadth data | Free | High — already have data |
| SentimenTrader | Subscription | $50/mo | Medium |
| Dark pool data | Volume Leaders | $50/mo | Medium |
| GEX/Gamma | MenthorQ | Paid | Low |
| NAAIM Exposure | NAAIM.org | Free (weekly) | Medium |
| Vanda retail flows | Vanda Research | Paid | Low |
