#!/usr/bin/env python3
"""
generate-week-ahead-brief.py — Sunday-evening Tom-persona narrative.

Reads `data/weekly-catalysts.json` produced by `weekly-catalyst-scan.py`,
loads Tom's agent files, and asks the LLM (Azure OpenAI / GitHub Models)
to write a "Sunday night, here's what I'm watching" weekly brief in
Tom's voice. Output: `data/week-ahead.json`.

Schema is INTENTIONALLY different from `briefing.json` (the daily brief):
the daily one is current-state focused; this one is forward-looking and
keyed to specific upcoming catalysts. They share Tom's agent files but
otherwise have no overlap.

Auth: same chain as `generate-briefing.py` —
    GH_TOKEN/GITHUB_TOKEN → AZURE_OPENAI_API_KEY → DefaultAzureCredential.

Usage:
    python3 scripts/generate-week-ahead-brief.py [--dry-run]
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
DATA = REPO / "data"

AGENT_DIR_LOCAL = REPO / "agents" / "tom-fxevolution"
AGENT_DIR_PARENT = Path(os.path.expanduser("~/projects/breakingtrades/agents/tom-fxevolution"))
AGENT_DIR = AGENT_DIR_LOCAL if AGENT_DIR_LOCAL.exists() else AGENT_DIR_PARENT

OUT_FILE = DATA / "week-ahead.json"

ENDPOINT = os.environ.get("AZURE_OPENAI_ENDPOINT", "https://openai-dev-nt6mukageprxm.openai.azure.com/")
DEPLOYMENT = os.environ.get("AZURE_OPENAI_DEPLOYMENT", "gpt-4.1")
API_VERSION = "2025-01-01-preview"


def load_json(path: Path):
    try:
        with open(path) as f:
            return json.load(f)
    except Exception:
        return None


def load_text(path: Path) -> str:
    try:
        with open(path) as f:
            return f.read()
    except Exception:
        return ""


def build_system_prompt() -> str:
    """Tom's persona — same as daily briefing, with the Sunday-night cadence framing."""
    soul = load_text(AGENT_DIR / "SOUL.md")
    rules = load_json(AGENT_DIR / "RULES.json")
    vocab = load_json(AGENT_DIR / "VOCABULARY.json")
    few_shot = load_json(AGENT_DIR / "FEW_SHOT.json")
    memory = load_text(AGENT_DIR / "MARKET_MEMORY.md")

    parts = [soul] if soul else []

    parts.append(
        "\n## CADENCE (THIS BRIEF)\n"
        "This is the **Week Ahead Brief** — written Sunday evening, surfaces the upcoming\n"
        "trading week's catalysts. Different from the daily briefing. You're sitting down with\n"
        "Idan, looking at what's actually scheduled Mon-Fri: economic data, FOMC, mega earnings,\n"
        "IPOs, geopolitical deadlines. Be specific. Reference NAMED events with NAMED levels."
    )

    if rules:
        parts.append("\n## YOUR TRADING RULES (apply where relevant)")
        rule_list = rules.get("rules", []) if isinstance(rules, dict) else rules
        for r in (rule_list or [])[:30]:
            if isinstance(r, dict):
                parts.append(f"- [{r.get('category','?').upper()}] {r.get('rule','')}  (id: {r.get('id','?')})")

    if vocab:
        parts.append("\n## YOUR VOCABULARY (use naturally, do not force)")
        v = vocab.get("vocabulary", vocab) if isinstance(vocab, dict) else vocab
        if isinstance(v, dict):
            cps = v.get("catchphrases", [])
            for phrase in (cps or [])[:12]:
                parts.append(f'- "{phrase}"')
            terms = v.get("terms", {})
            if isinstance(terms, dict):
                for term, desc in list(terms.items())[:8]:
                    parts.append(f'- "{term}": {desc}')

    if few_shot:
        examples = (few_shot.get("few_shot_examples", []) or [])[:1]
        if examples:
            parts.append("\n## EXAMPLE STYLE (one sample of your prose)")
            for ex in examples:
                parts.append(f"Scenario: {ex.get('scenario','')}")
                out = ex.get("output", "")
                parts.append(f"Tom: {out[:400]}...")

    if memory:
        parts.append(f"\n## MARKET MEMORY (most recent regime context)\n{memory[:1500]}")

    return "\n".join(parts)


def build_user_prompt(catalysts: dict) -> str:
    """Render weekly-catalysts.json into a structured prompt block."""
    week_of = catalysts.get("week_of", "?")
    summary = catalysts.get("summary", {})
    cats = catalysts.get("categories", {})
    em = catalysts.get("index_expected_moves", {})

    parts: list[str] = []
    parts.append(f"Week of: {week_of}")
    parts.append(f"Total catalysts in window: {summary.get('total_events', 0)}")
    bc = summary.get("by_category", {})
    parts.append(f"Breakdown: macro={bc.get('macro',0)}, fed={bc.get('fed',0)}, earnings={bc.get('earnings',0)}, geo={bc.get('geopolitical',0)}, ipo={bc.get('ipo',0)}")

    hd = summary.get("hottest_day")
    if hd:
        parts.append(f"\nHottest day: {hd['date']} (score {hd['score']}, {hd['event_count']} events) — {hd['by_category']}")

    parts.append("\nPER-DAY BREAKDOWN:")
    for d in summary.get("per_day", []):
        evts = ", ".join(f"{he['title']} [{he['severity']}]" for he in d["headline_events"])
        parts.append(f"  {d['weekday']} {d['date']} ({d['event_count']} events, max={d['max_severity']}): {evts}")

    def render_cat(name: str, events: list, limit: int = 12) -> None:
        if not events:
            return
        parts.append(f"\n### {name.upper()} ({len(events)})")
        for e in events[:limit]:
            line = f"- [{e.get('severity','?'):>8}] {e.get('deadline','?')}  {e.get('title','?')}"
            extra = e.get("extra") or {}
            if extra.get("forecast") or extra.get("previous"):
                line += f"  (fc={extra.get('forecast')} / prev={extra.get('previous')})"
            if extra.get("market_cap_b"):
                line += f"  (cap=${extra['market_cap_b']:.1f}B {extra.get('bmo_amc','')})"
            tickers = e.get("tickers") or []
            if tickers:
                line += f"  → {','.join(tickers[:5])}"
            parts.append(line)
            ctx = e.get("context", "")
            if ctx:
                parts.append(f"      {ctx[:200]}")

    render_cat("macro / fed", cats.get("fed", []) + cats.get("macro", []))
    render_cat("earnings", cats.get("earnings", []))
    render_cat("ipos", cats.get("ipo", []))
    render_cat("geopolitical (active)", cats.get("geopolitical", []))

    parts.append("\nINDEX & SECTOR EXPECTED MOVES (this week):")
    for sym, e in em.items():
        spot = e.get("spot")
        lo = e.get("lower")
        hi = e.get("upper")
        pct = e.get("pct")
        marker = ""
        if spot and lo and hi:
            if spot < lo:
                marker = " (BREACH DOWN — below EM lower)"
            elif spot > hi:
                marker = " (BREACH UP — above EM upper)"
        parts.append(f"  {sym}: spot=${spot}  weekly EM ±{pct}%  range=${lo}-${hi}{marker}")

    return "\n".join(parts)


def get_client():
    try:
        from openai import OpenAI, AzureOpenAI
    except ImportError:
        print("ERROR: openai package not installed. Run: pip install openai", file=sys.stderr)
        sys.exit(1)

    gh_token = os.environ.get("GH_TOKEN") or os.environ.get("GITHUB_TOKEN")
    if gh_token:
        print("  Using GitHub Models API")
        return OpenAI(
            api_key=gh_token,
            base_url="https://models.inference.ai.azure.com",
        ), gh_token  # caller doesn't use the token, but signals provider

    api_key = os.environ.get("AZURE_OPENAI_API_KEY")
    if api_key:
        print("  Using Azure OpenAI (API key)")
        return AzureOpenAI(
            api_key=api_key,
            api_version=API_VERSION,
            azure_endpoint=ENDPOINT,
        ), None

    try:
        from azure.identity import DefaultAzureCredential, get_bearer_token_provider
        credential = DefaultAzureCredential()
        token_provider = get_bearer_token_provider(credential, "https://cognitiveservices.azure.com/.default")
        print("  Using Azure OpenAI (DefaultAzureCredential)")
        return AzureOpenAI(
            azure_ad_token_provider=token_provider,
            api_version=API_VERSION,
            azure_endpoint=ENDPOINT,
        ), None
    except Exception as ex:
        print(f"ERROR: No auth method. Set GH_TOKEN, AZURE_OPENAI_API_KEY, or `az login`. {ex}", file=sys.stderr)
        sys.exit(1)


SCHEMA_INSTRUCTIONS = """
Output VALID JSON ONLY (no markdown fences) matching this schema:

{
  "title": "Week Ahead — Jun 15-19",
  "headline": "One punchy sentence — what defines this week's tape",
  "thesis": [
    "Bullet 1 — the macro frame (CPI/Fed/risk regime)",
    "Bullet 2 — sector / rotation read for this week",
    "Bullet 3 — the contrarian or risk observation"
  ],
  "hot_days": [
    {"date": "YYYY-MM-DD", "weekday": "Wednesday", "reason": "CPI BMO + Fed speakers — binary day"},
    {"date": "YYYY-MM-DD", "weekday": "Friday", "reason": "..."}
  ],
  "rule_triggers": [
    "R### — short reason this rule is in play this week"
  ],
  "what_im_watching": {
    "tickers": ["SPY", "ORCL", "ADBE", "..."],
    "levels": "SPY 743 (weekly EM lower) // ORCL post-earnings reaction at $XXX // ..."
  },
  "what_im_skipping": "One sentence — what's noise this week (e.g. 'small-cap IPOs are background')",
  "closing_quote": "A Tom-style one-liner to close"
}

Rules:
- Reference SPECIFIC tickers, dates, and levels FROM the catalyst data above.
- Every bullet should mention concrete catalysts, not generic platitudes.
- 3 bullets in `thesis`. 2-4 entries in `hot_days`. 2-5 entries in `rule_triggers`.
- Apply your trading rules; cite ids when they trigger (e.g. "R487 macro demand shock active").
- DO NOT mention model name, prompt, or "AI". You are Tom.
- Sound like a Sunday-evening voice memo to a friend who trades — not a research note.
"""


def generate_brief(catalysts: dict, dry_run: bool = False) -> dict:
    today = datetime.now(timezone.utc).strftime("%B %d, %Y")
    weekday = datetime.now(timezone.utc).strftime("%A")

    system_prompt = build_system_prompt()
    user_payload = build_user_prompt(catalysts)
    user_prompt = (
        f"Today is {weekday}, {today}.\n\n"
        f"Here are the catalysts for the week ahead, scanned by the data pipeline:\n\n"
        f"{user_payload}\n\n---\n"
        f"Write the Week Ahead brief in your voice (Tom from FXEvolution).\n"
        f"This goes on the BreakingTrades dashboard at /#week-ahead.\n"
        f"{SCHEMA_INSTRUCTIONS}"
    )

    if dry_run:
        print("=== SYSTEM PROMPT (truncated 1500ch) ===")
        print(system_prompt[:1500])
        print("\n=== USER PROMPT ===")
        print(user_prompt)
        return {}

    client, _ = get_client()

    print(f"Generating Tom's weekly brief...")
    response = client.chat.completions.create(
        model=DEPLOYMENT,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        max_completion_tokens=2500,
        response_format={"type": "json_object"},
    )

    content = response.choices[0].message.content
    if not content:
        finish = response.choices[0].finish_reason
        print(f"ERROR: empty LLM response (finish={finish})", file=sys.stderr)
        sys.exit(1)
    content = content.strip()
    if content.startswith("```"):
        content = content.split("\n", 1)[1].rsplit("```", 1)[0].strip()

    brief = json.loads(content)
    brief["week_of"] = catalysts.get("week_of")
    brief["generatedAt"] = datetime.now(timezone.utc).isoformat()
    brief["model"] = DEPLOYMENT
    brief["agent"] = "tom-fxevolution"
    brief["catalyst_count"] = catalysts.get("summary", {}).get("total_events", 0)
    return brief


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true", help="Print prompts only, no LLM call")
    ap.add_argument("--out", default=None, help=f"Output path (default {OUT_FILE})")
    ap.add_argument("--catalysts", default=None, help="Override catalysts JSON path")
    args = ap.parse_args()

    catalysts_path = Path(args.catalysts) if args.catalysts else DATA / "weekly-catalysts.json"
    catalysts = load_json(catalysts_path)
    if not catalysts:
        print(f"ERROR: {catalysts_path} not found. Run weekly-catalyst-scan.py first.", file=sys.stderr)
        sys.exit(1)

    out_path = Path(args.out) if args.out else OUT_FILE

    brief = generate_brief(catalysts, dry_run=args.dry_run)
    if args.dry_run or not brief:
        return

    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w") as f:
        json.dump(brief, f, indent=2)
        f.write("\n")
    print(f"Wrote {out_path}")
    print(f"  Title:    {brief.get('title')}")
    print(f"  Headline: {brief.get('headline')}")
    print(f"  Hot days: {len(brief.get('hot_days', []))}, rules: {len(brief.get('rule_triggers', []))}")
    print(f"  Closing:  {brief.get('closing_quote', '')[:120]}")


if __name__ == "__main__":
    main()
