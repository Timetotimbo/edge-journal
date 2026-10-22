import { useMemo, useState } from 'react';
import type { Trade } from '../lib/types';
import { dayOf } from '../lib/stats';
import { estimateSize, sizeLabel, SIZES } from '../lib/accounts';

// Each account's running P&L, trade by trade: the highest and lowest it reached, where it ended, and its worst drop from a high.
// Uses every trade on each account (copies included), since each account had its own balance.
type Row = { account: string; size: number; sizeSet: boolean; trades: number; days: number; from: string; to: string; net: number; high: number; highOn: string; low: number; lowOn: string; dd: number };
const COLS: [keyof Row, string][] = [['size', 'Size'], ['high', 'High'], ['low', 'Low'], ['net', 'Final'], ['dd', 'Max DD'], ['trades', 'Trades']];
const usd = (n: number) => `${n > 0 ? '+' : n < 0 ? '-' : ''}$${Math.round(Math.abs(n)).toLocaleString('en-US')}`;
const short = (d: string) => new Date(`${d}T12:00`).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' });

export default function AccountRange({ trades, sizes, onSize }: { trades: Trade[]; sizes: Record<string, number>; onSize: (account: string, size: number | null) => void }) {
  const [only, setOnly] = useState(0);
  const [editing, setEditing] = useState('');
  const [sort, setSort] = useState<keyof Row>('high');
  const [desc, setDesc] = useState(true);
  const [all, setAll] = useState(false);
  const rows = useMemo(() => {
    const by = new Map<string, Trade[]>();
    for (const t of trades) { const k = t.account || t.broker; (by.get(k) || by.set(k, []).get(k)!).push(t); }
    return [...by.entries()].map(([account, ts]) => {
      ts.sort((a, b) => (a.exit_at || a.entry_at).localeCompare(b.exit_at || b.entry_at));
      let run = 0, high = 0, low = 0, peak = 0, dd = 0, highOn = '', lowOn = '';
      for (const t of ts) {
        run += Number(t.net_pnl);
        if (run > high) { high = run; highOn = dayOf(t.exit_at || t.entry_at); }
        if (run < low) { low = run; lowOn = dayOf(t.exit_at || t.entry_at); }
        peak = Math.max(peak, run);
        dd = Math.min(dd, run - peak);
      }
      const est = estimateSize(account, ts);
      return { account, size: sizes[account] || est || 0, sizeSet: !!sizes[account], trades: ts.length, days: new Set(ts.flatMap(t => [dayOf(t.entry_at), dayOf(t.exit_at || t.entry_at)])).size, from: dayOf(ts[0].entry_at), to: dayOf(ts[ts.length - 1].entry_at), net: run, high, highOn, low, lowOn, dd };
    });
  }, [trades, sizes]);
  const sorted = useMemo(() => [...rows].filter(r => !only || r.size === only).sort((a, b) => ((a[sort] as number) - (b[sort] as number)) * (desc ? -1 : 1)), [rows, sort, desc, only]);
  const present = [...new Set(rows.map(r => r.size).filter(Boolean))].sort((a, b) => a - b);
  if (!rows.length) return null;
  const pick = (k: keyof Row) => { if (k === sort) setDesc(!desc); else { setSort(k); setDesc(k !== 'low' && k !== 'dd'); } };
  const shown = all ? sorted : sorted.slice(0, 20);
  const reachedHigh = rows.filter(r => r.high > 0).length;

  return (
    <section className="card p-4 min-w-0">
      <h3 className="font-semibold">Accounts: highest and lowest P&L reached</h3>
      <p className="text-xs text-mute mt-0.5">
        Each account's running P&L from its first trade. High is the most it was ever up, Low the most it was ever down, Max DD its biggest drop from a high.
        {rows.length > 1 && ` ${reachedHigh} of ${rows.length} accounts were up at some point.`} Tap a column to sort.
        {' '}Size with a ~ is a guess from the most contracts traded on the account (the smallest size that allows it). Tap a size to set the real one.
      </p>
      {present.length > 1 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {[0, ...present].map(n => (
            <button key={n} onClick={() => setOnly(n)} className={`chip ${only === n ? 'border-edge bg-edge/15 text-edge' : 'border-line text-mute'}`}>
              {n ? `${sizeLabel(n)} (${rows.filter(r => r.size === n).length})` : 'All sizes'}
            </button>
          ))}
        </div>
      )}
      <div className="overflow-x-auto -mx-1 mt-2">
        <table className="w-full text-xs sm:text-sm num">
          <thead>
            <tr className="text-[11px] text-mute text-right">
              <th className="text-left font-medium px-1 py-1">Account · <button onClick={() => pick('days')} className={sort === 'days' ? 'text-edge' : ''}>days{sort === 'days' ? (desc ? ' ↓' : ' ↑') : ''}</button></th>
              {COLS.map(([k, l]) => (
                <th key={k} className="font-medium px-1"><button onClick={() => pick(k)} className={sort === k ? 'text-edge' : ''}>{l}{sort === k ? (desc ? ' ↓' : ' ↑') : ''}</button></th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map(r => (
              <tr key={r.account} className="border-t border-line text-right align-top">
                <td className="text-left px-1 py-1.5"><div className="font-medium whitespace-nowrap">{r.account.replace(/^(PA-)?APEX-\d+-/, (m, pa) => (pa ? 'PA ' : 'Apex '))}</div><div className="text-[10px] text-mute whitespace-nowrap">{short(r.from)}{r.to !== r.from ? `–${short(r.to)}` : ''}</div><div className="text-[10px] text-ink whitespace-nowrap">{r.days} trading day{r.days === 1 ? '' : 's'}</div></td>
                <td className="px-1 py-1.5 whitespace-nowrap">
                  {editing === r.account ? (
                    <select autoFocus className="field !h-8 !w-auto !px-1 text-xs" value={r.sizeSet ? r.size : ''} onBlur={() => setEditing('')}
                      onChange={e => { onSize(r.account, e.target.value ? +e.target.value : null); setEditing(''); }}>
                      <option value="">{r.sizeSet ? 'Clear' : 'Pick size'}</option>
                      {SIZES.map(n => <option key={n} value={n}>{sizeLabel(n)}</option>)}
                    </select>
                  ) : (
                    <button onClick={() => setEditing(r.account)} className={`underline decoration-dotted underline-offset-2 ${r.sizeSet ? 'font-semibold' : 'text-mute'}`}>
                      {r.size ? `${r.sizeSet ? '' : '~'}${sizeLabel(r.size)}` : 'Set'}
                    </button>
                  )}
                </td>
                <td className="px-1 py-1.5"><div className={`font-semibold ${r.high ? 'text-win' : 'text-mute'}`}>{usd(r.high)}</div>{r.size > 0 && r.high > 0 && <div className="text-[10px] text-win">{((r.high / r.size) * 100).toFixed(1)}%</div>}{r.highOn && <div className="text-[10px] text-mute">{short(r.highOn)}</div>}</td>
                <td className="px-1 py-1.5"><div className={`font-semibold ${r.low ? 'text-loss' : 'text-mute'}`}>{usd(r.low)}</div>{r.lowOn && <div className="text-[10px] text-mute">{short(r.lowOn)}</div>}</td>
                <td className={`px-1 py-1.5 font-semibold ${r.net > 0 ? 'text-win' : r.net < 0 ? 'text-loss' : 'text-mute'}`}>{usd(r.net)}</td>
                <td className={`px-1 py-1.5 ${r.dd ? 'text-loss' : 'text-mute'}`}>{usd(r.dd)}</td>
                <td className="px-1 py-1.5">{r.trades}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {sorted.length > 20 && <button className="btn text-mute hover:text-ink mt-2" onClick={() => setAll(!all)}>{all ? 'Show top 20' : `Show all ${sorted.length} accounts`}</button>}
    </section>
  );
}
