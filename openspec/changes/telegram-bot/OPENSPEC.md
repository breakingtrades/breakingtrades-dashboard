# BreakingTrades Telegram Bot — OpenSpec

> Status: **Draft**
> Created: 2026-04-01
> Author: Kash + Idan

## Problem

BreakingTrades has a rich data pipeline (prices, regime intelligence, expected moves, sector rotation, breadth, VIX, F&G, briefings) and an AI-powered Tom agent — but all output lives on the dashboard website. The only Telegram presence was a collection of ad-hoc scripts that spammed alerts with no coherence or throttling (Hormuz AIS, bt-geo-alerts, market_monitor — all now disabled).

Idan needs a **single, curated Telegram bot** that delivers the right information at the right time — not a firehose.

## Design Philosophy

**Less is more.** The bot should feel like a sharp trading desk assistant, not a Bloomberg terminal vomiting data. Every message should earn its place. If you wouldn't text it to a trading buddy, don't send it.

## Bot Identity

- **Bot:** `@breakingtradesbot` (existing, ID: 8799890279)
- **Channel:** BreakingTradesAlerts (`-1003750832486`)
- **Token:** macOS Keychain, account `breakingtradesbot`
- **Persona:** Data-first, Tom's voice when doing briefings, neutral/factual for alerts

## Message Types (4 total)

### 1. 📊 Daily Briefing (1× per day)

**Schedule:** Mon-Fri, 4:30 PM ET (10 min after EOD pipeline completes)

**Content:** Tom-voiced market summary generated from dashboard data. Covers:
- Regime score + change direction (e.g. "CORRECTION 44 ↓2")
- Key index moves (S&P, Nasdaq, Russell)
- Top movers from watchlist (biggest winners + losers)
- Fear & Greed reading + trend
- VIX level + structure note
- Sector leadership/laggards (top 2 each)
- Expected move alerts (any tickers that breached EM)
- One-liner Tom take (from `briefing.json` or generated)

**Format:** Single Telegram message, HTML parse mode, <4096 chars. No images.

**Source:** `data/briefing.json` + `data/prices.json` + `data/regime.json` + `data/fear-greed.json` + `data/vix.json` + `data/expected-moves.json` + `data/sector-rotation.json`

### 2. 🚨 Market Move Alert (event-driven, throttled)

**Trigger:** Significant intraday moves during market hours (9:30 AM - 4:00 PM ET)

**Thresholds:**
- S&P/Nasdaq/Russell: ±1.5% from open (not from yesterday's close)
- VIX: crosses 25, 30, 40 (level-based, not % change)
- Oil (WTI): ±4% intraday
- Gold: ±2.5% intraday
- Individual watchlist stocks: ±5% intraday (top 20 by market cap only)

**Cooldowns:**
- Same ticker: 2 hours minimum between alerts
- Global: max 5 alerts per day (hard cap — pick highest impact)
- VIX level alerts: once per level per day (crossing 30 once = alert, bouncing around 30 = silence)

**Format:** Short, punchy. 2-4 lines max.
```
🚨 S&P -1.8% from open (6,382 → 6,267)
VIX surging to 28.4 (+22%)
Regime: CORRECTION (44)
```

**NOT triggered by:** Pre-market, after-hours, overnight futures, crypto (unless BTC ±8%)

### 3. 🎯 Trading Strategy Update (event-driven, rare)

**Trigger:** Regime change (score crosses a boundary, e.g. CORRECTION → BEAR)

**Content:**
- Old regime → New regime with scores
- What changed (which signals flipped)
- Tom's playbook for the new regime (from `REGIME_RULES` + `PLAYBOOKS` in `update-regime.py`)
- Key levels to watch
- Position sizing guidance change

**Frequency:** Only fires on actual regime transitions. Expected: 1-3× per month in volatile markets, could go weeks without one in stable regimes.

**Format:** Longer message (up to 4096 chars). Structured with sections.

### 4. 📈 Status Update (3× per day)

**Schedule:**
- 9:35 AM ET — **Pre-market snapshot** (futures, overnight moves, key levels for the day)
- 12:00 PM ET — **Midday pulse** (morning movers, any EM breaches, sector rotation update)  
- 8:00 PM ET — **Evening wrap** (shorter version of daily briefing for days when you just want a quick glance, plus overnight calendar — earnings, FOMC, data releases)

**Content:** Compact, 3-5 bullet points max per update. Not a briefing — a pulse check.

**Format:**
```
📈 Midday Pulse — Apr 1
• S&P +0.3% (6,412) — testing 6,430 resistance
• VIX 24.1 (-5%) — MOVE crushed ✅ (Tom's first bottom signal)
• XLE leading (+1.2%), XLK lagging (-0.4%)
• 3 tickers breached weekly EM: NVDA ↓, TSLA ↑, MU ↑
• F&G: 18 (Extreme Fear) — unchanged
```

## Architecture

### Single Script: `bt-telegram-bot.py`

One Python script handles everything. No microservices, no separate alert monitors.

```
bt-telegram-bot.py
├── briefing()      — reads data/, formats, sends (called by cron)  
├── market_alert()  — polls prices, checks thresholds, sends (called by cron)
├── regime_watch()  — reads regime.json, detects transitions, sends
├── status_update() — reads data/, formats pulse, sends (called by cron)
└── main()          — CLI dispatcher: --briefing | --alert-check | --status | --regime-check
```

### Scheduling

| Function | Trigger | How |
|----------|---------|-----|
| Daily Briefing | 4:30 PM ET Mon-Fri | OpenClaw cron (isolated agent) OR system cron |
| Market Alerts | Every 2 min during market hours | System cron (lightweight, no LLM) |
| Regime Watch | After every EOD pipeline run | Called at end of `eod-update.sh` |
| Status 9:35 AM | 9:35 AM ET Mon-Fri | OpenClaw cron or system cron |
| Status 12:00 PM | 12:00 PM ET Mon-Fri | OpenClaw cron or system cron |
| Status 8:00 PM | 8:00 PM ET Mon-Fri | OpenClaw cron or system cron |

### Data Flow

```
EOD pipeline (eod-update.sh)
    → data/*.json (prices, regime, F&G, VIX, sectors, EM, breadth)
    → bt-telegram-bot.py reads JSON files
    → formats messages
    → sends via Telegram Bot API
```

No new data collection. No new APIs. The bot is a **consumer** of the existing pipeline.

### State Management

Single state file: `data/telegram-bot-state.json`
```json
{
  "last_briefing": "2026-04-01T20:30:00Z",
  "last_status": {
    "premarket": "2026-04-01T13:35:00Z",
    "midday": "2026-04-01T16:00:00Z",
    "evening": "2026-04-01T00:00:00Z"
  },
  "alert_cooldowns": {
    "SPY": "2026-04-01T15:22:00Z",
    "VIX_30": "2026-04-01T14:10:00Z"
  },
  "alerts_today": 3,
  "alerts_today_date": "2026-04-01",
  "last_regime": "CORRECTION",
  "last_regime_score": 44
}
```

### Config

Extend existing `config.json` in `market-alerts/` or create `telegram-bot-config.json` in dashboard repo:

```json
{
  "telegram": {
    "bot_token_keychain_account": "breakingtradesbot",
    "chat_id": "-1003750832486"
  },
  "schedules": {
    "briefing": "16:30",
    "status_premarket": "09:35",
    "status_midday": "12:00",
    "status_evening": "20:00"
  },
  "thresholds": {
    "index_pct": 1.5,
    "vix_levels": [25, 30, 40],
    "oil_pct": 4.0,
    "gold_pct": 2.5,
    "stock_pct": 5.0
  },
  "cooldowns": {
    "same_ticker_hours": 2,
    "max_alerts_per_day": 5
  }
}
```

## What This Replaces

| Old | New |
|-----|-----|
| `market_monitor.py` (dead, spammy) | `bt-telegram-bot.py --alert-check` (throttled, 5/day cap) |
| `trump_monitor.py` (dead) | Removed — Trump events flow through regime/briefing naturally |
| `bt-geo-alerts.py` (23 events then stopped) | Removed — geopolitical impact captured in regime scoring |
| Hormuz AIS Collector cron (spammer) | Disabled ✅ — AIS data still in dashboard, no Telegram spam |
| `market-alerts/` folder | Deprecated — `bt-telegram-bot.py` lives in `breakingtrades-dashboard/scripts/` |

## What This Does NOT Do

- ❌ No real-time streaming (WebSocket) — polling at 2min intervals is sufficient
- ❌ No interactive commands (/start, /help, etc.) — this is one-way broadcast
- ❌ No images or charts — text-only, link to dashboard for visuals
- ❌ No crypto alerts (unless BTC ±8%) — not the focus
- ❌ No geopolitical alerts — regime scoring captures macro impact already
- ❌ No LLM calls for alerts/status — only the daily briefing uses Tom agent (via existing `generate-briefing.py`)

## Expected Daily Message Volume

| Type | Count | Notes |
|------|-------|-------|
| Status updates | 3 | Fixed schedule |
| Daily briefing | 1 | Fixed schedule |
| Market alerts | 0-5 | Most days 0-2, volatile days up to 5 |
| Regime change | 0-1 | Rare |
| **Total** | **4-9** | Typical day: 4-5 messages |

Compare to old system: Hormuz alone was sending alerts every 30 minutes = 48/day.

## Implementation Plan

### Phase 1 — Core Bot (1 session)
1. Write `bt-telegram-bot.py` with all 4 message types
2. Config file
3. State management
4. Manual test with `--dry-run`

### Phase 2 — Scheduling (1 session)
1. Add system cron entries for status updates + alert polling
2. Hook briefing into EOD pipeline (end of `eod-update.sh`)
3. Hook regime watch into EOD pipeline
4. Test full cycle

### Phase 3 — Polish (1 session)
1. Run for a few days, tune thresholds
2. Adjust message formatting based on Telegram rendering
3. Add dashboard link in briefing footer
4. Clean up old `market-alerts/` scripts

## Open Questions

1. **Should the bot also post to Idan's personal Telegram (403588640)?** Or only the BT channel?
2. **Weekend status?** Sunday evening futures open snapshot? Or Mon-Fri only?
3. **Earnings alerts?** When a watchlist stock reports — flag in status update or separate alert?
4. **Should regime change alerts fire intraday?** Currently regime is EOD-only. Could run `update-regime.py` at midday too.

---

*OpenSpec-first. Build second. Spec is source of truth.*
