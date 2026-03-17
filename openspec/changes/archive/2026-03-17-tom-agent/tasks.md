# Tasks: Tom Agent

## Task 1: Author System Prompt
- [ ] Create `tom/system-prompt.md` with Tom's persona, rules, and output format
- [ ] Define personality: direct, mentor-like, data-driven, no fluff
- [ ] Include BreakingTrades branding rules
- [ ] Define response format (JSON structure for cached analysis)
- **Estimate:** 1 hour

## Task 2: Author Methodology Document
- [ ] Create `tom/methodology.md` with full 6-layer decision stack
- [ ] Document pair ratio framework with interpretation rules
- [ ] Document EMA alignment rules and entry criteria
- [ ] Document risk management rules (position sizing, stops)
- **Estimate:** 1-2 hours

## Task 3: Briefing Generation Script
- [ ] Create `data/pipeline/generate_briefing.py`
- [ ] Implement context assembly (load watchlist + macro data + methodology)
- [ ] Implement pair ratio calculation (XLY/XLP, HYG/SPY, etc.)
- [ ] Implement LLM call for daily briefing (macro regime + top setups)
- [ ] Implement batched LLM calls for per-ticker takes
- [ ] Implement JSON response parsing and validation
- [ ] Write output to `data/output/tom-briefing.json`
- [ ] Add error handling and retry logic
- **Estimate:** 3-4 hours

## Task 4: Dashboard Integration
- [ ] Add "Tom's Daily Briefing" card to `index.html`
- [ ] Add "Tom's Take" section to `ticker.html`
- [ ] Fetch and render `tom-briefing.json` data
- [ ] Display regime badge, pair ratio signals, top setups
- [ ] Display per-ticker take with action badge
- [ ] Add "Generated at" timestamp
- **Estimate:** 2-3 hours

## Task 5: GitHub Actions Integration
- [ ] Add Tom briefing generation to `refresh-data.yml` workflow
- [ ] Run after watchlist pipeline completes
- [ ] Configure LLM API key as GitHub secret
- [ ] Commit `tom-briefing.json` alongside other data files
- **Estimate:** 30 min

## Task 6: Testing & Validation
- [ ] Test briefing generation with sample watchlist data
- [ ] Validate JSON output schema
- [ ] Spot-check Tom's analysis against manual assessment
- [ ] Test dashboard rendering with real briefing data
- [ ] Verify no external source attribution in any output
- **Estimate:** 1 hour

## Execution Order
1 → 2 → 3 → 4 → 5 → 6

## Dependencies
- Tasks 1-2 are prerequisites for Task 3
- Task 4 depends on dashboard-frontend Task 4 (ticker detail page)
- Task 5 depends on watchlist-engine Task 6 (GitHub Actions)

## Total Estimate: 9-12 hours
