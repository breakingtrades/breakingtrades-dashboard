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

  async function load() {
    if (_loadPromise) return _loadPromise;
    _loadPromise = fetch('../data/prices.json')
      .then(r => {
        if (!r.ok) throw new Error(`prices.json: ${r.status}`);
        return r.json();
      })
      .then(d => {
        _data = d;
        _loaded = true;
        return d;
      })
      .catch(e => {
        console.warn('btPrices: failed to load prices.json —', e.message);
        _loaded = true; // mark loaded so callers don't block forever
        return null;
      });
    return _loadPromise;
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

  return { load, get, price, change, updatedAt, updatedLabel, isLoaded, symbols };
})();
