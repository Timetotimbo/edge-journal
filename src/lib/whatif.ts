import type { Trade } from './types';
import { dayBars, etDate, type Bar, type DayFile } from './bars';
import { timed } from './stats';

/**
 * "What if I'd held losers only as long as winners?" Every losing trade that ran past the cut-off (the average winner's
 * hold) is closed at the cut-off instead, at the market price of that moment from the 1-minute bars: fills up to then
 * stand as they happened, and whatever was still open is marked at that price. Fees stay as they were. Losers that were
 * already out sooner, and losers with no price history for that minute, keep their real result.
 */
export type CutResult = {
  cutMin: number;
  /** Net P&L of all the trades with the long losers cut, and how much better (+) or worse that is than what happened */
  net: number; delta: number;
  /** Losers that ran past the cut-off: how many were re-priced, how many of those came out ahead, how many had no bars */
  cut: number; better: number; missing: number;
};

// The bar a moment falls in (bars are sorted by start time)
function barAt(bars: Bar[], sec: number): Bar | null {
  let lo = 0, hi = bars.length - 1;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (bars[mid][0] <= sec) lo = mid; else hi = mid - 1; }
  const b = bars[lo];
  return b && b[0] <= sec && sec < b[0] + 60 ? b : null;
}

/** The trade's gross P&L had it been flattened at `at` (ms) for `px` */
export function grossIfClosedAt(t: Trade, at: number, px: number): number {
  const mult = Number(t.multiplier);
  if (!t.fills?.length) return (px - Number(t.entry_price)) * (t.side === 'long' ? 1 : -1) * Number(t.qty) * mult;
  let pos = 0, cash = 0;
  for (const f of t.fills) if (Date.parse(f.at) <= at) { pos += f.qty; cash -= f.qty * f.price; }
  return (cash + pos * px) * mult;
}

/** The price `at` (ms) in a day's bars, or null when the bars don't cover it or don't match this trade's prices */
export function priceAt(file: DayFile | null, t: Trade, at: number): number | null {
  if (!file) return null;
  const b = barAt(file.bars, at / 1000);
  if (!b) return null;
  // The bars must be the trade's own contract at the right hour: its first fill has to sit in (or right next to) its minute's candle
  const first = t.fills?.[0];
  const e = barAt(file.bars, Date.parse(first?.at || t.entry_at) / 1000);
  const ePx = first?.price ?? Number(t.entry_price), slack = 8 * (file.tick || 0.01);
  if (!e || ePx < e[3] - slack || ePx > e[2] + slack) return null;
  // Inside the minute, move from its open to its close
  return b[1] + (b[4] - b[1]) * ((at / 1000 - b[0]) / 60);
}

export async function cutLosers(trades: Trade[], cutMin: number): Promise<CutResult> {
  const cutMs = cutMin * 60000;
  const late = trades.filter(t => Number(t.net_pnl) < 0 && t.asset === 'future' && timed(t) && Date.parse(t.exit_at!) - Date.parse(t.entry_at) > cutMs);
  const actual = trades.reduce((s, t) => s + Number(t.net_pnl), 0);
  let delta = 0, cut = 0, better = 0;
  await Promise.all(late.map(async t => {
    const at = Date.parse(t.entry_at) + cutMs;
    const file = await dayBars(t.root, etDate(at));
    const px = priceAt(file, t, at);
    if (px === null) return;
    const d = grossIfClosedAt(t, at, px) - Number(t.gross_pnl);
    delta += d; cut++;
    if (d > 0) better++;
  }));
  return { cutMin, net: actual + delta, delta, cut, better, missing: late.length - cut };
}

/**
 * The rule you could really follow: "if it's red at the cut-off, get out." Every trade still open at the cut-off that was
 * losing at that moment is closed there, winners included (some of them would have come back). Trades that were green
 * at the cut-off, or already closed, keep their real result; so do trades with no price history for that minute.
 */
export type StopResult = {
  cutMin: number; net: number; delta: number;
  /** Trades closed by the rule; of those, how many really ended as losers (saved) or winners (cut short), and what the winners gave up */
  cut: number; losers: number; winners: number; winnersGaveUp: number; missing: number;
};

export async function timeStop(trades: Trade[], cutMin: number): Promise<StopResult> {
  const cutMs = cutMin * 60000;
  const open = trades.filter(t => t.asset === 'future' && timed(t) && Date.parse(t.exit_at!) - Date.parse(t.entry_at) > cutMs);
  const actual = trades.reduce((s, t) => s + Number(t.net_pnl), 0);
  let delta = 0, cut = 0, losers = 0, winners = 0, gaveUp = 0, missing = 0;
  await Promise.all(open.map(async t => {
    const at = Date.parse(t.entry_at) + cutMs;
    const px = priceAt(await dayBars(t.root, etDate(at)), t, at);
    if (px === null) { missing++; return; }
    const g = grossIfClosedAt(t, at, px);
    if (g >= 0) return;
    const d = g - Number(t.gross_pnl);
    delta += d; cut++;
    if (Number(t.net_pnl) > 0) { winners++; gaveUp += -d; } else losers++;
  }));
  return { cutMin, net: actual + delta, delta, cut, losers, winners, winnersGaveUp: gaveUp, missing };
}
