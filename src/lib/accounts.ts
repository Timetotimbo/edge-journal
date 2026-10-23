import type { Trade } from './types';

/** Account sizes to pick from */
export const SIZES = [25000, 50000, 75000, 100000, 150000, 250000, 300000];
export const sizeLabel = (n: number) => (n >= 1000 ? `${n / 1000}K` : String(n));

// Most full-size contracts each prop firm allows by account size (micros count as a tenth). Apex 50K 10, 150K up to 25 and
// 300K 35, from the user.
const LIMITS: Record<string, [number, number][]> = {
  apex: [[25000, 4], [50000, 10], [75000, 12], [100000, 14], [150000, 25], [250000, 27], [300000, 35]],
  bulenox: [[25000, 3], [50000, 7], [100000, 12], [150000, 15], [250000, 25]],
};
const MICRO = /^(MNQ|MES|MYM|M2K|MGC|MCL|SIL|M6E|MBT|MET)$/;

/** Biggest position held at once on a trade, in full-size contracts */
function maxPosition(t: Trade) {
  let pos = 0, max = 0;
  for (const f of t.fills || [{ qty: Number(t.qty) }]) { pos += f.qty; max = Math.max(max, Math.abs(pos)); }
  return max * (MICRO.test(t.root) ? 0.1 : 1);
}

/**
 * The smallest size this prop account could be, from the biggest position traded on it (the firm wouldn't have allowed
 * more). A guess: an account may have traded smaller than its limit. Null for accounts that aren't Apex or Bulenox.
 */
export function estimateSize(account: string, trades: Trade[]): number | null {
  const firm = /apex/i.test(account) ? 'apex' : /^BX|bulenox/i.test(account) ? 'bulenox' : '';
  if (!firm) return null;
  const most = Math.max(0, ...trades.map(maxPosition));
  const fit = LIMITS[firm].find(([, n]) => most <= n + 1e-9);
  return fit ? fit[0] : LIMITS[firm][LIMITS[firm].length - 1][0];
}

/** Funded (Apex PA-, Bulenox BX-M…, Take Profit Trader PRO), evaluation (Apex APEX-, Bulenox BX…, Take Profit Trader Test), sim (Sim…, Playback) or other */
export type AccountKind = 'funded' | 'eval' | 'sim' | 'other';
export const KINDS: [AccountKind, string][] = [['funded', 'Funded (PA / Bulenox M / TPT PRO)'], ['eval', 'Evaluation'], ['sim', 'Sim'], ['other', 'Other']];
export function accountKind(account: string | null): AccountKind {
  const a = (account || '').toUpperCase();
  if (/^PA-APEX/.test(a) || /^BX-M/.test(a) || /^TAKEPROFITPRO/.test(a)) return 'funded';
  if (/^APEX-/.test(a) || /^BX\d/.test(a) || /^TAKEPROFIT\d/.test(a)) return 'eval';
  if (/^SIM|PLAYBACK|BACKTEST/.test(a)) return 'sim';
  return 'other';
}
