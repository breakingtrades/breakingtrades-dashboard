# Proposal: Tom — AI Trading Assistant

## Summary

An AI trading assistant persona ("Tom") that provides market analysis, trade setup validation, and macro context using a structured 6-layer decision framework. Phase 1 delivers pre-generated daily analysis cached as JSON; Phase 3 adds live chat.

## Problem

Traders need contextual analysis beyond raw numbers — macro regime assessment, sector rotation signals, and setup validation against a consistent methodology. Manual analysis doesn't scale and chat history is ephemeral.

## Solution

Tom is a BreakingTrades AI assistant with:
1. **Personality:** Seasoned trader mentor — direct, data-driven, no fluff
2. **Methodology:** 6-layer decision stack (Macro → Sector → Individual → Risk → Entry → Position)
3. **Context:** Fed current watchlist data, macro indicators, and pair ratio signals
4. **Output (Phase 1):** Daily briefing + per-ticker "Tom's Take" cached as JSON
5. **Output (Phase 3):** Live chat widget with streaming responses

## Scope

- **In scope:** System prompt, methodology docs, daily analysis generation script, cached JSON output, "Tom's Take" cards on ticker detail pages
- **Out of scope:** Live chat widget (Phase 3), voice interface, portfolio tracking, trade execution

## Success Criteria

- Tom's daily briefing covers macro regime, sector rotation, and top 3-5 actionable setups
- Per-ticker analysis aligns with 6-layer methodology
- Cached analysis JSON < 500KB for full watchlist
- Analysis generation runs in < 2 minutes for 35 symbols
- No mention of external sources — all BreakingTrades branded
