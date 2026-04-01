/**
 * router.js — Hash-based router for BreakingTrades v2
 */
(function() {
  'use strict';

  var ROUTES = {
    'market':         { css: 'css/market.css',          js: 'js/pages/market.js',         title: 'Market' },
    'signals':        { css: 'css/signals.css',         js: 'js/pages/signals.js',        title: 'Signals' },
    'watchlist':      { css: 'css/watchlist.css',        js: 'js/pages/watchlist.js',      title: 'Watchlist' },
    'expected-moves': { css: 'css/expected-moves.css',   js: 'js/pages/expected-moves.js', title: 'Expected Moves' },
    'events':         { css: 'css/events.css',           js: 'js/pages/events.js',         title: 'Events' },
    'autoresearch':   { css: 'css/autoresearch.css',     js: 'js/pages/autoresearch.js',   title: 'AI Researcher' },
  };

  var _currentRoute = null;
  var _loadedCSS = {};
  var _loadedJS = {};

  function parseHash() {
    var hash = location.hash.replace(/^#\/?/, '') || '';
    var parts = hash.split('/');
    return { route: parts[0] || '', param: parts[1] || null };
  }

  function loadCSS(href) {
    if (_loadedCSS[href]) return;
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
    _loadedCSS[href] = true;
  }

  function loadJS(src, callback) {
    if (_loadedJS[src]) {
      callback();
      return;
    }
    var script = document.createElement('script');
    script.src = src;
    script.onload = function() {
      _loadedJS[src] = true;
      callback();
    };
    script.onerror = function() {
      console.error('Failed to load:', src);
      callback();
    };
    document.body.appendChild(script);
  }

  function navigate() {
    var parsed = parseHash();
    var route = parsed.route;
    var param = parsed.param;

    // Default route
    if (!route || !ROUTES[route]) {
      var defaultPage = BT.preferences.getPref('defaultPage') || BT.preferences.getPref('lastVisited') || 'market';
      if (!ROUTES[defaultPage]) defaultPage = 'market';
      location.hash = '#' + defaultPage;
      return;
    }

    var config = ROUTES[route];
    var contentEl = document.getElementById('content');

    // Update nav active
    BT.updateNavActive(route);

    // Save last visited
    BT.preferences.setPref('lastVisited', route);

    // Destroy current page
    if (_currentRoute && BT.pages[_currentRoute] && BT.pages[_currentRoute].destroy) {
      try { BT.pages[_currentRoute].destroy(); } catch(e) { console.error('destroy error:', e); }
    }

    _currentRoute = route;

    // Load page CSS
    if (config.css) loadCSS(config.css);

    // Load page JS (lazy), then render + init
    function renderPage() {
      var page = BT.pages[route];
      if (page) {
        if (page.render) page.render(contentEl);
        if (page.init) page.init(param);
      } else {
        // No page module — show coming soon
        contentEl.innerHTML = '<div class="coming-soon">' + config.title + ' — Coming Soon</div>';
      }
      // Update title
      document.title = config.title + ' — BreakingTrades';
      // Scroll to top
      window.scrollTo(0, 0);
    }

    if (BT.pages[route]) {
      renderPage();
    } else if (config.js) {
      loadJS(config.js, renderPage);
    } else {
      renderPage();
    }
  }

  BT.router = {
    start: function() {
      window.addEventListener('hashchange', navigate);
      navigate();
    },
    navigate: function(route) {
      location.hash = '#' + route;
    }
  };
})();
