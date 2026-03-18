/**
 * sector-rotation.js — Reusable RRG Component
 * 
 * Usage:
 *   createRRG('my-container-id', {
 *     dataUrl: 'data/sector-rotation.json',
 *     trailLength: 8,        // default trail (8, 13, or 26)
 *     height: '500px',       // chart container height
 *     showControls: true,    // trail buttons + reset zoom
 *     showRankings: false,   // sector rankings table below
 *     collapsible: false,    // collapsible header
 *     storageKey: null,      // localStorage key for collapse state
 *   });
 *
 * Requires: Chart.js 4, chartjs-plugin-annotation 3, chartjs-plugin-zoom 2
 */

function createRRG(containerId, opts = {}) {
  const options = {
    dataUrl: opts.dataUrl || 'data/sector-rotation.json',
    trailLength: opts.trailLength || 8,
    height: opts.height || '400px',
    showControls: opts.showControls !== false,
    showRankings: opts.showRankings || false,
    collapsible: opts.collapsible || false,
    storageKey: opts.storageKey || null,
  };

  const container = document.getElementById(containerId);
  if (!container) return console.error('RRG: container not found:', containerId);

  // State
  let chart = null;
  let sectorData = null;
  let activeTrail = options.trailLength;
  let highlightedSector = null;
  let hiddenSectors = new Set();

  // Build DOM
  container.classList.add('rrg-section');
  let html = '';

  if (options.collapsible) {
    const collapsed = options.storageKey && localStorage.getItem(options.storageKey) === 'collapsed';
    html += `<div class="rrg-header">
      <span class="rrg-toggle ${collapsed ? 'collapsed' : ''}">▼</span>
      <h2>Sector Rotation</h2>
    </div>`;
    html += `<div class="rrg-body ${collapsed ? 'hidden' : ''}">`;
  }

  if (options.showControls) {
    html += `<div class="rrg-controls">
      <button class="${activeTrail===8?'active':''}" data-rrg-trail="8">8W</button>
      <button class="${activeTrail===13?'active':''}" data-rrg-trail="13">13W</button>
      <button class="${activeTrail===26?'active':''}" data-rrg-trail="26">26W</button>
      <div class="rrg-sep"></div>
      <button data-rrg-reset>Reset Zoom</button>
      <span class="rrg-hint">Scroll to zoom · Drag to select · Double-click to reset</span>
    </div>`;
  }

  html += `<div class="rrg-chart-container" style="height:${options.height}">
    <canvas data-rrg-canvas></canvas>
  </div>
  <div class="rrg-legend" data-rrg-legend></div>
  <div class="rrg-meta" data-rrg-meta></div>`;

  if (options.showRankings) {
    html += `<div class="rrg-rankings" data-rrg-rankings></div>`;
  }

  if (options.collapsible) {
    html += `</div>`;
  }

  container.innerHTML = html;

  // References
  const canvas = container.querySelector('[data-rrg-canvas]');
  const legendEl = container.querySelector('[data-rrg-legend]');
  const metaEl = container.querySelector('[data-rrg-meta]');
  const rankingsEl = container.querySelector('[data-rrg-rankings]');

  // Collapsible toggle
  if (options.collapsible) {
    const header = container.querySelector('.rrg-header');
    const body = container.querySelector('.rrg-body');
    const toggle = container.querySelector('.rrg-toggle');
    header.addEventListener('click', () => {
      const isCollapsed = body.classList.toggle('hidden');
      toggle.classList.toggle('collapsed', isCollapsed);
      if (options.storageKey) {
        localStorage.setItem(options.storageKey, isCollapsed ? 'collapsed' : 'expanded');
      }
    });
  }

  // Trail buttons
  container.querySelectorAll('[data-rrg-trail]').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('[data-rrg-trail]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeTrail = parseInt(btn.dataset.rrgTrail);
      renderChart();
    });
  });

  // Reset zoom
  const resetBtn = container.querySelector('[data-rrg-reset]');
  if (resetBtn) resetBtn.addEventListener('click', () => { if (chart) chart.resetZoom(); });

  // Helpers
  function hexToRgba(hex, a) {
    const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
    return `rgba(${r},${g},${b},${a})`;
  }
  function getQuadrant(x, y) {
    if (x >= 100 && y >= 100) return 'Leading';
    if (x >= 100 && y < 100) return 'Weakening';
    if (x < 100 && y >= 100) return 'Improving';
    return 'Lagging';
  }

  function computeBounds(datasets) {
    let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
    datasets.forEach(ds => ds.data.forEach(p => {
      minX=Math.min(minX,p.x); maxX=Math.max(maxX,p.x);
      minY=Math.min(minY,p.y); maxY=Math.max(maxY,p.y);
    }));
    const padX=(maxX-minX)*0.15+1, padY=(maxY-minY)*0.15+0.5;
    return { minX:minX-padX, maxX:maxX+padX, minY:minY-padY, maxY:maxY+padY };
  }

  function buildLegend() {
    legendEl.innerHTML = '';
    sectorData.sectors.forEach(sec => {
      const isHidden = hiddenSectors.has(sec.symbol);
      const isDimmed = highlightedSector && highlightedSector !== sec.symbol;
      const item = document.createElement('div');
      item.className = 'rrg-legend-item' + (isHidden ? ' off' : '') + (isDimmed ? ' dimmed' : '');
      item.innerHTML = `<div class="rrg-legend-tip">${sec.name}</div><div class="rrg-legend-dot" style="background:${sec.color}"></div><div class="rrg-legend-ticker">${sec.symbol}</div>`;
      item.addEventListener('click', e => {
        e.preventDefault();
        if (highlightedSector) highlightedSector = null;
        hiddenSectors.has(sec.symbol) ? hiddenSectors.delete(sec.symbol) : hiddenSectors.add(sec.symbol);
        renderChart(); buildLegend();
      });
      item.addEventListener('dblclick', e => {
        e.preventDefault();
        highlightedSector = highlightedSector === sec.symbol ? null : sec.symbol;
        hiddenSectors.clear();
        renderChart(); buildLegend();
      });
      legendEl.appendChild(item);
    });
  }

  function buildRankings() {
    if (!rankingsEl || !sectorData) return;
    const sorted = [...sectorData.sectors].sort((a,b) => {
      const aLast = a.trail[a.trail.length-1];
      const bLast = b.trail[b.trail.length-1];
      return (bLast?.rs||0) - (aLast?.rs||0);
    });
    let h = `<h3>Sector Rankings</h3><table><thead><tr>
      <th>#</th><th>Sector</th><th>RS</th><th>Momentum</th><th>Quadrant</th>
    </tr></thead><tbody>`;
    sorted.forEach((sec, i) => {
      const last = sec.trail[sec.trail.length-1] || {};
      const q = getQuadrant(last.rs||0, last.momentum||0);
      const qClass = 'q-' + q.toLowerCase();
      h += `<tr>
        <td>${i+1}</td>
        <td><span style="color:${sec.color};margin-right:6px">●</span>${sec.symbol} <span style="color:#666">${sec.name}</span></td>
        <td>${(last.rs||0).toFixed(1)}</td>
        <td>${(last.momentum||0).toFixed(1)}</td>
        <td><span class="q-badge ${qClass}">${q}</span></td>
      </tr>`;
    });
    h += '</tbody></table>';
    rankingsEl.innerHTML = h;
  }

  function renderChart() {
    if (!sectorData) return;
    const sectors = sectorData.sectors.filter(s => !hiddenSectors.has(s.symbol));
    const datasets = sectors.map(sec => {
      const trail = sec.trail.slice(-activeTrail);
      const data = trail.map(p => ({x:p.rs, y:p.momentum}));
      const isHL = !highlightedSector || highlightedSector===sec.symbol;
      const alpha = isHL?1:0.12, lineAlpha = isHL?0.6:0.06;
      return {
        label: sec.symbol, data, showLine: true,
        borderWidth: isHL?1.5:0.5, tension: 0.3,
        backgroundColor: data.map((_,i) => hexToRgba(sec.color, i===data.length-1?alpha:alpha*0.5)),
        borderColor: hexToRgba(sec.color, lineAlpha),
        pointRadius: data.map((_,i) => i===data.length-1?8:3),
        pointHoverRadius: data.map((_,i) => i===data.length-1?11:5),
        pointBorderColor: hexToRgba(sec.color, alpha),
        pointBorderWidth: 1,
        _sectorSymbol: sec.symbol, _sectorName: sec.name, _sectorColor: sec.color,
      };
    });

    const bounds = computeBounds(datasets);
    const config = {
      type: 'scatter',
      data: { datasets },
      options: {
        responsive: true, maintainAspectRatio: false,
        animation: { duration: chart?300:600 },
        interaction: { mode:'nearest', intersect:true },
        onClick(e, elements) {
          if (elements.length > 0) {
            const ds = datasets[elements[0].datasetIndex];
            highlightedSector = highlightedSector===ds._sectorSymbol ? null : ds._sectorSymbol;
          } else { highlightedSector = null; }
          renderChart(); buildLegend();
        },
        scales: {
          x: { type:'linear', min:bounds.minX, max:bounds.maxX,
            title:{display:true, text:'Relative Strength (%)', color:'#888', font:{size:12,weight:'600'}},
            grid:{color:'rgba(255,255,255,0.05)'}, ticks:{color:'#555',font:{size:10},maxTicksLimit:10},
            border:{color:'rgba(255,255,255,0.08)'}},
          y: { type:'linear', min:bounds.minY, max:bounds.maxY,
            title:{display:true, text:'RS Momentum', color:'#888', font:{size:12,weight:'600'}},
            grid:{color:'rgba(255,255,255,0.05)'}, ticks:{color:'#555',font:{size:10},maxTicksLimit:10},
            border:{color:'rgba(255,255,255,0.08)'}},
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor:'rgba(15,15,25,0.95)', borderColor:'rgba(255,255,255,0.1)',
            borderWidth:1, titleFont:{size:13,weight:'600'}, bodyFont:{size:12},
            padding:12, cornerRadius:8,
            callbacks: {
              title(items) {
                if(!items.length) return '';
                const ds=datasets[items[0].datasetIndex];
                return `${ds._sectorSymbol} — ${ds._sectorName}`;
              },
              label(item) {
                const ds=datasets[item.datasetIndex];
                const q=getQuadrant(item.parsed.x, item.parsed.y);
                return [`RS: ${item.parsed.x.toFixed(2)}`,`Momentum: ${item.parsed.y.toFixed(2)}`,`Quadrant: ${q}`];
              }
            }
          },
          annotation: { annotations: {
            topRight:{type:'box',xMin:100,yMin:100,xMax:200,yMax:200,backgroundColor:'rgba(40,167,69,0.07)',borderWidth:0,drawTime:'beforeDatasetsDraw'},
            topLeft:{type:'box',xMin:0,yMin:100,xMax:100,yMax:200,backgroundColor:'rgba(30,144,255,0.07)',borderWidth:0,drawTime:'beforeDatasetsDraw'},
            bottomLeft:{type:'box',xMin:0,yMin:0,xMax:100,yMax:100,backgroundColor:'rgba(220,53,69,0.07)',borderWidth:0,drawTime:'beforeDatasetsDraw'},
            bottomRight:{type:'box',xMin:100,yMin:0,xMax:200,yMax:100,backgroundColor:'rgba(255,193,7,0.07)',borderWidth:0,drawTime:'beforeDatasetsDraw'},
            vLine:{type:'line',xMin:100,xMax:100,borderColor:'rgba(128,128,128,0.3)',borderWidth:1,borderDash:[6,4]},
            hLine:{type:'line',yMin:100,yMax:100,borderColor:'rgba(128,128,128,0.3)',borderWidth:1,borderDash:[6,4]},
          }},
          zoom: {
            pan:{enabled:false},
            zoom:{
              wheel:{enabled:true,speed:0.08},
              pinch:{enabled:true},
              drag:{enabled:true,backgroundColor:'rgba(74,158,255,0.1)',borderColor:'rgba(74,158,255,0.3)',borderWidth:1},
              mode:'xy',
              onZoomStart({chart,event}) {
                // Allow drag zoom only when not clicking a data point
                if(event.type==='pointerdown') return true;
              }
            },
            limits:{x:{min:50,max:160},y:{min:80,max:120}},
          }
        }
      },
      plugins: [
        { id:'quadrantLabels', afterDraw(c) {
          const ctx=c.ctx; const{left,right,top,bottom}=c.chartArea;
          const x100=c.scales.x.getPixelForValue(100), y100=c.scales.y.getPixelForValue(100);
          ctx.save(); ctx.font='bold 11px Inter,sans-serif';
          ctx.textBaseline='top';
          if(x100<right&&y100>top){ctx.textAlign='right';ctx.fillStyle='rgba(40,167,69,0.45)';ctx.fillText('LEADING',right-8,top+6);}
          if(x100>left&&y100>top){ctx.textAlign='left';ctx.fillStyle='rgba(30,144,255,0.45)';ctx.fillText('IMPROVING',left+8,top+6);}
          ctx.textBaseline='bottom';
          if(x100>left&&y100<bottom){ctx.textAlign='left';ctx.fillStyle='rgba(220,53,69,0.45)';ctx.fillText('LAGGING',left+8,bottom-6);}
          if(x100<right&&y100<bottom){ctx.textAlign='right';ctx.fillStyle='rgba(255,193,7,0.45)';ctx.fillText('WEAKENING',right-8,bottom-6);}
          ctx.restore();
        }},
        { id:'tickerLabels', afterDatasetsDraw(c) {
          const ctx=c.ctx;
          c.data.datasets.forEach((ds,i) => {
            const meta=c.getDatasetMeta(i); const last=meta.data[meta.data.length-1]; if(!last) return;
            const active=!highlightedSector||highlightedSector===ds._sectorSymbol;
            ctx.save(); ctx.font='bold 11px Inter,sans-serif';
            ctx.fillStyle=active?'#fff':'rgba(255,255,255,0.12)';
            ctx.textAlign='left'; ctx.textBaseline='middle';
            ctx.fillText(ds._sectorSymbol, last.x+12, last.y);
            ctx.restore();
          });
        }}
      ]
    };
    if (chart) chart.destroy();
    chart = new Chart(canvas, config);
  }

  // Double-click on chart = reset zoom
  canvas.addEventListener('dblclick', (e) => {
    if (chart) chart.resetZoom();
  });

  // Load
  fetch(options.dataUrl)
    .then(r => r.json())
    .then(data => {
      sectorData = data;
      metaEl.textContent = `Benchmark: ${data.benchmark} · Lookback: ${data.lookback}W · ${new Date(data.generatedAt).toLocaleDateString()}`;
      renderChart();
      buildLegend();
      if (options.showRankings) buildRankings();
    })
    .catch(err => { metaEl.textContent = 'Failed to load sector rotation data'; console.error(err); });

  return { refresh() { if(sectorData) { renderChart(); buildLegend(); } } };
}
