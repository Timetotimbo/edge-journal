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

/** One company's report, from Finnhub. hour: 'bmo' before the open, 'amc' after the close, '' not set. */
export type Earning = {
  symbol: string;
  date: string;
  hour: 'bmo' | 'amc' | '';
  epsEstimated: number | null;
  epsActual: number | null;
  revenueEstimated: number | null;
  revenueActual: number | null;
  image: string | null;
};

/** more: how many smaller companies weren't listed, by "date|hour". headline: this week's biggest reporters, named. */
export type Calendar = { events: NewsEvent[]; earnings: Earning[]; more: Record<string, number>; headline: { symbol: string; name: string }[]; earningsError?: string };

/** "The TJX Companies, Inc." → "TJX", "Alibaba Group Holding Limited" → "Alibaba" */
export function shortName(name: string): string {
  let s = name.replace(/^The\s+/i, '').trim(), was = '';
  while (s !== was) { was = s; s = s.replace(/,?\s+(Inc\.?|Incorporated|Corporation|Corp\.?|Company|Companies|Co\.?|Holdings?|Group|Limited|Ltd\.?|plc|N\.?V\.?|S\.?A\.?|AG|SE)$/i, '').trim(); }
  return s || name;
}

const dayCache = new Map<string, Promise<Earning[]>>();
/** One day's biggest earnings (up to 12), for a Journal day outside the two weeks the board holds */
export function fetchDayEarnings(day: string): Promise<Earning[]> {
  if (!dayCache.has(day)) {
    dayCache.set(day, fetch(`${NEWS}?day=${day}`).then(r => r.json()).then(b => (Array.isArray(b?.earnings) ? b.earnings : []))
      .catch(() => { dayCache.delete(day); return []; }));
  }
  return dayCache.get(day)!;
}

export type Profile = { name: string; exchange: string | null; industry: string | null; marketCap: number | null; logo: string | null; web: string | null };
const profiles = new Map<string, Promise<Profile | null>>();
/** A company's name and details, looked up when its logo is tapped */
export function fetchProfile(symbol: string): Promise<Profile | null> {
  if (!profiles.has(symbol)) {
    profiles.set(symbol, fetch(`${NEWS}?profile=${encodeURIComponent(symbol)}`).then(r => r.json()).then(b => b?.profile || null)
      .catch(() => { profiles.delete(symbol); return null; }));
  }
  return profiles.get(symbol)!;
}

let cache: { at: number; cal: Calendar } | null = null;

// Fetched by Social Bloom's tj-news function: the feed has no CORS header and turns away Cloudflare, where this is
// hosted, and the earnings key has to stay on the server
const NEWS = 'https://yrrlzqdabodopzaqjlwf.supabase.co/functions/v1/tj-news';

/** The week's economic calendar and upcoming earnings. Cached for 5 minutes per tab. */
export async function fetchCalendar(): Promise<Calendar> {
  if (cache && Date.now() - cache.at < 5 * 60_000) return cache.cal;
  const body = await fetch(NEWS).then(r => r.json()).catch(() => null);
  if (!Array.isArray(body?.events)) throw new Error(`Couldn't load the news calendar${body?.error ? `: ${body.error}` : ''}`);
  const cal: Calendar = { events: body.events, earnings: Array.isArray(body.earnings) ? body.earnings : [], more: body.more || {}, headline: Array.isArray(body.headline) ? body.headline : [], earningsError: body.earningsError };
  cache = { at: Date.now(), cal };
  return cal;
}

/** $3.76T, $40.2B, $812M: money at a glance */
export function bigMoney(n: number | null): string {
  if (n == null) return '–';
  const a = Math.abs(n);
  return a >= 1e12 ? `$${(n / 1e12).toFixed(2)}T` : a >= 1e9 ? `$${(n / 1e9).toFixed(1)}B` : a >= 1e6 ? `$${Math.round(n / 1e6)}M` : `$${Math.round(n).toLocaleString()}`;
}

export const whisperUrl = (symbol: string) => `https://www.earningswhispers.com/epsdetails/${encodeURIComponent(symbol)}`;

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
