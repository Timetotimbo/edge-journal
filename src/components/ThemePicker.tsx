import { useEffect, useRef, useState } from 'react';
import { Check, Palette } from 'lucide-react';
import { savedTheme, setTheme, THEMES, type ThemeId } from '../lib/theme';

const GROUPS: [string, string][] = [['edge', 'Edge'], ['dark', 'Dark'], ['neon', 'Neon']];

/** Header button with every colour theme as a swatch; the choice is remembered on this device */
export default function ThemePicker() {
  const [open, setOpen] = useState(false);
  const [theme, setThemeState] = useState<ThemeId>(savedTheme);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    addEventListener('pointerdown', away);
    addEventListener('keydown', esc);
    return () => { removeEventListener('pointerdown', away); removeEventListener('keydown', esc); };
  }, [open]);
  const pick = (id: ThemeId) => { setTheme(id); setThemeState(id); };

  return (
    <div ref={box} className="relative">
      <button onClick={() => setOpen(o => !o)} title="Colour theme" aria-label="Colour theme" aria-expanded={open} className="text-mute hover:text-ink grid place-items-center">
        <Palette className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-8 z-40 w-72 max-w-[calc(100vw-2rem)] card p-3 shadow-2xl space-y-3">
          {GROUPS.map(([g, label]) => (
            <div key={g}>
              <div className="label">{label}</div>
              <div className="grid grid-cols-3 gap-1.5">
                {THEMES.filter(t => t.group === g).map(t => (
                  <button key={t.id} onClick={() => pick(t.id)} aria-pressed={theme === t.id}
                    className={`flex flex-col items-center gap-1 rounded-lg p-1.5 text-[11px] leading-tight text-center border ${theme === t.id ? 'border-edge text-ink' : 'border-transparent text-mute hover:text-ink hover:bg-line/50'}`}>
                    <span className="relative w-9 h-9 rounded-full border border-line grid place-items-center" style={{ background: t.swatch[0] }}>
                      <span className="w-4 h-4 rounded-full" style={{ background: t.swatch[1], boxShadow: t.group === 'neon' ? `0 0 8px ${t.swatch[1]}` : undefined }} />
                      {theme === t.id && <Check className="absolute -right-1 -top-1 w-3.5 h-3.5 rounded-full bg-edge p-0.5" style={{ color: 'rgb(var(--on-edge))' }} />}
                    </span>
                    {t.name}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
