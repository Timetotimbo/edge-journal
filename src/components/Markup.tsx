import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowUpRight, Circle, Minus, Pencil, Scan, SeparatorHorizontal, Square, Trash2, Type, Undo2, X } from 'lucide-react';

// Draw on a chart picture: freehand, straight lines, arrows, boxes, a full-width price line, and text, in a few
// colours. Everything is kept as a list of shapes in the picture's own pixels (so undo works, pinch-zoom is just a
// view on top of the same data, and the saved copy is full size), and Save hands back a JPEG.
type Tool = 'pen' | 'line' | 'hline' | 'arrow' | 'oval' | 'box' | 'text';
// price: on a price line, the price the trader typed for it (read off the screenshot's price axis). Two of those set the
// chart's scale, and from then on every price line shows its own price, even dragged.
type Shape = { tool: Tool; color: string; w: number; pts: [number, number][]; text?: string; price?: number };
type View = { scale: number; x: number; y: number };

const TOOLS: [Tool, string, typeof Pencil][] = [['pen', 'Draw', Pencil], ['line', 'Line', Minus], ['hline', 'Price line', SeparatorHorizontal], ['arrow', 'Arrow', ArrowUpRight], ['oval', 'Circle', Circle], ['box', 'Box', Square], ['text', 'Text', Type]];
const COLORS = ['#ff8a1f', '#22c55e', '#ef4444', '#facc15', '#38bdf8', '#ffffff', '#000000'];
const SIZES: [number, string][] = [[2, 'Thin'], [4, 'Medium'], [7, 'Thick']];
const MAX = 2400; // longest side of the saved picture
const MAX_ZOOM = 6;

function distToSeg(p: [number, number], a: [number, number], b: [number, number]): number {
  const dx = b[0] - a[0], dy = b[1] - a[1], len2 = dx * dx + dy * dy;
  const t = Math.max(0, Math.min(1, len2 ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2 : 0));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}
function inBox(p: [number, number], a: [number, number], b: [number, number], pad: number): boolean {
  const x0 = Math.min(a[0], b[0]) - pad, x1 = Math.max(a[0], b[0]) + pad;
  const y0 = Math.min(a[1], b[1]) - pad, y1 = Math.max(a[1], b[1]) + pad;
  return p[0] >= x0 && p[0] <= x1 && p[1] >= y0 && p[1] <= y1;
}

// Was the point a tap on an already-placed shape of this same tool? Lets a placed line/arrow/box/price-line/text be
// grabbed and dragged instead of only ever creating a new one. Freehand strokes are left out — they overlap too
// often for a bounding-box hit to mean anything.
function hitIndex(shapes: Shape[], p: [number, number], g: CanvasRenderingContext2D, tool: Tool): number {
  for (let i = shapes.length - 1; i >= 0; i--) {
    const s = shapes[i];
    if (s.tool !== tool) continue;
    const tol = Math.max(s.w * 3, 14);
    const [a, b] = [s.pts[0], s.pts[s.pts.length - 1]];
    if (s.tool === 'text') {
      const px = s.w * 6;
      g.font = `600 ${px}px system-ui, sans-serif`;
      const w = g.measureText(s.text || '').width, pad = px * 0.35;
      if (p[0] >= a[0] - pad && p[0] <= a[0] + w + pad && p[1] >= a[1] - px / 2 - pad && p[1] <= a[1] + px / 2 + pad) return i;
    } else if (s.tool === 'hline') { if (Math.abs(p[1] - a[1]) <= tol) return i; }
    else if (s.tool === 'box' || s.tool === 'oval') { if (inBox(p, a, b, tol)) return i; }
    else if (distToSeg(p, a, b) <= tol) return i; // line, arrow
  }
  return -1;
}

/** The price at a height on the picture, once two price lines at different heights have a typed price. */
function priceScale(shapes: Shape[]): ((y: number) => number) | null {
  const known = shapes.filter(s => s.tool === 'hline' && s.price != null);
  for (let i = known.length - 1; i > 0; i--) for (let j = i - 1; j >= 0; j--) {
    const [a, b] = [known[i], known[j]];
    const dy = b.pts[0][1] - a.pts[0][1];
    if (Math.abs(dy) > 4) return y => a.price! + ((y - a.pts[0][1]) / dy) * (b.price! - a.price!);
  }
  return null;
}
const fmtPrice = (n: number) => (Math.round(n * 4) / 4).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function paint(g: CanvasRenderingContext2D, img: CanvasImageSource, W: number, H: number, shapes: Shape[]) {
  g.drawImage(img, 0, 0, W, H);
  const scale = priceScale(shapes);
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
    else if (s.tool === 'oval') {
      // Drag corner to corner: the oval fills that box, so a tall drag circles a wick and a square one a round circle
      g.beginPath();
      g.ellipse((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, Math.max(1, Math.abs(b[0] - a[0]) / 2), Math.max(1, Math.abs(b[1] - a[1]) / 2), 0, 0, Math.PI * 2);
      g.stroke();
    }
    else if (s.tool === 'hline') {
      g.beginPath(); g.moveTo(0, a[1]); g.lineTo(W, a[1]); g.stroke();
      const price = s.price ?? scale?.(a[1]);
      if (price != null && isFinite(price)) {
        // A price tag on the left end of the line, in the line's colour
        const px = Math.max(W, H) / 42, t = fmtPrice(price);
        g.font = `700 ${px}px system-ui, sans-serif`; g.textBaseline = 'middle';
        const tw = g.measureText(t).width, pad = px * 0.35, h = px * 1.4;
        const y = Math.min(H - h / 2, Math.max(h / 2, a[1]));
        g.fillStyle = s.color; g.fillRect(0, y - h / 2, tw + pad * 2, h);
        g.fillStyle = ['#ffffff', '#facc15', '#22c55e', '#38bdf8', '#ff8a1f'].includes(s.color) ? '#000000' : '#ffffff';
        g.fillText(t, pad, y);
      }
    }
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
        if (s.text) {
          // The arrow's note sits at its tail, out past the end, so the head still points at clear chart
          // (kept inside the picture: an arrow starting near an edge would otherwise push its note off it)
          // Smallish, two or three words to a line, so a note sits beside the action instead of across it
          const px = Math.max(s.w * 4, Math.max(W, H) / 62), right = b[0] >= a[0], lh = px * 1.15;
          g.font = `700 ${px}px system-ui, sans-serif`; g.textBaseline = 'middle';
          const lines: string[] = [];
          for (const word of s.text.split(/\s+/)) {
            const last = lines[lines.length - 1];
            if (last != null && last.split(' ').length < 3 && (last + ' ' + word).length <= 16) lines[lines.length - 1] = `${last} ${word}`;
            else lines.push(word);
          }
          const tw = Math.max(...lines.map(l => g.measureText(l).width)), th = lines.length * lh, gap = px * 0.5;
          let x = right ? a[0] - gap - tw : a[0] + gap, y = a[1] - th / 2; // block's left and top
          let align: CanvasTextAlign = right ? 'right' : 'left';
          if (x < gap || x + tw > W - gap) { x = Math.min(W - gap - tw, Math.max(gap, a[0] - tw / 2)); y = b[1] <= a[1] ? a[1] + gap : a[1] - gap - th; align = 'center'; }
          y = Math.min(H - th - gap, Math.max(gap, y));
          g.textAlign = align;
          const ax = align === 'right' ? x + tw : align === 'center' ? x + tw / 2 : x;
          g.lineWidth = px / 4; g.strokeStyle = s.color === '#000000' ? '#ffffff' : '#000000'; g.fillStyle = s.color;
          lines.forEach((l, k) => { const ly = y + lh * (k + 0.5); g.strokeText(l, ax, ly); g.fillText(l, ax, ly); });
          g.textAlign = 'left';
        }
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
  const dragShape = useRef<{ index: number; start: [number, number]; orig: [number, number][] } | null>(null);
  // The view is a camera on top of the same picture-space shapes, not a different coordinate system for them —
  // so pinch-zoom never touches what's actually stored, only how it's currently framed.
  const [view, setView] = useState<View>({ scale: 1, x: 0, y: 0 });
  const pointers = useRef<Map<number, [number, number]>>(new Map());
  const gesture = useRef<{ startDist: number; startMidWorld: [number, number]; startView: View } | null>(null);
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
    g.save();
    // Wipe first: wherever the zoomed picture doesn't reach would otherwise keep old frames (stacked copies of the chart)
    g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#000'; g.fillRect(0, 0, dim[0], dim[1]);
    g.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    paint(g, img.current, dim[0], dim[1], live.current ? [...list, live.current] : list);
    g.restore();
  };
  useEffect(() => redraw(), [dim, shapes, view]);

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

  // A point on screen, in the canvas's own pixels (before the pinch-zoom view is applied)
  const canvasPt = (e: React.PointerEvent): [number, number] => {
    const r = canvas.current!.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * dim![0], ((e.clientY - r.top) / r.height) * dim![1]];
  };
  // Same point, undoing the current pan/zoom — this is the space shapes actually live in
  const toWorld = (cp: [number, number], v = view): [number, number] => [(cp[0] - v.x) / v.scale, (cp[1] - v.y) / v.scale];
  // Line widths follow the picture's size, so a stroke looks the same on a phone screenshot and a wide monitor grab
  const width = () => (size * Math.max(dim![0], dim![1])) / 900;

  const down = (e: React.PointerEvent) => {
    if (!dim) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const cp = canvasPt(e);
    pointers.current.set(e.pointerId, cp);
    if (pointers.current.size >= 2) {
      // A second finger landing means "pinch", not "draw" — drop whatever single-finger action was starting
      live.current = null; dragShape.current = null;
      const [p1, p2] = [...pointers.current.values()].slice(-2);
      gesture.current = { startDist: Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) || 1, startMidWorld: toWorld([(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2]), startView: view };
      return;
    }
    const p = toWorld(cp);
    if (tool !== 'pen') {
      const hit = hitIndex(shapes, p, canvas.current!.getContext('2d')!, tool);
      if (hit !== -1) { dragShape.current = { index: hit, start: p, orig: shapes[hit].pts.map(q => [...q] as [number, number]) }; return; }
    }
    if (tool === 'text') {
      const text = prompt('Text to add')?.trim();
      if (text) setShapes(s => [...s, { tool, color, w: width(), pts: [p], text }]);
      return;
    }
    live.current = { tool, color, w: width(), pts: [p] };
    redraw();
  };
  const move = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    const cp = canvasPt(e);
    pointers.current.set(e.pointerId, cp);
    if (gesture.current) {
      const [p1, p2] = [...pointers.current.values()].slice(-2);
      const dist = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) || 1;
      const mid: [number, number] = [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2];
      const scale = Math.min(MAX_ZOOM, Math.max(1, gesture.current.startView.scale * (dist / gesture.current.startDist)));
      const [wx, wy] = gesture.current.startMidWorld;
      // Keep the world point under the fingers' midpoint fixed under them — the usual pinch feel, pan included
      // ...but never past the picture's edges, so the frame is always all chart
      const [W, H] = dim!;
      const clamp = (v: number, size: number) => Math.min(0, Math.max(size - size * scale, v));
      setView({ scale, x: clamp(mid[0] - wx * scale, W), y: clamp(mid[1] - wy * scale, H) });
      return;
    }
    const drag = dragShape.current;
    if (drag) {
      const p = toWorld(cp);
      const dx = p[0] - drag.start[0], dy = p[1] - drag.start[1];
      setShapes(list => list.map((s, i) => (i === drag.index ? { ...s, pts: drag.orig.map(([x, y]) => [x + dx, y + dy] as [number, number]) } : s)));
      return;
    }
    const s = live.current;
    if (!s) return;
    const p = toWorld(cp);
    // A price line follows the pointer directly while it's being placed, rather than stretching from a fixed start
    if (s.tool === 'arrow' && e.pointerType !== 'mouse') {
      // On a phone the head would sit under the fingertip: draw it a fingertip's length further on, so it's visible
      const a = s.pts[0], dx = p[0] - a[0], dy = p[1] - a[1], len = Math.hypot(dx, dy);
      const r = canvas.current!.getBoundingClientRect();
      const reach = (44 * (dim![0] / r.width)) / view.scale; // 44 screen pixels, in picture pixels
      s.pts[1] = len > 1 ? [p[0] + (dx / len) * reach, p[1] + (dy / len) * reach] : p;
    } else if (s.tool === 'pen') s.pts.push(p); else if (s.tool === 'hline') s.pts[0] = p; else s.pts[1] = p;
    redraw();
  };
  // Price lines on a screenshot: ask what price a line sits at (only until two lines set the scale; after that
  // every line knows its price). Blank skips. A tap on a placed price line asks again, to set or fix its price.
  const askPrice = (current?: number) => {
    const said = prompt('Price at this line? Read it off the price axis. After two lines, the rest fill in by themselves. Leave blank to skip.', current != null ? String(current) : '');
    if (said == null) return undefined;
    const n = parseFloat(said.replace(/[,$\s]/g, ''));
    return isFinite(n) ? n : null; // null: cleared
  };
  const up = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) gesture.current = null;
    if (pointers.current.size > 0) return; // another finger is still down (mid-pinch, or about to be)
    const drag = dragShape.current;
    if (drag) {
      dragShape.current = null;
      const sh = shapes[drag.index];
      const moved = sh ? Math.abs(sh.pts[0][1] - drag.orig[0][1]) + Math.abs(sh.pts[0][0] - drag.orig[0][0]) : 99999;
      const wobble = Math.max(dim![0], dim![1]) / 60 / view.scale; // about a fingertip's slip
      if (sh?.tool === 'arrow' && moved < wobble) {
        // Tap a placed arrow (no drag) to write a note on it; blank removes the note
        const said = prompt('Note for this arrow', sh.text || '');
        if (said != null) setShapes(list => list.map((x, i) => (i === drag.index ? { ...x, pts: drag.orig, text: said.trim() || undefined } : x)));
      } else if (sh?.tool === 'hline' && moved < wobble) {
        const n = askPrice(sh.price);
        if (n !== undefined) setShapes(list => list.map((x, i) => (i === drag.index ? { ...x, pts: drag.orig, price: n ?? undefined } : x)));
      }
      return;
    }
    const s = live.current;
    if (!s) return;
    live.current = null;
    if (s.tool === 'hline' && !priceScale(shapes)) { const n = askPrice(); if (n != null) s.price = n; }
    if (s.tool === 'arrow' && s.pts.length > 1) {
      // A finished arrow asks for its note right away; Cancel or blank leaves it without one (tap it later to add)
      const note = prompt('Note for this arrow (leave blank for none)', '')?.trim();
      if (note) s.text = note;
      redraw([...shapes, s]);
    }
    setShapes(list => [...list, s]);
  };

  const save = async () => {
    setSaving(true); setErr('');
    try {
      live.current = null;
      const c = canvas.current, g = c?.getContext('2d');
      if (c && g && img.current && dim) { g.save(); g.setTransform(1, 0, 0, 1, 0, 0); paint(g, img.current, dim[0], dim[1], shapes); g.restore(); }
      const blob = await new Promise<Blob | null>(ok => canvas.current!.toBlob(ok, 'image/jpeg', 0.92));
      if (!blob) throw new Error("Couldn't save the picture.");
      await onSave(blob);
      onClose();
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); setSaving(false); }
    finally { redraw(); } // put the live view transform back on screen whether save succeeded or not
  };

  const zoomed = view.scale !== 1 || view.x !== 0 || view.y !== 0;

  return createPortal(
    <div className="fixed inset-0 z-[70] bg-black flex flex-col text-white" onClick={e => e.stopPropagation()} onPaste={e => e.stopPropagation()}>
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/15">
        <button onClick={onClose} aria-label="Close without saving" className="p-2 -ml-2"><X className="w-5 h-5" /></button>
        <span className="font-semibold text-sm">Mark up chart</span>
        <button onClick={() => setView({ scale: 1, x: 0, y: 0 })} disabled={!zoomed} aria-label="Reset zoom" className="ml-auto p-2 disabled:opacity-30"><Scan className="w-5 h-5" /></button>
        <button onClick={() => setShapes(s => s.slice(0, -1))} disabled={!shapes.length} aria-label="Undo" className="p-2 disabled:opacity-30"><Undo2 className="w-5 h-5" /></button>
        <button onClick={() => shapes.length && confirm('Erase everything you drew?') && setShapes([])} disabled={!shapes.length} aria-label="Erase all" className="p-2 disabled:opacity-30"><Trash2 className="w-5 h-5" /></button>
        <button onClick={() => void save()} disabled={saving || !dim} className="btn-edge !h-9 !px-4">{saving ? 'Saving…' : 'Save'}</button>
      </div>
      {err && <p className="px-3 py-1.5 text-sm text-red-400">{err}</p>}
      {/* Fingers are read on this whole area, not just the chart: a pinch's second finger often lands beside a narrow
          phone screenshot, and if only the chart listened, the first finger kept drawing stray lines */}
      <div className="flex-1 min-h-0 flex items-center justify-center p-2 overflow-hidden relative touch-none select-none"
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
        {dim ? <canvas ref={canvas} width={dim[0]} height={dim[1]}
          className="max-w-full max-h-full rounded touch-none select-none" style={{ cursor: tool === 'text' ? 'text' : 'crosshair' }} />
          : !err && <span className="text-sm text-white/60">Opening…</span>}
        {zoomed && <span className="absolute bottom-3 right-3 text-xs bg-black/70 rounded px-1.5 py-0.5 text-white/70">{Math.round(view.scale * 100)}%</span>}
      </div>
      <div className="px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] border-t border-white/15 space-y-2">
        <p className="text-[11px] text-white/40 -mb-0.5">Two fingers: pinch to zoom, drag to pan</p>
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
