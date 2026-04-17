"""Tests for scripts/validate-regime.py.

The validator is the safety net that runs after update-regime.py in the
pipeline. These tests ensure it catches the Apr 16 bug class (silent zero
overwriting a real metric) and won't false-alarm on legitimate states.
"""
import importlib.util
import json
import tempfile
from datetime import datetime, timezone
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
SCRIPT = ROOT / "scripts" / "validate-regime.py"


@pytest.fixture(scope="module")
def vr():
    spec = importlib.util.spec_from_file_location("validate_regime", SCRIPT)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def _write(tmp, data):
    p = Path(tmp) / "regime.json"
    p.write_text(json.dumps(data))
    return p


def _good_regime(vr):
    """A minimal valid regime.json body."""
    now = datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')
    return {
        'regime': 'BULL',
        'updated': now,
        'components': {
            k: {'score': 50, 'value': 50 if k != 'sp_vs_d200' else 5.95,
                'signal': 'neutral', 'weight': 5}
            for k in vr.EXPECTED_COMPONENTS
        },
        'transition_signals': {
            'target': 'STRONG_BULL',
            'conditions_met': 1,
            'conditions_total': 2,
            'conditions': [
                {'label': 'F&G > 65', 'current': 70, 'target': 65, 'met': True},
                {'label': 'Breadth > 65%', 'current': 60, 'target': 65, 'met': False},
            ],
        },
    }


def test_good_file_passes(vr, tmp_path):
    p = _write(tmp_path, _good_regime(vr))
    assert vr.validate(p) == []


def test_missing_file(vr, tmp_path):
    p = tmp_path / "does-not-exist.json"
    problems = vr.validate(p)
    assert any("not found" in x for x in problems)


def test_malformed_json(vr, tmp_path):
    p = tmp_path / "regime.json"
    p.write_text("{not valid json")
    problems = vr.validate(p)
    assert any("not valid JSON" in x for x in problems)


def test_unknown_regime_flagged(vr, tmp_path):
    d = _good_regime(vr)
    d['regime'] = 'BOGUS'
    p = _write(tmp_path, d)
    problems = vr.validate(p)
    assert any("unknown regime" in x for x in problems)


def test_missing_component_flagged(vr, tmp_path):
    d = _good_regime(vr)
    del d['components']['sp_vs_d200']
    p = _write(tmp_path, d)
    problems = vr.validate(p)
    assert any("missing components" in x and "sp_vs_d200" in x for x in problems)


def test_apr16_silent_zero_caught(vr, tmp_path):
    """THE canary: value=0 with a non-sentinel signal label is the exact
    shape of the Apr 16 bug. Validator MUST flag it."""
    d = _good_regime(vr)
    d['components']['sp_vs_d200'] = {
        'score': 50, 'value': 0, 'signal': 'above', 'weight': 8,
    }
    p = _write(tmp_path, d)
    problems = vr.validate(p)
    assert any("silent zero" in x.lower() for x in problems), \
        f"expected silent-zero detection, got: {problems}"


def test_zero_with_no_data_sentinel_is_ok(vr, tmp_path):
    """value=0 with signal='no_data' is a legitimate sentinel — no false alarm."""
    d = _good_regime(vr)
    d['components']['dxy'] = {
        'score': 50, 'value': 0, 'signal': 'no_data', 'weight': 5,
    }
    p = _write(tmp_path, d)
    problems = vr.validate(p)
    assert not any("dxy" in x for x in problems), \
        f"legitimate sentinel should not trigger: {problems}"


def test_put_call_zero_allowed(vr, tmp_path):
    """put_call legitimately returns 0/'no_data' until real source wired."""
    d = _good_regime(vr)
    d['components']['put_call'] = {
        'score': 50, 'value': 0, 'signal': 'no_data', 'weight': 4,
    }
    p = _write(tmp_path, d)
    problems = vr.validate(p)
    assert not any("put_call" in x for x in problems)


def test_stale_conditions_counted_as_met_flagged(vr, tmp_path):
    """If conditions_met includes a stale condition, validator flags it."""
    d = _good_regime(vr)
    d['transition_signals']['conditions'] = [
        {'label': 'F&G > 65', 'current': 70, 'target': 65, 'met': True},
        {'label': 'S&P', 'current': 6, 'target': 5, 'met': True, 'stale': True},
    ]
    d['transition_signals']['conditions_met'] = 2  # wrong — stale must not count
    p = _write(tmp_path, d)
    problems = vr.validate(p)
    assert any("stale conditions must NOT count as met" in x for x in problems)


def test_stale_file_flagged(vr, tmp_path):
    """A file older than MAX_AGE_HOURS is flagged (pipeline stall detector)."""
    d = _good_regime(vr)
    d['updated'] = '2025-01-01T00:00:00Z'
    p = _write(tmp_path, d)
    problems = vr.validate(p)
    assert any("old" in x.lower() for x in problems)
