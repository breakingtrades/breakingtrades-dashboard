/**
 * js/lib/tv-symbol.js — TradingView symbol resolver
 *
 * Replaces the per-page hardcoded EXCHANGE_MAP tables. TradingView widgets
 * accept bare symbols and resolve the exchange automatically, so for most
 * tickers we don't need to guess. We keep a small HINTS table for the handful
 * of ambiguous cases (dual listings, known reassignments) but default to the
 * bare symbol otherwise — that way new AI/cloud names (NBIS, BILI, SMCI, etc.)
 * Just Work™ without a code change.
 *
 * Rationale: `NYSE:BILI` fails because BILI is on NASDAQ. Bare `BILI` resolves
 * correctly. Adding one map entry per ticker doesn't scale.
 */
(function() {
  'use strict';
  var BT = window.BT = window.BT || {};

  // Optional hints only. Leave empty for "let TV resolve".
  // Add an entry here ONLY when TV's default resolution goes to the wrong venue
  // (e.g. primary Chinese listing vs ADR, or a symbol reused across exchanges).
  var HINTS = {
    // Major indices/ETFs — explicit exchange prefix avoids TV going to the wrong venue
    'SPX': 'SP',
    'SPY': 'AMEX', 'QQQ': 'NASDAQ', 'IWM': 'AMEX', 'DIA': 'AMEX',
    'HYG': 'AMEX', 'TLT': 'NASDAQ', 'LQD': 'AMEX',
    'XLU': 'AMEX', 'XLK': 'AMEX', 'XLE': 'AMEX', 'XLV': 'AMEX',
    'XLF': 'AMEX', 'XLP': 'AMEX', 'XLY': 'AMEX', 'XLI': 'AMEX',
    'XLC': 'AMEX', 'XLRE': 'AMEX', 'XLB': 'AMEX',
    'RSP': 'AMEX', 'IGV': 'AMEX', 'IWF': 'AMEX', 'IWD': 'AMEX',
    'GLD': 'AMEX', 'SLV': 'AMEX', 'URA': 'AMEX', 'USO': 'AMEX',
    'UNG': 'AMEX', 'OIH': 'AMEX', 'MOO': 'AMEX',
    'IBIT': 'NASDAQ'
  };

  /**
   * Returns the TradingView symbol string for a given ticker.
   * - If a hint exists, returns 'EXCHANGE:SYMBOL' (e.g. 'NASDAQ:QQQ')
   * - Otherwise returns the bare symbol (TV resolves the exchange automatically)
   */
  function tvSymbol(symbol) {
    if (!symbol) return '';
    var s = String(symbol).toUpperCase();
    var hint = HINTS[s];
    return hint ? (hint + ':' + s) : s;
  }

  /**
   * Legacy shim: returns an exchange string or empty.
   * Prefer tvSymbol() in new code.
   */
  function getExchange(symbol) {
    if (!symbol) return '';
    return HINTS[String(symbol).toUpperCase()] || '';
  }

  BT.tvSymbol = tvSymbol;
  BT.getExchange = getExchange;
})();
