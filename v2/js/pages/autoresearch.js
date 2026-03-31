/**
 * pages/autoresearch.js — Autoresearch page module for BreakingTrades v2
 * Registers as BT.pages.autoresearch with render(), init(), destroy()
 */
(function() {
  'use strict';

  function fmt(n, d) { return n != null ? Number(n).toFixed(d || 2) : '—'; }
  function pct(n) { return n != null ? (n >= 0 ? '+' : '') + Number(n).toFixed(2) + '%' : '—'; }
  function cls(n) { return n >= 0 ? 'up' : 'down'; }

  function render(el) {
    el.innerHTML =
      '<div class="page-content" style="max-width:1400px;margin:0 auto;">' +
        '<div id="ar-app">' +
          '<div class="ar-no-data"><h2>Loading Autoresearch Data...</h2></div>' +
        '</div>' +
      '</div>';
  }

  function init() {
    fetch('../data/autoresearch-results.json')
      .then(function(r) { if (!r.ok) throw new Error('No data'); return r.json(); })
      .then(function(data) { renderData(data); })
      .catch(function() {
        var app = document.getElementById('ar-app');
        if (app) app.innerHTML =
          '<div class="ar-no-data">' +
            '<h2><i data-lucide="microscope"></i> No Autoresearch Data Yet</h2>' +
            '<p>Run the autoresearch runner to generate results:</p>' +
            '<p style="margin-top:12px;color:var(--cyan);font-size:14px;">bash autoresearch/runner.sh --experiments 20</p>' +
          '</div>';
      });
  }

  function destroy() {}

  function renderData(data) {
    var app = document.getElementById('ar-app');
    if (!app) return;

    var bl = data.baseline || {};
    var best = data.best || {};
    var pt = data.per_ticker || {};
    var tickers = Object.keys(pt);

    var html = '';

    // Stats row
    html += '<div class="ar-stats-row">' +
      '<div class="ar-stat-card"><div class="ar-stat-value">' + fmt(best.score || 0, 4) + '</div><div class="ar-stat-label">Best Score</div><div class="ar-stat-sub">Baseline: ' + fmt(bl.score || 0, 4) + '</div></div>' +
      '<div class="ar-stat-card"><div class="ar-stat-value">' + (data.experiments_total || 0) + '</div><div class="ar-stat-label">Experiments</div><div class="ar-stat-sub">' + (data.experiments_improved || 0) + ' improved</div></div>' +
      '<div class="ar-stat-card"><div class="ar-stat-value">' + tickers.length + '</div><div class="ar-stat-label">Tickers</div><div class="ar-stat-sub">Benchmark set</div></div>' +
      '<div class="ar-stat-card"><div class="ar-stat-value">' + (data.last_run ? new Date(data.last_run).toLocaleDateString() : '—') + '</div><div class="ar-stat-label">Last Run</div></div>' +
    '</div>';

    // Baseline vs Best
    html += '<div class="section-title">Baseline vs Best</div>' +
      '<div class="ar-compare-grid">' +
        '<div class="card ar-compare-card"><div class="ar-compare-label">Baseline</div><div class="ar-compare-score" style="color:var(--text-dim)">' + fmt(bl.score || 0, 4) + '</div></div>' +
        '<div class="card ar-compare-card"><div class="ar-compare-label">Best</div><div class="ar-compare-score" style="color:var(--cyan)">' + fmt(best.score || 0, 4) + '</div></div>' +
      '</div>';

    // Best config
    if (best.config) {
      html += '<div class="section-title">Best Config</div><div class="card"><pre style="color:var(--text);overflow-x:auto;font-size:11px;">' + JSON.stringify(best.config, null, 2) + '</pre></div>';
    }

    // Per-ticker breakdown
    html += '<div class="section-title">Per-Ticker Breakdown</div><div class="card"><table class="ar-table">' +
      '<thead><tr><th>Ticker</th><th>Score</th><th>Trades</th><th>Win Rate</th><th>Return</th><th>Max DD</th><th>PF</th><th>Avg R</th></tr></thead><tbody>';

    var tickerKeys = Object.keys(pt);
    for (var i = 0; i < tickerKeys.length; i++) {
      var ticker = tickerKeys[i];
      var m = pt[ticker];
      if (m.error) {
        html += '<tr><td>' + ticker + '</td><td colspan="7" style="color:var(--red)">' + m.error + '</td></tr>';
        continue;
      }
      html += '<tr>' +
        '<td style="font-weight:700;color:var(--cyan)">' + ticker + '</td>' +
        '<td>' + fmt(m.score, 4) + ' <span class="ar-score-bar" style="width:' + ((m.score||0)*80) + 'px"></span></td>' +
        '<td>' + (m.trades || 0) + '</td>' +
        '<td>' + fmt(m.win_rate, 1) + '%</td>' +
        '<td class="' + cls(m.total_return_pct) + '">' + pct(m.total_return_pct) + '</td>' +
        '<td class="down">' + fmt(m.max_dd, 2) + '%</td>' +
        '<td>' + fmt(m.profit_factor, 2) + '</td>' +
        '<td>' + fmt(m.avg_r, 2) + '</td>' +
      '</tr>';
    }

    html += '</tbody></table></div>';

    app.innerHTML = html;
  }

  BT.pages.autoresearch = {
    render: render,
    init: init,
    destroy: destroy
  };
})();
