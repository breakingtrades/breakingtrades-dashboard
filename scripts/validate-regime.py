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
from datetime import datetime, timezone
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

MAX_AGE_HOURS = 24


def validate(path: Path) -> list[str]:
    """Return a list of violation messages. Empty list = valid."""
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

    # Rule 6: file freshness
    updated_raw = data.get('updated') or data.get('timestamp')
    if updated_raw:
        try:
            updated = datetime.fromisoformat(updated_raw.replace('Z', '+00:00'))
            if updated.tzinfo is None:
                updated = updated.replace(tzinfo=timezone.utc)
            age_hours = (datetime.now(timezone.utc) - updated).total_seconds() / 3600
            if age_hours > MAX_AGE_HOURS:
                problems.append(
                    f"regime.json is {age_hours:.1f}h old (max {MAX_AGE_HOURS}h) — "
                    f"pipeline may be stalled"
                )
        except (ValueError, TypeError) as exc:
            problems.append(f"could not parse 'updated' timestamp: {exc}")

    return problems


def main(argv: list[str]) -> int:
    path = Path(argv[1]) if len(argv) > 1 else Path(__file__).resolve().parent.parent / "data" / "regime.json"
    problems = validate(path)
    if problems:
        print(f"[validate-regime] ❌ {len(problems)} violation(s) in {path}:")
        for p in problems:
            print(f"  - {p}")
        return 1
    print(f"[validate-regime] ✓ {path.name} passes all checks")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
