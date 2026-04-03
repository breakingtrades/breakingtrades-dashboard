/**
 * bt-prices.js — Shared price provider for all BreakingTrades dashboard pages.
 *
 * Single source of truth: data/prices.json
 * Every page loads this, then calls btPrices.get('SPY') for the canonical price.
 *
 * Usage:
 *   <script src="bt-prices.js"></script>
 *   await btPrices.load();
 *   const spy = btPrices.get('SPY'); // { price: 645.09, change: -1.79, updated: '...' }
 */
const btPrices = (() => {
  let _data = {};      // { tickers: { SPY: { price, change, updated }, ... }, updated, source }
  let _loaded = false;
  let _loadPromise = null;
  let _refreshTimer = null;
  let _onRefreshCallbacks = [];

  async function load() {
    if (_loadPromise) return _loadPromise;
    _loadPromise = _fetchPrices();
    return _loadPromise;
  }

  async function _fetchPrices() {
    try {
      const r = await fetch('data/prices.json', { cache: 'no-cache' });
      if (!r.ok) throw new Error('prices.json: ' + r.status);
      const d = await r.json();
      _data = d;
      _loaded = true;
      return d;
    } catch(e) {
      console.warn('btPrices: failed to load prices.json —', e.message);
      _loaded = true;
      return null;
    }
  }

  /** Re-fetch prices and notify listeners. Returns true if data changed. */
  async function refresh() {
    var oldTs = _data?.updated;
    await _fetchPrices();
    var newTs = _data?.updated;
    if (newTs && newTs !== oldTs) {
      _onRefreshCallbacks.forEach(function(cb) { try { cb(); } catch(e) {} });
      return true;
    }
    return false;
  }

  /** Register a callback for when prices refresh with new data. */
  function onRefresh(cb) { _onRefreshCallbacks.push(cb); }

  /** Start auto-refresh (default: every 5 min during market hours). */
  function startAutoRefresh(intervalMs) {
    if (_refreshTimer) return;
    intervalMs = intervalMs || 5 * 60 * 1000; // 5 minutes
    _refreshTimer = setInterval(function() {
      // Only refresh during approximate US market hours (Mon-Fri 9-17 ET)
      var now = new Date();
      var etHour = parseInt(now.toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: 'America/New_York' }));
      var day = now.getDay(); // 0=Sun, 6=Sat
      if (day >= 1 && day <= 5 && etHour >= 9 && etHour < 17) {
        refresh();
      }
    }, intervalMs);
  }

  /** Stop auto-refresh. */
  function stopAutoRefresh() {
    if (_refreshTimer) { clearInterval(_refreshTimer); _refreshTimer = null; }
  }

  /** Get price data for a symbol. Returns { price, change, updated } or null. */
  function get(symbol) {
    return _data?.tickers?.[symbol] || null;
  }

  /** Get just the price number, with fallback. */
  function price(symbol, fallback) {
    return get(symbol)?.price ?? fallback ?? null;
  }

  /** Get change %, with fallback. */
  function change(symbol, fallback) {
    return get(symbol)?.change ?? fallback ?? 0;
  }

  /** Top-level updated timestamp. */
  function updatedAt() {
    return _data?.updated || null;
  }

  /** Format updated timestamp for display (e.g. "Mar 26, 4:20 PM ET"). */
  function updatedLabel() {
    const ts = _data?.updated;
    if (!ts) return 'unknown';
    try {
      const d = new Date(ts);
      return d.toLocaleString('en-US', {
        month: 'short', day: 'numeric',
        hour: 'numeric', minute: '2-digit', hour12: true,
        timeZone: 'America/New_York'
      }) + ' ET';
    } catch {
      return ts;
    }
  }

  /** Check if data is loaded. */
  function isLoaded() { return _loaded; }

  /** Get all ticker symbols. */
  function symbols() { return Object.keys(_data?.tickers || {}); }

  return { load, get, price, change, updatedAt, updatedLabel, isLoaded, symbols, refresh, onRefresh, startAutoRefresh, stopAutoRefresh };
})();
