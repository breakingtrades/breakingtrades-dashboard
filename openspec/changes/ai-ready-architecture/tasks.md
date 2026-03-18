# AI-Ready Architecture — Task Breakdown

## Phase 1: Data Foundation

### Task 1.1: Create `data/tom/` namespace and schemas
**Est:** 30 min

- Create `data/tom/` directory
- Write `docs/TOM_SCHEMAS.md` with JSDoc-style schema definitions for all 4 files
- Create seed/example files for each schema (valid JSON, placeholder data)
- Add `data/tom/` to `.gitignore` comment explaining it's CI-generated

### Task 1.2: Refactor generation script
**Est:** 1.5 hours

- Rename/refactor `scripts/generate-briefing.py` → `scripts/generate-tom-outputs.py`
- Single LLM call with structured JSON output (response_format: json_object)
- Prompt template generates all 4 outputs: briefing, alerts, ticker_notes, market_pulse
- Write each output to `data/tom/{name}.json`
- Backward compat: also write `data/briefing.json` (symlink or copy) during transition
- Add `--dry-run` flag (print prompt + schema, don't call API)
- Add `--only briefing,alerts` flag for selective generation

### Task 1.3: Update CI workflow
**Est:** 30 min

- Update `.github/workflows/daily-briefing.yml` to call `generate-tom-outputs.py`
- Commit `data/tom/*.json` instead of just `data/briefing.json`
- Add optional manual dispatch input for `--only` flag
- Test with `workflow_dispatch`

---

## Phase 2: Dashboard UI

### Task 2.1: Tom's Alert Banner (`js/tom-alerts.js`)
**Est:** 45 min

- Shared module loaded on all 3 pages
- Fetches `data/tom/alerts.json`
- Renders top non-expired urgent/watch alert as dismissible banner
- Severity colors: urgent=red, watch=orange, info=blue
- Dismiss saves to `localStorage` by alert ID
- Graceful: if file missing or empty array → no banner

### Task 2.2: Tom's Feed Panel (Signals page)
**Est:** 1 hour

- Replace static briefing HTML block with scrollable feed
- Merge `data/tom/briefing.json` + `data/tom/alerts.json` by timestamp
- Each item: type icon + title + time + expandable body
- Briefing item shows headline, expandable to full body
- Alert items show title + severity badge
- Max 10 items visible, scrollable

### Task 2.3: Tom's Take in Ticker Cards
**Est:** 45 min

- Fetch `data/tom/ticker-notes.json` during `init()`
- For each ticker with a note: inject "Tom's Take" section below the chart
- Bias badge (bullish/bearish/neutral) + note text + key levels
- Collapsed by default, expand on click
- Graceful: no note = no section (not empty box)

### Task 2.4: Tom's Take in Watchlist Detail Modal
**Est:** 30 min

- Same data source as 2.3
- New card in modal: "Tom's Analysis" between technicals and signals
- Shows bias, note, key levels, setup
- Hidden if no note for that ticker

### Task 2.5: Market Pulse Widget
**Est:** 45 min

- New card on market.html replacing hardcoded "LATE CYCLE" regime
- Reads `data/tom/market-pulse.json`
- Displays: regime badge, bias, one-line summary, key levels table, sector view
- Regime color: risk-on=green, neutral=yellow, risk-off=red
- Falls back to current static content if file missing

### Task 2.6: Graceful fallback audit
**Est:** 30 min

- Verify every Tom component handles: missing file, empty file, malformed JSON, expired data
- Add `data-stale` visual indicator if `updatedAt` is >24h old
- Console.warn (not error) for missing Tom data — dashboard must never break

---

## Phase 3: Intelligence Layer (future, not scoped)

- 3.1: Intraday CI trigger on data push
- 3.2: Data diff engine
- 3.3: Tom Chat Widget (arch decision needed)
- 3.4: Tom's trade journal (historical accuracy tracking)
- 3.5: Telegram push for urgent alerts

---

## Total Estimate

| Phase | Tasks | Hours |
|-------|-------|-------|
| Phase 1 | 3 | ~2.5h |
| Phase 2 | 6 | ~4.5h |
| **Total** | **9** | **~7h** |

Phase 3 is unbounded and deferred.
