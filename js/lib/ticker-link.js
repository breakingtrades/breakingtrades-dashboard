/**
 * js/lib/ticker-link.js — Shared interactive ticker chip + glossary tooltip helpers.
 *
 * Public API:
 *   BT.tickerLink(symbol, options) → string of HTML
 *     Returns a chip that:
 *       - navigates to #watchlist?ticker=SYM on click
 *       - shows a rich hover tooltip with live price + day change (from btPrices)
 *       - falls back gracefully if symbol is unknown
 *
 *   BT.glossaryTerm(term, label) → string of HTML
 *     Returns a span with hover tooltip explaining a common abbreviation
 *     (BMO, AMC, EM, σ, DTE, EPS, BUY ZONE, EXTENDED, etc.)
 *
 *   BT.bindGlobalTooltips()
 *     Wires up a single delegated mousemove/leave listener that positions
 *     the tooltip under any element with [data-tooltip].
 *
 * This is loaded BEFORE the page modules so they can reach for it.
 */
(function() {
  'use strict';

  window.BT = window.BT || {};

  // ─── Glossary ──────────────────────────────────────────────────────────────
  var GLOSSARY = {
    'BMO':         'Before Market Open — earnings/news released before 9:30 AM ET.',
    'AMC':         'After Market Close — earnings/news released after 4:00 PM ET.',
    'EM':          'Expected Move — implied 1-sigma price range derived from option straddles. The dealer\'s ±1σ bet for the period.',
    'σ':           'Sigma — one standard deviation of the expected move. ±1σ ≈ 68% probability the price stays inside.',
    'DTE':         'Days To Expiration — calendar days until the options contract expires.',
    'EPS':         'Earnings Per Share — quarterly profit divided by share count. "fc" = analyst consensus forecast.',
    'BUY ZONE':    'Price is near the lower expected-move boundary (15–35% of range). High-conviction long setups appear here when the band is well-anchored.',
    'EXTENDED':    'Price is near the upper expected-move boundary (>80% of range). Mean-reversion candidate — buyers exhausted.',
    'BREACH UP':   'Price has exceeded the upper expected-move boundary (price > anchor + 1σ). Positive σ measures distance outside the band.',
    'BREACH DOWN': 'Price has dropped below the lower expected-move boundary (price < anchor − 1σ).',
    'AT SUPPORT':  'Price is testing a key SMA (20/50) within ±1% — watching for reclaim or breakdown.',
    'ABOVE EM':    'Price is outside the upper expected-move band — extension or new regime.',
    'BELOW EM':    'Price is outside the lower expected-move band — capitulation or new regime.',
    'MODERATE':    'Price is within the middle of the expected-move range (35–65%). No directional edge from the EM read alone.',
    'HIGH':        'Price is in the upper portion of the expected-move range (65–85%). Approaching extension.',
    'σ-units':     'Distance measured in expected-move sigma units. 1σ = the EM half-width. 2σ ≈ 95% probability outside.',
    'RSI':         'Relative Strength Index (14-period) — momentum oscillator. <30 oversold, >70 overbought.',
    'ATR':         'Average True Range — typical daily price movement. Used to size stops proportional to volatility.',
    'SMA20':       '20-day Simple Moving Average — short-term trend reference. Reclaim/breakdown is the canonical entry/exit trigger.',
    'SMA50':       '50-day Simple Moving Average — intermediate trend. Bull stack = price above both SMA20 and SMA50.',
    'SMA200':      '200-day Simple Moving Average — long-term regime line. Below SMA200 = secular downtrend.',
    'W20':         '20-week Simple Moving Average — slow trend reference for swing/positional setups.',
    'F&G':         'Fear & Greed Index (CNN) — composite sentiment 0–100. <25 extreme fear (contrarian buy), >75 extreme greed (caution).',
    'VIX':         'CBOE Volatility Index — implied 30-day SPX volatility. <12 complacency, 12–20 normal, >25 elevated, >40 panic.',
    'MOVE':        'Merrill Lynch Option Volatility Estimate — Treasury market\'s VIX. Above 100 = bond stress.',
    'HYG/SPY':     'High-yield bond ratio vs SPX — credit canary. Up = risk-on credit, down = credit stress.',
    'XLF/SPY':     'Financials vs SPX ratio — leadership rotation gauge.',
    'IPO':         'Initial Public Offering — newly listed stock. First-day high and break-of-IPO-price are key reference levels.',
    'CRASHED':     'Stock has fallen >50% from its first-day high.',
    'BROKE':       'Stock closed below its IPO listing price on a post-debut session.',
    'TRIGGERED':   'Setup just fired — price reclaimed a key MA today.',
    'APPROACHING': 'Within 2% of SMA20/SMA50 — watching for a reclaim or rejection.',
    'ACTIVE':      'Bull stack in force — price above SMA20 with extension. Trail the SMA20 as a stop.',
    'EXIT':        'Price closed below SMA20 — risk-management trigger fired.',
    'WATCHING':    'No active trigger — monitoring conditions.'
  };

  // Risk levels / status pills — also worth tooltipping when bare
  var RULE_CODE_PATTERN = /^R\d{3,}$/;

  /** Resolve a glossary entry. Case-insensitive lookup. Returns null if unknown. */
  function lookupTerm(term) {
    if (!term) return null;
    var key = String(term).trim();
    // Direct hit
    if (GLOSSARY[key]) return GLOSSARY[key];
    // Case-insensitive fallback
    var upper = key.toUpperCase();
    if (GLOSSARY[upper]) return GLOSSARY[upper];
    // Rule codes (R001, R013...) get a generic explanation
    if (RULE_CODE_PATTERN.test(upper)) {
      return 'Rule ' + upper + ' — empirical-priors trading rule. Click Research to see the underlying study.';
    }
    return null;
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function(c) {
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  }

  function fmtPrice(n) {
    if (n == null) return '—';
    return n >= 1000
      ? n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : Number(n).toFixed(2);
  }

  function fmtChange(pct) {
    if (pct == null) return '';
    var sign = pct >= 0 ? '+' : '';
    return sign + Number(pct).toFixed(2) + '%';
  }

  // Tickers that should never get linkified (calendar-class identifiers,
  // FX, futures, that need different routing).
  var NON_TICKER = {
    'TBD': 1, 'N/A': 1, 'TBA': 1
  };

  // ─── BT.tickerLink ─────────────────────────────────────────────────────────
  /**
   * Returns interactive ticker chip HTML.
   *
   * @param {string} symbol — e.g. 'SPY', 'NVDA'
   * @param {object} [options]
   * @param {string} [options.className] — extra CSS class (e.g. 'wa-ticker')
   * @param {string} [options.label] — text to show (defaults to symbol)
   * @param {boolean} [options.showLivePrice] — append small price+chg suffix (default false)
   * @returns {string}
   */
  BT.tickerLink = function(symbol, options) {
    options = options || {};
    var sym = String(symbol || '').toUpperCase().trim();
    if (!sym || NON_TICKER[sym]) {
      return '<span class="' + esc(options.className || '') + '">' + esc(symbol || '') + '</span>';
    }
    var label = options.label || symbol;
    var extraClass = options.className ? ' ' + esc(options.className) : '';

    // Try to resolve live price from btPrices
    var priceSuffix = '';
    if (options.showLivePrice && window.btPrices && typeof window.btPrices.price === 'function') {
      var p = window.btPrices.price(sym);
      var c = typeof window.btPrices.change === 'function' ? window.btPrices.change(sym) : null;
      if (p != null) {
        var clsArr = (c != null && c < 0) ? 'down' : 'up';
        priceSuffix = ' <span class="bt-tlk-px ' + clsArr + '">$' + fmtPrice(p) +
          (c != null ? ' <span class="bt-tlk-chg">' + fmtChange(c) + '</span>' : '') + '</span>';
      }
    }

    // Compose hover tooltip text
    var tipParts = [sym];
    if (window.btPrices && typeof window.btPrices.price === 'function') {
      var lp = window.btPrices.price(sym);
      var lc = window.btPrices.change ? window.btPrices.change(sym) : null;
      if (lp != null) {
        tipParts.push('Last $' + fmtPrice(lp) +
          (lc != null ? ' (' + fmtChange(lc) + ')' : ''));
      }
    }
    tipParts.push('Click → open in Watchlist');
    var tip = tipParts.join(' · ');

    return (
      '<a href="#watchlist?ticker=' + encodeURIComponent(sym) + '" ' +
      'class="bt-ticker-chip' + extraClass + '" ' +
      'data-tooltip="' + esc(tip) + '" ' +
      'data-bt-ticker="' + esc(sym) + '">' +
      esc(label) + priceSuffix +
      '</a>'
    );
  };

  // ─── BT.glossaryTerm ───────────────────────────────────────────────────────
  /**
   * Returns a span wrapping a term that has a glossary entry, with hover help.
   * If term is unknown, returns plain text wrapped in a span (no tooltip).
   *
   * @param {string} term — the abbreviation (BMO, EM, σ, etc.)
   * @param {string} [label] — the visible text (defaults to term)
   * @returns {string}
   */
  BT.glossaryTerm = function(term, label) {
    var explanation = lookupTerm(term);
    var visible = label != null ? label : term;
    if (!explanation) {
      return '<span>' + esc(visible) + '</span>';
    }
    return (
      '<span class="bt-glossary-term" data-tooltip="' + esc(explanation) + '">' +
        esc(visible) +
        '<span class="bt-glossary-marker" aria-hidden="true">ⓘ</span>' +
      '</span>'
    );
  };

  /** List of glossary keys exposed for autoglossarize() helpers if needed. */
  BT.glossaryKeys = function() { return Object.keys(GLOSSARY); };

  // ─── Tooltip system ────────────────────────────────────────────────────────
  // One floating element. Delegated mouseenter/mouseleave handlers on body.
  var _tipEl = null;
  var _tipShowTimer = null;

  function ensureTipEl() {
    if (_tipEl) return _tipEl;
    var el = document.createElement('div');
    el.className = 'bt-tooltip';
    el.setAttribute('role', 'tooltip');
    el.setAttribute('aria-hidden', 'true');
    document.body.appendChild(el);
    _tipEl = el;
    return el;
  }

  function showTip(el) {
    var text = el.getAttribute('data-tooltip');
    if (!text) return;
    var tip = ensureTipEl();
    tip.textContent = text;
    tip.classList.add('open');
    var rect = el.getBoundingClientRect();
    // Position below the element by default
    var tipRect = tip.getBoundingClientRect();
    var top = rect.bottom + 6;
    var left = rect.left + (rect.width / 2) - (tipRect.width / 2);
    // Clamp within viewport
    var maxLeft = window.innerWidth - tipRect.width - 10;
    if (left < 8) left = 8;
    if (left > maxLeft) left = maxLeft;
    // Flip above if no room below
    if (top + tipRect.height > window.innerHeight - 8) {
      top = rect.top - tipRect.height - 6;
    }
    tip.style.top = (top + window.scrollY) + 'px';
    tip.style.left = (left + window.scrollX) + 'px';
  }

  function hideTip() {
    if (_tipShowTimer) { clearTimeout(_tipShowTimer); _tipShowTimer = null; }
    if (_tipEl) _tipEl.classList.remove('open');
  }

  /** Bind body-level delegated tooltip. Call once. */
  BT.bindGlobalTooltips = function() {
    if (BT._tooltipsBound) return;
    BT._tooltipsBound = true;

    document.body.addEventListener('mouseover', function(e) {
      var el = e.target.closest && e.target.closest('[data-tooltip]');
      if (!el) return;
      if (_tipShowTimer) clearTimeout(_tipShowTimer);
      _tipShowTimer = setTimeout(function() { showTip(el); }, 250);
    });
    document.body.addEventListener('mouseout', function(e) {
      var el = e.target.closest && e.target.closest('[data-tooltip]');
      if (!el) return;
      // Only hide when leaving the element itself (not entering child)
      var to = e.relatedTarget;
      if (to && el.contains(to)) return;
      hideTip();
    });
    // Click on a tooltip-bearing element (e.g. ticker chip) — hide tip so it
    // doesn't linger over the navigation transition.
    document.body.addEventListener('click', function(e) {
      if (e.target.closest && e.target.closest('[data-tooltip]')) hideTip();
    });
    // Esc + scroll dismiss
    window.addEventListener('scroll', hideTip, { passive: true, capture: true });
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') hideTip();
    });
  };

  // Auto-bind on DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { BT.bindGlobalTooltips(); });
  } else {
    BT.bindGlobalTooltips();
  }
})();
