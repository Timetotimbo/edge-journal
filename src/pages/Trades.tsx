import { useMemo, useState } from 'react';
import { Plus, Search, Trash2 } from 'lucide-react';
import type { Trade } from '../lib/types';
import type { Journal } from '../lib/store';
import { money, pnlClass, summarize } from '../lib/stats';
import TradeRow from '../components/TradeRow';
import AddTrade from '../components/AddTrade';

export default function Trades({ trades, j, onOpen }: { trades: Trade[]; j: Journal; onOpen: (id: string) => void }) {
  const [q, setQ] = useState('');
  const [result, setResult] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return trades.filter(t =>
      (!result || (result === 'win' ? t.net_pnl > 0 : result === 'loss' ? t.net_pnl < 0 : !t.notes && !t.setup && !t.emotion)) &&
      (!s || [t.symbol, t.setup, t.notes, t.emotion, ...t.tags, ...t.mistakes].some(x => x?.toLowerCase().includes(s))));
  }, [trades, q, result]);
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
        {list.length ? list.map(t => <TradeRow key={t.id} t={t} onOpen={onOpen} selected={picked.has(t.id)} onSelect={on => pick(t.id, on)} />)
          : <p className="py-6 text-center text-sm text-mute">No trades match.</p>}
      </div>
      {adding && <AddTrade j={j} onClose={() => setAdding(false)} />}
    </div>
  );
}
