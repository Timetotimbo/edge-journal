// Colour themes, applied as <html data-theme>; the palettes live in index.css. Swatches are [background, accent] for the picker.
export const THEMES = [
  { id: 'auto', name: 'Match device', group: 'edge', swatch: ['#0b0d12', '#ff8a1f'] },
  { id: 'dark', name: 'Edge Dark', group: 'edge', swatch: ['#0b0d12', '#ff8a1f'] },
  { id: 'light', name: 'Edge Light', group: 'edge', swatch: ['#f5f6f8', '#e8720c'] },
  { id: 'purple', name: 'Purple Night', group: 'dark', swatch: ['#0a0710', '#9b6dff'] },
  { id: 'midnight', name: 'Midnight Blue', group: 'dark', swatch: ['#070b14', '#5b8cff'] },
  { id: 'forest', name: 'Forest', group: 'dark', swatch: ['#07100b', '#3fbf7f'] },
  { id: 'rose', name: 'Rose', group: 'dark', swatch: ['#120a0c', '#e0667f'] },
  { id: 'neon-book', name: 'Neon Book', group: 'neon', swatch: ['#09050f', '#ff3fd8'] },
  { id: 'neon-pink', name: 'Neon Pink', group: 'neon', swatch: ['#0a0410', '#ff2bd6'] },
  { id: 'neon-purple', name: 'Neon Purple', group: 'neon', swatch: ['#08030f', '#b026ff'] },
  { id: 'neon-royal', name: 'Neon Blue', group: 'neon', swatch: ['#03050f', '#1f51ff'] },
  { id: 'neon-blue', name: 'Electric Blue', group: 'neon', swatch: ['#030a10', '#00e5ff'] },
  { id: 'neon-green', name: 'Neon Green', group: 'neon', swatch: ['#040a05', '#39ff14'] },
  { id: 'neon-orange', name: 'Neon Orange', group: 'neon', swatch: ['#0f0703', '#ff7a18'] },
  { id: 'neon-synth', name: 'Synthwave', group: 'neon', swatch: ['#0d0520', '#ff2bd6'] },
] as const;
export type ThemeId = (typeof THEMES)[number]['id'];

export function savedTheme(): ThemeId {
  try {
    const id = localStorage.getItem('tj_theme');
    return THEMES.some(t => t.id === id) ? (id as ThemeId) : 'auto';
  } catch {
    return 'auto';
  }
}

/** "Match device" leaves data-theme off, so the page follows the device's light or dark setting */
export function applyTheme(id: ThemeId) {
  const root = document.documentElement;
  if (id === 'auto') delete root.dataset.theme;
  else root.dataset.theme = id;
  // The phone's status bar takes the page's background colour
  const bg = getComputedStyle(root).getPropertyValue('--bg').trim().split(' ').join(',');
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', `rgb(${bg})`);
}

export function setTheme(id: ThemeId) {
  try { localStorage.setItem('tj_theme', id); } catch { /* lasts for this visit */ }
  applyTheme(id);
}

matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => savedTheme() === 'auto' && applyTheme('auto'));
