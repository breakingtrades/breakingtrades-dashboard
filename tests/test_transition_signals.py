"""Tests for get_transition_signals + cond() in scripts/update-regime.py.

Triggered by the Apr 16 bug where 'S&P > 5% above D200' showed as 0.00
and unmet. Separately, we discovered cond() would have silently flipped
a stale value to 'met' if it happened to straddle the threshold.

Covers:
- Happy path: real values correctly evaluated against thresholds
- Stale path: carry-forward/no_data components NEVER counted as met
- Sentinel path: 'no_data' / 'no_sma' signal labels also force met=False
- Missing component: defaults to 0/unmet, not crash
- Conditions_met / conditions_total accounting is consistent with stale flag
"""
import importlib.util
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
SCRIPT = ROOT / "scripts" / "update-regime.py"


@pytest.fixture(scope="module")
def ur():
    spec = importlib.util.spec_from_file_location("update_regime", SCRIPT)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def _comp(value, signal='above', stale=False):
    d = {'score': 70, 'value': value, 'signal': signal, 'weight': 8}
    if stale:
        d['stale'] = True
    return d


# ────────────────────────────────────────────────────────────────────────────
# Happy path
# ────────────────────────────────────────────────────────────────────────────

def test_bull_target_strong_bull_real_data(ur):
    """BULL → STRONG_BULL with real data: 2 of 3 met (Apr 17 actual state)."""
    components = {
        'fear_greed': _comp(62.2, 'neutral'),   # target > 65 → False
        'breadth':    _comp(66.8, 'strong'),    # target > 65 → True
        'sp_vs_d200': _comp(5.95, 'above'),     # target > 5  → True
    }
    t = ur.get_transition_signals('BULL', components)
    assert t['target'] == 'STRONG_BULL'
    assert t['conditions_met'] == 2
    assert t['conditions_total'] == 3
    assert not any(c.get('stale') for c in t['conditions'])


def test_crisis_target_bear_all_met(ur):
    """CRISIS → BEAR when all 5 conditions line up."""
    components = {
        'fear_greed': _comp(30),          # > 25
        'vix':        _comp(18),          # < 22
        'breadth':    _comp(50),          # > 45
        'move':       _comp(85),          # < 90
        'hyg_spy':    _comp(0.5),         # > -0.5
    }
    t = ur.get_transition_signals('CRISIS', components)
    assert t['conditions_met'] == 5
    assert t['conditions_total'] == 5


def test_unknown_regime_returns_empty(ur):
    """Unknown regime name → safe default, no crash."""
    t = ur.get_transition_signals('BOGUS', {})
    assert t['target'] == 'NEUTRAL'
    assert t['conditions'] == []
    assert t['conditions_total'] == 0
    assert t['conditions_met'] == 0


# ────────────────────────────────────────────────────────────────────────────
# Stale path — CRITICAL: never show a stale value as met
# ────────────────────────────────────────────────────────────────────────────

def test_stale_component_forces_unmet_even_if_value_passes(ur):
    """A stale component MUST NOT flip a condition to met, even if its value
    straddles the threshold. This is the most important test in the file."""
    components = {
        'fear_greed': _comp(62.2, 'neutral'),
        'breadth':    _comp(66.8, 'strong'),
        'sp_vs_d200': _comp(5.95, 'above', stale=True),  # stale!
    }
    t = ur.get_transition_signals('BULL', components)
    sp_cond = next(c for c in t['conditions'] if 'D200' in c['label'])
    assert sp_cond['met'] is False, "stale component must not count as met"
    assert sp_cond['stale'] is True, "stale flag must propagate to condition"
    # met count excludes stale
    assert t['conditions_met'] == 1  # only breadth


def test_no_data_signal_forces_unmet(ur):
    """A component with signal='no_data' is a sentinel — must force met=False."""
    components = {
        'fear_greed': _comp(62.2, 'neutral'),
        'breadth':    _comp(66.8, 'strong'),
        'sp_vs_d200': _comp(5.95, 'no_data'),  # sentinel label
    }
    t = ur.get_transition_signals('BULL', components)
    sp_cond = next(c for c in t['conditions'] if 'D200' in c['label'])
    assert sp_cond['met'] is False
    assert sp_cond['stale'] is True


def test_no_sma_signal_forces_unmet(ur):
    """Same for 'no_sma' sentinel."""
    components = {
        'fear_greed': _comp(62.2),
        'breadth':    _comp(66.8),
        'sp_vs_d200': _comp(0, 'no_sma'),
    }
    t = ur.get_transition_signals('BULL', components)
    sp_cond = next(c for c in t['conditions'] if 'D200' in c['label'])
    assert sp_cond['stale'] is True
    assert sp_cond['met'] is False


def test_stale_inequality_less_than_not_met(ur):
    """Stale + '<' operator also forced to unmet (e.g. VIX < 13)."""
    components = {
        'fear_greed': _comp(82),           # > 80 real
        'vix':        _comp(10, stale=True),  # stale, would pass < 13
        'breadth':    _comp(78),
    }
    t = ur.get_transition_signals('STRONG_BULL', components)
    vix_cond = next(c for c in t['conditions'] if 'VIX' in c['label'])
    assert vix_cond['met'] is False
    assert vix_cond['stale'] is True


# ────────────────────────────────────────────────────────────────────────────
# Missing component
# ────────────────────────────────────────────────────────────────────────────

def test_missing_component_is_unmet(ur):
    """If a component isn't in the dict at all, treat as 0 / unmet."""
    # BULL needs fear_greed, breadth, sp_vs_d200 — provide none
    t = ur.get_transition_signals('BULL', {})
    assert t['conditions_total'] == 3
    assert t['conditions_met'] == 0
    for c in t['conditions']:
        assert c['met'] is False


# ────────────────────────────────────────────────────────────────────────────
# conditions_met accounting consistency
# ────────────────────────────────────────────────────────────────────────────

def test_conditions_met_equals_non_stale_met_count(ur):
    """conditions_met MUST equal the count of entries with met=True AND not stale."""
    components = {
        'fear_greed': _comp(70),                   # > 65  → met
        'breadth':    _comp(66, stale=True),       # would be met but stale
        'sp_vs_d200': _comp(5.95),                 # > 5   → met
    }
    t = ur.get_transition_signals('BULL', components)
    manual_met = sum(1 for c in t['conditions'] if c['met'] and not c.get('stale'))
    assert t['conditions_met'] == manual_met
    assert t['conditions_met'] == 2  # F&G + S&P, breadth excluded as stale
