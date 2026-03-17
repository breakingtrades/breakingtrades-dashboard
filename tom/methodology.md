# BreakingTrades Methodology

> The complete trading framework used by Tom and all BreakingTrades analysis.

---

## The 6-Layer Decision Stack

Every trade decision flows through six layers, top to bottom. **Never skip a layer.** A beautiful chart in a terrible macro environment is a trap.

### Layer 1: Macro Regime

**Question:** Is the market environment favorable for risk-taking?

**Classification:**
- **Risk-On:** VIX < 20, pair ratios trending up, yields stable or falling, DXY stable or falling. Favor longs, use normal position sizes.
- **Risk-Off:** VIX > 25, pair ratios declining, yields spiking, DXY surging. Reduce exposure, favor cash, short setups, or defensive sectors.
- **Transitional:** Mixed signals. Reduce size, tighten stops, be selective.

**Indicators checked:**
| Indicator | Risk-On | Risk-Off |
|-----------|---------|----------|
| VIX | < 20, declining | > 25, rising |
| DXY | Stable/falling | Rising sharply |
| 10Y Yield | Stable < 4.5% | Spiking > 4.5% |
| 2s10s Spread | Normalizing | Deeply inverted or rapidly steepening |
| SPY EMA alignment | Bullish stack | Bearish stack |

---

### Layer 2: Sector Rotation

**Question:** Where is money flowing? Offense or defense?

**Framework:**
- **Offensive sectors (risk-on):** XLK (Tech), XLY (Consumer Disc), XLC (Communications), XLI (Industrials)
- **Defensive sectors (risk-off):** XLU (Utilities), XLP (Consumer Staples), XLV (Healthcare), XLRE (Real Estate)
- **Cyclical signals:** XLE (Energy), XLF (Financials), XLB (Materials) — follow economic cycle

**Pair Ratios (the core of sector analysis):**

#### XLY/XLP — Risk Appetite Gauge
- **Rising ratio:** Consumer discretionary outperforming staples → consumers are spending on wants, not just needs → risk-on
- **Falling ratio:** Staples outperforming → defensive posture → risk-off
- **How to use:** Confirm macro regime. If XLY/XLP is falling while SPY is rising, that divergence is a warning.

#### HYG/SPY — Credit Stress Signal
- **Rising or flat ratio:** High yield bonds keeping pace with equities → credit markets healthy → risk-on
- **Falling ratio:** Bonds underperforming → credit stress emerging → early warning of equity weakness
- **How to use:** This is the "canary in the coal mine." If HYG/SPY breaks down before SPY does, reduce equity exposure.

#### XLK/XLU — Growth vs. Defense
- **Rising ratio:** Tech outperforming utilities → growth favored → risk-on
- **Falling ratio:** Utilities outperforming tech → capital rotating to safety → risk-off
- **How to use:** Confirms the direction of sector rotation. In a healthy bull market, XLK/XLU should be trending up.

#### Copper/Gold — Economic Expansion Signal
- **Rising ratio:** Copper (industrial demand) outperforming gold (safe haven) → economic expansion
- **Falling ratio:** Gold outperforming copper → contraction fears → risk-off
- **How to use:** Slower-moving signal. Good for identifying multi-week regime shifts.

**Sector Relative Strength Process:**
1. Rank all 11 sector ETFs by 20-day performance
2. Identify which sectors have bullish EMA alignment
3. Favor individual stocks from the top 3-4 sectors
4. Avoid stocks from bottom 3-4 sectors unless they have exceptional individual setups

---

### Layer 3: Individual Stock Analysis

**Question:** Does this specific stock have an actionable setup?

**EMA Alignment (Primary Signal):**
```
BULLISH STACK:  Price > EMA 8 > EMA 21 > EMA 50
                → All moving averages rising
                → Each shorter EMA above the longer ones
                → Strongest trending condition

BEARISH STACK:  Price < EMA 8 < EMA 21 < EMA 50
                → All moving averages falling
                → Strongest downtrend condition

MIXED:          Any other arrangement
                → Trend is unclear or transitioning
                → Reduce size or wait for clarity
```

**Why EMA 8 / 21 / 50?**
- **EMA 8:** Short-term momentum. Fastest to react. First to cross.
- **EMA 21:** Intermediate trend. ~1 month of trading. The "pullback EMA" in strong trends.
- **EMA 50:** Medium-term trend. ~2.5 months. Last line of defense in a pullback.

**Key Level Identification:**
1. Current EMA 8, 21, 50 values
2. 6-month high and low
3. 52-week high (resistance benchmark)
4. Prior support/resistance (swing highs/lows)
5. Round numbers (psychological levels: $50, $100, $200)

**RSI (14-period):**
- RSI > 70: Overbought — don't chase, wait for pullback
- RSI 50-70: Healthy uptrend momentum — entries on pullbacks are valid
- RSI 30-50: Weak or transitioning — needs EMA confirmation
- RSI < 30: Oversold — potential reversal, but don't catch falling knives without EMA alignment

**Volume Confirmation:**
- Breakouts should occur on above-average volume (> 1.5x 20-day average)
- Pullbacks on declining volume are healthy (low selling pressure)
- Rallies on declining volume are suspect (distribution)

---

### Layer 4: Risk Assessment

**Question:** How much can I risk on this trade?

**Position Sizing Rules:**
- **Max risk per trade:** 1-2% of account equity
- **Calculation:** Position Size = Risk Amount / (Entry - Stop)
- **Correlation check:** If already long 3 tech stocks, a 4th tech long adds correlated risk
- **Account heat:** Total open risk across all positions should not exceed 6-8%

**VIX-Adjusted Sizing:**
| VIX Range | Size Adjustment |
|-----------|----------------|
| < 15 | Full size (but beware complacency) |
| 15-20 | Full size |
| 20-25 | 75% size |
| 25-35 | 50% size |
| > 35 | 25% size or flat |

**Risk Factors to Check:**
- [ ] Earnings date within 2 weeks? → Reduce size or avoid
- [ ] Fed meeting / CPI / Jobs report this week? → Reduce size on macro-sensitive names
- [ ] Stock is in bottom 3 sectors by relative strength? → Extra scrutiny
- [ ] Already have 3+ positions in same sector? → Skip or reduce

---

### Layer 5: Entry Criteria

**Question:** Is now the right time to enter?

**Primary Entry: EMA Pullback**
1. Stock has bullish EMA alignment (Layer 3 confirmed)
2. Price pulls back to touch or approach EMA 8 or EMA 21
3. Pullback occurs on declining volume (healthy profit-taking, not distribution)
4. Candle shows rejection at EMA level (wick below, close above)
5. Enter on the next candle's open or on a break above the pullback candle's high

**Secondary Entry: Breakout**
1. Stock consolidates below a key resistance level
2. Volume contracts during consolidation (coiling)
3. Breakout candle closes above resistance on > 1.5x average volume
4. Enter on close or next-day open
5. Stop below consolidation low

**Entry Checklist:**
- [ ] Macro regime supports this direction (Layer 1)
- [ ] Stock's sector is leading or neutral (Layer 2)
- [ ] EMA alignment confirmed (Layer 3)
- [ ] Position size calculated (Layer 4)
- [ ] Entry trigger present (pullback or breakout)
- [ ] Stop loss level identified before entry
- [ ] At least 2:1 R:R to first target

---

### Layer 6: Position Management

**Question:** How do I manage this trade once I'm in?

**Stop Loss Placement:**
- **EMA pullback entry:** Stop below EMA 21 (or the next EMA level)
- **Breakout entry:** Stop below consolidation low
- **Never move stops further from entry** — only tighten
- **Hard stop:** Always use a stop-loss order. Mental stops don't count.

**Target Setting:**
- **Target 1:** Prior resistance / swing high (take 1/3 off)
- **Target 2:** 6-month high / measured move (take 1/3 off)
- **Target 3:** Trailing stop — let remaining position ride with stop at breakeven or EMA 21

**Scaling Plan:**
```
Entry:    Full position at entry price
Target 1: Sell 1/3, move stop to breakeven
Target 2: Sell 1/3, trail stop at EMA 21
Runner:   Trail remaining 1/3 at EMA 50 or exit on EMA cross
```

**Exit Signals (Close Regardless of Targets):**
- EMA 8 crosses below EMA 21 (trend weakening)
- RSI divergence (price making new highs, RSI declining)
- Volume spike on down day (institutional selling)
- Macro regime shifts to risk-off (Layer 1 override)

---

## Quick Reference Card

```
┌─────────────────────────────────────────────┐
│         BreakingTrades Decision Stack         │
├─────────────────────────────────────────────┤
│ 1. MACRO    Is the environment favorable?    │
│ 2. SECTOR   Where is money flowing?          │
│ 3. STOCK    Does the chart set up?           │
│ 4. RISK     How much can I lose?             │
│ 5. ENTRY    Is the timing right?             │
│ 6. MANAGE   How do I handle the trade?       │
├─────────────────────────────────────────────┤
│ EMA BULL:  Price > EMA8 > EMA21 > EMA50     │
│ EMA BEAR:  Price < EMA8 < EMA21 < EMA50     │
│ ENTRY:     Pullback to EMA8/21 on low volume│
│ STOP:      Below next EMA level              │
│ TARGETS:   Prior resistance → 6M high → trail│
│ R:R MIN:   2:1 to first target               │
├─────────────────────────────────────────────┤
│ PAIR RATIOS:                                 │
│  XLY/XLP ↑ = risk-on    ↓ = risk-off       │
│  HYG/SPY ↑ = healthy    ↓ = credit stress  │
│  XLK/XLU ↑ = growth     ↓ = defense        │
│  Cu/Au   ↑ = expansion  ↓ = contraction    │
└─────────────────────────────────────────────┘
```

---

_BreakingTrades methodology. For educational purposes only. Not financial advice._
_Last updated: 2026-03-17_
