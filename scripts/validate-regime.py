#!/usr/bin/env python3
"""Runtime validator for data/regime.json.

Runs after update-regime.py in the pipeline. Exits non-zero on sanity
violations — prevents a corrupted file from being served to the UI.

Rules enforced:
  1. All 15 known components are present
  2. No component has value=0 with a non-sentinel signal label
     (catches the Apr 16 class: silent zero overwriting a real metric)
  3. conditions_met == count(met=True AND NOT stale)  (accounting consistency)
  4. regime is in the known set
  5. If a component is flagged stale, signal label is a sentinel OR value
     matches a previously-valid shape (non-zero for most signals)
  6. File was written in the last 24h (catches a stalled cron silently)

Exit 0: valid. Exit non-zero: print the violation and leave the file
alone (caller decides whether to revert or just alert).

Usage:
  python scripts/validate-regime.py            # validate ./data/regime.json
  python scripts/validate-regime.py PATH       # validate a specific file
"""
import json
import sys
from datetime import datetime, timezone, timedelta, date
from pathlib import Path

EXPECTED_COMPONENTS = {
    'move', 'fear_greed', 'vix', 'breadth', 'sp_vs_d200',
    'hyg_spy', 'xlf_spy', 'dxy', 'yield_curve', 'growth_value',
    'rsp_spy', 'put_call', 'copper_gold', 'international', 'xly_xlp',
}

KNOWN_REGIMES = {
    'CRISIS', 'BEAR', 'CORRECTION', 'NEUTRAL',
    'BULL', 'STRONG_BULL', 'EUPHORIA',
}

SENTINEL_SIGNALS = {'no_data', 'no_sma'}

# put_call legitimately returns (50, 0, 'no_data') until real data source
# is wired. Don't false-alarm on it.
ALLOWED_ZERO_WITH_NODATA = {'put_call'}

# Freshness is measured in TRADING days, not wall-clock hours. The EOD pipeline
# only runs on trading days, so on a Monday (or after a long weekend / holiday)
# the committed regime.json is legitimately 60-90h old yet perfectly current.
# A flat 24h check therefore false-fails every weekend in CI. We allow the file
# to be as old as the last completed trading day plus a same-day grace window.
MAX_AGE_HOURS = 24  # retained for back-compat / same-day pipeline use
GRACE_HOURS = 30    # slack past the last trading day's close for the cron to land


def _load_holidays() -> set:
    """Return a set of US market holiday date objects from market-hours.json.
    Empty set if the file is missing/unreadable (degrades to weekend-only)."""
    try:
        mh = json.loads((Path(__file__).resolve().parent.parent / "data" / "market-hours.json").read_text())
    except (OSError, json.JSONDecodeError):
        return set()
    out = set()
    for _yr, items in (mh.get('holidays') or {}).items():
        for h in items:
            try:
                out.add(date.fromisoformat(h['date']))
            except (KeyError, ValueError):
                continue
    return out


def _is_trading_day(d: date, holidays: set) -> bool:
    return d.weekday() < 5 and d not in holidays


def _last_trading_day(ref: date, holidays: set) -> date:
    """Most recent trading day on or before ref."""
    d = ref
    for _ in range(15):  # safety bound covers any holiday cluster
        if _is_trading_day(d, holidays):
            return d
        d -= timedelta(days=1)
    return ref


def _freshness_problem(updated: datetime, now: datetime) -> str | None:
    """Trading-day-aware staleness. Returns a violation string or None.

    The file is fresh if it was written at/after the close of the last
    completed trading day (minus a grace window for cron timing). On any
    non-trading day, or the morning of a trading day before the EOD run,
    yesterday's (or Friday's) file is correct and must not fail.
    """
    holidays = _load_holidays()
    last_td = _last_trading_day(now.date(), holidays)
    # If 'now' is itself a trading day but before ~end of day, the freshest the
    # file can be is the PRIOR trading day's EOD run. Use the prior trading day
    # as the expected anchor whenever today's EOD run hasn't plausibly happened.
    expected_anchor = last_td
    if _is_trading_day(now.date(), holidays):
        prior = _last_trading_day(last_td - timedelta(days=1), holidays)
        # today's EOD lands ~21:40 UTC; before that, prior day's file is current
        if now.hour < 22:
            expected_anchor = prior
    # Allowed cutoff: start of expected_anchor day, with grace past it.
    cutoff = datetime(expected_anchor.year, expected_anchor.month, expected_anchor.day,
                      tzinfo=timezone.utc) - timedelta(hours=GRACE_HOURS)
    if updated < cutoff:
        age_h = (now - updated).total_seconds() / 3600
        return (f"regime.json is {age_h:.1f}h old; older than the last trading day "
                f"({expected_anchor.isoformat()}) minus {GRACE_HOURS}h grace — pipeline may be stalled")
    return None


def validate(path: Path, check_freshness: bool = True) -> list[str]:
    """Return a list of violation messages. Empty list = valid.

    check_freshness=False skips the trading-day staleness rule — used when
    validating a committed file in CI, where recency of data is not a code gate.
    """
    problems: list[str] = []

    if not path.exists():
        return [f"regime.json not found at {path}"]

    try:
        data = json.loads(path.read_text())
    except json.JSONDecodeError as exc:
        return [f"regime.json is not valid JSON: {exc}"]

    # Rule 4: known regime
    regime = data.get('regime')
    if regime not in KNOWN_REGIMES:
        problems.append(f"unknown regime: {regime!r}")

    components = data.get('components') or {}

    # Rule 1: all expected components present
    missing = EXPECTED_COMPONENTS - set(components.keys())
    if missing:
        problems.append(f"missing components: {sorted(missing)}")

    # Rule 2 & 5: value=0 with non-sentinel label → silent zero
    for key, comp in components.items():
        if not isinstance(comp, dict):
            problems.append(f"{key}: component is not an object")
            continue
        value = comp.get('value')
        signal = comp.get('signal', '')
        stale = bool(comp.get('stale'))

        if value == 0 and signal not in SENTINEL_SIGNALS and key not in ALLOWED_ZERO_WITH_NODATA:
            problems.append(
                f"{key}: value=0 with non-sentinel signal={signal!r} "
                f"(likely silent zero — the Apr 16 bug class)"
            )

        if stale and signal not in SENTINEL_SIGNALS and value == 0:
            problems.append(f"{key}: stale flag set but value=0 and signal is not a sentinel")

    # Rule 3: conditions_met accounting
    ts = data.get('transition_signals') or {}
    conditions = ts.get('conditions') or []
    met_count = ts.get('conditions_met')
    if met_count is not None:
        actual = sum(1 for c in conditions if c.get('met') and not c.get('stale'))
        if actual != met_count:
            problems.append(
                f"transition_signals.conditions_met={met_count} but computed={actual} "
                f"(stale conditions must NOT count as met)"
            )

    # Rule 6: file freshness (trading-day aware — see _freshness_problem)
    if check_freshness:
        updated_raw = data.get('updated') or data.get('timestamp')
        if updated_raw:
            try:
                updated = datetime.fromisoformat(updated_raw.replace('Z', '+00:00'))
                if updated.tzinfo is None:
                    updated = updated.replace(tzinfo=timezone.utc)
                fp = _freshness_problem(updated, datetime.now(timezone.utc))
                if fp:
                    problems.append(fp)
            except (ValueError, TypeError) as exc:
                problems.append(f"could not parse 'updated' timestamp: {exc}")

    return problems


def main(argv: list[str]) -> int:
    args = [a for a in argv[1:] if not a.startswith('-')]
    flags = {a for a in argv[1:] if a.startswith('-')}
    # CI validates the COMMITTED file on every push, including weekends/holidays
    # when the EOD pipeline legitimately hasn't run — recency is not a code gate
    # there. Pass --no-freshness in CI to validate structure only.
    check_freshness = '--no-freshness' not in flags
    path = Path(args[0]) if args else Path(__file__).resolve().parent.parent / "data" / "regime.json"
    problems = validate(path, check_freshness=check_freshness)
    if problems:
        print(f"[validate-regime] ❌ {len(problems)} violation(s) in {path}:")
        for p in problems:
            print(f"  - {p}")
        return 1
    suffix = "" if check_freshness else " (freshness skipped)"
    print(f"[validate-regime] ✓ {path.name} passes all checks{suffix}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
