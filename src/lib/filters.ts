import type { Trade } from './types';
import { accountKind } from './accounts';
import { addKind } from './adds';

export type Filters = { range: string; account: string; asset: string; side: string; copies?: string; kind?: string; adds?: string };
// Trades taken on several accounts with a trade copier: all of them, each idea once, or only copied / only single trades
export const COPIES: [string, string][] = [['', 'All trades'], ['once', 'Count copies once'], ['copied', 'Only copied trades'], ['solo', 'Not copied']];
export const RANGES: [string, string][] = [['week', 'This week'], ['month', 'This month'], ['30', 'Last 30 days'], ['90', 'Last 90 days'], ['year', 'This year'], ['all', 'All time']];

function startOf(range: string): number {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (range === 'week') return today.getTime() - ((today.getDay() + 6) % 7) * 864e5; // Monday
  if (range === 'month') return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  if (range === 'year') return new Date(now.getFullYear(), 0, 1).getTime();
  if (/^\d+$/.test(range)) return today.getTime() - (+range - 1) * 864e5;
  return 0;
}

export function applyFilters(trades: Trade[], f: Filters) {
  const from = startOf(f.range);
  return trades.filter(t =>
    new Date(t.entry_at).getTime() >= from &&
    (!f.account || (t.account || t.broker) === f.account) &&
    (!f.kind || accountKind(t.account) === f.kind) &&
    (!f.adds || (f.adds === 'any' ? !!t.adds : addKind(t) === f.adds)) &&
    (!f.asset || t.asset === f.asset) &&
    (!f.side || t.side === f.side) &&
    // One account: all of its own trades ("once" picks one copy per group, which may be on another account)
    (!f.copies || (f.copies === 'once' ? !!f.account || t.lead !== false : f.copies === 'copied' ? (t.copies || 1) > 1 : (t.copies || 1) === 1)));
}
