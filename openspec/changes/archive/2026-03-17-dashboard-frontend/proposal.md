# Proposal: Dashboard Frontend

## Summary

Static HTML/JS dashboard with a dark trading terminal aesthetic, featuring TradingView chart embeds, a watchlist grid, trade setup cards, and a macro context panel. Deployed to GitHub Pages as a zero-cost static site.

## Problem

The watchlist engine generates JSON data, but there's no UI to visualize it. Traders need a fast, professional dashboard to scan watchlists, view charts across timeframes, and assess trade setups at a glance.

## Solution

A static HTML/CSS/JS frontend (no build step) that:
1. Fetches `watchlist.json` and `setups.json` from the same GitHub Pages origin
2. Renders a responsive watchlist grid with EMA bias badges and key metrics
3. Provides per-ticker detail pages with TradingView Advanced Charts (Daily + 4H)
4. Displays trade setup cards with range bars, entry/stop/target levels
5. Includes a ticker tape, macro sidebar, and sector overview widgets

## Scope

- **In scope:** Watchlist grid, ticker detail page, TradingView embeds (free), dark theme, responsive layout, GitHub Pages deploy
- **Out of scope:** User authentication, real-time data, Tom chat widget (Phase 3), database, Next.js migration

## Success Criteria

- Dashboard loads in < 2 seconds on desktop
- All TradingView widgets render correctly without API keys
- Responsive layout works on tablet (1024px) and mobile (375px)
- Design matches prototype aesthetic (`prototype/tv-report-D.html`)
- Passes Lighthouse accessibility score > 80
