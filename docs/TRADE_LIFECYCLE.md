# Trade Status Lifecycle — BreakingTrades Dashboard

## Overview

Every ticker on the watchlist has a **status** that determines how it's displayed, sorted, and what signals the user sees. Status transitions are computed automatically by the export pipeline based on price vs key levels.

---

## Status Definitions

### 1. 👁 WATCHING
**Meaning:** On radar but no actionable setup yet.

**Criteria:**
- Ticker is in the watchlist but doesn't meet any other status criteria
- No defined entry zone, OR price is far (>5%) from entry zone
- May or may not have a directional bias

**Display:** Gray left border, lowest priority in sort order.

**What user sees:** Ticker, price, bias badge, brief note.

---

### 2. 🟡 APPROACHING
**Meaning:** Price is moving toward an entry zone — get ready.

**Criteria:**
- Has a defined entry zone (price range)
- Current price is within **1–5%** of the entry zone boundary
- Price is moving TOWARD the entry (closing the gap over recent sessions)

**Display:** Orange left border, gentle pulse animation. Distance to entry shown prominently.

**What user sees:** Entry zone, distance %, range bar, SMA levels, Analysis.

**Signals:**
- `APPROACHING_LONG` — price dropping toward a buy zone from above
- `APPROACHING_SHORT` — price rising toward a short zone from below

---

### 3. 🟠 RETEST ⭐ (NEW — the money signal)
**Meaning:** A breakout stock is pulling back to retest its breakout level. This is the highest-conviction entry signal in the methodology.

**Criteria (LONG retest):**
- Stock previously broke above a key level (SMA20, SMA50, resistance, or Weekly SMA20)
- Price has pulled back TO or NEAR that level (within 1.5%)
- The level it broke above is now acting as **support** (price is AT or just above it)
- RSI is NOT overbought (< 70)

**Criteria (SHORT retest — bearish):**
- Stock broke below a key level
- Price has bounced back up TO that level (within 1.5%)  
- The broken level is now acting as **resistance** (price is AT or just below it)

**Detection logic:**
```
For each key level (SMA20, SMA50, Weekly_SMA20, defined resistance/support):
  1. Was price ABOVE this level 5-10 sessions ago? (breakout confirmation)
  2. Is price NOW within 1.5% of this level? (retest zone)
  3. Is price approaching FROM the right direction? (pullback, not breakdown)
  
  RETEST_LONG:  was_above[5-10d] AND now within +1.5% AND price > level
  RETEST_SHORT: was_below[5-10d] AND now within -1.5% AND price < level
```

**Specific retest patterns to detect:**

| Pattern | Breakout Level | Retest Signal |
|---------|---------------|---------------|
| **SMA20 Retest** | Price broke above daily SMA20 | Pulled back to SMA20, holding above |
| **SMA50 Retest** | Price broke above daily SMA50 | Pulled back to SMA50, holding above |
| **Weekly 20 Retest** | Price broke above weekly SMA20 | Pulled back to W20, this is Tom's big one |
| **Resistance→Support Flip** | Price broke above defined resistance | Pulling back to that level as new support |
| **Bearish SMA20 Retest** | Price broke below SMA20 | Bounced to SMA20 from below, rejected |

**Display:** Orange-red left border, **strong pulse animation** (this is THE signal). Shows:
- Which level is being retested and from what direction
- "RETESTING SMA20 at $X.XX" or "RETESTING WEEKLY 20 at $X.XX"
- Distance from retest level
- Whether it's holding (last close above/below)
- Volume comparison (is retest on lower volume than breakout? = healthy)

**Sort priority:** HIGHEST — retests go above everything except active alerts.

---

### 4. ✅ TRIGGERED
**Meaning:** Entry conditions met — the setup just fired.

**Criteria:**
- Price entered the defined entry zone AND
- Confirmation signal present (close above SMA20, or retest held, or volume spike)
- Triggered within last 3 trading sessions

**Display:** Green left border, "NEW" badge. Auto-clears to ACTIVE after 3 sessions.

**What user sees:** Entry price, stop loss, targets, R:R, position sizing suggestion.

---

### 5. 🟢 ACTIVE — Bullish Stack
**Meaning:** Setup is working. Price above all key MAs. Trend intact.

**Criteria:**
- Price > SMA20 > SMA50 (daily)
- Price > Weekly SMA20
- Not recently triggered (>3 sessions since entry)

**Sub-states:**

#### 5a. 🟢 ACTIVE — Normal
- Full bullish stack, trending normally
- Stop at SMA20 or defined stop level

#### 5b. 📈 ACTIVE — Trailing (Raise Stop)
- Price extended >5% above SMA20 OR RSI > 70 (overbought)
- Signal: "Raise stop to SMA20" or "Consider partial profit at T1"
- Tom's rule: don't chase extended names, trail them

#### 5c. 🎯 TARGET HIT
- Price reached Target 1 or Target 2
- Signal: "T1 hit — take partial, trail rest" or "T2 hit — consider full exit"
- Gold left border, celebration state

---

### 6. ⚠️ EXIT SIGNAL
**Meaning:** The trade's thesis is breaking down. Act now.

**Criteria (in order of severity):**

#### 6a. ⚠️ BELOW SMA20 (Warning)
- Daily close below SMA20
- Tom's #1 rule: "Daily close below 20 MA = exit"
- This is a WARNING — could be a shakeout

#### 6b. 🔴 BELOW SMA50 (Serious)  
- Daily close below SMA50
- Trend structure damaged
- Need SMA20 reclaim to recover

#### 6c. 🔴 BELOW WEEKLY 20 (Critical)
- Below Weekly SMA20
- Major trend break — this is the "get out" signal
- Takes weeks to repair

#### 6d. 🔴 STOP HIT
- Price hit defined stop loss level
- Auto-transitions to STOPPED

---

### 7. 🛑 STOPPED
**Meaning:** Trade is done. Stop was hit or thesis invalidated.

**Criteria:**
- Price closed below stop level, OR
- Manual override (Tom called it done)

**Display:** Red left border, 60% opacity (de-emphasized). Shows P&L from entry if tracked.

**Transition:** After 5 sessions, moves to WATCHING (can set up again).

---

### 8. ❄️ DORMANT  
**Meaning:** Was watching but hasn't shown any actionable movement in >20 sessions.

**Criteria:**
- No status change in 20+ trading sessions
- ATR (Average True Range) declining (low volatility)
- RSI between 40-60 (no momentum)

**Display:** Dimmed, collapsed to single line. Sorted last.

---

## Retest Detection — Deep Spec

### The Core Insight
Tom's highest-conviction entries are NOT breakouts — they're **breakout retests**. The sequence:
1. Stock breaks above a level (SMA20, SMA50, resistance)
2. It runs up, extends
3. It pulls back to TEST that level from above
4. The level holds → ENTRY

This is where the smart money enters. The breakout proved the level matters. The retest proves buyers are defending it.

### Detection Algorithm

```python
def detect_retest(ticker_data, levels):
    """
    levels = {
        'sma20': 26.98,
        'sma50': 26.46, 
        'weekly_sma20': 26.06,
        'resistance': 27.50,  # optional, from setup definition
        'support': 25.80      # optional
    }
    """
    price = ticker_data['close'][-1]
    
    for level_name, level_price in levels.items():
        # Was price clearly above this level recently? (breakout)
        was_above = any(
            ticker_data['close'][i] > level_price * 1.02  # >2% above = confirmed breakout
            for i in range(-10, -3)  # 3-10 sessions ago
        )
        
        # Is price now at or near the level? (retest zone)
        distance_pct = (price - level_price) / level_price * 100
        at_level = -1.5 <= distance_pct <= 2.0  # within 1.5% below to 2% above
        
        # Is it approaching from above? (pullback, not rally)
        was_higher_recently = ticker_data['close'][-3] > price  # trending down into level
        
        if was_above and at_level and was_higher_recently:
            # Check volume (healthy retest = lower volume than breakout)
            breakout_vol = max(ticker_data['volume'][-10:-3])
            retest_vol = ticker_data['volume'][-1]
            healthy = retest_vol < breakout_vol * 0.8
            
            return {
                'status': 'RETEST',
                'level_name': level_name,
                'level_price': level_price,
                'distance_pct': distance_pct,
                'holding': price > level_price,
                'healthy_volume': healthy,
                'confidence': 'HIGH' if healthy and price > level_price else 'MEDIUM'
            }
    
    return None
```

### Confluence Retests (Highest Conviction)
When MULTIPLE levels converge at the same price zone (within 2% of each other), and price is retesting that zone → **CONFLUENCE RETEST**:

```
SMA20 = $26.98
SMA50 = $26.46  → All within $1 of each other = CONFLUENCE ZONE $26-$27
W20   = $26.06

If price pulls back to $26-$27 zone = CONFLUENCE RETEST (highest conviction)
```

Display: Special "CONFLUENCE" badge + list of converging levels.

---

## Status Transition Diagram

```
                                ┌──────────┐
                    ┌──────────▶│ DORMANT  │ (>20 sessions no change)
                    │           └──────────┘
                    │
┌──────────┐    ┌───┴──────┐    ┌────────────┐    ┌───────────┐
│ WATCHING │───▶│APPROACHING│───▶│ TRIGGERED  │───▶│  ACTIVE   │
└──────────┘    └──────────┘    └────────────┘    └─────┬─────┘
     ▲               │                                   │
     │               │              ┌────────────┐       │ (extended/RSI>70)
     │               ▼              │  TRAILING  │◀──────┘
     │          ┌──────────┐        └─────┬──────┘
     │          │  RETEST  │              │ (target hit)
     │          └──────────┘        ┌─────▼──────┐
     │               │              │ TARGET HIT │
     │               ▼              └────────────┘
     │          (holds → TRIGGERED)        │
     │          (fails → EXIT SIGNAL)      │
     │                                     ▼
     │          ┌──────────────────────────────┐
     │          │        EXIT SIGNAL           │
     │          │  ⚠️ Below SMA20 (warning)    │
     │          │  🔴 Below SMA50 (serious)    │
     │          │  🔴 Below W20 (critical)     │
     │          │  🔴 Stop hit                 │
     │          └──────────────┬───────────────┘
     │                         │
     │                   ┌─────▼──────┐
     └───────────────────│  STOPPED   │ (after 5 sessions → WATCHING)
                         └────────────┘
```

---

## Sort Order (Dashboard Display)

Priority from top to bottom:
1. **🟠 RETEST** — highest conviction signal, needs immediate attention
2. **✅ TRIGGERED** — just fired, still fresh
3. **🟡 APPROACHING** — getting close to actionable
4. **📈 TRAILING** — manage active position
5. **🎯 TARGET HIT** — take action on profit
6. **⚠️ EXIT SIGNAL** — protect capital
7. **🟢 ACTIVE** — running fine, monitor
8. **👁 WATCHING** — radar
9. **❄️ DORMANT** — collapsed/hidden
10. **🛑 STOPPED** — archived

---

## Filter Tabs (Dashboard UI)

| Tab | Includes | Badge Color |
|-----|----------|-------------|
| **All** | Everything | — |
| **🔥 Hot** | RETEST + TRIGGERED + APPROACHING | Orange |
| **🟢 Active** | ACTIVE + TRAILING + TARGET HIT | Green |
| **⚠️ Exit** | All EXIT SIGNAL sub-states | Red |
| **👁 Watch** | WATCHING + DORMANT | Gray |
| **🛑 Closed** | STOPPED (last 20 sessions) | Dim |

---

## Signal Notifications (Future — Phase 2)

When status transitions happen, these should generate alerts:

| Transition | Alert Priority | Message |
|-----------|---------------|---------|
| ANY → RETEST | 🔴 HIGH | "PFE retesting SMA50 at $26.46 — entry zone" |
| ANY → TRIGGERED | 🔴 HIGH | "XLU triggered — entry at $45.50" |
| APPROACHING → within 1% | 🟡 MEDIUM | "ABBV 0.7% from entry zone" |
| ACTIVE → EXIT (below SMA20) | 🔴 HIGH | "AAPL closed below SMA20 — exit signal" |
| ACTIVE → TRAILING (RSI>70) | 🟡 MEDIUM | "AR overbought RSI 83 — trail stop" |
| ACTIVE → TARGET HIT | 🟢 INFO | "DELL hit T1 at $160 — partial profit" |

---

## Configuration per Ticker

Each ticker in `data/setups.json` can have these optional fields:

```json
{
  "symbol": "PFE",
  "name": "Pfizer",
  "sector": "Healthcare",
  "direction": "LONG",
  
  "entry_zone": [25.80, 26.20],
  "stop_loss": 24.50,
  "target_1": 28.00,
  "target_2": 29.50,
  
  "key_levels": {
    "resistance": 27.50,
    "support": 25.00,
    "weekly_200": 24.00
  },
  
  "thesis": "Healthcare relative strength + SMA compression zone",
  "invalidation": "Daily close below $24.50",
  "source": "community_trade",
  
  "retest_watch": ["sma20", "sma50", "weekly_sma20"],
  "confluence_zone": [26.00, 27.00]
}
```

Fields like `sma20`, `sma50`, `weekly_sma20`, `rsi` are **computed** by the export script, not manually entered.

---

## Key Rules (from methodology)

1. **Daily close below SMA20 = exit.** Not intraday, not a wick — the CLOSE.
2. **Retests on lower volume = healthy.** High volume retest = supply zone, be careful.
3. **Confluence retests are the highest conviction.** Multiple levels at same price = institutional defense.
4. **Don't chase extended names.** RSI > 70 = trail, don't add. Wait for retest.
5. **Weekly SMA20 is the big one.** If a stock holds its Weekly 20 on a pullback, that's a major structural support.
6. **SMA20 acts as dynamic support in uptrends, resistance in downtrends.** A reclaim of SMA20 from below is bullish; a rejection at SMA20 from below is bearish.
