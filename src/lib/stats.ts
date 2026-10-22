import type { Trade } from './types';
import { tickDollars } from './instruments';

// Futures trading days: a session runs from 5 pm Central the evening before to the 4 pm close, so a trade on Sunday
// night belongs to Monday and weekends are never a day. (Shift 7 hours, then take the Chicago date.)
const chicago = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' });
export const dayOf = (iso: string) => chicago.format(new Date(new Date(iso).getTime() + 7 * 3600e3));

export type Summary = {
  count: number; wins: number; losses: number; net: number; gross: number; fees: number;
  winRate: number; avgWin: number; avgLoss: number; profitFactor: number; expectancy: number;
  best: number; worst: number; maxDrawdown: number; avgHoldMin: number | null; winDays: number; lossDays: number;
  avgHoldWin: number | null; avgHoldLoss: number | null; avgTick: number; avgTickWin: number; avgTickLoss: number; sizeByRoot: RootSize[];
  winStreak: number; lossStreak: number; avgDay: number; tradesPerDay: number;
  /** Highest and lowest running P&L reached, trade by trade */
  high: number; low: number;
  flatDays: number;
};
const holdMin = (t: Trade) => (new Date(t.exit_at!).getTime() - new Date(t.entry_at).getTime()) / 60000;
const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);
/** Has real entry and exit times (Robinhood and Schwab give dates only) */
export const timed = (t: Trade) => !!t.exit_at && new Date(t.entry_at).getHours() + new Date(t.entry_at).getMinutes() > 0;

export function summarize(trades: Trade[]): Summary {
  const wins = trades.filter(t => t.net_pnl > 0), losses = trades.filter(t => t.net_pnl < 0);
  const sum = (xs: Trade[], k: 'net_pnl' | 'gross_pnl' | 'fees' = 'net_pnl') => xs.reduce((s, t) => s + Number(t[k]), 0);
  const winSum = sum(wins), lossSum = sum(losses);
  let peak = 0, run = 0, dd = 0, w = 0, l = 0, winStreak = 0, lossStreak = 0, low = 0;
  for (const t of [...trades].sort((a, b) => a.entry_at.localeCompare(b.entry_at))) {
    run += Number(t.net_pnl);
    peak = Math.max(peak, run);
    dd = Math.min(dd, run - peak);
    low = Math.min(low, run);
    w = t.net_pnl > 0 ? w + 1 : 0;
    l = t.net_pnl < 0 ? l + 1 : 0;
    winStreak = Math.max(winStreak, w);
    lossStreak = Math.max(lossStreak, l);
  }
  const hold = (xs: Trade[]) => { const h = xs.filter(timed).map(holdMin); return h.length ? avg(h) : null; };
  const days = byKey(trades, t => dayOf(t.entry_at));
  return {
    count: trades.length, wins: wins.length, losses: losses.length,
    net: sum(trades), gross: sum(trades, 'gross_pnl'), fees: sum(trades, 'fees'),
    winRate: trades.length ? wins.length / trades.length : 0,
    avgWin: wins.length ? winSum / wins.length : 0,
    avgLoss: losses.length ? lossSum / losses.length : 0,
    profitFactor: lossSum ? winSum / Math.abs(lossSum) : winSum > 0 ? Infinity : 0,
    expectancy: trades.length ? sum(trades) / trades.length : 0,
    best: Math.max(0, ...trades.map(t => Number(t.net_pnl))),
    worst: Math.min(0, ...trades.map(t => Number(t.net_pnl))),
    maxDrawdown: dd,
    avgHoldMin: hold(trades), avgHoldWin: hold(wins), avgHoldLoss: hold(losses),
    avgTick: avg(trades.map(tickDollars)), avgTickWin: avg(wins.map(tickDollars)), avgTickLoss: avg(losses.map(tickDollars)), sizeByRoot: sizeByRoot(trades),
    winStreak, lossStreak, high: peak, low,
    winDays: days.filter(d => d.net > 0).length,
    lossDays: days.filter(d => d.net < 0).length,
    flatDays: days.filter(d => d.net === 0).length,
    avgDay: days.length ? sum(trades) / days.length : 0,
    tradesPerDay: days.length ? trades.length / days.length : 0,
  };
}

/** Contracts per trade on each instrument (NQ and MNQ apart: a contract of each is worth very different money) */
export type RootSize = { root: string; count: number; avg: number; win: number; loss: number; max: number };
export function sizeByRoot(trades: Trade[]): RootSize[] {
  const m = new Map<string, Trade[]>();
  for (const t of trades) (m.get(t.root) || m.set(t.root, []).get(t.root)!).push(t);
  const q = (xs: Trade[]) => avg(xs.map(t => Number(t.qty)));
  return [...m.entries()].map(([root, ts]) => ({ root, count: ts.length, avg: q(ts), win: q(ts.filter(t => t.net_pnl > 0)), loss: q(ts.filter(t => t.net_pnl < 0)), max: Math.max(...ts.map(t => Number(t.qty))) }))
    .sort((a, b) => b.count - a.count);
}

export type Group = { key: string; count: number; net: number; wins: number; winRate: number; won: number; lost: number; avg: number; pf: number };

export function byKey(trades: Trade[], keyOf: (t: Trade) => string | string[] | null | undefined): Group[] {
  const m = new Map<string, { count: number; net: number; wins: number; won: number; lost: number }>();
  for (const t of trades) {
    const ks = keyOf(t);
    for (const k of Array.isArray(ks) ? ks : ks ? [ks] : []) {
      const g = m.get(k) || { count: 0, net: 0, wins: 0, won: 0, lost: 0 };
      const n = Number(t.net_pnl);
      g.count++;
      g.net += n;
      if (n > 0) { g.wins++; g.won += n; } else g.lost += n;
      m.set(k, g);
    }
  }
  return [...m.entries()].map(([key, g]) => ({ key, ...g, winRate: g.count ? g.wins / g.count : 0, avg: g.count ? g.net / g.count : 0,
    pf: g.lost ? g.won / Math.abs(g.lost) : g.won > 0 ? Infinity : 0 }));
}

export function equityCurve(trades: Trade[]) {
  let run = 0;
  return byKey(trades, t => dayOf(t.entry_at)).sort((a, b) => a.key.localeCompare(b.key)).map(d => ({ day: d.key, net: d.net, total: (run += d.net) }));
}

export const money = (n: number, sign = false) => {
  const s = Math.abs(n).toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: Math.abs(n) >= 10000 ? 0 : 2, maximumFractionDigits: Math.abs(n) >= 10000 ? 0 : 2 });
  return n < 0 ? `-${s}` : sign && n > 0 ? `+${s}` : s;
};
/** Short, for tight spaces: "+52", "-1.2k" */
export const compact = (n: number) => {
  const a = Math.abs(n);
  const v = a >= 1000 ? `${(a / 1000).toFixed(a >= 10000 ? 0 : 1)}k` : Math.round(a).toString();
  return `${n < 0 ? '-' : n > 0 ? '+' : ''}$${v}`;
};
export const pct = (n: number) => `${Math.round(n * 100)}%`;
export const pnlClass = (n: number) => (n > 0 ? 'text-win' : n < 0 ? 'text-loss' : 'text-mute');
