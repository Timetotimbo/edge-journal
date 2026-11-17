import { useMemo, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { bigMoney, whisperUrl, type Calendar, type Earning } from '../lib/calendar';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const vs = (actual: number | null, est: number | null) => (actual == null || est == null ? 'text-ink' : actual > est ? 'text-win' : actual < est ? 'text-loss' : 'text-ink');

/** A company's logo on a light tile, falling back to its ticker. The faint outline keeps all-white logos (Disney's) visible. */
function Logo({ e, className }: { e: Earning; className: string }) {
  const [broken, setBroken] = useState(false);
  return e.image && !broken
    ? <img src={e.image} alt={e.name || e.symbol} loading="lazy" onError={() => setBroken(true)} className={`object-contain ${className}`}
        style={{ filter: 'drop-shadow(0 0 0.6px rgba(0,0,0,0.85))' }} />
    : <span className="text-[11px] font-bold text-neutral-800">{e.symbol}</span>;
}

/** Earnings laid out like Earnings Whispers' weekly board: a column per weekday, logos biggest company first.
 *  Tap a logo for the company's name and numbers. */
export default function EarningsBoard({ cal, error }: { cal: Calendar | null; error: string }) {
  const [week, setWeek] = useState<0 | 1>(0);
  const [picked, setPicked] = useState<string | null>(null);
  const today = ymd(new Date());

  const columns = useMemo(() => {
    const now = new Date();
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7) + week * 7);
    const days = Array.from({ length: 7 }, (_, i) => ymd(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i)));
    const on = (d: string) => (cal?.earnings || []).filter(e => e.date === d).sort((a, b) => (b.marketCap || 0) - (a.marketCap || 0));
    return { weekdays: days.slice(0, 5).map(d => ({ day: d, list: on(d) })), weekend: [...on(days[5]), ...on(days[6])] };
  }, [cal, week]);

  const pick = cal?.earnings.find(e => `${e.date}:${e.symbol}` === picked) || null;
  const tile = (e: Earning) => {
    const key = `${e.date}:${e.symbol}`;
    const beat = e.epsActual != null && e.epsEstimated != null ? (e.epsActual >= e.epsEstimated ? 'bg-win' : 'bg-loss') : '';
    return (
      <button key={key} onClick={() => setPicked(picked === key ? null : key)} title={e.name || e.symbol}
        className={`relative w-full rounded-md bg-white p-1 flex flex-col items-center gap-0.5 border-2 ${picked === key ? 'border-edge' : 'border-transparent'}`}>
        <span className="h-7 w-full grid place-items-center"><Logo e={e} className="max-h-7 max-w-full" /></span>
        <span className="text-[9px] font-semibold text-neutral-500 leading-none">{e.symbol}</span>
        {beat && <span className={`absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full ${beat}`} />}
      </button>
    );
  };

  if (error) return <p className="text-sm text-loss mt-3">{error}</p>;
  if (!cal) return <p className="text-sm text-mute mt-3">Loading…</p>;
  if (cal.earningsError) return <p className="text-sm text-mute mt-3">Earnings couldn't load ({cal.earningsError}).</p>;
  const empty = !columns.weekdays.some(c => c.list.length) && !columns.weekend.length;

  return (
    <div className="mt-3 space-y-3">
      <div className="flex rounded-lg border border-line p-0.5 text-xs w-max">
        {(['This week', 'Next week'] as const).map((l, i) => (
          <button key={l} onClick={() => { setWeek(i as 0 | 1); setPicked(null); }} className={`px-2 py-0.5 rounded-md ${week === i ? 'bg-line font-semibold text-ink' : 'text-mute'}`}>{l}</button>
        ))}
      </div>

      {empty ? <p className="text-sm text-mute">No earnings listed for {week ? 'next' : 'this'} week.</p> : (
        <div className="grid grid-cols-5 gap-1 rounded-lg bg-[#f3e2c4] p-1">
          {columns.weekdays.map(({ day, list }, i) => (
            <div key={day} className={`min-w-0 rounded-md p-1 space-y-1 ${day === today ? 'bg-white/60 ring-1 ring-edge' : 'bg-white/30'}`}>
              <div className="text-center text-[10px] font-semibold text-neutral-700 leading-tight">{DAYS[i]}<br /><span className="font-normal">{+day.slice(8)}</span></div>
              {list.map(tile)}
            </div>
          ))}
        </div>
      )}
      {columns.weekend.length > 0 && (
        <div className="flex items-center gap-1"><span className="text-xs text-mute mr-1">Weekend</span>{columns.weekend.map(e => <div key={e.symbol} className="w-14">{tile(e)}</div>)}</div>
      )}

      {pick && (
        <div className="rounded-lg border border-line p-3 space-y-2">
          <div className="flex items-center gap-3">
            <span className="w-12 h-12 shrink-0 rounded-md bg-white p-1 grid place-items-center"><Logo e={pick} className="max-h-10 max-w-10" /></span>
            <div className="min-w-0">
              <div className="font-semibold leading-tight">{pick.name || pick.symbol}</div>
              <div className="text-xs text-mute">{[pick.symbol, pick.exchange, pick.sector].filter(Boolean).join(' · ')}</div>
              <div className="text-xs text-mute">
                Reports {new Date(`${pick.date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                {pick.marketCap ? ` · market cap ${bigMoney(pick.marketCap)}` : ''}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm num">
            <div className="rounded-md bg-line/40 p-2">
              <div className="text-[11px] text-mute">EPS</div>
              {pick.epsActual != null ? <><span className={`font-bold ${vs(pick.epsActual, pick.epsEstimated)}`}>{pick.epsActual}</span> <span className="text-xs text-mute">vs {pick.epsEstimated ?? '–'} est</span></>
                : <><span className="font-bold">{pick.epsEstimated ?? '–'}</span> <span className="text-xs text-mute">est</span></>}
            </div>
            <div className="rounded-md bg-line/40 p-2">
              <div className="text-[11px] text-mute">Revenue</div>
              {pick.revenueActual != null ? <><span className={`font-bold ${vs(pick.revenueActual, pick.revenueEstimated)}`}>{bigMoney(pick.revenueActual)}</span> <span className="text-xs text-mute">vs {bigMoney(pick.revenueEstimated)} est</span></>
                : <><span className="font-bold">{bigMoney(pick.revenueEstimated)}</span> <span className="text-xs text-mute">est</span></>}
            </div>
          </div>
          <a href={whisperUrl(pick.symbol)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-edge">Whisper number on Earnings Whispers<ExternalLink className="w-3.5 h-3.5" /></a>
        </div>
      )}
      <p className="text-[11px] text-mute">Biggest companies first. Tap a logo for details. Green or red dot: beat or missed EPS. The free data plan covers big names only, with no before-open / after-close times.</p>
    </div>
  );
}
