// Many chart screenshots at once (from the phone's gallery): each one is filed under the day it was taken, in the
// same private tj-shots/<user>/day-<yyyy-mm-dd>/ folders the Journal's Charts use, shrunk to a sensible size first.
import { supabase } from './supabase';
import { dayOf } from './stats';

export const CHARTS_CHANGED = 'tj-charts-changed';

/** The day a screenshot was taken: from its name (Screenshot_20261114_163912…, IMG-20261114-…), else the file's date. */
export function chartDay(f: File): string {
  const m = /(20\d{2})[-_.]?(0[1-9]|1[0-2])[-_.]?(0[1-9]|[12]\d|3[01])/.exec(f.name || '');
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return dayOf(new Date(f.lastModified || Date.now()).toISOString());
}

/** A JPEG no wider/taller than 2000 px (a 300-picture upload stays small and quick); the original if that fails. */
async function shrink(f: Blob): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(f);
    const k = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
    bmp.close();
    const out = await new Promise<Blob | null>(ok => c.toBlob(ok, 'image/jpeg', 0.85));
    return out && out.size < f.size ? out : f;
  } catch { return f; }
}

/** Uploads them four at a time; onProgress(done, total, failed). Returns the days that got charts. */
export async function uploadCharts(files: File[], onProgress: (done: number, total: number, failed: number) => void): Promise<string[]> {
  const uid = (await supabase.auth.getUser()).data.user!.id;
  const pics = files.filter(f => f.type.startsWith('image/'));
  const days = new Set<string>();
  let done = 0, failed = 0, next = 0;
  onProgress(0, pics.length, 0);
  const worker = async () => {
    while (next < pics.length) {
      const i = next++, f = pics[i], day = chartDay(f);
      try {
        const body = await shrink(f);
        const ext = body.type === 'image/jpeg' ? 'jpg' : (body.type.split('/')[1] || 'png');
        const stamp = (f.lastModified || Date.now()).toString(36);
        const { error } = await supabase.storage.from('tj-shots').upload(`${uid}/day-${day}/${Date.now()}-${stamp}-${i}.${ext}`, body, { contentType: body.type });
        if (error) throw error;
        days.add(day);
      } catch { failed++; }
      done++;
      onProgress(done, pics.length, failed);
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
  window.dispatchEvent(new Event(CHARTS_CHANGED));
  return [...days];
}

/** Every day that has charts, so a day with screenshots but no trades or notes still shows in the Journal. */
export async function chartDays(): Promise<string[]> {
  const uid = (await supabase.auth.getUser()).data.user?.id;
  if (!uid) return [];
  const { data } = await supabase.storage.from('tj-shots').list(uid, { limit: 1000 });
  return (data || []).map(f => /^day-(\d{4}-\d{2}-\d{2})$/.exec(f.name)?.[1]).filter((d): d is string => !!d);
}
