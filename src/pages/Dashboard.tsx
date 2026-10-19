import { useMemo } from 'react';
import { Area, AreaChart, Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Trade } from '../lib/types';
import { byKey, equityCurve, money, pct, pnlClass, summarize, type Group } from '../lib/stats';
import Calendar from '../components/Calendar';
import TradeRow from '../components/TradeRow';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function Stat({ label, value, sub, cls = '' }: { label: string; value: string; sub?: string; cls?: string }) {
  return (
    <div className="card p-3">
      <div className="text-xs text-mute">{label}</div>
      <div className={`num text-xl font-bold mt-0.5 ${cls}`}>{value}</div>
      {sub && <div className="text-xs text-mute mt-0.5">{sub}</div>}
    </div>
  );
}

function Breakdown({ title, groups, empty }: { title: string; groups: Group[]; empty: string }) {
  const max = Math.max(1, ...groups.map(g => Math.abs(g.net)));
  return (
    <section className="card p-4">
      <h3 className="font-semibold mb-3">{title}</h3>
      {!groups.length ? <p className="text-sm text-mute">{empty}</p> : (
        <ul className="space-y-2">
          {groups.map(g => (
            <li key={g.key} className="text-sm">
              <div className="flex items-baseline gap-2">
                <span className="font-medium truncate">{g.key}</span>
                <span className="text-xs text-mute">{g.count} · {pct(g.winRate)} win</span>
                <span className={`ml-auto num font-semibold ${pnlClass(g.net)}`}>{money(g.net, true)}</span>
              </div>
              <div className="h-1.5 mt-1 rounded bg-line overflow-hidden">
                <div className={`h-full ${g.net >= 0 ? 'bg-win' : 'bg-loss'}`} style={{ width: `${(Math.abs(g.net) / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Bars({ title, data }: { title: string; data: { name: string; net: number }[] }) {
  return (
    <section className="card p-4">
      <h3 className="font-semibold mb-2">{title}</h3>
      <div className="h-44">
        <ResponsiveContainer>
          <BarChart data={data} margin={{ left: 0, right: 0, top: 4, bottom: 0 }}>
            <XAxis dataKey="name" tick={{ fill: 'rgb(var(--mute))', fontSize: 11 }} axisLine={false} tickLine={false} interval={0} />
            <YAxis hide />
            <Tooltip cursor={{ fill: 'rgb(var(--line))' }} contentStyle={{ background: 'rgb(var(--card))', border: '1px solid var(--line)', borderRadius: 8 }} formatter={(v: number) => money(v, true)} />
            <Bar dataKey="net" radius={[4, 4, 4, 4]}>
              {data.map((d, i) => <Cell key={i} fill={d.net >= 0 ? 'rgb(var(--win))' : 'rgb(var(--loss))'} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

export default function Dashboard({ trades, all, onDay, onTrade, onImport }: { trades: Trade[]; all: Trade[]; onDay: (d: string) => void; onTrade: (id: string) => void; onImport: () => void }) {
  const s = useMemo(() => summarize(trades), [trades]);
  const curve = useMemo(() => equityCurve(trades), [trades]);
  const weekday = useMemo(() => {
    const g = Object.fromEntries(byKey(trades, t => String(new Date(t.entry_at).getDay())).map(x => [x.key, x.net]));
    return [1, 2, 3, 4, 5].map(d => ({ name: DAYS[d], net: g[d] || 0 }));
  }, [trades]);
  const hours = useMemo(() => byKey(trades.filter(t => new Date(t.entry_at).getHours() + new Date(t.entry_at).getMinutes() > 0), t => String(new Date(t.entry_at).getHours()))
    .sort((a, b) => +a.key - +b.key).map(g => ({ name: `${((+g.key + 11) % 12) + 1}${+g.key < 12 ? 'a' : 'p'}`, net: g.net })), [trades]);
  const sorted = (gs: Group[]) => gs.sort((a, b) => b.net - a.net);

  if (!all.length) {
    return (
      <div className="card p-8 text-center space-y-3">
        <h2 className="text-xl font-bold">Your journal is empty</h2>
        <p className="text-mute text-sm">Import your trades from NinjaTrader 8, Tradovate, Robinhood or thinkorswim/Schwab, or add one by hand.</p>
        <button className="btn-edge" onClick={onImport}>Import trades</button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Net P&L" value={money(s.net, true)} cls={pnlClass(s.net)} sub={`${s.count} trades · fees ${money(s.fees)}`} />
        <Stat label="Win rate" value={pct(s.winRate)} sub={`${s.wins} W · ${s.losses} L · days ${s.winDays}/${s.winDays + s.lossDays}`} />
        <Stat label="Profit factor" value={s.profitFactor === Infinity ? '∞' : s.profitFactor.toFixed(2)} sub={`Avg trade ${money(s.expectancy, true)}`} />
        <Stat label="Avg win / loss" value={s.avgLoss ? (s.avgWin / Math.abs(s.avgLoss)).toFixed(2) : '–'} sub={`${money(s.avgWin)} / ${money(s.avgLoss)}`} />
        <Stat label="Best trade" value={money(s.best, true)} cls="text-win" />
        <Stat label="Worst trade" value={money(s.worst, true)} cls="text-loss" />
        <Stat label="Max drawdown" value={money(s.maxDrawdown)} cls={s.maxDrawdown < 0 ? 'text-loss' : ''} />
        <Stat label="Avg hold" value={s.avgHoldMin === null ? '–' : s.avgHoldMin < 60 ? `${Math.round(s.avgHoldMin)}m` : `${(s.avgHoldMin / 60).toFixed(1)}h`} />
      </div>

      <section className="card p-4">
        <h3 className="font-semibold mb-2">Equity curve</h3>
        <div className="h-56">
          <ResponsiveContainer>
            <AreaChart data={curve} margin={{ left: 0, right: 4, top: 4, bottom: 0 }}>
              <defs>
                <linearGradient id="eq" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgb(var(--edge))" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="rgb(var(--edge))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="day" tick={{ fill: 'rgb(var(--mute))', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={d => d.slice(5).replace('-', '/')} minTickGap={24} />
              <YAxis tick={{ fill: 'rgb(var(--mute))', fontSize: 11 }} axisLine={false} tickLine={false} width={56} tickFormatter={v => money(v).replace('.00', '')} />
              <Tooltip contentStyle={{ background: 'rgb(var(--card))', border: '1px solid var(--line)', borderRadius: 8 }} formatter={(v: number, n) => [money(v, true), n === 'total' ? 'Total' : 'Day']} />
              <Area type="monotone" dataKey="total" stroke="rgb(var(--edge))" strokeWidth={2} fill="url(#eq)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      <Calendar trades={all} onDay={onDay} />

      <div className="grid md:grid-cols-2 gap-4">
        <Bars title="By day of week" data={weekday} />
        <Bars title="By hour entered" data={hours} />
        <Breakdown title="By instrument" groups={sorted(byKey(trades, t => t.root))} empty="No trades in this range." />
        <Breakdown title="By setup" groups={sorted(byKey(trades, t => t.setup))} empty="Name a setup on your trades to compare them." />
        <Breakdown title="Mistakes (what they cost)" groups={byKey(trades, t => t.mistakes).sort((a, b) => a.net - b.net)} empty="Mark mistakes on trades to see what they cost you." />
        <Breakdown title="By emotion" groups={sorted(byKey(trades, t => t.emotion))} empty="Pick how you felt on each trade to see which emotions pay." />
      </div>

      <section className="card p-4">
        <h3 className="font-semibold mb-2">Recent trades</h3>
        <div className="divide-y divide-line">{trades.slice(0, 8).map(t => <TradeRow key={t.id} t={t} onOpen={onTrade} />)}</div>
      </section>
    </div>
  );
}
