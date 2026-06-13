/**
 * js/lib/cmdbar.js — Cmd-K command palette for V3.
 *
 * Opens via Cmd/Ctrl-K or click on the topbar search.
 * Indexes: page routes, ticker symbols (from data/watchlist.json),
 * common actions (toggle sidebar, toggle tape, switch tz).
 */
(function() {
  'use strict';

  var _isOpen = false;
  var _items = [];
  var _filtered = [];
  var _selectedIdx = 0;
  var _modalEl = null;
  var _inputEl = null;
  var _listEl = null;

  // Static items — pages + actions
  var STATIC_ITEMS = [
    // Pages
    { type: 'page', label: 'Market',         hash: '#market',         icon: '▤' },
    { type: 'page', label: 'Watchlist',      hash: '#watchlist',      icon: '▥' },
    { type: 'page', label: 'Signals',        hash: '#signals',        icon: '▦' },
    { type: 'page', label: 'Expected Moves', hash: '#expected-moves', icon: '⇔' },
    { type: 'page', label: 'Calendar',       hash: '#calendar',       icon: '📅' },
    { type: 'page', label: 'Research',       hash: '#research',       icon: '⌕' },
    { type: 'page', label: 'AI-Trader',      hash: '#ai-trader',      icon: '🤖' },
    { type: 'page', label: 'Holdings',       hash: '#holdings',       icon: '💼' },
    { type: 'page', label: 'Alerts',         hash: '#alerts',         icon: '🔔' },
    { type: 'page', label: 'Settings',       hash: '#settings',       icon: '⚙' },
    { type: 'page', label: 'About',          hash: '#about',          icon: 'ⓘ' },
    // Actions
    { type: 'action', label: 'Toggle sidebar collapse', icon: '⇋', action: 'toggle-sidebar' },
    { type: 'action', label: 'Cycle ticker tape (off → snapshot → tape)', icon: '↻', action: 'cycle-tape' },
  ];

  function loadTickers() {
    fetch('data/watchlist.json').then(function(r) {
      return r.ok ? r.json() : null;
    }).then(function(data) {
      if (!data) return;
      var items = (data.items || data.symbols || data || []);
      if (!Array.isArray(items)) return;
      var seen = {};
      items.forEach(function(t) {
        var sym = t.symbol || t.sym || t.ticker;
        if (!sym || seen[sym]) return;
        seen[sym] = true;
        _items.push({
          type: 'ticker',
          label: sym,
          subtitle: t.name || t.company || '',
          hash: '#watchlist?ticker=' + sym,
          icon: '$'
        });
      });
    }).catch(function() {});
  }

  function injectStyles() {
    if (document.getElementById('v3-cmdbar-styles')) return;
    var s = document.createElement('style');
    s.id = 'v3-cmdbar-styles';
    s.textContent = [
      '.v3-cmdpal-overlay {',
      '  position: fixed; inset: 0;',
      '  background: rgba(0, 0, 0, 0.55);',
      '  backdrop-filter: blur(4px);',
      '  z-index: 1000;',
      '  display: none;',
      '  align-items: flex-start;',
      '  justify-content: center;',
      '  padding-top: 12vh;',
      '}',
      '.v3-cmdpal-overlay.open { display: flex; }',
      '.v3-cmdpal {',
      '  width: 100%;',
      '  max-width: 560px;',
      '  background: var(--v3-bg-surface, #0e0e18);',
      '  border: 1px solid var(--v3-border-mid, rgba(255,255,255,0.10));',
      '  border-radius: 10px;',
      '  box-shadow: 0 12px 48px rgba(0,0,0,0.6);',
      '  overflow: hidden;',
      '  display: flex; flex-direction: column;',
      '  max-height: 70vh;',
      '}',
      '.v3-cmdpal-input-wrap {',
      '  padding: 14px 16px;',
      '  border-bottom: 1px solid var(--v3-border-soft, rgba(255,255,255,0.06));',
      '  display: flex; align-items: center; gap: 10px;',
      '}',
      '.v3-cmdpal-input-wrap svg { color: var(--text-dim); flex-shrink: 0; }',
      '.v3-cmdpal-input {',
      '  flex: 1;',
      '  background: transparent;',
      '  border: 0;',
      '  outline: 0;',
      '  color: var(--text-bright);',
      '  font-size: 16px;',
      '  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;',
      '}',
      '.v3-cmdpal-input::placeholder { color: var(--text-dim); }',
      '.v3-cmdpal-list {',
      '  overflow-y: auto;',
      '  flex: 1;',
      '  padding: 6px 0;',
      '  scrollbar-width: thin;',
      '}',
      '.v3-cmdpal-item {',
      '  display: flex;',
      '  align-items: center;',
      '  gap: 12px;',
      '  padding: 10px 16px;',
      '  cursor: pointer;',
      '  font-size: 13px;',
      '  color: var(--text);',
      '  transition: background 80ms ease;',
      '}',
      '.v3-cmdpal-item.selected,',
      '.v3-cmdpal-item:hover {',
      '  background: var(--v3-bg-elevated, #15152a);',
      '}',
      '.v3-cmdpal-icon {',
      '  width: 24px;',
      '  text-align: center;',
      '  color: var(--v3-cyan, #2DD4BF);',
      '  font-size: 13px;',
      '  flex-shrink: 0;',
      '}',
      '.v3-cmdpal-label { flex: 1; min-width: 0; }',
      '.v3-cmdpal-label .ticker-sym { font-family: var(--font-mono, monospace); font-weight: 700; }',
      '.v3-cmdpal-subtitle {',
      '  color: var(--text-dim);',
      '  font-size: 11px;',
      '  margin-top: 2px;',
      '  overflow: hidden;',
      '  text-overflow: ellipsis;',
      '  white-space: nowrap;',
      '}',
      '.v3-cmdpal-tag {',
      '  font-size: 9px;',
      '  text-transform: uppercase;',
      '  letter-spacing: 0.5px;',
      '  padding: 2px 6px;',
      '  border-radius: 3px;',
      '  background: rgba(255,255,255,0.06);',
      '  color: var(--text-dim);',
      '  flex-shrink: 0;',
      '}',
      '.v3-cmdpal-tag.page { color: var(--v3-cyan); background: rgba(45,212,191,0.12); }',
      '.v3-cmdpal-tag.action { color: var(--v3-fresh-warn); background: rgba(245,158,11,0.12); }',
      '.v3-cmdpal-tag.ticker { color: #ab47bc; background: rgba(171,71,188,0.12); }',
      '.v3-cmdpal-empty {',
      '  padding: 32px 16px;',
      '  text-align: center;',
      '  color: var(--text-dim);',
      '  font-size: 13px;',
      '}',
      '.v3-cmdpal-footer {',
      '  border-top: 1px solid var(--v3-border-soft);',
      '  padding: 8px 16px;',
      '  display: flex; gap: 14px;',
      '  font-size: 10px;',
      '  color: var(--text-dim);',
      '}',
      '.v3-cmdpal-footer kbd {',
      '  font-family: var(--font-mono, monospace);',
      '  font-size: 9px;',
      '  background: var(--v3-bg-elevated);',
      '  border: 1px solid var(--v3-border-soft);',
      '  border-radius: 3px;',
      '  padding: 1px 4px;',
      '  margin-right: 3px;',
      '}',
    ].join('\n');
    document.head.appendChild(s);
  }

  function buildModal() {
    if (_modalEl) return;
    injectStyles();
    var wrap = document.createElement('div');
    wrap.className = 'v3-cmdpal-overlay';
    wrap.innerHTML = [
      '<div class="v3-cmdpal" role="dialog" aria-label="Command palette">',
      '  <div class="v3-cmdpal-input-wrap">',
      '    <svg width="16" height="16" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="8" cy="8" r="5"/><path d="M12 12l4 4"/></svg>',
      '    <input type="text" class="v3-cmdpal-input" placeholder="Search pages, tickers, actions…" autocomplete="off" spellcheck="false"/>',
      '  </div>',
      '  <div class="v3-cmdpal-list"></div>',
      '  <div class="v3-cmdpal-footer">',
      '    <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>',
      '    <span><kbd>↵</kbd> select</span>',
      '    <span><kbd>esc</kbd> close</span>',
      '  </div>',
      '</div>'
    ].join('');
    document.body.appendChild(wrap);
    _modalEl = wrap;
    _inputEl = wrap.querySelector('.v3-cmdpal-input');
    _listEl = wrap.querySelector('.v3-cmdpal-list');

    // Click backdrop to close
    wrap.addEventListener('click', function(e) {
      if (e.target === wrap) close();
    });
    _inputEl.addEventListener('input', function() { filter(_inputEl.value); });
    _inputEl.addEventListener('keydown', function(e) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        _selectedIdx = Math.min(_filtered.length - 1, _selectedIdx + 1);
        renderList();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        _selectedIdx = Math.max(0, _selectedIdx - 1);
        renderList();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        var item = _filtered[_selectedIdx];
        if (item) execute(item);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        close();
      }
    });
  }

  function fuzzyScore(query, text) {
    if (!query) return 1;
    query = query.toLowerCase();
    text = (text || '').toLowerCase();
    if (text === query) return 100;
    if (text.indexOf(query) === 0) return 50;       // prefix
    if (text.indexOf(query) >= 0) return 25;        // substring
    // Subsequence match (e.g. "wch" matches "watchlist")
    var qi = 0;
    for (var i = 0; i < text.length && qi < query.length; i++) {
      if (text[i] === query[qi]) qi++;
    }
    return qi === query.length ? 5 : 0;
  }

  function filter(q) {
    var all = STATIC_ITEMS.concat(_items);
    _filtered = all
      .map(function(item) {
        var score = Math.max(
          fuzzyScore(q, item.label),
          fuzzyScore(q, item.subtitle || '') * 0.5
        );
        return { item: item, score: score };
      })
      .filter(function(x) { return x.score > 0; })
      .sort(function(a, b) {
        // Pages > tickers > actions when scores tied
        if (b.score !== a.score) return b.score - a.score;
        var typeRank = { page: 3, ticker: 2, action: 1 };
        return (typeRank[b.item.type] || 0) - (typeRank[a.item.type] || 0);
      })
      .slice(0, 50)
      .map(function(x) { return x.item; });
    _selectedIdx = 0;
    renderList();
  }

  function renderList() {
    if (!_listEl) return;
    if (!_filtered.length) {
      _listEl.innerHTML = '<div class="v3-cmdpal-empty">No matches</div>';
      return;
    }
    var html = _filtered.map(function(item, i) {
      var sub = item.subtitle ? '<div class="v3-cmdpal-subtitle">' + item.subtitle + '</div>' : '';
      var labelInner = item.type === 'ticker'
        ? '<span class="ticker-sym">' + item.label + '</span>' + sub
        : '<div>' + item.label + '</div>' + sub;
      var tagClass = item.type;
      var tag = '<span class="v3-cmdpal-tag ' + tagClass + '">' + (item.type === 'page' ? 'go' : item.type === 'ticker' ? 'ticker' : 'do') + '</span>';
      return (
        '<div class="v3-cmdpal-item' + (i === _selectedIdx ? ' selected' : '') + '" data-idx="' + i + '">' +
          '<div class="v3-cmdpal-icon">' + (item.icon || '·') + '</div>' +
          '<div class="v3-cmdpal-label">' + labelInner + '</div>' +
          tag +
        '</div>'
      );
    }).join('');
    _listEl.innerHTML = html;
    _listEl.querySelectorAll('.v3-cmdpal-item').forEach(function(el) {
      el.addEventListener('click', function() {
        _selectedIdx = parseInt(el.dataset.idx, 10);
        var item = _filtered[_selectedIdx];
        if (item) execute(item);
      });
    });
    // Scroll selected into view
    var sel = _listEl.querySelector('.v3-cmdpal-item.selected');
    if (sel) sel.scrollIntoView({ block: 'nearest' });
  }

  function execute(item) {
    if (item.hash) {
      location.hash = item.hash;
      close();
      return;
    }
    if (item.action === 'toggle-sidebar') {
      var btn = document.getElementById('v3-sidebar-toggle');
      if (btn) btn.click();
    } else if (item.action === 'cycle-tape') {
      var t = document.getElementById('v3-tape-toggle');
      if (t) t.click();
    }
    close();
  }

  function open() {
    buildModal();
    if (_isOpen) return;
    _isOpen = true;
    _modalEl.classList.add('open');
    _inputEl.value = '';
    filter('');
    setTimeout(function() { _inputEl.focus(); }, 50);
  }
  function close() {
    if (!_isOpen) return;
    _isOpen = false;
    if (_modalEl) _modalEl.classList.remove('open');
  }

  function bind() {
    document.addEventListener('keydown', function(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        open();
        return;
      }
      if (e.key === '/' && document.activeElement === document.body) {
        e.preventDefault();
        open();
      }
    });
    // Click cmdbar in topbar
    var observer = new MutationObserver(function() {
      var bar = document.getElementById('v3-cmdbar');
      if (bar && !bar.dataset.cmdbarBound) {
        bar.dataset.cmdbarBound = '1';
        bar.addEventListener('click', open);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  // Init
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { bind(); loadTickers(); });
  } else {
    bind();
    loadTickers();
  }

  window.V3CmdBar = { open: open, close: close };
})();
