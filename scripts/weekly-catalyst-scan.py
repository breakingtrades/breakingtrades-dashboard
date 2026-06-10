#!/usr/bin/env python3
"""
weekly-catalyst-scan.py — Sunday-evening orchestrator.

Calls the three catalyst producers (econ, earnings, FOMC), reads
events.jsonl for active geopolitical catalysts, reads expected-moves.json
for index EMs, then writes a single normalized snapshot:

    data/weekly-catalysts.json

Used by the dashboard /#week-ahead route and by the Tom narrative
generator (`generate-week-ahead-brief.py`).

Idempotent. Safe to re-run mid-week (week_of always anchors to upcoming Mon).

Usage:
    python3 scripts/weekly-catalyst-scan.py [--skip-fetch] [--dry-run]

Flags:
    --skip-fetch    Don't call the producers; just read existing JSONs and
                    re-roll up. Useful when iterating on the orchestrator.
    --dry-run       Print payload, don't write file.
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
DATA = REPO / "data"
SCRIPTS = REPO / "scripts"

INDEX_LEADERS = ["SPY", "QQQ", "IWM", "DIA"]
SECTOR_LEADERS = ["XLK", "XLF", "XLV", "XLE", "XLI", "XLY"]

# ---------------------------------------------------------------------------
# Producer wrappers
# ---------------------------------------------------------------------------


def run_producer(name: str, script: str, args: list[str]) -> tuple[bool, str]:
    """Run a producer script. Returns (ok, message)."""
    cmd = [sys.executable, str(SCRIPTS / script), *args]
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        if r.returncode != 0:
            return False, f"{name} exit {r.returncode}: {r.stderr.strip()[:200]}"
        return True, r.stdout.strip().split("\n")[0]
    except Exception as ex:
        return False, f"{name} crashed: {ex}"


# ---------------------------------------------------------------------------
# Source loaders + normalizers
# ---------------------------------------------------------------------------


def load_json(path: Path) -> dict | list | None:
    try:
        with open(path) as f:
            return json.load(f)
    except FileNotFoundError:
        return None
    except Exception as ex:
        print(f"WARN: load {path.name} failed: {ex}", file=sys.stderr)
        return None


def load_events_jsonl(path: Path) -> list[dict]:
    events: list[dict] = []
    if not path.exists():
        return events
    try:
        with open(path) as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                try:
                    events.append(json.loads(line))
                except Exception:
                    continue
    except Exception as ex:
        print(f"WARN: load events.jsonl failed: {ex}", file=sys.stderr)
    return events


# ---------------------------------------------------------------------------
# Normalization — every category emits the same event shape
# ---------------------------------------------------------------------------


SEV_RANK = {"critical": 4, "high": 3, "medium": 2, "low": 1}


def normalize_econ(econ: dict | None) -> list[dict]:
    if not econ:
        return []
    out: list[dict] = []
    for e in econ.get("events", []):
        title = e.get("title", "")
        fc = e.get("forecast")
        prev = e.get("previous")
        # Tier severity by event class (CPI/PPI/NFP > Existing Home Sales etc)
        sev = "high"
        crit_keywords = ("CPI", "PCE", "Nonfarm Payrolls", "FOMC", "PPI", "Retail Sales", "GDP")
        if any(k in title for k in crit_keywords):
            sev = "critical"
        ctx_parts = ["US 3-star economic data release."]
        if fc:
            ctx_parts.append(f"Consensus forecast: {fc}.")
        if prev and prev != "&nbsp;":
            ctx_parts.append(f"Previous reading: {prev}.")
        ctx_parts.append("High-volatility window for SPY, QQQ, TLT, DXY, GLD.")
        out.append({
            "id": e["id"],
            "category": "macro",
            "title": title,
            "context": " ".join(ctx_parts),
            "deadline": e["deadline"],
            "tickers": ["SPY", "QQQ", "TLT", "DXY", "GLD"],
            "severity": sev,
            "stars": e.get("stars"),
            "source": "investing.com",
            "extra": {"forecast": fc, "previous": prev if prev != "&nbsp;" else None},
        })
    return out


def normalize_fomc(fomc: dict | None) -> list[dict]:
    if not fomc:
        return []
    return list(fomc.get("events", []))  # already normalized at producer


def normalize_earnings(earnings: dict | None) -> list[dict]:
    if not earnings:
        return []
    return list(earnings.get("events", []))  # already normalized at producer


def _parse_deadline_safe(raw: str) -> datetime | None:
    """Coerce events.jsonl deadlines to tz-aware UTC datetime.

    Handles the pitfall class documented in skills/breakingtrades:
      - `2026-11-02T19:00:00.000Z` (ISO with Z)
      - `2026-04-08` (date-only — assume 16:00 UTC = post-close)
      - `2026-04-29/2026-04-30` (range — use later half + 16:00 UTC)
      - `2026-11-02 19:00:00` (naive ISO — assume UTC)
    """
    if not raw:
        return None
    s = str(raw).strip()
    if not s:
        return None
    # Range: 'A/B' → take B
    if "/" in s and ":" not in s:
        s = s.split("/")[-1].strip()
    s = s.replace("Z", "+00:00")
    # Date-only?
    if len(s) == 10 and s.count("-") == 2:
        try:
            d = datetime.strptime(s, "%Y-%m-%d")
            return d.replace(hour=16, minute=0, tzinfo=timezone.utc)
        except Exception:
            return None
    try:
        dt = datetime.fromisoformat(s)
    except Exception:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def normalize_geopolitical(events_jsonl: list[dict], now: datetime, days: int) -> list[dict]:
    horizon = now + timedelta(days=days)
    out: list[dict] = []
    for e in events_jsonl:
        if e.get("status") != "active":
            continue
        if e.get("category") not in ("geopolitical", "fed", "analyst_flag"):
            # Only geopolitical-class entries here. Fed is from FOMC producer; manual
            # IPO entries (category=earnings, source=manual) handled separately.
            continue
        dl = e.get("deadline")
        if not dl:
            continue
        dl_dt = _parse_deadline_safe(dl)
        if dl_dt is None:
            continue
        if dl_dt <= now or dl_dt > horizon:
            continue
        sev = e.get("severity", "medium")
        out.append({
            "id": e.get("id", f"jsonl-{dl}"),
            "category": "geopolitical" if e.get("category") == "geopolitical" else e.get("category"),
            "title": e.get("title", ""),
            "context": e.get("market_impact") or e.get("notes") or "",
            "deadline": dl_dt.isoformat().replace("+00:00", "Z"),
            "tickers": e.get("tickers", []) or [],
            "severity": sev,
            "stars": None,
            "source": e.get("source", "manual"),
            "extra": {"notes": e.get("notes", "")},
        })
    return out


def normalize_manual_ipos(events_jsonl: list[dict], now: datetime, days: int) -> list[dict]:
    """Manual events with category=earnings + source=manual = curated IPOs."""
    horizon = now + timedelta(days=days)
    out: list[dict] = []
    for e in events_jsonl:
        if e.get("status") != "active":
            continue
        if e.get("category") != "earnings":
            continue
        if e.get("source") != "manual":
            continue
        dl = e.get("deadline")
        if not dl:
            continue
        dl_dt = _parse_deadline_safe(dl)
        if dl_dt is None:
            continue
        if dl_dt <= now or dl_dt > horizon:
            continue
        out.append({
            "id": e.get("id", f"ipo-{dl}"),
            "category": "ipo",
            "title": e.get("title", ""),
            "context": e.get("market_impact") or e.get("notes") or "",
            "deadline": dl_dt.isoformat().replace("+00:00", "Z"),
            "tickers": e.get("tickers", []) or [],
            "severity": e.get("severity", "high"),
            "stars": None,
            "source": "manual",
            "extra": {"notes": e.get("notes", "")},
        })
    return out


def index_emoves(em_data: dict | None) -> dict:
    """Pull weekly EM bands for the 4 index ETFs + sector leaders."""
    if not em_data:
        return {}
    tickers = em_data.get("tickers", {}) if isinstance(em_data, dict) else {}
    out: dict[str, dict] = {}
    for sym in INDEX_LEADERS + SECTOR_LEADERS:
        d = tickers.get(sym) if isinstance(tickers, dict) else None
        if not d:
            continue
        weekly = d.get("weekly") or {}
        if not weekly:
            continue
        spot = d.get("spot") or d.get("close")
        out[sym] = {
            "spot": spot,
            "anchor": weekly.get("anchor_close"),
            "lower": weekly.get("lower"),
            "upper": weekly.get("upper"),
            "pct": weekly.get("pct"),
            "expiry": weekly.get("expiry"),
        }
    return out


def upcoming_monday(now: datetime) -> datetime:
    """Return the upcoming Monday at 00:00 UTC. If today IS Monday, returns today."""
    days_ahead = (0 - now.weekday()) % 7  # 0=Mon
    if days_ahead == 0 and now.hour < 16:
        # Already Monday and pre-close → "this week"
        target = now
    elif days_ahead == 0:
        # Late Monday → next Monday
        target = now + timedelta(days=7)
    else:
        target = now + timedelta(days=days_ahead)
    return target.replace(hour=0, minute=0, second=0, microsecond=0)


# ---------------------------------------------------------------------------
# Roll-up + heuristics
# ---------------------------------------------------------------------------


def hottest_day(all_events: list[dict]) -> dict | None:
    """Score each Mon-Fri by sum(severity rank) and return the top one."""
    if not all_events:
        return None
    by_day: dict[str, int] = {}
    by_day_meta: dict[str, dict] = {}
    for e in all_events:
        dl = _parse_deadline_safe(e.get("deadline", ""))
        if dl is None:
            continue
        d = dl.date().isoformat()
        score = SEV_RANK.get(e.get("severity", "medium"), 2)
        by_day[d] = by_day.get(d, 0) + score
        meta = by_day_meta.setdefault(d, {"events": []})
        meta["events"].append({"category": e["category"], "title": e["title"], "severity": e["severity"]})
    if not by_day:
        return None
    top_day = max(by_day, key=lambda k: by_day[k])
    meta = by_day_meta[top_day]
    return {
        "date": top_day,
        "score": by_day[top_day],
        "event_count": len(meta["events"]),
        "by_category": _by_cat(meta["events"]),
    }


def _by_cat(events: list[dict]) -> dict:
    out: dict = {}
    for e in events:
        out.setdefault(e["category"], 0)
        out[e["category"]] += 1
    return out


def per_day_breakdown(all_events: list[dict]) -> list[dict]:
    """For each unique trading day in the set, summarize what's there."""
    by_day: dict[str, list[dict]] = {}
    for e in all_events:
        dl = _parse_deadline_safe(e.get("deadline", ""))
        if dl is None:
            continue
        d = dl.date().isoformat()
        by_day.setdefault(d, []).append(e)
    out: list[dict] = []
    for d in sorted(by_day):
        evts = by_day[d]
        out.append({
            "date": d,
            "weekday": datetime.fromisoformat(d).strftime("%A"),
            "event_count": len(evts),
            "max_severity": max((e.get("severity", "low") for e in evts), key=lambda s: SEV_RANK.get(s, 0)),
            "by_category": _by_cat(evts),
            "headline_events": [
                {"category": e["category"], "title": e["title"], "severity": e["severity"]}
                for e in sorted(evts, key=lambda x: -SEV_RANK.get(x.get("severity", "medium"), 0))[:3]
            ],
        })
    return out


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--skip-fetch", action="store_true",
                    help="Skip running producers; just re-roll-up existing data files")
    ap.add_argument("--dry-run", action="store_true", help="Print payload, don't write")
    ap.add_argument("--out", default=None, help="Output path (default: data/weekly-catalysts.json)")
    ap.add_argument("--days", type=int, default=8, help="Look-ahead window in days (default 8)")
    args = ap.parse_args()

    out_path = Path(args.out) if args.out else DATA / "weekly-catalysts.json"
    now = datetime.now(timezone.utc)
    week_of = upcoming_monday(now).date().isoformat()

    producer_status: list[dict] = []

    if not args.skip_fetch:
        print("Running producers...")
        for name, script, sargs in [
            ("econ", "fetch-economic-calendar.py", ["--week-mode"]),
            ("earnings", "fetch-earnings-calendar.py", ["--weeks", "2", "--min-cap-b", "5"]),
            ("fomc", "fetch-fomc-calendar.py", []),
            ("ipo_tracker", "track-ipo-performance.py", []),
        ]:
            ok, msg = run_producer(name, script, sargs)
            producer_status.append({"name": name, "ok": ok, "message": msg})
            print(f"  {name}: {'OK' if ok else 'FAIL'} — {msg}")

    # Load all snapshots
    econ = load_json(DATA / "economic-calendar.json")
    earnings = load_json(DATA / "earnings-calendar.json")
    fomc = load_json(DATA / "fomc-calendar.json")
    em = load_json(DATA / "expected-moves.json")
    ipo_tracker = load_json(DATA / "ipo-tracker.json")
    events_jsonl = load_events_jsonl(DATA / "events.jsonl")

    econ_events = normalize_econ(econ)
    fomc_events = normalize_fomc(fomc)
    earnings_events = normalize_earnings(earnings)
    geo_events = normalize_geopolitical(events_jsonl, now, args.days)
    ipo_events = normalize_manual_ipos(events_jsonl, now, args.days * 4)  # IPOs can be further out

    # Filter all to within window from now
    horizon = now + timedelta(days=args.days)

    def within(e: dict) -> bool:
        dl = _parse_deadline_safe(e.get("deadline", ""))
        if dl is None:
            return False
        return now < dl <= horizon

    econ_in = [e for e in econ_events if within(e)]
    fomc_in = [e for e in fomc_events if within(e)]
    earn_in = [e for e in earnings_events if within(e)]
    geo_in = [e for e in geo_events]  # already filtered
    ipo_in = [e for e in ipo_events]  # IPO horizon longer

    all_in_window = econ_in + fomc_in + earn_in + geo_in
    # IPOs surfaced separately — broader horizon

    payload = {
        "schema_version": 1,
        "week_of": week_of,
        "generated_at": now.isoformat().replace("+00:00", "Z"),
        "horizon_days": args.days,
        "summary": {
            "total_events": len(all_in_window) + len(ipo_in),
            "by_category": {
                "macro": len(econ_in),
                "fed": len(fomc_in),
                "earnings": len(earn_in),
                "geopolitical": len(geo_in),
                "ipo": len(ipo_in),
            },
            "hottest_day": hottest_day(all_in_window),
            "per_day": per_day_breakdown(all_in_window),
        },
        "categories": {
            "macro": sorted(econ_in, key=lambda e: e["deadline"]),
            "fed": sorted(fomc_in, key=lambda e: e["deadline"]),
            "earnings": sorted(earn_in, key=lambda e: e["deadline"]),
            "geopolitical": sorted(geo_in, key=lambda e: (e["deadline"] or "")),
            "ipo": sorted(ipo_in, key=lambda e: e["deadline"]),
        },
        "index_expected_moves": index_emoves(em),
        "ipo_regime": (ipo_tracker.get("regime_summary") if isinstance(ipo_tracker, dict) else None),
        "recent_ipos": (ipo_tracker.get("ipos", []) if isinstance(ipo_tracker, dict) else []),
        "producers": producer_status,
    }

    if args.dry_run:
        print(json.dumps(payload, indent=2)[:4000])
        print(f"\n[dry-run] {payload['summary']['total_events']} catalysts for week of {week_of}", file=sys.stderr)
        return

    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w") as f:
        json.dump(payload, f, indent=2)
        f.write("\n")
    print(f"\nWrote {out_path}")
    s = payload["summary"]
    print(f"  Week of: {week_of}  ({s['total_events']} catalysts)")
    print(f"  By cat:  macro={s['by_category']['macro']} fed={s['by_category']['fed']} earnings={s['by_category']['earnings']} geo={s['by_category']['geopolitical']} ipo={s['by_category']['ipo']}")
    if s["hottest_day"]:
        h = s["hottest_day"]
        print(f"  Hottest: {h['date']} (score {h['score']}, {h['event_count']} events, {h['by_category']})")
    if not all_in_window and not ipo_in:
        print("  WARN: no catalysts in window — verify producers ran cleanly.")


if __name__ == "__main__":
    main()
