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
  document.addEventListener('nav:ready', function() {
    var tapeVisible = BT.preferences.getPref('tickerTape') !== false;
    if (!tapeVisible) {
      // Hide after a short delay to let it inject first
      setTimeout(function() { tickerTape.hide(); }, 100);
    }
  });

  // Start router
  BT.router.start();
})();
