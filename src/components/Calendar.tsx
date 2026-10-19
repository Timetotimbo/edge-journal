import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Trade } from '../lib/types';
import { byKey, compact, dayOf, money } from '../lib/stats';

/** A month of daily P&L, Monday first, with each week's total. Tap a day to open it in the journal. */
export default function Calendar({ trades, onDay }: { trades: Trade[]; onDay: (day: string) => void }) {
  const latest = trades[0] ? new Date(trades[0].entry_at) : new Date();
  const [month, setMonth] = useState(() => new Date(latest.getFullYear(), latest.getMonth(), 1));
  const days = useMemo(() => Object.fromEntries(byKey(trades, t => dayOf(t.entry_at)).map(d => [d.key, d])), [trades]);
  const first = (month.getDay() + 6) % 7;
  const inMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = [...Array(first).fill(null), ...Array.from({ length: inMonth }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1))];
  while (cells.length % 7) cells.push(null);
  const weeks = Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7));
  const key = (d: Date) => dayOf(d.toISOString());
  const monthNet = Object.values(days).filter(d => d.key.startsWith(key(month).slice(0, 7))).reduce((s, d) => s + d.net, 0);
  const shift = (n: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1));

  return (
    <section className="card p-4">
      <div className="flex items-center gap-2 mb-3">
        <button className="btn-line !px-2" onClick={() => shift(-1)} aria-label="Previous month"><ChevronLeft className="w-4 h-4" /></button>
        <h3 className="font-semibold">{month.toLocaleString('en-US', { month: 'long', year: 'numeric' })}</h3>
        <button className="btn-line !px-2" onClick={() => shift(1)} aria-label="Next month"><ChevronRight className="w-4 h-4" /></button>
        <span className={`ml-auto num font-bold ${monthNet > 0 ? 'text-win' : monthNet < 0 ? 'text-loss' : 'text-mute'}`}>{money(monthNet, true)}</span>
      </div>
      <div className="grid grid-cols-[repeat(7,minmax(0,1fr))_minmax(0,1.1fr)] gap-1 text-[10px] sm:text-xs">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'Week'].map(d => <div key={d} className="text-center text-mute font-medium pb-1">{d}</div>)}
        {weeks.map((w, i) => {
          const wk = w.reduce((s, d) => s + (d ? days[key(d)]?.net || 0 : 0), 0);
          const n = w.reduce((s, d) => s + (d ? days[key(d)]?.count || 0 : 0), 0);
          return [
            ...w.map((d, j) => {
              const g = d && days[key(d)];
              return (
                <button key={`${i}-${j}`} disabled={!d} onClick={() => d && onDay(key(d))}
                  className={`aspect-square sm:aspect-[4/3] rounded-md border p-1 text-left flex flex-col overflow-hidden ${!d ? 'border-transparent' : g ? (g.net >= 0 ? 'border-win/40 bg-win/10' : 'border-loss/40 bg-loss/10') : 'border-line'}`}>
                  {d && <span className="text-mute">{d.getDate()}</span>}
                  {g && <span className={`mt-auto num font-semibold truncate ${g.net >= 0 ? 'text-win' : 'text-loss'}`}>{compact(g.net)}</span>}
                  {g && <span className="hidden sm:block text-mute truncate">{g.count} trade{g.count === 1 ? '' : 's'}</span>}
                </button>
              );
            }),
            <div key={`w${i}`} className="rounded-md bg-line/40 p-1 flex flex-col justify-end text-right">
              {n > 0 && <span className={`num font-semibold truncate ${wk >= 0 ? 'text-win' : 'text-loss'}`}>{compact(wk)}</span>}
              {n > 0 && <span className="hidden sm:block text-mute">{n}</span>}
            </div>,
          ];
        })}
      </div>
    </section>
  );
}
