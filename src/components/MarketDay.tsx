import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { dayKey, fetchCalendar, fetchDayEarnings, timeLabel, whisperUrl, type Earning, type NewsEvent } from '../lib/calendar';

const DOT: Record<string, string> = { High: 'bg-loss', Medium: 'bg-edge' };
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** What the market had scheduled on a journal day: US economic releases that move futures (high and medium impact)
 *  and the day's biggest earnings, before the open and after the close. The economic feed only covers the current
 *  week, so older days show earnings alone. */
export default function MarketDay({ day }: { day: string }) {
  const [events, setEvents] = useState<NewsEvent[] | null>(null);
  const [earnings, setEarnings] = useState<Earning[] | null>(null);
  const [thisWeek, setThisWeek] = useState(false);

  useEffect(() => {
    let gone = false;
    const now = new Date();
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
    const from = ymd(monday), sunday = ymd(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6));
    const lastBoardDay = ymd(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 13));
    const inWeek = day >= from && day <= sunday;
    setThisWeek(inWeek);
    void fetchCalendar().then(cal => {
      if (gone) return;
      setEvents(inWeek ? cal.events.filter(e => dayKey(e) === day && e.country === 'USD' && (e.impact === 'High' || e.impact === 'Medium')) : []);
      if (day >= from && day <= lastBoardDay) setEarnings(cal.earnings.filter(e => e.date === day));
    }).catch(() => { if (!gone) setEvents([]); });
    if (day < from || day > lastBoardDay) void fetchDayEarnings(day).then(list => { if (!gone) setEarnings(list); });
    return () => { gone = true; };
  }, [day]);

  if (events === null || earnings === null) return null;
  const before = earnings.filter(e => e.hour === 'bmo'), after = earnings.filter(e => e.hour === 'amc'), unset = earnings.filter(e => !e.hour);
  if (!events.length && !earnings.length) return null;

  const chip = (e: Earning) => {
    const res = e.epsActual != null && e.epsEstimated != null ? (e.epsActual >= e.epsEstimated ? 'text-win border-win/40' : 'text-loss border-loss/40') : 'border-line';
    return (
      <a key={e.symbol} href={whisperUrl(e.symbol)} target="_blank" rel="noopener noreferrer" title={e.epsActual != null ? `EPS ${e.epsActual} vs ${e.epsEstimated ?? '–'} est` : `EPS ${e.epsEstimated ?? '–'} est`}
        className={`text-xs font-semibold rounded-md border px-1.5 py-0.5 ${res}`}>{e.symbol}</a>
    );
  };
  const row = (Icon: typeof Sun | null, label: string, list: Earning[]) => list.length > 0 && (
    <div className="flex items-start gap-2">
      <span className="w-24 shrink-0 flex items-center gap-1 text-xs text-mute pt-0.5">{Icon && <Icon className="w-3 h-3" />}{label}</span>
      <div className="flex flex-wrap gap-1">{list.map(chip)}</div>
    </div>
  );

  return (
    <div className="rounded-lg border border-line p-3 space-y-2">
      <div className="label !mb-0">Market this day</div>
      {events.length > 0 && (
        <ul className="space-y-1">
          {events.map((e, i) => (
            <li key={i} className="flex items-baseline gap-2 text-sm">
              <span className="w-14 shrink-0 num text-xs text-mute">{timeLabel(e)}</span>
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${DOT[e.impact as string]}`} />
              <span className="min-w-0 flex-1 truncate">{e.title}</span>
              {(e.forecast || e.previous) && <span className="shrink-0 text-xs text-mute num">{e.forecast && `f ${e.forecast}`}{e.forecast && e.previous && ' · '}{e.previous && `p ${e.previous}`}</span>}
            </li>
          ))}
        </ul>
      )}
      {!thisWeek && <p className="text-[11px] text-mute">Economic releases are only kept for the current week; earnings below.</p>}
      {earnings.length > 0 && (
        <div className="space-y-1.5">
          {row(Sun, 'Before open', before)}
          {row(Moon, 'After close', after)}
          {row(null, 'Time not set', unset)}
        </div>
      )}
    </div>
  );
}
