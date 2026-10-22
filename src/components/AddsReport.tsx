import { useMemo } from 'react';
import type { Trade } from '../lib/types';
import { addKind, ADD_KINDS } from '../lib/adds';
import { byKey, dayOf, pct, pnlClass } from '../lib/stats';

// Adding to positions: how trades went by whether you added while red or green, what the added contracts themselves
// made or lost, how many of the biggest losses came from averaging down, and month by month, to watch the habit go.
const usd = (n: number) => `${n > 0 ? '+' : n < 0 ? '-' : ''}$${Math.round(Math.abs(n)).toLocaleString('en-US')}`;
const pf = (n: number) => (n === Infinity ? '∞' : n.toFixed(2));

export default function AddsReport({ trades, scope, onPick }: { trades: Trade[]; scope: string; onPick: (adds: string) => void }) {
  const r = useMemo(() => {
    const groups = byKey(trades, t => addKind(t));
    const red = trades.filter(t => t.addRed);
    const greenLost = trades.filter(t => addKind(t) === 'green-lost');
    const costRed = red.reduce((s, t) => s + (t.addPnlRed || 0), 0);
    const costGreen = trades.reduce((s, t) => s + (t.addPnlGreen || 0), 0);
    const losers = [...trades].filter(t => t.net_pnl < 0).sort((a, b) => a.net_pnl - b.net_pnl);
    const top = losers.slice(0, 20);
    const topRed = top.filter(t => t.addRed).length, topGreen = top.filter(t => addKind(t) === 'green-lost').length;
    const months = byKey(trades, t => dayOf(t.entry_at).slice(0, 7)).sort((a, b) => b.key.localeCompare(a.key)).slice(0, 12).map(m => {
      const ts = trades.filter(t => dayOf(t.entry_at).startsWith(m.key));
      const rd = ts.filter(t => t.addRed);
      return { month: m.key, count: ts.length, red: rd.length, cost: rd.reduce((s, t) => s + (t.addPnlRed || 0), 0), net: m.net };
    });
    return { groups, red, greenLost, costRed, costGreen, top, topRed, topGreen, months };
  }, [trades]);
  if (!trades.length) return null;
  const name = (m: string) => new Date(`${m}-15T12:00`).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });

  return (
    <section className="card p-4 min-w-0">
      <h3 className="font-semibold">Adding to positions</h3>
      <p className="text-xs text-edge mt-0.5">Counting: {scope}</p>
      <p className="text-xs text-mute mt-0.5">An add is a buy (long) or sell (short) after the first entry. Red means the add's price was worse than your average entry at that moment: you were losing and averaged down. Tap a row to see those trades.</p>
      <ul className="mt-3 space-y-1.5 text-sm list-disc pl-5">
        <li>You added to a losing position on <b>{r.red.length}</b> trades ({pct(r.red.length / trades.length)}). Just the added contracts {r.costRed < 0 ? 'lost' : 'made'} <b className={pnlClass(r.costRed)}>{usd(r.costRed)}</b>.</li>
        {r.top.length > 0 && <li>Of your {r.top.length} biggest losses, <b>{r.topRed}</b> came after averaging down{r.topGreen ? <> and <b>{r.topGreen}</b> after adding to a winner that then turned</> : null}.</li>}
        {r.greenLost.length > 0 && <li><b>{r.greenLost.length}</b> trades were winning when you added, then ended as losses ({usd(r.greenLost.reduce((s, t) => s + Number(t.net_pnl), 0))}).</li>}
        <li>Adds made while winning {r.costGreen < 0 ? 'lost' : 'made'} <span className={pnlClass(r.costGreen)}>{usd(r.costGreen)}</span> on the added contracts.</li>
      </ul>
      <div className="overflow-x-auto -mx-1 mt-3">
        <table className="w-full text-xs sm:text-sm num">
          <thead><tr className="text-[11px] text-mute text-right"><th className="text-left font-medium px-1 py-1"></th><th className="font-medium px-1">Trades</th><th className="font-medium px-1">Win</th><th className="font-medium px-1">Avg</th><th className="font-medium px-1">PF</th><th className="font-medium px-1">Net</th></tr></thead>
          <tbody>
            {ADD_KINDS.map(([k, label]) => {
              const g = r.groups.find(x => x.key === k);
              if (!g) return null;
              return (
                <tr key={k} onClick={() => onPick(k)} className={`border-t border-line text-right cursor-pointer hover:bg-line/40 ${k === 'red' || k === 'green-lost' ? 'bg-loss/5' : ''}`}>
                  <td className="text-left px-1 py-1.5 font-medium leading-tight">{label} ›</td><td className="px-1">{g.count}</td><td className="px-1">{pct(g.winRate)}</td>
                  <td className={`px-1 ${pnlClass(g.avg)}`}>{usd(g.avg)}</td><td className="px-1">{pf(g.pf)}</td><td className={`px-1 font-semibold ${pnlClass(g.net)}`}>{usd(g.net)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <h4 className="text-sm font-semibold mt-4">Month by month</h4>
      <p className="text-xs text-mute">Trades where you averaged down, and what those adds cost. The goal: zero.</p>
      <div className="overflow-x-auto -mx-1 mt-1">
        <table className="w-full text-xs sm:text-sm num">
          <thead><tr className="text-[11px] text-mute text-right"><th className="text-left font-medium px-1 py-1">Month</th><th className="font-medium px-1">Trades</th><th className="font-medium px-1">Averaged down</th><th className="font-medium px-1">Adds cost</th><th className="font-medium px-1">Month net</th></tr></thead>
          <tbody>
            {r.months.map(m => (
              <tr key={m.month} className="border-t border-line text-right">
                <td className="text-left px-1 py-1.5">{name(m.month)}</td><td className="px-1">{m.count}</td>
                <td className={`px-1 ${m.red ? 'text-loss' : 'text-win'}`}>{m.red} ({pct(m.red / m.count)})</td>
                <td className={`px-1 ${pnlClass(m.cost)}`}>{usd(m.cost)}</td><td className={`px-1 font-semibold ${pnlClass(m.net)}`}>{usd(m.net)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
