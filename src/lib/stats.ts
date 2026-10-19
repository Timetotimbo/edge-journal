import type { Trade } from './types';

export const dayOf = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export type Summary = {
  count: number; wins: number; losses: number; net: number; gross: number; fees: number;
  winRate: number; avgWin: number; avgLoss: number; profitFactor: number; expectancy: number;
  best: number; worst: number; maxDrawdown: number; avgHoldMin: number | null; winDays: number; lossDays: number;
};

export function summarize(trades: Trade[]): Summary {
  const wins = trades.filter(t => t.net_pnl > 0), losses = trades.filter(t => t.net_pnl < 0);
  const sum = (xs: Trade[], k: 'net_pnl' | 'gross_pnl' | 'fees' = 'net_pnl') => xs.reduce((s, t) => s + Number(t[k]), 0);
  const winSum = sum(wins), lossSum = sum(losses);
  let peak = 0, run = 0, dd = 0;
  for (const t of [...trades].sort((a, b) => a.entry_at.localeCompare(b.entry_at))) {
    run += Number(t.net_pnl);
    peak = Math.max(peak, run);
    dd = Math.min(dd, run - peak);
  }
  // Only trades with real times (Robinhood and Schwab give dates only)
  const timed = trades.filter(t => t.exit_at && new Date(t.entry_at).getHours() + new Date(t.entry_at).getMinutes() > 0);
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
    avgHoldMin: timed.length ? timed.reduce((s, t) => s + (new Date(t.exit_at!).getTime() - new Date(t.entry_at).getTime()), 0) / timed.length / 60000 : null,
    winDays: days.filter(d => d.net > 0).length,
    lossDays: days.filter(d => d.net < 0).length,
  };
}

export type Group = { key: string; count: number; net: number; wins: number; winRate: number };

export function byKey(trades: Trade[], keyOf: (t: Trade) => string | string[] | null | undefined): Group[] {
  const m = new Map<string, { count: number; net: number; wins: number }>();
  for (const t of trades) {
    const ks = keyOf(t);
    for (const k of Array.isArray(ks) ? ks : ks ? [ks] : []) {
      const g = m.get(k) || { count: 0, net: 0, wins: 0 };
      g.count++;
      g.net += Number(t.net_pnl);
      if (t.net_pnl > 0) g.wins++;
      m.set(k, g);
    }
  }
  return [...m.entries()].map(([key, g]) => ({ key, ...g, winRate: g.count ? g.wins / g.count : 0 }));
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
