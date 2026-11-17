import { useEffect, useMemo, useRef, useState } from 'react';
import { ExternalLink, Moon, Sun } from 'lucide-react';
import { bigMoney, fetchProfile, whisperUrl, type Calendar, type Earning, type Profile } from '../lib/calendar';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const SLOTS = [
  { hour: 'bmo', label: 'Before open', Icon: Sun },
  { hour: 'amc', label: 'After close', Icon: Moon },
  { hour: '', label: 'Time not set', Icon: null },
] as const;
const WHEN: Record<string, string> = { bmo: 'before the open', amc: 'after the close', '': 'time not set yet' };
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const vs = (actual: number | null, est: number | null) => (actual == null || est == null ? 'text-ink' : actual > est ? 'text-win' : actual < est ? 'text-loss' : 'text-ink');

/** A company's logo on a light tile, falling back to its ticker. The faint outline keeps all-white logos (Disney's) visible. */
function Logo({ src, symbol, className }: { src: string | null; symbol: string; className: string }) {
  const [broken, setBroken] = useState(false);
  return src && !broken
    ? <img src={src} alt={symbol} loading="lazy" onError={() => setBroken(true)} className={`object-contain ${className}`}
        style={{ filter: 'drop-shadow(0 0 0.6px rgba(0,0,0,0.85))' }} />
    : <span className="text-[11px] font-bold text-neutral-800">{symbol}</span>;
}

/** Earnings laid out like Earnings Whispers' weekly board: a column per weekday, split into before the open and
 *  after the close, biggest companies first. Tap a logo for the company's name and numbers. */
export default function EarningsBoard({ cal, error }: { cal: Calendar | null; error: string }) {
  const [week, setWeek] = useState<0 | 1>(0);
  const [picked, setPicked] = useState<Earning | null>(null);
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
  const today = ymd(new Date());
  // The details card sits under a tall board, so a tap brings it into view
  const details = useRef<HTMLDivElement>(null);
  useEffect(() => { if (picked) details.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, [picked]);

  useEffect(() => {
    setProfile(undefined);
    if (!picked) return;
    let gone = false;
    void fetchProfile(picked.symbol).then(p => { if (!gone) setProfile(p); });
    return () => { gone = true; };
  }, [picked]);

  const days = useMemo(() => {
    const now = new Date();
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7) + week * 7);
    return Array.from({ length: 5 }, (_, i) => ymd(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i)));
  }, [week]);
  const cell = (day: string, hour: string) => (cal?.earnings || []).filter(e => e.date === day && e.hour === hour);
  const slots = SLOTS.filter(s => days.some(d => cell(d, s.hour).length));

  const tile = (e: Earning) => {
    const on = picked?.symbol === e.symbol && picked.date === e.date;
    const beat = e.epsActual != null && e.epsEstimated != null ? (e.epsActual >= e.epsEstimated ? 'bg-win' : 'bg-loss') : '';
    return (
      <button key={e.symbol} onClick={() => setPicked(on ? null : e)} title={e.symbol}
        className={`relative w-full rounded-md bg-white p-1 flex flex-col items-center gap-0.5 border-2 ${on ? 'border-edge' : 'border-transparent'}`}>
        <span className="h-6 w-full grid place-items-center"><Logo src={e.image} symbol={e.symbol} className="max-h-6 max-w-full" /></span>
        <span className="text-[9px] font-semibold text-neutral-500 leading-none">{e.symbol}</span>
        {beat && <span className={`absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full ${beat}`} />}
      </button>
    );
  };

  if (error) return <p className="text-sm text-loss mt-3">{error}</p>;
  if (!cal) return <p className="text-sm text-mute mt-3">Loading…</p>;
  if (cal.earningsError) return <p className="text-sm text-mute mt-3">Earnings couldn't load ({cal.earningsError}).</p>;

  return (
    <div className="mt-3 space-y-3">
      <div className="flex rounded-lg border border-line p-0.5 text-xs w-max">
        {(['This week', 'Next week'] as const).map((l, i) => (
          <button key={l} onClick={() => { setWeek(i as 0 | 1); setPicked(null); }} className={`px-2 py-0.5 rounded-md ${week === i ? 'bg-line font-semibold text-ink' : 'text-mute'}`}>{l}</button>
        ))}
      </div>

      {!slots.length ? <p className="text-sm text-mute">No earnings listed for {week ? 'next' : 'this'} week.</p> : (
        <div className="rounded-lg bg-[#f3e2c4] p-1 space-y-1">
          <div className="grid grid-cols-5 gap-1">
            {days.map((d, i) => (
              <div key={d} className={`rounded-md py-0.5 text-center text-[10px] font-semibold leading-tight text-neutral-700 ${d === today ? 'bg-white ring-1 ring-edge' : ''}`}>
                {DAYS[i]} <span className="font-normal">{+d.slice(8)}</span>
              </div>
            ))}
          </div>
          {slots.map(({ hour, label, Icon }) => (
            <div key={hour || 'tba'}>
              <div className="flex items-center gap-1 px-1 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-600">
                {Icon && <Icon className="w-3 h-3" />}{label}
              </div>
              <div className="grid grid-cols-5 gap-1">
                {days.map(d => {
                  const list = cell(d, hour), more = cal.more[`${d}|${hour}`];
                  return (
                    <div key={d} className={`min-w-0 rounded-md p-1 space-y-1 ${d === today ? 'bg-white/60' : 'bg-white/30'}`}>
                      {list.map(tile)}
                      {more ? <div className="text-center text-[9px] text-neutral-500">+{more} more</div> : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {picked && (
        <div ref={details} className="rounded-lg border border-line p-3 space-y-2 scroll-mb-24">
          <div className="flex items-center gap-3">
            <span className="w-12 h-12 shrink-0 rounded-md bg-white p-1 grid place-items-center"><Logo src={picked.image || profile?.logo || null} symbol={picked.symbol} className="max-h-10 max-w-10" /></span>
            <div className="min-w-0">
              <div className="font-semibold leading-tight">{profile ? profile.name : profile === null ? picked.symbol : 'Loading…'}</div>
              <div className="text-xs text-mute">{[picked.symbol, profile?.exchange, profile?.industry].filter(Boolean).join(' · ')}</div>
              <div className="text-xs text-mute">
                Reports {new Date(`${picked.date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}, {WHEN[picked.hour]}
                {profile?.marketCap ? ` · market cap ${bigMoney(profile.marketCap)}` : ''}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm num">
            <div className="rounded-md bg-line/40 p-2">
              <div className="text-[11px] text-mute">EPS</div>
              {picked.epsActual != null ? <><span className={`font-bold ${vs(picked.epsActual, picked.epsEstimated)}`}>{picked.epsActual}</span> <span className="text-xs text-mute">vs {picked.epsEstimated ?? '–'} est</span></>
                : <><span className="font-bold">{picked.epsEstimated ?? '–'}</span> <span className="text-xs text-mute">est</span></>}
            </div>
            <div className="rounded-md bg-line/40 p-2">
              <div className="text-[11px] text-mute">Revenue</div>
              {picked.revenueActual != null ? <><span className={`font-bold ${vs(picked.revenueActual, picked.revenueEstimated)}`}>{bigMoney(picked.revenueActual)}</span> <span className="text-xs text-mute">vs {bigMoney(picked.revenueEstimated)} est</span></>
                : <><span className="font-bold">{bigMoney(picked.revenueEstimated)}</span> <span className="text-xs text-mute">est</span></>}
            </div>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <a href={whisperUrl(picked.symbol)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-edge">Whisper number<ExternalLink className="w-3.5 h-3.5" /></a>
            {profile?.web && <a href={profile.web} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-mute">Company site<ExternalLink className="w-3.5 h-3.5" /></a>}
          </div>
        </div>
      )}
      <p className="text-[11px] text-mute">Biggest companies first (by expected revenue). Tap a logo for details. Green or red dot: beat or missed EPS.</p>
    </div>
  );
}
