/**
 * js/lib/sidebar.js — V3 sidebar component.
 *
 * Single source of truth for V3 navigation. Renders sectioned sidebar with
 * freshness dots, persistent collapsed state, mobile drawer behavior, and
 * keyboard shortcuts.
 *
 * Public API:
 *   window.V3Sidebar.mount(rootEl)   — mount + bind events, returns a destroy fn
 *   window.V3Sidebar.NAV              — nav config (export so other code can introspect)
 */
(function() {
  'use strict';

  // Icons inline (Lucide-like minimal set, 18×18 viewbox).
  // Keep them tiny + monochrome so they scale clean.
  var ICON = {
    market:     '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M2 14l4-5 3 2 5-7 2 3"/></svg>',
    watchlist:  '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3h12v12H3z"/><path d="M3 7h12M3 11h12M7 3v12"/></svg>',
    signals:    '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M2 13h2V8H2zM7 13h2V5H7zM12 13h2V10h-2z"/></svg>',
    alerts:     '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M14 11V7a5 5 0 10-10 0v4l-2 2v1h14v-1l-2-2zM7 16a2 2 0 004 0"/></svg>',
    em:         '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M2 9h14M5 6l-3 3 3 3M13 6l3 3-3 3"/></svg>',
    calendar:   '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="14" height="13" rx="1.5"/><path d="M2 7h14M5 1v3M13 1v3"/></svg>',
    research:   '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="5"/><path d="M12 12l4 4"/></svg>',
    aiTrader:   '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 1.5l1.6 4.4 4.4 1.6-4.4 1.6L9 13.5l-1.6-4.4L3 7.5l4.4-1.6z"/><circle cx="14" cy="14" r="2"/></svg>',
    holdings:   '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M2 6h14v9H2zM2 6l2-3h10l2 3"/><path d="M7 10h4"/></svg>',
    settings:   '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="9" r="2.5"/><path d="M14.5 9l1.2-.6-.6-1.5-1.3.3-.9-.9.3-1.3-1.5-.6-.6 1.2H9l-.6-1.2-1.5.6.3 1.3-.9.9-1.3-.3-.6 1.5 1.2.6v1L3.4 11l.6 1.5 1.3-.3.9.9-.3 1.3 1.5.6.6-1.2H9l.6 1.2 1.5-.6-.3-1.3.9-.9 1.3.3.6-1.5-1.2-.6z"/></svg>',
    about:      '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="9" r="7"/><path d="M9 6v3M9 12h.01"/></svg>',
    collapse:   '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4l-5 5 5 5"/></svg>',
    menu:       '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 5h12M3 9h12M3 13h12"/></svg>',
  };

  var FRESH_DOT_SVG = '<svg class="v3-fresh-dot" viewBox="0 0 6 6"><circle cx="3" cy="3" r="3"/></svg>';

  var NAV = [
    {
      label: 'TODAY',
      items: [
        { route: 'market',     label: 'Market',         icon: 'market',     freshKey: 'market'        },
        { route: 'watchlist',  label: 'Watchlist',      icon: 'watchlist',  freshKey: 'watchlist'     },
        { route: 'signals',    label: 'Signals',        icon: 'signals',    freshKey: 'signals'       },
        { route: 'alerts',     label: 'Alerts',         icon: 'alerts',     freshKey: null, badge: 0  },
      ]
    },
    {
      label: 'ANALYSIS',
      items: [
        { route: 'expected-moves', label: 'Expected Moves', icon: 'em',       freshKey: 'expected-moves' },
        { route: 'calendar',       label: 'Calendar',       icon: 'calendar', freshKey: 'calendar'       },
        { route: 'research',       label: 'Research',       icon: 'research', freshKey: 'research'       },
      ]
    },
    {
      label: 'PERFORMANCE',
      items: [
        { route: 'ai-trader',  label: 'AI-Trader',      icon: 'aiTrader',   freshKey: 'ai-trader'     },
        { route: 'holdings',   label: 'Holdings',       icon: 'holdings',   freshKey: 'holdings'      },
      ]
    },
    {
      label: 'ACCOUNT',
      anchorBottom: true,
      items: [
        { route: 'settings',   label: 'Settings',       icon: 'settings'  },
        { route: 'about',      label: 'About',          icon: 'about'     },
      ]
    }
  ];

  var _root = null;
  var _freshState = {};        // route -> 'ok' | 'warn' | 'stale' | 'idle'
  var _freshPollTimer = null;

  // ─── Render ────────────────────────────────────────────────────────────────
  function renderItem(item) {
    var freshDot = item.freshKey ? FRESH_DOT_SVG : '';
    var badge = (item.badge != null && item.badge > 0) ? '<span class="v3-nav-badge">' + item.badge + '</span>' : '';
    return (
      '<a class="v3-nav-item" data-route="' + item.route + '" data-label="' + item.label + '" href="#' + item.route + '">' +
        '<span class="v3-nav-icon">' + (ICON[item.icon] || '') + '</span>' +
        '<span class="v3-nav-label">' + item.label + '</span>' +
        freshDot +
        badge +
      '</a>'
    );
  }

  function renderSection(section) {
    var items = section.items.map(renderItem).join('');
    var label = section.label
      ? '<div class="v3-section-label" aria-hidden="true">' + section.label + '</div>'
      : '';
    var anchor = section.anchorBottom ? ' style="margin-top:auto;"' : '';
    return '<div class="v3-section"' + anchor + '>' + label + items + '</div>';
  }

  function renderSidebar() {
    return (
      '<aside class="v3-sidebar" id="v3-sidebar" aria-label="Primary navigation">' +
        '<a href="#market" class="v3-sidebar-header" aria-label="BreakingTrades home">' +
          // Logo mark — Market Pulse (rounded square + heartbeat line)
          '<svg class="v3-logo-mark" viewBox="0 0 48 48" width="28" height="28">' +
            '<rect width="48" height="48" rx="10" fill="#111122" stroke="#00d4aa" stroke-width="1.2"/>' +
            '<path d="M8,32 L14,32 L17,24 L22,36 L26,14 L31,28 L34,22 L38,32" fill="none" stroke="#00d4aa" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>' +
            '<path d="M8,32 L14,32 L17,24 L22,36 L26,14 L31,28 L34,22 L38,32" fill="none" stroke="#00d4aa" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" opacity="0.1"/>' +
          '</svg>' +
          // Wordmark — BREAKING (cyan) + TRADES (dim) with gradient pulse line
          '<svg class="v3-logo-wordmark" viewBox="50 0 210 28" width="148" height="20" aria-hidden="true">' +
            '<defs>' +
              '<linearGradient id="v3-pulse-grad" x1="0" y1="0" x2="1" y2="0">' +
                '<stop offset="0%" stop-color="#00d4aa" stop-opacity="0.3"/>' +
                '<stop offset="42%" stop-color="#00d4aa"/>' +
                '<stop offset="58%" stop-color="#ffd700"/>' +
                '<stop offset="100%" stop-color="#ffa726" stop-opacity="0.3"/>' +
              '</linearGradient>' +
            '</defs>' +
            '<text x="68" y="16" fill="#00d4aa" font-family="\'SF Mono\',\'Fira Code\',monospace" font-size="14" font-weight="700" letter-spacing="1.5">BREAKING</text>' +
            '<text x="182" y="16" fill="#8888aa" font-family="\'SF Mono\',\'Fira Code\',monospace" font-size="14" font-weight="400" letter-spacing="1.5">TRADES</text>' +
            '<path d="M60,24 L152,24 L162,20 L168,26 L176,10 L184,22 L188,18 L196,24 L256,24" fill="none" stroke="url(#v3-pulse-grad)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>' +
            '<circle cx="176" cy="10" r="1.8" fill="#ffd700" opacity="0.7"/>' +
          '</svg>' +
        '</a>' +
        '<nav class="v3-sidebar-body" role="navigation">' +
          NAV.map(renderSection).join('') +
        '</nav>' +
        '<div class="v3-sidebar-footer">' +
          '<button class="v3-sidebar-toggle" id="v3-sidebar-toggle" data-label="Expand sidebar" aria-expanded="true" aria-controls="v3-sidebar">' +
            '<span class="v3-nav-icon toggle-icon">' + ICON.collapse + '</span>' +
            '<span class="v3-sidebar-toggle-label">Collapse</span>' +
          '</button>' +
        '</div>' +
      '</aside>'
    );
  }

  function renderTopbar() {
    return (
      '<header class="v3-topbar">' +
        '<div class="v3-topbar-left">' +
          '<button class="v3-icon-btn v3-mobile-toggle" id="v3-mobile-toggle" aria-label="Open menu">' +
            ICON.menu +
          '</button>' +
          '<div class="v3-cmdbar" id="v3-cmdbar" role="search">' +
            '<svg width="14" height="14" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="5"/><path d="M12 12l4 4"/></svg>' +
            '<span>Search ticker, page…</span>' +
            '<kbd>⌘K</kbd>' +
          '</div>' +
        '</div>' +
        '<div class="v3-topbar-right">' +
          '<span class="v3-market-pill" id="market-status">' +
            // Market-status.js will replace this innerHTML when it loads. The default
            // structure mirrors what V3's CSS expects so the dot+label show on first paint.
            '<span class="market-dot"></span>' +
            '<span class="market-label">…</span>' +
          '</span>' +
          '<button class="v3-icon-btn v3-tape-toggle state-off" id="v3-tape-toggle" title="Toggle ticker strip">' +
            '<svg width="14" height="14" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M2 6h14M2 12h14"/></svg>' +
            '<span class="tape-state">OFF</span>' +
          '</button>' +
          '<select class="v3-icon-btn" id="v3-tz-picker" aria-label="Display timezone">' +
            '<option value="America/New_York">ET</option>' +
            '<option value="America/Chicago">CT</option>' +
            '<option value="America/Los_Angeles">PT</option>' +
            '<option value="Europe/London">GMT</option>' +
            '<option value="Asia/Jerusalem">IST</option>' +
            '<option value="Asia/Tokyo">JST</option>' +
            '<option value="UTC">UTC</option>' +
          '</select>' +
          '<div class="v3-account" title="Account">IS</div>' +
        '</div>' +
      '</header>'
    );
  }

  // ─── Freshness ─────────────────────────────────────────────────────────────
  function applyFreshState(route, state) {
    var item = document.querySelector('.v3-nav-item[data-route="' + route + '"] .v3-fresh-dot');
    if (!item) return;
    item.classList.remove('warn','stale','idle');
    if (state && state !== 'ok') item.classList.add(state);
  }

  function fetchFreshness() {
    fetch('data/freshness-manifest.json', { cache: 'no-store' })
      .then(function(r) { return r.ok ? r.json() : null; })
      .catch(function() { return null; })
      .then(function(manifest) {
        if (!manifest || !manifest.feeds) return;
        Object.keys(manifest.feeds).forEach(function(key) {
          var feed = manifest.feeds[key];
          var age = feed.age_seconds;
          var ttl = feed.ttl_seconds || 300;
          var state = 'ok';
          if (age == null) state = 'idle';
          else if (age >= ttl * 6) state = 'stale';
          else if (age >= ttl) state = 'warn';
          _freshState[key] = state;
          applyFreshState(key, state);
        });
      });
  }

  function startFreshnessPolling() {
    fetchFreshness();
    if (_freshPollTimer) clearInterval(_freshPollTimer);
    _freshPollTimer = setInterval(fetchFreshness, 60000);
  }

  // ─── Active route ──────────────────────────────────────────────────────────
  function setActive(route) {
    document.querySelectorAll('.v3-nav-item').forEach(function(el) {
      var isActive = el.dataset.route === route;
      el.classList.toggle('active', isActive);
      if (isActive) {
        el.setAttribute('aria-current', 'page');
      } else {
        el.removeAttribute('aria-current');
      }
    });
  }

  function getCurrentRoute() {
    var hash = (window.location.hash || '#market').replace(/^#/, '').split('?')[0];
    // Aliases — old routes redirect to new
    if (hash === 'week-ahead') return 'calendar';
    if (hash === 'events') return 'calendar';
    if (hash === 'autoresearch' || hash === 'auto-research') return 'research';
    return hash;
  }

  // ─── Sidebar collapse ──────────────────────────────────────────────────────
  function loadCollapsed() {
    try {
      return localStorage.getItem('v3:sidebar-collapsed') === '1';
    } catch (e) { return false; }
  }
  function saveCollapsed(collapsed) {
    try { localStorage.setItem('v3:sidebar-collapsed', collapsed ? '1' : '0'); } catch (e) {}
  }

  function toggleCollapse() {
    var collapsed = !document.body.classList.contains('sidebar-collapsed');
    document.body.classList.toggle('sidebar-collapsed', collapsed);
    saveCollapsed(collapsed);
    var btn = document.getElementById('v3-sidebar-toggle');
    if (btn) {
      btn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
      btn.dataset.label = collapsed ? 'Expand sidebar' : 'Collapse sidebar';
    }
  }

  function toggleMobile() {
    document.body.classList.toggle('sidebar-mobile-open');
  }

  // ─── Tape toggle (3-state) ─────────────────────────────────────────────────
  var TAPE_STATES = ['off', 'snapshot', 'tape'];
  function loadTapeState() {
    try { return localStorage.getItem('v3:tape-state') || 'off'; } catch(e) { return 'off'; }
  }
  function saveTapeState(s) {
    try { localStorage.setItem('v3:tape-state', s); } catch(e) {}
  }
  function setTapeState(state) {
    var btn = document.getElementById('v3-tape-toggle');
    if (!btn) return;
    btn.classList.remove('state-off','state-snapshot','state-tape');
    btn.classList.add('state-' + state);
    var lbl = btn.querySelector('.tape-state');
    if (lbl) lbl.textContent = state.toUpperCase();
    saveTapeState(state);
    // Hook actual mount/destroy of the strips here in real integration.
    // For preview, we just visualize the state change.
    var event = new CustomEvent('v3:tape-state-change', { detail: { state: state } });
    window.dispatchEvent(event);
  }
  function cycleTape() {
    var current = loadTapeState();
    var next = TAPE_STATES[(TAPE_STATES.indexOf(current) + 1) % TAPE_STATES.length];
    setTapeState(next);
  }

  // ─── Bind ──────────────────────────────────────────────────────────────────
  function bind() {
    document.getElementById('v3-sidebar-toggle')?.addEventListener('click', toggleCollapse);
    document.getElementById('v3-mobile-toggle')?.addEventListener('click', toggleMobile);
    document.getElementById('v3-tape-toggle')?.addEventListener('click', cycleTape);

    // Close mobile drawer when item clicked
    document.querySelectorAll('.v3-nav-item').forEach(function(item) {
      item.addEventListener('click', function() {
        if (window.innerWidth <= 768) {
          document.body.classList.remove('sidebar-mobile-open');
        }
      });
    });

    // Esc closes mobile drawer
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        document.body.classList.remove('sidebar-mobile-open');
      }
      // Cmd-K is handled by cmdbar.js (loaded separately). Don't double-bind here.
    });

    // Backdrop click closes drawer
    document.body.addEventListener('click', function(e) {
      if (document.body.classList.contains('sidebar-mobile-open')) {
        var sidebar = document.getElementById('v3-sidebar');
        var toggle = document.getElementById('v3-mobile-toggle');
        if (sidebar && !sidebar.contains(e.target) && toggle && !toggle.contains(e.target)) {
          document.body.classList.remove('sidebar-mobile-open');
        }
      }
    });

    // Hash change → update active item
    window.addEventListener('hashchange', function() {
      setActive(getCurrentRoute());
    });
  }

  function mount(root) {
    _root = root || document.body;
    document.body.classList.add('v3');
    if (loadCollapsed()) document.body.classList.add('sidebar-collapsed');

    // Restore tape state without dispatching event yet (will set up state)
    var tape = loadTapeState();

    // Find existing main element (could be <main id="content">, <main class="v3-main">, or just first <main>)
    // We RELOCATE it inside the new shell rather than cloning, so #content references stay valid.
    var existingMain = _root.querySelector('main#content') || _root.querySelector('.v3-main') || _root.querySelector('main');

    // If no main element exists, create a wrapper around any non-shell body content
    if (!existingMain) {
      existingMain = document.createElement('main');
      existingMain.className = 'v3-main';
      // Move all current direct children of root into the new main
      var bodyChildren = Array.from(_root.children).filter(function(el) {
        return !el.matches('.v3-shell, .v3-sidebar, .v3-topbar, script, style, link');
      });
      bodyChildren.forEach(function(c) { existingMain.appendChild(c); });
    } else {
      // Ensure the existing main has the v3-main class for our grid layout to apply
      existingMain.classList.add('v3-main');
    }

    // Build shell (sidebar + topbar) — main slot is placeholder, we'll move existingMain into it
    var shell = document.createElement('div');
    shell.className = 'v3-shell';
    shell.innerHTML = renderSidebar() + renderTopbar() + '<div data-v3-main-slot></div>';

    // Insert shell at the start of body, then swap the placeholder with the real main
    _root.insertBefore(shell, _root.firstChild);
    var slot = shell.querySelector('[data-v3-main-slot]');
    if (slot) {
      // Move (not clone) existingMain into shell, replacing the placeholder
      slot.parentNode.replaceChild(existingMain, slot);
    } else {
      shell.appendChild(existingMain);
    }

    setActive(getCurrentRoute());
    setTapeState(tape);
    bind();
    startFreshnessPolling();

    return function destroy() {
      if (_freshPollTimer) clearInterval(_freshPollTimer);
      shell.remove();
      document.body.classList.remove('v3', 'sidebar-collapsed', 'sidebar-mobile-open');
    };
  }

  window.V3Sidebar = {
    mount: mount,
    NAV: NAV,
    getCurrentRoute: getCurrentRoute,
    setActive: setActive
  };
})();
