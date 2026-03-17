# TradingView Embed Widget — Integration Guide

_Lessons learned building the BreakingTrades Dashboard. Last updated: 2026-03-17._

---

## Widget Type

We use the **Advanced Chart Widget** (free, no API key):
```
https://s3.tradingview.com/tv.js
```

Constructor: `new TradingView.widget({...})` — creates an iframe that connects to TradingView's WebSocket-based charting engine.

---

## Valid Parameters

### `interval` — Timeframe
| Value | Meaning |
|-------|---------|
| `'1'` | 1 minute |
| `'5'` | 5 minutes |
| `'15'` | 15 minutes |
| `'30'` | 30 minutes |
| `'60'` | 1 hour |
| `'120'` | 2 hours |
| `'240'` | 4 hours |
| `'D'` | Daily |
| `'W'` | Weekly |
| `'M'` | Monthly |

**Note:** The charting *library* (paid) uses `'1D'`, `'1W'` — the embed widget uses `'D'`, `'W'`, `'M'`.

### `range` — Visible Date Range
| Value | Meaning |
|-------|---------|
| `'1D'` | 1 day |
| `'5D'` | 5 days |
| `'1M'` | 1 month |
| `'3M'` | 3 months |
| `'6M'` | 6 months |
| `'12M'` | 12 months (1 year) |
| `'60M'` | 60 months (5 years) |
| `'ALL'` | All available history |

**⚠️ INVALID values:** `'1Y'`, `'3Y'`, `'5Y'` — these cause a fatal `create_series` error:
```
Critical error. Reason=invalid parameters, info=method: create_series.
args: "[sds_1, s1, sds_sym_1, W, 300, 3Y]"
```

**⚠️ Range affects bar resolution:** TradingView auto-adjusts the displayed bar width to fit the range. If the range is too wide for the interval, it may **override your interval silently**:
- `interval: 'D'` + `range: '6M'` → showed **2-hour** bars (6M of daily was too dense)
- `interval: 'W'` + `range: 'ALL'` → showed **monthly** bars (decades of weekly was too dense)

**Recommended pairings:**
| Interval | Range | Result |
|----------|-------|--------|
| `'D'` | `'12M'` | ~250 daily bars — clean |
| `'W'` | `'60M'` | ~260 weekly bars — clean |
| `'M'` | `'ALL'` | Full monthly history |
| `'60'` | `'5D'` | 5 days of hourly bars |

---

## Studies (Indicators)

### `studies` Array — String IDs Only

The `studies` parameter accepts an **array of strings**. Each string is a study identifier.

```javascript
// ✅ CORRECT — string IDs
studies: [
  'MASimple@tv-basicstudies',
  'MASimple@tv-basicstudies',
  'RSI@tv-basicstudies',
  'Volume@tv-basicstudies'
]

// ❌ BROKEN — object syntax (serialized as single string, causes "Cannot get study" error)
studies: [
  {id: 'MASimple@tv-basicstudies', inputs: {length: 20}},
  {id: 'MASimple@tv-basicstudies', inputs: {length: 50}}
]
```

The object syntax `{id: '...', inputs: {...}}` works in the paid **Charting Library** but NOT in the free embed widget. The embed widget serializes the entire array as a single JSON string study ID, which fails.

### Common Study IDs

| Study | ID |
|-------|----|
| Simple Moving Average | `MASimple@tv-basicstudies` |
| Exponential Moving Average | `MAExp@tv-basicstudies` |
| Relative Strength Index | `RSI@tv-basicstudies` |
| MACD | `MACD@tv-basicstudies` |
| Bollinger Bands | `BB@tv-basicstudies` |
| Volume | `Volume@tv-basicstudies` |
| VWAP | `VWAP@tv-basicstudies` |

### `studies_overrides` — Customizing Study Appearance

You can override properties of the **first instance** of each study type:

```javascript
studies_overrides: {
  // SMA length + appearance
  'moving average.length': 20,
  'moving average.ma.color': '#9e9e9e',
  'moving average.ma.linewidth': 2,
  
  // RSI
  'relative strength index.length': 14,
  'relative strength index.plot.color': '#7e57c2',
  
  // Bollinger Bands
  'bollinger bands.length': 20,
  'bollinger bands.median.color': '#ff6d00'
}
```

### ⚠️ LIMITATION: Cannot Override Second Instance of Same Study

If you add `MASimple@tv-basicstudies` twice (for SMA 20 + SMA 50), you can ONLY override the first one:

```javascript
// ✅ Works — first MA
'moving average.length': 20,
'moving average.ma.color': '#9e9e9e',

// ❌ ALL of these FAIL for the second MA:
'moving average_1.ma.color': '#ffeb3b',    // "no such study moving average_1"
'moving average#1.ma.color': '#ffeb3b',    // "no such study moving average#1"
'moving average 1.ma.color': '#ffeb3b',    // nope
```

**Workaround options:**
1. Accept that the second MA uses TradingView's default color (blue)
2. Use the **MA Cross** study (`MACross@tv-basicstudies`) which has two built-in MAs with separate overrides
3. Use the paid Charting Library which supports `_1` suffixes
4. Let users customize via the interactive chart toolbar (settings persist in their browser)

---

## Multiple Charts on Same Page

### WebSocket Race Condition

TradingView widgets use WebSocket connections. Creating two widgets simultaneously can cause the second one to fail with "Something went wrong."

**Solution: Sequential loading with iframe load detection**

```javascript
// 1) Create daily chart
var dailyWidget = new TradingView.widget({...});

// 2) Watch for iframe, wait for load, THEN create weekly
var container = document.getElementById('daily-container');
var observer = new MutationObserver(function(mutations) {
  var iframe = container.querySelector('iframe');
  if (iframe) {
    observer.disconnect();
    iframe.addEventListener('load', function() {
      // Daily chart fully loaded — safe to create weekly
      setTimeout(function() {
        new TradingView.widget({...}); // weekly
      }, 1000); // small buffer after load
    });
  }
});
observer.observe(container, { childList: true, subtree: true });

// 3) Fallback if iframe never appears
setTimeout(function() {
  observer.disconnect();
  new TradingView.widget({...}); // weekly fallback
}, 5000);
```

**Why not `setTimeout` alone?** Fixed delays (1.5s, 2.5s) are unreliable — the WebSocket connection time varies by network conditions.

**Why MutationObserver?** The `new TradingView.widget()` constructor doesn't return a promise or fire a callback. It creates a `<div>` which TradingView's script eventually replaces with an `<iframe>`. The observer detects this.

**Why iframe `load` event?** The iframe's `load` event fires when the chart has fully initialized its WebSocket connection and rendered. This is the reliable signal.

---

## Modal Pattern (Show/Hide Charts)

When charts are inside a modal that opens/closes:

```javascript
// On close: clear containers + cancel pending timers
function closeDetail() {
  if (_weeklyChartTimer) {
    clearTimeout(_weeklyChartTimer);
    _weeklyChartTimer = null;
  }
  document.getElementById('modal-chart-daily').innerHTML = '';
  document.getElementById('modal-chart-weekly').innerHTML = '';
  document.getElementById('modal').classList.remove('open');
}

// On open: always start fresh (innerHTML = '') before creating new widget
```

**Important:** Always check if the modal is still open before creating the delayed weekly chart (user might close before it fires).

---

## Dark Theme Configuration

```javascript
{
  theme: 'dark',
  backgroundColor: '#0a0a12',
  gridColor: '#1a1a2e',
  // Additional overrides via overrides: {}
  overrides: {
    'mainSeriesProperties.sessionId': 'regular'
  }
}
```

---

## Timezone

```javascript
{
  timezone: 'America/New_York'  // IANA timezone string
}
```

The widget respects this and displays timestamps accordingly.

---

## Full Working Example

```javascript
new TradingView.widget({
  autosize: true,
  symbol: 'NASDAQ:AAPL',
  interval: 'D',
  timezone: 'America/New_York',
  theme: 'dark',
  style: '1',
  locale: 'en',
  hide_top_toolbar: false,
  hide_legend: false,
  allow_symbol_change: false,
  save_image: false,
  container_id: 'chart-container',
  height: 400,
  width: '100%',
  backgroundColor: '#0a0a12',
  gridColor: '#1a1a2e',
  studies: [
    'MASimple@tv-basicstudies',
    'MASimple@tv-basicstudies',
    'RSI@tv-basicstudies',
    'Volume@tv-basicstudies'
  ],
  studies_overrides: {
    'moving average.length': 20,
    'moving average.ma.color': '#9e9e9e',
    'moving average.ma.linewidth': 2
  },
  range: '12M'
});
```

---

## Reference

- Widget constructor docs (limited): https://www.tradingview.com/widget-docs/widgets/charts/advanced-chart/
- Charting Library docs (paid, more detailed): https://www.tradingview.com/charting-library-docs/
- Study IDs are undocumented for the free widget — discovered via trial and error
- `studies_overrides` key format: `'<study_name>.<property_path>'`
