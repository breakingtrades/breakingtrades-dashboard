## Context

The BreakingTrades dashboard needs a floating chat interface where users can interactively ask Tom (the AI trading assistant) context-aware questions. The full interaction design, backend architecture, and phased rollout are documented in `docs/TOM_CHAT_SPEC.md` (780 lines).

Phase 1 (this change) is entirely client-side: cached JSON responses + dashboard actions + suggestion chips. No server, no LLM calls at runtime. Phase 2 (Cloudflare Worker) and Phase 3 (Azure AI Foundry) are future changes.

The chat widget must integrate with the dashboard-ui change — it calls the same filter/modal functions to control the dashboard from chat.

## Goals / Non-Goals

**Goals:**
- Floating FAB + expandable chat panel with Tom's personality
- Context-aware (knows which ticker the user is viewing)
- 3-tier intent router: cached response → dashboard action → fallback message
- Dashboard actions from chat ("show me retests" filters the UI)
- Smart suggestion chips that adapt to context
- Proactive insight notifications when data changes
- Zero server dependency — works on static site

**Non-Goals:**
- Live LLM chat (Phase 2 — Cloudflare Worker)
- RAG over transcripts (Phase 3 — Azure AI Foundry)
- Voice interface
- Conversation persistence across page reloads (session only)
- User authentication or rate limiting (no server)

## Decisions

### Chat state in memory only
**Decision:** Chat history lives in a JS array (`chatMessages[]`) and is lost on page reload. No `localStorage` persistence.
**Rationale:** Phase 1 is cached responses — there's no value in replaying stale cached responses. Phase 2 (live LLM) may add persistence.

### Intent router is regex-based
**Decision:** Client-side regex patterns classify intents. No NLP, no embeddings, no ML.
**Rationale:** The pattern space is small (~20 patterns). Regex handles "show me retests", "what's the thesis on AAPL", "macro regime" with 95%+ accuracy. ML would require a server.

### Dashboard action bridge
**Decision:** The chat module calls global functions exposed by dashboard-ui: `setFilterStatus(status)`, `setFilterSector(sector)`, `openDetailModal(ticker)`, `highlightCard(ticker)`, `scrollToCard(ticker)`. These functions are defined in dashboard-ui and called by tom-chat.
**Rationale:** Clean separation — chat dispatches intents, dashboard executes them. No tight coupling.

### FAB z-index above modal
**Decision:** FAB at z-index 300, chat panel at 300. Detail modal at 200. Overlay backdrop at 150.
**Rationale:** Users may want to ask Tom about a ticker while viewing its modal. Chat must float above everything.

### Suggestion chip generation
**Decision:** Chips are generated client-side from a rules engine: if ticker context → ticker chips; if post-response with price levels → follow-up chips; else → dashboard chips. No LLM call.
**Rationale:** Fast, deterministic, no cost. The 3 chip options per context are hardcoded in a lookup table with ~10 context variants.

## Risks / Trade-offs

### Risk: Tier 3 fallback is a dead end
Users who ask complex questions get a "coming soon" message. Mitigation: The fallback message is helpful — it suggests Tier 1/2 queries the user can try. Phase 2 (CF Worker) eliminates this gap.

### Risk: Intent misclassification
Regex can't handle ambiguous queries ("is tech oversold?" — is this RSI filter or sector filter?). Mitigation: When ambiguous, prefer the more specific action (RSI filter for "oversold", sector filter for "tech stocks"). Add fuzzy matching for common variations.

### Risk: Proactive insights overwhelm
If 10 tickers change status on a data refresh, 10 notifications could be noisy. Mitigation: Cap proactive insights at 3 most important (by priority sort). Group others as "+7 more status changes."
