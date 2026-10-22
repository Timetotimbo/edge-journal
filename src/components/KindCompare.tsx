import { useMemo } from 'react';
import type { Trade } from '../lib/types';
import { accountKind, KINDS, type AccountKind } from '../lib/accounts';
import { byKey, dayOf, money, pct, pnlClass, summarize, timed } from '../lib/stats';

// How the user traded funded accounts compared with evaluations and sims: the same numbers side by side, and the
// biggest differences in plain words.
const mins = (m: number | null) => (m === null ? '–' : m < 1 ? `${Math.round(m * 60)}s` : m < 60 ? `${m < 10 ? m.toFixed(1) : Math.round(m)}m` : `${(m / 60).toFixed(1)}h`);
const num = (n: number, d = 1) => (+n.toFixed(d)).toString();
const SHORT: Record<AccountKind, string> = { funded: 'Funded', eval: 'Evaluation', sim: 'Sim', other: 'Other' };
const clock = (h: number) => new Date(2000, 0, 1, 0, h).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).replace(':00', '').replace(' AM', 'a').replace(' PM', 'p');

function profile(ts: Trade[]) {
  const s = summarize(ts);
  const halves = byKey(ts.filter(timed), t => { const d = new Date(t.entry_at); return String(d.getHours() * 60 + (d.getMinutes() < 30 ? 0 : 30)); }).filter(g => g.count >= 5);
  const best = halves.length ? halves.reduce((a, b) => (b.net > a.net ? b : a)) : null;
  const worst = halves.length ? halves.reduce((a, b) => (b.net < a.net ? b : a)) : null;
  const quick = ts.filter(timed).filter(t => new Date(t.exit_at!).getTime() - new Date(t.entry_at).getTime() < 5 * 60000).length / Math.max(1, ts.filter(timed).length);
  const days = new Set(ts.map(t => dayOf(t.entry_at))).size;
  return { s, days, best, worst, quick, long: ts.filter(t => t.side === 'long').length / Math.max(1, ts.length), accounts: new Set(ts.map(t => t.account)).size };
}
type P = ReturnType<typeof profile>;
const half = (g: P['best']) => (g ? `${clock(+g.key)}–${clock(+g.key + 30)} (${money(g.net, true).replace('.00', '')})` : '–');

const ROWS: [string, (p: P) => string, ((p: P) => number)?][] = [
  ['Accounts', p => String(p.accounts)],
  ['Trades', p => p.s.count.toLocaleString()],
  ['Trading days', p => String(p.days)],
  ['Trades a day', p => num(p.s.tradesPerDay)],
  ['Net P&L', p => money(p.s.net, true), p => p.s.net],
  ['Avg day', p => money(p.s.avgDay, true), p => p.s.avgDay],
  ['Win rate', p => pct(p.s.winRate)],
  ['Profit factor', p => (p.s.profitFactor === Infinity ? '∞' : p.s.profitFactor.toFixed(2))],
  ['Avg win', p => money(p.s.avgWin), p => p.s.avgWin],
  ['Avg loss', p => money(p.s.avgLoss), p => p.s.avgLoss],
  ['Expectancy (per trade)', p => money(p.s.expectancy, true), p => p.s.expectancy],
  ['Biggest loss', p => money(p.s.worst, true), p => p.s.worst],
  ['Avg size (contracts, micros count 1)', p => num(p.s.avgQty)],
  ['Size on winners', p => num(p.s.avgQtyWin)],
  ['Size on losers', p => num(p.s.avgQtyLoss)],
  ['Hold on winners', p => mins(p.s.avgHoldWin)],
  ['Hold on losers', p => mins(p.s.avgHoldLoss)],
  ['Out in under 5 min', p => pct(p.quick)],
  ['Long trades', p => pct(p.long)],
  ['Longest losing streak', p => String(p.s.lossStreak)],
  ['Best half hour', p => half(p.best)],
  ['Worst half hour', p => half(p.worst)],
];

/** Plain-words differences between funded and evaluation trading */
function insights(f: P, e: P) {
  const out: string[] = [];
  const ch = (a: number, b: number) => (b ? (a - b) / Math.abs(b) : 0);
  const say = (cond: boolean, text: string) => cond && out.push(text);
  const size = ch(f.s.avgQty, e.s.avgQty);
  say(Math.abs(size) >= 0.15, `On funded accounts you traded ${size > 0 ? 'bigger' : 'smaller'}: ${num(f.s.avgQty)} contracts on average vs ${num(e.s.avgQty)} on evaluations (${size > 0 ? '+' : ''}${Math.round(size * 100)}%).`);
  const pd = ch(f.s.tradesPerDay, e.s.tradesPerDay);
  say(Math.abs(pd) >= 0.2, `You took ${pd > 0 ? 'more' : 'fewer'} trades a day on funded: ${num(f.s.tradesPerDay)} vs ${num(e.s.tradesPerDay)}.`);
  say(Math.abs(f.s.winRate - e.s.winRate) >= 0.05, `Win rate was ${pct(f.s.winRate)} funded vs ${pct(e.s.winRate)} on evaluations.`);
  const loss = ch(Math.abs(f.s.avgLoss), Math.abs(e.s.avgLoss));
  say(Math.abs(loss) >= 0.15, `Your average loss was ${loss > 0 ? 'bigger' : 'smaller'} on funded: ${money(f.s.avgLoss)} vs ${money(e.s.avgLoss)}.`);
  const win = ch(f.s.avgWin, e.s.avgWin);
  say(Math.abs(win) >= 0.15, `Your average win was ${win > 0 ? 'bigger' : 'smaller'} on funded: ${money(f.s.avgWin)} vs ${money(e.s.avgWin)}.`);
  if (f.s.avgHoldLoss !== null && f.s.avgHoldWin !== null && f.s.avgHoldLoss > f.s.avgHoldWin * 1.3)
    out.push(`On funded you held losers longer than winners: ${mins(f.s.avgHoldLoss)} vs ${mins(f.s.avgHoldWin)}.`);
  if (f.s.avgQtyLoss > f.s.avgQtyWin * 1.15) out.push(`On funded your size was bigger on losing trades (${num(f.s.avgQtyLoss)}) than winning ones (${num(f.s.avgQtyWin)}).`);
  say(Math.abs(f.long - e.long) >= 0.1, `You went long ${pct(f.long)} of the time funded vs ${pct(e.long)} on evaluations.`);
  const pfGap = f.s.profitFactor - e.s.profitFactor;
  const pfText = (n: number) => (n === Infinity ? '∞' : n.toFixed(2));
  out.push(`Profit factor: ${pfText(f.s.profitFactor)} funded vs ${pfText(e.s.profitFactor)} on evaluations${Math.abs(pfGap) < 0.1 ? ', about the same' : pfGap > 0 ? ', so funded trading was more efficient' : ', so you traded worse once funded'}.`);
  return out;
}

// Copies counted once within each type (a copier may have run one trade on evaluation and funded accounts together)
function oncePerGroup(ts: Trade[]) {
  const seen = new Set<number>();
  return ts.filter(t => t.copyGroup === undefined || (!seen.has(t.copyGroup) && !!seen.add(t.copyGroup)));
}

export default function KindCompare({ trades }: { trades: Trade[] }) {
  const cols = useMemo(() => KINDS.map(([k]) => [k, oncePerGroup(trades.filter(t => accountKind(t.account) === k))] as const).filter(([, ts]) => ts.length).map(([k, ts]) => [k, profile(ts)] as const), [trades]);
  if (cols.length < 2) return null;
  const f = cols.find(([k]) => k === 'funded')?.[1], e = cols.find(([k]) => k === 'eval')?.[1];
  const notes = f && e ? insights(f, e) : [];
  return (
    <section className="card p-4 min-w-0">
      <h3 className="font-semibold">Funded vs evaluation vs sim</h3>
      <p className="text-xs text-mute mt-0.5">Funded is Apex PA and Bulenox BX-M accounts. Same dates and filters as above, all accounts of each type, a copied trade counted once per type.</p>
      {notes.length > 0 && (
        <ul className="mt-3 space-y-1.5 text-sm list-disc pl-5">{notes.map(n => <li key={n}>{n}</li>)}</ul>
      )}
      <div className="overflow-x-auto -mx-1 mt-3">
        <table className="w-full text-xs sm:text-sm num">
          <thead><tr className="text-[11px] text-mute text-right"><th className="text-left font-medium px-1 py-1"></th>{cols.map(([k]) => <th key={k} className={`font-medium px-1 ${k === 'funded' ? 'text-edge' : ''}`}>{SHORT[k]}</th>)}</tr></thead>
          <tbody>
            {ROWS.map(([label, show, tone]) => (
              <tr key={label} className="border-t border-line text-right">
                <td className="text-left px-1 py-1.5 whitespace-nowrap">{label}</td>
                {cols.map(([k, p]) => <td key={k} className={`px-1 py-1.5 ${tone ? pnlClass(tone(p)) : ''} ${k === 'funded' ? 'font-semibold' : ''}`}>{show(p)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
