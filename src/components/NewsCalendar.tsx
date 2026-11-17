import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Radio } from 'lucide-react';
import { countdown, dayKey, dayLabel, fetchCalendar, msUntil, relevant, timeLabel, type Impact, type NewsEvent } from '../lib/calendar';

const DOT: Record<string, string> = { High: 'bg-loss', Medium: 'bg-edge', Low: 'bg-mute' };
const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'NZD', 'CNY'];

/** An economic calendar, like ForexFactory's: the week's scheduled news, soonest first, filtered by impact and currency. */
export default function NewsCalendar() {
  const [events, setEvents] = useState<NewsEvent[] | null>(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [impacts, setImpacts] = useState<Impact[]>(['High', 'Medium']);
  const [currencies, setCurrencies] = useState<string[]>(['USD']);
  const [, setTick] = useState(0);

  useEffect(() => {
    let gone = false;
    const load = () => fetchCalendar().then(e => { if (!gone) setEvents(e); }).catch(err => { if (!gone) setError(err.message); });
    load();
    const poll = setInterval(load, 5 * 60_000);
    const clock = setInterval(() => setTick(t => t + 1), 60_000);
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

  const toggle = <T,>(list: T[], v: T, set: (l: T[]) => void) => set(list.includes(v) ? list.filter(x => x !== v) : [...list, v]);

  return (
    <section className="card p-4">
      <div className="flex items-center gap-2">
        <Radio className="w-4 h-4 text-edge" />
        <h3 className="font-semibold">News</h3>
        {next && (
          <span className="text-xs text-mute truncate">
            Next: <span className="font-medium text-ink">{next.title}</span> ({next.country}) in <span className="num font-semibold text-edge">{countdown(msUntil(next))}</span>
          </span>
        )}
        <button className="ml-auto text-mute hover:text-ink" onClick={() => setOpen(o => !o)} aria-label={open ? 'Show less' : 'Show more'}>
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

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
    </section>
  );
}
