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

  function ideaRow(s) {
    const d = s.direction || 'neutral';
    const col = DIR_COLOR[d] || '#94a3b8';
    const tg = (s.targets && s.targets.length) ? s.targets.map(esc).join(', ') : '—';
    const sym = s.ticker ? ((window.BT && BT.tickerLink) ? BT.tickerLink(s.ticker) : esc(s.ticker)) : '—';
    return `<tr>
      <td class="sd-tk">${sym}</td>
      <td><span class="sd-dir" style="background:${col}">${esc(d)}</span></td>
      <td class="sd-lvl">${esc(s.entry || '—')}</td>
      <td class="sd-lvl">${esc(tg)}</td>
      <td class="sd-lvl">${esc(s.stop || '—')}</td>
      <td class="sd-thesis">${esc((s.thesis || '').slice(0, 170))}</td>
      <td class="sd-muted">${esc(s.timeframe || '—')}</td>
    </tr>`;
  }

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
        ${byDesk[desk].slice(0, 40).map(ideaRow).join('')}
      </tbody></table>`).join('');
  }

  function renderWarnings(d) {
    const w = d.warnings || [];
    if (!w.length) return '<div class="ai-trader-empty">No warnings in the current window.</div>';
    return w.slice(0, 40).map(s => {
      const tk = s.ticker ? `<b>${esc(s.ticker)}</b> · ` : '';
      return `<div class="sd-warn"><div>${tk}${esc(s.thesis || s.context || '')}</div>
        <div class="sd-warn-src">${esc(s.desk || '')} · ${esc((s.published_at || '').slice(0, 10))}</div></div>`;
    }).join('');
  }

  function init() {
    fetch(DATA, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(d => {
        document.getElementById('sd-header').innerHTML = renderHeader(d);
        document.getElementById('sd-tickers').innerHTML = renderTickers(d);
        document.getElementById('sd-ideas').innerHTML = renderIdeas(d);
        document.getElementById('sd-warnings').innerHTML = renderWarnings(d);
        if (window.BT && BT.bindGlobalTooltips) BT.bindGlobalTooltips();
      })
      .catch(err => {
        const h = document.getElementById('sd-header');
        if (h) h.innerHTML = `<div class="ai-trader-empty">Signals desk data unavailable (${esc(err)}).</div>`;
      });
  }

  BT.pages['signals-desk'] = { render: render, init: init, destroy: function () {} };
})();
