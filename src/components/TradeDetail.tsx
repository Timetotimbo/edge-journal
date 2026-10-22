import { useEffect, useMemo, useState } from 'react';
import { ImagePlus, Star, Trash2, X } from 'lucide-react';
import type { Trade } from '../lib/types';
import type { Journal } from '../lib/store';
import { supabase } from '../lib/supabase';
import { money, pnlClass } from '../lib/stats';
import { price, when } from './TradeRow';
import TradeChart from './TradeChart';

// From the Trader's Mind Map: what was driving the trade
export const EMOTIONS = ['Calm', 'Confident', 'Focused', 'Patient', 'FOMO', 'Fear', 'Greed', 'Revenge', 'Impatient', 'Frustrated', 'Bored', 'Overconfident'];
const MISTAKES = ['Chased entry', 'No stop', 'Moved stop', 'Oversized', 'Exited early', 'Held too long', 'Against the trend', 'Overtraded', 'Broke my rules', 'Traded the news'];
const TAGS = ['A+ setup', 'Trend', 'Reversal', 'Breakout', 'Pullback', 'Opening range', 'News', 'Scalp'];

function Chips({ options, value, onChange, tone = 'edge' }: { options: string[]; value: string[]; onChange: (v: string[]) => void; tone?: 'edge' | 'loss' }) {
  const [adding, setAdding] = useState('');
  const all = [...new Set([...options, ...value])];
  const on = tone === 'loss' ? 'border-loss bg-loss/15 text-loss' : 'border-edge bg-edge/15 text-edge';
  return (
    <div className="flex flex-wrap gap-1.5">
      {all.map(o => (
        <button key={o} onClick={() => onChange(value.includes(o) ? value.filter(x => x !== o) : [...value, o])} className={`chip ${value.includes(o) ? on : 'border-line text-mute'}`}>{o}</button>
      ))}
      <form onSubmit={e => { e.preventDefault(); const v = adding.trim(); if (v && !value.includes(v)) onChange([...value, v]); setAdding(''); }}>
        <input value={adding} onChange={e => setAdding(e.target.value)} placeholder="+ add" className="chip border-dashed border-line bg-transparent w-20 outline-none focus:border-edge" />
      </form>
    </div>
  );
}

export default function TradeDetail({ trade: t, j, onClose }: { trade: Trade; j: Journal; onClose: () => void }) {
  const [notes, setNotes] = useState(t.notes || '');
  const [setup, setSetup] = useState(t.setup || '');
  const [err, setErr] = useState('');
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  useEffect(() => { setNotes(t.notes || ''); setSetup(t.setup || ''); }, [t.id]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    addEventListener('keydown', h);
    document.body.style.overflow = 'hidden';
    return () => { removeEventListener('keydown', h); document.body.style.overflow = ''; };
  }, [onClose]);
  // Screenshots are private: short-lived links to show them
  useEffect(() => {
    if (!t.shots.length) return;
    supabase.storage.from('tj-shots').createSignedUrls(t.shots, 3600).then(({ data }) =>
      setUrls(Object.fromEntries((data || []).filter(d => d.path && d.signedUrl).map(d => [d.path as string, d.signedUrl as string]))));
  }, [t.shots]);

  const save = (patch: Partial<Trade>) => j.saveTrade(t.id, patch).catch(e => setErr(e.message));
  const setups = useMemo(() => [...new Set((j.trades || []).map(x => x.setup).filter(Boolean) as string[])], [j.trades]);
  const used = (k: 'tags' | 'mistakes') => [...new Set((j.trades || []).flatMap(x => x[k]))];

  const upload = async (files: FileList | File[]) => {
    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const added: string[] = [];
      for (const f of Array.from(files).filter(f => f.type.startsWith('image/'))) {
        const path = `${user!.id}/${t.id}-${Date.now()}-${added.length}.${(f.type.split('/')[1] || 'png').replace('jpeg', 'jpg')}`;
        const { error } = await supabase.storage.from('tj-shots').upload(path, f, { contentType: f.type });
        if (error) throw error;
        added.push(path);
      }
      if (added.length) await save({ shots: [...t.shots, ...added] });
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
    }
  };
  const removeShot = async (p: string) => {
    await supabase.storage.from('tj-shots').remove([p]);
    await save({ shots: t.shots.filter(x => x !== p) });
  };
  const hold = t.exit_at ? (new Date(t.exit_at).getTime() - new Date(t.entry_at).getTime()) / 60000 : null;
  const pts = t.exit_price === null ? null : (Number(t.exit_price) - Number(t.entry_price)) * (t.side === 'long' ? 1 : -1);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end md:items-center justify-center" onClick={onClose}
      onPaste={e => { const fs = Array.from(e.clipboardData.files); if (fs.length) void upload(fs); }}>
      <div className="bg-bg border border-line w-full md:max-w-2xl max-h-[92vh] overflow-y-auto rounded-t-2xl md:rounded-2xl" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-bg/95 backdrop-blur border-b border-line px-4 py-3 flex items-center gap-3">
          <span className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${t.side === 'long' ? 'bg-win/15 text-win' : 'bg-loss/15 text-loss'}`}>{t.side.toUpperCase()}</span>
          <div className="min-w-0">
            <div className="font-bold truncate">{t.symbol} ×{Number(t.qty)}</div>
            <div className="text-xs text-mute">{when(t.entry_at)} · {t.account || t.broker}</div>
          </div>
          <span className={`ml-auto num text-lg font-extrabold ${pnlClass(t.net_pnl)}`}>{money(Number(t.net_pnl), true)}</span>
          <button onClick={onClose} className="text-mute hover:text-ink" aria-label="Close"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-4 space-y-5">
          {err && <p className="text-sm text-loss">{err}</p>}
          <div className="grid grid-cols-3 gap-2 text-sm">
            {[
              ['Entry', price(t.entry_price)], ['Exit', price(t.exit_price)], [t.asset === 'future' ? 'Points' : 'Per share', pts === null ? '–' : `${pts >= 0 ? '+' : ''}${price(pts)}`],
              ['Gross', money(Number(t.gross_pnl), true)], ['Fees', money(Number(t.fees))], ['Hold', hold === null || hold === 0 ? '–' : hold < 60 ? `${Math.round(hold)}m` : `${(hold / 60).toFixed(1)}h`],
              ...(t.mae !== null || t.mfe !== null ? [['MAE', t.mae === null ? '–' : money(-Math.abs(Number(t.mae)))], ['MFE', t.mfe === null ? '–' : money(Math.abs(Number(t.mfe)))], ['Captured', t.mfe && Number(t.gross_pnl) > 0 ? `${Math.round((Number(t.gross_pnl) / Math.abs(Number(t.mfe))) * 100)}%` : '–']] : []),
            ].map(([k, v]) => (
              <div key={k} className="card px-3 py-2"><div className="text-[11px] text-mute">{k}</div><div className="num font-semibold">{v}</div></div>
            ))}
          </div>

          <TradeChart t={t} />

          <div>
            <label className="label" htmlFor="setup">Setup</label>
            <input id="setup" list="setups" className="field" value={setup} placeholder="e.g. Opening range breakout" onChange={e => setSetup(e.target.value)} onBlur={() => setup !== (t.setup || '') && void save({ setup: setup.trim() || null })} />
            <datalist id="setups">{setups.map(s => <option key={s} value={s} />)}</datalist>
          </div>

          <div>
            <div className="label">How I felt</div>
            <div className="flex flex-wrap gap-1.5">
              {EMOTIONS.map(e => (
                <button key={e} onClick={() => void save({ emotion: t.emotion === e ? null : e })} className={`chip ${t.emotion === e ? 'border-edge bg-edge/15 text-edge' : 'border-line text-mute'}`}>{e}</button>
              ))}
            </div>
          </div>

          <div>
            <div className="label">Followed my plan? (rate the execution)</div>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map(n => (
                <button key={n} onClick={() => void save({ rating: t.rating === n ? null : n })} aria-label={`${n} stars`}>
                  <Star className={`w-6 h-6 ${t.rating && n <= t.rating ? 'fill-edge text-edge' : 'text-line'}`} />
                </button>
              ))}
            </div>
          </div>

          <div><div className="label">Tags</div><Chips options={[...TAGS, ...used('tags')]} value={t.tags} onChange={v => void save({ tags: v })} /></div>
          <div><div className="label">Mistakes</div><Chips options={[...MISTAKES, ...used('mistakes')]} value={t.mistakes} onChange={v => void save({ mistakes: v })} tone="loss" /></div>

          <div>
            <label className="label" htmlFor="notes">Notes</label>
            <textarea id="notes" rows={4} className="field !h-auto py-2" value={notes} placeholder="Why I took it, what I saw, what I'd do differently…" onChange={e => setNotes(e.target.value)} onBlur={() => notes !== (t.notes || '') && void save({ notes: notes || null })} />
          </div>

          <div>
            <div className="label">Chart screenshots <span className="font-normal">(or paste one here)</span></div>
            <div className="grid grid-cols-2 gap-2">
              {t.shots.map(p => (
                <div key={p} className="relative group">
                  {urls[p] ? <a href={urls[p]} target="_blank" rel="noreferrer"><img src={urls[p]} alt="Chart" className="rounded-lg border border-line w-full aspect-video object-cover" /></a> : <div className="rounded-lg border border-line aspect-video" />}
                  <button onClick={() => void removeShot(p)} className="absolute top-1 right-1 rounded-md bg-black/70 p-1 text-white" aria-label="Remove screenshot"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              ))}
              <label className="rounded-lg border border-dashed border-line aspect-video grid place-items-center text-mute text-xs cursor-pointer hover:border-edge">
                <span className="flex flex-col items-center gap-1"><ImagePlus className="w-5 h-5" />{uploading ? 'Uploading…' : 'Add screenshot'}</span>
                <input type="file" accept="image/*" multiple className="hidden" onChange={e => e.target.files && void upload(e.target.files)} />
              </label>
            </div>
          </div>

          {t.fills && t.fills.length > 0 && (
            <details className="text-sm">
              <summary className="cursor-pointer text-mute">Executions ({t.fills.length})</summary>
              <table className="w-full mt-2 num text-xs">
                <tbody>
                  {t.fills.map((f, i) => (
                    <tr key={i} className="border-t border-line">
                      <td className="py-1">{when(f.at)}</td>
                      <td className={f.qty > 0 ? 'text-win' : 'text-loss'}>{f.qty > 0 ? 'Buy' : 'Sell'} {Math.abs(f.qty)}</td>
                      <td className="text-right">{price(f.price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          )}

          <button className="btn text-loss hover:bg-loss/10" onClick={() => { if (confirm('Delete this trade?')) void j.deleteTrades([t.id]).then(onClose); }}><Trash2 className="w-4 h-4" />Delete trade</button>
        </div>
      </div>
    </div>
  );
}
