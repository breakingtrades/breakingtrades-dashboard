/**
 * js/pages/signals-desk.js — Signals Desk: anonymized social-signal aggregate.
 *
 * Distinct from #signals (trade-setup cards). This page surfaces structured
 * signals + macro warnings harvested from anonymized "desks" (creator sources
 * are stripped to Desk N · type · platform — no names, no paid content).
 *
 * Reads: data/signals-desk.json (produced by scripts/export-signals-desk.py).
 */
(function () {
  if (!window.BT) window.BT = {};
  if (!BT.pages) BT.pages = {};

  const DATA = 'data/signals-desk.json';
  const DIR_COLOR = { bullish: '#22c55e', bearish: '#ef4444', hedge: '#f59e0b',
                      watching: '#818cf8', neutral: '#94a3b8' };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function render(container) {
    container.innerHTML = `
      <div class="ai-trader-page signals-desk-page">
        <div class="ai-trader-disclaimer" role="alert">
          <strong>⚠ Aggregated social commentary · educational use only · not investment advice.</strong>
          Signals are paraphrased from public market commentary across anonymized desks.
          Sources are de-identified; nothing here is a recommendation.
        </div>

        <div id="sd-header" class="ai-trader-header">
          <div class="ai-trader-loading">Loading signals desk…</div>
        </div>

        <div class="ai-trader-grid">
          <section class="ai-trader-section">
            <h3>🔥 Most-Mentioned Tickers</h3>
            <div id="sd-tickers"><div class="ai-trader-loading">Loading…</div></div>
          </section>

          <section class="ai-trader-section ai-picks-section">
            <h3>🎯 Ideas by Desk — Entry / Targets / Stop</h3>
            <div id="sd-ideas"><div class="ai-trader-loading">Loading ideas…</div></div>
          </section>

          <section class="ai-trader-section">
            <h3>⚠️ Warnings &amp; Macro Flags</h3>
            <div id="sd-warnings"><div class="ai-trader-loading">Loading warnings…</div></div>
          </section>
        </div>
      </div>`;
  }

  function renderHeader(d) {
    const s = d.stats || {};
    const gen = d.generated_at ? new Date(d.generated_at).toLocaleString() : '—';
    const tile = (v, l) => `<div class="ai-trader-tile"><div class="ai-trader-tile-value">${v}</div><div class="ai-trader-tile-label">${l}</div></div>`;
    return `<div class="ai-trader-tiles">
      ${tile(s.signals || 0, 'Signals')}
      ${tile(s.actionable || 0, 'Ideas')}
      ${tile(s.warnings || 0, 'Warnings')}
      ${tile(s.tickers || 0, 'Tickers')}
      ${tile(s.desks || 0, 'Desks')}
    </div><div class="ai-trader-tile-sub">Updated ${esc(gen)} · de-identified sources</div>`;
  }

  function renderTickers(d) {
    const t = d.top_tickers || [];
    if (!t.length) return '<div class="ai-trader-empty">No ticker signals yet.</div>';
    return '<div class="sd-chips">' + t.map(x => {
      const tone = x.bull > x.bear ? '#22c55e' : (x.bear > x.bull ? '#ef4444' : '#94a3b8');
      const sym = (window.BT && BT.tickerLink) ? BT.tickerLink(x.ticker) : esc(x.ticker);
      return `<span class="sd-chip"><b style="color:${tone}">${sym}</b><span class="sd-n">×${x.count}</span></span>`;
    }).join('') + '</div>';
  }

  function ideaRow(s, idx) {
    const d = s.direction || 'neutral';
    const col = DIR_COLOR[d] || '#94a3b8';
    const tg = (s.targets && s.targets.length) ? s.targets.map(esc).join(', ') : '—';
    const sym = s.ticker ? ((window.BT && BT.tickerLink) ? BT.tickerLink(s.ticker) : esc(s.ticker)) : '—';
    return `<tr class="sd-click" data-sig="${idx}" tabindex="0" role="button">
      <td class="sd-tk">${sym}</td>
      <td><span class="sd-dir" style="background:${col}">${esc(d)}</span></td>
      <td class="sd-lvl">${esc(s.entry || '—')}</td>
      <td class="sd-lvl">${esc(tg)}</td>
      <td class="sd-lvl">${esc(s.stop || '—')}</td>
      <td class="sd-thesis">${esc((s.thesis || '').slice(0, 170))}</td>
      <td class="sd-muted">${esc(s.timeframe || '—')}</td>
    </tr>`;
  }

  // flat index so a row click can find its full signal object
  let _all = [];

  function renderIdeas(d) {
    const ideas = d.signals || [];
    if (!ideas.length) return '<div class="ai-trader-empty">No ideas in the current window.</div>';
    const byDesk = {};
    ideas.forEach(s => { (byDesk[s.desk] = byDesk[s.desk] || []).push(s); });
    return Object.keys(byDesk).map(desk => `
      <div class="sd-desk-h">${esc(desk)}</div>
      <table class="sd-table"><thead><tr>
        <th>Ticker</th><th>Dir</th><th>Entry</th><th>Targets</th><th>Stop</th><th>Thesis</th><th>TF</th>
      </tr></thead><tbody>
        ${byDesk[desk].slice(0, 60).map(s => ideaRow(s, _all.indexOf(s))).join('')}
      </tbody></table>`).join('');
  }

  function renderWarnings(d) {
    const w = d.warnings || [];
    if (!w.length) return '<div class="ai-trader-empty">No warnings in the current window.</div>';
    return w.slice(0, 60).map(s => {
      const tk = s.ticker ? `<b>${esc(s.ticker)}</b> · ` : '';
      return `<div class="sd-warn sd-click" data-sig="${_all.indexOf(s)}" tabindex="0" role="button"><div>${tk}${esc(s.thesis || s.context || '')}</div>
        <div class="sd-warn-src">${esc(s.desk || '')} · ${esc((s.published_at || '').slice(0, 10))}</div></div>`;
    }).join('');
  }

  // ─── Detail modal (self-contained — social signals don't fit the ticker modal) ──
  function openModal(s) {
    if (!s) return;
    const d = s.direction || 'neutral';
    const col = DIR_COLOR[d] || '#94a3b8';
    const overlay = document.getElementById('detail-modal') || (function () {
      const el = document.createElement('div'); el.id = 'detail-modal';
      el.className = 'modal-overlay'; document.body.appendChild(el); return el;
    })();
    const row = (label, val) => val ? `<div class="sd-m-row"><span class="sd-m-k">${label}</span><span class="sd-m-v">${esc(val)}</span></div>` : '';
    const tg = (s.targets && s.targets.length) ? s.targets.map(esc).join(', ') : '';
    const tags = (s.tags && s.tags.length) ? s.tags.map(esc).join(' · ') : '';
    overlay.innerHTML = `
      <div class="signals-modal sd-modal">
        <div class="modal-header">
          <div class="ticker-info">
            <span class="modal-ticker">${esc(s.ticker || '—')}</span>
            <span class="sd-dir" style="background:${col}">${esc(d)}</span>
            <span class="modal-name">${esc(s.desk || '')} · ${esc(s.signal_type || '')}</span>
          </div>
          <button class="modal-close" id="sd-modal-close">✕</button>
        </div>
        <div class="modal-body sd-modal-body">
          <p class="sd-m-thesis">${esc(s.thesis || s.context || '')}</p>
          ${row('Entry', s.entry)}
          ${row('Targets', tg)}
          ${row('Stop', s.stop)}
          ${row('Timeframe', s.timeframe)}
          ${row('Conviction', s.conviction)}
          ${row('Catalyst', s.catalyst)}
          ${row('Where', s.source_section)}
          ${row('Tags', tags)}
          ${row('Published', (s.published_at || '').slice(0, 10))}
          <p class="sd-m-note">Aggregated social commentary · educational use only · not advice.</p>
        </div>
      </div>`;
    overlay.classList.add('open');
    const close = () => { overlay.classList.remove('open'); overlay.innerHTML = ''; };
    overlay.querySelector('#sd-modal-close').addEventListener('click', close);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    document.addEventListener('keydown', function esckey(e) {
      if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esckey); }
    });
  }

  function wireClicks(root) {
    root.addEventListener('click', e => {
      const el = e.target.closest('.sd-click');
      // let ticker-chip links do their own thing
      if (!el || e.target.closest('a')) return;
      const i = parseInt(el.getAttribute('data-sig'), 10);
      if (i >= 0 && _all[i]) openModal(_all[i]);
    });
    root.addEventListener('keydown', e => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const el = e.target.closest('.sd-click');
      if (!el) return;
      e.preventDefault();
      const i = parseInt(el.getAttribute('data-sig'), 10);
      if (i >= 0 && _all[i]) openModal(_all[i]);
    });
  }

  function init() {
    fetch(DATA, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(d => {
        _all = (d.signals || []).concat(d.warnings || []);
        document.getElementById('sd-header').innerHTML = renderHeader(d);
        document.getElementById('sd-tickers').innerHTML = renderTickers(d);
        document.getElementById('sd-ideas').innerHTML = renderIdeas(d);
        document.getElementById('sd-warnings').innerHTML = renderWarnings(d);
        const page = document.querySelector('.signals-desk-page');
        if (page) wireClicks(page);
        if (window.BT && BT.bindGlobalTooltips) BT.bindGlobalTooltips();
      })
      .catch(err => {
        const h = document.getElementById('sd-header');
        if (h) h.innerHTML = `<div class="ai-trader-empty">Signals desk data unavailable (${esc(err)}).</div>`;
      });
  }

  BT.pages['signals-desk'] = { render: render, init: init, destroy: function () {} };
})();
