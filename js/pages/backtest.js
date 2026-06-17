/**
 * js/pages/backtest.js — Backtest dossier page (Phase 5b).
 *
 * Reads breakingtrades-dashboard/data/ai-trader/backtest-summary.json,
 * renders header tiles, equity curve overlay (system + SPY + 60/40),
 * tabbed UI (Overview / Rules / Regimes / Trades), Phase 5 disclaimer.
 *
 * Schema reference: scripts/ai-trader/backtest_lib/reporter.py
 *   build_dashboard_summary() — defines the exact JSON shape this reads.
 */

(function() {
  'use strict';

  const SUMMARY_PATH = 'data/ai-trader/backtest-summary.json';

  // ─── Number formatters ──────────────────────────────────────────────────
  function fmtCurrency(n) {
    if (n == null || isNaN(n)) return '—';
    const sign = n < 0 ? '-' : '';
    return sign + '$' + Math.abs(n).toLocaleString('en-US', {
      minimumFractionDigits: 2, maximumFractionDigits: 2,
    });
  }
  function fmtPct(n) {
    if (n == null || isNaN(n)) return '—';
    return (n >= 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function fmtSharpe(n) {
    if (n == null || isNaN(n)) return '—';
    return n.toFixed(2);
  }
  function colorClass(n) {
    if (n == null || isNaN(n)) return '';
    return n > 0 ? 'bt-pos' : n < 0 ? 'bt-neg' : '';
  }

  // ─── Page shell ─────────────────────────────────────────────────────────
  function renderShell() {
    return `
      <div class="bt-page">
        <div class="bt-disclaimer">
          ⚠ <strong>Backtest results — Phase 5 limitations apply.</strong>
          Uses ATR×√N EM proxy (not real options-chain IV).
          Survivorship bias possible (current watchlist over full window).
          In-sample rule evaluation (rules curated through 2026 — see
          Phase 9 for proper out-of-sample evaluation).
          Pre-tax P&amp;L. No borrow costs on shorts.
          For educational use only. Not investment advice.
        </div>
        <div id="bt-content"><div class="bt-loading">Loading backtest summary…</div></div>
      </div>
    `;
  }

  function renderEmpty() {
    return `
      <div class="bt-empty-state">
        <h2>No backtest run yet</h2>
        <p>To produce a backtest report, run the harness from the parent repo:</p>
        <pre class="bt-code">python scripts/ai-trader/backtest.py \\
  --start 2021-06-01 --end 2026-06-13 \\
  --run-id main</pre>
        <p>The orchestrator emits <code>backtest/run-&lt;id&gt;/dashboard-summary.json</code>.
           Copy that file to <code>data/ai-trader/backtest-summary.json</code>
           and refresh this page.</p>
      </div>
    `;
  }

  // ─── Header tiles ───────────────────────────────────────────────────────
  function renderTiles(summary) {
    const m = summary.metrics || {};
    const t = summary.trades || {};
    const b = summary.benchmarks || {};
    const tiles = [
      {
        label: 'TOTAL RETURN',
        value: fmtPct(m.total_return_pct),
        sub: 'CAGR ' + fmtPct(m.cagr_pct),
        cls: colorClass(m.total_return_pct),
      },
      {
        label: 'SHARPE',
        value: fmtSharpe(m.sharpe),
        sub: 'Sortino ' + fmtSharpe(m.sortino),
      },
      {
        label: 'MAX DRAWDOWN',
        value: fmtPct(-Math.abs(m.max_drawdown_pct || 0)),
        sub: (m.max_drawdown_days || 0) + ' days',
        cls: 'bt-neg',
      },
      {
        label: 'TRADES',
        value: (t.trades || 0).toLocaleString(),
        sub: `${t.wins || 0}W / ${t.losses || 0}L · ${((t.win_rate || 0) * 100).toFixed(1)}%`,
      },
      {
        label: 'ALPHA vs SPY',
        value: fmtPct(b.spy && b.spy.alpha_vs_system_pct),
        sub: 'SPY ' + fmtPct(b.spy && b.spy.total_return_pct),
        cls: colorClass(b.spy && b.spy.alpha_vs_system_pct),
      },
      {
        label: 'VOLATILITY',
        value: fmtPct(m.volatility_annual_pct),
        sub: 'annualized',
      },
    ];
    return `
      <div class="bt-tiles">
        ${tiles.map(t => `
          <div class="bt-tile">
            <div class="bt-tile-label">${t.label}</div>
            <div class="bt-tile-value ${t.cls || ''}">${t.value}</div>
            <div class="bt-tile-sub">${t.sub}</div>
          </div>
        `).join('')}
      </div>
    `;
  }

  // ─── Equity curve (3-series overlay) ────────────────────────────────────
  function renderEquityCurve(summary) {
    const curves = summary.curves || {};
    const sys = curves.system || [];
    const spy = curves.spy || [];
    const sf = curves.sixty_forty || [];

    if (!sys.length || sys.length < 2) {
      return '<div class="bt-empty">No equity curve points — backtest produced no trading days.</div>';
    }

    // Find min/max across all series for a shared y-axis
    const allEquities = [...sys, ...spy, ...sf].map(p => p.equity);
    const yMin = Math.min(...allEquities);
    const yMax = Math.max(...allEquities);
    const padding = (yMax - yMin) * 0.05 || yMax * 0.01;
    const yLow = yMin - padding;
    const yHigh = yMax + padding;
    const yRange = yHigh - yLow;

    const w = 800, h = 240, pad = 12;

    function buildPolyline(points, color) {
      if (!points.length) return '';
      const xStep = (w - 2 * pad) / Math.max(points.length - 1, 1);
      const coords = points.map((p, i) => {
        const x = pad + i * xStep;
        const y = pad + (h - 2 * pad) * (1 - (p.equity - yLow) / yRange);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      }).join(' ');
      return `<polyline points="${coords}" fill="none" stroke="${color}" stroke-width="2" vector-effect="non-scaling-stroke"/>`;
    }

    return `
      <div class="bt-equity-wrap">
        <div class="bt-equity-y-labels" aria-hidden="true">
          <div>${fmtCurrency(yHigh)}</div>
          <div>${fmtCurrency(yLow)}</div>
        </div>
        <svg viewBox="0 0 ${w} ${h}" class="bt-svg" preserveAspectRatio="none"
             role="img" aria-label="Equity curve, system vs SPY vs 60/40 benchmark">
          <title>Equity curve overlay</title>
          ${buildPolyline(sys, '#4dd0e1')}
          ${buildPolyline(spy, '#aaaaaa')}
          ${buildPolyline(sf, '#d4a017')}
        </svg>
      </div>
      <div class="bt-curve-legend">
        <span class="bt-legend-dot" style="background:#4dd0e1"></span> System
        <span class="bt-legend-dot" style="background:#aaaaaa"></span> SPY
        <span class="bt-legend-dot" style="background:#d4a017"></span> 60/40
      </div>
      <div class="bt-curve-meta">
        ${sys.length} points · ${sys[0].date} → ${sys[sys.length - 1].date} ·
        Final ${fmtCurrency(sys[sys.length - 1].equity)}
      </div>
    `;
  }

  // ─── Benchmarks comparison table ────────────────────────────────────────
  function renderBenchmarks(summary) {
    const m = summary.metrics || {};
    const b = summary.benchmarks || {};
    const rows = [
      {
        name: 'AI-Trader (this system)',
        ret: m.total_return_pct,
        sharpe: m.sharpe,
        dd: -Math.abs(m.max_drawdown_pct || 0),
      },
      {
        name: 'SPY buy-and-hold',
        ret: b.spy && b.spy.total_return_pct,
        sharpe: b.spy && b.spy.sharpe,
        dd: -Math.abs((b.spy && b.spy.max_drawdown_pct) || 0),
      },
      {
        name: '60/40 (SPY/IEF, qtly rebal)',
        ret: b.sixty_forty && b.sixty_forty.total_return_pct,
        sharpe: b.sixty_forty && b.sixty_forty.sharpe,
        dd: -Math.abs((b.sixty_forty && b.sixty_forty.max_drawdown_pct) || 0),
      },
    ];
    return `
      <h3>Benchmarks</h3>
      <div class="bt-table-wrap">
        <table class="bt-table">
          <thead><tr><th scope="col">Strategy</th><th scope="col">Total Return</th><th scope="col">Sharpe</th><th scope="col">Max DD</th></tr></thead>
          <tbody>
            ${rows.map(r => `
              <tr>
                <td>${r.name}</td>
                <td class="${colorClass(r.ret)}">${fmtPct(r.ret)}</td>
                <td>${fmtSharpe(r.sharpe)}</td>
                <td class="bt-neg">${fmtPct(r.dd)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  // ─── Top + worst rules ──────────────────────────────────────────────────
  function renderRules(summary) {
    const top = summary.top_rules || [];
    const worst = summary.worst_rules || [];
    const renderRow = r => `
      <tr>
        <td><code>${r.rule_id}</code></td>
        <td>${r.trades}</td>
        <td>${(r.win_rate * 100).toFixed(0)}%</td>
        <td class="${colorClass(r.total_pnl)}">${fmtCurrency(r.total_pnl)}</td>
        <td class="${colorClass(r.avg_pnl)}">${fmtCurrency(r.avg_pnl)}</td>
      </tr>
    `;
    if (!top.length && !worst.length) {
      return '<h3>Rule Attribution</h3><div class="bt-empty">No closed trades — no per-rule attribution yet.</div>';
    }
    return `
      <h3>Top Rules by P&amp;L</h3>
      <div class="bt-table-wrap">
        <table class="bt-table">
          <thead><tr><th scope="col">Rule</th><th scope="col">Trades</th><th scope="col">Win%</th><th scope="col">Total P&amp;L</th><th scope="col">Avg P&amp;L</th></tr></thead>
          <tbody>${top.slice(0, 15).map(renderRow).join('')}</tbody>
        </table>
      </div>
      ${worst.length ? `
        <h3 style="margin-top:18px;">Worst Rules</h3>
        <div class="bt-table-wrap">
          <table class="bt-table">
            <thead><tr><th scope="col">Rule</th><th scope="col">Trades</th><th scope="col">Win%</th><th scope="col">Total P&amp;L</th><th scope="col">Avg P&amp;L</th></tr></thead>
            <tbody>${worst.slice(0, 10).map(renderRow).join('')}</tbody>
          </table>
        </div>
      ` : ''}
    `;
  }

  // ─── Regime breakdown ───────────────────────────────────────────────────
  function renderRegimes(summary) {
    const buckets = summary.by_regime || {};
    const keys = Object.keys(buckets);
    if (!keys.length) {
      return '<h3>Performance by Regime</h3><div class="bt-empty">No regime-segmented data.</div>';
    }
    return `
      <h3>Performance by Entry Regime</h3>
      <div class="bt-table-wrap">
        <table class="bt-table">
          <thead><tr><th scope="col">Regime</th><th scope="col">Trades</th><th scope="col">Win%</th><th scope="col">Avg P&amp;L</th><th scope="col">Expectancy</th></tr></thead>
          <tbody>
            ${keys.map(k => {
              const v = buckets[k];
              return `
                <tr>
                  <td><strong>${k}</strong></td>
                  <td>${v.trades}</td>
                  <td>${((v.win_rate || 0) * 100).toFixed(0)}%</td>
                  <td class="${colorClass(v.avg_pnl)}">${fmtCurrency(v.avg_pnl)}</td>
                  <td class="${colorClass(v.expectancy)}">${fmtCurrency(v.expectancy)}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  // ─── Sleeve attribution (SPY base vs momentum sleeve) ──────────────────
  function renderSleeves(summary) {
    const sleeves = summary.sleeve_attribution || {};
    const keys = Object.keys(sleeves);
    if (!keys.length) return '';  // non-overlay run — hide panel entirely
    // Order: SPY Base, Momentum Sleeve, Other
    const order = ['SPY Base', 'Momentum Sleeve', 'Other'];
    keys.sort((a, b) => order.indexOf(a) - order.indexOf(b));
    const rows = keys.map(k => {
      const v = sleeves[k];
      return `
        <tr>
          <td><strong>${k}</strong></td>
          <td>${v.trades}</td>
          <td>${((v.win_rate || 0) * 100).toFixed(0)}%</td>
          <td class="${colorClass(v.total_pnl)}">${fmtCurrency(v.total_pnl)}</td>
          <td class="${colorClass(v.avg_pnl)}">${fmtCurrency(v.avg_pnl)}</td>
          <td>${v.avg_holding_days}d</td>
        </tr>
      `;
    }).join('');
    return `
      <h3>Sleeve Attribution</h3>
      <p class="bt-section-note">Which sleeve carries the return — the index base or the momentum picks.</p>
      <div class="bt-table-wrap">
        <table class="bt-table">
          <thead><tr><th scope="col">Sleeve</th><th scope="col">Trades</th><th scope="col">Win%</th><th scope="col">Total P&amp;L</th><th scope="col">Avg P&amp;L</th><th scope="col">Avg Hold</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }

  // ─── Render the page once data is loaded ────────────────────────────────
  function renderDossier(summary) {
    const tilesHtml = renderTiles(summary);
    const curveHtml = renderEquityCurve(summary);
    const benchHtml = renderBenchmarks(summary);
    const rulesHtml = renderRules(summary);
    const regimesHtml = renderRegimes(summary);
    const sleevesHtml = renderSleeves(summary);
    return `
      ${tilesHtml}
      <div class="bt-section">
        <h3>Equity Curve — System vs Benchmarks</h3>
        ${curveHtml}
      </div>
      <div class="bt-grid">
        <div class="bt-section">${benchHtml}</div>
        <div class="bt-section">${regimesHtml}</div>
      </div>
      ${sleevesHtml ? `<div class="bt-section">${sleevesHtml}</div>` : ''}
      <div class="bt-section">${rulesHtml}</div>
      <div class="bt-section bt-meta">
        <strong>Run:</strong> <code>${summary.run_id || '—'}</code>
        · Starting equity ${fmtCurrency(summary.starting_equity)}
        · Final equity ${fmtCurrency(summary.final_equity)}
        · ${summary.fills_count || 0} fills
      </div>
    `;
  }

  // ─── Init / fetch ───────────────────────────────────────────────────────
  function init(contentEl) {
    // Router passes the page mount point to render(); fall back to #content
    // (the canonical SPA mount in index.html) if called directly. Never write
    // to document.body — that wipes the V3 sidebar/topbar shell and strands
    // the user with no nav.
    const root = (contentEl && contentEl.nodeType === 1)
      ? contentEl
      : document.getElementById('content');
    if (!root) {
      console.error('[backtest] no mount point — refusing to render to body');
      return;
    }
    root.innerHTML = renderShell();
    const content = document.getElementById('bt-content');
    fetch(SUMMARY_PATH, { cache: 'no-cache' })
      .then(r => {
        if (r.status === 404) return null;
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(summary => {
        if (!summary) {
          content.innerHTML = renderEmpty();
          return;
        }
        content.innerHTML = renderDossier(summary);
      })
      .catch(err => {
        content.innerHTML = `<div class="bt-empty"><h3>Failed to load backtest summary</h3><p>${err.message}</p></div>`;
      });
  }

  // Register page handler with the BT router (mirrors ai-trader.js pattern)
  window.BT = window.BT || {};
  window.BT.pages = window.BT.pages || {};
  window.BT.pages.backtest = { render: init };
  window.BT.pages.backtest.init = init;

  // If router has already triggered the page (script loaded after route hash),
  // call init() now.
  if (location.hash.replace('#', '').split('?')[0] === 'backtest') {
    setTimeout(init, 0);
  }
})();
