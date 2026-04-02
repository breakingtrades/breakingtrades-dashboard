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

### Data: `data/market-hours.json`
- NYSE regular hours (9:30–16:00 ET), extended hours (pre: 4:00–9:30, after: 16:00–20:00)
- Current year holidays sourced from `exchange_calendars` Python package (authoritative NYSE calendar)
- Next year: `exchange_calendars` if available, hardcoded fallback otherwise
- Early closes: Day After Thanksgiving (13:00), Christmas Eve (13:00), Day Before Independence Day (13:00 when applicable)
- `source` field tracks top-level origin (`exchange_calendars` | `hardcoded` | `mixed`)
- `sourcePerYear` object tracks per-year origin for auditability

### Requirement: Authoritative holiday data (2026-04-02)
- **Primary source:** `exchange_calendars` Python package (`XNYS` calendar) — contains real NYSE holiday schedule including observed dates and early closes
- **Fallback:** Hardcoded known holidays when package data doesn't cover the year (e.g., package lags on next-year data)
- **Per-year source tracking:** JSON output includes `sourcePerYear` so consumers can tell which years are authoritative vs hardcoded
- **Annual refresh:** GitHub Actions cron runs Jan 2 at noon UTC, installs `exchange_calendars`, regenerates current + next year, commits if changed
- **Manual trigger:** `workflow_dispatch` for ad-hoc refreshes
- **Script:** `scripts/update-market-hours.py` — tries `exchange_calendars` first per year, falls back to hardcoded, tracks source
- **Workflow:** `.github/workflows/update-market-hours.yml`

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
