#!/usr/bin/env python3
"""export-signals-desk.py — bridge signals.db -> anonymized dashboard JSON.

Reads the signals/ framework SQLite store and emits a PUBLIC-SAFE JSON for the
dashboard's #signals-desk page. Two hard anonymization rules (the dashboard is a
public, unauthenticated, brand-name site — AGENTS.md: "no external attribution"):

  1. Creator names/handles are STRIPPED. Each entity is mapped to a stable,
     anonymous "Desk N (<type>)" label derived from its extract_mode — never the
     real name (Matt/Steven/Kevin/Tom/etc.).
  2. MeetKevin paid Alpha content (source_id = meetkevin_app) is DROPPED entirely
     — it's paid membership content and must not be republished.

Run from the dashboard repo:
  python3 scripts/export-signals-desk.py [--commit] [--push]
"""
from __future__ import annotations
import argparse
import json
import sqlite3
import subprocess
import sys
import pathlib
from collections import defaultdict, Counter
from datetime import datetime, timezone

DASH_ROOT = pathlib.Path(__file__).resolve().parent.parent
SIGNALS_DB = pathlib.Path.home() / "projects" / "breakingtrades" / "signals" / "data" / "signals.db"
OUT = DASH_ROOT / "data" / "signals-desk.json"

# Sources allowed onto the PUBLIC site. meetkevin_app (paid) is intentionally absent.
PUBLIC_SOURCES = {"youtube", "x"}

# extract_mode -> public desk type label (no creator names)
MODE_LABEL = {
    "all_trades": "Trade Ideas",
    "momentum_only": "Momentum",
    "selective_signals": "Selective / News",
    "warnings_only": "Macro Warnings",
}
PLATFORM_LABEL = {"youtube": "Video", "x": "Social"}


def _anon_desk(entity_id: str, extract_mode: str, source_id: str, registry: dict) -> str:
    """Stable anonymous label: 'Desk N · <type> · <platform>' — never the real name."""
    n = registry.setdefault("_seq", {})
    if entity_id not in n:
        n[entity_id] = len(n) + 1
    typ = MODE_LABEL.get(extract_mode, "Signals")
    plat = PLATFORM_LABEL.get(source_id, source_id)
    return f"Desk {n[entity_id]} · {typ} · {plat}"


def export() -> dict:
    if not SIGNALS_DB.exists():
        print(f"ERROR: signals DB not found at {SIGNALS_DB}", file=sys.stderr)
        sys.exit(1)
    conn = sqlite3.connect(str(SIGNALS_DB))
    conn.row_factory = sqlite3.Row

    placeholders = ",".join("?" for _ in PUBLIC_SOURCES)
    rows = [dict(r) for r in conn.execute(f"""
        SELECT s.ticker, s.asset_class, s.signal_type, s.direction, s.conviction,
               s.thesis, s.catalyst, s.entry, s.targets, s.stop, s.timeframe,
               s.tags, s.context, s.source_section, s.published_at,
               s.entity_id, s.source_id, e.extract_mode
        FROM signals s JOIN entities e ON e.entity_id = s.entity_id
        WHERE s.source_id IN ({placeholders})
        ORDER BY s.published_at DESC, s.signal_id DESC
    """, tuple(PUBLIC_SOURCES))]

    reg: dict = {}
    signals = []
    for r in rows:
        desk = _anon_desk(r["entity_id"], r["extract_mode"], r["source_id"], reg)
        signals.append({
            "ticker": r["ticker"],
            "asset_class": r["asset_class"],
            "signal_type": r["signal_type"],
            "direction": r["direction"],
            "conviction": r["conviction"],
            "thesis": r["thesis"],
            "catalyst": r["catalyst"],
            "entry": r["entry"],
            "targets": json.loads(r["targets"]) if r["targets"] else [],
            "stop": r["stop"],
            "timeframe": r["timeframe"],
            "tags": json.loads(r["tags"]) if r["tags"] else [],
            "context": r["context"],
            "source_section": r["source_section"],
            "published_at": r["published_at"],
            "desk": desk,                      # anonymized — NO creator name
            "platform": PLATFORM_LABEL.get(r["source_id"], r["source_id"]),
        })

    actionable = [s for s in signals if s["signal_type"] in ("idea", "option-trade", "momentum")]
    warnings = [s for s in signals if s["signal_type"] in ("warning", "macro")]
    tick = Counter(s["ticker"] for s in actionable if s["ticker"])

    payload = {
        "_schema": "signals-desk/v1",
        "_note": ("Anonymized social-signal aggregate. Desk labels are anonymized; "
                  "no creator names. Paid-membership content excluded. "
                  "Educational use only — not investment advice."),
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "stats": {
            "signals": len(signals),
            "actionable": len(actionable),
            "warnings": len(warnings),
            "tickers": len(tick),
            "desks": len(reg.get("_seq", {})),
        },
        "top_tickers": [{"ticker": t, "count": n,
                         "bull": sum(1 for s in actionable if s["ticker"] == t and s["direction"] == "bullish"),
                         "bear": sum(1 for s in actionable if s["ticker"] == t and s["direction"] == "bearish")}
                        for t, n in tick.most_common(30)],
        "signals": actionable,
        "warnings": warnings,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, indent=2, ensure_ascii=False))
    # safety assertion: no known creator name leaked
    blob = OUT.read_text()
    for name in ("Matt", "Michael", "Steven", "Kevin", "MeetKevin", "fxevolution",
                 "MarketMoves", "RockTrading", "Tom"):
        if name in blob:
            print(f"⚠️  ANONYMIZATION LEAK: '{name}' found in output — aborting", file=sys.stderr)
            sys.exit(2)
    print(f"✓ wrote {OUT} — {len(signals)} signals ({len(actionable)} actionable, "
          f"{len(warnings)} warnings), {payload['stats']['desks']} desks, MeetKevin excluded")
    return payload


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--commit", action="store_true")
    ap.add_argument("--push", action="store_true")
    args = ap.parse_args()
    export()
    if args.commit:
        subprocess.run(["git", "add", "data/signals-desk.json"], cwd=DASH_ROOT)
        subprocess.run(["git", "commit", "-m", "data: refresh signals-desk (anonymized)"], cwd=DASH_ROOT)
    if args.push:
        subprocess.run(["git", "push", "origin", "main"], cwd=DASH_ROOT)


if __name__ == "__main__":
    main()
