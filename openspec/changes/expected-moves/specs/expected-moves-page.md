# Expected Moves Page

## Overview
Renders a sortable table of all tickers with expected move data, showing risk position within the options-implied weekly range.

## Requirements
- MUST load `data/expected-moves.json` and `data/watchlist.json`
- MUST display stats summary: avg EM%, highest EM ticker, buy-zone count, extended count
- MUST support tier switching: Daily, Weekly, Monthly, Quarterly
- MUST render risk meter as a filled bar (width = position %, color = risk level)
- MUST show alert tags for tickers at actionable levels (≤20% or ≥90%)
- MUST highlight rows: green tint for buy-zone, red tint for extended
- MUST sort by any column (click header)
- MUST link to `watchlist.html?ticker={symbol}` on row click
- MUST appear in shared nav bar

## Table Columns
1. Ticker (+ futures proxy label + alert tag)
2. Close (from EM data)
3. Current (from watchlist data, fallback to close)
4. Change % (from watchlist)
5. ±$ EM (selected tier)
6. EM % (selected tier)
7. Low bound (selected tier)
8. High bound (selected tier)
9. Position in Range (bar + % label)
10. Risk Level (badge: LOW → ABOVE EM)
11. Risk Meter (filled bar)

## Alert Tags
| Condition | Tag | Color |
|-----------|-----|-------|
| position ≤ 10% | 🟢 AT SUPPORT | green |
| position 10-20% | 💚 NEAR LOW | light green |
| position < 0% | ⚡ BELOW EM | bright green |
| position ≥ 90% | ⚠️ AT CEILING | orange-red |
| position ≥ 100% | 🔴 ABOVE EM | dark red |
