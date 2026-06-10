#!/usr/bin/env python3
"""
fetch-earnings-calendar.py — Pull upcoming US earnings releases from
Investing.com's earnings calendar service and write them to
data/earnings-calendar.json.

Used by `weekly-catalyst-scan.py` to populate the Earnings column on the
Week Ahead page. Scope is intentionally broader than `watchlist.json`
earnings injection (which only covers our 74-81 tracked symbols) — we want
the whole US large-cap tape so signals like ACN/KR/JBL surface even when
they're not in the watchlist.

Output schema is normalized to match `weekly-catalysts.json` event shape.

Usage:
    python3 scripts/fetch-earnings-calendar.py [--weeks 2] [--min-cap-b 1.0] [--dry-run]

No API key needed. Same endpoint Investing.com's UI calls when filtering
the calendar.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone, timedelta
from pathlib import Path

ENDPOINT = "https://www.investing.com/earnings-calendar/Service/getCalendarFilteredData"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "X-Requested-With": "XMLHttpRequest",
    "Referer": "https://www.investing.com/earnings-calendar/",
    "Content-Type": "application/x-www-form-urlencoded",
    "Accept": "application/json, text/javascript, */*; q=0.01",
}

COUNTRY_US = "5"

# Day divider rows we use to anchor each ticker row to a date
DAY_DIVIDER_RE = re.compile(r'class="theDay">([^<]+)</td>', re.S)
ROW_RE = re.compile(r'<tr[^>]*?>(.*?)</tr>', re.S)
SYMBOL_RE = re.compile(r'class="bold middle"[^>]*>([A-Z\.\-]+)</a>', re.S)
NAME_RE = re.compile(r'class="earnCalCompanyName middle">([^<]+)</span>', re.S)
CAP_RE = re.compile(r'<td class="right">([\d.]+[KMBT])</td>', re.S)
TIME_RE = re.compile(r'data-tooltip="(Before market open|After market close|During market trading)"', re.S)
EPS_FORECAST_RE = re.compile(r'class="leftStrong">/&nbsp;&nbsp;([^<]+)</td>', re.S)
EPS_ACTUAL_RE = re.compile(r'eps_actual[^>]*">([^<]+)</td>', re.S)


def fetch_tab(tab: str, attempts: int = 3, backoff: float = 2.0) -> str:
    """Fetch one tab (thisWeek/nextWeek), retrying on cloudflare blanks."""
    body = urllib.parse.urlencode([
        ("country[]", COUNTRY_US),
        ("currentTab", tab),
        ("submitFilters", "1"),
        ("limit_from", "0"),
    ])
    last_err: Exception | None = None
    for i in range(attempts):
        try:
            req = urllib.request.Request(ENDPOINT, data=body.encode(), headers=HEADERS, method="POST")
            with urllib.request.urlopen(req, timeout=30) as resp:
                raw = resp.read()
            if len(raw) < 200:
                # Cloudflare challenge / empty body — short, retry
                raise RuntimeError(f"suspiciously short body ({len(raw)} bytes)")
            payload = json.loads(raw)
            return payload.get("data", "") or ""
        except Exception as ex:
            last_err = ex
            if i + 1 < attempts:
                time.sleep(backoff * (i + 1))
    raise RuntimeError(f"fetch_tab({tab}) failed after {attempts} tries: {last_err}")


def cap_to_billions(cap: str | None) -> float | None:
    if not cap:
        return None
    units = {"K": 1e-6, "M": 1e-3, "B": 1.0, "T": 1e3}
    try:
        return round(float(cap[:-1]) * units.get(cap[-1].upper(), 0), 4)
    except Exception:
        return None


def parse_day(day_str: str) -> datetime | None:
    """'Monday, June 15, 2026' → datetime at 00:00 UTC."""
    try:
        return datetime.strptime(day_str.strip(), "%A, %B %d, %Y").replace(tzinfo=timezone.utc)
    except Exception:
        return None


def deadline_for(day: datetime, when: str) -> str:
    """Convert (day, BMO/AMC/intraday) → ISO timestamp anchored in ET.

    BMO  → 08:30 ET (pre-market window opens ~8:00, key data ~8:30)
    AMC  → 16:00 ET (post-close)
    intra → 12:00 ET (catch-all)
    """
    h, m = (16, 0)
    if when == "Before market open":
        h, m = 8, 30
    elif when == "During market trading":
        h, m = 12, 0
    # Naive ET — convert to UTC. Investing.com timezone defaults to UTC for the
    # Service endpoint when omitted; the day boundary is what we care about.
    # We use a fixed -04:00 (EDT) which is correct for Jun-Nov; close enough
    # for cards rendering across the week. Frontend re-renders countdowns
    # against the exact ISO timestamp.
    iso = day.replace(hour=h, minute=m).astimezone(timezone.utc).isoformat()
    return iso.replace("+00:00", "Z")


def parse_html(html: str) -> list[dict]:
    """Walk through rows, tracking the current day divider, and collect events."""
    out: list[dict] = []
    current_day: datetime | None = None
    for m in ROW_RE.finditer(html):
        row = m.group(1)
        day_m = DAY_DIVIDER_RE.search(row)
        if day_m:
            current_day = parse_day(day_m.group(1))
            continue
        if current_day is None:
            continue
        sym_m = SYMBOL_RE.search(row)
        if not sym_m:
            continue
        name_m = NAME_RE.search(row)
        cap_m = CAP_RE.search(row)
        time_m = TIME_RE.search(row)
        eps_fc_m = EPS_FORECAST_RE.search(row)
        when = time_m.group(1) if time_m else "After market close"
        cap_b = cap_to_billions(cap_m.group(1) if cap_m else None)
        out.append({
            "symbol": sym_m.group(1).strip(),
            "name": (name_m.group(1).strip() if name_m else ""),
            "day_iso": current_day.date().isoformat(),
            "deadline": deadline_for(current_day, when),
            "bmo_amc": "BMO" if when == "Before market open" else ("AMC" if when == "After market close" else "intra"),
            "cap_b": cap_b,
            "eps_forecast": (eps_fc_m.group(1).strip() if eps_fc_m else None),
        })
    return out


def severity_for(symbol: str, cap_b: float | None, days_until: int) -> str:
    MEGA = {"NVDA","AAPL","MSFT","META","GOOGL","GOOG","AMZN","TSLA","BRK-A","BRK-B","BRK.B","LLY","V","JPM","MA","XOM","UNH","WMT","COST","JNJ","PG","HD","ORCL","ABBV","NFLX","CRM","BAC","KO","CVX","AVGO","TMO","ADBE","PEP","MRK"}
    if symbol in MEGA and days_until <= 7:
        return "critical"
    if cap_b is not None and cap_b >= 50 and days_until <= 7:
        return "high"
    if cap_b is not None and cap_b >= 10:
        return "high"
    if cap_b is not None and cap_b >= 1:
        return "medium"
    return "low"


def context_for(symbol: str, name: str, cap_b: float | None, when: str) -> str:
    """Templatized headline-context — short, informative."""
    name = name or symbol
    cap_str = f"${cap_b:.1f}B mkt cap" if cap_b else "small-cap"
    when_str = {"BMO": "before market open", "AMC": "after market close", "intra": "during the session"}.get(when, "")
    if cap_b and cap_b >= 100:
        tier = "Mega-cap quarterly print — sector tell + index weight."
    elif cap_b and cap_b >= 50:
        tier = "Large-cap print — sector read with ATM-straddle implied move."
    elif cap_b and cap_b >= 10:
        tier = "Mid/large-cap print — relevant to its sub-sector."
    elif cap_b and cap_b >= 1:
        tier = "Small/mid-cap print."
    else:
        tier = "Small-cap or micro-cap print."
    return f"{name} ({symbol}) reports {when_str}. {cap_str}. {tier}"


def normalize(rows: list[dict], min_cap_b: float | None, weeks: int) -> list[dict]:
    """Filter + enrich raw rows into the normalized event shape."""
    now = datetime.now(timezone.utc)
    horizon = now + timedelta(days=weeks * 7 + 1)
    seen: set[str] = set()
    out: list[dict] = []
    for r in rows:
        try:
            dl = datetime.fromisoformat(r["deadline"].replace("Z", "+00:00"))
        except Exception:
            continue
        if dl <= now:
            continue
        if dl > horizon:
            continue
        if min_cap_b is not None and (r["cap_b"] is None or r["cap_b"] < min_cap_b):
            continue
        eid = f"earn-{r['symbol']}-{r['day_iso']}"
        if eid in seen:
            continue
        seen.add(eid)
        days_until = max(0, (dl - now).days)
        sev = severity_for(r["symbol"], r["cap_b"], days_until)
        out.append({
            "id": eid,
            "category": "earnings",
            "title": f"{r['name']} ({r['symbol']}) — Earnings",
            "context": context_for(r["symbol"], r["name"], r["cap_b"], r["bmo_amc"]),
            "deadline": r["deadline"],
            "tickers": [r["symbol"]],
            "severity": sev,
            "stars": None,
            "source": "investing.com",
            "extra": {
                "bmo_amc": r["bmo_amc"],
                "market_cap_b": r["cap_b"],
                "eps_forecast": r["eps_forecast"],
                "name": r["name"],
            },
        })
    out.sort(key=lambda e: (e["deadline"], -(e["extra"]["market_cap_b"] or 0)))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--weeks", type=int, default=2, help="Look-ahead in weeks (default 2 = thisWeek+nextWeek)")
    ap.add_argument("--min-cap-b", type=float, default=1.0, help="Minimum market cap in billions to surface (default 1.0)")
    ap.add_argument("--dry-run", action="store_true", help="Print output, don't write file")
    ap.add_argument("--out", default=None, help="Output JSON path (default: data/earnings-calendar.json next to repo root)")
    args = ap.parse_args()

    repo_root = Path(__file__).resolve().parent.parent
    out_path = Path(args.out) if args.out else repo_root / "data" / "earnings-calendar.json"

    tabs = ["thisWeek"]
    if args.weeks >= 2:
        tabs.append("nextWeek")

    raw_rows: list[dict] = []
    errors: list[str] = []
    for tab in tabs:
        try:
            html = fetch_tab(tab)
            raw_rows.extend(parse_html(html))
        except Exception as ex:
            errors.append(f"{tab}: {ex}")
            print(f"WARN: tab={tab} failed: {ex}", file=sys.stderr)

    events = normalize(raw_rows, args.min_cap_b, args.weeks)

    payload = {
        "fetched_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "source": "investing.com",
        "country": "US",
        "weeks": args.weeks,
        "min_cap_b": args.min_cap_b,
        "events": events,
        "errors": errors or None,
    }

    if args.dry_run:
        print(json.dumps(payload, indent=2))
        print(f"\n[dry-run] {len(events)} events, would write to {out_path}", file=sys.stderr)
        return

    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w") as f:
        json.dump(payload, f, indent=2)
        f.write("\n")
    print(f"Wrote {len(events)} earnings events to {out_path}")
    for e in events[:10]:
        cap = e["extra"]["market_cap_b"]
        print(f"  {e['deadline']}  {e['extra']['bmo_amc']:>4}  {e['tickers'][0]:8} ${cap:>7.2f}B  {e['severity']:>8}  {e['extra']['name'][:40]}")
    if len(events) > 10:
        print(f"  ... and {len(events) - 10} more")


if __name__ == "__main__":
    main()
