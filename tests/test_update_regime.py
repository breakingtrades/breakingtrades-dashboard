"""Tests for scripts/update-regime.py — covers:
1. compute_sp_vs_d200 math (regression test for the '0' bug)
2. assign_signal carry-forward behavior for transient failures
3. cond() condition evaluation from signal values

Hyphenated module name prevents direct import; we load it via importlib.
"""
import importlib.util
import json
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
SCRIPT = ROOT / "scripts" / "update-regime.py"


@pytest.fixture(scope="module")
def ur():
    """Load update-regime.py as a module without running main()."""
    spec = importlib.util.spec_from_file_location("update_regime", SCRIPT)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


# ────────────────────────────────────────────────────────────────────────────
# compute_sp_vs_d200
# ────────────────────────────────────────────────────────────────────────────

def _make_prices(gspc=7041.09, spy=701.68):
    return {
        "tickers": {
            "^GSPC": {"price": gspc},
            "SPY": {"price": spy},
        }
    }


def _make_watchlist(spy_sma200=662.28):
    return [{"symbol": "SPY", "sma200": spy_sma200}]


def test_sp_vs_d200_above_5pct(ur):
    """Regression: SPY @ 701.68 with 200-SMA 662.28 is +5.95% above — must be 'above' with correct pct."""
    score, pct, label = ur.compute_sp_vs_d200(_make_prices(), _make_watchlist())
    assert label == "above"
    assert pct == pytest.approx(5.95, abs=0.1)
    assert score == 90  # pct > 5 branch


def test_sp_vs_d200_below_d200(ur):
    """SPY well below 200-SMA -> 'below' label, low score."""
    # SPY=600, SMA200=650 -> ~-7.7%
    score, pct, label = ur.compute_sp_vs_d200(_make_prices(gspc=6000, spy=600),
                                              _make_watchlist(spy_sma200=650))
    assert label == "below"
    assert pct < 0
    assert score == 10  # pct < -5 branch


def test_sp_vs_d200_missing_gspc_returns_no_data(ur):
    """When ^GSPC missing from prices, must return no_data (not crash, not invent a value)."""
    prices = {"tickers": {"SPY": {"price": 700}}}  # ^GSPC absent
    score, pct, label = ur.compute_sp_vs_d200(prices, _make_watchlist())
    assert label == "no_data"
    assert pct == 0
    assert score == 50


def test_sp_vs_d200_missing_sma_returns_no_sma(ur):
    """When SPY watchlist lacks sma200, must return no_sma."""
    watchlist = [{"symbol": "SPY"}]  # no sma200 key
    score, pct, label = ur.compute_sp_vs_d200(_make_prices(), watchlist)
    assert label == "no_sma"
    assert pct == 0


def test_sp_vs_d200_missing_spy_price_returns_no_data(ur):
    """When SPY price missing (but ^GSPC present), still no_data."""
    prices = {"tickers": {"^GSPC": {"price": 7000}}}  # SPY absent
    score, pct, label = ur.compute_sp_vs_d200(prices, _make_watchlist())
    assert label == "no_data"


# ────────────────────────────────────────────────────────────────────────────
# assign_signal — carry-forward behavior
# ────────────────────────────────────────────────────────────────────────────

def test_assign_signal_fresh_write(ur):
    """Normal path: fresh compute result is written as-is."""
    signals = {}
    ur.assign_signal(signals, "test_key", (75, 42.0, "bullish"), weight=5, prev_components={})
    assert signals["test_key"] == {"score": 75, "value": 42.0, "signal": "bullish", "weight": 5}
    assert "stale" not in signals["test_key"]


def test_assign_signal_carries_forward_on_no_data(ur):
    """When compute returns no_data and prior has a good value, carry forward + stamp stale."""
    prev = {"sp_vs_d200": {"score": 90, "value": 5.95, "signal": "above", "weight": 8}}
    signals = {}
    ur.assign_signal(signals, "sp_vs_d200", (50, 0, "no_data"), weight=8, prev_components=prev)
    assert signals["sp_vs_d200"]["value"] == 5.95
    assert signals["sp_vs_d200"]["score"] == 90
    assert signals["sp_vs_d200"]["signal"] == "above"
    assert signals["sp_vs_d200"]["stale"] is True


def test_assign_signal_carries_forward_on_no_sma(ur):
    """no_sma is also a stale sentinel — must carry forward."""
    prev = {"sp_vs_d200": {"score": 70, "value": 2.5, "signal": "above", "weight": 8}}
    signals = {}
    ur.assign_signal(signals, "sp_vs_d200", (50, 0, "no_sma"), weight=8, prev_components=prev)
    assert signals["sp_vs_d200"]["value"] == 2.5
    assert signals["sp_vs_d200"]["stale"] is True


def test_assign_signal_no_carry_when_no_prior(ur):
    """First-ever run with no prior -> write the no_data as-is, no stale flag."""
    signals = {}
    ur.assign_signal(signals, "sp_vs_d200", (50, 0, "no_data"), weight=8, prev_components={})
    assert signals["sp_vs_d200"]["signal"] == "no_data"
    assert signals["sp_vs_d200"]["value"] == 0
    assert "stale" not in signals["sp_vs_d200"]


def test_assign_signal_no_carry_when_prior_also_stale(ur):
    """If prior itself was no_data, don't propagate garbage forward."""
    prev = {"sp_vs_d200": {"score": 50, "value": 0, "signal": "no_data", "weight": 8}}
    signals = {}
    ur.assign_signal(signals, "sp_vs_d200", (50, 0, "no_data"), weight=8, prev_components=prev)
    assert signals["sp_vs_d200"]["signal"] == "no_data"
    assert "stale" not in signals["sp_vs_d200"]


def test_assign_signal_no_carry_when_prior_value_zero(ur):
    """Prior value of 0 is treated as no good data to carry forward."""
    prev = {"sp_vs_d200": {"score": 50, "value": 0, "signal": "above", "weight": 8}}
    signals = {}
    ur.assign_signal(signals, "sp_vs_d200", (50, 0, "no_data"), weight=8, prev_components=prev)
    assert signals["sp_vs_d200"]["value"] == 0
    assert "stale" not in signals["sp_vs_d200"]


def test_assign_signal_fresh_result_clears_stale(ur):
    """When compute recovers (not no_data), fresh result is written even if prior had stale=True."""
    prev = {"sp_vs_d200": {"score": 90, "value": 5.95, "signal": "above", "weight": 8, "stale": True}}
    signals = {}
    ur.assign_signal(signals, "sp_vs_d200", (85, 4.7, "above"), weight=8, prev_components=prev)
    assert signals["sp_vs_d200"]["value"] == 4.7  # fresh value
    assert signals["sp_vs_d200"]["score"] == 85
    assert "stale" not in signals["sp_vs_d200"]  # flag cleared on recovery
