/**
 * tests/tv-symbol.test.js — BT.tvSymbol resolver
 *
 * Guards the "unknown ticker → bare symbol so TV auto-resolves" behavior
 * and prevents regressions where someone adds a wrong hint.
 */
'use strict';

const fs = require('fs');
const path = require('path');

// Load the IIFE as a script into a fake window
function loadTvSymbol() {
  const src = fs.readFileSync(
    path.resolve(__dirname, '..', 'js', 'lib', 'tv-symbol.js'),
    'utf8'
  );
  const win = {};
  const fn = new Function('window', src);
  fn(win);
  return win.BT;
}

describe('BT.tvSymbol resolver', () => {
  const BT = loadTvSymbol();

  test('returns bare symbol for unknown ticker (TV auto-resolves)', () => {
    expect(BT.tvSymbol('NBIS')).toBe('NBIS');
    expect(BT.tvSymbol('BILI')).toBe('BILI');
    expect(BT.tvSymbol('SMCI')).toBe('SMCI');
    expect(BT.tvSymbol('SOMETHING_NEW')).toBe('SOMETHING_NEW');
  });

  test('applies hint for known ambiguous tickers (indices/ETFs)', () => {
    expect(BT.tvSymbol('SPY')).toBe('AMEX:SPY');
    expect(BT.tvSymbol('QQQ')).toBe('NASDAQ:QQQ');
    expect(BT.tvSymbol('IWM')).toBe('AMEX:IWM');
    expect(BT.tvSymbol('TLT')).toBe('NASDAQ:TLT');
    expect(BT.tvSymbol('IBIT')).toBe('NASDAQ:IBIT');
  });

  test('is case-insensitive on input', () => {
    expect(BT.tvSymbol('spy')).toBe('AMEX:SPY');
    expect(BT.tvSymbol('nbis')).toBe('NBIS');
  });

  test('handles empty/undefined', () => {
    expect(BT.tvSymbol('')).toBe('');
    expect(BT.tvSymbol(null)).toBe('');
    expect(BT.tvSymbol(undefined)).toBe('');
  });

  test('getExchange returns empty for unhinted symbols', () => {
    expect(BT.getExchange('NBIS')).toBe('');
    expect(BT.getExchange('AAPL')).toBe('');  // no hint needed, TV resolves
    expect(BT.getExchange('SPY')).toBe('AMEX');
    expect(BT.getExchange('QQQ')).toBe('NASDAQ');
  });
});
