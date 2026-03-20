/**
 * nav.js — Shared navigation bar for BreakingTrades Dashboard
 * Renders the nav into <nav id="nav"></nav> on every page.
 */
(function () {
  'use strict';

  const PAGES = [
    { href: 'index.html', label: 'Signals', aliases: ['', '/'] },
    { href: 'watchlist.html', label: 'Watchlist' },
    { href: 'expected-moves.html', label: 'Expected Moves' },
    { href: 'market.html', label: 'Market' },
  ];

  const TZ_OPTIONS = [
    { value: 'America/New_York', label: '🕐 ET' },
    { value: 'America/Chicago', label: 'CT' },
    { value: 'America/Los_Angeles', label: 'PT' },
    { value: 'Europe/London', label: 'GMT' },
    { value: 'Europe/Berlin', label: 'CET' },
    { value: 'Asia/Jerusalem', label: 'IST' },
    { value: 'Asia/Tokyo', label: 'JST' },
    { value: 'Australia/Sydney', label: 'AEST' },
    { value: 'UTC', label: 'UTC' },
  ];

  function currentPage() {
    const path = location.pathname;
    const file = path.split('/').pop() || 'index.html';
    return file;
  }

  function buildNav() {
    const nav = document.getElementById('nav');
    if (!nav) return;
    nav.className = 'nav-bar';

    const cur = currentPage();

    // Logo
    const logo = document.createElement('a');
    logo.href = 'index.html';
    logo.className = 'nav-logo';
    logo.style.textDecoration = 'none';
    logo.style.color = 'inherit';
    logo.innerHTML = `<svg class="bt-logo" viewBox="0 0 32 32" width="22" height="22" style="vertical-align:middle;margin-right:8px;"><rect width="32" height="32" rx="6" fill="var(--cyan)"/><path d="M6 22 L12 14 L17 18 L26 8" stroke="#0a0a12" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none"/><circle cx="26" cy="8" r="2.5" fill="#0a0a12"/></svg><span class="bt-logo-text">BREAKING<span>TRADES</span></span>`;
    nav.appendChild(logo);

    // Page links
    const links = document.createElement('div');
    links.className = 'nav-links';
    PAGES.forEach(p => {
      const a = document.createElement('a');
      a.href = p.href;
      a.className = 'nav-link';
      a.textContent = p.label;
      const isActive = cur === p.href || (p.aliases && p.aliases.includes(cur));
      if (isActive) a.classList.add('active');
      links.appendChild(a);
    });
    nav.appendChild(links);

    // Search
    const searchWrap = document.createElement('div');
    searchWrap.className = 'nav-search-wrap';
    searchWrap.innerHTML = `<input type="text" id="ticker-search" class="nav-search" placeholder="Search ticker…" autocomplete="off" spellcheck="false"><div id="search-results" class="search-dropdown"></div>`;
    nav.appendChild(searchWrap);

    // Right section
    const right = document.createElement('div');
    right.className = 'nav-right';

    // Market status
    const status = document.createElement('div');
    status.id = 'market-status';
    status.style.cssText = 'font-size:11px;color:var(--text-dim);';
    status.innerHTML = 'Market: <span style="color:var(--text-dim);">...</span>';
    right.appendChild(status);

    // Timezone picker
    const tz = document.createElement('select');
    tz.className = 'tz-select';
    tz.id = 'tz-picker';
    tz.title = 'Timezone';
    TZ_OPTIONS.forEach(opt => {
      const o = document.createElement('option');
      o.value = opt.value;
      o.textContent = opt.label;
      tz.appendChild(o);
    });
    right.appendChild(tz);

    nav.appendChild(right);
  }

  function init() {
    buildNav();

    // Init dependent modules after nav is in DOM
    if (typeof initTickerSearch === 'function') {
      initTickerSearch();
    }
    if (typeof initMarketStatus === 'function') {
      initMarketStatus();
    }

    // Restore saved timezone
    var tzPicker = document.getElementById('tz-picker');
    if (tzPicker) {
      var savedTZ = localStorage.getItem('bt_timezone');
      if (savedTZ) tzPicker.value = savedTZ;
      tzPicker.addEventListener('change', function() {
        localStorage.setItem('bt_timezone', tzPicker.value);
        document.dispatchEvent(new CustomEvent('bt:tz-change', { detail: tzPicker.value }));
      });
    }

    // Notify page scripts that nav is ready
    document.dispatchEvent(new Event('nav:ready'));
  }

  // Run on DOMContentLoaded or immediately if already loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
