/**
 * js/pages/ai-trader.js — AI-Trader Tom dashboard page (Phase 3).
 *
 * Reads (from data/ai-trader/):
 *   track-record.json — equity curve, summary, by_rule, by_direction, open_positions
 *   holdings.json     — current open positions (cash + positions[])
 *   risk-state.json   — drawdown banner state, cooldowns, sector exposure
 *   last-run.json     — pipeline status (ok / failed / which stage)
 *
 * Renders:
 *   - Disclaimer chrome (per spec MUST: "Paper trades · educational use only")
 *   - Header: current equity, day/week/all-time P&L, win rate, drawdown
 *   - Drawdown pause banner (when entries_paused_until in the future)
 *   - Equity curve sparkline
 *   - Open positions table (clickable → detail modal with Tom's reasoning)
 *   - Recent closes (last 10 trades with P&L attribution)
 *   - Per-rule attribution table (which rules paid off)
 *   - Per-direction summary (long vs short)
 */
(function() {
  if (!window.BT) window.BT = {};
  if (!BT.pages) BT.pages = {};

  const DATA_PATHS = {
    trackRecord: 'data/ai-trader/track-record.json',
    holdings:    'data/ai-trader/holdings.json',
    riskState:   'data/ai-trader/risk-state.json',
    lastRun:     'data/ai-trader/last-run.json',
  };

  // ─── Render shell ────────────────────────────────────────────────────────
  function render(container) {
    container.innerHTML = `
      <div class="ai-trader-page">
        <div class="ai-trader-disclaimer" role="alert">
          <strong>⚠ Paper trades · educational use only · not investment advice · not real money.</strong>
          AI-Trader Tom is a transparent paper-trading simulator. All trades shown here are
          simulated against historical rules and live market data. No real capital is deployed.
        </div>

        <div id="ai-trader-banner" class="ai-trader-banner" style="display:none;"></div>

        <div id="ai-trader-header" class="ai-trader-header">
          <div class="ai-trader-loading">Loading AI-Trader Tom data…</div>
        </div>

        <div class="ai-trader-grid">
          <section class="ai-trader-section">
            <h3>Equity Curve</h3>
            <div id="ai-trader-equity-curve" class="ai-trader-equity-curve"></div>
          </section>

          <section class="ai-trader-section">
            <h3>Open Positions</h3>
            <div id="ai-trader-open-positions"></div>
          </section>

          <section class="ai-trader-section">
            <h3>Recent Closes</h3>
            <div id="ai-trader-recent-closes"></div>
          </section>

          <section class="ai-trader-section">
            <h3>Rule Attribution</h3>
            <div id="ai-trader-rule-attribution"></div>
          </section>

          <section class="ai-trader-section">
            <h3>Long vs Short</h3>
            <div id="ai-trader-by-direction"></div>
          </section>

          <section class="ai-trader-section">
            <h3>Pipeline Status</h3>
            <div id="ai-trader-pipeline-status"></div>
          </section>
        </div>
      </div>
    `;
  }

  // ─── Number formatters ──────────────────────────────────────────────────
  function fmtCurrency(v) {
    if (v == null) return '—';
    const sign = v < 0 ? '-' : '';
    return sign + '$' + Math.abs(v).toLocaleString(undefined, {
      minimumFractionDigits: 2, maximumFractionDigits: 2
    });
  }
  function fmtPct(v, digits) {
    if (v == null) return '—';
    return (v * 100).toFixed(digits != null ? digits : 1) + '%';
  }
  function fmtSigned(v, kind) {
    if (v == null) return '—';
    const cls = v >= 0 ? 'pos' : 'neg';
    const formatted = kind === 'currency' ? fmtCurrency(v) : fmtPct(v);
    return `<span class="ai-trader-${cls}">${formatted}</span>`;
  }

  // ─── Header tiles ───────────────────────────────────────────────────────
  function renderHeader(tr) {
    if (!tr) return '<div class="ai-trader-loading">No track record yet — pipeline runs nightly at 4:30 PM ET.</div>';
    const startEquity = tr.starting_equity || 100000;
    const totalReturn = tr.total_pnl / startEquity;
    return `
      <div class="ai-trader-tiles">
        <div class="ai-trader-tile">
          <div class="ai-trader-tile-label">Current Equity</div>
          <div class="ai-trader-tile-value">${fmtCurrency(tr.current_equity)}</div>
          <div class="ai-trader-tile-sub">${fmtSigned(totalReturn)} since start</div>
        </div>
        <div class="ai-trader-tile">
          <div class="ai-trader-tile-label">Realized P&amp;L</div>
          <div class="ai-trader-tile-value">${fmtSigned(tr.realized_pnl, 'currency')}</div>
          <div class="ai-trader-tile-sub">${tr.summary.trades} closed trades</div>
        </div>
        <div class="ai-trader-tile">
          <div class="ai-trader-tile-label">Open P&amp;L</div>
          <div class="ai-trader-tile-value">${fmtSigned(tr.open_pnl, 'currency')}</div>
          <div class="ai-trader-tile-sub">${tr.n_open} open positions</div>
        </div>
        <div class="ai-trader-tile">
          <div class="ai-trader-tile-label">Win Rate</div>
          <div class="ai-trader-tile-value">${fmtPct(tr.summary.win_rate)}</div>
          <div class="ai-trader-tile-sub">${tr.summary.wins}W / ${tr.summary.losses}L</div>
        </div>
        <div class="ai-trader-tile">
          <div class="ai-trader-tile-label">Max Drawdown</div>
          <div class="ai-trader-tile-value">${fmtPct(tr.drawdown.max_drawdown_pct)}</div>
          <div class="ai-trader-tile-sub">peak ${fmtCurrency(tr.drawdown.peak)}</div>
        </div>
        <div class="ai-trader-tile">
          <div class="ai-trader-tile-label">Sharpe (proxy)</div>
          <div class="ai-trader-tile-value">${tr.summary.sharpe != null ? tr.summary.sharpe.toFixed(2) : '—'}</div>
          <div class="ai-trader-tile-sub">expectancy ${fmtCurrency(tr.summary.expectancy)}</div>
        </div>
      </div>
    `;
  }

  // ─── Drawdown banner ────────────────────────────────────────────────────
  function renderBanner(state) {
    if (!state || !state.entries_paused_until) return null;
    const pauseUntil = new Date(state.entries_paused_until);
    if (pauseUntil <= new Date()) return null;
    const dateStr = pauseUntil.toLocaleDateString();
    return `
      <div class="ai-trader-banner-content warn">
        <strong>⚠ Pipeline recovering</strong> — new entries paused until ${dateStr}.
        Open positions still managed normally. Drawdown reached
        ${fmtPct(state.drawdown_pct)} from peak ${fmtCurrency(state.equity_peak)}.
      </div>
    `;
  }

  // ─── Equity curve sparkline ─────────────────────────────────────────────
  function renderEquityCurve(curve) {
    if (!curve || curve.length < 2) {
      return '<div class="ai-trader-empty">No trade history yet — equity curve will populate once the first trade closes.</div>';
    }
    const equities = curve.map(p => p.equity);
    const minE = Math.min(...equities);
    const maxE = Math.max(...equities);
    // Add 2% padding so the line isn't pinned to the edges
    const range = Math.max(maxE - minE, 1);
    const padE = range * 0.05;
    const yMin = minE - padE;
    const yMax = maxE + padE;
    const yRange = yMax - yMin;
    const w = 800, h = 220, pad = 12;
    const xStep = (w - 2 * pad) / Math.max(curve.length - 1, 1);
    const points = curve.map((p, i) => {
      const x = pad + i * xStep;
      const y = pad + (h - 2 * pad) * (1 - (p.equity - yMin) / yRange);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
    const lastY = pad + (h - 2 * pad) * (1 - (equities[equities.length - 1] - yMin) / yRange);
    const startY = pad + (h - 2 * pad) * (1 - (equities[0] - yMin) / yRange);
    const trendCls = equities[equities.length - 1] >= equities[0] ? 'pos' : 'neg';
    // SVG without preserveAspectRatio="none" — preserves text aspect ratio.
    // Labels rendered as HTML overlay (absolutely positioned) so they don't
    // distort with the SVG viewBox scale at any container width.
    return `
      <div class="ai-trader-equity-wrap">
        <div class="ai-trader-equity-y-labels" aria-hidden="true">
          <div class="ai-trader-equity-y-top">${fmtCurrency(maxE)}</div>
          <div class="ai-trader-equity-y-bot">${fmtCurrency(minE)}</div>
        </div>
        <svg viewBox="0 0 ${w} ${h}" class="ai-trader-svg" preserveAspectRatio="none"
             role="img" aria-label="Equity curve from ${fmtCurrency(equities[0])} to ${fmtCurrency(equities[equities.length - 1])}">
          <title>Equity curve</title>
          <line x1="${pad}" y1="${startY}" x2="${w - pad}" y2="${startY}"
                stroke="#444" stroke-dasharray="4 4" stroke-width="1"
                vector-effect="non-scaling-stroke"/>
          <polyline points="${points}" fill="none" stroke-width="2"
                    vector-effect="non-scaling-stroke"
                    class="ai-trader-curve-${trendCls}"/>
          <circle cx="${w - pad}" cy="${lastY}" r="4" class="ai-trader-curve-dot-${trendCls}"
                  vector-effect="non-scaling-stroke"/>
        </svg>
      </div>
      <div class="ai-trader-curve-meta">
        ${curve.length} points · start ${fmtCurrency(equities[0])} → now ${fmtCurrency(equities[equities.length - 1])}
      </div>
    `;
  }

  // ─── Open positions table ──────────────────────────────────────────────
  function renderOpenPositions(positions) {
    if (!positions || positions.length === 0) {
      return '<div class="ai-trader-empty">No open positions. Pipeline scans for setups every trading day at 4:30 PM ET.</div>';
    }
    const rows = positions.map(p => `
      <tr data-ticker="${p.ticker}" class="ai-trader-pos-row" tabindex="0" role="button" aria-label="Position detail for ${p.ticker}">
        <td><strong>${p.ticker}</strong></td>
        <td>${p.direction}</td>
        <td>${p.shares}</td>
        <td>${fmtCurrency(p.entry_price)}</td>
        <td>${fmtCurrency(p.current_price)}</td>
        <td>${fmtCurrency(p.stop_price)}</td>
        <td>${fmtCurrency(p.target_2)}</td>
        <td>${fmtSigned(p.pnl_dollars, 'currency')}</td>
        <td>${fmtSigned(p.pnl_pct)}</td>
        <td>${p.days_held}d</td>
        <td><span title="${(p.rule_citations || []).join(', ')}">${(p.rule_citations || []).slice(0, 3).join(' ')}</span></td>
      </tr>
    `).join('');
    return `
      <div class="ai-trader-table-wrap">
        <table class="ai-trader-table">
          <thead>
            <tr>
              <th scope="col">Ticker</th><th scope="col">Dir</th><th scope="col">Sh</th><th scope="col">Entry</th><th scope="col">Last</th>
              <th scope="col">Stop</th><th scope="col">Tgt2</th><th scope="col">P&amp;L $</th><th scope="col">P&amp;L %</th>
              <th scope="col">Days</th><th scope="col">Rules</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <div class="ai-trader-table-hint">Click a row for full reasoning trace.</div>
    `;
  }

  // ─── Position detail modal ─────────────────────────────────────────────
  // Per spec MUST: "clicking a position opens a detail modal showing Tom's
  // rule citations with rule text, the empirical prior study used, the regime
  // context at entry time, and the timestamp of every pipeline stage."
  let _rulesCache = null;
  function loadRules() {
    if (_rulesCache !== null) return Promise.resolve(_rulesCache);
    // Tom RULES.json lives in the parent repo, not the dashboard. We don't
    // ship it as a static asset (296 rules ~140KB), so for now we display
    // citation IDs without rule text; future fix: emit a thinned RULES.json
    // with just the cited rules into data/ai-trader/cited-rules.json.
    return fetch('data/ai-trader/cited-rules.json')
      .then(r => r.ok ? r.json() : { rules: [] })
      .catch(() => ({ rules: [] }))
      .then(d => {
        _rulesCache = {};
        (d.rules || []).forEach(r => { _rulesCache[r.id] = r; });
        return _rulesCache;
      });
  }

  function openPositionDetail(ticker) {
    fetch(DATA_PATHS.trackRecord)
      .then(r => r.ok ? r.json() : null)
      .then(tr => {
        if (!tr) return;
        const pos = (tr.open_positions || []).find(p => p.ticker === ticker);
        if (!pos) return;
        loadRules().then(rulesMap => buildModal(pos, tr, rulesMap));
      });
  }

  function buildModal(pos, tr, rulesMap) {
    // Remove any existing modal
    const existing = document.getElementById('ai-trader-modal');
    if (existing) existing.remove();

    const ruleRows = (pos.rule_citations || []).map(rid => {
      const rule = rulesMap[rid];
      const text = rule ? rule.rule : '(rule text not yet bundled — citation only)';
      const quote = rule && rule.quote ? `<div class="ai-trader-modal-quote">"${rule.quote}"</div>` : '';
      const priority = rule && rule.priority ? rule.priority : '';
      return `
        <div class="ai-trader-modal-rule">
          <div class="ai-trader-modal-rule-header"><code>${rid}</code> <span class="ai-trader-modal-rule-priority">${priority}</span></div>
          <div class="ai-trader-modal-rule-text">${text}</div>
          ${quote}
        </div>
      `;
    }).join('');

    const modal = document.createElement('div');
    modal.id = 'ai-trader-modal';
    modal.className = 'ai-trader-modal-backdrop';
    modal.innerHTML = `
      <div class="ai-trader-modal" role="dialog" aria-modal="true" aria-labelledby="ai-trader-modal-title">
        <button class="ai-trader-modal-close" aria-label="Close">&times;</button>
        <h2 id="ai-trader-modal-title">${pos.ticker} <span class="ai-trader-modal-dir">${pos.direction}</span></h2>
        <div class="ai-trader-modal-meta">
          ${pos.shares} shares @ ${fmtCurrency(pos.entry_price)} · current ${fmtCurrency(pos.current_price)} · ${pos.days_held}d held · sector ${pos.sector || '—'}
        </div>
        <div class="ai-trader-modal-pnl">
          P&amp;L: ${fmtSigned(pos.pnl_dollars, 'currency')} (${fmtSigned(pos.pnl_pct)})
          · stop ${fmtCurrency(pos.stop_price)} · target ${fmtCurrency(pos.target_2)}
        </div>
        <h3>Tom's Reasoning — ${(pos.rule_citations || []).length} rule${(pos.rule_citations || []).length === 1 ? '' : 's'} cited</h3>
        ${ruleRows || '<div class="ai-trader-empty">No rule citations recorded for this position.</div>'}
        <h3>Conviction</h3>
        <div>Score: ${pos.conviction != null ? (pos.conviction * 100).toFixed(0) + '%' : '—'}</div>
        <h3>Pipeline Timestamp</h3>
        <div>Track-record refreshed: ${tr.as_of || '—'}</div>
        <div class="ai-trader-modal-disclaimer">
          ⚠ Paper trade. Not investment advice. Not real money.
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    // Close handlers
    modal.querySelector('.ai-trader-modal-close').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', e => {
      if (e.target === modal) modal.remove();
    });
    document.addEventListener('keydown', function escHandler(e) {
      if (e.key === 'Escape') {
        modal.remove();
        document.removeEventListener('keydown', escHandler);
      }
    });
  }

  // Bind click handlers — runs after init() has populated the DOM
  function bindPositionClicks() {
    const tableHost = document.getElementById('ai-trader-open-positions');
    if (!tableHost) return;
    tableHost.addEventListener('click', e => {
      const row = e.target.closest('.ai-trader-pos-row');
      if (!row || !row.dataset.ticker) return;
      openPositionDetail(row.dataset.ticker);
    });
    tableHost.addEventListener('keydown', e => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const row = e.target.closest('.ai-trader-pos-row');
      if (!row || !row.dataset.ticker) return;
      e.preventDefault();
      openPositionDetail(row.dataset.ticker);
    });
  }

  // ─── Rule attribution ───────────────────────────────────────────────────
  function renderRuleAttribution(rules) {
    if (!rules || rules.length === 0) {
      return '<div class="ai-trader-empty">No closed trades yet — per-rule attribution will appear after the first close.</div>';
    }
    const rows = rules.slice(0, 15).map(r => `
      <tr>
        <td><code>${r.rule_id}</code></td>
        <td>${r.trades}</td>
        <td>${fmtPct(r.win_rate)}</td>
        <td>${fmtSigned(r.avg_pnl, 'currency')}</td>
        <td>${fmtSigned(r.total_pnl, 'currency')}</td>
      </tr>
    `).join('');
    return `
      <div class="ai-trader-table-wrap">
        <table class="ai-trader-table">
          <thead><tr><th scope="col">Rule</th><th scope="col">Trades</th><th scope="col">Win Rate</th><th scope="col">Avg P&amp;L</th><th scope="col">Total P&amp;L</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }

  // ─── Long vs Short summary ──────────────────────────────────────────────
  function renderByDirection(byDir) {
    if (!byDir) return '<div class="ai-trader-empty">No directional data yet.</div>';
    const summarize = (label, s) => `
      <div class="ai-trader-dir-block">
        <h4>${label}</h4>
        <div>${s.trades} trades · ${fmtPct(s.win_rate)} win · expectancy ${fmtSigned(s.expectancy, 'currency')}</div>
        <div>Total: ${fmtSigned(s.total_pnl, 'currency')} · Best: ${fmtCurrency(s.best_trade)} · Worst: ${fmtCurrency(s.worst_trade)}</div>
      </div>
    `;
    return `
      <div class="ai-trader-dir-grid">
        ${summarize('LONG', byDir.long || {})}
        ${summarize('SHORT', byDir.short || {})}
      </div>
    `;
  }

  // ─── Recent closes ──────────────────────────────────────────────────────
  function renderRecentCloses(curve) {
    // We use the equity_curve points (each non-start non-current is a close)
    if (!curve) return '<div class="ai-trader-empty">No closes yet.</div>';
    const closes = curve.filter(p => p.kind && !['start', 'current'].includes(p.kind)).reverse().slice(0, 10);
    if (closes.length === 0) {
      return '<div class="ai-trader-empty">No trades closed yet.</div>';
    }
    const rows = closes.map(c => `
      <tr>
        <td>${c.date || '—'}</td>
        <td><strong>${c.ticker || '—'}</strong></td>
        <td>${c.kind}</td>
        <td>${fmtSigned(c.pnl, 'currency')}</td>
        <td>${fmtCurrency(c.equity)}</td>
      </tr>
    `).join('');
    return `
      <div class="ai-trader-table-wrap">
        <table class="ai-trader-table">
          <thead><tr><th scope="col">Date</th><th scope="col">Ticker</th><th scope="col">Reason</th><th scope="col">P&amp;L</th><th scope="col">Equity</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }

  // ─── Pipeline status ────────────────────────────────────────────────────
  function renderPipelineStatus(lastRun) {
    if (!lastRun) {
      return '<div class="ai-trader-empty">Pipeline has not run yet — first run scheduled for 4:30 PM ET on the next trading day.</div>';
    }
    const ok = lastRun.status === 'ok';
    const cls = ok ? 'pos' : 'neg';
    const stages = (lastRun.stages || []).map(s =>
      `<li class="ai-trader-${s.exit_code === 0 ? 'pos' : 'neg'}">
        <code>${s.stage}</code> exit=${s.exit_code}
       </li>`
    ).join('');
    return `
      <div class="ai-trader-pipeline-status">
        <div>Status: <strong class="ai-trader-${cls}">${lastRun.status}</strong></div>
        <div>Started: ${lastRun.started || '—'}</div>
        <div>Finished: ${lastRun.finished || '—'}</div>
        ${lastRun.failed_stage ? `<div class="ai-trader-neg">Failed at: <code>${lastRun.failed_stage}</code></div>` : ''}
        <ul class="ai-trader-stages">${stages}</ul>
      </div>
    `;
  }

  // ─── Init ───────────────────────────────────────────────────────────────
  function init() {
    Promise.all([
      fetch(DATA_PATHS.trackRecord).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch(DATA_PATHS.riskState).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch(DATA_PATHS.lastRun).then(r => r.ok ? r.json() : null).catch(() => null),
    ]).then(([tr, riskState, lastRun]) => {
      const headerEl = document.getElementById('ai-trader-header');
      if (headerEl) headerEl.innerHTML = renderHeader(tr);

      const bannerHTML = renderBanner(riskState);
      const bannerEl = document.getElementById('ai-trader-banner');
      if (bannerEl && bannerHTML) {
        bannerEl.innerHTML = bannerHTML;
        bannerEl.style.display = 'block';
      }

      if (tr) {
        document.getElementById('ai-trader-equity-curve').innerHTML = renderEquityCurve(tr.equity_curve);
        document.getElementById('ai-trader-open-positions').innerHTML = renderOpenPositions(tr.open_positions);
        document.getElementById('ai-trader-recent-closes').innerHTML = renderRecentCloses(tr.equity_curve);
        document.getElementById('ai-trader-rule-attribution').innerHTML = renderRuleAttribution(tr.by_rule);
        document.getElementById('ai-trader-by-direction').innerHTML = renderByDirection(tr.by_direction);
        bindPositionClicks();
      }

      document.getElementById('ai-trader-pipeline-status').innerHTML = renderPipelineStatus(lastRun);
    });
  }

  function destroy() {}

  BT.pages['ai-trader'] = { render, init, destroy };
  // Holdings is an alias — same renderer (per spec)
  BT.pages['holdings'] = { render, init, destroy };
})();
