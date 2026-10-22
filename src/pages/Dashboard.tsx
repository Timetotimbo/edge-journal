import { useMemo } from 'react';
import { Area, AreaChart, Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Trade } from '../lib/types';
import { tickDollars } from '../lib/instruments';
import { byKey, dayOf, equityCurve, money, pct, pnlClass, summarize, timed, type Group } from '../lib/stats';
import Calendar from '../components/Calendar';
import TradeRow from '../components/TradeRow';
import AccountRange from '../components/AccountRange';
import KindCompare from '../components/KindCompare';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const mins = (m: number | null) => (m === null ? '–' : m < 1 ? `${Math.round(m * 60)}s` : m < 60 ? `${m < 10 ? m.toFixed(1) : Math.round(m)}m` : `${(m / 60).toFixed(1)}h`);
const size = (n: number) => (n ? (+n.toFixed(1)).toString() : '–');
const pf = (n: number) => (n === Infinity ? '∞' : n.toFixed(2));
// Whole dollars, so the tables fit a phone
const usd = (n: number) => `${n > 0 ? '+' : n < 0 ? '-' : ''}$${Math.round(Math.abs(n)).toLocaleString('en-US')}`;
// Buckets that sort in order: [label, test]
const HOLDS: [string, (m: number) => boolean][] = [['Under 1 min', m => m < 1], ['1–5 min', m => m < 5], ['5–15 min', m => m < 15], ['15–60 min', m => m < 60], ['1–4 hours', m => m < 240], ['4+ hours', () => true]];
// Size by dollars per tick, so NQ and MNQ compare fairly (1 NQ = $5 a tick = 10 MNQ)
const SIZES: [string, (d: number) => boolean][] = [['Up to $2.50 (≤5 MNQ)', d => d <= 2.5 + 1e-9], ['$3–5 (1 NQ / 10 MNQ)', d => d <= 5 + 1e-9], ['$5–10 (2 NQ)', d => d <= 10 + 1e-9],
  ['$10–25 (3–5 NQ)', d => d <= 25 + 1e-9], ['$25–50 (6–10 NQ)', d => d <= 50 + 1e-9], ['$50–100 (11–20 NQ)', d => d <= 100 + 1e-9], ['Over $100 (21+ NQ)', () => true]];
const tick$ = (n: number) => `$${n >= 100 ? Math.round(n) : +n.toFixed(2)}`;
const bucket = <T,>(list: [string, (x: T) => boolean][], x: T) => list.find(([, f]) => f(x))![0];
const clock = (d: Date) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).replace(':00', '').replace(' AM', 'a').replace(' PM', 'p');

/** A breakdown as a table: trades, win rate, average, profit factor and net; the best and worst rows are marked */
function Table({ title, note, groups, order }: { title: string; note?: string; groups: Group[]; order?: string[] }) {
  const rows = order ? order.map(k => groups.find(g => g.key === k)).filter(Boolean) as Group[] : groups;
  const real = rows.filter(g => g.count >= 5);
  const best = real.length > 1 ? real.reduce((a, b) => (b.net > a.net ? b : a)).key : '';
  const worst = real.length > 1 ? real.reduce((a, b) => (b.net < a.net ? b : a)).key : '';
  return (
    <section className="card p-4 min-w-0">
      <h3 className="font-semibold">{title}</h3>
      {note && <p className="text-xs text-mute mt-0.5">{note}</p>}
      {!rows.length ? <p className="text-sm text-mute mt-2">No trades in this range.</p> : (
        <div className="overflow-x-auto -mx-1 mt-2">
          <table className="w-full text-xs sm:text-sm num">
            <thead><tr className="text-[11px] text-mute text-right"><th className="text-left font-medium px-1 py-1"></th><th className="font-medium px-1">Trades</th><th className="font-medium px-1">Win</th><th className="font-medium px-1">Avg</th><th className="font-medium px-1">PF</th><th className="font-medium px-1">Net</th></tr></thead>
            <tbody>
              {rows.map(g => (
                <tr key={g.key} className={`border-t border-line text-right ${g.key === best ? 'bg-win/10' : g.key === worst ? 'bg-loss/10' : ''}`}>
                  <td className="text-left px-1 py-1.5 whitespace-nowrap font-medium">{g.key}{g.key === best ? ' ★' : ''}</td>
                  <td className="px-1">{g.count}</td><td className="px-1">{pct(g.winRate)}</td>
                  <td className={`px-1 ${pnlClass(g.avg)}`}>{usd(g.avg)}</td><td className="px-1">{pf(g.pf)}</td>
                  <td className={`px-1 font-semibold ${pnlClass(g.net)}`}>{usd(g.net)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Stat({ label, value, sub, cls = '', all }: { label: string; value: string; sub?: string; cls?: string; all?: string }) {
  return (
    <div className="card p-3">
      <div className="text-xs text-mute">{label}</div>
      <div className={`num text-xl font-bold mt-0.5 ${cls}`}>{value}</div>
      {sub && <div className="text-xs text-mute mt-0.5">{sub}</div>}
      {all !== undefined && <div className="text-xs mt-1 pt-1 border-t border-line text-mute">All accounts: <span className="num font-semibold text-ink">{all}</span></div>}
    </div>
  );
}

function Breakdown({ title, groups, empty }: { title: string; groups: Group[]; empty: string }) {
  const max = Math.max(1, ...groups.map(g => Math.abs(g.net)));
  return (
    <section className="card p-4 min-w-0">
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
    <section className="card p-4 min-w-0">
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

export default function Dashboard({ trades, everyKind, perAccount, everyAccount, accountSizes, onSize, all, onDay, onTrade, onImport }: { trades: Trade[]; everyKind: Trade[]; perAccount: Trade[]; everyAccount: Trade[] | null; accountSizes: Record<string, number>; onSize: (account: string, size: number | null) => void; all: Trade[]; onDay: (d: string) => void; onTrade: (id: string) => void; onImport: () => void }) {
  const s = useMemo(() => summarize(trades), [trades]);
  const a = useMemo(() => (everyAccount ? summarize(everyAccount) : null), [everyAccount]);
  // With one account picked, each card also shows the same number across all accounts
  const x = (f: (v: typeof s) => string) => (a ? f(a) : undefined);
  const curve = useMemo(() => equityCurve(trades), [trades]);
  const weekday = useMemo(() => {
    const g = Object.fromEntries(byKey(trades, t => String(new Date(t.entry_at).getDay())).map(x => [x.key, x.net]));
    return [1, 2, 3, 4, 5].map(d => ({ name: DAYS[d], net: g[d] || 0 }));
  }, [trades]);
  const hours = useMemo(() => byKey(trades.filter(t => new Date(t.entry_at).getHours() + new Date(t.entry_at).getMinutes() > 0), t => String(new Date(t.entry_at).getHours()))
    .sort((a, b) => +a.key - +b.key).map(g => ({ name: `${((+g.key + 11) % 12) + 1}${+g.key < 12 ? 'a' : 'p'}`, net: g.net })), [trades]);
  const sorted = (gs: Group[]) => gs.sort((a, b) => b.net - a.net);
  // Time of day in half hours, in this phone's time
  const halfHours = useMemo(() => {
    const gs = byKey(trades.filter(timed), t => { const d = new Date(t.entry_at); return String(d.getHours() * 60 + (d.getMinutes() < 30 ? 0 : 30)); });
    return gs.sort((a, b) => +a.key - +b.key).map(g => { const d = new Date(2000, 0, 1, 0, +g.key); const e = new Date(d.getTime() + 30 * 60000); return { ...g, key: `${clock(d)}–${clock(e)}` }; });
  }, [trades]);
  const holds = useMemo(() => byKey(trades.filter(timed), t => bucket(HOLDS, (new Date(t.exit_at!).getTime() - new Date(t.entry_at).getTime()) / 60000)), [trades]);
  const sizes = useMemo(() => byKey(trades, t => bucket(SIZES, tickDollars(t))), [trades]);
  // Days by how many trades were taken: does trading more help or hurt?
  const busy = useMemo(() => {
    const perDay = new Map<string, number>();
    for (const t of trades) { const d = dayOf(t.entry_at); perDay.set(d, (perDay.get(d) || 0) + 1); }
    const label = (n: number) => (n <= 3 ? '1–3 trades' : n <= 10 ? '4–10 trades' : n <= 20 ? '11–20 trades' : '21+ trades');
    return byKey(trades, t => label(perDay.get(dayOf(t.entry_at))!));
  }, [trades]);

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
        <Stat all={x(v => money(v.net, true))} label="Net P&L" value={money(s.net, true)} cls={pnlClass(s.net)} sub={`${s.count} trades · fees ${money(s.fees)}`} />
        <Stat all={x(v => pct(v.winRate))} label="Win rate" value={pct(s.winRate)} sub={`${s.wins} W · ${s.losses} L · days ${s.winDays}/${s.winDays + s.lossDays}`} />
        <Stat all={x(v => pf(v.profitFactor))} label="Profit factor" value={s.profitFactor === Infinity ? '∞' : s.profitFactor.toFixed(2)} sub={`Avg trade ${money(s.expectancy, true)}`} />
        <Stat all={x(v => `${money(v.avgWin)} / ${money(v.avgLoss)}`)} label="Avg win / loss" value={s.avgLoss ? (s.avgWin / Math.abs(s.avgLoss)).toFixed(2) : '–'} sub={`${money(s.avgWin)} / ${money(s.avgLoss)}`} />
        <Stat all={x(v => money(v.best, true))} label="Best trade" value={money(s.best, true)} cls="text-win" />
        <Stat all={x(v => money(v.worst, true))} label="Worst trade" value={money(s.worst, true)} cls="text-loss" />
        <Stat all={x(v => `${money(v.high, true)} / ${money(v.low, true)}`)} label="Highest / lowest P&L" value={money(s.high, true)} cls="text-win" sub={`Lowest ${money(s.low, true)} · running total`} />
        <Stat all={x(v => money(v.maxDrawdown))} label="Max drawdown" value={money(s.maxDrawdown)} cls={s.maxDrawdown < 0 ? 'text-loss' : ''} />
        <Stat all={x(v => `${mins(v.avgHoldWin)} W · ${mins(v.avgHoldLoss)} L`)} label="Avg hold" value={mins(s.avgHoldMin)} sub={`Winners ${mins(s.avgHoldWin)} · losers ${mins(s.avgHoldLoss)}`} />
        <Stat all={x(v => `${tick$(v.avgTickWin)} W · ${tick$(v.avgTickLoss)} L`)} label="Avg size ($ per tick)" value={`${tick$(s.avgTick)}/tick`} sub={`Winners ${tick$(s.avgTickWin)} · losers ${tick$(s.avgTickLoss)}`} />
        <Stat all={x(v => v.sizeByRoot.slice(0, 2).map(r => `${r.root} ${size(r.avg)}`).join(' · ') || '–')} label="Avg contracts" value={s.sizeByRoot.slice(0, 2).map(r => `${r.root} ${size(r.avg)}`).join(' · ') || '–'}
          sub={s.sizeByRoot.slice(0, 2).map(r => `${r.root} W ${size(r.win)} / L ${size(r.loss)}`).join(' · ')} />
        <Stat all={x(v => `${v.winStreak} W · ${v.lossStreak} L`)} label="Streaks" value={`${s.winStreak} W · ${s.lossStreak} L`} sub="Longest in a row" />
        <Stat all={x(v => `${money(v.avgDay, true)} · ${v.winDays + v.lossDays + v.flatDays} days`)} label="Avg day" value={money(s.avgDay, true)} cls={pnlClass(s.avgDay)} sub={`${s.winDays + s.lossDays + s.flatDays} days traded · ${s.tradesPerDay.toFixed(1)} trades a day`} />
        <Stat all={x(v => money(v.expectancy, true))} label="Expectancy" value={money(s.expectancy, true)} cls={pnlClass(s.expectancy)} sub="Per trade" />
      </div>

      <KindCompare trades={everyKind} />

      <AccountRange trades={perAccount} sizes={accountSizes} onSize={onSize} />

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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Bars title="By day of week" data={weekday} />
        <Bars title="By hour entered" data={hours} />
      </div>

      <Table title="Best time of day" note="When you entered, by half hour, in your time. ★ marks the best stretch (5+ trades)." groups={halfHours} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Table title="By hold time" note="How long you stayed in." groups={holds} order={HOLDS.map(h => h[0])} />
        <Table title="By size ($ per tick)" note="What one tick was worth on the whole position: 1 NQ = $5, 1 MNQ = $0.50, 1 ES = $12.50." groups={sizes} order={SIZES.map(x => x[0])} />
        <section className="card p-4 min-w-0">
          <h3 className="font-semibold">Contracts by instrument</h3>
          <p className="text-xs text-mute mt-0.5">Average contracts per trade, on winners and losers, and the most at once.</p>
          <div className="overflow-x-auto -mx-1 mt-2">
            <table className="w-full text-xs sm:text-sm num">
              <thead><tr className="text-[11px] text-mute text-right"><th className="text-left font-medium px-1 py-1"></th><th className="font-medium px-1">Trades</th><th className="font-medium px-1">Avg</th><th className="font-medium px-1">Winners</th><th className="font-medium px-1">Losers</th><th className="font-medium px-1">Most</th></tr></thead>
              <tbody>{s.sizeByRoot.map(r => (
                <tr key={r.root} className="border-t border-line text-right">
                  <td className="text-left px-1 py-1.5 font-medium">{r.root}</td><td className="px-1">{r.count}</td><td className="px-1 font-semibold">{size(r.avg)}</td>
                  <td className="px-1 text-win">{size(r.win)}</td><td className={`px-1 ${r.loss > r.win * 1.15 ? 'text-loss font-semibold' : 'text-loss'}`}>{size(r.loss)}</td><td className="px-1">{size(r.max)}</td>
                </tr>))}</tbody>
            </table>
          </div>
        </section>
        <Table title="Long vs short" groups={byKey(trades, t => (t.side === 'long' ? 'Long' : 'Short'))} order={['Long', 'Short']} />
        <Table title="By trades that day" note="Does trading more help or hurt?" groups={busy} order={['1–3 trades', '4–10 trades', '11–20 trades', '21+ trades']} />
        <Breakdown title="By instrument" groups={sorted(byKey(trades, t => t.root))} empty="No trades in this range." />
        <Breakdown title="By account" groups={sorted(byKey(trades, t => t.account || t.broker)).slice(0, 15)} empty="No trades in this range." />
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
