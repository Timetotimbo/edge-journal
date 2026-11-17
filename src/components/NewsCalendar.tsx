import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, ExternalLink, Radio } from 'lucide-react';
import { bigMoney, countdown, dayKey, dayLabel, fetchCalendar, msUntil, relevant, timeLabel, whisperUrl, type Calendar, type Earning, type Impact, type NewsEvent } from '../lib/calendar';

const DOT: Record<string, string> = { High: 'bg-loss', Medium: 'bg-edge', Low: 'bg-mute' };
const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'NZD', 'CNY'];

/** An economic calendar, like ForexFactory's: the week's scheduled news, soonest first, filtered by impact and currency.
 *  A second tab lists upcoming earnings, each with a link to its Earnings Whispers page. */
export default function NewsCalendar() {
  const [cal, setCal] = useState<Calendar | null>(null);
  const events = cal?.events || null;
  const [view, setView] = useState<'economic' | 'earnings'>('economic');
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [impacts, setImpacts] = useState<Impact[]>(['High', 'Medium']);
  const [currencies, setCurrencies] = useState<string[]>(['USD']);
  const [, setTick] = useState(0);

  useEffect(() => {
    let gone = false;
    const load = () => fetchCalendar().then(c => { if (!gone) { setCal(c); setError(''); } }).catch(err => { if (!gone) setError(err.message); });
    load();
    const poll = setInterval(load, 5 * 60_000);
    const clock = setInterval(() => setTick(t => t + 1), 1000);
    return () => { gone = true; clearInterval(poll); clearInterval(clock); };
  }, []);

  const filtered = useMemo(() => {
    if (!events) return [];
    return relevant(events, currencies).filter(e => impacts.includes(e.impact as Impact)).sort((a, b) => a.date.localeCompare(b.date));
  }, [events, impacts, currencies]);

  const next = filtered.find(e => msUntil(e) > -30 * 60_000);
  const upcoming = useMemo(() => filtered.filter(e => msUntil(e) > -6 * 60 * 60_000).slice(0, open ? 100 : 6), [filtered, open]);
  const grouped = useMemo(() => {
    const byDay = new Map<string, NewsEvent[]>();
    for (const e of upcoming) { const k = dayKey(e); (byDay.get(k) || byDay.set(k, []).get(k)!).push(e); }
    return [...byDay.entries()];
  }, [upcoming]);

  // Earnings from yesterday on, by day, biggest names first within a day isn't known on the free plan, so A–Z
  const earningDays = useMemo(() => {
    const byDay = new Map<string, Earning[]>();
    for (const e of [...(cal?.earnings || [])].sort((a, b) => a.date.localeCompare(b.date) || a.symbol.localeCompare(b.symbol))) {
      (byDay.get(e.date) || byDay.set(e.date, []).get(e.date)!).push(e);
    }
    return [...byDay.entries()];
  }, [cal]);
  const vs = (actual: number | null, est: number | null) => (actual == null || est == null ? 'text-ink' : actual > est ? 'text-win' : actual < est ? 'text-loss' : 'text-ink');

  const toggle = <T,>(list: T[], v: T, set: (l: T[]) => void) => set(list.includes(v) ? list.filter(x => x !== v) : [...list, v]);

  return (
    <section className="card p-4">
      <div className="flex items-center gap-2">
        <Radio className="w-4 h-4 text-edge shrink-0" />
        <h3 className="font-semibold">News</h3>
        <div className="flex rounded-lg border border-line p-0.5 text-xs">
          {(['economic', 'earnings'] as const).map(v => (
            <button key={v} onClick={() => setView(v)} className={`px-2 py-0.5 rounded-md ${view === v ? 'bg-line font-semibold text-ink' : 'text-mute'}`}>{v === 'economic' ? 'Economic' : 'Earnings'}</button>
          ))}
        </div>
        <button className="ml-auto text-mute hover:text-ink shrink-0" onClick={() => setOpen(o => !o)} aria-label={open ? 'Show less' : 'Show more'}>
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {view === 'economic' && next && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-edge/30 bg-edge/10 px-3 py-2">
          <span className={`w-2 h-2 rounded-full shrink-0 ${DOT[next.impact as string] || 'bg-mute'}`} />
          <span className="min-w-0 flex-1 truncate text-sm">
            <span className="font-medium">{next.title}</span> <span className="text-xs text-mute">({next.country})</span>
          </span>
          <span className="shrink-0 num text-sm font-bold text-edge">
            {msUntil(next) > 0 ? countdown(msUntil(next)) : 'now'}
          </span>
        </div>
      )}

      {view === 'earnings' ? (
        <div className="mt-3">
          {error ? <p className="text-sm text-loss">{error}</p>
            : !cal ? <p className="text-sm text-mute">Loading…</p>
            : cal.earningsError ? <p className="text-sm text-mute">Earnings couldn't load ({cal.earningsError}).</p>
            : !earningDays.length ? <p className="text-sm text-mute">No earnings listed for the next week.</p>
            : (
              <div className="divide-y divide-line">
                {earningDays.map(([day, list]) => (
                  <div key={day} className="py-2 first:pt-0">
                    <div className="text-xs font-medium text-mute mb-1">{dayLabel(day)}</div>
                    <ul className="space-y-1.5">
                      {list.map(e => (
                        <li key={e.symbol} className="flex items-baseline gap-2 text-sm">
                          <span className="w-14 shrink-0 font-semibold">{e.symbol}</span>
                          <span className="min-w-0 flex-1 truncate text-xs text-mute num">
                            EPS {e.epsActual != null ? <span className={`font-semibold ${vs(e.epsActual, e.epsEstimated)}`}>{e.epsActual}</span> : null}{e.epsActual != null ? ' vs ' : ''}{e.epsEstimated ?? '–'} est
                            {' · '}Rev {e.revenueActual != null ? <span className={`font-semibold ${vs(e.revenueActual, e.revenueEstimated)}`}>{bigMoney(e.revenueActual)}</span> : null}{e.revenueActual != null ? ' vs ' : ''}{bigMoney(e.revenueEstimated)} est
                          </span>
                          <a href={whisperUrl(e.symbol)} target="_blank" rel="noopener noreferrer" className="shrink-0 flex items-center gap-0.5 text-xs text-edge">Whisper<ExternalLink className="w-3 h-3" /></a>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          <p className="text-[11px] text-mute mt-2">Big names only, and no before-open / after-close times, on the free data plan. Whisper opens Earnings Whispers.</p>
        </div>
      ) : (<>
      <div className="flex flex-wrap gap-1.5 mt-3">
        {(['High', 'Medium', 'Low'] as Impact[]).map(i => (
          <button key={i} onClick={() => toggle(impacts, i, setImpacts)}
            className={`text-[11px] px-2 py-0.5 rounded-full border flex items-center gap-1 ${impacts.includes(i) ? 'border-line bg-line/60' : 'border-line/50 text-mute'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${DOT[i]}`} />{i}
          </button>
        ))}
        <span className="w-px bg-line mx-1" />
        {CURRENCIES.map(c => (
          <button key={c} onClick={() => toggle(currencies, c, setCurrencies)}
            className={`text-[11px] px-2 py-0.5 rounded-full border ${currencies.includes(c) ? 'border-line bg-line/60 font-medium' : 'border-line/50 text-mute'}`}>
            {c}
          </button>
        ))}
      </div>

      {error ? <p className="text-sm text-loss mt-3">{error}</p>
        : !events ? <p className="text-sm text-mute mt-3">Loading…</p>
        : !grouped.length ? <p className="text-sm text-mute mt-3">Nothing matches those filters this week.</p>
        : (
          <div className="mt-3 divide-y divide-line">
            {grouped.map(([key, items]) => (
              <div key={key} className="py-2 first:pt-3">
                <div className="text-xs font-medium text-mute mb-1">{dayLabel(key)}</div>
                <ul className="space-y-1.5">
                  {items.map((e, i) => {
                    const past = msUntil(e) < 0;
                    return (
                      <li key={`${key}-${i}`} className={`flex items-baseline gap-2 text-sm ${past ? 'opacity-50' : ''}`}>
                        <span className="w-14 shrink-0 num text-xs text-mute">{timeLabel(e)}</span>
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${DOT[e.impact as string] || 'bg-mute'}`} />
                        <span className="w-9 shrink-0 text-xs font-semibold text-mute">{e.country}</span>
                        <span className="truncate">{e.title}</span>
                        {(e.forecast || e.previous) && (
                          <span className="ml-auto shrink-0 text-xs text-mute num">
                            {e.forecast && <>f {e.forecast}</>}{e.forecast && e.previous && ' · '}{e.previous && <>p {e.previous}</>}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
      {!open && filtered.length > upcoming.length && (
        <button className="text-xs text-edge mt-2" onClick={() => setOpen(true)}>Show the full week →</button>
      )}
      </>)}
    </section>
  );
}
