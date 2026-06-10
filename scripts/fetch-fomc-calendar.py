#!/usr/bin/env python3
"""
fetch-fomc-calendar.py — Pull the next FOMC meeting + recent/upcoming
Fed speeches from federalreserve.gov and write to data/fomc-calendar.json.

The Fed publishes:
  - https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm
       → annual FOMC meeting dates (Jan / Mar / Apr / Jun / Jul / Sep / Oct / Dec)
       → 2-day meetings; second day = decision day, ~2pm ET press release + ~2:30pm presser
  - https://www.federalreserve.gov/newsevents.htm
       → most recent ~5 speeches with date + speaker name + title

The endpoints documented as RSS in older guides (`feeds/press_speeches.xml`,
`feeds/press_calendar.xml`) all 404 to a generic HTML page. We scrape HTML.

This producer is intentionally conservative — only structured signals. For
forward-looking Fed-speak schedules (Powell at conference X next Wednesday)
the Investing.com speakers feed is the better source; this script doesn't
try to reproduce it.

Usage:
    python3 scripts/fetch-fomc-calendar.py [--dry-run] [--year 2026]
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import time
import urllib.request
from datetime import datetime, timezone, timedelta
from pathlib import Path

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

FOMC_URL = "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm"
NEWS_URL = "https://www.federalreserve.gov/newsevents.htm"

MONTHS = {
    "January": 1, "February": 2, "March": 3, "April": 4, "May": 5, "June": 6,
    "July": 7, "August": 8, "September": 9, "October": 10, "November": 11, "December": 12,
}


def fetch(url: str, attempts: int = 3, backoff: float = 2.0) -> str:
    last_err: Exception | None = None
    for i in range(attempts):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=30) as resp:
                return resp.read().decode("utf-8", errors="replace")
        except Exception as ex:
            last_err = ex
            if i + 1 < attempts:
                time.sleep(backoff * (i + 1))
    raise RuntimeError(f"fetch({url}) failed after {attempts}: {last_err}")


# A 2026 FOMC row in the page looks like:
# <h4><a id="42828">2026 FOMC Meetings</a></h4>
# <div class="row fomc-meeting">
#   <div class="fomc-meeting__month col-..."><strong>January</strong></div>
#   <div class="fomc-meeting__date  col-...">27-28</div>
# An asterisk after the date marks meetings with a press conference (those are
# the bigger market events). We capture both and tag conference-day events.

YEAR_BLOCK_RE = re.compile(r'<h4><a id="\d+">(\d{4}) FOMC Meetings</a></h4>(.*?)(?=<h4>|$)', re.S)
MEETING_RE = re.compile(
    r'<div class="[^"]*fomc-meeting"[^>]*>\s*'
    r'<div class="[^"]*fomc-meeting__month[^"]*"[^>]*><strong>([A-Za-z]+)</strong></div>\s*'
    r'<div class="[^"]*fomc-meeting__date[^"]*"[^>]*>([^<]+)</div>',
    re.S,
)


def parse_fomc_meetings(html: str, target_year: int) -> list[dict]:
    out: list[dict] = []
    for ym in YEAR_BLOCK_RE.finditer(html):
        year = int(ym.group(1))
        if year != target_year:
            continue
        block = ym.group(2)
        for mm in MEETING_RE.finditer(block):
            month = MONTHS.get(mm.group(1).strip())
            if not month:
                continue
            raw_date = mm.group(2).strip()
            press_conf = "*" in raw_date
            # raw_date is e.g. "27-28" or "16-17*" or "29/30"
            day_part = re.sub(r"[^\d\-/]", "", raw_date)
            # Decision day = the LAST day of the range
            last_day_str = re.split(r"[\-/]", day_part)[-1]
            try:
                day = int(last_day_str)
            except ValueError:
                continue
            try:
                # FOMC decision: 2:00 PM ET (press release). Press conf: 2:30 PM.
                # Use 2:00 PM ET as the deadline anchor (UTC = 18:00 EDT / 19:00 EST).
                # June through early November is EDT (-04:00).
                edt_offset = -4 if 3 <= month <= 11 else -5  # rough DST proxy
                # Convert to UTC manually
                dt_utc = datetime(year, month, day, 14 - edt_offset, 0, tzinfo=timezone.utc)
            except Exception:
                continue
            out.append({
                "year": year,
                "month": month,
                "day": day,
                "datetime_utc": dt_utc.isoformat().replace("+00:00", "Z"),
                "press_conference": press_conf,
                "raw_date_label": raw_date,
            })
    out.sort(key=lambda x: x["datetime_utc"])
    return out


# Recent speeches block on /newsevents.htm:
# <h4 class="text-capitalize">Speeches</h4>
# <a href="/newsevents/speech/barr20260606a.htm">Speech by Governor Barr on supervision and regulation </a>
SPEECH_RE = re.compile(
    r'<a href="(/newsevents/speech/(\w+)(\d{8})[a-z]?\.htm)">([^<]+)</a>',
    re.S,
)


def parse_recent_speeches(html: str) -> list[dict]:
    """Extract recent speech listings from the news landing page."""
    out: list[dict] = []
    seen: set[str] = set()
    # Limit scope to the "Speeches" block to avoid grabbing testimony/etc
    block_match = re.search(r'<h4[^>]*>\s*Speeches\s*</h4>(.*?)(<h4|<aside|$)', html, re.S)
    block = block_match.group(1) if block_match else html
    for m in SPEECH_RE.finditer(block):
        url_path, who_slug, ymd, title = m.groups()
        if url_path in seen:
            continue
        seen.add(url_path)
        try:
            dt = datetime.strptime(ymd, "%Y%m%d").replace(tzinfo=timezone.utc)
        except ValueError:
            continue
        out.append({
            "date": dt.date().isoformat(),
            "speaker_slug": who_slug,
            "title": re.sub(r"\s+", " ", title).strip(),
            "url": f"https://www.federalreserve.gov{url_path}",
        })
    return out


def to_event(meeting: dict) -> dict:
    dl = meeting["datetime_utc"]
    label = "FOMC Decision" + (" + Press Conference" if meeting["press_conference"] else "")
    context = (
        f"{label}. Press release ~2:00 PM ET, "
        + ("Powell press conference ~2:30 PM ET. Major binary event for SPY/QQQ/TLT/DXY/GLD — "
           "rate path + dot-plot + economic projections drive multi-day positioning."
           if meeting["press_conference"]
           else "Rate decision only (no presser). Lower-impact than press-conference meetings but still a binary catalyst.")
    )
    return {
        "id": f"fomc-{meeting['year']}-{meeting['month']:02d}-{meeting['day']:02d}",
        "category": "fed",
        "title": f"FOMC Meeting — {label}",
        "context": context,
        "deadline": dl,
        "tickers": ["SPY", "QQQ", "TLT", "DXY", "GLD"],
        "severity": "critical" if meeting["press_conference"] else "high",
        "stars": None,
        "source": "fed.gov",
        "extra": {
            "press_conference": meeting["press_conference"],
            "raw_date_label": meeting["raw_date_label"],
        },
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--year", type=int, default=None, help="Year to scan (default: current + next)")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--out", default=None)
    args = ap.parse_args()

    repo_root = Path(__file__).resolve().parent.parent
    out_path = Path(args.out) if args.out else repo_root / "data" / "fomc-calendar.json"

    now = datetime.now(timezone.utc)
    target_year = args.year or now.year

    errors: list[str] = []
    meetings_all: list[dict] = []

    try:
        html = fetch(FOMC_URL)
        meetings_all = parse_fomc_meetings(html, target_year)
        # Also pull next year if we're in Q4 — gives forward visibility into Jan
        if not args.year and now.month >= 11:
            try:
                meetings_all += parse_fomc_meetings(html, target_year + 1)
            except Exception as ex:
                errors.append(f"next-year: {ex}")
    except Exception as ex:
        errors.append(f"fomc: {ex}")
        print(f"WARN: FOMC fetch failed: {ex}", file=sys.stderr)

    speeches: list[dict] = []
    try:
        html2 = fetch(NEWS_URL)
        speeches = parse_recent_speeches(html2)
    except Exception as ex:
        errors.append(f"speeches: {ex}")
        print(f"WARN: speeches fetch failed: {ex}", file=sys.stderr)

    # Filter out past meetings; keep only upcoming
    upcoming_meetings = [m for m in meetings_all if datetime.fromisoformat(m["datetime_utc"].replace("Z", "+00:00")) > now]
    next_meeting = upcoming_meetings[0] if upcoming_meetings else None

    events = [to_event(m) for m in upcoming_meetings[:4]]  # next 4 meetings ≈ ~6 months ahead

    payload = {
        "fetched_at": now.isoformat().replace("+00:00", "Z"),
        "source": "federalreserve.gov",
        "next_meeting": next_meeting,
        "upcoming_meetings": upcoming_meetings,
        "recent_speeches": speeches[:5],
        "events": events,
        "errors": errors or None,
    }

    if args.dry_run:
        print(json.dumps(payload, indent=2))
        print(f"\n[dry-run] {len(events)} FOMC events, {len(speeches)} recent speeches, would write to {out_path}", file=sys.stderr)
        return

    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w") as f:
        json.dump(payload, f, indent=2)
        f.write("\n")
    print(f"Wrote FOMC calendar → {out_path}")
    if next_meeting:
        days_away = (datetime.fromisoformat(next_meeting["datetime_utc"].replace("Z", "+00:00")) - now).days
        print(f"  Next meeting: {next_meeting['raw_date_label']} ({days_away}d away, press_conf={next_meeting['press_conference']})")
    print(f"  Recent speeches: {len(speeches)}")


if __name__ == "__main__":
    main()
