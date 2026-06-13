/**
 * pages/calendar.js — Calendar page (Events + Week Ahead merged with sub-tabs)
 *
 * Registers as BT.pages.calendar with render(), init(), destroy().
 * Default sub-tab = 'events' (immediate forward-looking catalysts).
 * Sub-tab persisted in URL: #calendar?tab=events|week
 *
 * Internally delegates to BT.pages.events and BT.pages['week-ahead'].
 */
(function() {
  'use strict';

  var _activeTab = 'events';
  var _hostEl = null;

  function getTabFromHash() {
    var h = (location.hash || '').replace(/^#\/?/, '');
    var q = h.split('?')[1] || '';
    var m = q.match(/(?:^|&)tab=([^&]+)/);
    if (m && (m[1] === 'events' || m[1] === 'week')) return m[1];
    return 'events';
  }

  function setTabHash(tab) {
    var route = (location.hash.replace(/^#\/?/, '').split('?')[0]) || 'calendar';
    var newHash = '#' + route + (tab !== 'events' ? '?tab=' + tab : '');
    if (location.hash !== newHash) {
      history.replaceState(null, '', newHash);
    }
  }

  function renderTabBar(active) {
    return (
      '<div class="cal-tabbar">' +
        '<button class="cal-tab' + (active === 'events' ? ' active' : '') + '" data-tab="events">Events &amp; Catalysts</button>' +
        '<button class="cal-tab' + (active === 'week' ? ' active' : '') + '" data-tab="week">Week Ahead</button>' +
      '</div>'
    );
  }

  function injectStyles() {
    if (document.getElementById('cal-tab-styles')) return;
    var s = document.createElement('style');
    s.id = 'cal-tab-styles';
    s.textContent =
      '.cal-tabbar { display: flex; gap: 4px; padding: 0 0 12px; border-bottom: 1px solid var(--v3-border-soft, var(--border)); margin-bottom: 16px; }' +
      '.cal-tab { background: transparent; border: 0; color: var(--text-dim); padding: 8px 14px; font-size: 13px; font-weight: 600; letter-spacing: 0.4px; cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -1px; transition: color 120ms ease, border-color 120ms ease; }' +
      '.cal-tab:hover { color: var(--text); }' +
      '.cal-tab.active { color: var(--v3-cyan, var(--cyan)); border-bottom-color: var(--v3-cyan, var(--cyan)); }' +
      '#cal-content { min-height: 200px; }';
    document.head.appendChild(s);
  }

  function loadDelegate(tab, cb) {
    // tab → page module on the global BT registry
    var moduleKey = tab === 'events' ? 'events' : 'week-ahead';
    var page = BT.pages[moduleKey];
    if (page) return cb(page);

    // Lazy-load JS file if not yet loaded
    var src = 'js/pages/' + moduleKey + '.js';
    var s = document.createElement('script');
    s.src = src;
    s.onload = function() { cb(BT.pages[moduleKey]); };
    s.onerror = function() { cb(null); };
    document.body.appendChild(s);

    // Also load corresponding CSS
    var cssSrc = 'css/' + moduleKey + '.css';
    if (!document.querySelector('link[href="' + cssSrc + '"]')) {
      var l = document.createElement('link');
      l.rel = 'stylesheet';
      l.href = cssSrc;
      document.head.appendChild(l);
    }
  }

  function renderTab(tab) {
    var contentEl = document.getElementById('cal-content');
    if (!contentEl) return;

    // Destroy previous tab if it had a destroy hook
    var prevKey = _activeTab === 'events' ? 'events' : 'week-ahead';
    if (_activeTab !== tab && BT.pages[prevKey] && BT.pages[prevKey].destroy) {
      try { BT.pages[prevKey].destroy(); } catch(e) { console.warn('[calendar] prev destroy', e); }
    }

    _activeTab = tab;
    setTabHash(tab);

    // Update tab-bar active class
    document.querySelectorAll('.cal-tab').forEach(function(b) {
      b.classList.toggle('active', b.dataset.tab === tab);
    });

    contentEl.innerHTML = '<div style="padding:40px; color: var(--text-dim); text-align:center;">Loading…</div>';

    loadDelegate(tab, function(page) {
      if (!page) {
        contentEl.innerHTML = '<div style="padding:40px; color: var(--red); text-align:center;">Failed to load ' + tab + ' module.</div>';
        return;
      }
      // Page modules expect to render into a fresh element. Give them cal-content directly.
      contentEl.innerHTML = '';
      try {
        if (page.render) page.render(contentEl);
        if (page.init) page.init();
      } catch(e) {
        console.error('[calendar] render error', e);
        contentEl.innerHTML = '<div style="padding:40px; color: var(--red); text-align:center;">Render failed: ' + (e.message || e) + '</div>';
      }
    });
  }

  function bindTabs() {
    document.querySelectorAll('.cal-tab').forEach(function(btn) {
      btn.addEventListener('click', function() {
        renderTab(btn.dataset.tab);
      });
    });
  }

  BT.pages = BT.pages || {};
  BT.pages.calendar = {
    render: function(el) {
      _hostEl = el;
      injectStyles();
      var tab = getTabFromHash();
      el.innerHTML =
        '<div class="cal-page" style="padding: 20px 4px;">' +
          '<div style="display:flex;align-items:baseline;justify-content:space-between;margin-bottom:8px;">' +
            '<h1 style="margin:0;font-size:22px;font-weight:700;color:var(--text-bright);">Calendar</h1>' +
            '<span style="font-size:11px;color:var(--text-dim);font-family:var(--font-mono);">Events · Macro · Earnings · Fed</span>' +
          '</div>' +
          renderTabBar(tab) +
          '<div id="cal-content"></div>' +
        '</div>';
      bindTabs();
      renderTab(tab);
    },
    init: function() {},
    destroy: function() {
      var key = _activeTab === 'events' ? 'events' : 'week-ahead';
      if (BT.pages[key] && BT.pages[key].destroy) {
        try { BT.pages[key].destroy(); } catch(e) {}
      }
    }
  };
})();
