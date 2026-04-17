"""Tests for scripts/update-prices.py safety guards.

Verifies the fix that prevents prices.json from being silently overwritten
with an empty or severely degraded payload when yfinance fails.

We don't actually call yfinance — we monkeypatch to simulate outages.
"""
import importlib.util
import json
from pathlib import Path
from unittest.mock import patch

import pytest

ROOT = Path(__file__).resolve().parent.parent
SCRIPT = ROOT / "scripts" / "update-prices.py"


@pytest.fixture(scope="module")
def up():
    """Load update-prices.py as a module (hyphenated name needs importlib)."""
    spec = importlib.util.spec_from_file_location("update_prices", SCRIPT)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def _write_prior(path, tickers):
    path.write_text(json.dumps({
        "updated": "2026-04-16T20:00:00Z",
        "source": "yfinance",
        "tickers": tickers,
    }))


def test_empty_result_keeps_prior_file(up, tmp_path, monkeypatch):
    """If yfinance returns 0 tickers, prices.json must NOT be overwritten."""
    out_file = tmp_path / "prices.json"
    prior = {"SPY": {"price": 700.0, "change": 0.5}, "^GSPC": {"price": 7040.0, "change": 0.5}}
    _write_prior(out_file, prior)

    monkeypatch.setattr(up, "OUT_FILE", out_file)
    monkeypatch.setattr(up, "get_all_tickers", lambda: ["SPY", "^GSPC"])

    # Simulate yfinance returning an empty/broken DataFrame
    import pandas as pd
    fake_data = pd.DataFrame()  # nothing

    with patch("yfinance.download", return_value=fake_data):
        up.update_prices()

    # Prior should still be there, untouched
    written = json.loads(out_file.read_text())
    assert written["tickers"] == prior, "prior prices.json was overwritten with empty payload"


def test_partial_fetch_merges_with_prior(up, tmp_path, monkeypatch):
    """If yfinance returns <50% of expected, merge with prior + flag carryforward source."""
    out_file = tmp_path / "prices.json"
    prior = {
        "SPY":   {"price": 700.0, "change": 0.5},
        "^GSPC": {"price": 7040.0, "change": 0.5},
        "AAPL":  {"price": 195.0, "change": 1.2},
        "MSFT":  {"price": 410.0, "change": 0.8},
    }
    _write_prior(out_file, prior)

    monkeypatch.setattr(up, "OUT_FILE", out_file)
    monkeypatch.setattr(up, "get_all_tickers", lambda: ["SPY", "^GSPC", "AAPL", "MSFT"])

    # Simulate yfinance returning fresh data for only 1 of 4 (25% -> partial)
    import pandas as pd
    idx = pd.date_range("2026-04-15", periods=2, freq="D")
    fresh = pd.DataFrame({("SPY", "Close"): [700.0, 705.0]}, index=idx)
    fresh.columns = pd.MultiIndex.from_tuples(fresh.columns)

    with patch("yfinance.download", return_value=fresh):
        up.update_prices()

    written = json.loads(out_file.read_text())
    assert "SPY" in written["tickers"]
    assert written["tickers"]["SPY"]["price"] == 705.0  # fresh
    # Prior values preserved for missing tickers
    assert written["tickers"]["AAPL"]["price"] == 195.0
    assert written["tickers"]["MSFT"]["price"] == 410.0
    assert written["tickers"]["^GSPC"]["price"] == 7040.0
    assert written["source"] == "yfinance+carryforward"


def test_full_fetch_no_carryforward_flag(up, tmp_path, monkeypatch):
    """Normal full fetch -> writes fresh data with plain 'yfinance' source."""
    out_file = tmp_path / "prices.json"
    prior = {"SPY": {"price": 700.0, "change": 0.5}}
    _write_prior(out_file, prior)

    monkeypatch.setattr(up, "OUT_FILE", out_file)
    monkeypatch.setattr(up, "get_all_tickers", lambda: ["SPY"])

    import pandas as pd
    idx = pd.date_range("2026-04-15", periods=2, freq="D")
    fresh = pd.DataFrame({"Close": [700.0, 710.0]}, index=idx)

    with patch("yfinance.download", return_value=fresh):
        up.update_prices()

    written = json.loads(out_file.read_text())
    assert written["tickers"]["SPY"]["price"] == 710.0
    assert written["source"] == "yfinance"  # no carryforward flag
