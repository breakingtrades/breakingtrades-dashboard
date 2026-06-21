# Daily Briefing — Deterministic Seasonality Context Injection

**Status:** Proposed → Implemented
**Owner:** Idan
**Date:** 2026-06-19

## Why

The daily briefing (`generate-briefing.py` → `data/briefing.json`, runs every
30 min via cron) hands market context to an LLM that writes the audience-facing
narrative. On 2026-06-18 the briefing described every symptom of the June swoon
— Fear & Greed sliding 61.5 → 32, defensive rotation, tech exhaustion, energy
breakdown, rising VIX — without ever naming the seasonal frame driving them.

Tom's rules file already encodes the relevant patterns (R521 midterm-year June
stat, R529 midterm-year H1 hiccup, R498 VIX seasonal pickup, R145/R159/R163
midterm-year roadmap), but the LLM did not pull them from the rules dump on its
own. Symptoms without the frame reads as noise; the frame is the alpha.

## What changes

### Producer (`scripts/generate-briefing.py`)

1. **New `build_seasonality_context()` helper.** Returns a deterministic
   Markdown block, computed from the calendar (month/day/year), that is injected
   into the LLM prompt BEFORE the call so the model cannot skip naming the macro
   pattern.

2. **Midterm-year detection.** `is_midterm_year = (year % 4 == 2)` — 2026 is a
   US midterm year. When true in the June window, the block explicitly states
   the midterm-June statistic (SPX avg -2.11%, hit-rate 36.8%) and instructs the
   model to treat F&G slides / breadth thinning / tech exhaustion / energy
   breakdown as CONFIRMING the seasonal pattern, not as a contrarian buy.

3. **Month-gated content.** The June block (swoon window + R521/R529/R145 family)
   only fires in June; the helper is structured so other months can get their own
   seasonal flavors over time without touching the call site.

## Non-goals

- No change to the briefing schema (`data/briefing.json` shape unchanged).
- No change to the LLM provider, model, or cron cadence.
- No new data files or dependencies — the block is computed from the system
  clock plus the rule IDs already in the prompt context.
- Does not assert the seasonal pattern WILL play out; it forces the briefing to
  name the frame and the rule so the reader can weigh it.

## Verification

- Run `python3 scripts/generate-briefing.py` in June of a midterm year → the
  prompt contains the `## SEASONALITY (JUNE — read carefully)` block with the
  R521 / R529 / R145 lines, and the rendered briefing names the June-swoon /
  midterm frame rather than only listing symptoms.
- Same run outside June → no seasonality block injected (month gate holds).

## Related

- Companion bug fix shipped in the same commit: `eod-update.sh` log()/warn()
  defined before the holiday-eve check (exit-127 fix) — see Shipped Changes row.
- Rule sources: `../agents/tom-fxevolution/RULES.json` (R521, R529, R498, R145,
  R159, R163) in the parent repo.
