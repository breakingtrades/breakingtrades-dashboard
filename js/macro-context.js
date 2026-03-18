/**
 * BreakingTrades — Macro Context Strip
 * Editorial layer below the ticker tape: VIX regime, SPY/QQQ SMA context, F&G, DXY, Oil, BTC notes
 * Reads from data/*.json files
 */
(function() {
  const el = document.getElementById('macro-context');
  if (!el) return;

  function pill(label, value, valueCls, notes) {
    const noteHtml = (notes || []).filter(Boolean).join(' ');
    return `<div class="macro-ctx-pill"><span class="ctx-label">${label}</span><span class="ctx-value ${valueCls}">${value}</span>${noteHtml}</div>`;
  }
  function tag(text, cls) { return `<span class="ctx-tag ${cls}">${text}</span>`; }
  function note(text, cls) { return `<span class="ctx-note ${cls}">${text}</span>`; }

  Promise.all([
    fetch('data/vix.json').then(r => r.ok ? r.json() : null).catch(() => null),
    fetch('data/watchlist.json').then(r => r.ok ? r.json() : null).catch(() => null),
    fetch('data/fear-greed.json').then(r => r.ok ? r.json() : null).catch(() => null),
  ]).then(([vix, wl, fg]) => {
    const pills = [];
    const tickers = Array.isArray(wl) ? wl : [];
    const find = sym => tickers.find(t => (t.symbol || t.ticker) === sym);

    // SPY context
    const spy = find('SPY');
    if (spy && spy.price) {
      const cls = spy.change >= 0 ? 'ctx-up' : 'ctx-down';
      const arrow = spy.change >= 0 ? '▲' : '▼';
      const notes = [];
      if (spy.sma20) {
        if (spy.price > spy.sma20) notes.push(note(`${arrow} Above SMA20`, 'ctx-up'));
        else notes.push(note(`${arrow} Below SMA20`, 'ctx-down'));
      }
      pills.push(pill('S&P 500', spy.price.toLocaleString(), cls, notes));
    }

    // VIX context  
    if (vix && vix.current != null) {
      const v = vix.current;
      const cls = v > 25 ? 'ctx-down' : v > 18 ? 'ctx-warn' : 'ctx-up';
      const notes = [];
      if (vix.sma20) notes.push(note(`SMA20: ${vix.sma20.toFixed(2)}`, 'ctx-neutral'));
      if (vix.regime) {
        const rcls = vix.regime === 'High' ? 'ctx-tag-red' : vix.regime === 'Elevated' ? 'ctx-tag-orange' : 'ctx-tag-green';
        notes.push(tag(vix.regime, rcls));
      }
      pills.push(pill('VIX', v.toFixed(2), cls, notes));
    }

    // DXY
    const dxy = find('DXY') || find('UUP');
    if (dxy && dxy.price) {
      const notes = [];
      if (dxy.sma20) {
        if (dxy.price > dxy.sma20) notes.push(note(`▲ SMA20: ${dxy.sma20.toFixed(2)}`, 'ctx-up'));
        else notes.push(note(`▼ SMA20: ${dxy.sma20.toFixed(2)}`, 'ctx-down'));
      }
      pills.push(pill('DXY', dxy.price, '', notes));
    }

    // F&G context
    if (fg) {
      const v = Math.round(fg.current?.value ?? fg.value ?? fg.score ?? 0);
      if (v) {
        const label = v <= 25 ? 'Extreme Fear' : v <= 45 ? 'Fear' : v <= 55 ? 'Neutral' : v <= 75 ? 'Greed' : 'Extreme Greed';
        const cls = v <= 25 ? 'ctx-down' : v <= 45 ? 'ctx-warn' : v <= 55 ? 'ctx-neutral' : 'ctx-up';
        pills.push(pill('F&G', v, cls, [note(label, cls)]));
      }
    }

    // Oil — check for crude/CL/OIL in watchlist
    const oil = find('CL') || find('OIL') || find('USO');
    if (oil && oil.price) {
      const cls = oil.change >= 0 ? 'ctx-up' : 'ctx-down';
      const notes = [];
      if (oil.sma20 && oil.price > oil.sma20 * 1.05) notes.push(tag('BREAKOUT', 'ctx-tag-green'));
      else if (oil.sma20 && oil.price > oil.sma20) notes.push(note('▲ Above SMA20', 'ctx-up'));
      else if (oil.sma20) notes.push(note('▼ Below SMA20', 'ctx-down'));
      pills.push(pill('OIL', `$${oil.price}`, cls, notes));
    }

    // 10Y
    const ty = find('TLT') || find('US10Y');
    if (ty && ty.price) {
      const notes = [];
      if (ty.change != null) {
        const dir = Math.abs(ty.change) < 0.3 ? '→ stable' : ty.change > 0 ? '▲ rising' : '▼ falling';
        const cls = Math.abs(ty.change) < 0.3 ? 'ctx-neutral' : ty.change > 0 ? 'ctx-down' : 'ctx-up';
        notes.push(note(dir, cls));
      }
      pills.push(pill('10Y', ty.price, '', notes));
    }

    // BTC
    const btc = find('BTC-USD') || find('BTC') || find('IBIT');
    if (btc && btc.price) {
      const notes = [];
      if (btc.sma20 && btc.price > btc.sma20) notes.push(note('▲ Above SMA20', 'ctx-up'));
      else if (btc.sma20 && btc.price < btc.sma20) notes.push(note('→ base', 'ctx-neutral'));
      pills.push(pill('BTC', `$${btc.price.toLocaleString()}`, '', notes));
    }

    if (pills.length) el.innerHTML = pills.join('');
    else el.style.display = 'none';
  });
})();
