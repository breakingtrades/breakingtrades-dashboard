# Tasks: Tom Chat (Phase 1 — Cached + Dashboard Actions)

## Task 1: Chat widget HTML structure
- [ ] Add FAB element: fixed bottom-right, 56×56 desktop / 48×48 mobile, z-index 300, "🎯 Tom" label
- [ ] Add chat panel: 380px wide desktop / full-screen mobile, max-height 70vh desktop / 100vh mobile
- [ ] Chat panel sections: header (context ticker), message area (scrollable), suggestion chips, input bar
- [ ] Close button in header (×) and Esc key handler
- [ ] FAB click toggles chat panel open/closed
- [ ] Notification badge element on FAB (hidden by default)
- **Estimate:** 45 min
- **Ref:** `docs/TOM_CHAT_SPEC.md` §2.1-2.2

## Task 2: Chat widget CSS
- [ ] FAB: `background: linear-gradient(135deg, #111122, #161630)`, `border: 1px solid var(--cyan)`, `box-shadow: 0 4px 20px rgba(0, 212, 170, 0.15)`, border-radius 50%
- [ ] Chat panel: `background: #0c0c18`, `border: 1px solid var(--border)`, `box-shadow: 0 8px 40px rgba(0,0,0,0.5)`, border-radius 12px
- [ ] Header: `background: #080810`, border-bottom, ticker context in cyan
- [ ] Tom messages: left-aligned, `border-left: 2px solid var(--cyan)`, `background: rgba(0, 212, 170, 0.06)`, border-radius 0 8px 8px 0
- [ ] User messages: right-aligned, `border-right: 2px solid var(--text-dim)`, standard bg
- [ ] Input: `background: var(--bg-card)`, `border: 1px solid var(--border)`, focus → cyan border
- [ ] Suggestion chips: small rounded pills below input, `background: var(--bg-card)`, `border: 1px solid var(--border)`, hover → cyan border
- [ ] Mobile: full-screen panel, no border-radius, back arrow instead of ×
- [ ] Notification badge: red circle, 16px, absolute top-right of FAB, font-size 10px
- [ ] Slide-up animation for chat panel open (transform translateY)
- **Estimate:** 1 hour
- **Ref:** `docs/TOM_CHAT_SPEC.md` §2.3

## Task 3: Context tracking
- [ ] Create `chatContext` object: `{ ticker: null, source: 'dashboard' }` (source: 'dashboard'|'card'|'detail')
- [ ] Update `chatContext.ticker` when a card is clicked → header shows "🎯 Tom · AAPL"
- [ ] Update `chatContext.source` to 'detail' when modal opens → header shows "🎯 Tom · AAPL (detail)"
- [ ] Clear `chatContext.ticker` when modal closes with no card selected → "🎯 Tom · Dashboard"
- [ ] Auto-detect ticker mentions in user input: if user types "what about NVDA", set `chatContext.ticker = 'NVDA'`
- [ ] Pass `chatContext` to intent router and chip generator
- **Estimate:** 45 min
- **Ref:** `docs/TOM_CHAT_SPEC.md` §2.4

## Task 4: Intent router
- [ ] Create `INTENT_PATTERNS` array with ~20 regex patterns categorized by tier
- [ ] Tier 1 patterns: thesis/take/analysis/view + ticker, macro/regime/outlook, stop/entry/target/level/support
- [ ] Tier 2 patterns: show + retest/breakout/approaching, show + active/bullish, show + exit/warning/alert, sector names, oversold/overbought, best/top/strongest setups
- [ ] Tier 3: fallback (everything not matched)
- [ ] Create `classifyIntent(message, context)` → returns `{ tier, handler, params }`
- [ ] If ticker not in message but `chatContext.ticker` exists, use context ticker for Tier 1 queries
- [ ] Test against 20+ example queries from `docs/TOM_CHAT_SPEC.md` §4
- **Estimate:** 1.5 hours
- **Ref:** `docs/TOM_CHAT_SPEC.md` §3.3, `openspec/changes/tom-chat/specs/intent-router/spec.md`

## Task 5: Tier 1 handler — cached responses
- [ ] `handleCachedTake(ticker)`: fetch `data/tom/takes/{TICKER}.json`, format as Tom message with action badge + confidence badge + key level
- [ ] `handleCachedBriefing()`: fetch `data/tom/briefing.json`, format regime badge + risk level + briefing text + top setups + action items
- [ ] `handleCachedLevels(ticker)`: read from `SETUPS` array (already in memory), format SMA20/50/W20 values with context
- [ ] Handle 404: "I don't have analysis for [TICKER] yet. It'll be available after the next data refresh."
- [ ] After displaying cached response, use `suggested_questions` from JSON (or defaults) to update chips
- **Estimate:** 1.5 hours
- **Ref:** `openspec/changes/tom-chat/specs/tom-cached-responses/spec.md`

## Task 6: Tier 2 handler — dashboard actions
- [ ] `handleFilterAction(params)`: call `setFilterStatus(params.status)` (from dashboard-ui exports), show confirmation Tom message ("Filtering to [status] setups — found [N] matches.")
- [ ] `handleSectorAction(sector)`: call `setFilterSector(sector)`, show confirmation
- [ ] `handleRsiFilter()`: filter setups where RSI < 30 → show list in Tom message, call `setFilterStatus` or use custom filter
- [ ] `handleSortAction(params)`: update sort dropdown, show confirmation
- [ ] `handleOpenDetail(ticker)`: call `openDetailModal(ticker)`, update chatContext
- [ ] Include action cards in Tom's response: bordered box with title, ticker list, "[Show on Dashboard →]" button
- [ ] Action card buttons call the corresponding dashboard function when clicked
- **Estimate:** 2 hours
- **Ref:** `openspec/changes/tom-chat/specs/dashboard-actions/spec.md`

## Task 7: Tier 3 handler — fallback message
- [ ] Display: "That's a great question, but I need my live brain for that one. Live chat coming soon — for now, I can help with thesis, levels, and filtering. Try one of these:"
- [ ] Show 3 suggestion chips for Tier 1/2 queries based on current context
- [ ] Style fallback distinctly: slightly dimmer, with a "🔮 Coming Soon" badge
- **Estimate:** 20 min

## Task 8: Suggestion chips engine
- [ ] Create `generateChips(chatContext, lastResponse)` → returns array of 3 `{ text, handler }`
- [ ] Context rules:
  - No ticker + no prior message: ["Show me retests", "Macro regime?", "Best setups today"]
  - Ticker context: ["What's the thesis?", "Entry levels?", "Compare to sector"]
  - After Tom mentions price level: ["Show on chart", "What if it breaks?", "Historical analog?"]
  - After filter action: ["Any retests?", "What's oversold?", "Top conviction?"]
- [ ] Render chips below input, update after each Tom response
- [ ] Chip click → insert as user message → process through intent router
- **Estimate:** 1 hour
- **Ref:** `openspec/changes/tom-chat/specs/suggestion-chips/spec.md`

## Task 9: Proactive insights
- [ ] Store last-loaded setups in `sessionStorage` key `bt_last_setups`
- [ ] On data refresh (manual or periodic): compare current vs stored setups
- [ ] Detect: new RETEST status, status downgrades (ACTIVE → EXIT_*), RSI extremes (< 25 or > 80) on active setups
- [ ] Queue insights (max 3 most important by priority)
- [ ] Show notification badge on FAB with count
- [ ] On chat open with pending insights: auto-populate Tom's first message with insight summary
- [ ] Group excess insights: "+N more status changes" link
- [ ] Clear badge on chat open
- **Estimate:** 1.5 hours
- **Ref:** `openspec/changes/tom-chat/specs/proactive-insights/spec.md`

## Task 10: Message rendering and scroll
- [ ] Create `addMessage(role, content, actions?)` → appends to chat message area
- [ ] Tom messages: left-aligned with cyan border, support **bold**, line breaks, bullet lists (basic markdown → HTML)
- [ ] User messages: right-aligned with gray border
- [ ] Action cards: bordered box with title, list, clickable button
- [ ] Auto-scroll to latest message on new message
- [ ] Typing indicator: "Tom is thinking..." animation (3 dot pulse) for cached fetch delay
- **Estimate:** 1 hour

## Task 11: Testing
- [ ] Test FAB renders and toggles chat panel
- [ ] Test context tracking: click card → header updates, open modal → header updates, close → reverts
- [ ] Test 5+ Tier 1 queries: "thesis on AAPL", "macro regime", "what's the stop for NVDA"
- [ ] Test 5+ Tier 2 queries: "show me retests", "healthcare setups", "what's oversold", "best setups"
- [ ] Test Tier 3 fallback: "compare AAPL to 2022 selloff"
- [ ] Test suggestion chips update per context
- [ ] Test dashboard actions: chat → filter/open modal → verify dashboard state changes
- [ ] Test proactive insights: simulate status change, verify badge and auto-message
- [ ] Test mobile: full-screen panel, back arrow, swipe
- [ ] Test z-index: chat above detail modal
- **Estimate:** 1.5 hours

## Execution Order
1 → 2 → 3 → 10 → 4 → 5 → 6 → 7 → 8 → 9 → 11

## Dependencies
- Tasks 1-2: no dependencies (HTML/CSS)
- Task 3: depends on dashboard-ui Task 10 (modal open/close events to track context)
- Task 4: no deps (pure logic)
- Tasks 5-6: depend on Task 4 (intent router) + dashboard-ui Task 11 (exported functions)
- Task 8: depends on Task 4 (needs intent classification for chip generation)
- Task 9: depends on dashboard-ui Task 2 (data loading for refresh detection)
- Task 10: depends on Tasks 1-2 (UI container)

## Total Estimate: 13-16 hours
