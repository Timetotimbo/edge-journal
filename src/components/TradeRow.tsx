import type { Trade } from '../lib/types';
import { money, pnlClass } from '../lib/stats';

export const when = (iso: string) => new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).replace(', 12:00 AM', '');
export const price = (n: number | null) => (n === null ? '–' : Number(n).toLocaleString('en-US', { maximumFractionDigits: 4 }));

export default function TradeRow({ t, onOpen, selected, onSelect }: { t: Trade; onOpen: (id: string) => void; selected?: boolean; onSelect?: (on: boolean) => void }) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      {onSelect && <input type="checkbox" checked={!!selected} onChange={e => onSelect(e.target.checked)} className="accent-edge w-4 h-4 shrink-0" aria-label="Select trade" />}
      <button onClick={() => onOpen(t.id)} className="flex-1 min-w-0 flex items-center gap-3 text-left">
        <span className={`shrink-0 w-12 text-center rounded-md py-0.5 text-[11px] font-bold ${t.side === 'long' ? 'bg-win/15 text-win' : 'bg-loss/15 text-loss'}`}>{t.side === 'long' ? 'LONG' : 'SHORT'}</span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold truncate">{t.symbol} <span className="text-mute font-normal">×{Number(t.qty)}</span>{(t.copies || 1) > 1 && <span className="ml-1.5 rounded bg-line px-1.5 py-px text-[10px] font-semibold text-mute align-middle">copied ×{t.copies}</span>}</span>
          <span className="block text-xs text-mute truncate">{when(t.entry_at)} · {price(t.entry_price)} → {price(t.exit_price)}{t.setup ? ` · ${t.setup}` : ''}</span>
        </span>
        <span className={`num font-bold shrink-0 ${pnlClass(t.net_pnl)}`}>{money(Number(t.net_pnl), true)}</span>
      </button>
    </div>
  );
}
