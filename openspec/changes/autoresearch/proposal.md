# Autoresearch — Autonomous Strategy Optimization

> Status: **Proposed**
> Date: 2026-03-29
> Priority: High
> Inspired by: Karpathy's autoresearch pattern (modify → run → measure → keep/revert)

## Problem

BreakingTrades strategy has ~15 tunable parameters (EMA periods, ATR stop, SMA exit, macro filters, etc.) but we've never systematically optimized them. Manual backtesting is slow. We need an automated loop that runs experiments overnight and reports what works.

## Solution

An autonomous optimization loop that:
1. Modifies strategy parameters (the agent proposes changes)
2. Runs `backtest_v2.py` against a benchmark set of tickers
3. Measures composite score (win rate, profit factor, return, drawdown)
4. Keeps winning configs (git commit), reverts losers
5. Reports results on a dashboard page + Telegram summary

## Architecture

### Four New Capabilities

#### 1. Volume Profile Range (VPR) — `backtest_v2.py` enhancement
- `compute_volume_profile(df, lookback, bins, va_pct)` → POC, VAH, VAL
- Uses daily candles (OHLCV) — distributes volume across price range per bar
- Entry filter modes: `none` / `above_val` / `above_poc` / `breakout_vah`
- Stop enhancement: `atr_only` / `val_stop` / `min(atr, val)`
- Optimizable params: lookback (20/50/100/200), bins (50/100/200), VA% (68/70/80), filter mode, stop mode

#### 2. Tom's Rule Filters — `backtest_v2.py` enhancement
Tier 1 rules (data available today):
- **R006/R042/R054:** MA regime — D200 + W50 alignment as entry gate
- **R041:** VIX > 25 → skip single stocks, majors only
- **R013:** Fear & Greed extremes → reduce/increase exposure
- **R001/R040:** HYG breakdown → reduce equity exposure
- **R058:** XLY/XLP ratio → consumer stress signal (already partially in macro filter)
- **R045:** Copper breakdown → economic warning
- **R035:** Break 20W → expect test of 50W

Each rule is an on/off toggle + threshold. Agent experiments with combinations.

#### 3. Dark Pool Volume Filter — new data source
- Source: ChartExchange (FINRA TRF data, free, daily)
- Scraper: `scripts/scrape-darkpool.py` → `data/darkpool/`
- Signal: `dp_volume / total_volume` ratio vs rolling average
- Entry filter: only buy when DP% > N-day avg (institutional accumulation)
- Exit filter: DP% spike + price decline = distribution warning

#### 4. Autoresearch Skill — `~/.openclaw/workspace/skills/autoresearch/`
Generic loop runner. BT is the first target.

### Benchmark Tickers

**Core 8 (every experiment):**
SPY, QQQ, NVDA, AAPL, IWM, MSFT, XLE, GLD

**Validation 20 (winning configs only):**
TSLA, AMD, META, AMZN, GOOG, JPM, GS, XLF, TLT, COIN, MARA, PLTR, CRWD, LLY, CAT, NFLX, ARM, BABA, SOFI, HOOD

**Full universe (final winner):**
All tickers with 1H data (~100+)

### Scoring Formula

```
composite_score = (
    0.30 * normalize(profit_factor, 0, 5) +
    0.25 * normalize(win_rate, 0, 100) +
    0.25 * normalize(total_return_pct, -50, 200) +
    0.10 * normalize(1 - abs(max_dd)/50, 0, 1) +
    0.10 * normalize(avg_r, -2, 5)
)
```

Cross-ticker composite = mean of per-ticker scores.

### Config File

`autoresearch/configs/bt-strategy.json`:
```json
{
  "version": 1,
  "params": {
    "ema_short": 13,
    "ema_long": 26,
    "sma_exit": 20,
    "atr_stop_mult": 2.0,
    "risk_pct": 0.02,
    "mode": "conservative",
    "entry_tf": "1h",
    "macro_filter": true,
    "macro_threshold": 3,
    "vpr_enabled": false,
    "vpr_lookback": 50,
    "vpr_bins": 100,
    "vpr_va_pct": 70,
    "vpr_entry_filter": "none",
    "vpr_stop_mode": "atr_only",
    "vix_filter": false,
    "vix_threshold": 25,
    "fear_greed_filter": false,
    "fg_extreme_greed": 75,
    "fg_extreme_fear": 25,
    "bond_filter": false,
    "ma_regime_filter": false,
    "darkpool_filter": false,
    "dp_lookback": 20,
    "dp_threshold_mult": 1.1
  }
}
```

### Results Output

`data/autoresearch-results.json`:
```json
{
  "last_run": "2026-03-29T22:00:00Z",
  "experiments_total": 50,
  "experiments_improved": 8,
  "baseline": { "score": 0.52, "config": {...}, "metrics": {...} },
  "best": { "score": 0.78, "config": {...}, "metrics": {...} },
  "history": [
    { "exp": 1, "score": 0.54, "improved": true, "config_diff": {...} },
    ...
  ],
  "per_ticker": {
    "SPY": { "baseline": {...}, "best": {...} },
    ...
  },
  "validation": { "passed": true, "tickers_improved": 16, "tickers_total": 20 },
  "discoveries": [
    "Shorter EMA (10/21) beats 13/26 on 1H entry",
    "VPR above-POC filter eliminated 4 losing trades",
    ...
  ]
}
```

### Dashboard Page

`autoresearch.html` — new page in nav bar:
- Leaderboard table (top configs by score)
- Score progression line chart (experiment # vs score)
- Parameter sensitivity bars
- Baseline vs best comparison cards
- Per-ticker breakdown table
- Equity curves overlay (baseline vs best vs buy-and-hold)
- Last run metadata

Dark theme, vanilla JS, reads `data/autoresearch-results.json`.

### Telegram Summary

Post to Idan's Telegram (chat 403588640) after each batch:
- Best config found + improvement %
- Top 3 discoveries
- Dashboard link

### Git Memory

- Winning experiment → `git commit -m "autoresearch: exp-NNN score=X.XX (+Y.YY)"`
- Losing experiment → `git checkout -- autoresearch/configs/bt-strategy.json`
- Full audit trail in git log

## Build Order

1. VPR module in `backtest_v2.py`
2. Tom's Tier 1 rule filters in `backtest_v2.py`
3. Autoresearch evaluator (`autoresearch/evaluate-bt.py`)
4. Autoresearch runner (`autoresearch/runner.sh`)
5. Autoresearch skill (`~/.openclaw/workspace/skills/autoresearch/SKILL.md`)
6. Dashboard page (`autoresearch.html`)
7. Dark pool scraper (`scripts/scrape-darkpool.py`) — Phase 2
8. First test run on core 8

## Files Created/Modified

### New
- `autoresearch/evaluate-bt.py` — scoring harness
- `autoresearch/runner.sh` — experiment loop
- `autoresearch/configs/bt-strategy.json` — mutable config
- `autoresearch/program.md` — agent instructions
- `autoresearch.html` — dashboard page
- `scripts/scrape-darkpool.py` — ChartExchange scraper
- `data/autoresearch-results.json` — results output
- `~/.openclaw/workspace/skills/autoresearch/SKILL.md`

### Modified
- `backtest_v2.py` — add VPR, Tom's rules, config-driven params, JSON output mode
- `openspec/INDEX.md` — add this change
- Nav bar (all pages) — add Autoresearch link

## Constraints

- `backtest_v2.py` remains the fixed evaluator (autoresearch never modifies it)
- Config JSON is the only mutable file
- Git as memory (commit winners, revert losers)
- Time budget per experiment: 30 sec max (8 tickers)
- No external API calls during backtest (all data local CSV)
