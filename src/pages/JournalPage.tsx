import { useEffect, useMemo, useState } from 'react';
import type { Journal } from '../lib/store';
import type { Day } from '../lib/types';
import { dayOf, money, pct, pnlClass, summarize } from '../lib/stats';
import TradeRow from '../components/TradeRow';
import { EMOTIONS } from '../components/TradeDetail';
import DayCharts from '../components/DayCharts';

function DayCard({ day, note, j, onTrade, focused }: { day: string; note?: Day; j: Journal; onTrade: (id: string) => void; focused: boolean }) {
  const trades = useMemo(() => (j.trades || []).filter(t => dayOf(t.entry_at) === day).sort((a, b) => a.entry_at.localeCompare(b.entry_at)), [j.trades, day]);
  const s = summarize(trades);
  const [plan, setPlan] = useState(note?.plan || '');
  const [review, setReview] = useState(note?.review || '');
  const [err, setErr] = useState('');
  const save = (patch: Partial<Day>) => j.saveDay(day, patch).catch(e => setErr(e.message));
  const date = new Date(day + 'T12:00:00');
  return (
    <section id={`day-${day}`} className={`card p-4 space-y-3 scroll-mt-20 ${focused ? 'ring-2 ring-edge' : ''}`}>
      <div className="flex items-baseline gap-3">
        <h3 className="font-bold">{date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}</h3>
        {trades.length > 0 && <span className="text-xs text-mute">{trades.length} trade{trades.length === 1 ? '' : 's'} · {pct(s.winRate)} win</span>}
        {trades.length > 0 && <span className={`ml-auto num font-bold ${pnlClass(s.net)}`}>{money(s.net, true)}</span>}
      </div>
      {err && <p className="text-sm text-loss">{err}</p>}
      <div className="grid md:grid-cols-2 gap-3">
        <div>
          <label className="label">Plan (before the open)</label>
          <textarea rows={3} className="field !h-auto py-2" placeholder="Bias, key levels, the setups I'm waiting for, my max loss…" value={plan} onChange={e => setPlan(e.target.value)} onBlur={() => plan !== (note?.plan || '') && void save({ plan: plan || null })} />
        </div>
        <div>
          <label className="label">Review (after the close)</label>
          <textarea rows={3} className="field !h-auto py-2" placeholder="Did I follow the plan? What went well, what to fix tomorrow…" value={review} onChange={e => setReview(e.target.value)} onBlur={() => review !== (note?.review || '') && void save({ review: review || null })} />
        </div>
      </div>
      <div>
        <div className="label">Mood today</div>
        <div className="flex flex-wrap gap-1.5">
          {EMOTIONS.map(m => <button key={m} onClick={() => void save({ mood: note?.mood === m ? null : m })} className={`chip ${note?.mood === m ? 'border-edge bg-edge/15 text-edge' : 'border-line text-mute'}`}>{m}</button>)}
        </div>
      </div>
      <DayCharts day={day} />
      {trades.length > 0 && <div className="divide-y divide-line border-t border-line">{trades.map(t => <TradeRow key={t.id} t={t} onOpen={onTrade} />)}</div>}
    </section>
  );
}

export default function JournalPage({ j, focus, onTrade }: { j: Journal; focus: string | null; onTrade: (id: string) => void }) {
  const today = dayOf(new Date().toISOString());
  const all = useMemo(() => [...new Set([today, ...(focus ? [focus] : []), ...Object.keys(j.days), ...(j.trades || []).map(t => dayOf(t.entry_at))])].sort().reverse(), [j.days, j.trades, today, focus]);
  const [shown, setShown] = useState(10);
  const upTo = focus ? Math.max(shown, all.indexOf(focus) + 1) : shown;
  useEffect(() => { if (focus) setTimeout(() => document.getElementById(`day-${focus}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50); }, [focus]);
  return (
    <div className="space-y-4">
      {all.slice(0, upTo).map(d => <DayCard key={d} day={d} note={j.days[d]} j={j} onTrade={onTrade} focused={d === focus} />)}
      {upTo < all.length && <button className="btn-line w-full" onClick={() => setShown(upTo + 10)}>Show earlier days</button>}
    </div>
  );
}
