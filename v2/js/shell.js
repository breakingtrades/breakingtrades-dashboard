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

    // Logo
    var logo = '<a href="#market" class="nav-logo">BREAKING<span>TRADES</span></a>';

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
