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
    const range = Math.max(maxE - minE, 1);
    const w = 800, h = 180, pad = 20;
    const xStep = (w - 2 * pad) / Math.max(curve.length - 1, 1);
    const points = curve.map((p, i) => {
      const x = pad + i * xStep;
      const y = pad + (h - 2 * pad) * (1 - (p.equity - minE) / range);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
    const lastY = pad + (h - 2 * pad) * (1 - (equities[equities.length - 1] - minE) / range);
    const startY = pad + (h - 2 * pad) * (1 - (equities[0] - minE) / range);
    const trendCls = equities[equities.length - 1] >= equities[0] ? 'pos' : 'neg';
    return `
      <svg viewBox="0 0 ${w} ${h}" class="ai-trader-svg" preserveAspectRatio="none">
        <line x1="${pad}" y1="${startY}" x2="${w - pad}" y2="${startY}"
              stroke="#444" stroke-dasharray="4 4" stroke-width="1"/>
        <polyline points="${points}" fill="none" stroke-width="2"
                  class="ai-trader-curve-${trendCls}"/>
        <circle cx="${w - pad}" cy="${lastY}" r="4" class="ai-trader-curve-dot-${trendCls}"/>
        <text x="${pad}" y="${pad - 4}" class="ai-trader-svg-label">${fmtCurrency(maxE)}</text>
        <text x="${pad}" y="${h - 4}" class="ai-trader-svg-label">${fmtCurrency(minE)}</text>
      </svg>
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
      <tr data-ticker="${p.ticker}" class="ai-trader-pos-row">
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
      <table class="ai-trader-table">
        <thead>
          <tr>
            <th>Ticker</th><th>Dir</th><th>Sh</th><th>Entry</th><th>Last</th>
            <th>Stop</th><th>Tgt2</th><th>P&amp;L $</th><th>P&amp;L %</th>
            <th>Days</th><th>Rules</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;
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
      <table class="ai-trader-table">
        <thead><tr><th>Rule</th><th>Trades</th><th>Win Rate</th><th>Avg P&amp;L</th><th>Total P&amp;L</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
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
      <table class="ai-trader-table">
        <thead><tr><th>Date</th><th>Ticker</th><th>Reason</th><th>P&amp;L</th><th>Equity</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
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
      }

      document.getElementById('ai-trader-pipeline-status').innerHTML = renderPipelineStatus(lastRun);
    });
  }

  function destroy() {}

  BT.pages['ai-trader'] = { render, init, destroy };
  // Holdings is an alias — same renderer (per spec)
  BT.pages['holdings'] = { render, init, destroy };
})();
