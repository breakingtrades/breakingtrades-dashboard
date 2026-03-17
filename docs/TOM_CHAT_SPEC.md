# Tom Chat — Interactive Trading Assistant

_Floating chat interface for context-aware conversations with Tom._

---

## 1. Vision

Tom isn't a generic chatbot. He's a **context-aware trading analyst** who knows:
- What ticker you're looking at right now
- The current macro regime, sector rotation, and pair ratio signals
- Every setup on the dashboard — their status, levels, and history
- His own methodology, rules, and historical analogs

The chat should feel like **having Tom on speed dial during your trading session** — ask him about a setup, get a thesis. Ask about macro, get the regime read. Say "show me breakouts" and the dashboard filters to match.

---

## 2. UX Design

### 2.1 Floating Chat Widget

Position: **bottom-right corner**, above all content.

```
                                                    ┌───────┐
                                                    │  🎯   │ ← FAB (56x56)
                                                    │  Tom  │    collapsed state
                                                    └───────┘

Click FAB to expand:

                                        ┌──────────────────────────┐
                                        │ 🎯 Tom · AAPL            │ ← header (ticker context)
                                        │ ─────────────────────────│
                                        │                          │
                                        │  Tom:                    │
                                        │  AAPL is below all MAs.  │
                                        │  SMA20 $262, SMA50 $262. │
                                        │  RSI 23.9 — oversold but │
                                        │  don't catch this knife. │
                                        │  Wait for reclaim of     │
                                        │  SMA20 before entry.     │
                                        │                          │
                                        │  You:                    │
                                        │  What's the closest      │
                                        │  support level?          │
                                        │                          │
                                        │  Tom:                    │
                                        │  $240 is the weekly 50.  │
                                        │  Below that, $228 from   │
                                        │  the Volume Profile POC. │
                                        │  That's your line.       │
                                        │                          │
                                        │ ─────────────────────────│
                                        │ 💬 Ask Tom...        [→] │ ← input
                                        └──────────────────────────┘
```

### 2.2 Layout Specs

| Element | Desktop | Mobile |
|---------|---------|--------|
| FAB size | 56×56px | 48×48px |
| FAB position | bottom: 24px, right: 24px | bottom: 16px, right: 16px |
| Chat panel width | 380px | 100vw (full screen) |
| Chat panel height | 500px (max 70vh) | 100vh (full screen) |
| Border radius | 12px (panel), 50% (FAB) | 0 (full screen) |
| Z-index | 300 (above modal at 200) | 300 |

### 2.3 Visual Design

```css
/* FAB */
.tom-fab {
  background: linear-gradient(135deg, #111122, #161630);
  border: 1px solid var(--cyan);
  box-shadow: 0 4px 20px rgba(0, 212, 170, 0.15);
  color: var(--cyan);
  font-weight: 700;
  /* Subtle pulse when Tom has a proactive insight */
}

/* Chat Panel */
.tom-chat {
  background: #0c0c18;
  border: 1px solid var(--border);
  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.5);
}

/* Header — shows current context */
.tom-chat-header {
  background: #080810;
  border-bottom: 1px solid var(--border);
  padding: 12px 16px;
  /* Ticker name in cyan if context-locked */
}

/* Messages */
.tom-msg { /* Tom's messages */
  background: rgba(0, 212, 170, 0.06);
  border-left: 2px solid var(--cyan);
  border-radius: 0 8px 8px 0;
  padding: 10px 12px;
  font-size: 12px;
  line-height: 1.6;
}
.user-msg { /* User's messages */
  background: var(--bg-card);
  border-radius: 8px 0 0 8px;
  border-right: 2px solid var(--text-dim);
  text-align: right;
}

/* Input */
.tom-input {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text);
  font-family: inherit;
  /* Focus: border-color → cyan */
}
```

### 2.4 Context Awareness

The chat header shows what Tom is looking at:

| State | Header | Behavior |
|-------|--------|----------|
| No ticker selected | `🎯 Tom · Dashboard` | General macro/regime questions |
| Card clicked (no modal) | `🎯 Tom · AAPL` | Context: that ticker's setup data |
| Modal open | `🎯 Tom · AAPL (detail)` | Full context: setup + charts + levels |
| User types a ticker | `🎯 Tom · NVDA` | Auto-switches context |

**Context injection:** When a user sends a message, the system prepends the current ticker's setup data (from `SETUPS[]`) to the LLM prompt. Tom "sees" what you see.

### 2.5 Smart Suggestions

Below the input, show 3 contextual quick-action chips:

**When viewing a ticker (e.g., AAPL):**
```
[What's the thesis?] [Entry levels?] [Compare to sector]
```

**When on dashboard (no ticker):**
```
[Show me retests] [Macro regime?] [Best setups today]
```

**After Tom mentions a level:**
```
[Show on chart] [What if it breaks?] [Historical analog?]
```

Chips change dynamically based on conversation context + current ticker status.

### 2.6 Dashboard Actions (Tom Can Control the UI)

Tom's responses can include **action cards** that modify the dashboard:

```
User: "Show me breakout setups"

Tom: Here are the current breakout/retest candidates:

┌──────────────────────────────────────────┐
│ 🔄 3 Retest Setups Found                │
│                                          │
│  AMZN — SMA20 retest, HIGH confidence    │
│  PFE  — SMA50 retest, HIGH confidence    │
│  XLP  — SMA50 retest, HIGH confidence    │
│                                          │
│  [Show on Dashboard →]                   │  ← clicks this = filters to Hot tab
└──────────────────────────────────────────┘

AMZN is the best of the three — it's retesting SMA20 
at $209.80 with healthy pullback volume...
```

**Supported actions:**
| Action | What happens |
|--------|-------------|
| `FILTER_STATUS` | Sets status tab (e.g., filter to Hot) |
| `FILTER_SECTOR` | Sets sector chips (e.g., show only Healthcare) |
| `OPEN_DETAIL` | Opens detail modal for a ticker |
| `HIGHLIGHT_CARD` | Briefly pulses a specific card |
| `SCROLL_TO` | Scrolls to a specific card |

### 2.7 Proactive Insights (FAB Notification)

Tom can proactively surface insights without being asked:

```
FAB badge: red dot with count

Triggers:
- New RETEST detected (from data refresh)
- Status change on a watched ticker
- Macro regime change
- RSI extreme (oversold/overbought) on active setup
```

When user opens chat after a proactive notification:
```
Tom: Heads up — MSFT just triggered a RETEST of SMA20 at 
$400.10. Confidence is MEDIUM because it's not holding cleanly.
I'd wait for a daily close above before entering.
[View MSFT →]
```

---

## 3. Backend Architecture

### 3.1 Option Comparison

| Option | Latency | Cost | Complexity | Context Window | Best For |
|--------|---------|------|------------|----------------|----------|
| **A: Azure AI Foundry Agent** | 1-3s | ~$0.01/msg | Medium | 128K | Production, enterprise demo |
| **B: Cloudflare Worker + OpenAI** | 0.5-2s | ~$0.005/msg | Low | 128K | Fastest to ship |
| **C: OpenClaw Bot (container)** | 1-3s | ~$5/mo ACI | High | 1M (Opus) | Maximum context, full tool access |
| **D: Azure OpenAI direct** | 1-2s | ~$0.01/msg | Low | 128K | Simple, you have the endpoint |
| **E: Hybrid (pre-gen + live)** | 0-2s | ~$0.003/msg | Medium | 128K | Best UX, lowest cost |

### 3.2 Recommended: Option E — Hybrid (Pre-Generated + Live Escalation)

**Why:** Most user questions are predictable. "What's the thesis on AAPL?" doesn't need a live LLM call — that analysis is already computed. Live LLM is only needed for follow-up questions, comparisons, and novel queries.

```
┌─────────────────────────────────────────────────────────────┐
│                      USER SENDS MESSAGE                      │
│                             │                                │
│                    ┌────────▼────────┐                       │
│                    │  Intent Router   │                       │
│                    │  (client-side)   │                       │
│                    └────────┬────────┘                       │
│               ┌─────────────┼─────────────┐                 │
│               ▼             ▼             ▼                  │
│     ┌─────────────┐ ┌────────────┐ ┌──────────────┐        │
│     │  CACHED     │ │ DASHBOARD  │ │  LIVE LLM    │        │
│     │  RESPONSE   │ │ ACTION     │ │  CALL         │        │
│     │             │ │            │ │              │        │
│     │ Pre-gen JSON│ │ Filter/    │ │ CF Worker OR │        │
│     │ from data/  │ │ Navigate   │ │ Azure Func   │        │
│     │ tom/takes/  │ │ the UI     │ │              │        │
│     └─────────────┘ └────────────┘ └──────────────┘        │
│                                                              │
│     "What's the     "Show me       "Compare AAPL            │
│      thesis on       retests"       to its 2022              │
│      AAPL?"                         selloff"                 │
│                                                              │
│     → Instant        → Instant      → 1-2s LLM call         │
│       (from JSON)      (JS filter)    (with full context)    │
└─────────────────────────────────────────────────────────────┘
```

**Tier 1 — Cached (instant, no cost):**
- "What's the thesis on [TICKER]?" → load `data/tom/takes/AAPL.json`
- "What's the macro regime?" → load `data/tom/briefing.json`
- "What are Tom's rules?" → hardcoded from methodology
- "What's the stop level?" → read from `SETUPS[]` array

**Tier 2 — Dashboard Action (instant, no cost):**
- "Show me retests" → `FILTER_STATUS('hot')`
- "Show breakout setups" → `FILTER_STATUS('hot')`
- "Healthcare setups" → `FILTER_SECTOR('Healthcare')`
- "What's oversold?" → filter by RSI < 30
- "Show bearish setups" → `FILTER_BIAS('BEAR')`

**Tier 3 — Live LLM (1-2s, ~$0.01):**
- Follow-up questions
- Cross-ticker comparisons
- Historical analog requests
- "Why?" questions that need reasoning
- Anything not covered by Tier 1/2

### 3.3 Intent Router (Client-Side)

Pattern matching on user input before hitting the server:

```javascript
const INTENT_PATTERNS = [
  // Tier 1: Cached responses
  { pattern: /^(what('s| is) the )?(thesis|take|analysis|view) (on|for) (\w+)/i,
    handler: 'cached_take', extract: 'ticker' },
  { pattern: /^(macro|regime|market) (regime|outlook|read|status)/i,
    handler: 'cached_briefing' },
  { pattern: /^(what('s| is|are) the )?(stop|entry|target|level|support|resistance)/i,
    handler: 'cached_levels' },

  // Tier 2: Dashboard actions  
  { pattern: /^show (me )?(retest|breakout|approaching)/i,
    handler: 'action_filter', params: { status: 'hot' } },
  { pattern: /^show (me )?(active|bullish|running)/i,
    handler: 'action_filter', params: { status: 'active' } },
  { pattern: /^show (me )?(exit|warning|alert|danger)/i,
    handler: 'action_filter', params: { status: 'alerts' } },
  { pattern: /^(healthcare|tech|energy|utilities|crypto|consumer)/i,
    handler: 'action_sector', extract: 'sector' },
  { pattern: /^(what('s|is) )?(oversold|overbought)/i,
    handler: 'action_rsi_filter' },
  { pattern: /^(best|top|strongest) (setup|trade|pick)/i,
    handler: 'action_sort', params: { sort: 'priority' } },

  // Tier 3: Fallback to live LLM
  { pattern: /.*/, handler: 'live_llm' }
];
```

### 3.4 Live LLM Backend — Cloudflare Worker (Recommended for Phase 2)

**Why Cloudflare over Azure Foundry:**
- Ships in 1 hour (Workers is simpler than Foundry agent setup)
- Free tier: 100K requests/day (more than enough)
- Sub-100ms cold start (vs Azure Function ~500ms)
- Secrets management built in (API keys in CF dashboard)
- Can upgrade to Azure Foundry later for enterprise demos

```
┌──────────────────────────────────────────────────────────────┐
│                  CLOUDFLARE WORKER: /api/tom/chat             │
│                                                               │
│  Request:                                                     │
│  {                                                            │
│    "message": "Compare AAPL to its 2022 selloff",            │
│    "context": {                                               │
│      "ticker": "AAPL",                                        │
│      "setup": { ...SETUPS entry for AAPL... },                │
│      "macro": { ...current macro strip data... },             │
│      "history": [ ...last 5 messages... ]                     │
│    }                                                          │
│  }                                                            │
│                                                               │
│  Worker:                                                      │
│  1. Validate request + rate limit (10 req/min per IP)         │
│  2. Build system prompt:                                      │
│     - Tom's SOUL.md (personality)                             │
│     - Tom's RULES.json (trading rules)                        │
│     - MARKET_MEMORY.md (historical analogs)                   │
│     - Current macro context (from request)                    │
│     - Current ticker context (from request)                   │
│  3. Call Azure OpenAI (gpt-4.1 or claude-sonnet-4)           │
│  4. Stream response back via SSE                              │
│                                                               │
│  System prompt token budget: ~4K tokens                       │
│  User context: ~1K tokens                                     │
│  Total per request: ~6K tokens in, ~500 tokens out            │
│  Cost: ~$0.005-0.01 per message                               │
└──────────────────────────────────────────────────────────────┘
```

### 3.5 Alternative: Azure AI Foundry Agent (Phase 3 / Enterprise Demo)

For customer demos and enterprise credibility:

```
┌──────────────────────────────────────────────────────────────┐
│              AZURE AI FOUNDRY: Tom Agent                      │
│                                                               │
│  Agent Configuration:                                         │
│  - Model: gpt-4.1 (Azure OpenAI)                             │
│  - System prompt: Tom's full AGENT.md + SOUL.md              │
│  - Tools:                                                     │
│    ├── get_ticker_setup(symbol) → SETUPS[] lookup             │
│    ├── get_macro_regime() → current macro data                │
│    ├── get_sector_strength() → sector bars data               │
│    ├── get_pair_ratios() → ratio signals                      │
│    ├── search_market_memory(query) → historical analogs       │
│    ├── filter_dashboard(params) → returns action card         │
│    └── get_rules(topic) → relevant trading rules              │
│                                                               │
│  Grounding data (Azure AI Search or blob):                    │
│  - Tom's methodology (toms-methodology.md)                    │
│  - Market memory (MARKET_MEMORY.md)                           │
│  - Trading rules (RULES.json)                                 │
│  - Track record (TRACK_RECORD.json)                           │
│  - Transcript summaries (for historical context)              │
│                                                               │
│  Stateful sessions:                                           │
│  - Thread per user browser session                            │
│  - Retains conversation context across messages               │
│  - Can reference earlier questions in the same session        │
│                                                               │
│  Advantages over CF Worker:                                   │
│  - Tool calling (structured function invocation)              │
│  - Stateful threads (no manual history management)            │
│  - RAG over Tom's full knowledge base                         │
│  - Enterprise-grade logging and monitoring                    │
│  - Demo-able to MSFT customers ("built on Azure AI Foundry") │
└──────────────────────────────────────────────────────────────┘
```

### 3.6 Tom's Semantic Knowledge Graph

Tom's brain isn't flat — it's a connected graph of concepts:

```
                    ┌──────────────┐
                    │  MACRO REGIME│
                    │  (late-cycle)│
                    └──────┬───────┘
                           │ determines
              ┌────────────┼────────────┐
              ▼            ▼            ▼
     ┌──────────────┐ ┌────────┐ ┌──────────┐
     │SECTOR ROTATION│ │ RISK   │ │ FLOWS    │
     │Energy>Util>   │ │ HIGH   │ │ Dark Pool│
     │Materials      │ │ VIX 28 │ │ Gamma    │
     └──────┬───────┘ └───┬────┘ └────┬─────┘
            │              │           │
            ▼              ▼           ▼
     ┌──────────────┐ ┌────────────────────┐
     │ PAIR RATIOS  │ │ SENTIMENT          │
     │ XLY/XLP ↘   │ │ Smart$ 0.3 Bearish │
     │ RSP/SPY →   │ │ Retail at highs    │
     │ XLV/SPY →   │ │ Put/Call elevated  │
     └──────┬───────┘ └────────┬───────────┘
            │                   │
            └─────────┬─────────┘
                      ▼
            ┌──────────────────┐
            │  INDIVIDUAL SETUP │
            │  PFE: APPROACHING │
            │                   │
            │  Context:         │
            │  ├─ Macro: ✓ HC   │
            │  │   relative str │
            │  ├─ Flows: ✓ inst │
            │  │   accumulation │
            │  ├─ Sentiment: ✓  │
            │  │   not crowded  │
            │  ├─ Sector: ✓ XLV │
            │  │   holding      │
            │  └─ Technical: ✓  │
            │      SMA50 hold   │
            └────────┬─────────┘
                     │
            ┌────────▼─────────┐
            │  TRADE DECISION  │
            │                  │
            │  Confluence: 4/5 │
            │  → WATCH FOR     │
            │    PULLBACK      │
            │  Entry: $25.80   │
            │  Stop: $24.50    │
            │  Target: $28.00  │
            └──────────────────┘
```

**Semantic connections Tom makes in every analysis:**

| Layer | Data Source | Connection |
|-------|-----------|------------|
| Macro → Sector | Regime determines which sectors to favor | "Late cycle → energy, utilities, materials" |
| Sector → Pair | Pair ratios confirm sector rotation | "XLY/XLP falling → consumer weak → avoid retail" |
| Flows → Individual | Dark pool prints reveal institutional intent | "$5B at AAPL $240 → floor found" |
| Sentiment → Timing | Extremes signal when, not what | "Put/Call 0.93 + >10% below high = buy signal" |
| Technical → Execution | Levels define entry/exit | "SMA20 is the line. Daily close below = exit" |
| Memory → Pattern | Historical analogs inform expectations | "Rhymes with Q4 2018 — tightening into slowdown" |

### 3.7 LLM System Prompt Structure

```
SYSTEM PROMPT (~3,500 tokens):
├── Identity (SOUL.md excerpt — 200 tokens)
│   "You are Tom, a British expat trading analyst..."
├── Core Rules (top 10 from RULES.json — 400 tokens)
│   "Never trade against dark pool flows..."
├── Decision Stack Summary (from AGENT.md — 500 tokens)
│   "Analyze: macro → flows → sentiment → sector → technical → trade"
├── Current Macro Context (injected per request — 300 tokens)
│   "Regime: LATE_CYCLE, VIX: 27.95, Oil: $94.47..."
├── Communication Rules (200 tokens)
│   "Be conversational. Cite data before conclusions. Present both sides."
│   "When user asks to 'show' something, include a dashboard action."
│   "Keep responses under 150 words unless user asks for deep dive."
└── Response Format (100 tokens)
    "Include ACTION_CARD when filtering/navigating the dashboard."
    "Cite specific price levels. Never say 'around' — be precise."

USER CONTEXT (injected per message — ~800 tokens):
├── Current ticker setup (if viewing one)
├── Last 5 messages in conversation
└── User's question
```

---

## 4. Interaction Examples

### 4.1 Ticker-Aware Context

```
[User is viewing NVDA detail modal]

User: Is this a buy?

Tom: Not yet. NVDA is below all MAs — SMA20 at $184.80, SMA50 
at $185.33, Weekly 20 at $184. That's a bearish structure.

The $170 H&S neckline is the line in the sand. If it breaks, 
the measured move is massive — we're talking sub-$140.

Right now, I'd wait for either:
1. A reclaim of SMA20 ($184.80) with volume confirmation
2. A capitulation flush to $170 and a hold

"Patience, react, don't predict."

  [View $170 level on chart →]
```

### 4.2 Dashboard Control

```
User: Show me the strongest setups

Tom: Here are the highest-conviction setups right now:

┌────────────────────────────────────────┐
│ 🎯 Top Setups by Priority             │
│                                        │
│  1. AMZN — RETEST SMA20, HIGH conf    │
│  2. PFE  — RETEST SMA50, HIGH conf    │
│  3. XLU  — ACTIVE, bullish stack      │
│  4. AR   — TRAILING, raise stop       │
│                                        │
│  [Filter Dashboard →]                  │
└────────────────────────────────────────┘

XLU and AR are the active winners — both in bullish 
stacks with energy/utilities leading. AMZN and PFE 
are the next entries if retests hold.

Trail AR's stop to SMA20 ($36.98) — RSI 83 is extended.
```

### 4.3 Macro Question

```
User: What's the regime right now?

Tom: Late cycle. Here's the evidence:

• VIX at 27.95 — above 20 MA, elevated fear
• Oil $94 — 11 weeks up before Iran, structural not just geopolitical
• XLY/XLP falling — consumer weakening
• Agriculture moving — classic late-cycle signal
• Gold→copper→energy→agriculture sequence playing out

Risk level: HIGH. Bears control S&P at 5,845 resistance. 
Bulls need 5,900 break.

"If short-term oil problems become long-term, markets 
get crushed."

  [Show macro indicators →]  [Compare to 2018 →]
```

### 4.4 Cross-Ticker Comparison

```
User: Compare PFE and ABBV

Tom: Both healthcare, both approaching entry — but different quality:

         PFE              ABBV
Setup    APPROACHING      APPROACHING  
Bias     MIXED            MIXED
Entry    $25.80-$26.20    $218-$220
Distance 1.6%             0.7%
RSI      43.2             40.1
SMA20    Below ❌          Below ❌
SMA50    At ✓             Below ❌
W20      Above ✓          Below ❌

PFE is the better setup. It's holding SMA50 ($26.46) and 
Weekly 20 ($26.06) is supporting below. ABBV has ALL MAs 
above price — more headwinds.

That said, ABBV is closer to entry (0.7% vs 1.6%). If 
healthcare keeps showing relative strength, both work.

  [View PFE →]  [View ABBV →]
```

### 4.5 Rule-Based Answer

```
User: Should I buy the AAPL dip?

Tom: RSI 23.9 says oversold, but oversold ≠ buy signal. 
The rule is simple:

"Daily close below SMA20 = exit. Don't hold through 
broken setups."

AAPL closed below SMA20 ($262.45), SMA50 ($262.26), 
AND Weekly 20 ($266.25). That's a broken setup, full stop.

To re-enter, I need:
1. Daily close ABOVE SMA20 
2. Volume on the reclaim > volume on the breakdown
3. Preferably a retest of SMA20 from above

Until then, patience. "Abundance mindset — next trade."

  [Set alert for AAPL SMA20 reclaim →]
```

---

## 5. Phased Rollout

### Phase 1 — Smart Cached (Week 1) ✅ Can ship with static site

- Floating FAB + chat panel UI
- Client-side intent router
- Cached responses from `data/tom/takes/*.json` + `data/tom/briefing.json`
- Dashboard action cards (filter, navigate, highlight)
- Smart suggestion chips
- No server required — everything from static JSON

**What users get:** Instant answers for the top 80% of questions (thesis, levels, macro, filtering). Feels interactive even though it's pre-generated.

### Phase 2 — Live LLM via Cloudflare Worker (Week 2-3)

- Deploy CF Worker at `api.breakingtrades.com/tom/chat`
- SSE streaming for live responses
- Tom's system prompt + methodology loaded in worker
- Rate limiting (10 req/min per IP, 100 req/day per IP)
- Conversation history (last 5 messages in request)
- Fallback to cached if worker is down

**What users get:** True conversational AI. Follow-ups, comparisons, "why?" questions, novel queries.

### Phase 3 — Azure AI Foundry Agent (Month 2+)

- Migrate to Foundry for tool calling + RAG + stateful threads
- Ground Tom on full transcript library (100+ hours of analysis)
- Add vector search over Market Memory for analog retrieval
- Enterprise-grade monitoring and logging
- Demo to MSFT HLS customers as Azure AI showcase

**What users get:** Deep knowledge retrieval. "What did you say about NVDA in January?" actually works.

---

## 6. Data Flow for Pre-Generated Tom's Takes

### Export Pipeline Addition

Add to `export-dashboard-data.py`:

```python
def generate_tom_takes(setups, macro_data):
    """Generate Tom's analysis for each ticker using LLM."""
    
    system_prompt = load_file('tom/system-prompt-export.md')
    rules = load_json('tom/RULES.json')
    memory = load_file('tom/MARKET_MEMORY.md')
    
    for setup in setups:
        context = {
            'ticker': setup['symbol'],
            'setup': setup,
            'macro': macro_data,
            'sector': get_sector_context(setup['sector']),
            'rules': get_relevant_rules(setup, rules)
        }
        
        take = call_llm(
            system=system_prompt,
            user=f"Analyze {setup['symbol']} given current context.",
            context=context,
            max_tokens=300
        )
        
        write_json(f"data/tom/takes/{setup['symbol']}.json", {
            'symbol': setup['symbol'],
            'take': take,
            'action': classify_action(setup),
            'key_level': get_key_level(setup),
            'confidence': assess_confidence(setup),
            'updated': datetime.utcnow().isoformat() + 'Z'
        })
    
    # Daily briefing
    briefing = call_llm(
        system=system_prompt,
        user="Generate today's daily briefing.",
        context={'setups': setups, 'macro': macro_data},
        max_tokens=500
    )
    write_json('data/tom/briefing.json', {
        'date': date.today().isoformat(),
        'briefing': briefing,
        'top_setups': get_top_setups(setups, n=5),
        'regime': classify_regime(macro_data),
        'risk_level': assess_risk(macro_data)
    })
```

### JSON Schema

**`data/tom/takes/AAPL.json`:**
```json
{
  "symbol": "AAPL",
  "take": "Below all MAs. SMA20 $262, SMA50 $262, W20 $266. RSI 23.9 oversold but don't catch knives. Wait for SMA20 reclaim with volume. $240 weekly 50 is next real support. Patience.",
  "action": "WAIT_FOR_RECLAIM",
  "key_level": 262.45,
  "key_level_name": "SMA20",
  "confidence": "LOW",
  "bias": "BEAR",
  "signals": ["below_all_mas", "oversold_rsi", "exit_signal_active"],
  "suggested_questions": [
    "What's the closest support?",
    "When would you re-enter?",
    "How does this compare to the 2022 selloff?"
  ],
  "updated": "2026-03-17T13:35:00Z"
}
```

**`data/tom/briefing.json`:**
```json
{
  "date": "2026-03-17",
  "regime": "LATE_CYCLE",
  "risk_level": "HIGH",
  "briefing": "Late-cycle playbook working. Energy and utilities leading...",
  "top_setups": [
    { "symbol": "AMZN", "status": "RETEST", "confidence": "HIGH" },
    { "symbol": "PFE", "status": "RETEST", "confidence": "HIGH" },
    { "symbol": "XLU", "status": "ACTIVE", "confidence": "HIGH" }
  ],
  "action_items": [
    "Trail AR stop to SMA20 ($36.98)",
    "Watch PFE at $26.46 SMA50",
    "NVDA $170 is the line"
  ],
  "key_levels": {
    "SPY": { "support": 5600, "resistance": 5900 },
    "VIX": { "current": 27.95, "sma20": 20.89 }
  },
  "updated": "2026-03-17T13:35:00Z"
}
```

---

## 7. Cost Estimates

| Phase | Monthly Cost | Requests/Day |
|-------|-------------|-------------|
| Phase 1 (cached only) | $0 | ∞ (static JSON) |
| Phase 2 (CF Worker + GPT-4.1) | ~$5-15 | ~500-1000 |
| Phase 3 (Azure Foundry) | ~$20-50 | ~1000-2000 |

Phase 2 estimate: 500 live LLM calls/day × $0.01/call × 30 days = $150/mo at scale. At launch with <50 users, probably <$5/mo.

---

## 8. Decision: What Brings the Most Value?

**The ranking of user value:**

1. **Dashboard actions from chat** (instant) — "Show me retests" → dashboard filters. This is the killer feature. Users interact conversationally and the dashboard responds. No LLM needed.

2. **Context-aware pre-generated takes** (instant) — Tom already analyzed every ticker. Clicking chat + asking "what's the play?" instantly shows the cached analysis. Feels smart, costs nothing.

3. **Live follow-up conversations** (Phase 2) — "Why?" and "Compare X to Y" need real LLM reasoning. This is where Cloudflare Worker earns its place.

4. **Deep knowledge retrieval** (Phase 3) — "What did Tom say about semis last month?" needs RAG over transcripts. This is the Azure Foundry play.

**Ship Phase 1 first.** It delivers 80% of the value at 0% of the cost.
