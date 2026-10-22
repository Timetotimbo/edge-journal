import type { Trade } from './types';

/** How far apart copies of one trade can open on different accounts (a trade copier fills them within a second or two) */
const WINDOW_MS = 2000;

/**
 * Finds trades made with a trade copier: the same instrument and direction opened within 2 seconds on other accounts.
 * Each trade gets `copies` (how many accounts took it, 1 when it wasn't copied) and `lead` (true for one trade per copied
 * group, the first to open, so "count copies once" keeps one of each).
 */
export function markCopies(trades: Trade[]) {
  const sorted = [...trades].sort((a, b) => a.entry_at.localeCompare(b.entry_at) || (a.account || '').localeCompare(b.account || ''));
  const open = new Map<string, { start: number; members: Trade[] }>();
  const groups: Trade[][] = [];
  for (const t of sorted) {
    const k = `${t.root}|${t.side}`, at = Date.parse(t.entry_at);
    const g = open.get(k);
    if (g && at - g.start <= WINDOW_MS && !g.members.some(m => m.account === t.account)) { g.members.push(t); continue; }
    const fresh = { start: at, members: [t] };
    open.set(k, fresh);
    groups.push(fresh.members);
  }
  for (const g of groups) g.forEach((t, i) => { t.copies = g.length; t.lead = i === 0; });
}
