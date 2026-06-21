#!/usr/bin/env python3
"""
generate-briefing.py — Tom (FXEvolution) Daily Briefing Generator

Uses Azure OpenAI GPT-5 with Tom's agent persona to generate a daily market briefing
from exported dashboard data. Writes data/briefing.json for the dashboard to render.

Requires:
  - Azure OpenAI endpoint + deployment (uses DefaultAzureCredential or API key)
  - Exported data in data/ (watchlist.json, sector-rotation.json, fear-greed.json, vix.json, pairs.json, sector-risk.json)
  - Tom agent files in agents/tom-fxevolution/ (SOUL.md, RULES.json, FEW_SHOT.json, VOCABULARY.json)

Usage:
  python3 scripts/generate-briefing.py                    # uses DefaultAzureCredential
  AZURE_OPENAI_API_KEY=xxx python3 scripts/generate-briefing.py  # uses API key
"""

import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

DASHBOARD_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = DASHBOARD_DIR / "data"
AGENT_DIR_LOCAL = DASHBOARD_DIR / "agents" / "tom-fxevolution"
AGENT_DIR_PARENT = Path(os.path.expanduser("~/projects/breakingtrades/agents/tom-fxevolution"))
AGENT_DIR = AGENT_DIR_LOCAL if AGENT_DIR_LOCAL.exists() else AGENT_DIR_PARENT
OUT_FILE = DATA_DIR / "briefing.json"

# Azure OpenAI config
ENDPOINT = os.environ.get("AZURE_OPENAI_ENDPOINT", "https://openai-dev-nt6mukageprxm.openai.azure.com/")
DEPLOYMENT = os.environ.get("AZURE_OPENAI_DEPLOYMENT", "gpt-4.1")
API_VERSION = "2025-01-01-preview"


def load_json(path):
    try:
        with open(path) as f:
            return json.load(f)
    except Exception:
        return None


def load_text(path):
    try:
        with open(path) as f:
            return f.read()
    except Exception:
        return ""


def build_seasonality_context():
    """Deterministic seasonality framing — injected before LLM call so Tom can't
    skip naming the macro pattern. Covers June swoon (R521), midterm-year first-
    half hiccup (R529), VIX seasonal pickup (R498), and known annual flavors.

    Why deterministic: yesterday's briefing (2026-06-18) described every June-
    swoon symptom (F&G 61.5→32, defensive rotation, tech exhaustion, energy
    breakdown, rising VIX) WITHOUT ever naming the seasonal frame. Tom's rules
    file has R521/R529/R498 but the LLM didn't pull them. Inject explicitly.
    """
    now = datetime.now(timezone.utc)
    month = now.month
    day = now.day
    year = now.year
    # US House midterms: every 2 years offset from presidential cycle.
    # 2022, 2024, 2026, 2028 ... — even years where year % 4 == 2 are midterms.
    # (2024 was presidential, 2026 IS midterm, 2028 presidential.)
    is_midterm_year = (year % 4 == 2)

    notes = []

    # JUNE — the swoon window
    if month == 6:
        notes.append("## SEASONALITY (JUNE — read carefully)")
        notes.append(
            "- **June swoon window.** June is historically one of the weaker months "
            "for SPX — average return modest, hit-rate <50%. Defensive rotation "
            "and breadth deterioration in June are the rule, not the exception."
        )
        if is_midterm_year:
            notes.append(
                f"- **R521 — midterm-year June stat is LIVE this year ({year}).** "
                "In midterm election years, SPX June average = -2.11%, hit-rate "
                "36.8%. That means ~63% of midterm Junes finish red. Treat any "
                "F&G slide, breadth thinning, tech exhaustion, or energy "
                "breakdown in this window as confirming the seasonal pattern, "
                "not as a contrarian buy."
            )
            notes.append(
                "- **R529 — midterm-year H1 +10% YTD pattern.** When SPX is up "
                "~10% YTD by mid-year of a midterm cycle (Tom Lee / Fundstrat "
                "playbook), expect a 30-50 trading-day 'hiccup' / 5-10% "
                "drawdown June-July-August BEFORE the seasonally-strong Q4 "
                "rally. The path to H2 strength runs THROUGH a mid-year "
                "drawdown, not around it."
            )
            notes.append(
                "- **R145 / R159 / R163 — midterm-year ROADMAP.** April-May "
                "rally → June-Aug top → 15-20% correction → Q4 bottom + "
                "pre-election rally. Russell and NASDAQ usually take the worst "
                "of it. Position-size with this map in mind."
            )
        notes.append(
            "- **R498 — VIX seasonal pickup.** VIX July monthly low ~13.73 → "
            "Aug-Oct peak ~18.28. Any sustained VIX trend above SMA20 in late "
            "June = early confirmation of that seasonal rise."
        )
        # End-of-month sharpening: by mid-to-late June, the pattern is in flight
        if day >= 15:
            notes.append(
                f"- **Calendar position.** It is {now.strftime('%B %d')} — "
                "we are inside the swoon window now. Reference R521/R529 by "
                "name in today's read if the data corroborates "
                "(defensive rotation, F&G slide, breadth thinning, sector risk "
                "stepping up, VIX above SMA20)."
            )

    # JULY — VIX trough then climb
    elif month == 7:
        notes.append("## SEASONALITY (JULY)")
        notes.append(
            "- **R498 — VIX seasonal trough.** July tends to print the "
            "monthly VIX low (~13.73 historical). Calm regime, but it is the "
            "calm BEFORE the Aug-Oct vol expansion."
        )
        if is_midterm_year:
            notes.append(
                "- **R529 — midterm-year hiccup window continues** through "
                "late July / August. Don't read a calm tape as confirmation "
                "of melt-up — the seasonal map says drawdown precedes Q4."
            )

    # AUG-SEP — vol expansion
    elif month in (8, 9):
        notes.append("## SEASONALITY (AUG-SEP)")
        notes.append(
            "- **R498 — VIX seasonal rise toward Oct peak.** August-September "
            "historically see vol expansion. September is the worst-performing "
            "calendar month for SPX (historical avg slightly negative)."
        )

    # OCT — vol peak
    elif month == 10:
        notes.append("## SEASONALITY (OCT)")
        notes.append(
            "- **R498 — VIX seasonal peak (~18.28).** October contains the "
            "annual VIX high. Headline-driven vol spikes common."
        )

    # NOV-DEC — Santa / year-end strength
    elif month in (11, 12):
        notes.append("## SEASONALITY (NOV-DEC)")
        notes.append(
            "- **Seasonally strong.** Nov-Dec historically the strongest "
            "two-month stretch for SPX. Watch for Thanksgiving-to-year-end "
            "drift higher; Santa Claus rally = last 5 trading days of Dec + "
            "first 2 of Jan."
        )

    # JAN — January effect / small-cap kickoff
    elif month == 1:
        notes.append("## SEASONALITY (JAN)")
        notes.append(
            "- **January Effect** (small-caps tend to outperform early Jan). "
            "First-five-days and full-month indicators have a multi-decade "
            "track record as full-year barometers."
        )

    # FEB — historically weak in midterm years
    elif month == 2:
        notes.append("## SEASONALITY (FEB)")
        notes.append(
            "- **February is historically the weakest month of Q1.** Midterm "
            "years in particular can see early-year choppiness."
        )

    # MAR-APR — pre-rally setup
    elif month in (3, 4):
        notes.append("## SEASONALITY (MAR-APR)")
        notes.append(
            "- **April historically bullish** (best month for SPX over the "
            "last 20 years). 'Sell in May' = R048 useless statistic except "
            "in midterm years where the H2 rotation pattern (R145/R159/R163) "
            "actually matters."
        )

    # MAY — sell in may + midterm-year top setup
    elif month == 5:
        notes.append("## SEASONALITY (MAY)")
        notes.append(
            "- **R048 — 'Sell in May' is mostly useless** as a year-round "
            "rule. Ignore EXCEPT in midterm-election years."
        )
        if is_midterm_year:
            notes.append(
                f"- **Midterm year ({year}) — May/June top setup.** Per "
                "R145/R159/R163, the midterm-year roadmap calls for a "
                "April-May rally → top → 15-20% correction into Q4 bottom. "
                "Late May = position-trim window before June swoon (R521)."
            )

    return "\n".join(notes) if notes else ""


def build_market_context():
    """Assemble current market data into a text summary for Tom."""
    parts = []

    # Watchlist
    wl = load_json(DATA_DIR / "watchlist.json")
    if wl:
        parts.append("## WATCHLIST SIGNALS")
        for t in wl:
            bias = t.get("bias", "?")
            status = t.get("status", "?")
            price = t.get("price", 0)
            chg = t.get("change", 0)
            sma20 = t.get("sma20", 0)
            sma50 = t.get("sma50", 0)
            sma200 = t.get("sma200", 0)
            parts.append(f"- {t['symbol']} ({t.get('sector','')}): ${price:.2f} ({chg:+.1f}%) | Bias: {bias} | Status: {status} | SMA20: {sma20:.2f} | SMA50: {sma50:.2f} | SMA200: {sma200:.2f}")

    # Sector rotation
    sr = load_json(DATA_DIR / "sector-rotation.json")
    if sr:
        parts.append("\n## SECTOR ROTATION (RRG)")
        for s in sr.get("sectors", []):
            last = s["trail"][-1] if s.get("trail") else {}
            parts.append(f"- {s['symbol']} ({s['name']}): RS={last.get('rs',0):.1f} Mom={last.get('momentum',0):.1f} [{s.get('quadrant','?')}]")

    # Sector risk
    risk = load_json(DATA_DIR / "sector-risk.json")
    if risk:
        parts.append("\n## SECTOR RISK LEVELS")
        seen = set()
        for name, r in risk.items():
            if r.get("etf") and r["etf"] not in seen:
                seen.add(r["etf"])
                parts.append(f"- {name} ({r['etf']}): {r['risk'].upper()} — {r['quadrant']}")

    # Fear & Greed
    fg = load_json(DATA_DIR / "fear-greed.json")
    if fg:
        curr = fg.get("current", {})
        parts.append(f"\n## FEAR & GREED INDEX")
        parts.append(f"- Current: {curr.get('value', '?')} ({curr.get('label', '?')})")
        parts.append(f"- Previous close: {fg.get('previousClose',{}).get('value','?')}")
        parts.append(f"- 1 week ago: {fg.get('oneWeekAgo',{}).get('value','?')}")
        parts.append(f"- 1 month ago: {fg.get('oneMonthAgo',{}).get('value','?')}")

    # VIX
    vix = load_json(DATA_DIR / "vix.json")
    if vix:
        parts.append(f"\n## VIX REGIME")
        parts.append(f"- VIX: {vix.get('current','?')} | SMA20: {vix.get('sma20','?')} | Regime: {vix.get('regime','?')}")
        parts.append(f"- {vix.get('description','')}")

    # Pairs
    pairs = load_json(DATA_DIR / "pairs.json")
    if pairs:
        parts.append(f"\n## PAIR RATIOS")
        for p in pairs:
            parts.append(f"- {p.get('name','?')}: {p.get('signal','?')} — {p.get('interpretation','')}")

    return "\n".join(parts)


def build_system_prompt():
    """Build Tom's system prompt from agent files."""
    soul = load_text(AGENT_DIR / "SOUL.md")
    rules = load_json(AGENT_DIR / "RULES.json")
    vocab = load_json(AGENT_DIR / "VOCABULARY.json")
    few_shot = load_json(AGENT_DIR / "FEW_SHOT.json")
    memory = load_text(AGENT_DIR / "MARKET_MEMORY.md")

    parts = [soul]

    if rules:
        parts.append("\n## YOUR TRADING RULES (apply these to today's data)")
        for r in rules.get("rules", [])[:20]:  # top 20 rules
            parts.append(f"- [{r['category'].upper()}] {r['rule']}")

    if vocab:
        parts.append("\n## YOUR VOCABULARY (use these terms naturally)")
        v = vocab.get("vocabulary", vocab)
        if isinstance(v, dict):
            for phrase in v.get("catchphrases", [])[:10]:
                parts.append(f"- \"{phrase}\"")
            terms = v.get("terms", {})
            if isinstance(terms, dict):
                for term, desc in list(terms.items())[:10]:
                    parts.append(f"- \"{term}\": {desc}")
            elif isinstance(terms, list):
                for term in terms[:10]:
                    parts.append(f"- \"{term}\"")
        elif isinstance(v, list):
            for item in v[:15]:
                parts.append(f"- \"{item}\"")

    if few_shot:
        examples = few_shot.get("few_shot_examples", [])[:2]
        if examples:
            parts.append("\n## EXAMPLE ANALYSIS STYLE")
            for ex in examples:
                parts.append(f"Scenario: {ex.get('scenario','')}")
                parts.append(f"Tom says: {ex.get('output','')[:300]}...")

    if memory:
        parts.append(f"\n## MARKET MEMORY (recent context)\n{memory[:1000]}")

    return "\n".join(parts)


def get_client():
    """Get OpenAI-compatible client. Priority: GH_TOKEN (GitHub Models) → AZURE_OPENAI_API_KEY → DefaultAzureCredential."""
    try:
        from openai import OpenAI, AzureOpenAI
    except ImportError:
        print("ERROR: openai package not installed. Run: pip install openai")
        sys.exit(1)

    # 1. GitHub Models API (uses PAT — simplest for CI)
    gh_token = os.environ.get("GH_TOKEN") or os.environ.get("GITHUB_TOKEN")
    if gh_token:
        print("  Using GitHub Models API")
        return OpenAI(
            api_key=gh_token,
            base_url="https://models.inference.ai.azure.com",
        )

    # 2. Azure OpenAI with API key
    api_key = os.environ.get("AZURE_OPENAI_API_KEY")
    if api_key:
        print("  Using Azure OpenAI (API key)")
        return AzureOpenAI(
            api_key=api_key,
            api_version=API_VERSION,
            azure_endpoint=ENDPOINT,
        )

    # 3. Azure OpenAI with DefaultAzureCredential (local dev)
    try:
        from azure.identity import DefaultAzureCredential, get_bearer_token_provider
        credential = DefaultAzureCredential()
        token_provider = get_bearer_token_provider(credential, "https://cognitiveservices.azure.com/.default")
        print("  Using Azure OpenAI (DefaultAzureCredential)")
        return AzureOpenAI(
            azure_ad_token_provider=token_provider,
            api_version=API_VERSION,
            azure_endpoint=ENDPOINT,
        )
    except Exception as e:
        print(f"ERROR: No auth method available. Set GH_TOKEN, AZURE_OPENAI_API_KEY, or log into Azure CLI.")
        print(f"  DefaultAzureCredential error: {e}")
        sys.exit(1)


def generate_briefing():
    today = datetime.now(timezone.utc).strftime("%B %d, %Y")
    weekday = datetime.now(timezone.utc).strftime("%A")

    system_prompt = build_system_prompt()
    market_context = build_market_context()
    seasonality_context = build_seasonality_context()

    seasonality_block = f"\n\n{seasonality_context}\n" if seasonality_context else ""

    user_prompt = f"""Today is {weekday}, {today}.

Here is today's market data from the BreakingTrades dashboard:

{market_context}
{seasonality_block}
---

Write today's Daily Briefing in your voice (Tom from FXEvolution). This goes on the BreakingTrades dashboard as the daily briefing section.

Format your response as JSON with these fields:
{{
  "title": "Daily Briefing — Mar 18",
  "headline": "One punchy sentence summarizing today's market read",
  "body": [
    "Paragraph 1 — the big picture (2-3 sentences)",
    "Paragraph 2 — key sector/rotation insight",
    "Paragraph 3 — any contrarian or risk observation"
  ],
  "callout_title": "Key levels today",
  "callout_body": "Bullet-pointed key levels and action items (use HTML <br> for line breaks)",
  "action_items": [
    "Specific trade/watchlist action 1",
    "Specific trade/watchlist action 2"
  ],
  "closing_quote": "A Tom-style one-liner to close with"
}}

Rules:
- Reference SPECIFIC price levels, MAs, and tickers from the data
- Apply your trading rules where relevant (flag any rule triggers)
- Keep it concise — this is a dashboard widget, not a YouTube script
- Sound like YOU, not a generic AI. Use your vocabulary and cadence.
- If Fear & Greed is extreme, call it out per R013
- If sectors are shifting quadrants, highlight the rotation
- Flag any critical rule triggers (R001, R006, R009, etc.)
- **If a SEASONALITY block is provided above, you MUST name the seasonal frame
  explicitly in the briefing** — don't just describe symptoms (defensive
  rotation, F&G slide, breadth thinning, VIX rising). Tie them back to the
  named rule (R521 / R529 / R498 / R145 / R159 / R163 / R048) so the reader
  knows WHY the symptoms cluster the way they do.
- Output ONLY valid JSON, no markdown fences
"""

    client = get_client()

    print(f"🤖 Generating Tom's briefing for {today}...")
    response = client.chat.completions.create(
        model=DEPLOYMENT,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        max_completion_tokens=2000,
        response_format={"type": "json_object"},
    )

    content = response.choices[0].message.content
    if not content:
        # Check for refusal or other issues
        print(f"WARNING: Empty response. Finish reason: {response.choices[0].finish_reason}")
        print(f"Full choice: {response.choices[0]}")
        sys.exit(1)
    content = content.strip()
    # Strip markdown fences if present
    if content.startswith("```"):
        content = content.split("\n", 1)[1].rsplit("```", 1)[0].strip()
    briefing = json.loads(content)

    # Add metadata
    briefing["generatedAt"] = datetime.now(timezone.utc).isoformat()
    briefing["model"] = DEPLOYMENT
    briefing["agent"] = "tom-fxevolution"

    OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT_FILE, "w") as f:
        json.dump(briefing, f, indent=2)

    print(f"✅ Briefing written to {OUT_FILE}")
    print(f"   Title: {briefing.get('title')}")
    print(f"   Headline: {briefing.get('headline')}")
    print(f"   Closing: {briefing.get('closing_quote')}")

    return briefing


if __name__ == "__main__":
    generate_briefing()
