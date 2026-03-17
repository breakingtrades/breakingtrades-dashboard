# Proposal: Watchlist Engine

## Summary

Python data pipeline that scrapes a TradingView shared watchlist, fetches OHLCV data via yfinance, computes technical indicators (EMA 8/21/50, RSI 14), and outputs structured JSON consumed by the dashboard frontend.

## Problem

The dashboard needs a reliable, automated data source for watchlist symbols with pre-computed technical analysis. Manual analysis doesn't scale across 70+ symbols and multiple timeframes.

## Solution

A Python pipeline with three stages:
1. **Scrape** — Parse TradingView shared watchlist URL to extract symbols and sections (Quality Stocks, Community Trades, Pending Setups, Sectors)
2. **Compute** — Fetch daily OHLCV via yfinance, calculate EMA 8/21/50 alignment, RSI 14, % from 52-week high, and derive bias (Bullish/Bearish/Mixed)
3. **Generate** — Output `watchlist.json` and `setups.json` with all computed fields, ready for dashboard consumption

## Scope

- **In scope:** Scraping, EMA/RSI computation, JSON generation, GitHub Actions cron trigger
- **Out of scope:** Real-time streaming, options data, Bollinger Bands (Phase 2), database storage

## Success Criteria

- Pipeline runs in < 60 seconds for 70 symbols
- JSON output matches the schema expected by dashboard-frontend
- EMA alignment and bias labels match manual spot-checks
- GitHub Actions cron runs daily at 9:35 AM ET without failures
