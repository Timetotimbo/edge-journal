import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowUpRight, Minus, Pencil, Square, Trash2, Type, Undo2, X } from 'lucide-react';

// Draw on a chart picture: freehand, straight lines, arrows, boxes and text, in a few colours. Everything is kept as a
// list of shapes in the picture's own pixels (so undo works and the saved copy is full size), and Save hands back a JPEG.
type Tool = 'pen' | 'line' | 'arrow' | 'box' | 'text';
type Shape = { tool: Tool; color: string; w: number; pts: [number, number][]; text?: string };

const TOOLS: [Tool, string, typeof Pencil][] = [['pen', 'Draw', Pencil], ['line', 'Line', Minus], ['arrow', 'Arrow', ArrowUpRight], ['box', 'Box', Square], ['text', 'Text', Type]];
const COLORS = ['#ff8a1f', '#22c55e', '#ef4444', '#facc15', '#38bdf8', '#ffffff', '#000000'];
const SIZES: [number, string][] = [[2, 'Thin'], [4, 'Medium'], [7, 'Thick']];
const MAX = 2400; // longest side of the saved picture

function paint(g: CanvasRenderingContext2D, img: CanvasImageSource, W: number, H: number, shapes: Shape[]) {
  g.drawImage(img, 0, 0, W, H);
  g.lineCap = 'round'; g.lineJoin = 'round';
  for (const s of shapes) {
    const [a, b] = [s.pts[0], s.pts[s.pts.length - 1]];
    g.strokeStyle = g.fillStyle = s.color; g.lineWidth = s.w;
    if (s.tool === 'text') {
      const px = s.w * 6;
      g.font = `600 ${px}px system-ui, sans-serif`; g.textBaseline = 'middle';
      // A dark (or light) edge so the words read on any chart
      g.lineWidth = px / 6; g.strokeStyle = s.color === '#000000' ? '#ffffff' : '#000000';
      g.strokeText(s.text || '', a[0], a[1]); g.fillText(s.text || '', a[0], a[1]);
    } else if (s.tool === 'box') g.strokeRect(a[0], a[1], b[0] - a[0], b[1] - a[1]);
    else {
      g.beginPath(); g.moveTo(a[0], a[1]);
      if (s.tool === 'pen') { for (const p of s.pts.slice(1)) g.lineTo(p[0], p[1]); if (s.pts.length === 1) g.lineTo(a[0] + 0.01, a[1]); }
      else g.lineTo(b[0], b[1]);
      g.stroke();
      if (s.tool === 'arrow' && s.pts.length > 1) {
        const t = Math.atan2(b[1] - a[1], b[0] - a[0]), h = s.w * 4.5;
        g.beginPath(); g.moveTo(b[0], b[1]);
        g.lineTo(b[0] - h * Math.cos(t - 0.45), b[1] - h * Math.sin(t - 0.45));
        g.lineTo(b[0] - h * Math.cos(t + 0.45), b[1] - h * Math.sin(t + 0.45));
        g.closePath(); g.fill();
      }
    }
  }
}

/** src: the picture to draw on (a file, or a link it can download). onSave gets the marked-up copy. */
export default function Markup({ src, onSave, onClose }: { src: Blob | string; onSave: (jpeg: Blob) => Promise<void>; onClose: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const img = useRef<ImageBitmap | HTMLImageElement | null>(null);
  const [dim, setDim] = useState<[number, number] | null>(null);
  const [shapes, setShapes] = useState<Shape[]>([]);
  const live = useRef<Shape | null>(null);
  const [tool, setTool] = useState<Tool>('pen');
  const [color, setColor] = useState(COLORS[0]);
  const [size, setSize] = useState(4);
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);

  // Load the picture (downloaded first, so drawing it never locks the canvas)
  useEffect(() => {
    let gone = false, url = '';
    (async () => {
      try {
        const blob = typeof src === 'string' ? await (await fetch(src)).blob() : src;
        url = URL.createObjectURL(blob);
        const el = new Image();
        await new Promise((ok, bad) => { el.onload = ok; el.onerror = bad; el.src = url; });
        if (gone) return;
        const k = Math.min(1, MAX / Math.max(el.naturalWidth, el.naturalHeight));
        img.current = el;
        setDim([Math.round(el.naturalWidth * k), Math.round(el.naturalHeight * k)]);
      } catch { if (!gone) setErr("Couldn't open that picture."); }
    })();
    return () => { gone = true; if (url) URL.revokeObjectURL(url); };
  }, [src]);

  const redraw = (list = shapes) => {
    const c = canvas.current, g = c?.getContext('2d');
    if (!c || !g || !img.current || !dim) return;
    paint(g, img.current, dim[0], dim[1], live.current ? [...list, live.current] : list);
  };
  useEffect(() => redraw(), [dim, shapes]);

  // Escape closes this, not the trade behind it; Ctrl+Z undoes
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
      else if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); setShapes(s => s.slice(0, -1)); }
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') e.stopPropagation();
    };
    addEventListener('keydown', h, true);
    return () => removeEventListener('keydown', h, true);
  }, [onClose]);

  // A point on screen, in the picture's pixels
  const at = (e: React.PointerEvent): [number, number] => {
    const r = canvas.current!.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * dim![0], ((e.clientY - r.top) / r.height) * dim![1]];
  };
  // Line widths follow the picture's size, so a stroke looks the same on a phone screenshot and a wide monitor grab
  const width = () => (size * Math.max(dim![0], dim![1])) / 900;
  const down = (e: React.PointerEvent) => {
    if (!dim) return;
    const p = at(e);
    if (tool === 'text') {
      const text = prompt('Text to add')?.trim();
      if (text) setShapes(s => [...s, { tool, color, w: width(), pts: [p], text }]);
      return;
    }
    canvas.current!.setPointerCapture(e.pointerId);
    live.current = { tool, color, w: width(), pts: [p] };
    redraw();
  };
  const move = (e: React.PointerEvent) => {
    const s = live.current;
    if (!s) return;
    const p = at(e);
    if (s.tool === 'pen') s.pts.push(p); else s.pts[1] = p;
    redraw();
  };
  const up = () => {
    const s = live.current;
    if (!s) return;
    live.current = null;
    setShapes(list => [...list, s]);
  };

  const save = async () => {
    setSaving(true); setErr('');
    try {
      live.current = null; redraw();
      const blob = await new Promise<Blob | null>(ok => canvas.current!.toBlob(ok, 'image/jpeg', 0.92));
      if (!blob) throw new Error("Couldn't save the picture.");
      await onSave(blob);
      onClose();
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); setSaving(false); }
  };

  return createPortal(
    <div className="fixed inset-0 z-[70] bg-black flex flex-col text-white" onClick={e => e.stopPropagation()} onPaste={e => e.stopPropagation()}>
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/15">
        <button onClick={onClose} aria-label="Close without saving" className="p-2 -ml-2"><X className="w-5 h-5" /></button>
        <span className="font-semibold text-sm">Mark up chart</span>
        <button onClick={() => setShapes(s => s.slice(0, -1))} disabled={!shapes.length} aria-label="Undo" className="ml-auto p-2 disabled:opacity-30"><Undo2 className="w-5 h-5" /></button>
        <button onClick={() => shapes.length && confirm('Erase everything you drew?') && setShapes([])} disabled={!shapes.length} aria-label="Erase all" className="p-2 disabled:opacity-30"><Trash2 className="w-5 h-5" /></button>
        <button onClick={() => void save()} disabled={saving || !dim} className="btn-edge !h-9 !px-4">{saving ? 'Saving…' : 'Save'}</button>
      </div>
      {err && <p className="px-3 py-1.5 text-sm text-red-400">{err}</p>}
      <div className="flex-1 min-h-0 flex items-center justify-center p-2 overflow-hidden">
        {dim ? <canvas ref={canvas} width={dim[0]} height={dim[1]} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
          className="max-w-full max-h-full rounded touch-none select-none" style={{ cursor: tool === 'text' ? 'text' : 'crosshair' }} />
          : !err && <span className="text-sm text-white/60">Opening…</span>}
      </div>
      <div className="px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] border-t border-white/15 space-y-2">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {TOOLS.map(([k, label, Icon]) => (
            <button key={k} onClick={() => setTool(k)} className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium border shrink-0 ${tool === k ? 'border-edge bg-edge/20 text-edge' : 'border-white/20 text-white/80'}`}><Icon className="w-4 h-4" />{label}</button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {COLORS.map(c => <button key={c} onClick={() => setColor(c)} aria-label={`Colour ${c}`} className={`w-7 h-7 rounded-full shrink-0 border-2 ${color === c ? 'border-white scale-110' : 'border-white/25'}`} style={{ background: c }} />)}
          <div className="ml-auto flex items-center gap-1">
            {SIZES.map(([n, label]) => (
              <button key={n} onClick={() => setSize(n)} aria-label={label} className={`w-8 h-8 rounded-lg grid place-items-center border ${size === n ? 'border-edge bg-edge/20' : 'border-white/20'}`}><span className="rounded-full bg-white" style={{ width: n * 2 + 2, height: n * 2 + 2 }} /></button>
            ))}
          </div>
        </div>
      </div>
    </div>, document.body);
}
