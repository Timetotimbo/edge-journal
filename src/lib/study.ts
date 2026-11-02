import { useCallback, useEffect, useState } from 'react';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type { StudyItem, StudyKind, StudyMedia, StudySource } from './types';

export const STUDY_BUCKET = 'tj-study';

/** Call one of the study edge functions as the signed-in user; its { error } message on failure. */
async function call<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    let msg = error.message;
    if (error instanceof FunctionsHttpError) { try { msg = (await error.context.json()).error || msg; } catch { /* keep the message */ } }
    throw new Error(msg);
  }
  return data as T;
}

// The bucket only takes these types; browsers name some audio files differently
const MIME: Record<string, string> = { 'audio/x-m4a': 'audio/mp4', 'audio/m4a': 'audio/mp4', 'audio/aac': 'audio/mp4', 'audio/mp3': 'audio/mpeg', 'audio/x-wav': 'audio/wav', 'audio/wave': 'audio/wav', 'audio/vnd.wave': 'audio/wav', 'video/x-m4v': 'video/mp4' };
const BY_EXT: Record<string, string> = { m4a: 'audio/mp4', mp3: 'audio/mpeg', wav: 'audio/wav', webm: 'audio/webm', mp4: 'video/mp4', mov: 'video/quicktime', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' };
const extOf = (f: File) => (f.name.split('.').pop() || '').toLowerCase();
export const fileType = (f: File) => { const t = f.type.split(';')[0]; return MIME[t] || t || BY_EXT[extOf(f)] || 'application/octet-stream'; };

export type Ingest = { kind: StudyKind; mediaType: StudyMedia; label: string; sourceUrl?: string; day?: string; text?: string; file?: File };

/** The study library (one row per upload: each batch's first chunk), loaded once and kept in step with adds and deletes. */
export function useStudy(userId: string | undefined) {
  const [items, setItems] = useState<StudyItem[] | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!userId) return;
    const all: StudyItem[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase.from('tj_study_items')
        .select('id, batch_id, created_at, kind, media_type, label, source_url, day, media_path, content, chunk_index')
        .eq('chunk_index', 0).order('created_at', { ascending: false }).range(from, from + 999);
      if (error) { setError(error.message); return; }
      all.push(...(data as StudyItem[]));
      if (!data || data.length < 1000) break;
    }
    setItems(all);
  }, [userId]);
  useEffect(() => { void load(); }, [load]);

  /** Upload the file (if any) to the private tj-study bucket, then have it read, transcribed and embedded. */
  const add = async ({ file, ...rest }: Ingest) => {
    let mediaPath: string | undefined;
    if (file) {
      const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extOf(file) || 'bin'}`;
      const { error } = await supabase.storage.from(STUDY_BUCKET).upload(path, file, { contentType: fileType(file) });
      if (error) throw error;
      mediaPath = path;
    }
    try {
      const r = await call<{ items: StudyItem[]; chunks: number; note: string }>('tj-study-ingest', { ...rest, mediaPath });
      const first = r.items.find(i => i.chunk_index === 0) || r.items[0];
      if (first) setItems(xs => [first, ...(xs || [])]);
      return r;
    } catch (e) {
      // Nothing saved: don't leave the file behind
      if (mediaPath) await supabase.storage.from(STUDY_BUCKET).remove([mediaPath]);
      throw e;
    }
  };

  /** Delete an upload: every chunk of it, and its file. */
  const remove = async (item: StudyItem) => {
    const { error } = await supabase.from('tj_study_items').delete().eq('batch_id', item.batch_id);
    if (error) throw new Error(error.message);
    if (item.media_path) await supabase.storage.from(STUDY_BUCKET).remove([item.media_path]);
    setItems(xs => xs && xs.filter(x => x.batch_id !== item.batch_id));
  };

  const ask = (query: string, kind?: StudyKind, dayFrom?: string, dayTo?: string) =>
    call<{ answer: string; sources: StudySource[] }>('tj-study-search', { query, kind, dayFrom: dayFrom || undefined, dayTo: dayTo || undefined });

  return { items, error, reload: load, add, remove, ask };
}
export type Study = ReturnType<typeof useStudy>;

/** Short-lived links for private study files (path → url). */
export async function signedUrls(paths: string[]): Promise<Record<string, string>> {
  if (!paths.length) return {};
  const { data } = await supabase.storage.from(STUDY_BUCKET).createSignedUrls(paths, 3600);
  return Object.fromEntries((data || []).filter(d => d.path && d.signedUrl).map(d => [d.path as string, d.signedUrl as string]));
}
