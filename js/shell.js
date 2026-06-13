/**
 * shell.js — Build nav bar, snapshot strip, mobile hamburger.
 *
 * Nav structure (post-overhaul):
 *   [Logo] [Primary links] [More ⋯] | [Search] [Snapshot toggle] [Tape toggle] [TZ]
 *
 * Primary links are the 5 most-used routes; secondary (Events/Week Ahead/
 * Research) live in the "More" dropdown to keep the nav from overflowing
 * on common viewport widths. Logo wordmark hidden under 1100px to free
 * more horizontal space.
 *
 * Default top-of-page widget = our snapshot-strip (live SPY/QQQ/IWM/VIX/
 * BTC/Gold via Yahoo chart endpoint). TradingView ticker tape is opt-in
 * via the second toggle button.
 */
(function() {
  'use strict';

  var PRIMARY_PAGES = [
    { route: 'market', label: 'Market' },
    { route: 'signals', label: 'Signals' },
    { route: 'watchlist', label: 'Watchlist' },
    { route: 'expected-moves', label: 'Expected Moves' },
    { route: 'week-ahead', label: 'Week Ahead' }
  ];

  var MORE_PAGES = [
    { route: 'events',       label: 'Events',     icon: 'calendar' },
    { route: 'airesearcher', label: 'Research',   icon: 'flask-conical' }
  ];

  var TZ_OPTIONS = [
    { value: 'America/New_York', label: 'ET' },
    { value: 'America/Chicago', label: 'CT' },
    { value: 'America/Los_Angeles', label: 'PT' },
    { value: 'Europe/London', label: 'GMT' },
    { value: 'Europe/Berlin', label: 'CET' },
    { value: 'Asia/Jerusalem', label: 'IST' },
    { value: 'Asia/Tokyo', label: 'JST' },
    { value: 'Australia/Sydney', label: 'AEST' },
    { value: 'UTC', label: 'UTC' }
  ];

  function buildNav() {
    // V3 mode — mount sidebar shell instead of legacy top nav
    if (BT.preferences.getPref('v3') !== false && window.V3Sidebar) {
      // Hide the legacy <nav id="nav"> element entirely
      var legacyNav = document.getElementById('nav');
      if (legacyNav) legacyNav.style.display = 'none';
      // Mount V3 sidebar + topbar shell
      window.V3Sidebar.mount(document.body);
      // Wire snapshot/tape from V3 tape-toggle three-state into existing strip lifecycles
      window.addEventListener('v3:tape-state-change', function(ev) {
        var state = ev && ev.detail && ev.detail.state;
        // Mutually exclusive: state can be 'off' | 'snapshot' | 'tape'
        if (state === 'snapshot') {
          BT.preferences.setPref('snapshotStrip', true);
          BT.preferences.setPref('tickerTape', false);
          if (window.snapshotStrip && window.snapshotStrip.mount) window.snapshotStrip.mount('body');
          if (window.tickerTape && window.tickerTape.destroy) window.tickerTape.destroy();
        } else if (state === 'tape') {
          BT.preferences.setPref('snapshotStrip', false);
          BT.preferences.setPref('tickerTape', true);
          if (window.snapshotStrip && window.snapshotStrip.destroy) window.snapshotStrip.destroy();
          // Tape mounts itself on nav:ready — but we've gated nav:ready, so mount manually if available
          if (window.tickerTape && window.tickerTape.mount) {
            try { window.tickerTape.mount('body'); } catch(e) { /* legacy tape may not have mount */ }
          }
        } else {
          BT.preferences.setPref('snapshotStrip', false);
          BT.preferences.setPref('tickerTape', false);
          if (window.snapshotStrip && window.snapshotStrip.destroy) window.snapshotStrip.destroy();
          if (window.tickerTape && window.tickerTape.destroy) window.tickerTape.destroy();
        }
      });
      // Fire nav:ready so other scripts that wait for it (ticker-tape, market-status) still work
      document.dispatchEvent(new Event('nav:ready'));
      return;
    }

    // Legacy v2 path below — only runs if v3 explicitly disabled
    var nav = document.getElementById('nav');
    if (!nav) return;

    nav.className = 'nav-bar';

    // Logo — Market Pulse mark + wordmark with gradient pulse underline
    var logo = '<a href="#market" class="nav-logo">' +
      '<svg class="nav-logo-mark" viewBox="0 0 48 48" width="24" height="24">' +
        '<rect width="48" height="48" rx="10" fill="#111122" stroke="#00d4aa" stroke-width="1.2"/>' +
        '<path d="M8,32 L14,32 L17,24 L22,36 L26,14 L31,28 L34,22 L38,32" fill="none" stroke="#00d4aa" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>' +
        '<path d="M8,32 L14,32 L17,24 L22,36 L26,14 L31,28 L34,22 L38,32" fill="none" stroke="#00d4aa" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" opacity="0.1"/>' +
      '</svg>' +
      '<svg class="nav-logo-wordmark" viewBox="50 0 210 28" width="162" height="22">' +
        '<defs>' +
          '<linearGradient id="nav-pulse-grad" x1="0" y1="0" x2="1" y2="0">' +
            '<stop offset="0%" stop-color="#00d4aa" stop-opacity="0.3"/>' +
            '<stop offset="42%" stop-color="#00d4aa"/>' +
            '<stop offset="58%" stop-color="#ffd700"/>' +
            '<stop offset="100%" stop-color="#ffa726" stop-opacity="0.3"/>' +
          '</linearGradient>' +
        '</defs>' +
        '<text x="68" y="16" fill="#00d4aa" font-family="\'SF Mono\',\'Fira Code\',monospace" font-size="14" font-weight="700" letter-spacing="1.5">BREAKING</text>' +
        '<text x="182" y="16" fill="#8888aa" font-family="\'SF Mono\',\'Fira Code\',monospace" font-size="14" font-weight="400" letter-spacing="1.5">TRADES</text>' +
        '<path d="M60,24 L152,24 L162,20 L168,26 L176,10 L184,22 L188,18 L196,24 L256,24" fill="none" stroke="url(#nav-pulse-grad)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>' +
        '<circle cx="176" cy="10" r="1.8" fill="#ffd700" opacity="0.7"/>' +
      '</svg>' +
    '</a>';

    // Hamburger
    var hamburger = '<button class="nav-hamburger" id="nav-hamburger" aria-label="Menu"><i data-lucide="menu"></i></button>';

    // Primary links
    var links = '<div class="nav-links" id="nav-links">';
    PRIMARY_PAGES.forEach(function(p) {
      links += '<a href="#' + p.route + '" class="nav-link" data-route="' + p.route + '">' + p.label + '</a>';
    });
    // "More" dropdown trigger + menu
    links += '<div class="nav-more" id="nav-more">' +
      '<button class="nav-link nav-more-toggle" id="nav-more-toggle" aria-label="More" aria-haspopup="true" aria-expanded="false">' +
        'More <i data-lucide="chevron-down" class="nav-more-chev"></i>' +
      '</button>' +
      '<div class="nav-more-menu" id="nav-more-menu" role="menu">';
    MORE_PAGES.forEach(function(p) {
      links += '<a href="#' + p.route + '" class="nav-link nav-more-item" data-route="' + p.route + '" role="menuitem">' +
        '<i data-lucide="' + p.icon + '"></i> ' + p.label +
      '</a>';
    });
    links += '</div></div>';
    links += '</div>';

    // Search
    var search = '<div class="nav-search-wrap"><input type="text" class="nav-search" id="ticker-search" placeholder="Search ticker..." autocomplete="off"><div class="search-dropdown" id="search-dropdown"></div></div>';

    // Right section
    var right = '<div class="nav-right">';
    // Market status (shrinks to icon only on narrow viewports)
    right += '<span id="market-status"></span>';
    // Snapshot strip toggle (default ON)
    var snapVisible = BT.preferences.getPref('snapshotStrip') !== false;
    right += '<button class="nav-icon-btn ticker-tape-toggle' + (snapVisible ? ' active' : '') + '"' +
             ' id="snapshot-toggle" title="Toggle snapshot strip">' +
             '<i data-lucide="activity"></i></button>';
    // Ticker tape toggle (default OFF — opt-in for TradingView tape)
    var tapeVisible = BT.preferences.getPref('tickerTape') === true;
    right += '<button class="nav-icon-btn ticker-tape-toggle' + (tapeVisible ? ' active' : '') + '"' +
             ' id="ticker-tape-toggle" title="Toggle scrolling ticker tape (TradingView)">' +
             '<i data-lucide="' + (tapeVisible ? 'eye' : 'eye-off') + '"></i></button>';
    // Timezone picker
    var savedTz = BT.preferences.getPref('timezone') || 'America/New_York';
    right += '<select class="tz-select" id="tz-picker" title="Display timezone">';
    TZ_OPTIONS.forEach(function(tz) {
      right += '<option value="' + tz.value + '"' + (tz.value === savedTz ? ' selected' : '') + '>' + tz.label + '</option>';
    });
    right += '</select>';
    right += '</div>';

    nav.innerHTML = hamburger + logo + links + search + right;

    // Bind events
    bindHamburger();
    bindMoreDropdown();
    bindTickerTapeToggle();
    bindSnapshotToggle();
    bindTimezone();

    // Mount snapshot strip (default visible)
    if (snapVisible && window.snapshotStrip) {
      window.snapshotStrip.mount('body');
    }

    // Fire nav:ready
    document.dispatchEvent(new Event('nav:ready'));

    // Render Lucide icons in nav
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }

  function bindHamburger() {
    var btn = document.getElementById('nav-hamburger');
    var links = document.getElementById('nav-links');
    if (!btn || !links) return;
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      links.classList.toggle('open');
    });
    document.addEventListener('click', function(e) {
      if (!btn.contains(e.target) && !links.contains(e.target)) {
        links.classList.remove('open');
      }
    });
    links.addEventListener('click', function(e) {
      if (e.target.classList.contains('nav-link')) {
        links.classList.remove('open');
      }
    });
  }

  function bindMoreDropdown() {
    var toggle = document.getElementById('nav-more-toggle');
    var menu = document.getElementById('nav-more-menu');
    if (!toggle || !menu) return;
    toggle.addEventListener('click', function(e) {
      e.stopPropagation();
      var open = menu.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(open));
    });
    document.addEventListener('click', function(e) {
      if (!toggle.contains(e.target) && !menu.contains(e.target)) {
        menu.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
    menu.addEventListener('click', function(e) {
      if (e.target.closest && e.target.closest('.nav-more-item')) {
        menu.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  function bindTickerTapeToggle() {
    var btn = document.getElementById('ticker-tape-toggle');
    if (!btn) return;
    btn.addEventListener('click', function() {
      var visible = BT.preferences.getPref('tickerTape') === true;
      var newState = !visible;
      BT.preferences.setPref('tickerTape', newState);
      btn.classList.toggle('active', newState);
      btn.innerHTML = '<i data-lucide="' + (newState ? 'eye' : 'eye-off') + '"></i>';
      if (typeof lucide !== 'undefined') lucide.createIcons({ attrs: { class: 'lucide' }, nameAttr: 'data-lucide' });
      if (newState) {
        if (typeof tickerTape !== 'undefined') tickerTape.show();
      } else {
        if (typeof tickerTape !== 'undefined') tickerTape.hide();
      }
    });
  }

  function bindSnapshotToggle() {
    var btn = document.getElementById('snapshot-toggle');
    if (!btn) return;
    btn.addEventListener('click', function() {
      var visible = BT.preferences.getPref('snapshotStrip') !== false;
      var newState = !visible;
      BT.preferences.setPref('snapshotStrip', newState);
      btn.classList.toggle('active', newState);
      if (newState && window.snapshotStrip) {
        window.snapshotStrip.mount('body');
      } else if (window.snapshotStrip) {
        window.snapshotStrip.destroy();
      }
    });
  }

  function bindTimezone() {
    var tz = document.getElementById('tz-picker');
    if (!tz) return;
    tz.addEventListener('change', function(e) {
      BT.preferences.setPref('timezone', e.target.value);
    });
  }

  /** Update active nav link — called by router on route change */
  BT.updateNavActive = function(route) {
    // V3 mode: delegate to V3Sidebar's setActive
    if (window.V3Sidebar && window.V3Sidebar.setActive) {
      // Map legacy-loaded routes back to v3 sidebar items
      var v3Map = { 'airesearcher': 'research', 'events': 'calendar', 'week-ahead': 'calendar' };
      window.V3Sidebar.setActive(v3Map[route] || route);
    }
    var links = document.querySelectorAll('.nav-link');
    for (var i = 0; i < links.length; i++) {
      var link = links[i];
      if (link.getAttribute('data-route') === route) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    }
    // Highlight "More" toggle if route is in MORE_PAGES
    var inMore = MORE_PAGES.some(function(p) { return p.route === route; });
    var moreToggle = document.getElementById('nav-more-toggle');
    if (moreToggle) moreToggle.classList.toggle('active', inMore);

    // Close mobile menu
    var navLinks = document.getElementById('nav-links');
    if (navLinks) navLinks.classList.remove('open');
  };

  BT.buildShell = buildNav;
})();
