/**
 * app.js — Entry point for BreakingTrades v2
 * Loads btPrices, builds shell, starts router
 */
(function() {
  'use strict';

  // Load prices
  if (typeof btPrices !== 'undefined') {
    btPrices.load();
  }

  // Build shell (nav bar)
  BT.buildShell();

  // Init market status
  if (typeof initMarketStatus === 'function') {
    initMarketStatus();
  }

  // Init ticker search
  if (typeof initTickerSearch === 'function') {
    initTickerSearch();
  }

  // Restore ticker tape state from preferences
  // NOTE: post-2026-06-10 UI overhaul, ticker tape default is OFF
  // (snapshot strip replaces it). Only show if user explicitly opted in.
  document.addEventListener('nav:ready', function() {
    var tapeVisible = BT.preferences.getPref('tickerTape') === true;
    if (!tapeVisible && typeof tickerTape !== 'undefined') {
      setTimeout(function() { tickerTape.hide(); }, 100);
    }
  });

  // Start router
  BT.router.start();
})();
