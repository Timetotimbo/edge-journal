import type { Trade } from './types';
import { dayOf, money } from './stats';

// The Progress page's numbers: how a prop desk, a fund and a trading coach would review the same trades.

const ET = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23', weekday: 'long' });
function etParts(iso: string) {
  const p = Object.fromEntries(ET.formatToParts(new Date(iso)).map(x => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, hour: +p.hour, weekday: p.weekday as string };
}
const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);
const mean = (xs: number[]) => (xs.length ? sum(xs) / xs.length : 0);
const median = (xs: number[]) => { if (!xs.length) return 0; const s = [...xs].sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const quantile = (xs: number[], q: number) => { if (!xs.length) return 0; const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.max(0, Math.floor(q * (s.length - 1))))]; };
const sd = (xs: number[]) => { if (xs.length < 2) return 0; const m = mean(xs); return Math.sqrt(sum(xs.map(x => (x - m) ** 2)) / (xs.length - 1)); };
const holdMin = (t: Trade) => (t.exit_at ? (new Date(t.exit_at).getTime() - new Date(t.entry_at).getTime()) / 60000 : 0);

/** Points made per contract (exit − entry, flipped for shorts); null for options and stocks */
export const points = (t: Trade) => (t.asset === 'future' && t.exit_price !== null ? (Number(t.exit_price) - Number(t.entry_price)) * (t.side === 'long' ? 1 : -1) : null);

export type Review = {
  trades: number; net: number; winRate: number; avgWinPts: number; avgLossPts: number; avgWin: number; avgLoss: number;
  payoff: number; breakevenWinRate: number; profitFactor: number; expectancy: number; kelly: number;
  days: number; greenDays: number; avgDay: number; bestDay: number; worstDay: number; sharpe: number; sortino: number;
  maxDrawdown: number; recovery: number; consistency: number; worstDaysAvg: number; tailLossShare: number;
  holdWin: number; holdLoss: number; tradesPerDay: number;
};

/** Desk and fund statistics for a set of trades. Sharpe and Sortino use daily P&L in dollars, annualised over 252 days. */
export function review(trades: Trade[]): Review {
  const wins = trades.filter(t => t.net_pnl > 0), losses = trades.filter(t => t.net_pnl < 0);
  const won = sum(wins.map(t => Number(t.net_pnl))), lost = -sum(losses.map(t => Number(t.net_pnl)));
  const avgWin = wins.length ? won / wins.length : 0, avgLoss = losses.length ? lost / losses.length : 0;
  const pts = (xs: Trade[]) => xs.map(points).filter((p): p is number => p !== null);
  const winRate = trades.length ? wins.length / trades.length : 0;
  const payoff = avgLoss ? avgWin / avgLoss : 0;
  const byDay = new Map<string, number>();
  for (const t of trades) byDay.set(dayOf(t.entry_at), (byDay.get(dayOf(t.entry_at)) || 0) + Number(t.net_pnl));
  const daily = [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v);
  let run = 0, peak = 0, dd = 0;
  for (const v of daily) { run += v; peak = Math.max(peak, run); dd = Math.min(dd, run - peak); }
  const downside = Math.sqrt(mean(daily.map(v => Math.min(0, v) ** 2)));
  const net = won - lost;
  const bestDay = daily.length ? Math.max(...daily) : 0;
  const worst5 = [...daily].sort((a, b) => a - b).slice(0, Math.max(1, Math.ceil(daily.length * 0.05)));
  const lossAmounts = losses.map(t => -Number(t.net_pnl)).sort((a, b) => b - a);
  return {
    trades: trades.length, net, winRate, avgWin, avgLoss, payoff,
    avgWinPts: mean(pts(wins)), avgLossPts: mean(pts(losses)),
    breakevenWinRate: avgWin + avgLoss ? avgLoss / (avgWin + avgLoss) : 0,
    profitFactor: lost ? won / lost : won ? Infinity : 0,
    expectancy: trades.length ? net / trades.length : 0,
    kelly: payoff ? winRate - (1 - winRate) / payoff : 0,
    days: daily.length, greenDays: daily.length ? daily.filter(v => v > 0).length / daily.length : 0,
    avgDay: mean(daily), bestDay, worstDay: daily.length ? Math.min(...daily) : 0,
    sharpe: sd(daily) ? (mean(daily) / sd(daily)) * Math.sqrt(252) : 0,
    sortino: downside ? (mean(daily) / downside) * Math.sqrt(252) : 0,
    maxDrawdown: dd, recovery: dd ? net / -dd : 0,
    // Prop firms' consistency rule: the best day's share of all profit (lower is steadier; many firms want 30–50% or less)
    consistency: net > 0 ? bestDay / net : 0,
    worstDaysAvg: daily.length ? mean(worst5) : 0,
    // How much of all the money lost came from the worst 10% of losing trades
    tailLossShare: lost ? sum(lossAmounts.slice(0, Math.max(1, Math.ceil(lossAmounts.length * 0.1)))) / lost : 0,
    holdWin: median(wins.map(holdMin)), holdLoss: median(losses.map(holdMin)),
    tradesPerDay: daily.length ? trades.length / daily.length : 0,
  };
}

/** Trades grouped by calendar year (Eastern), oldest first */
export function byYear(trades: Trade[]): [string, Trade[]][] {
  const m = new Map<string, Trade[]>();
  for (const t of trades) { const y = etParts(t.entry_at).date.slice(0, 4); m.set(y, [...(m.get(y) || []), t]); }
  return [...m.entries()].sort(([a], [b]) => a.localeCompare(b));
}

export type DayTypes = Record<string, Record<string, [string, number, number]>>;
const FULL: Record<string, string> = { MNQ: 'NQ', MES: 'ES', MYM: 'YM', M2K: 'RTY', MGC: 'GC', MCL: 'CL' };
const dayType = (types: DayTypes | null, t: Trade) => {
  const d = etParts(t.entry_at).date;
  return types?.[t.root]?.[d] || types?.[FULL[t.root]]?.[d] || null;
};

export type Finding = {
  id: string; title: string; detail: string; rule: string;
  /** Dollars this habit cost (or made, if positive) compared with the rest of your trades */
  impact: number; good?: boolean;
};

/**
 * The coach: each check compares a habit's trades with the rest and prices the difference
 * (how much better the habit's trades would have done at your normal expectancy). Biggest costs first.
 */
export function coach(trades: Trade[], types: DayTypes | null): Finding[] {
  const out: Finding[] = [];
  if (trades.length < 20) return out;
  const r = review(trades);
  const avgOf = (xs: Trade[]) => mean(xs.map(t => Number(t.net_pnl)));
  // What a group cost compared with trading it at the expectancy of everything else
  const restOf = (group: Trade[]) => { const g = new Set(group); return trades.filter(t => !g.has(t)); };
  const cost = (group: Trade[]) => (group.length ? (avgOf(group) - avgOf(restOf(group))) * group.length : 0);
  const sorted = [...trades].sort((a, b) => a.entry_at.localeCompare(b.entry_at));

  // 1. Losses bigger than wins (the rule uses your most-traded instrument's points, since points differ by instrument)
  const main = Object.entries(trades.reduce<Record<string, number>>((m, t) => ({ ...m, [t.root]: (m[t.root] || 0) + 1 }), {})).sort((a, b) => b[1] - a[1])[0]?.[0];
  const mainWins = trades.filter(t => t.root === main && t.net_pnl > 0).map(points).filter((p): p is number => p !== null);
  const mainRule = mainWins.length >= 10 ? `On ${main}, your average win is ${mean(mainWins).toFixed(1)} pts, so no loss should be bigger than ${Math.max(1, Math.round(mean(mainWins) * 1.5))} pts.` : '';
  if (r.payoff && r.payoff < 1) {
    out.push({
      id: 'payoff', title: 'Your losses are bigger than your wins',
      detail: `Average win ${money(r.avgWin)} (${r.avgWinPts.toFixed(1)} pts) vs average loss ${money(r.avgLoss)} (${Math.abs(r.avgLossPts).toFixed(1)} pts), a payoff of ${r.payoff.toFixed(2)}. At that payoff you need to win ${Math.round(r.breakevenWinRate * 100)}% of trades just to break even; you win ${Math.round(r.winRate * 100)}%.`,
      rule: `Desks want payoff of 1.0 or better. Either cut losers sooner or let winners run. ${mainRule}`,
      impact: r.winRate < r.breakevenWinRate ? r.net : 0,
    });
  }

  // 2. The tail: a hard stop at the 75th-percentile loss, per instrument (misses winners a stop would have closed early)
  const roots = [...new Set(trades.filter(t => points(t) !== null).map(t => t.root))];
  let saved = 0; const stops: string[] = [];
  for (const root of roots) {
    const ts = trades.filter(t => t.root === root && points(t) !== null);
    const lossPts = ts.map(t => points(t)!).filter(p => p < 0).map(p => -p);
    if (lossPts.length < 10) continue;
    const stop = Math.max(quantile(lossPts, 0.75), 1);
    for (const t of ts) {
      const p = points(t)!;
      if (p < -stop) saved += (-p - stop) * Number(t.qty) * Number(t.multiplier);
    }
    stops.push(`${root} ${stop.toFixed(stop < 10 ? 1 : 0)} pts`);
  }
  if (saved > 0 && r.tailLossShare > 0.3) {
    out.push({
      id: 'tail', title: 'A few big losses wipe out many good trades',
      detail: `Your worst 10% of losing trades are ${Math.round(r.tailLossShare * 100)}% of all the money you lost. Capping every loser at a hard stop (${stops.join(', ')}, where 3 of 4 of your losers already stop) would have saved about ${money(saved)}.`,
      rule: `Put a hard stop in the platform the moment you enter (${stops.join(', ')}). Never move it further away. This estimate ignores winners a stop would have closed, so check it against your charts.`,
      impact: -saved,
    });
  }

  // 3. Holding losers
  if (r.holdWin > 0 && r.holdLoss > r.holdWin * 1.5) {
    out.push({
      id: 'hold', title: 'You hold losers longer than winners',
      detail: `Median hold ${r.holdWin.toFixed(1)} min on winners vs ${r.holdLoss.toFixed(1)} min on losers (${(r.holdLoss / r.holdWin).toFixed(1)}×). That's hoping a loser comes back and grabbing a winner too soon, the opposite of what pros do.`,
      rule: `If a trade isn't working within ${Math.max(1, Math.round(r.holdWin * 1.5))} min (1.5× your typical winner), get out at the stop or at break-even.`,
      impact: 0,
    });
  }

  // 4. Adding to losers
  const red = trades.filter(t => t.addRed);
  if (red.length >= 10) {
    const c = cost(red);
    if (c < 0) out.push({
      id: 'adds', title: 'Adding to losing trades costs you',
      detail: `${red.length} trades where you added while red averaged ${money(avgOf(red), true)} vs ${money(avgOf(trades.filter(t => !t.addRed)), true)} on the rest.`,
      rule: 'Only add to a winner, never to a loser. Plan the full size before entry; one entry, one stop.',
      impact: c,
    });
  }

  // 5. Revenge: a new trade within 10 minutes of closing a loser
  const revenge: Trade[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted.slice(Math.max(0, i - 5), i).filter(p => p.exit_at && p.net_pnl < 0).pop();
    if (prev && new Date(sorted[i].entry_at).getTime() - new Date(prev.exit_at!).getTime() < 10 * 60000 && new Date(sorted[i].entry_at) >= new Date(prev.exit_at!)) revenge.push(sorted[i]);
  }
  if (revenge.length >= 15) {
    const c = cost(revenge);
    if (c < 0) out.push({
      id: 'revenge', title: 'Trades right after a loss do worse',
      detail: `${revenge.length} trades opened within 10 minutes of closing a loser averaged ${money(avgOf(revenge), true)} vs ${money(avgOf(restOf(revenge)), true)} otherwise.`,
      rule: 'After any loss, stand up and wait 10 minutes before the next trade. After two losses in a row, you are done for the session.',
      impact: c,
    });
  }

  // 6. Overtrading: trades after the day's third
  const nth = new Map<string, number>(); const late: Trade[] = [];
  for (const t of sorted) { const d = dayOf(t.entry_at); const n = (nth.get(d) || 0) + 1; nth.set(d, n); if (n > 3) late.push(t); }
  if (late.length >= 20) {
    const c = cost(late);
    out.push({
      id: 'overtrade', title: c < 0 ? 'Your edge fades after the third trade of the day' : 'You trade well deep into the day',
      detail: `Trades 4 and later each day averaged ${money(avgOf(late), true)} vs ${money(avgOf(restOf(late)), true)} for your first three (${r.tradesPerDay.toFixed(1)} trades a day on average).`,
      rule: c < 0 ? 'Cap yourself at 3 trades a day. If you hit your daily goal or 2 losses, stop.' : 'Volume isn’t hurting you; keep a cap anyway on red days.',
      impact: c, good: c >= 0,
    });
  }

  // 7. Time of day (Eastern), hours with at least 20 trades
  const hours = new Map<number, Trade[]>();
  for (const t of trades) { const h = etParts(t.entry_at).hour; hours.set(h, [...(hours.get(h) || []), t]); }
  const hourRows = [...hours.entries()].filter(([, v]) => v.length >= 20).map(([h, v]) => ({ h, v, c: cost(v), net: sum(v.map(t => Number(t.net_pnl))) }));
  const label = (h: number) => `${((h + 11) % 12) + 1}${h < 12 ? 'am' : 'pm'}`;
  const badHours = hourRows.filter(x => x.net < 0).sort((a, b) => a.net - b.net).slice(0, 2);
  const goodHours = hourRows.filter(x => x.net > 0).sort((a, b) => b.net - a.net).slice(0, 2);
  if (badHours.length) out.push({
    id: 'hours', title: `You lose money in the ${badHours.map(x => label(x.h)).join(' and ')} hour${badHours.length > 1 ? 's' : ''} (Eastern)`,
    detail: `${badHours.map(x => `${label(x.h)}: ${x.v.length} trades, ${money(x.net, true)}`).join('; ')}.${goodHours.length ? ` Your best: ${goodHours.map(x => `${label(x.h)} ${money(x.net, true)}`).join(', ')}.` : ''}`,
    rule: `Don’t trade the ${badHours.map(x => label(x.h)).join(' or ')} hour. Trade your best window${goodHours.length ? ` (${goodHours.map(x => label(x.h)).join(', ')})` : ''} and walk away.`,
    impact: sum(badHours.map(x => x.net)),
  });

  // 8. Trend days: fading the move
  if (types) {
    const trend = trades.filter(t => dayType(types, t)?.[0] === 'trend');
    const against = trend.filter(t => (t.side === 'long' ? 1 : -1) !== dayType(types, t)![1]);
    const withT = trend.filter(t => (t.side === 'long' ? 1 : -1) === dayType(types, t)![1]);
    if (against.length >= 15 && withT.length >= 5) {
      const diff = (avgOf(against) - avgOf(withT)) * against.length;
      out.push({
        id: 'trend', title: diff < 0 ? 'You fight the trend on trend days' : 'Fading trend days has worked for you',
        detail: `On trend days, ${against.length} trades against the day’s direction averaged ${money(avgOf(against), true)}; ${withT.length} with it averaged ${money(avgOf(withT), true)}.`,
        rule: diff < 0 ? 'When price holds near the day’s high or low by 10:30 ET, trade only in that direction. No counter-trend scalps on a trend day.' : 'Keep fades small and quick; one runaway trend day can erase them.',
        impact: Math.min(0, diff), good: diff >= 0,
      });
    }
    const range = trades.filter(t => dayType(types, t)?.[0] === 'range');
    if (range.length >= 20) {
      const c = cost(range);
      out.push({
        id: 'range', title: c >= 0 ? 'Range days are your best days' : 'Range days hurt you',
        detail: `${range.length} trades on range days averaged ${money(avgOf(range), true)} vs ${money(avgOf(restOf(range)), true)} on other days.`,
        rule: c >= 0 ? 'Identify range days early (price back inside the opening range, no follow-through) and press your fades at the extremes.' : 'On choppy days, cut size in half or sit out after the first loss.',
        impact: c, good: c >= 0,
      });
    }
  }

  // 9. Weekday
  const wd = new Map<string, Trade[]>();
  for (const t of trades) { const w = etParts(t.entry_at).weekday; wd.set(w, [...(wd.get(w) || []), t]); }
  const worstWd = [...wd.entries()].filter(([, v]) => v.length >= 20).map(([w, v]) => ({ w, v, net: sum(v.map(t => Number(t.net_pnl))) })).sort((a, b) => a.net - b.net)[0];
  if (worstWd && worstWd.net < 0) out.push({
    id: 'weekday', title: `${worstWd.w} is your worst day of the week`, detail: `${worstWd.v.length} trades on ${worstWd.w}s: ${money(worstWd.net, true)}.`,
    rule: `Trade ${worstWd.w}s at half size until the numbers turn.`, impact: worstWd.net,
  });

  // 10. Size: the biggest quarter of positions (by dollars per point)
  const dpp = (t: Trade) => Number(t.qty) * Number(t.multiplier);
  const big = trades.filter(t => dpp(t) > quantile(trades.map(dpp), 0.75));
  if (big.length >= 15) {
    const c = cost(big);
    if (c < 0) out.push({
      id: 'size', title: 'Your biggest positions are your worst',
      detail: `Trades in your top quarter of size averaged ${money(avgOf(big), true)} vs ${money(avgOf(restOf(big)), true)} for normal size.`,
      rule: 'Size stays the same every trade. Only size up after a green week, never to win back a loss.',
      impact: c,
    });
  }

  // 11. Long vs short
  const longs = trades.filter(t => t.side === 'long'), shorts = trades.filter(t => t.side === 'short');
  if (longs.length >= 20 && shorts.length >= 20) {
    const [weak, strong, wl, sl] = avgOf(longs) < avgOf(shorts) ? [longs, shorts, 'longs', 'shorts'] : [shorts, longs, 'shorts', 'longs'];
    if (sum(weak.map(t => Number(t.net_pnl))) < 0) out.push({
      id: 'side', title: `Your ${wl} lose, your ${sl} ${avgOf(strong) > 0 ? 'make money' : 'lose less'}`,
      detail: `${weak.length} ${wl} averaged ${money(avgOf(weak), true)}; ${strong.length} ${sl} averaged ${money(avgOf(strong), true)}.`,
      rule: `Take ${wl} only with the trend and at half size until they’re profitable.`, impact: cost(weak),
    });
  }

  return out.sort((a, b) => (!!a.good === !!b.good ? a.impact - b.impact : a.good ? 1 : -1));
}

/** A one-line verdict from the stats, like a desk's risk manager would give */
export function verdict(r: Review): string {
  if (r.trades < 20) return 'Not enough trades to judge yet.';
  if (r.expectancy > 0 && r.profitFactor >= 1.5 && r.sharpe >= 1.5) return 'Profitable with a real edge. Protect it: same size, same stop, same hours.';
  if (r.expectancy > 0) return `Profitable, but thin (profit factor ${r.profitFactor.toFixed(2)}). The fixes below are what turn it into a steady edge.`;
  if (r.profitFactor >= 0.95) return 'Close to break-even. Your win rate is fine; the size of your losses is the problem.';
  if (r.winRate >= r.breakevenWinRate - 0.08) return `Losing money, but not from picking bad trades: you win ${Math.round(r.winRate * 100)}% of the time. A few oversized losses take it all back. Fix the top items below before trading bigger or adding accounts.`;
  return 'Losing money. Fix the top items below before trading bigger or adding accounts.';
}
