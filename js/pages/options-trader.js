/**
 * js/pages/options-trader.js — AI Options Trader dashboard page.
 *
 * Sibling to ai-trader.js but for the defined-risk options book.
 *
 * Reads (from data/options-trader/):
 *   opt-holdings.json        — paper portfolio: cash, reserved BP, equity, positions[]
 *   opt-recommendations.json — latest priced spread recommendations
 *   opt-candidates.json      — latest opportunity scan (ranked)
 *
 * Renders:
 *   - Paper-trade disclaimer chrome (same MUST as the stock trader)
 *   - Header: equity, cash, reserved buying power, unrealized P&L, open count
 *   - Open spreads table (strategy, legs, credit/debit, max P/L, POP, DTE, status)
 *   - Top opportunities scan (what the scout is seeing right now)
 */
(function() {
  if (!window.BT) window.BT = {};
  if (!BT.pages) BT.pages = {};

  const DATA_PATHS = {
    holdings:        'data/options-trader/opt-holdings.json',
    recommendations: 'data/options-trader/opt-recommendations.json',
    candidates:      'data/options-trader/opt-candidates.json',
    backtest:        'data/options-trader/opt-backtest.json',
  };

  // ─── Formatters ──────────────────────────────────────────────────────────
  function fmtCurrency(v) {
    if (v === null || v === undefined || isNaN(v)) return '—';
    return (v < 0 ? '-$' : '$') + Math.abs(v).toLocaleString('en-US', { maximumFractionDigits: 0 });
  }
  function fmtSigned(v, kind) {
    if (v === null || v === undefined || isNaN(v)) return '—';
    const sign = v >= 0 ? '+' : '';
    if (kind === 'currency') return sign + fmtCurrency(v);
    return sign + (v * 100).toFixed(1) + '%';
  }
  function pctCls(v) { return v >= 0 ? 'pos' : 'neg'; }

  // ─── Render shell ────────────────────────────────────────────────────────
  function render(container) {
    container.innerHTML = `
      <div class="ai-trader-page opt-trader-page">
        <div class="ai-trader-disclaimer" role="alert">
          <strong>⚠ Paper trades · educational use only · not investment advice · not real money.</strong>
          The AI Options Trader is a transparent paper simulator. Every position is a
          <strong>defined-risk spread</strong> (no naked options). Pricing is modeled
          from snapshot IV, not a live option chain. No real capital is deployed.
        </div>

        <div id="opt-trader-header" class="ai-trader-header">
          <div class="ai-trader-loading">Loading options book…</div>
        </div>

        <div id="opt-trader-backtest-banner"></div>

        <div class="ai-trader-grid">
          <section class="ai-trader-section ai-picks-section">
            <h3>🎯 Open Spreads — Defined-Risk Book</h3>
            <div id="opt-trader-positions"><div class="ai-trader-loading">Loading positions…</div></div>
          </section>

          <section class="ai-trader-section">
            <h3>📊 Backtest — Honest Validation (27y, proxy IV)</h3>
            <div id="opt-trader-backtest"><div class="ai-trader-loading">Loading backtest…</div></div>
          </section>

          <section class="ai-trader-section">
            <h3>🔍 Opportunity Scan — Machinery Output <span class="opt-illustrative">illustrative</span></h3>
            <div id="opt-trader-candidates"><div class="ai-trader-loading">Loading scan…</div></div>
          </section>

          <section class="ai-trader-section">
            <h3>🧠 Spread Constructor — Machinery Output <span class="opt-illustrative">illustrative · not advice</span></h3>
            <div id="opt-trader-recommendations"></div>
          </section>
        </div>
      </div>
    `;
  }

  // ─── Header ──────────────────────────────────────────────────────────────
  function renderHeader(h) {
    if (!h) return '<div class="ai-trader-empty">No options book yet. Run opt_run.py.</div>';
    const start = h.starting_equity || 100000;
    const equity = h.equity || start;
    const allPnl = equity - start;
    const allPct = start ? allPnl / start : 0;
    const unrl = h.total_unrealized_pnl || 0;
    return `
      <div class="ai-trader-tiles">
        <div class="ai-trader-tile">
          <div class="ai-trader-tile-label">Equity</div>
          <div class="ai-trader-tile-value">${fmtCurrency(equity)}</div>
          <div class="ai-trader-tile-sub ${pctCls(allPnl)}">${fmtSigned(allPct)} since start</div>
        </div>
        <div class="ai-trader-tile">
          <div class="ai-trader-tile-label">Cash</div>
          <div class="ai-trader-tile-value">${fmtCurrency(h.cash)}</div>
          <div class="ai-trader-tile-sub">credit received raises cash</div>
        </div>
        <div class="ai-trader-tile">
          <div class="ai-trader-tile-label">Reserved BP</div>
          <div class="ai-trader-tile-value">${fmtCurrency(h.reserved_buying_power)}</div>
          <div class="ai-trader-tile-sub">defined max-loss hold</div>
        </div>
        <div class="ai-trader-tile">
          <div class="ai-trader-tile-label">Unrealized P&amp;L</div>
          <div class="ai-trader-tile-value ${pctCls(unrl)}">${fmtSigned(unrl, 'currency')}</div>
          <div class="ai-trader-tile-sub">mark-to-market</div>
        </div>
        <div class="ai-trader-tile">
          <div class="ai-trader-tile-label">Open Spreads</div>
          <div class="ai-trader-tile-value">${h.open_count || 0}</div>
          <div class="ai-trader-tile-sub">defined-risk only</div>
        </div>
      </div>
    `;
  }

  // ─── Open spreads table ──────────────────────────────────────────────────
  function legsSummary(legs) {
    if (!legs || !legs.length) return '';
    return legs.map(l => {
      const act = l.action === 'SELL' ? '−' : '+';
      return `${act}${l.right[0]}${l.strike}`;
    }).join(' / ');
  }

  function renderPositions(h) {
    if (!h || !h.positions || !h.positions.length) {
      return '<div class="ai-trader-empty">No open spreads.</div>';
    }
    const open = h.positions.filter(p => (p.status || 'OPEN') === 'OPEN');
    if (!open.length) return '<div class="ai-trader-empty">No open spreads (all closed).</div>';
    const rows = open.map(p => {
      const kind = p.is_credit ? 'CR' : 'DR';
      const kindCls = p.is_credit ? 'pos' : '';
      const pnl = p.unrealized_pnl || 0;
      const stratShort = (p.strategy || '').replace(/_/g, ' ').replace('SPREAD', 'spr');
      return `
        <tr>
          <td><strong>${p.ticker}</strong><div class="ai-picks-sector">${p.sector || ''}</div></td>
          <td><span class="opt-strat">${stratShort}</span></td>
          <td><span class="opt-kind ${kindCls}">${kind}</span></td>
          <td class="opt-legs">${legsSummary(p.legs)}</td>
          <td>${p.contracts}</td>
          <td>${fmtCurrency(p.max_profit_total)}</td>
          <td class="neg">${fmtCurrency(-Math.abs(p.max_loss_total))}</td>
          <td>${Math.round((p.pop_estimate || 0) * 100)}%</td>
          <td class="${pctCls(pnl)}">${fmtSigned(pnl, 'currency')}</td>
          <td>${p.dte_remaining != null ? p.dte_remaining + 'd' : '—'}</td>
          <td><span class="ai-picks-status">${p.status || 'OPEN'}</span></td>
        </tr>
      `;
    }).join('');
    return `
      <div class="ai-trader-table-wrap">
        <table class="ai-trader-table ai-picks-table opt-table">
          <thead>
            <tr>
              <th scope="col">Ticker</th><th scope="col">Strategy</th><th scope="col">Type</th>
              <th scope="col">Legs</th><th scope="col">Qty</th>
              <th scope="col">Max P</th><th scope="col">Max L</th><th scope="col">POP</th>
              <th scope="col">uP&amp;L</th><th scope="col">DTE</th><th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }

  // ─── Opportunity scan ────────────────────────────────────────────────────
  function renderCandidates(c) {
    if (!c || !c.candidates || !c.candidates.length) {
      return '<div class="ai-trader-empty">No candidates in the latest scan.</div>';
    }
    const regimeBadge = c.regime
      ? `<span class="opt-regime-badge">Regime: <strong>${c.regime}</strong>${c.regime_score != null ? ' (' + c.regime_score + ')' : ''}</span>`
      : '';
    const rows = c.candidates.slice(0, 12).map(x => {
      const ivCls = x.iv_regime === 'RICH' ? 'pos' : (x.iv_regime === 'CHEAP' ? 'neg' : '');
      const dirCls = x.direction_bias === 'BULLISH' ? 'pos' : (x.direction_bias === 'BEARISH' ? 'neg' : '');
      return `
        <tr>
          <td><strong>${x.ticker}</strong><div class="ai-picks-sector">${x.sector || ''}</div></td>
          <td>${x.score.toFixed(2)}</td>
          <td>${x.iv}</td>
          <td><span class="opt-iv ${ivCls}">${x.iv_regime}</span></td>
          <td><span class="${dirCls}">${x.direction_bias}</span></td>
          <td>${x.em_position_pct != null ? Math.round(x.em_position_pct) + '%' : '—'}</td>
        </tr>
      `;
    }).join('');
    return `
      <div class="opt-scan-meta">${regimeBadge}
        <span class="ai-picks-muted">${c.candidates_found || 0} candidates from ${c.universe_size || 0} names</span>
      </div>
      <div class="ai-trader-table-wrap">
        <table class="ai-trader-table opt-table">
          <thead>
            <tr><th scope="col">Ticker</th><th scope="col">Score</th><th scope="col">IV</th>
            <th scope="col">IV Regime</th><th scope="col">Bias</th><th scope="col">EM-pos</th></tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }

  // ─── Recommendations ─────────────────────────────────────────────────────
  function renderRecommendations(r) {
    if (!r || !r.recommendations || !r.recommendations.length) {
      return '<div class="ai-trader-empty">No current recommendations.</div>';
    }
    const rows = r.recommendations.slice(0, 8).map(x => {
      const kind = x.is_credit ? 'CR' : 'DR';
      const rr = x.max_loss ? (x.max_profit / x.max_loss).toFixed(2) : '—';
      return `
        <tr>
          <td><strong>${x.ticker}</strong></td>
          <td><span class="opt-strat">${(x.strategy || '').replace(/_/g, ' ')}</span></td>
          <td><span class="${x.is_credit ? 'pos' : ''}">${kind} $${Math.abs(x.net_premium).toFixed(2)}</span></td>
          <td>${fmtCurrency(x.max_profit)}</td>
          <td class="neg">${fmtCurrency(-Math.abs(x.max_loss))}</td>
          <td>${rr}</td>
          <td>${Math.round((x.pop_estimate || 0) * 100)}%</td>
          <td>${Math.round((x.conviction || 0) * 100)}%</td>
        </tr>
      `;
    }).join('');
    const expiry = r.expiry ? `exp ${r.expiry} (${r.dte}d)` : '';
    return `
      <div class="opt-scan-meta"><span class="ai-picks-muted">${r.count || 0} constructed spreads · ${expiry} · <em>illustrative machinery output — backtest shows no validated edge; not trade advice</em></span></div>
      <div class="ai-trader-table-wrap">
        <table class="ai-trader-table opt-table">
          <thead>
            <tr><th scope="col">Ticker</th><th scope="col">Strategy</th><th scope="col">Premium</th>
            <th scope="col">Max P</th><th scope="col">Max L</th><th scope="col">R:R</th>
            <th scope="col">POP</th><th scope="col">Conv</th></tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }

  // ─── Backtest (honest validation) ────────────────────────────────────────
  function renderBacktestBanner(bt) {
    if (!bt) return '';
    // The honest verdict: the result is carried entirely by long-call-spreads
    // (a levered long-equity bet); credit/premium-selling is flat-to-negative.
    return `
      <div class="ai-trader-disclaimer opt-verdict" role="alert">
        <strong>📊 Backtest verdict — read before trusting this:</strong>
        Over 27 years (proxy IV), this book returns ${bt.total_return_pct >= 0 ? '+' : ''}${Math.round(bt.total_return_pct)}%
        but with a <strong>${bt.max_drawdown_pct.toFixed(0)}% max drawdown</strong> and a
        <strong>${(bt.win_rate * 100).toFixed(0)}% win rate</strong>. The entire gain comes from
        <strong>long debit spreads</strong> (a leveraged directional long), not from premium-selling —
        the credit-spread logic is flat-to-negative even under a proxy biased in its favor.
        <strong>This is not yet a validated options edge.</strong> Treated as research, not a strategy.
      </div>
    `;
  }

  function renderBacktest(bt) {
    if (!bt) return '<div class="ai-trader-empty">No backtest results yet. Run opt_backtest.py.</div>';
    const byStrat = bt.by_strategy || {};
    const stratRows = Object.keys(byStrat).map(k => {
      const v = byStrat[k];
      return `
        <tr>
          <td>${k.replace(/_/g, ' ')}</td>
          <td>${v.trades}</td>
          <td class="${v.pnl >= 0 ? 'pos' : 'neg'}">${fmtSigned(v.pnl, 'currency')}</td>
        </tr>`;
    }).join('');
    return `
      <div class="ai-trader-tiles opt-bt-tiles">
        <div class="ai-trader-tile">
          <div class="ai-trader-tile-label">Total Return</div>
          <div class="ai-trader-tile-value ${bt.total_return_pct >= 0 ? 'pos' : 'neg'}">${bt.total_return_pct >= 0 ? '+' : ''}${Math.round(bt.total_return_pct)}%</div>
          <div class="ai-trader-tile-sub">${bt.period || ''}</div>
        </div>
        <div class="ai-trader-tile">
          <div class="ai-trader-tile-label">Win Rate</div>
          <div class="ai-trader-tile-value">${(bt.win_rate * 100).toFixed(1)}%</div>
          <div class="ai-trader-tile-sub">${bt.wins}W / ${bt.losses}L · ${bt.trades} trades</div>
        </div>
        <div class="ai-trader-tile">
          <div class="ai-trader-tile-label">Profit Factor</div>
          <div class="ai-trader-tile-value">${bt.profit_factor != null ? bt.profit_factor.toFixed(2) : '—'}</div>
          <div class="ai-trader-tile-sub">gross win / gross loss</div>
        </div>
        <div class="ai-trader-tile">
          <div class="ai-trader-tile-label">Max Drawdown</div>
          <div class="ai-trader-tile-value neg">${bt.max_drawdown_pct.toFixed(1)}%</div>
          <div class="ai-trader-tile-sub">peak-to-trough</div>
        </div>
      </div>
      <div class="ai-trader-table-wrap">
        <table class="ai-trader-table opt-table">
          <thead><tr><th scope="col">Strategy</th><th scope="col">Trades</th><th scope="col">P&amp;L</th></tr></thead>
          <tbody>${stratRows}</tbody>
        </table>
      </div>
      <p class="ai-picks-note">Method: ${bt.method || 'walk-forward'}. IV is an ATR/VIX <strong>proxy</strong>,
      not real implied vol — and the proxy is biased <em>toward</em> credit-spread success, so credit losing money
      is a strong negative signal. Hold-to-expiry (no early management). ${(bt.universe || []).length}-ticker universe.</p>
    `;
  }

  // ─── Init ────────────────────────────────────────────────────────────────
  function init() {
    Promise.all([
      fetch(DATA_PATHS.holdings).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch(DATA_PATHS.candidates).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch(DATA_PATHS.recommendations).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch(DATA_PATHS.backtest).then(r => r.ok ? r.json() : null).catch(() => null),
    ]).then(([holdings, candidates, recs, backtest]) => {
      const headerEl = document.getElementById('opt-trader-header');
      if (headerEl) headerEl.innerHTML = renderHeader(holdings);
      const bannerEl = document.getElementById('opt-trader-backtest-banner');
      if (bannerEl) bannerEl.innerHTML = renderBacktestBanner(backtest);
      const posEl = document.getElementById('opt-trader-positions');
      if (posEl) posEl.innerHTML = renderPositions(holdings);
      const btEl = document.getElementById('opt-trader-backtest');
      if (btEl) btEl.innerHTML = renderBacktest(backtest);
      const candEl = document.getElementById('opt-trader-candidates');
      if (candEl) candEl.innerHTML = renderCandidates(candidates);
      const recEl = document.getElementById('opt-trader-recommendations');
      if (recEl) recEl.innerHTML = renderRecommendations(recs);
    }).catch(err => {
      const headerEl = document.getElementById('opt-trader-header');
      if (headerEl) headerEl.innerHTML = '<div class="ai-trader-empty">Failed to load options book: ' + err + '</div>';
    });
  }

  function destroy() {}

  BT.pages['options-trader'] = { render, init, destroy };
})();
