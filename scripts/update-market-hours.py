#!/usr/bin/env python3
"""
update-market-hours.py — Refresh NYSE holiday calendar for the current + next year.
Uses the `exchange_calendars` package if available, otherwise hardcodes known holidays.
Run annually via GitHub Actions or manually.
"""

import json
from datetime import datetime, timezone
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
OUT_FILE = DATA_DIR / "market-hours.json"


def get_holidays_from_exchange_calendars(year):
    """Use exchange_calendars package for accurate NYSE holidays."""
    import exchange_calendars as xcals
    import pandas as pd
    nyse = xcals.get_calendar("XNYS")

    holidays = []
    early_closes = []

    # Holidays = business days that aren't sessions
    all_bdays = pd.bdate_range(f"{year}-01-01", f"{year}-12-31")
    sessions = nyse.sessions_in_range(f"{year}-01-01", f"{year}-12-31")
    for ts in all_bdays.difference(sessions):
        d = ts.date()
        holidays.append({"date": d.isoformat(), "name": _holiday_name(d)})

    # Early closes (property, not method)
    ec_index = nyse.early_closes
    for ts in ec_index:
        d = ts.date() if hasattr(ts, 'date') else ts
        if d.year == year:
            early_closes.append({"date": d.isoformat(), "close": "13:00", "name": _early_close_name(d)})

    return holidays, early_closes


def _holiday_name(d):
    """Best-effort holiday name from date."""
    month_day = (d.month, d.day)
    names = {
        (1, 1): "New Year's Day",
        (6, 19): "Juneteenth",
        (7, 4): "Independence Day",
        (12, 25): "Christmas Day",
    }
    if month_day in names:
        return names[month_day]
    if d.month == 1 and d.weekday() == 0 and 15 <= d.day <= 21:
        return "Martin Luther King Jr. Day"
    if d.month == 2 and d.weekday() == 0 and 15 <= d.day <= 21:
        return "Presidents' Day"
    if d.month == 5 and d.weekday() == 0 and d.day >= 25:
        return "Memorial Day"
    if d.month == 9 and d.weekday() == 0 and d.day <= 7:
        return "Labor Day"
    if d.month == 11 and d.weekday() == 3 and 22 <= d.day <= 28:
        return "Thanksgiving Day"
    if d.month == 3 or d.month == 4:
        return "Good Friday"
    # Observed holidays (shifted for weekends)
    if d.month == 1 and d.day == 2:
        return "New Year's Day (observed)"
    if d.month == 7 and d.day in (3, 5):
        return "Independence Day (observed)"
    if d.month == 12 and d.day in (24, 26):
        return "Christmas Day (observed)"
    if d.month == 6 and d.day in (18, 20):
        return "Juneteenth (observed)"
    return "Market Holiday"


def _early_close_name(d):
    if d.month == 11:
        return "Day After Thanksgiving"
    if d.month == 12:
        return "Christmas Eve"
    if d.month == 7:
        return "Day Before Independence Day"
    return "Early Close"


def get_holidays_fallback(year):
    """Hardcoded fallback for known years when exchange_calendars isn't available."""
    known = {
        2026: {
            "holidays": [
                {"date": "2026-01-01", "name": "New Year's Day"},
                {"date": "2026-01-19", "name": "Martin Luther King Jr. Day"},
                {"date": "2026-02-16", "name": "Presidents' Day"},
                {"date": "2026-04-03", "name": "Good Friday"},
                {"date": "2026-05-25", "name": "Memorial Day"},
                {"date": "2026-06-19", "name": "Juneteenth"},
                {"date": "2026-07-03", "name": "Independence Day (observed)"},
                {"date": "2026-09-07", "name": "Labor Day"},
                {"date": "2026-11-26", "name": "Thanksgiving Day"},
                {"date": "2026-12-25", "name": "Christmas Day"},
            ],
            "earlyClose": [
                {"date": "2026-11-27", "close": "13:00", "name": "Day After Thanksgiving"},
                {"date": "2026-12-24", "close": "13:00", "name": "Christmas Eve"},
            ],
        },
        2027: {
            "holidays": [
                {"date": "2027-01-01", "name": "New Year's Day"},
                {"date": "2027-01-18", "name": "Martin Luther King Jr. Day"},
                {"date": "2027-02-15", "name": "Presidents' Day"},
                {"date": "2027-03-26", "name": "Good Friday"},
                {"date": "2027-05-31", "name": "Memorial Day"},
                {"date": "2027-06-18", "name": "Juneteenth (observed)"},
                {"date": "2027-07-05", "name": "Independence Day (observed)"},
                {"date": "2027-09-06", "name": "Labor Day"},
                {"date": "2027-11-25", "name": "Thanksgiving Day"},
                {"date": "2027-12-24", "name": "Christmas Day (observed)"},
            ],
            "earlyClose": [
                {"date": "2027-11-26", "close": "13:00", "name": "Day After Thanksgiving"},
            ],
        },
    }
    if year in known:
        return known[year]["holidays"], known[year]["earlyClose"]
    return [], []


def main():
    now = datetime.now(timezone.utc)
    current_year = now.year
    years = [current_year, current_year + 1]

    all_holidays = {}
    all_early = {}
    sources = {}

    for year in years:
        try:
            holidays, early = get_holidays_from_exchange_calendars(year)
            source = "exchange_calendars"
            print(f"  ✅ {year}: {len(holidays)} holidays, {len(early)} early closes (from exchange_calendars)")
        except ImportError:
            holidays, early = get_holidays_fallback(year)
            source = "hardcoded"
            print(f"  ⚠️ {year}: {len(holidays)} holidays, {len(early)} early closes (hardcoded fallback)")
        except Exception as e:
            holidays, early = get_holidays_fallback(year)
            source = "hardcoded"
            print(f"  ⚠️ {year}: error ({e}), using hardcoded fallback")

        all_holidays[str(year)] = holidays
        all_early[str(year)] = early
        sources[str(year)] = source

    # Top-level source: "exchange_calendars" if current year used it, else "mixed" or "hardcoded"
    current_src = sources.get(str(current_year), "hardcoded")
    top_source = current_src if all(s == current_src for s in sources.values()) else "mixed"

    result = {
        "exchange": "NYSE",
        "timezone": "America/New_York",
        "regularHours": {"open": "09:30", "close": "16:00"},
        "extendedHours": {
            "premarket": {"open": "04:00", "close": "09:30"},
            "afterhours": {"open": "16:00", "close": "20:00"},
        },
        "holidays": all_holidays,
        "earlyClose": all_early,
        "generatedAt": now.isoformat(),
        "source": top_source,
        "sourcePerYear": sources,
    }

    OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT_FILE, "w") as f:
        json.dump(result, f, indent=2)

    total_h = sum(len(v) for v in all_holidays.values())
    total_e = sum(len(v) for v in all_early.values())
    print(f"✅ Wrote {OUT_FILE.name}: {total_h} holidays, {total_e} early closes across {len(years)} years")


if __name__ == "__main__":
    main()
