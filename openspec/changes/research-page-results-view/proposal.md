# Change: Research Page — Results View (Non-Technical)

**Status:** ✅ Implemented (2026-04-17) — pending deploy verification
**Author:** Idan + assistant
**Related:** `autoresearch/` (strategy tuning infra), evaluator fixes 2026-04-16

## Why

The Research page (`#airesearcher` / `v1/autoresearch.html`) currently shows **market regime detection** — what the market is doing right now. That's valuable but it only answers half the question.

The autoresearch system has been running for weeks producing verified improvements to the trading strategy, but **none of that output surfaces on the dashboard**. Users have no way to see:
- Whether the strategy is actually working across different market conditions
- What the research process found in its most recent tuning run
- What rules are currently governing trade entries and exits

The existing page is also becoming increasingly technical. Adding raw evaluator scores (composite=0.6856, consistency=0.65, etc.) would make it worse, not better.

## What Changes

**Add** three outcome-focused cards at the top of the Research page, above the existing regime-detection sections. **Nothing is removed or rewritten.** Existing regime content remains intact as deeper context below the new cards.

### New section 1 — "How the strategy is performing"

Plain-language per-regime performance from the most recent backtest of the live strategy config.

- Table: Market condition → Performance verdict (Strong / Solid / Defensive / Too Early)
- Verdicts are mapped from the honest per-regime scores now produced by the fixed evaluator (2026-04-16 fixes):
  - Score ≥ 0.70 AND regime reliable → ✅ Strong
  - Score 0.55–0.70 AND regime reliable → ✅ Solid
  - Score 0.40–0.55 AND regime reliable → ⚠️ Mixed
  - Score < 0.40 AND regime reliable → ❌ Weak
  - Regime not reliable (< 5 trades or < 3 tickers) → ⏳ Too early to tell
- Short descriptive caption per regime: what defensive winners held up, trade count, approximate win zone
- One-line summary at top: "Last tuned: [date] — improved ~X% vs previous baseline"

### New section 2 — "What the research found this week"

One paragraph in human English explaining the most recent tuning run's findings. Generated from `autoresearch-results.json` winners list.

- Describes top 1–3 verified improvements in plain terms (not param names):
  - `sma_exit: 10→25` → "Holding winners longer"
  - `bond_filter: False→True` → "Trusting bond-market as a risk signal"
  - `vpr_va_pct: 70→68` → "Tightening the value-area definition"
- Notes what was tested and didn't help (so users know what's already been tried)
- Transparent about uncertainty: if a regime wasn't reliably tested, say so

A mapping dictionary `PARAM_TO_PLAIN_LANGUAGE` lives in the page JS so new params get translated automatically when discovered.

### New section 3 — "What rules are in play"

A short plain-English list of the rules currently running. Derived from the live config, not from backtest scores.

- "Enter on EMA crossover confirmed by volume profile"
- "Exit when price closes below 25-day average"
- "Skip entries when VIX > 22"
- "Skip entries when bonds signal risk-off"
- "Skip entries during extreme greed/fear (F&G > 65 or < 25)"
- "Position size scales with regime risk"

Rules are derived from the live `autoresearch/configs/bt-strategy.json` via a generator in the page JS. When a param changes, the rule text updates automatically.

## New Data Artifact

### `data/autoresearch-summary.json`

Pre-digested summary emitted by `autoresearch/runner_v3.py` on each completion. Keeps page JS simple — no evaluator logic in the browser.

```json
{
  "generated_at": "2026-04-17T02:59:37Z",
  "last_tuning": {
    "date": "2026-04-16",
    "improvement_pct": 4.5,
    "experiments_run": 80,
    "winners": [
      { "param": "sma_exit", "from": 10, "to": 25, "plain": "Holding winners longer", "impact": 0.0123 },
      { "param": "bond_filter", "from": false, "to": true, "plain": "Trusting bond-market as a risk signal", "impact": 0.012 },
      { "param": "vpr_va_pct", "from": 70, "to": 68, "plain": "Tightening the value-area definition", "impact": 0.0051 }
    ],
    "dead_ends": ["VIX threshold sweep produced no improvement", "Fear/Greed threshold sweep produced no improvement"]
  },
  "regime_performance": [
    { "key": "bull_summer25", "label": "Bull run (May–Oct 2025)", "verdict": "strong", "trades": 215, "win_rate": 70, "reliable": true, "caption": "Strategy rode the summer bull cleanly" },
    { "key": "chop_winter25", "label": "Choppy range (Nov 2025–Feb 2026)", "verdict": "solid", "trades": 106, "win_rate": 60, "reliable": true, "caption": "Held positive edge through chop" },
    { "key": "selloff_spring25", "label": "Tariff selloff (Mar–Apr 2025)", "verdict": "defensive", "trades": 13, "win_rate": 100, "reliable": true, "caption": "GLD, XLP, XLU defensive winners held up" },
    { "key": "selloff_spring26", "label": "April 2026 selloff", "verdict": "too_early", "trades": 4, "win_rate": 0, "reliable": false, "caption": "Only 4 trades so far — need more data" }
  ],
  "active_config_summary": {
    "params": { ... flat dict of current live params ... }
  }
}
```

## Requirements

### Requirement: New cards added above existing regime-detection sections
- Three cards rendered in order (Performance, Research Findings, Rules in Play)
- Each card uses the standard uxui skill styling (var tokens, Lucide icons, no emoji icons, no hardcoded colors)
- Page intro + all 6 existing sections (Regime Score Components, Playbook, Market Internals, Commodity Chain, Transition Signals, Business Cycle Position) remain unchanged and render below the new cards

### Requirement: Page must degrade gracefully when summary data is missing
- If `autoresearch-summary.json` is missing or malformed, the new cards show a single row explaining "Tuning data unavailable — regime analysis below" and still let the rest of the page render
- No JS exceptions, no blank page

### Requirement: Non-technical language throughout
- No composite scores, consistency scores, or raw evaluator numbers in visible text
- No parameter names in visible text (sma_exit, vpr_va_pct, etc.) — use the plain-language mapping
- Verdicts use plain words (Strong / Solid / Defensive / Mixed / Weak / Too Early), not numbers

### Requirement: Runner emits the summary automatically
- `autoresearch/runner_v3.py` writes `data/autoresearch-summary.json` alongside `data/autoresearch-results.json` when a batch completes
- Summary generation lives in a helper (`autoresearch/summarize.py`) so it can be regenerated from existing `autoresearch-results.json` without rerunning the batch
- Param-to-plain-language mapping is centralized in `autoresearch/summarize.py` (single source of truth)

### Requirement: UxUI compliance
- Copy `skills/uxui/TEMPLATE.html` conventions
- Use canonical variable names (`--bg-primary`, `--text-primary`, `--text-sm`, etc.) — no abbreviated variants
- Lucide icons only, never emoji as icons
- Run `skills/uxui/COMPLIANCE.md` checklist before marking shipped

## Non-Goals (this change)

- No per-regime config switching UI (Purpose 2 from autoresearch spec — separate future change)
- No parameter sensitivity chart (too technical for this iteration)
- No edit/promotion UI (stays CLI-driven for now)
- No real-time re-tuning trigger from dashboard

## Rollout

1. ✅ Drafted summary JSON schema + built `autoresearch/summarize.py` producing it from existing `autoresearch-results.json`
2. ✅ Patched `runner_v3.py` to call summarizer on batch completion
3. ✅ Generated initial `autoresearch-summary.json` at `breakingtrades-dashboard/data/autoresearch-summary.json`
4. ✅ Added 3 new collapsible sections to `js/pages/autoresearch.js` (page-perf, findings, rules)
5. ✅ Ran test suite — 8/8 passing
6. ⏳ Pending: Manual visual verification on dashboard; deploy
7. ⏳ Pending: Commit + push

## Implementation Notes

### Output path
Summary file lives in **`breakingtrades-dashboard/data/`** (same directory the dashboard serves from), not project-root `data/`. The summarize.py script auto-detects the dashboard data directory.

### History parser format
Autoresearch history mutations are stored as strings in `"param:from->to"` format (not structured dicts). `summarize.py._parse_mutation()` handles parsing. Impact uses `delta` field from history entries directly.

### Per-regime reliability gate
Summary uses the fixed evaluator's `regime_reliable` + `reliable_regime_count` fields (added 2026-04-16). A regime with `reliable=false` shows "Too early to tell" regardless of raw score.

### Dead-end detection
A param is flagged as a dead end when tested ≥3 times across history with 0 improvements. Top 5 dead ends surface in the Findings card (capped to avoid noise).

### Param → plain language mapping
Single source of truth lives in `summarize.py:PARAM_PLAIN_LANGUAGE`. When autoresearch discovers a new param mutation, add one line there and both the summary JSON and the dashboard text update automatically. No JS changes needed.

### Graceful degradation verified
When `autoresearch-summary.json` is missing: each of the 3 new cards renders a single-row "data unavailable" notice and the rest of the page renders normally. No console errors. Confirmed via test fixture.

### Files touched
- `autoresearch/summarize.py` (new, 220 lines)
- `autoresearch/test_summarize.py` (new, 175 lines)
- `breakingtrades-dashboard/js/pages/autoresearch.js` (+~160 lines for 3 render fns + init wiring)
- `/tmp/tom-research/runner_v3.py` (added post-run summarize subprocess call)
- `breakingtrades-dashboard/data/autoresearch-summary.json` (generated artifact)
