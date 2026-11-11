// 1-minute price bars from NinjaTrader's history, one file per instrument and Eastern date
// (public/bars/<ROOT>/<yyyy-mm-dd>.json, made by tools/export_bars.py). Each bar is [start (unix s), open, high, low, close, volume].
export type Bar = [number, number, number, number, number, number];
export type DayFile = { contract: string; tick: number; bars: Bar[] };

const cache = new Map<string, Promise<DayFile | null>>();
/** A bars file by its path under /bars, without ".json"; null when there isn't one. Fetched once. */
export function loadBars(k: string) {
  if (!cache.has(k)) cache.set(k, fetch(`/bars/${k}.json`).then(r => (r.ok ? r.json() : null)).catch(() => null));
  return cache.get(k)!;
}
export const etDate = (iso: string | number) => new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
export const dayBars = (root: string, date: string) => loadBars(`${root}/${date}`);
