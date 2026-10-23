import { useEffect, useMemo, useState } from 'react';
import { Target } from 'lucide-react';
import type { Trade } from '../lib/types';
import { money, pct, pnlClass } from '../lib/stats';
import { byYear, coach, review, verdict, type DayTypes, type Review } from '../lib/review';

const ratio = (n: number) => (Number.isFinite(n) ? n.toFixed(2) : '∞');
const mins = (n: number) => (n >= 60 ? `${(n / 60).toFixed(1)}h` : n >= 1 ? `${n.toFixed(1)}m` : `${Math.round(n * 60)}s`);

// Rows of the year-by-year table: label, value, and which way is better (1 higher, -1 lower, 0 neither)
const ROWS: [string, (r: Review) => string, (r: Review) => number, number][] = [
  ['Trades', r => String(r.trades), r => r.trades, 0],
  ['Net P&L', r => money(r.net, true), r => r.net, 1],
  ['Win rate', r => pct(r.winRate), r => r.winRate, 1],
  ['Avg win (pts)', r => r.avgWinPts.toFixed(1), r => r.avgWinPts, 1],
  ['Avg loss (pts)', r => r.avgLossPts.toFixed(1), r => r.avgLossPts, 1],
  ['Payoff (win ÷ loss)', r => ratio(r.payoff), r => r.payoff, 1],
  ['Win rate needed', r => pct(r.breakevenWinRate), r => r.breakevenWinRate, -1],
  ['Profit factor', r => ratio(r.profitFactor), r => r.profitFactor, 1],
  ['Expectancy / trade', r => money(r.expectancy, true), r => r.expectancy, 1],
  ['Sharpe (daily)', r => (r.days >= 10 ? r.sharpe.toFixed(2) : '–'), r => (r.days >= 10 ? r.sharpe : NaN), 1],
  ['Sortino', r => (r.days >= 10 ? r.sortino.toFixed(2) : '–'), r => (r.days >= 10 ? r.sortino : NaN), 1],
  ['Max drawdown', r => money(r.maxDrawdown), r => r.maxDrawdown, 1],
  ['Green days', r => pct(r.greenDays), r => r.greenDays, 1],
  ['Worst day', r => money(r.worstDay), r => r.worstDay, 1],
  ['Trades / day', r => r.tradesPerDay.toFixed(1), r => r.tradesPerDay, 0],
  ['Hold: winners / losers', r => `${mins(r.holdWin)} / ${mins(r.holdLoss)}`, r => (r.holdWin ? r.holdLoss / r.holdWin : 0), -1],
];

const MONEY = new Set(['Net P&L', 'Expectancy / trade', 'Max drawdown', 'Worst day']);

function Tile({ label, value, note, cls = '' }: { label: string; value: string; note: string; cls?: string }) {
  return (
    <div className="card p-3">
      <div className="text-xs text-mute">{label}</div>
      <div className={`num text-lg font-bold ${cls}`}>{value}</div>
      <div className="text-[11px] text-mute leading-snug">{note}</div>
    </div>
  );
}

/** Year-by-year progress, a desk and fund style report on the chosen dates, and the coach's findings priced in dollars */
export default function Progress({ every, trades, scope }: { every: Trade[]; trades: Trade[]; scope: string }) {
  const [types, setTypes] = useState<DayTypes | null>(null);
  useEffect(() => { fetch('/bars/days.json').then(r => (r.ok ? r.json() : null)).then(setTypes).catch(() => setTypes(null)); }, []);
  const years = useMemo(() => byYear(every).map(([y, ts]) => [y, review(ts)] as [string, Review]), [every]);
  const r = useMemo(() => review(trades), [trades]);
  const findings = useMemo(() => coach(trades, types), [trades, types]);
  if (!every.length) return <p className="text-mute text-sm">No trades yet.</p>;

  return (
    <div className="space-y-4">
      <div className="card p-4 space-y-1">
        <div className="text-xs text-mute">Verdict · {scope}</div>
        <p className="font-semibold">{verdict(r)}</p>
        <p className="text-sm text-mute">
          {r.trades} trades · <span className={pnlClass(r.net)}>{money(r.net, true)}</span> · win rate {pct(r.winRate)} (you need {pct(r.breakevenWinRate)}) · profit factor {ratio(r.profitFactor)}
        </p>
      </div>

      <section className="space-y-2">
        <h2 className="font-bold">Year by year</h2>
        <p className="text-xs text-mute">Same filters as above, every year side by side. ▲ better than the year before, ▼ worse. Dollar amounts are red when negative. Sharpe needs 10+ trading days.</p>
        <div className="card overflow-x-auto">
          <table className="w-full text-sm num">
            <thead><tr className="text-mute text-xs"><th className="text-left font-medium p-2 sticky left-0 bg-card">Metric</th>{years.map(([y]) => <th key={y} className="text-right font-medium p-2">{y}</th>)}</tr></thead>
            <tbody className="divide-y divide-line">
              {ROWS.map(([label, show, val, dir]) => (
                <tr key={label}>
                  <td className="p-2 text-mute whitespace-nowrap sticky left-0 bg-card">{label}</td>
                  {years.map(([y, yr], i) => {
                    const prev = i ? val(years[i - 1][1]) : null, now = val(yr);
                    // Arrow: better (▲ green) or worse (▼ red) than the year before; money keeps its own colour (red when negative)
                    const trend = !dir || prev === null || !Number.isFinite(now) || !Number.isFinite(prev) || now === prev ? 0 : (now - prev) * dir > 0 ? 1 : -1;
                    return (
                      <td key={y} className={`p-2 text-right whitespace-nowrap ${MONEY.has(label) ? pnlClass(now) : ''}`}>
                        {show(yr)}{trend !== 0 && <span className={`ml-1 text-[10px] ${trend > 0 ? 'text-win' : 'text-loss'}`} aria-label={trend > 0 ? 'better' : 'worse'}>{trend > 0 ? '▲' : '▼'}</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="font-bold">Desk report</h2>
        <p className="text-xs text-mute">How a prop firm’s risk desk and a fund would read these trades ({scope}).</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <Tile label="Sharpe (annualised)" value={r.days >= 10 ? r.sharpe.toFixed(2) : '–'} cls={r.sharpe >= 1 ? 'text-win' : r.sharpe < 0 ? 'text-loss' : ''} note="Daily P&L ÷ its swings. Funds want 1+; 2+ is excellent." />
          <Tile label="Sortino" value={r.days >= 10 ? r.sortino.toFixed(2) : '–'} cls={r.sortino >= 1.5 ? 'text-win' : r.sortino < 0 ? 'text-loss' : ''} note="Like Sharpe, but only red days count as risk." />
          <Tile label="Profit factor" value={ratio(r.profitFactor)} cls={r.profitFactor >= 1.5 ? 'text-win' : r.profitFactor < 1 ? 'text-loss' : ''} note="Dollars won ÷ dollars lost. 1.5+ is a solid edge." />
          <Tile label="Payoff" value={ratio(r.payoff)} cls={r.payoff >= 1 ? 'text-win' : 'text-loss'} note={`Avg win ÷ avg loss. Below 1 you must win ${pct(r.breakevenWinRate)}+ of trades.`} />
          <Tile label="Max drawdown" value={money(r.maxDrawdown)} cls="text-loss" note={`Deepest fall from a high. Recovery factor ${r.recovery.toFixed(2)} (net ÷ drawdown; 3+ is healthy).`} />
          <Tile label="Worst 5% of days" value={money(r.worstDaysAvg)} cls="text-loss" note={`Average of your worst days, the number a prop firm’s daily loss limit cares about. Worst ${money(r.worstDay)}.`} />
          <Tile label="Consistency" value={r.net > 0 ? pct(r.consistency) : '–'} cls={r.net > 0 ? (r.consistency <= 0.4 ? 'text-win' : 'text-loss') : ''} note="Best day ÷ total profit. Prop firms often require 30–50% or less to pay out." />
          <Tile label="Tail losses" value={pct(r.tailLossShare)} cls={r.tailLossShare > 0.35 ? 'text-loss' : 'text-win'} note="Share of all losses from your worst 10% of losing trades. Pros keep this low with hard stops." />
          <Tile label="Expectancy" value={money(r.expectancy, true)} cls={pnlClass(r.expectancy)} note="What an average trade is worth after fees." />
          <Tile label="Kelly" value={pct(Math.max(0, r.kelly))} cls={r.kelly > 0 ? 'text-win' : 'text-loss'} note={r.kelly > 0 ? 'Edge-based risk per trade; pros risk a quarter of it or less.' : 'No edge yet: Kelly says risk nothing more until it’s positive.'} />
          <Tile label="Green days" value={pct(r.greenDays)} note={`${r.days} days traded · avg day ${money(r.avgDay, true)}.`} />
          <Tile label="Hold time" value={`${mins(r.holdWin)} / ${mins(r.holdLoss)}`} cls={r.holdLoss > r.holdWin * 1.5 ? 'text-loss' : ''} note="Median hold on winners / losers. Losers should be the shorter one." />
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="font-bold">Coach</h2>
        <p className="text-xs text-mute">What to fix first, ranked by what it cost you ({scope}). Each finding compares those trades with the rest of yours.</p>
        {findings.length ? findings.map(f => (
          <div key={f.id} className="card p-4 space-y-2">
            <div className="flex items-start gap-3">
              <h3 className="font-semibold flex-1">{f.title}</h3>
              {f.impact !== 0 && <span className={`num text-sm font-bold shrink-0 ${f.good ? 'text-win' : 'text-loss'}`}>{f.good ? '+' : ''}{money(f.impact)}</span>}
            </div>
            <p className="text-sm text-mute">{f.detail}</p>
            <p className="text-sm flex gap-2"><Target className="w-4 h-4 text-edge shrink-0 mt-0.5" /><span><span className="font-semibold">Rule: </span>{f.rule}</span></p>
          </div>
        )) : <p className="card p-4 text-sm text-mute">Need at least 20 trades in these dates for coaching.</p>}
      </section>
    </div>
  );
}
