/**
 * pages/signals.js — Signals page module for BreakingTrades v2
 * Registers as BT.pages.signals with render(), init(), destroy()
 */
(function() {
  'use strict';

  // === TICKER DATA ===
  var TICKERS = [
    {
      symbol:'NVDA', name:'NVIDIA', sector:'Semiconductors', exchange:'NASDAQ',
      price:183.22, change:-13.7, bias:'bear', status:'exit',
      statusLabel:'EXIT SIGNAL', statusIcon:'⚠', badgeClass:'exit-badge',
      sma20:184.80, sma50:185.33, w20:184.00, rsi:38.2,
      stop:170, entry:184, t1:210, t2:225,
      entryZone:null,
      pattern:{name:'Head & Shoulders',abbr:'H&S',type:'Bearish',level:'$170 neckline'},
      vol:{atr:8.50,atrPct:4.6,rating:'High',current:'45.2M',avgRatio:1.8},
      analysis:'Critical level: $170 H&S neckline. Below SMA20 ($184.80) and SMA50 ($185.33). Watching for break or resolution. If $170 holds, potential double-bottom. If lost, next support $150.',
      exitWarning:'Below SMA20 ($184.80) — Critical $170 H&S neckline. Daily close below = confirmed breakdown.',
      sparkline:[82,80,78,82,76,73,78,70,68,72,65,62,67,60,58,63,55,52,56,48,45,50,42,38,42,35,32,28,25,22]
    },
    {
      symbol:'AAPL', name:'Apple', sector:'Technology', exchange:'NASDAQ',
      price:252.82, change:-12.4, bias:'mixed', status:'exit',
      statusLabel:'EXIT SIGNAL', statusIcon:'⚠', badgeClass:'exit-badge',
      sma20:262.45, sma50:262.26, w20:266.25, rsi:23.9,
      stop:235, entry:248, t1:275, t2:290,
      entryZone:null,
      pattern:{name:'Falling Wedge',abbr:'Wedge',type:'Bullish',level:'$248 breakout'},
      vol:{atr:6.20,atrPct:2.5,rating:'Normal',current:'52.1M',avgRatio:1.2},
      analysis:'Below SMA20 ($262.45). RSI 23.9 deeply oversold — potential snap-back rally candidate. Falling wedge forming with breakout level at $248. Wait for daily close above SMA20 to re-enter.',
      exitWarning:'Below SMA20 ($262.45) — RSI 23.9 oversold. Falling wedge forming, watch $248 breakout.',
      sparkline:[75,72,70,74,68,65,70,63,60,64,58,55,59,52,50,54,47,44,48,42,38,42,36,33,37,30,28,25,22,20]
    },
    {
      symbol:'PFE', name:'Pfizer', sector:'Healthcare', exchange:'NYSE',
      price:26.61, change:-1.4, bias:'mixed', status:'approaching',
      statusLabel:'APPROACHING', statusIcon:'⏳', badgeClass:'approaching-badge',
      sma20:26.98, sma50:26.46, w20:26.06, rsi:43.2,
      stop:24.50, entry:26.00, t1:28.00, t2:29.50,
      entryZone:{low:25.80,high:26.20,distance:1.6},
      pattern:{name:'Double Bottom',abbr:'Dbl Btm',type:'Bullish',level:'$26.50 neckline'},
      vol:{atr:0.65,atrPct:2.4,rating:'Normal',current:'28.5M',avgRatio:1.1},
      analysis:'Healthcare holding relative strength. PFE testing SMA50 support at $26.46. If it holds and reclaims SMA20 ($26.98), that\'s the entry. Stop below Weekly 20 at $24.50. Pharma flows showing accumulation.',
      exitWarning:null,
      sparkline:[45,48,42,50,46,52,48,44,50,46,42,48,44,40,46,42,48,44,40,46,42,38,44,40,36,42,38,44,40,38]
    },
    {
      symbol:'ABBV', name:'AbbVie', sector:'Healthcare', exchange:'NYSE',
      price:221.45, change:-2.1, bias:'mixed', status:'approaching',
      statusLabel:'APPROACHING', statusIcon:'⏳', badgeClass:'approaching-badge',
      sma20:228.29, sma50:224.43, w20:226.37, rsi:40.1,
      stop:210, entry:219, t1:240, t2:245,
      entryZone:{low:218,high:220,distance:0.7},
      pattern:{name:'Pullback to Support',abbr:'PB Spt',type:'Neutral',level:'$218 support'},
      vol:{atr:5.80,atrPct:2.6,rating:'Normal',current:'8.2M',avgRatio:1.3},
      analysis:'Pulling back into value zone. All MAs above price = headwinds, but RSI 40 with healthcare relative strength says this is a dip-buy candidate. Need to see $218 hold.',
      exitWarning:null,
      sparkline:[55,58,52,56,50,54,48,52,46,50,44,48,42,46,40,44,48,42,46,40,44,38,42,38,44,40,42,38,40,36]
    },
    {
      symbol:'XLU', name:'Utilities Select Sector', sector:'ETF', exchange:'AMEX',
      price:47.26, change:0.9, bias:'bull', status:'active',
      statusLabel:'BULLISH STACK', statusIcon:'✦', badgeClass:'active-badge',
      sma20:46.82, sma50:44.68, w20:44.50, rsi:50.7,
      stop:44.50, entry:45.50, t1:47.75, t2:49.00,
      entryZone:null,
      pattern:{name:'Bull Flag',abbr:'Bull Flag',type:'Bullish',level:'$47.50 breakout'},
      vol:{atr:0.85,atrPct:1.8,rating:'Low',current:'12.8M',avgRatio:0.9},
      analysis:'Perfect bullish stack: Price > SMA20 > SMA50 > W20. Utilities leading in late-cycle rotation — this is the playbook. Only -1.1% from 6mo high. Raise stop to SMA20 ($46.82).',
      exitWarning:null,
      sparkline:[25,28,30,27,32,35,33,38,40,37,42,45,43,48,50,47,52,55,53,58,60,57,62,65,63,68,70,72,75,78]
    },
    {
      symbol:'AR', name:'Antero Resources', sector:'Energy', exchange:'NYSE',
      price:41.03, change:11.0, bias:'bull', status:'active',
      statusLabel:'TRAILING — Raise Stop', statusIcon:'📈', badgeClass:'trailing-badge',
      sma20:36.98, sma50:35.00, w20:35.48, rsi:83.3,
      stop:35.00, entry:36.50, t1:42.00, t2:45.00,
      entryZone:null,
      pattern:{name:'Parabolic Extension',abbr:'Parabolic',type:'Caution',level:'$38 support'},
      vol:{atr:2.40,atrPct:5.8,rating:'High',current:'6.5M',avgRatio:2.1},
      analysis:'Energy is the best sector of 2026. AR extended but trend is powerful. Oil at $94 supports thesis. RSI overbought = don\'t chase, trail. Raise stop to $36.98 (SMA20). If daily close below $36.98, exit.',
      exitWarning:'RSI 83.3 — Overbought. Consider trailing stop to SMA20 ($36.98) or partial take profit at $42.',
      sparkline:[20,24,22,28,32,30,36,40,38,44,48,45,50,55,52,58,62,60,65,68,66,72,75,73,78,80,82,85,88,90]
    },
    {
      symbol:'DELL', name:'Dell Technologies', sector:'Technology', exchange:'NASDAQ',
      price:156.54, change:14.5, bias:'bull', status:'active',
      statusLabel:'BULLISH STACK', statusIcon:'✦', badgeClass:'active-badge',
      sma20:136.72, sma50:126.05, w20:132.03, rsi:80.0,
      stop:136.72, entry:150, t1:165, t2:175,
      entryZone:null,
      pattern:{name:'Channel Breakout',abbr:'Ch Brk',type:'Bullish',level:'$150 support'},
      vol:{atr:6.50,atrPct:4.2,rating:'High',current:'9.8M',avgRatio:1.5},
      analysis:'Strong SMA stack but way extended — RSI 80. SMA20 is at $136 while price is $156. That\'s a 14.5% gap. Don\'t chase. If it pulls back to SMA20, that\'s the add. Current stop: SMA20 at $136.72.',
      exitWarning:'RSI 80.0 — Overbought. Extended 14.5% above SMA20. Don\'t chase, trail stop.',
      sparkline:[22,25,28,26,32,35,33,38,42,40,45,48,46,50,55,52,58,62,60,65,68,66,72,75,73,78,82,80,85,88]
    },
    {
      symbol:'MSFT', name:'Microsoft', sector:'Technology', exchange:'NASDAQ',
      price:399.95, change:-27.8, bias:'bear', status:'exit',
      statusLabel:'EXIT SIGNAL', statusIcon:'⚠', badgeClass:'exit-badge',
      sma20:400.10, sma50:427.62, w20:440.75, rsi:35.0,
      stop:375, entry:390, t1:430, t2:450,
      entryZone:null,
      pattern:{name:'Bear Flag',abbr:'Bear Flag',type:'Bearish',level:'$390 breakdown'},
      vol:{atr:9.10,atrPct:2.3,rating:'Normal',current:'32.4M',avgRatio:1.4},
      analysis:'Below ALL moving averages. SMA20 $400.10, SMA50 $427.62, W20 $440.75. Bearish structure. Bear flag forming — breakdown below $390 confirms further downside to $360.',
      exitWarning:'Below ALL moving averages. Bear flag forming with $390 breakdown level.',
      sparkline:[78,75,80,72,68,74,65,62,68,58,55,60,52,48,54,45,42,48,40,36,42,34,30,36,28,25,30,22,20,18]
    },
    {
      symbol:'META', name:'Meta Platforms', sector:'Technology', exchange:'NASDAQ',
      price:627.45, change:-20.7, bias:'bear', status:'exit',
      statusLabel:'EXIT SIGNAL', statusIcon:'⚠', badgeClass:'exit-badge',
      sma20:640.00, sma50:660.00, w20:670.00, rsi:46.1,
      stop:580, entry:600, t1:660, t2:700,
      entryZone:null,
      pattern:{name:'Descending Triangle',abbr:'Desc Tri',type:'Bearish',level:'$600 support'},
      vol:{atr:18.50,atrPct:2.9,rating:'Normal',current:'18.7M',avgRatio:1.1},
      analysis:'Below all MAs. Descending triangle forming with key support at $600. If $600 breaks, downside targets $550–$560. RSI 46.1 neutral but trend is bearish.',
      exitWarning:'Below all MAs — Descending triangle. $600 support is critical.',
      sparkline:[72,70,74,68,65,70,62,58,64,55,52,58,50,46,52,44,40,46,38,42,36,40,34,38,32,36,30,34,28,32]
    },
    {
      symbol:'AMZN', name:'Amazon', sector:'Technology', exchange:'NASDAQ',
      price:211.74, change:-18.1, bias:'mixed', status:'watching',
      statusLabel:'WATCHING', statusIcon:'👁', badgeClass:'watching-badge',
      sma20:208.00, sma50:220.00, w20:230.00, rsi:53.8,
      stop:200, entry:215, t1:235, t2:250,
      entryZone:null,
      pattern:{name:'Inverse H&S',abbr:'Inv H&S',type:'Bullish',level:'$215 neckline'},
      vol:{atr:7.20,atrPct:3.4,rating:'Normal',current:'42.3M',avgRatio:1.3},
      analysis:'Above SMA20 but below SMA50 and W20. Inverse H&S forming with neckline at $215. Break above $215 needed for confirmation. RSI 53.8 neutral — room either way.',
      exitWarning:null,
      sparkline:[55,50,58,52,48,56,44,50,42,48,54,40,46,52,38,44,50,36,42,48,34,40,46,38,42,36,40,44,38,42]
    },
    {
      symbol:'COIN', name:'Coinbase', sector:'Crypto', exchange:'NASDAQ',
      price:203.32, change:10.3, bias:'mixed', status:'watching',
      statusLabel:'WATCHING', statusIcon:'👁', badgeClass:'watching-badge',
      sma20:195.00, sma50:190.00, w20:220.00, rsi:72.6,
      stop:185, entry:210, t1:240, t2:260,
      entryZone:null,
      pattern:{name:'Ascending Triangle',abbr:'Asc Tri',type:'Bullish',level:'$210 breakout'},
      vol:{atr:12.80,atrPct:6.3,rating:'Extreme',current:'15.2M',avgRatio:2.3},
      analysis:'Above SMA20/50 but below W20 ($220). Ascending triangle with breakout at $210. BTC correlation key — if BTC breaks $70K, COIN follows. RSI 72.6 getting warm.',
      exitWarning:null,
      sparkline:[30,34,28,36,40,32,42,38,44,40,48,42,50,46,52,48,54,50,56,52,58,54,60,56,62,58,64,60,66,62]
    },
    {
      symbol:'ARM', name:'Arm Holdings', sector:'Semiconductors', exchange:'NASDAQ',
      price:121.70, change:-33.6, bias:'mixed', status:'watching',
      statusLabel:'WATCHING', statusIcon:'👁', badgeClass:'watching-badge',
      sma20:125.00, sma50:130.00, w20:121.67, rsi:42.5,
      stop:105, entry:118, t1:140, t2:155,
      entryZone:null,
      pattern:{name:'Falling Wedge',abbr:'Wedge',type:'Bullish',level:'$118 breakout'},
      vol:{atr:6.90,atrPct:5.7,rating:'High',current:'11.4M',avgRatio:1.6},
      analysis:'At W20 ($121.67) — potential bounce zone. Falling wedge forming. Deep drawdown at -33.6% but semis are cyclical. Need confirmation above $125 to turn bullish.',
      exitWarning:null,
      sparkline:[68,65,70,62,58,64,55,60,52,56,48,52,44,48,40,44,36,40,32,36,38,34,42,36,38,34,40,36,38,34]
    },
    {
      symbol:'GOOG', name:'Alphabet', sector:'Technology', exchange:'NASDAQ',
      price:308.57, change:-11.9, bias:'mixed', status:'watching',
      statusLabel:'WATCHING', statusIcon:'👁', badgeClass:'watching-badge',
      sma20:306.80, sma50:320.00, w20:325.00, rsi:48.3,
      stop:290, entry:306, t1:330, t2:350,
      entryZone:null,
      pattern:{name:'Support Test',abbr:'Spt Test',type:'Neutral',level:'$306 support'},
      vol:{atr:8.30,atrPct:2.7,rating:'Normal',current:'22.8M',avgRatio:1.0},
      analysis:'Just above SMA20 ($306.80) — needs to hold. Support test at $306 is critical. If it holds, could bounce to SMA50 ($320). If lost, $290 is next support.',
      exitWarning:null,
      sparkline:[50,48,52,46,50,44,48,42,46,40,44,48,42,46,40,44,40,46,42,38,44,40,42,38,44,40,38,42,38,40]
    }
  ];

  // === SECTOR ROTATION DATA ===
  var sectorRotation = [
    { symbol:'XLU', name:'Utilities', x:30, y:70, px:15, py:45, quadrant:'leading' },
    { symbol:'XLE', name:'Energy', x:25, y:65, px:10, py:35, quadrant:'leading' },
    { symbol:'XLP', name:'Staples', x:5, y:55, px:-5, py:40, quadrant:'improving' },
    { symbol:'XLF', name:'Financials', x:-15, y:-10, px:5, py:15, quadrant:'weakening' },
    { symbol:'XLK', name:'Technology', x:-30, y:-25, px:-10, py:10, quadrant:'lagging' },
    { symbol:'XLY', name:'Discretionary', x:-20, y:-15, px:-5, py:20, quadrant:'weakening' },
    { symbol:'XLV', name:'Healthcare', x:10, y:40, px:-5, py:25, quadrant:'improving' },
    { symbol:'XLI', name:'Industrials', x:-5, y:5, px:10, py:25, quadrant:'weakening' },
    { symbol:'XLC', name:'Communication', x:-25, y:-20, px:-10, py:5, quadrant:'lagging' },
    { symbol:'XLRE', name:'Real Estate', x:15, y:30, px:-5, py:10, quadrant:'improving' },
    { symbol:'XLB', name:'Materials', x:-10, y:10, px:5, py:30, quadrant:'improving' }
  ];

  var STATUS_ORDER = ['approaching','active','exit','watching'];
  var STATUS_CONFIG = {
    approaching: { icon:'🟡', label:'Approaching Entry', filter:'approaching' },
    active: { icon:'🟢', label:'Active / Bullish Stack', filter:'active' },
    exit: { icon:'⚠️', label:'Exit Signals — Below SMA20', filter:'exit' },
    watching: { icon:'👁', label:'Watching', filter:'watching' }
  };

  // === PAIR RATIOS CONFIG ===
  var PAIRS = [
    { num:'XLY', den:'XLP', label:'XLY/XLP', upMsg:'Consumer risk-on', downMsg:'Consumer weakening', flatMsg:'Consumer neutral' },
    { num:'HYG', den:'SPY', label:'HYG/SPY', upMsg:'Credit risk-on', downMsg:'Credit stress', flatMsg:'Credit stable' },
    { num:'IWM', den:'SPY', label:'IWM/SPY', upMsg:'Small caps leading', downMsg:'Large caps leading', flatMsg:'Breadth flat' },
    { num:'XLV', den:'SPY', label:'XLV/SPY', upMsg:'Defensive rotation', downMsg:'No defensive rotation', flatMsg:'Healthcare neutral' },
    { num:'XLE', den:'SPY', label:'XLE/SPY', upMsg:'Energy outperforming', downMsg:'Energy lagging', flatMsg:'Energy neutral' },
    { num:'IWM', den:'QQQ', label:'IWM/QQQ', upMsg:'Value > Growth', downMsg:'Growth > Value', flatMsg:'Value/Growth flat' },
    { num:'GLD', den:'SPY', label:'GLD/SPY', upMsg:'Safe haven bid', downMsg:'Risk appetite', flatMsg:'Gold neutral' },
    { num:'TLT', den:'SPY', label:'TLT/SPY', upMsg:'Flight to bonds', downMsg:'Bonds lagging', flatMsg:'Bonds neutral' }
  ];
  var PAIR_THRESHOLD = 0.01;

  // === STATE ===
  var activeStatusFilter = 'all';
  var activeBiasFilters = { bull:true, mixed:true, bear:true };
  var searchQuery = '';
  var sortMode = 'status';
  var _sectorRiskData = {};
  var _rrg = null;
  var _boundHandlers = {};

  // === UTILITY ===
  function getExchange(ticker) {
    var nasdaq = ['AAPL','AMZN','GOOG','MSFT','NVDA','META','COIN','ARM','DELL'];
    var amex = ['XLU'];
    if (nasdaq.indexOf(ticker) >= 0) return 'NASDAQ';
    if (amex.indexOf(ticker) >= 0) return 'AMEX';
    return 'NYSE';
  }

  function fmtPrice(n) {
    return n >= 1000 ? n.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})
      : Number(n).toFixed(2);
  }

  function pctDiff(from, to) {
    return ((to - from) / from * 100).toFixed(1);
  }

  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

  function generateSparkline(data, bias) {
    var w = 200, h = 36, pad = 2;
    var max = Math.max.apply(null, data), min = Math.min.apply(null, data);
    var range = max - min || 1;
    var pts = data.map(function(v, i) {
      var x = pad + (i / (data.length - 1)) * (w - pad * 2);
      var y = pad + (1 - (v - min) / range) * (h - pad * 2);
      return x.toFixed(1) + ',' + y.toFixed(1);
    }).join(' ');
    var color = bias === 'bull' ? '#00d4aa' : bias === 'bear' ? '#ef5350' : '#ffa726';
    var gradId = 'sg' + Math.random().toString(36).substr(2,6);
    return '<svg viewBox="0 0 ' + w + ' ' + h + '" class="sparkline-svg" preserveAspectRatio="none">' +
      '<defs><linearGradient id="' + gradId + '" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" stop-color="' + color + '" stop-opacity="0.15"/>' +
      '<stop offset="100%" stop-color="' + color + '" stop-opacity="0"/>' +
      '</linearGradient></defs>' +
      '<polygon points="' + pts + ' ' + (w-pad) + ',' + h + ' ' + pad + ',' + h + '" fill="url(#' + gradId + ')"/>' +
      '<polyline points="' + pts + '" fill="none" stroke="' + color + '" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>' +
    '</svg>';
  }

  // === RENDER FUNCTIONS ===
  function renderStatusTabs() {
    var el = document.getElementById('status-tabs');
    if (!el) return;
    var counts = { all: TICKERS.length };
    STATUS_ORDER.forEach(function(s) { counts[s] = TICKERS.filter(function(t) { return t.status === s; }).length; });

    var tabs = [
      { key:'all', label:'All', icon:'' },
      { key:'approaching', label:'Approaching', icon:'🟡 ' },
      { key:'active', label:'Active', icon:'🟢 ' },
      { key:'exit', label:'Exit Signal', icon:'⚠️ ' },
      { key:'watching', label:'Watching', icon:'👁 ' }
    ];

    el.innerHTML = tabs.map(function(t) {
      return '<div class="status-tab' + (activeStatusFilter === t.key ? ' active' : '') + '" data-filter="' + t.key + '">' +
        t.icon + t.label + ' <span class="badge">' + counts[t.key] + '</span></div>';
    }).join('');

    // Bind click handlers
    var tabEls = el.querySelectorAll('.status-tab');
    for (var i = 0; i < tabEls.length; i++) {
      tabEls[i].addEventListener('click', function() {
        activeStatusFilter = this.getAttribute('data-filter');
        _savePref();
        renderStatusTabs();
        renderCards();
      });
    }
  }

  function renderCard(t, idx) {
    var pc = t.change >= 0 ? 'up' : 'down';
    var arrow = t.change >= 0 ? '▲' : '▼';
    var bc = 'bias-' + t.bias;
    var sma20Rel = t.price > t.sma20 ? 'above' : 'below';
    var sma50Rel = t.price > t.sma50 ? 'above' : 'below';
    var w20Rel = t.price > t.w20 ? 'above' : 'below';
    var sma20Arr = t.price > t.sma20 ? '↑' : '↓';
    var sma50Arr = t.price > t.sma50 ? '↑' : '↓';
    var w20Arr = t.price > t.w20 ? '↑' : '↓';

    var range = t.t2 - t.stop;
    var pricePct = clamp(((t.price - t.stop) / range) * 100, 2, 98);
    var entryPct = clamp(((t.entry - t.stop) / range) * 100, 5, 95);
    var t1Pct = clamp(((t.t1 - t.stop) / range) * 100, 5, 95);

    var fillColor = t.change >= 0
      ? 'linear-gradient(90deg, #00d4aa 0%, #00d4aa 100%)'
      : 'linear-gradient(90deg, #ef5350 0%, #ffa726 100%)';

    var patClass = t.pattern.type === 'Bearish' ? 'pat-bearish'
      : t.pattern.type === 'Bullish' || (t.pattern.type && t.pattern.type.indexOf('reversal') >= 0) ? 'pat-bullish'
      : t.pattern.type === 'Caution' ? 'pat-caution' : 'pat-neutral';

    var volClass = t.vol.rating === 'Extreme' ? 'vol-extreme'
      : t.vol.rating === 'High' ? 'vol-high'
      : t.vol.rating === 'Low' ? 'vol-low' : 'vol-normal';

    var rsiStyle = t.rsi > 70 ? ' style="color:var(--red)"' : t.rsi < 30 ? ' style="color:var(--cyan)"' : '';
    var rsiSuffix = t.rsi > 70 ? ' OB' : t.rsi < 30 ? ' OS' : '';

    var t1Pctg = pctDiff(t.price, t.t1);
    var stopPctg = pctDiff(t.price, t.stop);

    var statusClass = t.badgeClass === 'trailing-badge' ? 's-trailing' : 's-' + t.status;

    var distLine = t.entryZone
      ? '<div class="distance-line">Entry zone: $' + t.entryZone.low + '–$' + t.entryZone.high + ' — <strong>' + t.entryZone.distance + '% away</strong></div>' : '';

    var exitLine = t.exitWarning
      ? '<div class="exit-warning">⚠ ' + t.exitWarning + '</div>' : '';

    var sectorRiskHtml = '';
    if (t._sectorRisk) {
      sectorRiskHtml = '<span class="sector-risk-badge sr-' + t._sectorRisk.risk + '" title="' + (t._sectorRisk.etf||'') + ' ' + t._sectorRisk.quadrant + '">🔄 ' + t._sectorRisk.quadrant + '</span>';
    }

    return '<div class="setup-card ' + statusClass + ' card-animate" data-ticker="' + t.symbol + '" data-status="' + t.status + '" data-bias="' + t.bias + '" data-sector="' + t.sector + '" style="animation-delay:' + (idx * 0.04) + 's">' +
      '<div class="card-top">' +
        '<div>' +
          '<div class="card-ticker">' + t.symbol + '</div>' +
          '<div class="card-name">' + t.name + ' · ' + t.sector + '</div>' +
        '</div>' +
        '<div class="card-price">' +
          '<div class="price ' + pc + '">$' + fmtPrice(t.price) + '</div>' +
          '<div class="change ' + pc + '">' + arrow + ' ' + Math.abs(t.change).toFixed(1) + '%</div>' +
        '</div>' +
      '</div>' +
      '<div class="card-meta">' +
        '<span class="status-badge ' + t.badgeClass + '">' + t.statusIcon + ' ' + t.statusLabel + '</span>' +
        '<span class="bias-badge ' + bc + '">' + t.bias.toUpperCase() + '</span>' +
        '<span class="pattern-badge ' + patClass + '">📊 ' + t.pattern.abbr + '</span>' +
        '<span class="volatility-badge ' + volClass + '">⚡ ' + t.vol.rating + '</span>' +
        sectorRiskHtml +
      '</div>' +
      distLine +
      '<div class="range-bar-container">' +
        '<div class="range-bar">' +
          '<span class="range-marker stop" style="left:0%">$' + t.stop + '</span>' +
          '<span class="range-marker entry" style="left:' + entryPct + '%">$' + t.entry + '</span>' +
          '<span class="range-marker t1" style="left:' + t1Pct + '%">$' + t.t1 + '</span>' +
          '<span class="range-marker t2" style="left:100%">$' + t.t2 + '</span>' +
          '<div class="range-fill" style="width:' + pricePct + '%;background:' + fillColor + ';opacity:0.2;"></div>' +
          '<div class="price-dot" style="left:' + pricePct + '%"></div>' +
        '</div>' +
      '</div>' +
      '<div class="sparkline-container">' + generateSparkline(t.sparkline, t.bias) + '</div>' +
      '<div class="levels-row">' +
        '<div class="level-pill"><div class="dot ' + sma20Rel + '"></div><span class="lbl">SMA20</span><span class="val">$' + t.sma20.toFixed(2) + ' ' + sma20Arr + '</span></div>' +
        '<div class="level-pill"><div class="dot ' + sma50Rel + '"></div><span class="lbl">SMA50</span><span class="val">$' + t.sma50.toFixed(2) + ' ' + sma50Arr + '</span></div>' +
        '<div class="level-pill"><div class="dot ' + w20Rel + '"></div><span class="lbl">W20</span><span class="val">$' + t.w20.toFixed(2) + ' ' + w20Arr + '</span></div>' +
        '<div class="level-pill"><span class="lbl"' + rsiStyle + '>RSI</span><span class="val"' + rsiStyle + '>' + t.rsi + rsiSuffix + '</span></div>' +
      '</div>' +
      '<div class="card-stats">' +
        '<span>🎯 T1: $' + t.t1 + ' (' + (t1Pctg > 0 ? '+' : '') + t1Pctg + '%) · Stop: $' + t.stop + ' (' + stopPctg + '%)</span>' +
        '<span>⚡ Vol: ' + t.vol.current + ' (' + t.vol.avgRatio + 'x avg) · ATR: $' + t.vol.atr + ' (' + t.vol.atrPct + '%)</span>' +
      '</div>' +
      exitLine +
      '<div class="toms-take">' +
        '<div class="take-header">Analysis</div>' +
        t.analysis +
      '</div>' +
    '</div>';
  }

  function getFilteredTickers() {
    var filtered = TICKERS.filter(function(t) {
      if (activeStatusFilter !== 'all' && t.status !== activeStatusFilter) return false;
      if (!activeBiasFilters[t.bias]) return false;
      if (searchQuery && t.symbol.toLowerCase().indexOf(searchQuery) < 0 && t.name.toLowerCase().indexOf(searchQuery) < 0 && t.sector.toLowerCase().indexOf(searchQuery) < 0) return false;
      return true;
    });

    if (sortMode === 'change-desc') filtered.sort(function(a,b) { return b.change - a.change; });
    else if (sortMode === 'change-asc') filtered.sort(function(a,b) { return a.change - b.change; });
    else if (sortMode === 'alpha') filtered.sort(function(a,b) { return a.symbol.localeCompare(b.symbol); });
    else if (sortMode === 'rsi') filtered.sort(function(a,b) { return a.rsi - b.rsi; });

    return filtered;
  }

  function renderCards() {
    var container = document.getElementById('cards-container');
    if (!container) return;
    var filtered = getFilteredTickers();

    if (filtered.length === 0) {
      container.innerHTML = '<div class="empty-state">No setups match your filters.</div>';
      return;
    }

    if (sortMode === 'status' && activeStatusFilter === 'all') {
      var html = '';
      var cardIdx = 0;
      STATUS_ORDER.forEach(function(status) {
        var group = filtered.filter(function(t) { return t.status === status; });
        if (group.length === 0) return;
        var cfg = STATUS_CONFIG[status];
        html += '<div class="group-header"><h3>' + cfg.icon + ' ' + cfg.label + '</h3><span class="cnt">' + group.length + '</span></div>';
        group.forEach(function(t) { html += renderCard(t, cardIdx++); });
      });
      container.innerHTML = html;
    } else {
      var html2 = '';
      filtered.forEach(function(t, i) { html2 += renderCard(t, i); });
      container.innerHTML = html2;
    }

    // Bind card clicks
    var cards = container.querySelectorAll('.setup-card');
    for (var i = 0; i < cards.length; i++) {
      cards[i].addEventListener('click', function() {
        var sym = this.getAttribute('data-ticker');
        _openDetail(sym);
      });
    }
  }

  function _openDetail(symbol) {
    var t = null;
    for (var i = 0; i < TICKERS.length; i++) {
      if (TICKERS[i].symbol === symbol) { t = TICKERS[i]; break; }
    }
    if (!t) return;
    BT.components.detailModal.open(symbol, {
      tickerData: t,
      exchange: getExchange(symbol),
      sections: ['charts', 'ta', 'pattern', 'range', 'levels', 'analysis']
    });
  }

  function renderSectorRotation() {
    var qColors = { leading:'#00d4aa', improving:'#42a5f5', weakening:'#ffa726', lagging:'#ef5350' };
    var qLabels = { leading:'Leading ↗', improving:'Improving ↑', weakening:'Weakening ↓', lagging:'Lagging ↘' };
    var groups = {};
    sectorRotation.forEach(function(s) {
      if (!groups[s.quadrant]) groups[s.quadrant] = [];
      groups[s.quadrant].push(s);
    });

    var order = ['leading', 'improving', 'weakening', 'lagging'];
    var html = '<div class="sr-list">';
    order.forEach(function(q) {
      if (!groups[q] || groups[q].length === 0) return;
      var color = qColors[q];
      html += '<div class="sr-group"><div class="sr-group-label" style="color:' + color + '">' + qLabels[q] + '</div>';
      groups[q].forEach(function(s) {
        var dx = s.x - s.px, dy = s.y - s.py;
        var momentum = Math.sqrt(dx*dx + dy*dy).toFixed(0);
        var arrow = dy > 10 ? '⬆' : dy < -10 ? '⬇' : dx > 10 ? '➡' : dx < -10 ? '⬅' : '●';
        html += '<div class="sr-item">' +
          '<span class="sr-symbol" style="color:' + color + '">' + s.symbol + '</span>' +
          '<span class="sr-name">' + s.name + '</span>' +
          '<span class="sr-arrow" style="color:' + color + '">' + arrow + '</span>' +
          '<span class="sr-momentum" style="color:' + color + ';opacity:0.6;">' + momentum + '</span>' +
        '</div>';
      });
      html += '</div>';
    });
    html += '</div>';

    var sqEl = document.getElementById('sector-quadrant');
    if (sqEl) sqEl.innerHTML = html;
  }

  function renderBriefing() {
    fetch('../data/briefing.json').then(function(r) { return r.ok ? r.json() : null; }).then(function(b) {
      if (!b) return;
      var titleEl = document.getElementById('briefing-title');
      if (titleEl) titleEl.innerHTML = '🎯 ' + (b.title || 'Daily Briefing');
      var html = '';
      if (b.headline) html += '<p><strong>' + b.headline + '</strong></p>';
      if (b.body) b.body.forEach(function(p) { html += '<p>' + p + '</p>'; });
      if (b.callout_title) html += '<div class="callout"><strong>' + b.callout_title + ':</strong><br>' + (b.callout_body || '') + '</div>';
      if (b.action_items && b.action_items.length) {
        html += '<div class="callout"><strong>Action items:</strong><br>';
        b.action_items.forEach(function(a) { html += '• ' + a + '<br>'; });
        html += '</div>';
      }
      if (b.closing_quote) html += '<p style="color:var(--text-dim);font-size:11px;margin-top:12px;">"' + b.closing_quote + '"</p>';
      var contentEl = document.getElementById('briefing-content');
      if (contentEl) contentEl.innerHTML = html;
    }).catch(function() {});
  }

  function renderPairRatios(watchlist) {
    var el = document.getElementById('ratios-strip');
    if (!el) return;

    var map = {};
    for (var i = 0; i < watchlist.length; i++) {
      if (watchlist[i].symbol) map[watchlist[i].symbol] = watchlist[i];
    }

    // Overlay live prices from btPrices
    if (typeof btPrices !== 'undefined' && btPrices.isLoaded && btPrices.isLoaded()) {
      var syms = Object.keys(map);
      for (var j = 0; j < syms.length; j++) {
        var p = btPrices.get(syms[j]);
        if (p) map[syms[j]].price = p.price;
      }
    }

    var html = '';
    for (var k = 0; k < PAIRS.length; k++) {
      var pair = PAIRS[k];
      var n = map[pair.num], d = map[pair.den];
      if (!n || !d || !n.price || !d.price || !n.sma50 || !d.sma50) {
        html += '<div class="ratio-pill"><span class="name">' + pair.label + '</span><span class="signal neutral">— no data</span></div>';
        continue;
      }

      var ratio = n.price / d.price;
      var sma50Ratio = n.sma50 / d.sma50;
      var pctD = (ratio - sma50Ratio) / sma50Ratio;

      var arrowR, msg, cls;
      if (pctD > PAIR_THRESHOLD) {
        arrowR = '↗'; msg = pair.upMsg; cls = 'up';
      } else if (pctD < -PAIR_THRESHOLD) {
        arrowR = '↘'; msg = pair.downMsg; cls = 'down';
      } else {
        arrowR = '→'; msg = pair.flatMsg; cls = 'neutral';
      }

      html += '<div class="ratio-pill"><span class="name">' + pair.label + '</span><span class="signal ' + cls + '">' + arrowR + ' ' + msg + '</span></div>';
    }
    el.innerHTML = html;
  }

  // === PREFERENCES ===
  function _loadPref() {
    var prefs = BT.preferences.getPref('signals') || {};
    activeStatusFilter = prefs.statusFilter || 'all';
    activeBiasFilters = prefs.biasFilters || { bull:true, mixed:true, bear:true };
    sortMode = prefs.sortMode || 'status';
    searchQuery = prefs.searchQuery || '';
  }

  function _savePref() {
    BT.preferences.setPref('signals', {
      statusFilter: activeStatusFilter,
      biasFilters: activeBiasFilters,
      sortMode: sortMode,
      searchQuery: searchQuery
    });
  }

  // === PAGE LIFECYCLE ===
  function render(el) {
    el.innerHTML =
      '<div id="events-strip" style="display:none"></div>' +
      '<div class="ratios-strip" id="ratios-strip"></div>' +
      '<div class="signals-main">' +
        '<div class="watchlist-panel">' +
          '<div class="status-tabs" id="status-tabs"></div>' +
          '<div class="filter-bar">' +
            '<div class="filter-controls">' +
              '<input type="text" class="filter-search" id="search-input" placeholder="🔍 Search ticker...">' +
              '<div class="bias-toggles" id="bias-toggles">' +
                '<button class="bias-toggle on-bull" data-bias="bull">BULL</button>' +
                '<button class="bias-toggle on-mixed" data-bias="mixed">MIXED</button>' +
                '<button class="bias-toggle on-bear" data-bias="bear">BEAR</button>' +
              '</div>' +
              '<select class="sort-select" id="sort-select">' +
                '<option value="status">Sort: Status</option>' +
                '<option value="change-desc">Sort: % Change ↓</option>' +
                '<option value="change-asc">Sort: % Change ↑</option>' +
                '<option value="alpha">Sort: A-Z</option>' +
                '<option value="rsi">Sort: RSI</option>' +
              '</select>' +
            '</div>' +
          '</div>' +
          '<div id="cards-container"></div>' +
        '</div>' +
        '<div class="right-panel">' +
          '<div class="fear-greed-section">' +
            '<h3 id="fg-title">📉 Fear & Greed Index</h3>' +
            '<div id="fg-gauge"></div>' +
          '</div>' +
          '<div class="sector-rotation-section">' +
            '<div id="rrg-signals"></div>' +
            '<div id="sector-quadrant"></div>' +
          '</div>' +
          '<div class="briefing-panel">' +
            '<h3>📊 Market Regime</h3>' +
            '<div class="regime-card">' +
              '<div class="regime-label">Current Regime</div>' +
              '<div class="regime-value" style="color:var(--red);">⚠ CRISIS</div>' +
              '<div class="regime-desc">Geopolitical conflict driving markets. Extreme fear (F&G 14.7). S&P 28% above linear trendline — mean reversion risk. Dark pool clusters at 6500-6600 put wall. Next 60-100 days critical.</div>' +
            '</div>' +
            '<div class="regime-card">' +
              '<div class="regime-label">Risk Level</div>' +
              '<div class="regime-value" style="color:var(--red);">🔴 EXTREME</div>' +
              '<div class="regime-desc">VIX elevated. F&G 14.7 (Extreme Fear). Junk bonds falling, CDS rising. Oracle CDS at GFC levels — AI/tech canary. Bears in control: S&P in lower lows/lower highs.</div>' +
            '</div>' +
          '</div>' +
          '<div class="toms-daily">' +
            '<h3 id="briefing-title">🎯 Daily Briefing</h3>' +
            '<div class="briefing-text" id="briefing-content">' +
              '<p style="color:var(--text-dim)">Loading briefing...</p>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  function init() {
    _loadPref();

    // Restore filter UI state
    var searchEl = document.getElementById('search-input');
    if (searchEl && searchQuery) searchEl.value = searchQuery;

    var sortEl = document.getElementById('sort-select');
    if (sortEl) sortEl.value = sortMode;

    // Update bias toggle classes
    var biasToggles = document.querySelectorAll('.bias-toggle');
    for (var bt = 0; bt < biasToggles.length; bt++) {
      var bias = biasToggles[bt].getAttribute('data-bias');
      biasToggles[bt].className = 'bias-toggle ' + (activeBiasFilters[bias] ? 'on-' + bias : 'off');
    }

    // Load data in parallel
    Promise.all([
      typeof btPrices !== 'undefined' ? btPrices.load() : Promise.resolve(),
      fetch('../data/watchlist.json').then(function(r) { return r.ok ? r.json() : []; }).catch(function() { return []; }),
      fetch('../data/sector-risk.json').then(function(r) { return r.json(); }).catch(function() { return {}; })
    ]).then(function(results) {
      var watchlist = results[1];
      var sectorRisk = results[2];
      _sectorRiskData = sectorRisk;

      var wlMap = {};
      for (var w = 0; w < watchlist.length; w++) {
        if (watchlist[w].symbol) wlMap[watchlist[w].symbol] = watchlist[w];
      }

      TICKERS.forEach(function(t) {
        t._sectorRisk = _sectorRiskData[t.sector] || null;

        // Overlay live prices
        if (typeof btPrices !== 'undefined' && btPrices.isLoaded && btPrices.isLoaded()) {
          var p = btPrices.get(t.symbol);
          if (p) {
            t.price = p.price;
            t.change = p.change;
          }
        }

        // Overlay live technicals from watchlist
        var wl = wlMap[t.symbol];
        if (wl) {
          if (wl.sma20 != null) t.sma20 = wl.sma20;
          if (wl.sma50 != null) t.sma50 = wl.sma50;
          if (wl.sma200 != null) t.sma200 = wl.sma200;
          if (wl.w20 != null) t.w20 = wl.w20;
          if (wl.rsi != null) t.rsi = wl.rsi;
          if (wl.atr != null) t.vol = { atr: wl.atr, atrPct: wl.atrPct, rating: wl.volRating || t.vol.rating, current: t.vol.current, avgRatio: t.vol.avgRatio };
          if (wl.volume != null) t.vol = { atr: t.vol.atr, atrPct: t.vol.atrPct, rating: t.vol.rating, current: (wl.volume / 1e6).toFixed(1) + 'M', avgRatio: wl.volumeRatio || t.vol.avgRatio };
          if (wl.bias) t.bias = wl.bias;
        }
      });

      renderCards();
      renderPairRatios(watchlist);
    });

    // Render initial UI
    renderStatusTabs();
    renderCards();
    renderSectorRotation();
    renderBriefing();

    // Fear & Greed
    BT.components.fearGreed.fetchAndRender('fg-gauge');

    // RRG
    if (typeof createRRG === 'function') {
      _rrg = createRRG('rrg-signals', {
        trailLength: 8,
        height: '350px',
        showControls: true,
        showRankings: false,
        collapsible: true,
        storageKey: 'rrg-signals-collapsed'
      });
    }

    // Events mini strip
    if (typeof initEventsMiniStrip === 'function') {
      try { initEventsMiniStrip(); } catch(e) {}
    }

    // Bind filter controls
    _boundHandlers.searchInput = function(e) {
      searchQuery = e.target.value.toLowerCase().trim();
      _savePref();
      renderCards();
    };
    var si = document.getElementById('search-input');
    if (si) si.addEventListener('input', _boundHandlers.searchInput);

    _boundHandlers.sortChange = function(e) {
      sortMode = e.target.value;
      _savePref();
      renderCards();
    };
    var ss = document.getElementById('sort-select');
    if (ss) ss.addEventListener('change', _boundHandlers.sortChange);

    // Bias toggles
    var btns = document.querySelectorAll('.bias-toggle');
    _boundHandlers.biasClicks = [];
    for (var i = 0; i < btns.length; i++) {
      (function(btn) {
        var handler = function() {
          var b = btn.getAttribute('data-bias');
          activeBiasFilters[b] = !activeBiasFilters[b];
          btn.className = 'bias-toggle ' + (activeBiasFilters[b] ? 'on-' + b : 'off');
          _savePref();
          renderCards();
        };
        btn.addEventListener('click', handler);
        _boundHandlers.biasClicks.push({ el: btn, handler: handler });
      })(btns[i]);
    }
  }

  function destroy() {
    // Clean up detail modal
    if (BT.components.detailModal) BT.components.detailModal.destroy();

    // Remove event listeners
    var si = document.getElementById('search-input');
    if (si && _boundHandlers.searchInput) si.removeEventListener('input', _boundHandlers.searchInput);
    var ss = document.getElementById('sort-select');
    if (ss && _boundHandlers.sortChange) ss.removeEventListener('change', _boundHandlers.sortChange);
    if (_boundHandlers.biasClicks) {
      _boundHandlers.biasClicks.forEach(function(bc) {
        bc.el.removeEventListener('click', bc.handler);
      });
    }
    _boundHandlers = {};

    // Clean up RRG
    _rrg = null;
  }

  BT.pages.signals = {
    render: render,
    init: init,
    destroy: destroy
  };
})();
