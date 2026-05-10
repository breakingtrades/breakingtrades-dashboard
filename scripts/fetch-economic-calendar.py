#!/usr/bin/env python3
"""
fetch-economic-calendar.py — Pull upcoming US 3-star economic events from
Investing.com's calendar service and write them to data/economic-calendar.json.

The frontend (events.js) reads this file and merges these events into the
"Upcoming — Next 7 Days" column on the Events page. Stars=3 only, country=US
only, timezone=UTC.

Usage:
    python3 scripts/fetch-economic-calendar.py [--limit N] [--days D]

Defaults: top 3 future events within the next 14 days.

No API key needed. The endpoint is the same one Investing.com's own UI calls
when filtering the calendar; we just hit it server-side.
"""
import argparse
import json
import re
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ENDPOINT = "https://www.investing.com/economic-calendar/Service/getCalendarFilteredData"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "X-Requested-With": "XMLHttpRequest",
    "Referer": "https://www.investing.com/economic-calendar/",
    "Content-Type": "application/x-www-form-urlencoded",
    "Accept": "application/json, text/javascript, */*; q=0.01",
}

# country[]=5  -> United States
# importance[]=3 -> 3-star (high volatility)
# timeZone=55 -> UTC
COUNTRY_US = "5"
STARS_THREE = "3"
TZ_UTC = "55"

ROW_RE = re.compile(
    r'<tr id="eventRowId_(\d+)"[^>]*data-event-datetime="([^"]+)"[^>]*>(.*?)</tr>',
    re.S,
)
TITLE_RE = re.compile(r'class="left event"[^>]*>\s*<a[^>]*>\s*(.*?)\s*</a>', re.S)
PREV_RE = re.compile(r'event-\d+-previous"[^>]*><span[^>]*>([^<]*)</span>')
FORECAST_RE = re.compile(r'event-\d+-forecast[^>]*>([^<]*)<')


def fetch_tab(tab: str) -> str:
    body = urllib.parse.urlencode([
        ("country[]", COUNTRY_US),
        ("importance[]", STARS_THREE),
        ("timeZone", TZ_UTC),
        ("timeFilter", "timeRemain"),
        ("currentTab", tab),
        ("submitFilters", "1"),
        ("limit_from", "0"),
    ])
    req = urllib.request.Request(ENDPOINT, data=body.encode(), headers=HEADERS, method="POST")
    with urllib.request.urlopen(req, timeout=30) as resp:
        payload = json.loads(resp.read())
    return payload.get("data", "") or ""


def parse_rows(html: str):
    out = []
    for m in ROW_RE.finditer(html):
        eid = m.group(1)
        dt_raw = m.group(2)
        inner = m.group(3)
        title_m = TITLE_RE.search(inner)
        title = re.sub(r"\s+", " ", title_m.group(1)).strip() if title_m else ""
        bulls = inner.count("grayFullBullishIcon")
        prev_m = PREV_RE.search(inner)
        forecast_m = FORECAST_RE.search(inner)
        try:
            dt = datetime.strptime(dt_raw, "%Y/%m/%d %H:%M:%S").replace(tzinfo=timezone.utc)
        except ValueError:
            continue
        out.append({
            "id": f"econ-{eid}",
            "title": title,
            "deadline": dt.isoformat().replace("+00:00", "Z"),
            "stars": bulls,
            "forecast": (forecast_m.group(1).replace("&nbsp;", "").strip() or None) if forecast_m else None,
            "previous": (prev_m.group(1).strip() or None) if prev_m else None,
            "_dt": dt,
        })
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=3, help="Max events to keep (default 3)")
    ap.add_argument("--days", type=int, default=14, help="Look-ahead window in days (default 14)")
    ap.add_argument("--out", default=None, help="Output JSON path (default: data/economic-calendar.json next to repo root)")
    args = ap.parse_args()

    repo_root = Path(__file__).resolve().parent.parent
    out_path = Path(args.out) if args.out else repo_root / "data" / "economic-calendar.json"

    rows = []
    for tab in ("thisWeek", "nextWeek"):
        try:
            rows.extend(parse_rows(fetch_tab(tab)))
        except Exception as ex:
            print(f"WARN: tab={tab} fetch failed: {ex}", file=sys.stderr)

    now = datetime.now(timezone.utc)
    horizon = now.timestamp() + args.days * 86400

    seen = set()
    future = []
    for r in rows:
        if r["id"] in seen:
            continue
        seen.add(r["id"])
        if r["stars"] != 3:
            continue
        if r["_dt"] <= now:
            continue
        if r["_dt"].timestamp() > horizon:
            continue
        future.append(r)

    future.sort(key=lambda x: x["_dt"])
    keep = future[: args.limit]

    payload = {
        "fetched_at": now.isoformat().replace("+00:00", "Z"),
        "source": "investing.com",
        "country": "US",
        "stars": 3,
        "events": [
            {
                "id": r["id"],
                "title": r["title"],
                "deadline": r["deadline"],
                "category": "macro",
                "severity": "high",
                "stars": r["stars"],
                "forecast": r["forecast"],
                "previous": r["previous"],
                "countdown": True,
                "status": "active",
                "source": "investing.com",
            }
            for r in keep
        ],
    }

    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w") as f:
        json.dump(payload, f, indent=2)
        f.write("\n")
    print(f"Wrote {len(payload['events'])} events to {out_path}")
    for e in payload["events"]:
        print(f"  {e['deadline']}  ★{e['stars']}  {e['title']}  fc={e['forecast']} prev={e['previous']}")


if __name__ == "__main__":
    main()
