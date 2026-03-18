/**
 * BreakingTrades — Macro Context Strip
 * Primary data strip: key indices, volatility, rates, sentiment with editorial context
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

  function smaNote(ticker) {
    if (!ticker || !ticker.sma20 || !ticker.price) return null;
    if (ticker.price > ticker.sma20) return note('▲ SMA20', 'ctx-up');
    return note('▼ SMA20', 'ctx-down');
  }

  function changePct(ticker) {
    if (!ticker || ticker.change == null || !ticker.price) return null;
    const pct = ticker.change;
    const cls = pct >= 0 ? 'ctx-up' : 'ctx-down';
    const sign = pct >= 0 ? '+' : '';
    return note(`${sign}${pct.toFixed(2)}%`, cls);
  }

  Promise.all([
    fetch('data/vix.json').then(r => r.ok ? r.json() : null).catch(() => null),
    fetch('data/watchlist.json').then(r => r.ok ? r.json() : null).catch(() => null),
    fetch('data/fear-greed.json').then(r => r.ok ? r.json() : null).catch(() => null),
  ]).then(([vix, wl, fg]) => {
    const pills = [];
    const tickers = Array.isArray(wl) ? wl : [];
    const find = sym => tickers.find(t => (t.symbol || t.ticker) === sym);

    // SPY
    const spy = find('SPY');
    if (spy && spy.price) {
      pills.push(pill('S&P 500', spy.price.toLocaleString(), spy.change >= 0 ? 'ctx-up' : 'ctx-down', [changePct(spy), smaNote(spy)]));
    }

    // QQQ
    const qqq = find('QQQ');
    if (qqq && qqq.price) {
      pills.push(pill('Nasdaq', qqq.price.toLocaleString(), qqq.change >= 0 ? 'ctx-up' : 'ctx-down', [changePct(qqq), smaNote(qqq)]));
    }

    // IWM
    const iwm = find('IWM');
    if (iwm && iwm.price) {
      pills.push(pill('Russell', iwm.price.toLocaleString(), iwm.change >= 0 ? 'ctx-up' : 'ctx-down', [changePct(iwm)]));
    }

    // VIX
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

    // F&G
    if (fg) {
      const v = Math.round(fg.current?.value ?? fg.value ?? fg.score ?? 0);
      if (v) {
        const label = v <= 25 ? 'Extreme Fear' : v <= 45 ? 'Fear' : v <= 55 ? 'Neutral' : v <= 75 ? 'Greed' : 'Extreme Greed';
        const cls = v <= 25 ? 'ctx-down' : v <= 45 ? 'ctx-warn' : v <= 55 ? 'ctx-neutral' : 'ctx-up';
        pills.push(pill('F&G', v, cls, [note(label, cls)]));
      }
    }

    // 10Y (TLT as proxy)
    const tlt = find('TLT');
    if (tlt && tlt.price) {
      const notes = [changePct(tlt)];
      if (tlt.change != null) {
        const stable = Math.abs(tlt.change) < 0.3;
        if (stable) notes.push(note('→ stable', 'ctx-neutral'));
      }
      pills.push(pill('10Y', tlt.price, '', notes));
    }

    // DXY / UUP
    const dxy = find('DXY') || find('UUP');
    if (dxy && dxy.price) {
      pills.push(pill('DXY', dxy.price, '', [changePct(dxy), smaNote(dxy)]));
    }

    // Gold
    const gld = find('GLD') || find('GOLD');
    if (gld && gld.price) {
      pills.push(pill('Gold', `$${gld.price}`, gld.change >= 0 ? 'ctx-up' : 'ctx-down', [changePct(gld)]));
    }

    // Oil
    const oil = find('CL=F') || find('USO') || find('CL') || find('OIL');
    if (oil && oil.price) {
      const notes = [changePct(oil)];
      if (oil.sma20 && oil.price > oil.sma20 * 1.05) notes.push(tag('BREAKOUT', 'ctx-tag-green'));
      pills.push(pill('Oil', `$${oil.price}`, oil.change >= 0 ? 'ctx-up' : 'ctx-down', notes));
    }

    // BTC
    const btc = find('BTC-USD') || find('BTC') || find('IBIT');
    if (btc && btc.price) {
      pills.push(pill('BTC', `$${btc.price.toLocaleString()}`, btc.change >= 0 ? 'ctx-up' : 'ctx-down', [changePct(btc), smaNote(btc)]));
    }

    if (pills.length) el.innerHTML = pills.join('');
    else el.style.display = 'none';
  });
})();
