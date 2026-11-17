export type Impact = 'High' | 'Medium' | 'Low';

export type NewsEvent = {
  title: string;
  country: string;   // currency code: USD, EUR, GBP…
  date: string;       // ISO, with offset
  impact: Impact | string;
  forecast: string;
  previous: string;
  actual?: string;
};

let cache: { at: number; events: NewsEvent[] } | null = null;

/** The week's economic calendar, proxied through /api/calendar so the browser never hits the feed directly. Cached for 5 minutes per tab. */
export async function fetchCalendar(): Promise<NewsEvent[]> {
  if (cache && Date.now() - cache.at < 5 * 60_000) return cache.events;
  const res = await fetch('/api/calendar');
  if (!res.ok) {
    const why = await res.json().then(b => b?.error).catch(() => '');
    throw new Error(`Couldn't load the news calendar${why ? `: ${why}` : ''}`);
  }
  const events: NewsEvent[] = await res.json();
  cache = { at: Date.now(), events };
  return events;
}

export const IMPACT_ORDER: Impact[] = ['High', 'Medium', 'Low'];

/** Events for a currency a US futures trader actually feels: the instrument's own currency plus USD, which moves every dollar-denominated future. */
export function relevant(events: NewsEvent[], currencies: string[]): NewsEvent[] {
  return events.filter(e => currencies.includes(e.country));
}

export function msUntil(e: NewsEvent): number {
  return new Date(e.date).getTime() - Date.now();
}

export function dayKey(e: NewsEvent): string {
  const d = new Date(e.date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function dayLabel(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const today = new Date();
  const diff = Math.round((date.setHours(0, 0, 0, 0) - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

export function timeLabel(e: NewsEvent): string {
  return new Date(e.date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export function countdown(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}
