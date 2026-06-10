/**
 * fetch-json.js — Cache-bust helper + global fetch interceptor.
 *
 * Why this exists:
 *   - All `data/*.json` files on GitHub Pages get served with default
 *     `max-age` headers and the browser caches them aggressively. Result:
 *     producer cron updates JSON at 9:50 AM, but the user's tab still
 *     reads yesterday's copy from the disk cache.
 *
 *   - This file does TWO things:
 *
 *     1. Installs a `window.fetch` interceptor that auto-appends a
 *        per-minute cache-bust query string to any URL matching
 *        `data/*` or `./data/*`. This means every existing page
 *        already gets cache-busted reads with zero per-page changes —
 *        no need to refactor 14+ call sites to a custom helper.
 *
 *     2. Exposes BT.fetchJson() / BT.fetchText() convenience wrappers
 *        for new code that wants the warn-on-error + parse-to-JSON
 *        pattern in one shot.
 *
 *   - Per-minute granularity (vs `?t=${Date.now()}`) keeps adjacent
 *     calls within the same minute on the same cache entry — they share
 *     the response, no thundering herd.
 *
 *   - Skips URLs that already carry a `?t=` query (so bt-prices.js's
 *     own cache-bust stays idempotent), skips non-`data/` URLs entirely
 *     (so external Yahoo/TradingView/CDN calls are untouched).
 */
(function() {
  'use strict';
  if (!window.BT) window.BT = {};
  var BT = window.BT;

  function _bustUrl(url) {
    var sep = url.indexOf('?') === -1 ? '?' : '&';
    return url + sep + 't=' + Math.floor(Date.now() / 60000);
  }

  /** Detect URLs we want to auto-bust: anything relative to `data/`. */
  function _isVaultUrl(url) {
    if (typeof url !== 'string') return false;
    // Match: data/x.json, ./data/x.json, /data/x.json (any depth from origin)
    // Do NOT match: https://api.example.com/data/x (absolute external).
    if (/^https?:\/\//i.test(url)) return false;
    return /(^|\/)data\//.test(url);
  }

  /** Install global fetch interceptor exactly once. */
  function _installInterceptor() {
    if (window.fetch.__btCacheBust) return;
    var orig = window.fetch.bind(window);
    var wrapped = function(input, init) {
      var url = (typeof input === 'string') ? input :
                (input && input.url) ? input.url : null;
      // Only mutate when input is a string URL pointing at data/, and the
      // caller hasn't already added their own `t=` bust.
      if (typeof input === 'string' && _isVaultUrl(input) && input.indexOf('t=') === -1) {
        return orig(_bustUrl(input), init);
      }
      return orig(input, init);
    };
    wrapped.__btCacheBust = true;
    window.fetch = wrapped;
  }

  // Install immediately on script load — must run before any page's
  // fetch('data/...') call. Index.html loads this in the lib block
  // before any page scripts.
  _installInterceptor();

  /** Fetch a JSON file with cache-bust. Returns the parsed object, or null on failure. */
  function fetchJson(url, opts) {
    opts = opts || {};
    var finalUrl = opts.noBust ? url : _bustUrl(url);
    return fetch(finalUrl, { cache: 'no-cache' })
      .then(function(r) {
        if (!r.ok) {
          if (opts.warn !== false) console.warn('fetchJson: ' + url + ' HTTP ' + r.status);
          return null;
        }
        return r.json();
      })
      .catch(function(e) {
        if (opts.warn !== false) console.warn('fetchJson: ' + url + ' failed —', e.message || e);
        return null;
      });
  }

  /** Fetch a text file (e.g. .jsonl) with cache-bust. Returns string or null. */
  function fetchText(url, opts) {
    opts = opts || {};
    var finalUrl = opts.noBust ? url : _bustUrl(url);
    return fetch(finalUrl, { cache: 'no-cache' })
      .then(function(r) {
        if (!r.ok) {
          if (opts.warn !== false) console.warn('fetchText: ' + url + ' HTTP ' + r.status);
          return null;
        }
        return r.text();
      })
      .catch(function(e) {
        if (opts.warn !== false) console.warn('fetchText: ' + url + ' failed —', e.message || e);
        return null;
      });
  }

  BT.fetchJson = fetchJson;
  BT.fetchText = fetchText;
  BT._bustUrl = _bustUrl;
  BT._isVaultUrl = _isVaultUrl;
})();

