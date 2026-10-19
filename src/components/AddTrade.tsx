import { useState } from 'react';
import { X } from 'lucide-react';
import type { Asset } from '../lib/types';
import type { Journal } from '../lib/store';
import { futuresMult, futuresRoot } from '../lib/instruments';

const local = (d = new Date()) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

/** A trade typed in by hand. */
export default function AddTrade({ j, onClose }: { j: Journal; onClose: () => void }) {
  const [f, setF] = useState({ asset: 'future' as Asset, symbol: '', side: 'long', qty: '1', entry: '', exit: '', entryAt: local(), exitAt: local(), fees: '0', type: 'call', strike: '', expiry: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const root = f.asset === 'future' ? futuresRoot(f.symbol) : f.symbol.trim().toUpperCase();
  const mult = f.asset === 'future' ? futuresMult(root) : f.asset === 'option' ? 100 : 1;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mult) { setErr(`${root} isn’t a futures contract this journal knows. Pick Stock, or tell Claude to add it.`); return; }
    const qty = +f.qty, entry = +f.entry, exit = f.exit === '' ? null : +f.exit, fees = +f.fees || 0;
    const dir = f.side === 'long' ? 1 : -1;
    const gross = exit === null ? 0 : (exit - entry) * qty * mult * dir;
    const symbol = f.asset === 'option' ? `${root} ${f.strike}${f.type === 'call' ? 'C' : 'P'} ${f.expiry.slice(5, 7)}/${f.expiry.slice(8, 10)}/${f.expiry.slice(2, 4)}` : root;
    setBusy(true);
    try {
      await j.addTrades([{
        broker: 'manual', account: 'Manual', symbol, root, asset: f.asset,
        option_type: f.asset === 'option' ? (f.type as 'call' | 'put') : null, strike: f.asset === 'option' ? +f.strike : null, expiry: f.asset === 'option' ? f.expiry : null,
        side: f.side as 'long' | 'short', qty, entry_price: entry, exit_price: exit,
        entry_at: new Date(f.entryAt).toISOString(), exit_at: exit === null ? null : new Date(f.exitAt).toISOString(), multiplier: mult,
        gross_pnl: Math.round(gross * 100) / 100, fees, net_pnl: Math.round((gross - fees) * 100) / 100, mae: null, mfe: null, fills: null,
        setup: null, tags: [], mistakes: [], emotion: null, rating: null, notes: null, shots: [], import_key: `manual|${crypto.randomUUID()}`,
      }]);
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end md:items-center justify-center" onClick={onClose}>
      <form onSubmit={submit} onClick={e => e.stopPropagation()} className="bg-bg border border-line w-full md:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-2xl md:rounded-2xl p-4 space-y-3">
        <div className="flex items-center"><h2 className="font-bold text-lg">Add a trade</h2><button type="button" onClick={onClose} className="ml-auto text-mute" aria-label="Close"><X className="w-5 h-5" /></button></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Type</label><select className="field" value={f.asset} onChange={set('asset')}><option value="future">Futures</option><option value="option">Option</option><option value="stock">Stock</option></select></div>
          <div><label className="label">{f.asset === 'option' ? 'Underlying' : 'Symbol'}</label><input className="field uppercase" required value={f.symbol} onChange={set('symbol')} placeholder={f.asset === 'future' ? 'NQ, MES…' : 'SPY'} /></div>
          {f.asset === 'option' && <>
            <div><label className="label">Call / put</label><select className="field" value={f.type} onChange={set('type')}><option value="call">Call</option><option value="put">Put</option></select></div>
            <div><label className="label">Strike</label><input className="field" required inputMode="decimal" value={f.strike} onChange={set('strike')} /></div>
            <div className="col-span-2"><label className="label">Expiration</label><input className="field" type="date" required value={f.expiry} onChange={set('expiry')} /></div>
          </>}
          <div><label className="label">Side</label><select className="field" value={f.side} onChange={set('side')}><option value="long">Long (bought first)</option><option value="short">Short (sold first)</option></select></div>
          <div><label className="label">{f.asset === 'stock' ? 'Shares' : 'Contracts'}</label><input className="field" required inputMode="decimal" value={f.qty} onChange={set('qty')} /></div>
          <div><label className="label">Entry price</label><input className="field" required inputMode="decimal" value={f.entry} onChange={set('entry')} /></div>
          <div><label className="label">Exit price</label><input className="field" inputMode="decimal" value={f.exit} onChange={set('exit')} /></div>
          <div><label className="label">Entered</label><input className="field" type="datetime-local" required value={f.entryAt} onChange={set('entryAt')} /></div>
          <div><label className="label">Exited</label><input className="field" type="datetime-local" value={f.exitAt} onChange={set('exitAt')} /></div>
          <div><label className="label">Fees ($)</label><input className="field" inputMode="decimal" value={f.fees} onChange={set('fees')} /></div>
          <div className="text-xs text-mute self-end pb-2">{mult ? `$${mult} per point${f.asset === 'option' ? ' (100 shares)' : ''}` : f.symbol ? 'Unknown contract' : ''}</div>
        </div>
        {err && <p className="text-sm text-loss">{err}</p>}
        <button className="btn-edge w-full h-10" disabled={busy}>{busy ? 'Saving…' : 'Save trade'}</button>
      </form>
    </div>
  );
}
