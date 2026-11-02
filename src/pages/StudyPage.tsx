import { useEffect, useMemo, useState } from 'react';
import { ExternalLink, FileText, Image, Mic, Search, Trash2, Video } from 'lucide-react';
import { signedUrls, useStudy, type Study } from '../lib/study';
import type { StudyKind, StudyMedia, StudySource, StudyItem } from '../lib/types';
import { dayOf } from '../lib/stats';

const on = 'border-edge bg-edge/15 text-edge', off = 'border-line text-mute';
const KIND_LABEL: Record<StudyKind, string> = { mentor: 'Mentor', own: 'My day' };
const MEDIA: [StudyMedia, string, typeof FileText][] = [['text', 'Transcript', FileText], ['screenshot', 'Screenshot', Image], ['video', 'Video', Video], ['audio', 'Voice note', Mic]];
const MEDIA_ICON = Object.fromEntries(MEDIA.map(([m, , I]) => [m, I])) as Record<StudyMedia, typeof FileText>;
const VIDEO_WARN = 150 * 1048576, VIDEO_MAX = 200 * 1048576, IMAGE_MAX = 10 * 1048576, AUDIO_MAX = 25 * 1048576;
const niceDay = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

/** A screenshot thumbnail, video or voice-note player for a private study file. */
function Media({ type, path, urls }: { type: StudyMedia; path: string | null; urls: Record<string, string> }) {
  const u = path ? urls[path] : '';
  if (!path) return null;
  if (!u) return <div className="rounded-lg border border-line aspect-video" />;
  if (type === 'screenshot') return <a href={u} target="_blank" rel="noreferrer"><img src={u} alt="Screenshot" className="rounded-lg border border-line w-full aspect-video object-cover" /></a>;
  if (type === 'video') return <video src={u} controls preload="metadata" className="rounded-lg border border-line w-full aspect-video bg-black" />;
  if (type === 'audio') return <audio src={u} controls preload="none" className="w-full" />;
  return null;
}

function Badges({ kind, mediaType, day }: { kind: StudyKind; mediaType: StudyMedia; day: string | null }) {
  const Icon = MEDIA_ICON[mediaType];
  return (
    <span className="flex items-center gap-1.5 text-[11px] text-mute">
      <span className={`rounded-md px-1.5 py-0.5 font-bold ${kind === 'mentor' ? 'bg-edge/15 text-edge' : 'bg-win/15 text-win'}`}>{KIND_LABEL[kind]}</span>
      <Icon className="w-3.5 h-3.5" />
      {day && <span>{niceDay(day)}</span>}
    </span>
  );
}

function Ask({ study, kind, from, to }: { study: Study; kind: StudyKind | ''; from: string; to: string }) {
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [res, setRes] = useState<{ answer: string; sources: StudySource[] } | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const submit = async () => {
    if (!q.trim()) return;
    setBusy(true); setErr(''); setRes(null);
    try {
      const r = await study.ask(q.trim(), kind || undefined, from, to);
      setRes(r);
      setUrls(await signedUrls([...new Set(r.sources.filter(s => s.mediaPath && s.mediaType === 'screenshot').map(s => s.mediaPath as string))]));
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  };
  return (
    <section className="card p-4 space-y-3">
      <form className="flex gap-2" onSubmit={e => { e.preventDefault(); void submit(); }}>
        <input className="field" value={q} onChange={e => setQ(e.target.value)} placeholder="Ask: what does he say about absorption at the bid?" />
        <button className="btn-edge shrink-0" disabled={busy || !q.trim()}><Search className="w-4 h-4" />{busy ? 'Searching…' : 'Ask'}</button>
      </form>
      {err && <p className="text-sm text-loss">{err}</p>}
      {res && (
        <div className="space-y-3">
          <p className="text-sm whitespace-pre-wrap">{res.answer}</p>
          {res.sources.length > 0 && (
            <div>
              <div className="label">Sources</div>
              <div className="grid md:grid-cols-2 gap-2">
                {res.sources.map((s, i) => (
                  <div key={s.id} className="rounded-lg border border-line p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-mute">[{i + 1}]</span>
                      <span className="font-semibold text-sm truncate">{s.label}</span>
                      {s.sourceUrl && <a href={s.sourceUrl} target="_blank" rel="noreferrer" className="ml-auto text-mute hover:text-ink" aria-label="Open source"><ExternalLink className="w-3.5 h-3.5" /></a>}
                    </div>
                    <Badges kind={s.kind} mediaType={s.mediaType} day={s.day} />
                    {s.mediaType === 'screenshot' && <Media type="screenshot" path={s.mediaPath} urls={urls} />}
                    <p className="text-xs text-mute whitespace-pre-wrap">{s.snippet}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function Add({ study }: { study: Study }) {
  const [kind, setKind] = useState<StudyKind>('mentor');
  const [media, setMedia] = useState<StudyMedia>('text');
  const today = dayOf(new Date().toISOString());
  const [label, setLabel] = useState('');
  const [url, setUrl] = useState('');
  const [day, setDay] = useState(today);
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [inputKey, setInputKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState('');
  // Voice notes are for your own days
  useEffect(() => { if (kind === 'mentor' && media === 'audio') setMedia('text'); }, [kind, media]);
  useEffect(() => { setFile(null); setInputKey(k => k + 1); setErr(''); }, [media]);

  const big = file && media === 'video' && file.size > VIDEO_WARN;
  const tooBig = file && (media === 'video' ? file.size > VIDEO_MAX : media === 'screenshot' ? file.size > IMAGE_MAX : media === 'audio' ? file.size > AUDIO_MAX : false);
  const needsFile = media === 'screenshot' || media === 'video' || media === 'audio';
  const theLabel = label.trim() || (media === 'audio' && day ? `Voice note ${niceDay(day)}` : '');
  const ready = theLabel && !tooBig && (!needsFile || file) && (media !== 'text' || text.trim() || url.trim());

  const submit = async () => {
    setBusy(true); setErr(''); setDone('');
    try {
      const r = await study.add({ kind, mediaType: media, label: theLabel, sourceUrl: url.trim() || undefined, day: kind === 'own' && day ? day : undefined, text: text.trim() || undefined, file: needsFile ? file || undefined : undefined });
      setDone([r.chunks > 1 ? `Saved, ${r.chunks} searchable pieces.` : r.chunks ? 'Saved and searchable.' : 'Saved (findable by its label).', r.note].filter(Boolean).join(' '));
      setLabel(''); setUrl(''); setText(''); setFile(null); setInputKey(k => k + 1);
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  };

  return (
    <section className="card p-4 space-y-3">
      <h3 className="font-bold">Add material</h3>
      <div className="flex flex-wrap gap-1.5">
        {(['mentor', 'own'] as StudyKind[]).map(k => <button key={k} onClick={() => setKind(k)} className={`chip ${kind === k ? on : off}`}>{k === 'mentor' ? 'Mentor' : 'Own day'}</button>)}
        <span className="w-px bg-line mx-1" />
        {MEDIA.filter(([m]) => m !== 'audio' || kind === 'own').map(([m, l, I]) => <button key={m} onClick={() => setMedia(m)} className={`chip gap-1 ${media === m ? on : off}`}><I className="w-3.5 h-3.5" />{l}</button>)}
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        <div>
          <label className="label">Label</label>
          <input className="field" value={label} onChange={e => setLabel(e.target.value)} maxLength={200}
            placeholder={media === 'audio' && day ? `Voice note ${niceDay(day)}` : kind === 'mentor' ? 'Video title, e.g. "Reading absorption on the footprint"' : 'e.g. "Faded the open, stopped twice"'} />
        </div>
        {kind === 'own' && (
          <div>
            <label className="label">Trading day</label>
            <input type="date" className="field" value={day} onChange={e => setDay(e.target.value)} />
          </div>
        )}
        {(media === 'text' || media === 'video') && (
          <div>
            <label className="label">Source link (optional{media === 'text' || media === 'video' ? '; a YouTube link with no transcript pasted fetches its captions' : ''})</label>
            <input className="field" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://www.youtube.com/watch?v=…" />
          </div>
        )}
        {needsFile && (
          <div>
            <label className="label">{media === 'screenshot' ? 'Image' : media === 'video' ? 'Video clip (stored for playback; clips under 25MB with no transcript get their audio transcribed automatically)' : 'Audio file (voice memo, .m4a/.mp3/.wav/.webm)'}</label>
            <input key={inputKey} type="file" className="field py-1.5 !h-auto"
              accept={media === 'screenshot' ? 'image/png,image/jpeg,image/webp,image/gif' : media === 'video' ? 'video/mp4,video/quicktime,video/webm' : 'audio/*'}
              onChange={e => setFile(e.target.files?.[0] || null)} />
            {big && !tooBig && <p className="text-xs text-mute mt-1">That's a big file ({Math.round(file!.size / 1048576)} MB); it may take a while to upload.</p>}
            {tooBig && <p className="text-xs text-loss mt-1">Too big: the limit is {media === 'video' ? '200' : media === 'audio' ? '25' : '10'} MB.</p>}
          </div>
        )}
      </div>
      {(media === 'text' || media === 'video') && (
        <div>
          <label className="label">{media === 'text' ? 'Transcript or notes' : 'Transcript (optional, makes the video searchable)'}</label>
          <textarea rows={6} className="field !h-auto py-2" value={text} onChange={e => setText(e.target.value)} placeholder="Paste the transcript here…" />
        </div>
      )}
      {media === 'screenshot' && (
        <div>
          <label className="label">Note (optional)</label>
          <input className="field" value={text} onChange={e => setText(e.target.value)} placeholder="What you want to remember about it" />
        </div>
      )}
      {err && <p className="text-sm text-loss">{err}</p>}
      {done && <p className="text-sm text-win">{done}</p>}
      <button className="btn-edge" disabled={busy || !ready} onClick={() => void submit()}>{busy ? (needsFile ? 'Uploading and reading…' : 'Saving…') : 'Save'}</button>
    </section>
  );
}

function Library({ study, kind, from, to }: { study: Study; kind: StudyKind | ''; from: string; to: string }) {
  const [find, setFind] = useState('');
  const [shown, setShown] = useState(20);
  const [err, setErr] = useState('');
  const [urls, setUrls] = useState<Record<string, string>>({});
  const list = useMemo(() => (study.items || []).filter(i =>
    (!kind || i.kind === kind) && (!from || (i.day && i.day >= from)) && (!to || (i.day && i.day <= to)) &&
    (!find.trim() || `${i.label} ${i.content}`.toLowerCase().includes(find.trim().toLowerCase()))), [study.items, kind, from, to, find]);
  const page = list.slice(0, shown);
  const paths = page.map(i => i.media_path).filter((p): p is string => !!p && !urls[p]);
  useEffect(() => { if (paths.length) void signedUrls(paths).then(u => setUrls(x => ({ ...x, ...u }))); }, [paths.join('|')]); // eslint-disable-line react-hooks/exhaustive-deps
  const del = (i: StudyItem) => { if (confirm(`Delete "${i.label}"?`)) study.remove(i).catch(e => setErr(e.message)); };

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-3">
        <h3 className="font-bold">Library</h3>
        <span className="text-xs text-mute">{list.length} item{list.length === 1 ? '' : 's'}</span>
        <input className="field !w-auto !h-9 ml-auto" value={find} onChange={e => setFind(e.target.value)} placeholder="Filter by label or text" />
      </div>
      {err && <p className="text-sm text-loss">{err}</p>}
      {study.items === null ? <p className="text-mute text-sm">Loading…</p>
        : !list.length ? <p className="text-mute text-sm">{study.items.length ? 'Nothing matches these filters.' : 'Nothing saved yet. Add a transcript or screenshot above.'}</p>
        : (
          <div className="grid md:grid-cols-2 gap-3">
            {page.map(i => (
              <div key={i.batch_id} className="card p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm truncate">{i.label}</span>
                  {i.source_url && <a href={i.source_url} target="_blank" rel="noreferrer" className="text-mute hover:text-ink" aria-label="Open source"><ExternalLink className="w-3.5 h-3.5" /></a>}
                  <button onClick={() => del(i)} className="ml-auto text-mute hover:text-loss" aria-label="Delete"><Trash2 className="w-4 h-4" /></button>
                </div>
                <Badges kind={i.kind} mediaType={i.media_type} day={i.day} />
                <Media type={i.media_type} path={i.media_path} urls={urls} />
                {i.content ? <p className="text-xs text-mute line-clamp-3 whitespace-pre-wrap">{i.content}</p>
                  : i.media_type !== 'screenshot' && <p className="text-xs text-mute">No transcript; found by its label only.</p>}
              </div>
            ))}
          </div>
        )}
      {shown < list.length && <button className="btn-line w-full" onClick={() => setShown(shown + 20)}>Show more</button>}
    </section>
  );
}

export default function StudyPage({ userId }: { userId: string }) {
  const study = useStudy(userId);
  const [kind, setKind] = useState<StudyKind | ''>('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {([['', 'All'], ['mentor', 'Mentor'], ['own', 'My days']] as [StudyKind | '', string][]).map(([k, l]) =>
          <button key={k} onClick={() => setKind(k)} className={`chip ${kind === k ? on : off}`}>{l}</button>)}
        {kind === 'own' && (
          <span className="flex items-center gap-1 text-sm text-mute">
            <input type="date" aria-label="From" className="field !w-auto !h-9" value={from} onChange={e => setFrom(e.target.value)} />
            to
            <input type="date" aria-label="To" className="field !w-auto !h-9" value={to} onChange={e => setTo(e.target.value)} />
          </span>
        )}
      </div>
      {study.error && <p className="text-sm text-loss">{study.error}</p>}
      <Ask study={study} kind={kind} from={kind === 'own' ? from : ''} to={kind === 'own' ? to : ''} />
      <Add study={study} />
      <Library study={study} kind={kind} from={kind === 'own' ? from : ''} to={kind === 'own' ? to : ''} />
    </div>
  );
}
