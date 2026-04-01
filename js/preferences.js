/**
 * preferences.js — localStorage manager for BreakingTrades v2
 * Single key: 'bt_preferences'
 */
(function() {
  'use strict';

  var STORAGE_KEY = 'bt_preferences';

  var defaultPrefs = {
    tickerTape: true,
    timezone: 'America/New_York',
    theme: 'dark',
    defaultPage: 'market',
    lastVisited: null,
    signals: {
      statusFilter: 'all',
      biasFilters: { bull: true, mixed: true, bear: true },
      sortMode: 'status',
      searchQuery: '',
      rightPanelCollapsed: false,
    },
    watchlist: {
      view: 'table',
      sortCol: 0,
      sortAsc: true,
    },
    expectedMoves: {
      tier: 'weekly',
      filter: 'all',
      sortCol: null,
      sortDir: null,
    },
    events: {
      categoryFilter: 'all',
    },
    collapsedSections: {},
  };

  /** Deep merge: target gets all keys from source that are missing */
  function deepMerge(target, source) {
    var result = {};
    for (var key in source) {
      if (!source.hasOwnProperty(key)) continue;
      if (typeof source[key] === 'object' && source[key] !== null && !Array.isArray(source[key])) {
        result[key] = deepMerge(target && target[key] || {}, source[key]);
      } else {
        result[key] = (target && target.hasOwnProperty(key)) ? target[key] : source[key];
      }
    }
    // Keep any extra keys from target not in source
    if (target) {
      for (var k in target) {
        if (target.hasOwnProperty(k) && !result.hasOwnProperty(k)) {
          result[k] = target[k];
        }
      }
    }
    return result;
  }

  function loadPrefs() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return JSON.parse(JSON.stringify(defaultPrefs));
      var stored = JSON.parse(raw);
      return deepMerge(stored, defaultPrefs);
    } catch(e) {
      return JSON.parse(JSON.stringify(defaultPrefs));
    }
  }

  function savePrefs(prefs) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch(e) { /* quota exceeded */ }
  }

  var _prefs = loadPrefs();

  BT.preferences = {
    /** Get all prefs */
    getPrefs: function() { return _prefs; },

    /** Merge a patch into prefs */
    setPrefs: function(patch) {
      for (var k in patch) {
        if (patch.hasOwnProperty(k)) _prefs[k] = patch[k];
      }
      savePrefs(_prefs);
    },

    /** Get a pref by dot-path, e.g. 'signals.sortMode' */
    getPref: function(path) {
      var parts = path.split('.');
      var obj = _prefs;
      for (var i = 0; i < parts.length; i++) {
        if (obj == null) return undefined;
        obj = obj[parts[i]];
      }
      return obj;
    },

    /** Set a pref by dot-path */
    setPref: function(path, value) {
      var parts = path.split('.');
      var obj = _prefs;
      for (var i = 0; i < parts.length - 1; i++) {
        if (obj[parts[i]] == null || typeof obj[parts[i]] !== 'object') {
          obj[parts[i]] = {};
        }
        obj = obj[parts[i]];
      }
      obj[parts[parts.length - 1]] = value;
      savePrefs(_prefs);
    },
  };
})();
