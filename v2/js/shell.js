/**
 * shell.js — Build nav bar, ticker tape toggle, mobile hamburger
 */
(function() {
  'use strict';

  var PAGES = [
    { route: 'market', label: 'Market' },
    { route: 'signals', label: 'Signals' },
    { route: 'watchlist', label: 'Watchlist' },
    { route: 'expected-moves', label: 'Expected Moves' },
    { route: 'events', label: 'Events' },
    { route: 'autoresearch', label: 'Autoresearch' },
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
    { value: 'UTC', label: 'UTC' },
  ];

  function buildNav() {
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
      '<svg class="nav-logo-wordmark" viewBox="0 0 260 28" width="200" height="22">' +
        '<defs>' +
          '<linearGradient id="nav-pulse-grad" x1="0" y1="0" x2="1" y2="0">' +
            '<stop offset="0%" stop-color="#00d4aa" stop-opacity="0.3"/>' +
            '<stop offset="42%" stop-color="#00d4aa"/>' +
            '<stop offset="58%" stop-color="#ffd700"/>' +
            '<stop offset="100%" stop-color="#ffa726" stop-opacity="0.3"/>' +
          '</linearGradient>' +
        '</defs>' +
        '<text x="2" y="16" fill="#00d4aa" font-family="\'SF Mono\',\'Fira Code\',monospace" font-size="14" font-weight="700" letter-spacing="1.5">BREAKING</text>' +
        '<text x="128" y="16" fill="#8888aa" font-family="\'SF Mono\',\'Fira Code\',monospace" font-size="14" font-weight="400" letter-spacing="1.5">TRADES</text>' +
        '<path d="M2,24 L104,24 L114,20 L120,26 L128,10 L136,22 L140,18 L148,24 L256,24" fill="none" stroke="url(#nav-pulse-grad)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>' +
        '<circle cx="128" cy="10" r="1.8" fill="#ffd700" opacity="0.7"/>' +
      '</svg>' +
    '</a>';

    // Hamburger
    var hamburger = '<button class="nav-hamburger" id="nav-hamburger" aria-label="Menu"><i data-lucide="menu"></i></button>';

    // Links
    var links = '<div class="nav-links" id="nav-links">';
    PAGES.forEach(function(p) {
      links += '<a href="#' + p.route + '" class="nav-link" data-route="' + p.route + '">' + p.label + '</a>';
    });
    links += '</div>';

    // Search
    var search = '<div class="nav-search-wrap"><input type="text" class="nav-search" id="ticker-search" placeholder="Search ticker..." autocomplete="off"><div class="search-dropdown" id="search-dropdown"></div></div>';

    // Right section
    var right = '<div class="nav-right">';
    // Market status
    right += '<span id="market-status"></span>';
    // Timezone picker
    var savedTz = BT.preferences.getPref('timezone') || 'America/New_York';
    right += '<select class="tz-select" id="tz-picker">';
    TZ_OPTIONS.forEach(function(tz) {
      right += '<option value="' + tz.value + '"' + (tz.value === savedTz ? ' selected' : '') + '>' + tz.label + '</option>';
    });
    right += '</select>';
    // Ticker tape toggle
    var tapeVisible = BT.preferences.getPref('tickerTape') !== false;
    right += '<button class="ticker-tape-toggle' + (tapeVisible ? ' active' : '') + '" id="ticker-tape-toggle" title="Toggle ticker tape"><i data-lucide="' + (tapeVisible ? 'eye' : 'eye-off') + '"></i></button>';
    right += '</div>';

    nav.innerHTML = hamburger + logo + links + search + right;

    // Bind events
    bindHamburger();
    bindTickerTapeToggle();
    bindTimezone();

    // Fire nav:ready
    document.dispatchEvent(new Event('nav:ready'));

    // Render Lucide icons in nav
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }

  function bindHamburger() {
    var btn = document.getElementById('nav-hamburger');
    var links = document.getElementById('nav-links');
    if (!btn || !links) return;
    btn.addEventListener('click', function() {
      links.classList.toggle('open');
    });
    // Close on link click
    links.addEventListener('click', function(e) {
      if (e.target.classList.contains('nav-link')) {
        links.classList.remove('open');
      }
    });
  }

  function bindTickerTapeToggle() {
    var btn = document.getElementById('ticker-tape-toggle');
    if (!btn) return;
    btn.addEventListener('click', function() {
      var visible = BT.preferences.getPref('tickerTape') !== false;
      var newState = !visible;
      BT.preferences.setPref('tickerTape', newState);
      btn.classList.toggle('active', newState);
      btn.innerHTML = '<i data-lucide="' + (newState ? 'eye' : 'eye-off') + '"></i>';
      if (typeof lucide !== 'undefined') lucide.createIcons({ attrs: { class: 'lucide' }, nameAttr: 'data-lucide' });
      if (newState) {
        tickerTape.show();
      } else {
        tickerTape.hide();
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
    var links = document.querySelectorAll('.nav-link');
    for (var i = 0; i < links.length; i++) {
      var link = links[i];
      if (link.getAttribute('data-route') === route) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    }
    // Close mobile menu
    var navLinks = document.getElementById('nav-links');
    if (navLinks) navLinks.classList.remove('open');
  };

  BT.buildShell = buildNav;
})();
