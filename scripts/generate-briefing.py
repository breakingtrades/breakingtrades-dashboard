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
    """Get Azure OpenAI client, preferring DefaultAzureCredential, falling back to API key."""
    try:
        from openai import AzureOpenAI
    except ImportError:
        print("ERROR: openai package not installed. Run: pip install openai azure-identity")
        sys.exit(1)

    api_key = os.environ.get("AZURE_OPENAI_API_KEY")
    if api_key:
        return AzureOpenAI(
            api_key=api_key,
            api_version=API_VERSION,
            azure_endpoint=ENDPOINT,
        )

    try:
        from azure.identity import DefaultAzureCredential, get_bearer_token_provider
        credential = DefaultAzureCredential()
        token_provider = get_bearer_token_provider(credential, "https://cognitiveservices.azure.com/.default")
        return AzureOpenAI(
            azure_ad_token_provider=token_provider,
            api_version=API_VERSION,
            azure_endpoint=ENDPOINT,
        )
    except Exception as e:
        print(f"ERROR: No API key and DefaultAzureCredential failed: {e}")
        print("Set AZURE_OPENAI_API_KEY or ensure Azure CLI is logged in.")
        sys.exit(1)


def generate_briefing():
    today = datetime.now(timezone.utc).strftime("%B %d, %Y")
    weekday = datetime.now(timezone.utc).strftime("%A")

    system_prompt = build_system_prompt()
    market_context = build_market_context()

    user_prompt = f"""Today is {weekday}, {today}.

Here is today's market data from the BreakingTrades dashboard:

{market_context}

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
        temperature=0.7,
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
