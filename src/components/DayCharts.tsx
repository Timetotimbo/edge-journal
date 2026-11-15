import { useEffect, useState } from 'react';
import { ImagePlus, Pencil, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import Markup from './Markup';
import { dayOf } from '../lib/stats';

// Chart pictures kept with a trading day (levels before the open, how the day played out), with a tool to draw on them.
// They live in the private tj-shots bucket under <user>/day-<yyyy-mm-dd>/, so the folder itself is the list.
type Shot = { path: string; url: string };

export default function DayCharts({ day }: { day: string }) {
  const [shots, setShots] = useState<Shot[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  // The picture being drawn on: a new one just picked, or a saved one's link
  const [marking, setMarking] = useState<Blob | string | null>(null);

  const folder = async () => `${(await supabase.auth.getUser()).data.user!.id}/day-${day}`;
  const load = async () => {
    const dir = await folder();
    const { data, error } = await supabase.storage.from('tj-shots').list(dir, { sortBy: { column: 'name', order: 'asc' } });
    if (error) throw error;
    const paths = (data || []).filter(f => f.id).map(f => `${dir}/${f.name}`);
    if (!paths.length) return setShots([]);
    const { data: links } = await supabase.storage.from('tj-shots').createSignedUrls(paths, 3600);
    setShots((links || []).filter(l => l.path && l.signedUrl).map(l => ({ path: l.path as string, url: l.signedUrl as string })));
  };
  useEffect(() => { void load().catch(() => {}); }, [day]);
  // A picture shared from the phone's gallery (Share → Edge Journal) opens straight into Mark up on today
  useEffect(() => {
    if (day !== dayOf(new Date().toISOString()) || !new URLSearchParams(location.search).has('shared')) return;
    history.replaceState(null, '', location.pathname + location.hash);
    void (async () => {
      const cache = await caches.open('shared-chart');
      const hit = await cache.match('/shared-chart');
      if (!hit) return;
      await cache.delete('/shared-chart');
      setMarking(await hit.blob());
      setTimeout(() => document.getElementById(`day-${day}`)?.scrollIntoView({ block: 'start' }), 50);
    })().catch(() => {});
  }, [day]);

  const run = async (f: () => Promise<void>) => {
    setBusy(true); setErr('');
    try { await f(); await load(); } catch (e) { setErr(e instanceof Error ? e.message : String(e)); throw e; } finally { setBusy(false); }
  };
  const add = (pics: Blob[]) => run(async () => {
    const dir = await folder();
    for (const [i, f] of pics.filter(f => f.type.startsWith('image/')).entries()) {
      const { error } = await supabase.storage.from('tj-shots').upload(`${dir}/${Date.now()}-${i}.${(f.type.split('/')[1] || 'png').replace('jpeg', 'jpg')}`, f, { contentType: f.type });
      if (error) throw error;
    }
  });
  const remove = (path: string) => run(async () => { const { error } = await supabase.storage.from('tj-shots').remove([path]); if (error) throw error; });

  return (
    <div onPaste={e => { const fs = Array.from(e.clipboardData.files); if (fs.length) { e.preventDefault(); void add(fs).catch(() => {}); } }}>
      <div className="label">Charts <span className="font-normal">· add a screenshot and draw on it</span></div>
      {err && <p className="text-sm text-loss mb-1">{err}</p>}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {shots.map(s => (
          <div key={s.path} className="relative">
            <a href={s.url} target="_blank" rel="noreferrer"><img src={s.url} alt="Chart" loading="lazy" className="rounded-lg border border-line w-full aspect-video object-cover" /></a>
            <button onClick={() => setMarking(s.url)} className="absolute top-1 left-1 rounded-md bg-black/70 px-1.5 py-1 text-white text-[11px] flex items-center gap-1" aria-label="Mark up chart"><Pencil className="w-3.5 h-3.5" />Mark up</button>
            <button onClick={() => confirm('Delete this chart?') && void remove(s.path).catch(() => {})} className="absolute top-1 right-1 rounded-md bg-black/70 p-1 text-white" aria-label="Delete chart"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
        ))}
        <label className="rounded-lg border border-dashed border-line aspect-video grid place-items-center text-mute text-xs cursor-pointer hover:border-edge">
          <span className="flex flex-col items-center gap-1 text-center"><Pencil className="w-5 h-5" />{busy ? 'Saving…' : 'Mark up a chart'}</span>
          <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) setMarking(f); }} />
        </label>
        <label className="rounded-lg border border-dashed border-line aspect-video grid place-items-center text-mute text-xs cursor-pointer hover:border-edge">
          <span className="flex flex-col items-center gap-1 text-center"><ImagePlus className="w-5 h-5" />Add as is</span>
          <input type="file" accept="image/*" multiple className="hidden" onChange={e => { const fs = Array.from(e.target.files || []); e.target.value = ''; if (fs.length) void add(fs).catch(() => {}); }} />
        </label>
      </div>
      {marking && <Markup src={marking} onClose={() => setMarking(null)} onSave={b => add([b])} />}
    </div>
  );
}
