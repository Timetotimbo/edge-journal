import { useEffect, useRef, useState } from 'react';
import type { IChartApi, SeriesMarker, UTCTimestamp } from 'lightweight-charts';
import type { Trade } from '../lib/types';
import { price } from './TradeRow';

// The chart at the time of a trade: 1-minute bars from NinjaTrader's price history (public/bars/<ROOT>/<Eastern date>.json,
// made by tools/export_bars.py) with the trade's buys and sells marked. The zoomed-out frames (1h, 4h, daily) use hourly bars
// for the trade's month and the months either side (public/bars/<ROOT>/h/<yyyy-mm>.json, from tools/export_hourly.py).
type Bar = [number, number, number, number, number, number];
type DayFile = { contract: string; tick: number; bars: Bar[] };

// Minutes per bar; a day is one futures session (6pm Eastern to 5pm)
const DAY = 1440;
const FRAMES: [number, string][] = [[1, '1m'], [5, '5m'], [15, '15m'], [60, '1h'], [240, '4h'], [DAY, 'D']];
const etDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' });
// The bar a moment falls in: 4h bars line up with the 6pm Eastern open (22:00 UTC, near enough in winter), daily bars are
// dated by session and drawn at midnight UTC
const bucket = (ts: number, sec: number) =>
  sec === DAY * 60 ? Date.parse(etDay.format(new Date((ts + 6 * 3600) * 1000))) / 1000
  : sec === 14400 ? Math.floor((ts - 79200) / sec) * sec + 79200
  : Math.floor(ts / sec) * sec;
const month = (iso: string, by: number) => { const d = new Date(iso); d.setUTCDate(15); d.setUTCMonth(d.getUTCMonth() + by); return d.toISOString().slice(0, 7); };
const etDate = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
const cache = new Map<string, Promise<DayFile | null>>();
function day(root: string, date: string) {
  const k = `${root}/${date}`;
  return load(k);
}
function load(k: string) {
  if (!cache.has(k)) cache.set(k, fetch(`/bars/${k}.json`).then(r => (r.ok ? r.json() : null)).catch(() => null));
  return cache.get(k)!;
}
// Charts draw times as UTC; shift them so the axis reads in this phone's own time
const local = (s: number) => (s - new Date(s * 1000).getTimezoneOffset() * 60) as UTCTimestamp;
const css = (v: string, a = 1) => `rgb(${getComputedStyle(document.documentElement).getPropertyValue(v).trim().replace(/ /g, ',')}${a < 1 ? `,${a}` : ''})`.replace('rgb(', a < 1 ? 'rgba(' : 'rgb(');

export default function TradeChart({ t }: { t: Trade }) {
  const box = useRef<HTMLDivElement>(null);
  const [frame, setFrame] = useState(1);
  const [state, setState] = useState<'loading' | 'none' | 'ok'>('loading');
  const [contract, setContract] = useState('');

  useEffect(() => {
    let chart: IChartApi | null = null;
    let gone = false;
    (async () => {
      const dates = [...new Set([etDate(t.entry_at), etDate(t.exit_at || t.entry_at)])];
      const files = (await Promise.all(dates.map(d => day(t.root, d)))).filter(Boolean) as DayFile[];
      const wide = frame >= 60;
      const hourly = wide ? ((await Promise.all([-1, 0, 1].map(n => load(`${t.root}/h/${month(t.entry_at, n)}`)))).filter(Boolean) as DayFile[]) : [];
      if (gone) return;
      // A frame with no data falls back to one that has some
      if (wide && !hourly.length) { if (files.length) setFrame(15); else setState('none'); return; }
      if (!wide && !files.length) { setFrame(60); return; }
      setContract(files[0]?.contract || '');
      // Bars of the chosen size
      const sec = frame * 60;
      const agg = new Map<number, Bar>();
      for (const [ts, o, h, l, c, v] of (wide ? hourly : files).flatMap(f => f.bars)) {
        const k = bucket(ts, sec);
        const b = agg.get(k);
        if (!b) agg.set(k, [k, o, h, l, c, v]);
        else { b[2] = Math.max(b[2], h); b[3] = Math.min(b[3], l); b[4] = c; b[5] += v; }
      }
      const bars = [...agg.values()].sort((a, b) => a[0] - b[0]);
      const daily = frame === DAY;
      const at = (s: number) => (daily ? s : local(s)) as UTCTimestamp;
      const tick0 = (files[0] || hourly[0]).tick;
      const { createChart, CrosshairMode, LineStyle } = await import('lightweight-charts');
      if (gone || !box.current) return;
      setState('ok');
      const win = css('--win'), loss = css('--loss'), edge = css('--edge');
      chart = createChart(box.current, {
        autoSize: true,
        layout: { background: { color: 'transparent' }, textColor: css('--mute'), fontSize: 11 },
        grid: { vertLines: { color: css('--line', 0.5) }, horzLines: { color: css('--line', 0.5) } },
        rightPriceScale: { borderColor: css('--line') },
        timeScale: { borderColor: css('--line'), timeVisible: !daily, secondsVisible: false, rightOffset: 12 },
        crosshair: { mode: CrosshairMode.Normal },
      });
      const s = chart.addCandlestickSeries({ upColor: win, downColor: loss, wickUpColor: win, wickDownColor: loss, borderVisible: false,
        priceFormat: { type: 'price', minMove: tick0 || 0.01, precision: Math.max(0, -Math.floor(Math.log10(tick0 || 0.01))) } });
      s.setData(bars.map(([ts, o, h, l, c]) => ({ time: at(ts), open: o, high: h, low: l, close: c })));
      // One marker per bar and side: "Buy 2 @ 15595"
      const marks = new Map<string, { time: number; buy: boolean; qty: number; px: number }>();
      for (const f of t.fills || []) {
        const ts = bucket(Math.floor(new Date(f.at).getTime() / 1000), sec), buy = f.qty > 0, k = `${ts}|${buy}`;
        const m = marks.get(k) || marks.set(k, { time: ts, buy, qty: 0, px: 0 }).get(k)!;
        m.px = (m.px * m.qty + f.price * Math.abs(f.qty)) / (m.qty + Math.abs(f.qty));
        m.qty += Math.abs(f.qty);
      }
      s.setMarkers([...marks.values()].sort((a, b) => a.time - b.time).map(m => ({
        time: at(m.time), position: m.buy ? 'belowBar' : 'aboveBar', color: m.buy ? win : loss, shape: m.buy ? 'arrowUp' : 'arrowDown',
        text: `${m.buy ? 'Buy' : 'Sell'} ${+m.qty.toFixed(4)} @ ${price(+m.px.toFixed(6))}`,
      }) as SeriesMarker<UTCTimestamp>));
      s.createPriceLine({ price: Number(t.entry_price), color: edge, lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: 'Entry' });
      if (t.exit_price !== null) s.createPriceLine({ price: Number(t.exit_price), color: Number(t.net_pnl) >= 0 ? win : loss, lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: 'Exit' });
      // Start zoomed on the trade, with some room either side
      const from = new Date(t.entry_at).getTime() / 1000, to = new Date(t.exit_at || t.entry_at).getTime() / 1000;
      const pad = Math.max((daily ? 20 : wide ? 24 : 30) * sec, (to - from) * 0.6);
      chart.timeScale().setVisibleRange({ from: at(bucket(from - pad, sec)), to: at(bucket(to + pad, sec)) });
    })();
    return () => { gone = true; chart?.remove(); };
  }, [t.id, t.root, t.entry_at, t.exit_at, frame]);

  if (state === 'none') return null;
  return (
    <div>
      <div className="flex items-center gap-2 mb-1.5">
        <div className="label !mb-0">Chart</div>
        {contract && <span className="text-[11px] text-mute">{contract} · your time</span>}
        <div className="ml-auto flex gap-1">
          {FRAMES.map(([f, l]) => (
            <button key={f} onClick={() => setFrame(f)} className={`chip !px-2 ${frame === f ? 'border-edge bg-edge/15 text-edge' : 'border-line text-mute'}`}>{l}</button>
          ))}
        </div>
      </div>
      <div ref={box} className="card h-72 md:h-80 overflow-hidden">{state === 'loading' && <div className="h-full grid place-items-center text-xs text-mute">Loading chart…</div>}</div>
    </div>
  );
}
