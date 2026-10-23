import { useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { Trade } from '../lib/types';
import { money, pnlClass } from '../lib/stats';
import { sizeLabel } from '../lib/accounts';

type Subs = Record<string, { subscription: string; reset_at: string | null }>;
const short = (d: string) => new Date(`${d}T12:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });

/** Each prop subscription with its resets as one line: what the whole subscription made or lost across every reset */
export default function Subscriptions({ trades, subs, sizes }: { trades: Trade[]; subs: Subs; sizes: Record<string, number> }) {
  const [open, setOpen] = useState('');
  const groups = useMemo(() => {
    const by = new Map<string, string[]>();
    for (const [account, s] of Object.entries(subs)) by.set(s.subscription, [...(by.get(s.subscription) || []), account]);
    return [...by.entries()].map(([sub, accounts]) => {
      // Oldest first: reset accounts by reset date (then first trade, for resets on the same day), the current account last
      const first = (a: string) => trades.filter(t => t.account === a).reduce((m, t) => (t.entry_at < m ? t.entry_at : m), '9999');
      const order = accounts.sort((a, b) => (subs[a].reset_at || '9999').localeCompare(subs[b].reset_at || '9999') || first(a).localeCompare(first(b)));
      const rows = order.map(account => {
        const ts = trades.filter(t => t.account === account);
        return { account, reset: subs[account].reset_at, trades: ts.length, net: ts.reduce((s, t) => s + Number(t.net_pnl), 0) };
      });
      return { sub, size: sizes[sub] || 0, rows, resets: rows.filter(r => r.reset).length, trades: rows.reduce((s, r) => s + r.trades, 0), net: rows.reduce((s, r) => s + r.net, 0) };
    }).filter(g => g.trades).sort((a, b) => a.net - b.net);
  }, [trades, subs, sizes]);
  if (!groups.length) return null;
  const total = groups.reduce((s, g) => s + g.net, 0);

  return (
    <section className="card p-4 min-w-0">
      <h3 className="font-semibold">Subscriptions and resets</h3>
      <p className="text-xs text-mute mt-0.5">Each subscription with all its resets counted together. {groups.length} subscriptions · {groups.reduce((s, g) => s + g.resets, 0)} resets · <span className={pnlClass(total)}>{money(total, true)}</span>. Tap one to see its accounts.</p>
      <div className="mt-2 divide-y divide-line">
        {groups.map(g => (
          <div key={g.sub}>
            <button onClick={() => setOpen(open === g.sub ? '' : g.sub)} className="w-full flex items-center gap-3 py-2 text-left text-sm">
              <ChevronDown className={`w-4 h-4 text-mute shrink-0 transition ${open === g.sub ? '' : '-rotate-90'}`} />
              <span className="flex-1 min-w-0">
                <span className="block font-medium truncate">{g.size ? `${sizeLabel(g.size)} · ` : ''}{g.sub.replace(/^TAKEPROFITPRO/, 'PRO ')}</span>
                <span className="block text-[11px] text-mute">{g.rows.length} account{g.rows.length === 1 ? '' : 's'} · {g.resets} reset{g.resets === 1 ? '' : 's'} · {g.trades} trades</span>
              </span>
              <span className={`num font-bold ${pnlClass(g.net)}`}>{money(g.net, true)}</span>
            </button>
            {open === g.sub && (
              <table className="w-full text-xs num mb-2">
                <tbody>
                  {g.rows.map(r => (
                    <tr key={r.account} className="border-t border-line">
                      <td className="py-1 pl-7">{r.account.replace(/^TAKEPROFITPRO/, 'PRO ')}</td>
                      <td className="py-1 text-mute">{r.reset ? `reset ${short(r.reset)}` : 'current'}</td>
                      <td className="py-1 text-right text-mute">{r.trades} trades</td>
                      <td className={`py-1 text-right font-semibold ${pnlClass(r.net)}`}>{money(r.net, true)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
