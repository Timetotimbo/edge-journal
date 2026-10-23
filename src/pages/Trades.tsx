import { useMemo, useState } from 'react';
import { Plus, Search, Trash2 } from 'lucide-react';
import type { Trade } from '../lib/types';
import type { Journal } from '../lib/store';
import { money, pnlClass, summarize } from '../lib/stats';
import TradeRow from '../components/TradeRow';
import AddTrade from '../components/AddTrade';

// How the list is ordered; points are per contract (exit − entry, flipped for shorts)
const SORTS: [string, string, (a: Trade, b: Trade) => number][] = [
  ['new', 'Newest first', (a, b) => b.entry_at.localeCompare(a.entry_at)],
  ['old', 'Oldest first', (a, b) => a.entry_at.localeCompare(b.entry_at)],
  ['win', 'Biggest win', (a, b) => b.net_pnl - a.net_pnl],
  ['loss', 'Biggest loss', (a, b) => a.net_pnl - b.net_pnl],
  ['pts', 'Most points', (a, b) => points(b) - points(a)],
  ['ptsl', 'Fewest points', (a, b) => points(a) - points(b)],
  ['size', 'Largest size', (a, b) => b.qty - a.qty || b.entry_at.localeCompare(a.entry_at)],
  ['hold', 'Longest hold', (a, b) => held(b) - held(a)],
];
const points = (t: Trade) => (t.exit_price === null ? 0 : (t.exit_price - t.entry_price) * (t.side === 'long' ? 1 : -1));
const held = (t: Trade) => (t.exit_at ? new Date(t.exit_at).getTime() - new Date(t.entry_at).getTime() : 0);

export default function Trades({ trades, j, onOpen }: { trades: Trade[]; j: Journal; onOpen: (id: string, list: string[]) => void }) {
  const [q, setQ] = useState('');
  const [result, setResult] = useState('');
  const [root, setRoot] = useState('');
  const [size, setSize] = useState('');
  const [sort, setSort] = useState('new');
  const roots = useMemo(() => [...new Set(trades.map(t => t.root))].sort(), [trades]);
  const sizes = useMemo(() => [...new Set(trades.map(t => Number(t.qty)))].sort((a, b) => a - b), [trades]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    const by = SORTS.find(x => x[0] === sort)![2];
    return trades.filter(t =>
      (!root || t.root === root) && (!size || Number(t.qty) === +size) &&
      (!result || (result === 'win' ? t.net_pnl > 0 : result === 'loss' ? t.net_pnl < 0 : !t.notes && !t.setup && !t.emotion)) &&
      (!s || [t.symbol, t.setup, t.notes, t.emotion, ...t.tags, ...t.mistakes].some(x => x?.toLowerCase().includes(s)))).sort(by);
  }, [trades, q, result, root, size, sort]);
  const s = summarize(list);
  const pick = (id: string, on: boolean) => setPicked(p => { const n = new Set(p); if (on) n.add(id); else n.delete(id); return n; });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[12rem]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-mute" />
          <input className="field !pl-9" placeholder="Search symbol, setup, tag, note…" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <select className="field !w-auto" value={result} onChange={e => setResult(e.target.value)}>
          <option value="">Wins & losses</option><option value="win">Wins</option><option value="loss">Losses</option><option value="todo">Not reviewed yet</option>
        </select>
        {roots.length > 1 && (
          <select className="field !w-auto" value={root} onChange={e => setRoot(e.target.value)} aria-label="Instrument">
            <option value="">All instruments</option>
            {roots.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        )}
        {sizes.length > 1 && (
          <select className="field !w-auto" value={size} onChange={e => setSize(e.target.value)} aria-label="Size">
            <option value="">Any size</option>
            {sizes.map(n => <option key={n} value={n}>×{n}</option>)}
          </select>
        )}
        <select className="field !w-auto" value={sort} onChange={e => setSort(e.target.value)} aria-label="Sort">
          {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <button className="btn-edge h-10" onClick={() => setAdding(true)}><Plus className="w-4 h-4" />Add trade</button>
      </div>
      <div className="flex items-center gap-3 text-sm">
        <span className="text-mute">{list.length} trade{list.length === 1 ? '' : 's'}</span>
        <span className={`num font-bold ${pnlClass(s.net)}`}>{money(s.net, true)}</span>
        {picked.size > 0 && (
          <button className="btn text-loss hover:bg-loss/10 ml-auto" onClick={() => { if (confirm(`Delete ${picked.size} trade${picked.size === 1 ? '' : 's'}?`)) void j.deleteTrades([...picked]).then(() => setPicked(new Set())); }}>
            <Trash2 className="w-4 h-4" />Delete {picked.size}
          </button>
        )}
      </div>
      <div className="card px-4 divide-y divide-line">
        {list.length ? list.map(t => <TradeRow key={t.id} t={t} onOpen={id => onOpen(id, list.map(x => x.id))} selected={picked.has(t.id)} onSelect={on => pick(t.id, on)} />)
          : <p className="py-6 text-center text-sm text-mute">No trades match.</p>}
      </div>
      {adding && <AddTrade j={j} onClose={() => setAdding(false)} />}
    </div>
  );
}
