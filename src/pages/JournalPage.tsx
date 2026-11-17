import { useEffect, useMemo, useState } from 'react';
import type { Journal } from '../lib/store';
import type { Day } from '../lib/types';
import { dayOf, money, pct, pnlClass, summarize } from '../lib/stats';
import TradeRow from '../components/TradeRow';
import { EMOTIONS } from '../components/TradeDetail';
import DayCharts from '../components/DayCharts';
import MarketDay from '../components/MarketDay';
import { Images } from 'lucide-react';
import { CHARTS_CHANGED, chartDays, uploadCharts } from '../lib/charts';

/** Pick a whole batch of chart screenshots from the gallery; each lands on the day it was taken. */
function BulkCharts({ onDone }: { onDone: (days: string[]) => void }) {
  const [prog, setProg] = useState<{ done: number; total: number; failed: number } | null>(null);
  const [msg, setMsg] = useState('');
  const go = async (files: File[]) => {
    setMsg('');
    const days = await uploadCharts(files, (done, total, failed) => setProg({ done, total, failed }));
    setProg(p => { if (p) setMsg(`Added ${p.done - p.failed} chart${p.done - p.failed === 1 ? '' : 's'} to ${days.length} day${days.length === 1 ? '' : 's'}${p.failed ? ` · ${p.failed} didn't upload, pick those again` : ''}.`); return null; });
    onDone(days);
  };
  const working = !!prog;
  return (
    <div className="card p-3 flex flex-wrap items-center gap-3">
      <label className={`btn-edge !h-10 flex items-center gap-2 cursor-pointer ${working ? 'opacity-60 pointer-events-none' : ''}`}>
        <Images className="w-4 h-4" />{working ? 'Uploading…' : 'Upload charts from gallery'}
        <input type="file" accept="image/*" multiple className="hidden" onChange={e => { const fs = Array.from(e.target.files || []); e.target.value = ''; if (fs.length) void go(fs); }} />
      </label>
      {prog ? (
        <div className="flex-1 min-w-[10rem]">
          <div className="h-2 rounded-full bg-line overflow-hidden"><div className="h-full bg-edge transition-all" style={{ width: `${(prog.done / Math.max(1, prog.total)) * 100}%` }} /></div>
          <div className="text-xs text-mute mt-1">{prog.done} of {prog.total}{prog.failed ? ` · ${prog.failed} failed` : ''} — keep this screen open</div>
        </div>
      ) : <span className="text-xs text-mute flex-1 min-w-[10rem]">{msg || 'Select as many as you like — each goes on the day it was taken.'}</span>}
    </div>
  );
}

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
      <MarketDay day={day} />
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
  const [withCharts, setWithCharts] = useState<string[]>([]);
  useEffect(() => {
    const load = () => void chartDays().then(setWithCharts).catch(() => {});
    load(); addEventListener(CHARTS_CHANGED, load);
    return () => removeEventListener(CHARTS_CHANGED, load);
  }, []);
  const all = useMemo(() => [...new Set([today, ...(focus ? [focus] : []), ...Object.keys(j.days), ...(j.trades || []).map(t => dayOf(t.entry_at)), ...withCharts])].sort().reverse(), [j.days, j.trades, today, focus, withCharts]);
  const [shown, setShown] = useState(10);
  const upTo = focus ? Math.max(shown, all.indexOf(focus) + 1) : shown;
  useEffect(() => { if (focus) setTimeout(() => document.getElementById(`day-${focus}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50); }, [focus]);
  return (
    <div className="space-y-4">
      <BulkCharts onDone={() => {}} />
      {all.slice(0, upTo).map(d => <DayCard key={d} day={d} note={j.days[d]} j={j} onTrade={onTrade} focused={d === focus} />)}
      {upTo < all.length && <button className="btn-line w-full" onClick={() => setShown(upTo + 10)}>Show earlier days</button>}
    </div>
  );
}
