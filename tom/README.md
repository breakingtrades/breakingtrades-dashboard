# Tom Agent

Tom's brain lives in the parent BreakingTrades project:
- `~/projects/breakingtrades/agents/tom-fxevolution/AGENT.md` — Decision engine (6-layer stack)
- `~/projects/breakingtrades/agents/tom-fxevolution/SOUL.md` — Personality & voice
- `~/projects/breakingtrades/agents/tom-fxevolution/RULES.json` — 30+ structured trading rules
- `~/projects/breakingtrades/agents/tom-fxevolution/TRACK_RECORD.json` — Historical calls
- `~/projects/breakingtrades/agents/tom-fxevolution/MARKET_MEMORY.md` — Historical analogs

This dashboard repo is a **consumer** of Tom's analysis, not a replacement.

## How it works

1. Export script in parent repo loads Tom's full context + current market data
2. Feeds to LLM → generates daily briefing + per-ticker analysis
3. Output cached as JSON → committed to `data/tom/` in this repo
4. Dashboard frontend displays cached analysis

## JSON Output Format

### `data/tom/briefing.json`
Daily macro briefing — regime read, sector rotation, top setups.

### `data/tom/takes/{TICKER}.json`  
Per-ticker analysis — Tom's Take with EMA status, key level, action, thesis.
