/**
 * ticker-search.js — Global ticker search with tracked/external routing
 * Tracked tickers → openDetail() (enriched data)
 * External tickers → TradingView widget overlay
 */
function initTickerSearch() {
  const input = document.getElementById('ticker-search');
  const dropdown = document.getElementById('search-results');
  if (!input || !dropdown) return;

  let activeIdx = -1;
  let items = [];

  // StockAnalysis.com symbol search (free, CORS-enabled, no API key)
  async function symbolSearch(q) {
    try {
      const url = `https://stockanalysis.com/api/search?q=${encodeURIComponent(q)}`;
      const r = await fetch(url);
      if (!r.ok) return [];
      const json = await r.json();
      if (!json.data) return [];
      return json.data
        .filter(d => d.t === 's' || d.t === 'e') // stocks + ETFs only
        .slice(0, 8)
        .map(d => ({ symbol: d.s, shortname: d.n }));
    } catch { return []; }
  }

  function isTracked(sym) {
    return typeof TICKERS !== 'undefined' && TICKERS.find(t => t.symbol === sym);
  }

  function renderDropdown(results, query) {
    if (!results.length && query.length >= 1) {
      dropdown.innerHTML = `<div class="search-hint">No results for "${query}"</div>`;
      dropdown.classList.add('open');
      return;
    }
    if (!results.length) { dropdown.classList.remove('open'); return; }

    items = results;
    activeIdx = -1;
    dropdown.innerHTML = results.map((r, i) => {
      const sym = r.symbol || r;
      const name = r.shortname || r.longname || r.name || '';
      const tracked = isTracked(sym);
      const badge = tracked
        ? `<span class="si-badge si-tracked">TRACKED</span>`
        : `<span class="si-badge si-ext">TV</span>`;
      return `<div class="search-item" data-idx="${i}" data-symbol="${sym}" data-tracked="${tracked ? 1 : 0}">
        <div class="si-left">
          <span class="si-sym">${sym}</span>
          <span class="si-name">${name}</span>
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          ${badge}
        </div>
      </div>`;
    }).join('');
    dropdown.classList.add('open');
  }

  function selectItem(sym, tracked) {
    input.value = '';
    dropdown.classList.remove('open');
    if (tracked && typeof openDetail === 'function') {
      openDetail(sym);
    } else {
      openTVDetail(sym);
    }
  }

  // TradingView-only detail overlay for external tickers
  function openTVDetail(symbol) {
    const clean = symbol.replace(/[^A-Z0-9._\-]/gi, '');
    const modal = document.getElementById('modal');
    if (!modal) return;

    document.getElementById('modal-ticker').textContent = clean;
    document.getElementById('modal-name').textContent = 'External Ticker · TradingView Data';
    document.getElementById('modal-price').innerHTML = '<span style="color:var(--text-dim)">Loading...</span>';
    document.getElementById('modal-status-badge').outerHTML = `<span class="status-badge" id="modal-status-badge" style="background:rgba(255,167,38,0.15);color:var(--orange);">EXTERNAL</span>`;
    document.getElementById('modal-bias-badge').outerHTML = `<span class="bias-badge" id="modal-bias-badge" style="background:rgba(255,167,38,0.1);color:var(--orange);">TV</span>`;

    // TradingView resolves symbols itself — no exchange prefix needed
    const tvSymbol = clean;

    document.getElementById('modal-body').innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;">
        <div class="chart-box" style="position:relative;">
          <div class="chart-label">Daily Chart <button class="tv-fullscreen-btn" data-target="tv-ext-daily" title="Fullscreen">⛶</button></div>
          <div id="tv-ext-daily" style="height:450px;width:100%;overflow:hidden;"></div>
        </div>
        <div class="chart-box" style="position:relative;">
          <div class="chart-label">Weekly Chart <button class="tv-fullscreen-btn" data-target="tv-ext-weekly" title="Fullscreen">⛶</button></div>
          <div id="tv-ext-weekly" style="height:450px;width:100%;overflow:hidden;"></div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-bottom:16px;">
        <div class="ta-widget-box">
          <div class="ta-widget-label">Technical Analysis</div>
          <div id="tv-ext-ta" style="height:300px;"></div>
        </div>
        <div class="ta-widget-box">
          <div class="ta-widget-label">Company Profile</div>
          <div id="tv-ext-profile" style="height:300px;"></div>
        </div>
        <div class="ta-widget-box">
          <div class="ta-widget-label">Financials</div>
          <div id="tv-ext-financials" style="height:300px;"></div>
        </div>
      </div>
      <div style="text-align:center;padding:12px;color:var(--text-dim);font-size:11px;">
        Data provided by TradingView · <a href="https://www.tradingview.com/symbols/${tvSymbol}/" target="_blank" style="color:var(--cyan);">Open on TradingView ↗</a>
      </div>
    `;

    // Fullscreen toggle for chart boxes
    document.querySelectorAll('.tv-fullscreen-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const container = document.getElementById(btn.dataset.target);
        if (!container) return;
        const box = container.closest('.chart-box');
        if (box.classList.contains('tv-fullscreen')) {
          box.classList.remove('tv-fullscreen');
          container.style.height = '450px';
          btn.textContent = '⛶';
        } else {
          box.classList.add('tv-fullscreen');
          container.style.height = '100%';
          btn.textContent = '✕';
        }
      });
    });

    // Escape exits fullscreen chart
    const fsHandler = (e) => {
      if (e.key === 'Escape') {
        const fs = document.querySelector('.chart-box.tv-fullscreen');
        if (fs) {
          e.stopPropagation();
          fs.classList.remove('tv-fullscreen');
          const cont = fs.querySelector('[id^="tv-ext-"]');
          if (cont) cont.style.height = '450px';
          const btn = fs.querySelector('.tv-fullscreen-btn');
          if (btn) btn.textContent = '⛶';
        }
      }
    };
    document.addEventListener('keydown', fsHandler);

    modal.classList.add('open');

    setTimeout(() => {
      loadTVChart('tv-ext-daily', '', tvSymbol, 'D');
      loadTVChart('tv-ext-weekly', '', tvSymbol, 'W');
      loadTVTechnical('tv-ext-ta', '', tvSymbol);
      loadTVProfile('tv-ext-profile', '', tvSymbol);
      loadTVFinancials('tv-ext-financials', '', tvSymbol);
    }, 100);
  }

  function getExchangeForSearch(sym) {
    if (typeof getExchange === 'function') return getExchange(sym);
    // Fallback exchange detection
    if (sym.includes('-USD') || sym.includes('BTC') || sym.includes('ETH')) return 'CRYPTO';
    return 'NASDAQ';
  }

  function loadTVChart(containerId, exchange, symbol, interval) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = '';
    const tvSym = exchange ? `${exchange}:${symbol}` : symbol;
    const w = document.createElement('div');
    w.className = 'tradingview-widget-container';
    w.innerHTML = `<div class="tradingview-widget-container__widget"></div>`;
    el.appendChild(w);
    const s = document.createElement('script');
    s.type = 'text/javascript';
    s.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    s.async = true;
    s.textContent = JSON.stringify({
      autosize: true,
      symbol: tvSym,
      interval: interval,
      timezone: "America/New_York",
      theme: "dark",
      style: "1",
      locale: "en",
      backgroundColor: "#0a0a12",
      gridColor: "#1e1e3a",
      hide_top_toolbar: false,
      hide_legend: false,
      save_image: false,
      studies: ["MASimple@tv-basicstudies|20", "MASimple@tv-basicstudies|50"],
      support_host: "https://www.tradingview.com"
    });
    w.appendChild(s);
  }

  function loadTVTechnical(containerId, exchange, symbol) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = '';
    const w = document.createElement('div');
    w.className = 'tradingview-widget-container';
    w.innerHTML = `<div class="tradingview-widget-container__widget"></div>`;
    el.appendChild(w);
    const s = document.createElement('script');
    s.type = 'text/javascript';
    s.src = 'https://s3.tradingview.com/external-embedding/embed-widget-technical-analysis.js';
    s.async = true;
    s.textContent = JSON.stringify({
      interval: "1D",
      width: "100%",
      isTransparent: true,
      height: "100%",
      symbol: exchange ? `${exchange}:${symbol}` : symbol,
      showIntervalTabs: true,
      displayMode: "single",
      locale: "en",
      colorTheme: "dark"
    });
    w.appendChild(s);
  }

  function loadTVProfile(containerId, exchange, symbol) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = '';
    const w = document.createElement('div');
    w.className = 'tradingview-widget-container';
    w.innerHTML = `<div class="tradingview-widget-container__widget"></div>`;
    el.appendChild(w);
    const s = document.createElement('script');
    s.type = 'text/javascript';
    s.src = 'https://s3.tradingview.com/external-embedding/embed-widget-symbol-profile.js';
    s.async = true;
    s.textContent = JSON.stringify({
      width: "100%",
      height: "100%",
      isTransparent: true,
      symbol: exchange ? `${exchange}:${symbol}` : symbol,
      colorTheme: "dark",
      locale: "en"
    });
    w.appendChild(s);
  }

  function loadTVFinancials(containerId, exchange, symbol) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = '';
    const w = document.createElement('div');
    w.className = 'tradingview-widget-container';
    w.innerHTML = `<div class="tradingview-widget-container__widget"></div>`;
    el.appendChild(w);
    const s = document.createElement('script');
    s.type = 'text/javascript';
    s.src = 'https://s3.tradingview.com/external-embedding/embed-widget-financials.js';
    s.async = true;
    s.textContent = JSON.stringify({
      isTransparent: true,
      largeChartUrl: "",
      displayMode: "regular",
      width: "100%",
      height: "100%",
      symbol: exchange ? `${exchange}:${symbol}` : symbol,
      colorTheme: "dark",
      locale: "en"
    });
    w.appendChild(s);
  }

  // Debounced search
  let debounce = null;
  input.addEventListener('input', () => {
    clearTimeout(debounce);
    const q = input.value.trim().toUpperCase();
    if (q.length === 0) { dropdown.classList.remove('open'); return; }

    // Instant local match
    const local = (typeof TICKERS !== 'undefined' ? TICKERS : [])
      .filter(t => t.symbol.startsWith(q) || (t.name && t.name.toUpperCase().includes(q)))
      .slice(0, 4)
      .map(t => ({ symbol: t.symbol, shortname: t.name, _tracked: true }));

    if (local.length) renderDropdown(local, q);

    // Remote search after 300ms
    debounce = setTimeout(async () => {
      const remote = await symbolSearch(q);
      // Merge: local first, then remote (deduped)
      const seen = new Set(local.map(l => l.symbol));
      const merged = [...local, ...remote.filter(r => !seen.has(r.symbol))].slice(0, 8);
      renderDropdown(merged, q);
    }, 300);
  });

  // Keyboard navigation
  input.addEventListener('keydown', (e) => {
    const open = dropdown.classList.contains('open');
    if (!open && e.key !== 'Escape') return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeIdx = Math.min(activeIdx + 1, items.length - 1);
      updateActive();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeIdx = Math.max(activeIdx - 1, 0);
      updateActive();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIdx >= 0 && items[activeIdx]) {
        const sym = items[activeIdx].symbol;
        selectItem(sym, !!isTracked(sym));
      } else {
        // Direct ticker entry
        const q = input.value.trim().toUpperCase();
        if (q) selectItem(q, !!isTracked(q));
      }
    } else if (e.key === 'Escape') {
      dropdown.classList.remove('open');
      input.blur();
    }
  });

  function updateActive() {
    dropdown.querySelectorAll('.search-item').forEach((el, i) => {
      el.classList.toggle('active', i === activeIdx);
    });
  }

  // Click handler
  dropdown.addEventListener('click', (e) => {
    const item = e.target.closest('.search-item');
    if (!item) return;
    const sym = item.dataset.symbol;
    selectItem(sym, item.dataset.tracked === '1');
  });

  // Close on outside click
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.nav-search-wrap')) dropdown.classList.remove('open');
  });

  // Keyboard shortcut: / to focus search
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && !e.ctrlKey && !e.metaKey && document.activeElement !== input && !document.activeElement.closest('input,textarea')) {
      e.preventDefault();
      input.focus();
    }
  });
}
