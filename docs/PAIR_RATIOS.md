# Pair Ratios — BreakingTrades Macro Dashboard

## Complete Ratio Set (12 ratios, 5 categories)

### 📊 Core Macro (Tom's Original 4)
| Ratio | What It Measures | Rising = | Falling = |
|-------|-----------------|----------|-----------|
| **XLY/XLP** | Consumer Discretionary vs Staples | Risk-on, consumer strong | Defensive rotation |
| **HYG/SPY** | High Yield vs Equity | Credit healthy | Credit stress — CRITICAL |
| **RSP/SPY** | Equal Weight vs Cap Weight | Breadth expanding, healthy | Narrow leadership, fragile |
| **XLV/SPY** | Healthcare vs Market | Defensive rotation (risk-off) | Offense mode (risk-on) |

### 📈 Risk Appetite (NEW — Idan's additions)
| Ratio | What It Measures | Rising = | Falling = |
|-------|-----------------|----------|-----------|
| **IWM/SPY** | Small Caps vs Large Caps | Risk-on, broad strength | Large cap dominance, narrow |
| **IWM/QQQ** | Small Caps vs Tech | Rotation broadening | Tech concentration risk |

### 🏦 Credit & Bonds
| Ratio | What It Measures | Rising = | Falling = |
|-------|-----------------|----------|-----------|
| **HYG/LQD** | Junk vs Investment Grade | Reach for yield (risk-on) | Flight to quality (stress) |
| **TLT/SPY** | Long Bonds vs Stocks | Flight to safety | Stocks preferred (risk-on) |

### 🏗️ Sector Rotation
| Ratio | What It Measures | Rising = | Falling = |
|-------|-----------------|----------|-----------|
| **XLF/SPY** | Financials vs Market | Economy healthy | CANARY — financial stress |
| **XLE/SPY** | Energy vs Market | Inflation/commodities cycle | Growth mode |

### 🥇 Commodities
| Ratio | What It Measures | Rising = | Falling = |
|-------|-----------------|----------|-----------|
| **GLD/SPY** | Gold vs Stocks | Fear/inflation hedge | Risk-on, stocks preferred |
| **COPPER/GOLD** | Industrial vs Safe Haven | Industrial growth | Fear/deflation |

## Dashboard Display

### Compact Mode (Ratio Strip)
Show all 12 as tiny pills with arrow + 1-word signal:
```
XLY/XLP ↘ defensive | HYG/SPY ↗ healthy | RSP/SPY ↘ narrow | IWM/SPY ↘ fragile | XLF/SPY ↘ canary | XLE/SPY ↗ energy | GLD/SPY ↗ fear
```

### Expanded Mode (Ratio Dashboard Section)
Group by category. Show:
- Ratio value
- SMA 20/50 of ratio
- 1-month % change
- Visual bar (centered at neutral, green right / red left)
- Signal text

### Regime Scorecard
Count red (risk-off) vs green (risk-on) signals:
```
RISK SCORE: 4 🔴 / 2 🟢 / 4 🟡  →  RISK-OFF BIAS
```

This single number summarizes the macro backdrop. When score is >6 red = defensive. >6 green = aggressive.

## IWM/SPY — Why This Matters

IWM (Russell 2000 small caps) vs SPY is the **purest risk appetite signal**:

- Small caps have higher beta, more domestic exposure, more leverage
- When IWM/SPY is falling, institutions are hiding in mega-cap safety
- Currently: **🔴 FALLING** at 0.3721, SMA20 0.3791, SMA50 0.3794, -3.5% 1mo
- This confirms Tom's "narrow leadership" warning — the rally is held up by 5-7 mega caps

IWM/QQQ adds nuance:
- If IWM/QQQ is falling but IWM/SPY is flat → tech specifically leading (not just large caps)
- If both falling → broad risk-off, small caps getting crushed
- Currently: **both falling** → genuine risk-off, not just tech rotation

## Data Availability
All 12 ratios have daily CSV data in `~/projects/breakingtrades/data/` except:
- ❌ IWF/IWD (Growth vs Value ETFs) — need to download
- ⚠️ COPPER/GOLD has a CSV parsing error (line 6400) — needs cleanup

## Export Script Integration
The export script computes all 12 ratios and writes to `data/macro.json`:
```json
{
  "pair_ratios": {
    "xly_xlp": {"value": 1.3203, "sma20": 1.3215, "sma50": 1.4030, "pct_1mo": 1.7, "bias": "FALLING", "signal": "Defensive rotation"},
    "iwm_spy": {"value": 0.3721, "sma20": 0.3791, "sma50": 0.3794, "pct_1mo": -3.5, "bias": "FALLING", "signal": "Large caps dominating"},
    ...
  },
  "regime_score": {"red": 4, "green": 2, "yellow": 4, "bias": "RISK_OFF"}
}
```
