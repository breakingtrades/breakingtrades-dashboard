# Change: Real-Time Market Status Indicator

**Status:** ✅ SHIPPED (2026-03-18), updated 2026-04-02
**Commits:** `44f01b5`, `501b559`

## Why

All 3 pages had a hardcoded `Market: OPEN` label in the top nav bar. It was always green regardless of time, weekends, or holidays — misleading for a trading dashboard.

## What Changed

### New: `js/market-status.js` → `js/lib/market-status.js` (v2) — Shared module across all pages
- Computes real-time status from NYSE hours: **OPEN**, **PRE-MARKET**, **AFTER-HOURS**, **CLOSED**
- Pulsing dot animation (green=open, orange=pre, purple=after, red=closed)
- Live clock updating every second
- Holiday-aware: shows holiday name when market is closed for a holiday
- Early close-aware: shows adjusted close time + reason (e.g., "Early close 10:00 AM — Christmas Eve")
- Weekend detection

### Requirement: User-local timezone (2026-04-02)
- **All times displayed in the user's browser timezone**, not hardcoded ET
- Clock shows user's local time with auto-detected TZ abbreviation (e.g., "12:20 PM EDT", "9:20 AM PDT", "5:20 PM BST")
- Open/close times converted from ET → user's local (e.g., West Coast user sees "Closes 1:00 PM" instead of "Closes 16:00 ET")
- Pre-market "Opens" time also converted (e.g., "Opens 6:30 AM" for PT user)
- Early close times converted the same way
- Internal status computation still uses ET (NYSE native) — only display is localized
- Date shows user's local date (month + day only, no year, no weekday)

### New: `data/market-hours.json`
- NYSE regular hours (9:30–16:00 ET), extended hours (pre: 4:00–9:30, after: 16:00–20:00)
- 2026 holidays: 10 full closures (NYD, MLK, Presidents, Good Friday, Memorial, Juneteenth, July 4th, Labor, Thanksgiving, Christmas)
- 2026 early closes: Nov 27 (day after Thanksgiving), Dec 24 (Christmas Eve) — both 13:00
- 2027 holidays pre-loaded via hardcoded fallback

### New: `scripts/update-market-hours.py`
- Uses `exchange_calendars` Python package for accurate NYSE calendar
- Falls back to hardcoded holidays when package doesn't cover the year
- Refreshes current year + next year

### New: `.github/workflows/update-market-hours.yml`
- Annual cron: Jan 2 at noon UTC
- Manual dispatch for ad-hoc updates
- Installs `exchange_calendars`, runs script, commits if changed

### Modified: `index.html`, `market.html`, `watchlist.html`
- Replaced hardcoded `Market: OPEN` + timezone picker dropdown with `<div id="market-status">`
- Added `<script src="js/market-status.js">` before `</body>`

### Bonus fix: Watchlist widget height
- TradingView widget was hardcoded `height: 600px` — stock list cut off at ~8 items
- Changed to `calc(100vh - 140px)` — fills full viewport

## Files
- `js/market-status.js` (new)
- `data/market-hours.json` (new)
- `scripts/update-market-hours.py` (new)
- `.github/workflows/update-market-hours.yml` (new)
- `index.html` (modified)
- `market.html` (modified)
- `watchlist.html` (modified)
