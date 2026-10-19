import Papa from 'papaparse';
import type { Fill } from './types';
import { futuresMult, futuresRoot, isFuture } from './instruments';

// Each platform's export, turned into executions (Fill). buildTrades then makes the trades.

export type Parsed = { format: string; fills: Fill[]; warnings: string[] };

/** "$1,250.00", "($50.00)", "-$50", "+2", "1,000" -> number */
export function num(v: unknown): number {
  if (typeof v === 'number') return v;
  let s = String(v ?? '').trim();
  if (!s) return NaN;
  const neg = /^\(.*\)$/.test(s) || /^-/.test(s) || /^\$?\(/.test(s);
  s = s.replace(/[()$,\s+-]/g, '').replace(/[^\d.eE]/g, '');
  const n = parseFloat(s);
  return neg ? -n : n;
}

const MONTHS: Record<string, number> = { JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6, JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12 };
const fullYear = (y: number) => (y < 100 ? 2000 + y : y);

/** "10/17/2026 9:31:05 AM", "10/17/25 09:31:05", "2026-10-17 09:31:05", "10/17/2026" -> Date (this device's time zone) */
export function parseDate(v: string): Date {
  const s = String(v || '').trim().replace(/\s+as of .*$/i, '');
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:[ T]+(\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?\s*(AM|PM)?)?/i);
  if (m) {
    let h = +(m[4] || 0);
    if (m[7]) h = (h % 12) + (/pm/i.test(m[7]) ? 12 : 0);
    return new Date(fullYear(+m[3]), +m[1] - 1, +m[2], h, +(m[5] || 0), +(m[6] || 0));
  }
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
  return new Date(s);
}
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** "SPY 580C 10/17/26" */
const optionName = (root: string, strike: number, type: 'call' | 'put', expiry: string) =>
  `${root} ${strike}${type === 'call' ? 'C' : 'P'} ${expiry.slice(5, 7)}/${expiry.slice(8, 10)}/${expiry.slice(2, 4)}`;

function futureFill(base: Omit<Fill, 'symbol' | 'root' | 'asset' | 'multiplier'>, symbol: string, inferred?: number): Fill {
  const root = futuresRoot(symbol);
  return { ...base, symbol: root, root, asset: 'future', multiplier: futuresMult(root) ?? inferred ?? 1 };
}

/** A whole file: finds which platform it came from by its columns. */
export function parseFile(text: string, fileName = ''): Parsed {
  const clean = text.replace(/^﻿/, '');
  // thinkorswim's Account Statement: several sections in one file
  if (/Account Trade History/i.test(clean)) return thinkorswim(clean);
  const { data, meta } = Papa.parse<Record<string, string>>(clean, { header: true, skipEmptyLines: true, transformHeader: h => h.trim() });
  const cols = (meta.fields || []).map(f => f.toLowerCase());
  const has = (...c: string[]) => c.every(x => cols.includes(x));
  if (has('market pos.', 'entry price', 'exit price')) return nt8Trades(data);
  if (has('instrument', 'action', 'quantity', 'price', 'time')) return nt8Executions(data);
  if (has('buyprice', 'sellprice', 'boughttimestamp')) return tradovatePerformance(data);
  if (has('b/s', 'contract') || has('b/s', 'product')) return tradovateFills(data);
  if (has('trans code', 'activity date')) return robinhood(data);
  if (has('action', 'symbol', 'quantity', 'price') && cols.some(c => c.startsWith('fees'))) return schwab(data);
  throw new Error(`${fileName || 'This file'} isn’t a trade export this journal knows yet. See “How to export” for each platform.`);
}

const pick = (r: Record<string, string>, ...names: string[]) => {
  for (const n of names) {
    const k = Object.keys(r).find(x => x.toLowerCase() === n.toLowerCase());
    if (k !== undefined && r[k] !== undefined && r[k] !== '') return r[k];
  }
  return '';
};

// ---- NinjaTrader 8: Trade Performance → Trades grid, right-click → Export (one row per entry/exit pair) ----
function nt8Trades(rows: Record<string, string>[]): Parsed {
  const fills: Fill[] = [];
  const warnings: string[] = [];
  // Is "Profit" before or after commission? The running "Cum. net profit" says
  const first = rows[0];
  const cum0 = num(pick(first, 'Cum. net profit'));
  const profitIsNet = !isNaN(cum0) && Math.abs(cum0 - num(pick(first, 'Profit'))) < 0.01 && num(pick(first, 'Commission')) > 0;
  let seq = 0;
  for (const r of rows) {
    const qty = num(pick(r, 'Qty', 'Quantity'));
    const dir = /short/i.test(pick(r, 'Market pos.')) ? -1 : 1;
    const entry = num(pick(r, 'Entry price')), exit = num(pick(r, 'Exit price'));
    const comm = num(pick(r, 'Commission')) || 0;
    const profit = num(pick(r, 'Profit'));
    const gross = profitIsNet ? profit + comm : profit;
    const inferred = exit !== entry ? Math.abs(gross / ((exit - entry) * qty)) : undefined;
    const base = { broker: 'NinjaTrader', account: pick(r, 'Account'), fees: 0 };
    const symbol = pick(r, 'Instrument');
    if (!symbol || isNaN(qty)) continue;
    fills.push(futureFill({ ...base, at: parseDate(pick(r, 'Entry time')), seq: seq++, qty: dir * qty, price: entry, mae: num(pick(r, 'MAE')) || undefined, mfe: num(pick(r, 'MFE')) || undefined }, symbol, inferred));
    fills.push(futureFill({ ...base, at: parseDate(pick(r, 'Exit time')), seq: seq++, qty: -dir * qty, price: exit, fees: comm }, symbol, inferred));
    if (!futuresMult(futuresRoot(symbol)) && !inferred) warnings.push(`${symbol}: unknown contract size, P&L may be off`);
  }
  return { format: 'NinjaTrader 8 · Trades', fills, warnings: [...new Set(warnings)] };
}

// ---- NinjaTrader 8: Trade Performance → Executions grid, Export (one row per fill) ----
function nt8Executions(rows: Record<string, string>[]): Parsed {
  let seq = 0;
  const fills = rows.filter(r => pick(r, 'Instrument') && pick(r, 'Action')).map(r => {
    const sell = /sell/i.test(pick(r, 'Action'));
    return futureFill({
      broker: 'NinjaTrader', account: pick(r, 'Account'), at: parseDate(pick(r, 'Time')), seq: seq++,
      qty: (sell ? -1 : 1) * Math.abs(num(pick(r, 'Quantity'))), price: num(pick(r, 'Price')), fees: num(pick(r, 'Commission')) || 0,
    }, pick(r, 'Instrument'));
  });
  return { format: 'NinjaTrader 8 · Executions', fills, warnings: [] };
}

// ---- Tradovate: Reports → Performance → Download (one row per buy/sell pair, P&L before fees) ----
function tradovatePerformance(rows: Record<string, string>[]): Parsed {
  const fills: Fill[] = [];
  let seq = 0;
  for (const r of rows) {
    const symbol = pick(r, 'symbol');
    const qty = num(pick(r, 'qty'));
    if (!symbol || isNaN(qty)) continue;
    const buy = num(pick(r, 'buyPrice')), sell = num(pick(r, 'sellPrice'));
    const bought = parseDate(pick(r, 'boughtTimestamp')), sold = parseDate(pick(r, 'soldTimestamp'));
    const inferred = sell !== buy ? Math.abs(num(pick(r, 'pnl')) / ((sell - buy) * qty)) : undefined;
    const base = { broker: 'Tradovate', account: pick(r, 'account', 'accountName') || 'Tradovate', fees: 0 };
    // The earlier side opened it
    const longFirst = bought.getTime() <= sold.getTime();
    const a = futureFill({ ...base, at: longFirst ? bought : sold, seq: seq++, qty: longFirst ? qty : -qty, price: longFirst ? buy : sell }, symbol, inferred);
    const b = futureFill({ ...base, at: longFirst ? sold : bought, seq: seq++, qty: longFirst ? -qty : qty, price: longFirst ? sell : buy }, symbol, inferred);
    fills.push(a, b);
  }
  return { format: 'Tradovate · Performance', fills, warnings: ['Tradovate’s Performance report leaves out commissions; add them on a trade if you want them counted.'] };
}

// ---- Tradovate: Orders/Fills export (one row per fill) ----
function tradovateFills(rows: Record<string, string>[]): Parsed {
  let seq = 0;
  const fills = rows.filter(r => /^(buy|sell|b|s)$/i.test(pick(r, 'B/S').trim()) && /fill/i.test(pick(r, 'Status') || 'filled')).map(r => {
    const sell = /^s/i.test(pick(r, 'B/S').trim());
    return futureFill({
      broker: 'Tradovate', account: pick(r, 'Account') || 'Tradovate', at: parseDate(pick(r, 'Fill Time', 'Timestamp', 'Date')), seq: seq++,
      qty: (sell ? -1 : 1) * Math.abs(num(pick(r, 'filledQty', 'Filled Qty', 'Quantity'))), price: num(pick(r, 'avgPrice', 'Avg Fill Price', 'Price')), fees: 0,
    }, pick(r, 'Contract', 'Product'));
  }).filter(f => !isNaN(f.qty) && f.qty !== 0 && !isNaN(f.price));
  return { format: 'Tradovate · Fills', fills, warnings: [] };
}

/** "SPY 10/17/2026 Call $580.00" (Robinhood), "SPY 10/17/2026 580.00 C" (Schwab) */
function optionFrom(text: string) {
  let m = text.match(/^([A-Z.]+)\s+(\d{1,2}\/\d{1,2}\/\d{2,4})\s+(Call|Put)\s+\$?([\d,.]+)/i);
  if (m) return { root: m[1].toUpperCase(), expiry: iso(parseDate(m[2])), type: (/call/i.test(m[3]) ? 'call' : 'put') as 'call' | 'put', strike: num(m[4]) };
  m = text.match(/^([A-Z.]+)\s+(\d{1,2}\/\d{1,2}\/\d{2,4})\s+([\d,.]+)\s+([CP])\b/i);
  if (m) return { root: m[1].toUpperCase(), expiry: iso(parseDate(m[2])), type: (/c/i.test(m[4]) ? 'call' : 'put') as 'call' | 'put', strike: num(m[3]) };
  return null;
}

// ---- Robinhood: Account → Reports and statements → Reports → Account activity CSV (newest first, dates only) ----
function robinhood(rows: Record<string, string>[]): Parsed {
  const fills: Fill[] = [];
  const warnings = new Set<string>();
  const list = rows.filter(r => pick(r, 'Trans Code')).reverse();
  let seq = 0;
  for (const r of list) {
    const code = pick(r, 'Trans Code').toUpperCase();
    const desc = pick(r, 'Description');
    const at = parseDate(pick(r, 'Activity Date'));
    const amount = num(pick(r, 'Amount'));
    const q = Math.abs(num(pick(r, 'Quantity')));
    const price = num(pick(r, 'Price'));
    const base = { broker: 'Robinhood', account: 'Robinhood', at, seq: seq++, fees: 0 };
    if (['BTO', 'STC', 'STO', 'BTC', 'OEXP', 'OASGN', 'OEXCS'].includes(code)) {
      const o = optionFrom(desc.replace(/^Option Expiration for\s+/i, ''));
      if (!o) { warnings.add(`Couldn’t read the option in “${desc}”`); continue; }
      const opt = { ...base, symbol: optionName(o.root, o.strike, o.type, o.expiry), root: o.root, asset: 'option' as const, option_type: o.type, strike: o.strike, expiry: o.expiry, multiplier: 100 };
      if (code === 'OEXP' || code === 'OASGN' || code === 'OEXCS') {
        if (code !== 'OEXP') warnings.add('Assigned or exercised options are closed at $0 here; the shares are a separate trade.');
        fills.push({ ...opt, qty: 0, price: 0, cash: 0, closeAll: true });
        continue;
      }
      const buy = code === 'BTO' || code === 'BTC';
      fills.push({ ...opt, qty: (buy ? 1 : -1) * q, price, cash: isNaN(amount) ? undefined : amount });
    } else if (code === 'BUY' || code === 'SELL') {
      const sym = pick(r, 'Instrument').toUpperCase();
      if (isFuture(sym)) { fills.push(futureFill({ ...base, qty: (code === 'BUY' ? 1 : -1) * q, price }, sym)); continue; }
      fills.push({ ...base, symbol: sym, root: sym, asset: 'stock', multiplier: 1, qty: (code === 'BUY' ? 1 : -1) * q, price, cash: isNaN(amount) ? undefined : amount });
    }
  }
  return { format: 'Robinhood · Account activity', fills, warnings: [...warnings, 'Robinhood’s file has dates but no times, so hold times aren’t known.'] };
}

// ---- Schwab: Accounts → History → Transactions → Export (newest first) ----
function schwab(rows: Record<string, string>[]): Parsed {
  const fills: Fill[] = [];
  const warnings = new Set<string>();
  const list = rows.filter(r => pick(r, 'Action')).reverse();
  let seq = 0;
  for (const r of list) {
    const action = pick(r, 'Action');
    if (!/^(buy|sell|expired|assigned|exchange or exercise)/i.test(action)) continue;
    const sym = pick(r, 'Symbol');
    const at = parseDate(pick(r, 'Date'));
    const q = Math.abs(num(pick(r, 'Quantity')));
    const price = num(pick(r, 'Price'));
    const fees = num(pick(r, 'Fees & Comm', 'Fees & Commissions')) || 0;
    const amount = num(pick(r, 'Amount'));
    const buy = /^buy/i.test(action);
    const base = { broker: 'Schwab', account: 'Schwab', at, seq: seq++, fees };
    const o = optionFrom(sym);
    if (o) {
      const opt = { ...base, symbol: optionName(o.root, o.strike, o.type, o.expiry), root: o.root, asset: 'option' as const, option_type: o.type, strike: o.strike, expiry: o.expiry, multiplier: 100 };
      if (!/^(buy|sell)/i.test(action)) { fills.push({ ...opt, qty: 0, price: 0, cash: 0, closeAll: true }); continue; }
      fills.push({ ...opt, qty: (buy ? 1 : -1) * q, price, cash: isNaN(amount) ? undefined : amount });
    } else if (/^(buy|sell)/i.test(action)) {
      fills.push({ ...base, symbol: sym.toUpperCase(), root: sym.toUpperCase(), asset: 'stock', multiplier: 1, qty: (buy ? 1 : -1) * q, price, cash: isNaN(amount) ? undefined : amount });
    } else warnings.add(`Skipped “${action}” on ${sym}`);
  }
  return { format: 'Schwab · Transactions', fills, warnings: [...warnings, 'Schwab’s file has dates but no times, so hold times aren’t known.'] };
}

// ---- thinkorswim: Monitor → Account Statement → Export to file (the "Account Trade History" section) ----
function thinkorswim(text: string): Parsed {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex(l => /^Account Trade History/i.test(l.trim()));
  const head = lines.findIndex((l, i) => i > start && /Exec Time/i.test(l));
  const body: string[] = [lines[head]];
  for (let i = head + 1; i < lines.length && lines[i].trim(); i++) body.push(lines[i]);
  const { data } = Papa.parse<Record<string, string>>(body.join('\n'), { header: true, skipEmptyLines: true, transformHeader: h => h.trim() });
  const fills: Fill[] = [];
  let seq = 0;
  let lastTime = '';
  for (const r of data) {
    const time = pick(r, 'Exec Time') || lastTime; // the other legs of a spread leave it blank
    lastTime = time;
    const sym = pick(r, 'Symbol').toUpperCase();
    const qty = num(pick(r, 'Qty'));
    const price = num(pick(r, 'Price'));
    const type = pick(r, 'Type').toUpperCase();
    if (!sym || isNaN(qty) || isNaN(price)) continue;
    const base = { broker: 'thinkorswim', account: 'thinkorswim', at: parseDate(time), seq: seq++, qty, price, fees: 0 };
    if (type === 'CALL' || type === 'PUT') {
      const e = pick(r, 'Exp').trim().toUpperCase().match(/^(\d{1,2})\s+([A-Z]{3})\s+(\d{2,4})/);
      const expiry = e ? `${fullYear(+e[3])}-${String(MONTHS[e[2]]).padStart(2, '0')}-${e[1].padStart(2, '0')}` : '';
      const strike = num(pick(r, 'Strike'));
      const t = type === 'CALL' ? 'call' : 'put';
      const root = sym.replace(/^\//, '');
      fills.push({ ...base, symbol: optionName(root, strike, t, expiry), root, asset: 'option', option_type: t, strike, expiry, multiplier: sym.startsWith('/') ? futuresMult(futuresRoot(sym)) ?? 100 : 100 });
    } else if (sym.startsWith('/') || type === 'FUTURE') {
      fills.push(futureFill(base, sym));
    } else {
      fills.push({ ...base, symbol: sym, root: sym, asset: 'stock', multiplier: 1 });
    }
  }
  return { format: 'thinkorswim · Account Statement', fills, warnings: ['thinkorswim’s trade history leaves out commissions and fees.'] };
}
