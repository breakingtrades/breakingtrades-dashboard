## Why

Traders need to interactively ask Tom context-aware questions about setups, macro regime, and trade decisions — not just read static cards. The full spec is at `docs/TOM_CHAT_SPEC.md` (780 lines). The design uses a 3-tier architecture: cached responses (instant/$0) → dashboard actions (instant/$0) → live LLM (1-2s/~$0.01). Phase 1 ships with only Tiers 1+2 (no server needed), delivering 80% of value at zero cost.

## What Changes

- Floating chat widget (FAB → expandable panel) anchored bottom-right, z-index above all content
- Context awareness: chat knows which ticker the user is viewing (dashboard, card, or detail modal)
- Client-side intent router: pattern-matches user input → routes to cached JSON, dashboard action, or (Phase 2) live LLM
- Dashboard action cards: Tom's responses can filter the dashboard ("show me retests" → sets status tab to Hot), open detail modals, highlight cards, scroll to tickers
- Smart suggestion chips: 3 contextual quick-actions below input that change based on viewed ticker and conversation state
- Proactive insight notifications: FAB badge pulses when new retests detected or status changes on data refresh
- Pre-generated Tom's Take loaded from `data/tom/takes/{TICKER}.json` and daily briefing from `data/tom/briefing.json`
- Phase 2 (separate change): Cloudflare Worker backend for live LLM conversations
- Phase 3 (separate change): Azure AI Foundry agent with RAG over transcripts

## Capabilities

### New Capabilities
- `chat-widget`: Floating FAB (56×56 desktop, 48×48 mobile) → expanding chat panel (380px desktop, full-screen mobile), header shows context ticker, message display with Tom/user styling, text input with submit, close/minimize, z-index 300
- `intent-router`: Client-side regex pattern matching on user input — routes to cached response handler, dashboard action handler, or live LLM handler (Phase 2). Patterns for thesis/take, macro/regime, levels/support, show/filter commands, sector queries, oversold/overbought, best/top setups
- `dashboard-actions`: Tom responses include structured action cards (`FILTER_STATUS`, `FILTER_SECTOR`, `OPEN_DETAIL`, `HIGHLIGHT_CARD`, `SCROLL_TO`) that modify dashboard state when clicked
- `suggestion-chips`: 3 contextual quick-action buttons below input — vary by context (ticker-specific: "What's the thesis?" / "Entry levels?" / "Compare to sector"; dashboard-level: "Show me retests" / "Macro regime?" / "Best setups today"; follow-up: "Show on chart" / "What if it breaks?" / "Historical analog?")
- `proactive-insights`: FAB notification badge (red dot + count) triggered by data refresh events — new RETEST, status changes, RSI extremes on active setups. Auto-populates first message when chat opened after notification.
- `tom-cached-responses`: Load and render pre-generated analysis from static JSON (`data/tom/takes/*.json`, `data/tom/briefing.json`). Schema: `{ symbol, take, action, key_level, key_level_name, confidence, bias, signals[], suggested_questions[], updated }`

### Modified Capabilities

_(none — no existing specs)_

## Impact

- **Modified files:** `index.html` — add chat widget HTML, CSS, and JS
- **New data dependency:** `data/tom/takes/*.json` and `data/tom/briefing.json` (produced by `data-pipeline` change)
- **Interaction with dashboard-ui:** Chat's `FILTER_STATUS` / `OPEN_DETAIL` actions call the same filter/modal functions from `dashboard-ui`
- **No server required for Phase 1** — entirely client-side
- **Phase 2 adds:** Cloudflare Worker at `api.breakingtrades.com/tom/chat` (separate future change)
- **Phase 3 adds:** Azure AI Foundry agent with tool calling + RAG (separate future change)
- **Design spec:** `docs/TOM_CHAT_SPEC.md`
