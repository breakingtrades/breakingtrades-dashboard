#!/usr/bin/env python3
"""
Regime Intelligence — Tactical regime scoring from 15 weighted signals.
Reads existing data files, computes regime, writes data/regime.json + data/regime-history.jsonl.
"""

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"

# ── Constants ──────────────────────────────────────────────────────────────

REGIMES = [
    (0, 15, 'CRISIS', '#ef5350'),
    (16, 30, 'BEAR', '#ffa726'),
    (31, 45, 'CORRECTION', '#ffeb3b'),
    (46, 55, 'NEUTRAL', '#8888aa'),
    (56, 70, 'BULL', '#00d4aa'),
    (71, 85, 'STRONG_BULL', '#00d4aa'),
    (86, 100, 'EUPHORIA', '#ab47bc'),
]

REGIME_RULES = {
    'CRISIS': ['R001','R003','R006','R013','R041','R054','R056','R057'],
    'BEAR': ['R006','R008','R025','R035','R042','R054','R065'],
    'CORRECTION': ['R006','R010','R025','R043','R056'],
    'NEUTRAL': ['R007','R010','R013','R019'],
    'BULL': ['R007','R013','R029','R050'],
    'STRONG_BULL': ['R004','R013','R026','R037'],
    'EUPHORIA': ['R003','R004','R013','R014','R026','R032','R052'],
}

PLAYBOOKS = {
    'CRISIS': {
        'position_size': 0.25,
        'sector_bias': ['XLU','XLP','XLV','XLE'],
        'avoid_sectors': ['XLK','XLY','XLC'],
        'stop_rule': 'Daily close below 20 MA = exit (R006)',
        'entry_rule': 'Buy the V, not the dip (R056). Wait for MOVE to collapse (R057).',
        'key_watch': 'MOVE Index collapse = bottom signal'
    },
    'BEAR': {
        'position_size': 0.50,
        'sector_bias': ['XLU','XLP','XLV'],
        'avoid_sectors': ['XLK','XLY'],
        'stop_rule': 'Weekly 20 MA rejection = exit (R035)',
        'entry_rule': 'Buy right side of V only (R043). Need higher high + higher low.',
        'key_watch': 'Weekly 50 MA test = potential bid (R042)'
    },
    'CORRECTION': {
        'position_size': 0.75,
        'sector_bias': ['XLV','XLP','XLE'],
        'avoid_sectors': ['XLY'],
        'stop_rule': 'Daily close below 20 MA = exit (R006)',
        'entry_rule': "Selective longs only. Don't chase (R010).",
        'key_watch': 'Sector rotation — defensives to cyclicals = recovery signal'
    },
    'NEUTRAL': {
        'position_size': 1.0,
        'sector_bias': [],
        'avoid_sectors': [],
        'stop_rule': 'Standard — weekly 20 MA mean reversion (R007)',
        'entry_rule': 'Standard playbook. Less is more (R019).',
        'key_watch': 'F&G extremes (R013)'
    },
    'BULL': {
        'position_size': 1.0,
        'sector_bias': ['XLK','XLY','XLF'],
        'avoid_sectors': [],
        'stop_rule': 'Trail stop at weekly 20 MA (R050)',
        'entry_rule': 'Trend following. Let winners run.',
        'key_watch': 'F&G > 75 = start tightening (R013)'
    },
    'STRONG_BULL': {
        'position_size': 1.0,
        'sector_bias': ['XLK','XLY','XLF','XLI'],
        'avoid_sectors': [],
        'stop_rule': 'Trail at weekly 20 MA, tighten if AAII > 50% (R004)',
        'entry_rule': 'Full momentum. Pyramiding on pullbacks to W20.',
        'key_watch': 'Leveraged ETF expansion = late cycle (R026)'
    },
    'EUPHORIA': {
        'position_size': 0.75,
        'sector_bias': ['XLE','XLB'],
        'avoid_sectors': ['XLK','XLY'],
        'stop_rule': 'Tighten to daily 20 MA. Any close below = reduce.',
        'entry_rule': 'Contrarian — reduce exposure. Smart money selling (R003).',
        'key_watch': 'Record margin debt (R014), 100yr bonds in news (R032)'
    },
}

# ── Helpers ────────────────────────────────────────────────────────────────

def load_json(path):
    try:
        return json.loads(path.read_text())
    except Exception:
        return None

def clamp(v, lo=0, hi=100):
    return max(lo, min(hi, int(round(v))))

def lerp(value, in_lo, in_hi, out_lo, out_hi):
    """Linear interpolation: map value from [in_lo,in_hi] → [out_lo,out_hi]."""
    if in_hi == in_lo:
        return (out_lo + out_hi) / 2
    t = (value - in_lo) / (in_hi - in_lo)
    t = max(0, min(1, t))
    return out_lo + t * (out_hi - out_lo)

def get_ticker(prices, sym):
    """Get price from prices.json tickers dict. Returns dict with price/change or None."""
    if not prices:
        return None
    tickers = prices.get('tickers', prices)
    return tickers.get(sym)

def get_watchlist_item(watchlist, sym):
    if not watchlist:
        return None
    for item in watchlist:
        if item.get('symbol') == sym:
            return item
    return None

def signal_label(score):
    if score >= 70: return 'bullish'
    if score >= 55: return 'neutral_bullish'
    if score >= 45: return 'neutral'
    if score >= 30: return 'neutral_bearish'
    return 'bearish'

# ── Signal Computations ───────────────────────────────────────────────────

def compute_move(prices):
    t = get_ticker(prices, '^MOVE')
    if not t: return 50, 0, 'no_data'
    v = t['price']
    if v > 120: s = 0
    elif v > 100: s = lerp(v, 100, 120, 20, 0)
    elif v >= 80: s = lerp(v, 80, 100, 60, 30)
    else: s = lerp(v, 60, 80, 100, 80)
    label = 'collapsing' if v < 80 else 'elevated' if v < 100 else 'accelerating'
    return clamp(s), v, label

def compute_fear_greed(fg_data):
    if not fg_data or 'current' not in fg_data: return 50, 0, 'no_data'
    v = fg_data['current']['value']
    label = 'extreme_fear' if v < 25 else 'fear' if v < 45 else 'neutral' if v < 55 else 'greed' if v < 75 else 'extreme_greed'
    return clamp(v), v, label

def compute_vix(prices):
    t = get_ticker(prices, '^VIX')
    if not t: return 50, 0, 'no_data'
    v = t['price']
    if v > 40: s = 0
    elif v > 30: s = lerp(v, 30, 40, 15, 0)
    elif v > 20: s = lerp(v, 20, 30, 60, 15)  # 20-30 range → 35 center but use lerp
    elif v >= 15: s = lerp(v, 15, 20, 80, 60)
    else: s = 80
    label = 'extreme' if v > 40 else 'fear' if v > 30 else 'elevated' if v > 20 else 'normal' if v >= 15 else 'complacent'
    return clamp(s), v, label

def compute_breadth(breadth_data):
    if not breadth_data or 'total' not in breadth_data: return 50, 0, 'no_data'
    v = breadth_data['total']['average']
    # Inverted: low breadth = oversold = opportunity, high = overbought = risk
    if v <= 20: s = 70
    elif v <= 40: s = lerp(v, 20, 40, 70, 50)
    elif v <= 60: s = 50
    elif v <= 80: s = lerp(v, 60, 80, 50, 30)
    else: s = 30
    label = 'oversold' if v < 25 else 'weak' if v < 45 else 'neutral' if v < 55 else 'strong' if v < 75 else 'overbought'
    return clamp(s), v, label

def compute_sp_vs_d200(prices, watchlist):
    sp = get_ticker(prices, '^GSPC')
    if not sp: return 50, 0, 'no_data'
    price = sp['price']
    # Try watchlist for SPY sma200 as proxy, or use ^GSPC if in watchlist
    w = get_watchlist_item(watchlist, 'SPY')
    if not w or 'sma200' not in w: return 50, 0, 'no_sma'
    # Scale SPY sma200 to GSPC: ratio = GSPC/SPY
    spy_t = get_ticker(prices, 'SPY')
    if not spy_t: return 50, 0, 'no_data'
    ratio = price / spy_t['price']
    sma200_gspc = w['sma200'] * ratio
    pct = ((price - sma200_gspc) / sma200_gspc) * 100
    if pct > 5: s = 90
    elif pct > 0: s = lerp(pct, 0, 5, 70, 90)
    elif pct > -5: s = lerp(pct, -5, 0, 10, 70)
    else: s = 10
    label = 'above' if pct > 0 else 'below'
    return clamp(s), round(pct, 2), label

def _ratio_vs_sma50(prices, watchlist, sym_a, sym_b, label_name):
    """Compare ratio of sym_a/sym_b to SMA50 from watchlist."""
    a = get_ticker(prices, sym_a)
    b = get_ticker(prices, sym_b)
    if not a or not b: return 50, 0, 'no_data'
    ratio_now = a['price'] / b['price']
    # We need SMA50 of the ratio — approximate by checking watchlist for sym_a
    w_a = get_watchlist_item(watchlist, sym_a)
    w_b = get_watchlist_item(watchlist, sym_b)
    if not w_a or not w_b or 'sma50' not in w_a or 'sma50' not in w_b:
        return 50, 0, 'no_sma'
    ratio_sma50 = w_a['sma50'] / w_b['sma50']
    pct_diff = ((ratio_now - ratio_sma50) / ratio_sma50) * 100
    if pct_diff > 1: s = 70
    elif pct_diff < -1: s = 20
    else: s = 50
    label = 'strong' if pct_diff > 1 else 'weak' if pct_diff < -1 else 'neutral'
    return clamp(s), round(pct_diff, 2), label

def compute_hyg_spy(prices, watchlist):
    return _ratio_vs_sma50(prices, watchlist, 'HYG', 'SPY', 'hyg_spy')

def compute_xlf_spy(prices, watchlist):
    return _ratio_vs_sma50(prices, watchlist, 'XLF', 'SPY', 'xlf_spy')

def compute_dxy(prices):
    t = get_ticker(prices, 'DX-Y.NYB')
    if not t: return 50, 0, 'no_data'
    v = t['price']
    if v > 104: s = 15
    elif v > 100: s = 35
    elif v >= 96: s = 55
    else: s = 75
    label = 'strong_dollar' if v > 104 else 'elevated' if v > 100 else 'neutral' if v >= 96 else 'weak_dollar'
    return clamp(s), v, label

def compute_yield_curve(prices):
    tnx = get_ticker(prices, '^TNX')
    irx = get_ticker(prices, '^IRX')
    if not tnx or not irx: return 50, 0, 'no_data'
    spread = tnx['price'] - irx['price']
    if spread < 0: s = 10
    elif spread < 0.5: s = 30  # Could be 15 if recently un-inverted (R008) — simplified
    elif spread <= 1.5: s = 50
    else: s = 70
    label = 'inverted' if spread < 0 else 'flattening' if spread < 0.5 else 'normal' if spread <= 1.5 else 'steep'
    return clamp(s), round(spread, 2), label

def compute_growth_value(prices, watchlist):
    # IWF/IWD — not in watchlist, so check price change as proxy
    iwf = get_ticker(prices, 'IWF')
    iwd = get_ticker(prices, 'IWD')
    if not iwf or not iwd: return 50, 0, 'no_data'
    ratio = iwf['price'] / iwd['price']
    # Without SMA50 in watchlist, use change differential as proxy
    diff = iwf.get('change', 0) - iwd.get('change', 0)
    if diff > 1: s = 70
    elif diff < -1: s = 30
    else: s = 50
    label = 'growth_leading' if diff > 1 else 'value_leading' if diff < -1 else 'balanced'
    return clamp(s), round(diff, 2), label

def compute_rsp_spy(prices, watchlist):
    rsp = get_ticker(prices, 'RSP')
    spy = get_ticker(prices, 'SPY')
    if not rsp or not spy: return 50, 0, 'no_data'
    # Use change% differential
    diff = rsp.get('change', 0) - spy.get('change', 0)
    if diff > 0.5: s = 70
    elif diff < -0.5: s = 30
    else: s = 50
    label = 'broadening' if diff > 0.5 else 'narrowing' if diff < -0.5 else 'neutral'
    return clamp(s), round(diff, 2), label

def compute_put_call():
    # TODO: Add CBOE P/C scraper. Default to neutral.
    return 50, 0, 'no_data'

def compute_copper_gold(prices, watchlist):
    cper = get_ticker(prices, 'CPER')
    gld = get_ticker(prices, 'GLD')
    if not cper or not gld: return 50, 0, 'no_data'
    # Use change% differential
    diff = cper.get('change', 0) - gld.get('change', 0)
    if diff > 1: s = 70
    elif diff < -1: s = 30
    else: s = 50
    label = 'growth' if diff > 1 else 'fear' if diff < -1 else 'neutral'
    return clamp(s), round(diff, 2), label

def compute_international(prices):
    syms = ['^GDAXI', '^KS11', '^HSI', '^AXJO', 'FXI']
    changes = []
    for sym in syms:
        t = get_ticker(prices, sym)
        if t: changes.append(t.get('change', 0))
    if not changes: return 50, 0, 'no_data'
    avg = sum(changes) / len(changes)
    pos = sum(1 for c in changes if c > 0)
    neg = sum(1 for c in changes if c < 0)
    if neg == len(changes): s = 25
    elif pos == len(changes): s = 70
    else: s = 50
    label = 'all_positive' if pos == len(changes) else 'all_negative' if neg == len(changes) else 'mixed'
    return clamp(s), round(avg, 2), label

def compute_xly_xlp(prices, watchlist):
    return _ratio_vs_sma50(prices, watchlist, 'XLY', 'XLP', 'consumer')

# ── Regime Classification ─────────────────────────────────────────────────

def classify_regime(score):
    for lo, hi, name, color in REGIMES:
        if lo <= score <= hi:
            return name, color
    return 'NEUTRAL', '#8888aa'

# ── Transition Signals ────────────────────────────────────────────────────

def get_transition_signals(regime, components):
    c = components
    def cond(label, key, target, op='>'):
        val = c.get(key, {}).get('value', 0)
        met = val > target if op == '>' else val < target
        return {'label': label, 'current': val, 'target': target, 'met': met}

    transitions = {
        'CRISIS': {
            'target': 'BEAR',
            'conditions': [
                cond('F&G > 25', 'fear_greed', 25, '>'),
                cond('VIX < 22', 'vix', 22, '<'),
                cond('Breadth > 45%', 'breadth', 45, '>'),
                cond('MOVE < 90', 'move', 90, '<'),
                cond('HYG/SPY stabilizing', 'hyg_spy', -0.5, '>'),
            ]
        },
        'BEAR': {
            'target': 'CORRECTION',
            'conditions': [
                cond('F&G > 35', 'fear_greed', 35, '>'),
                cond('VIX < 20', 'vix', 20, '<'),
                cond('S&P above D200', 'sp_vs_d200', 0, '>'),
                cond('Breadth > 50%', 'breadth', 50, '>'),
            ]
        },
        'CORRECTION': {
            'target': 'NEUTRAL',
            'conditions': [
                cond('F&G > 45', 'fear_greed', 45, '>'),
                cond('VIX < 18', 'vix', 18, '<'),
                cond('MOVE < 80', 'move', 80, '<'),
                cond('Breadth > 55%', 'breadth', 55, '>'),
            ]
        },
        'NEUTRAL': {
            'target': 'BULL',
            'conditions': [
                cond('F&G > 55', 'fear_greed', 55, '>'),
                cond('S&P > 2% above D200', 'sp_vs_d200', 2, '>'),
                cond('HYG/SPY strong', 'hyg_spy', 1, '>'),
                cond('VIX < 16', 'vix', 16, '<'),
            ]
        },
        'BULL': {
            'target': 'STRONG_BULL',
            'conditions': [
                cond('F&G > 65', 'fear_greed', 65, '>'),
                cond('Breadth > 65%', 'breadth', 65, '>'),
                cond('S&P > 5% above D200', 'sp_vs_d200', 5, '>'),
            ]
        },
        'STRONG_BULL': {
            'target': 'EUPHORIA',
            'conditions': [
                cond('F&G > 80', 'fear_greed', 80, '>'),
                cond('VIX < 13', 'vix', 13, '<'),
                cond('Breadth > 75%', 'breadth', 75, '>'),
            ]
        },
        'EUPHORIA': {
            'target': 'STRONG_BULL',
            'conditions': [
                cond('F&G < 70', 'fear_greed', 70, '<'),
                cond('VIX > 18', 'vix', 18, '>'),
                cond('MOVE > 85', 'move', 85, '>'),
            ]
        },
    }
    t = transitions.get(regime, {'target': 'NEUTRAL', 'conditions': []})
    t['conditions_met'] = sum(1 for c in t['conditions'] if c['met'])
    t['conditions_total'] = len(t['conditions'])
    return t

# ── Business Cycle ────────────────────────────────────────────────────────

def compute_cycle_phase(prices, components):
    score = 50

    spread = components.get('yield_curve', {}).get('value', 0)
    if spread < 0: score -= 20
    elif spread < 0.5: score -= 10
    elif spread > 1.5: score += 10

    move_val = components.get('move', {}).get('value', 0)
    if move_val > 100: score -= 15
    elif move_val < 80: score += 10

    # Copper/Gold — growth vs fear
    cg_diff = components.get('copper_gold', {}).get('value', 0)
    if cg_diff > 1: score += 5
    elif cg_diff < -1: score -= 5

    # Transports
    djt = get_ticker(prices, '^DJT')
    if djt:
        djt_change = djt.get('change', 0)
        if djt_change < -5: score -= 10
        elif djt_change > 3: score += 5

    # DXY — strong dollar = contraction signal
    dxy_val = components.get('dxy', {}).get('value', 0)
    if dxy_val > 104: score -= 5
    elif dxy_val < 96: score += 5

    score = max(0, min(100, score))

    phases = [
        (0, 25, 'CONTRACTION'),
        (26, 40, 'TROUGH'),
        (41, 60, 'EXPANSION'),
        (61, 80, 'LATE_CYCLE'),
        (81, 100, 'OVERHEATING'),
    ]
    phase = 'EXPANSION'
    for lo, hi, name in phases:
        if lo <= score <= hi:
            phase = name
            break
    return phase, score

# ── Previous Regime ───────────────────────────────────────────────────────

def load_previous_regime():
    regime_file = DATA / "regime.json"
    data = load_json(regime_file)
    if data:
        return {'regime': data.get('regime', 'NEUTRAL'), 'score': data.get('score', 50)}
    return {'regime': 'NEUTRAL', 'score': 50}

def compute_duration(regime_name):
    """Count consecutive days of current regime from history."""
    history_file = DATA / "regime-history.jsonl"
    if not history_file.exists():
        return 1, datetime.now(timezone.utc).strftime('%Y-%m-%d')
    lines = history_file.read_text().strip().split('\n')
    days = 0
    since = datetime.now(timezone.utc).strftime('%Y-%m-%d')
    for line in reversed(lines):
        try:
            entry = json.loads(line)
            if entry.get('regime') == regime_name:
                days += 1
                since = entry['date']
            else:
                break
        except Exception:
            break
    return max(1, days), since

# ── Main ──────────────────────────────────────────────────────────────────

def main():
    prices = load_json(DATA / "prices.json")
    fg_data = load_json(DATA / "fear-greed.json")
    breadth_data = load_json(DATA / "breadth.json")
    watchlist = load_json(DATA / "watchlist.json")

    # Compute all 15 signals: (score, raw_value, label)
    signals = {}
    s, v, l = compute_move(prices);         signals['move'] = {'score': s, 'value': v, 'signal': l, 'weight': 18}
    s, v, l = compute_fear_greed(fg_data);  signals['fear_greed'] = {'score': s, 'value': v, 'signal': l, 'weight': 10}
    s, v, l = compute_vix(prices);          signals['vix'] = {'score': s, 'value': v, 'signal': l, 'weight': 10}
    s, v, l = compute_breadth(breadth_data);signals['breadth'] = {'score': s, 'value': v, 'signal': l, 'weight': 8}
    s, v, l = compute_sp_vs_d200(prices, watchlist); signals['sp_vs_d200'] = {'score': s, 'value': v, 'signal': l, 'weight': 8}
    s, v, l = compute_hyg_spy(prices, watchlist);    signals['hyg_spy'] = {'score': s, 'value': v, 'signal': l, 'weight': 8}
    s, v, l = compute_xlf_spy(prices, watchlist);    signals['xlf_spy'] = {'score': s, 'value': v, 'signal': l, 'weight': 6}
    s, v, l = compute_dxy(prices);          signals['dxy'] = {'score': s, 'value': v, 'signal': l, 'weight': 5}
    s, v, l = compute_yield_curve(prices);  signals['yield_curve'] = {'score': s, 'value': v, 'signal': l, 'weight': 5}
    s, v, l = compute_growth_value(prices, watchlist); signals['growth_value'] = {'score': s, 'value': v, 'signal': l, 'weight': 4}
    s, v, l = compute_rsp_spy(prices, watchlist);      signals['rsp_spy'] = {'score': s, 'value': v, 'signal': l, 'weight': 4}
    s, v, l = compute_put_call();           signals['put_call'] = {'score': s, 'value': v, 'signal': l, 'weight': 4}
    s, v, l = compute_copper_gold(prices, watchlist);  signals['copper_gold'] = {'score': s, 'value': v, 'signal': l, 'weight': 4}
    s, v, l = compute_international(prices);signals['international'] = {'score': s, 'value': v, 'signal': l, 'weight': 4}
    s, v, l = compute_xly_xlp(prices, watchlist);      signals['xly_xlp'] = {'score': s, 'value': v, 'signal': l, 'weight': 2}

    # Weighted score
    total_weight = sum(sig['weight'] for sig in signals.values())
    weighted_score = sum(sig['score'] * sig['weight'] for sig in signals.values()) / total_weight
    score = clamp(weighted_score)

    # Classify
    regime, color = classify_regime(score)
    previous = load_previous_regime()
    duration_days, since = compute_duration(regime)
    if previous['regime'] != regime:
        duration_days = 1
        since = datetime.now(timezone.utc).strftime('%Y-%m-%d')

    # Business cycle
    cycle_phase, cycle_score = compute_cycle_phase(prices, signals)

    # Transition signals
    transitions = get_transition_signals(regime, signals)

    # Build output
    now = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
    output = {
        'updated': now,
        'regime': regime,
        'score': score,
        'color': color,
        'previous': previous,
        'duration_days': duration_days,
        'since': since,
        'cycle': {
            'phase': cycle_phase,
            'score': cycle_score,
        },
        'components': signals,
        'active_rules': REGIME_RULES.get(regime, []),
        'playbook': PLAYBOOKS.get(regime, {}),
        'transition_signals': transitions,
    }

    # Write regime.json
    (DATA / "regime.json").write_text(json.dumps(output, indent=2) + '\n')

    # Append to regime-history.jsonl (date-deduped)
    today = datetime.now(timezone.utc).strftime('%Y-%m-%d')
    history_file = DATA / "regime-history.jsonl"
    existing_dates = set()
    if history_file.exists():
        for line in history_file.read_text().strip().split('\n'):
            if line.strip():
                try:
                    existing_dates.add(json.loads(line)['date'])
                except Exception:
                    pass

    if today not in existing_dates:
        move_val = signals['move']['value']
        vix_val = signals['vix']['value']
        fg_val = signals['fear_greed']['value']
        breadth_val = signals['breadth']['value']
        spread_val = signals['yield_curve']['value']
        entry = {
            'date': today,
            'regime': regime,
            'score': score,
            'cycle': cycle_phase,
            'cycle_score': cycle_score,
            'move': move_val,
            'vix': vix_val,
            'fg': fg_val,
            'breadth': breadth_val,
            'yield_spread': spread_val,
        }
        with open(history_file, 'a') as f:
            f.write(json.dumps(entry) + '\n')

    # Summary
    move_v = signals['move']['value']
    vix_v = signals['vix']['value']
    fg_v = signals['fear_greed']['value']
    print(f"Regime: {regime} (score: {score}) | Cycle: {cycle_phase} | MOVE: {move_v} | VIX: {vix_v} | F&G: {fg_v}")

if __name__ == '__main__':
    main()
