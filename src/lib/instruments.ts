// Dollars per 1.00 move in price, per contract. Options are 100 shares a contract.
export const FUTURES: Record<string, { mult: number; name: string }> = {
  ES: { mult: 50, name: 'E-mini S&P 500' }, MES: { mult: 5, name: 'Micro S&P 500' },
  NQ: { mult: 20, name: 'E-mini Nasdaq-100' }, MNQ: { mult: 2, name: 'Micro Nasdaq-100' },
  YM: { mult: 5, name: 'E-mini Dow' }, MYM: { mult: 0.5, name: 'Micro Dow' },
  RTY: { mult: 50, name: 'E-mini Russell 2000' }, M2K: { mult: 5, name: 'Micro Russell 2000' },
  EMD: { mult: 100, name: 'E-mini MidCap' }, NKD: { mult: 5, name: 'Nikkei' },
  CL: { mult: 1000, name: 'Crude Oil' }, MCL: { mult: 100, name: 'Micro Crude' }, QM: { mult: 500, name: 'E-mini Crude' },
  NG: { mult: 10000, name: 'Natural Gas' }, QG: { mult: 2500, name: 'E-mini Natural Gas' },
  GC: { mult: 100, name: 'Gold' }, MGC: { mult: 10, name: 'Micro Gold' },
  SI: { mult: 5000, name: 'Silver' }, SIL: { mult: 1000, name: 'Micro Silver' }, HG: { mult: 25000, name: 'Copper' },
  '6E': { mult: 125000, name: 'Euro FX' }, M6E: { mult: 12500, name: 'Micro Euro' }, '6B': { mult: 62500, name: 'British Pound' },
  '6J': { mult: 12500000, name: 'Japanese Yen' }, '6A': { mult: 100000, name: 'Australian Dollar' }, '6C': { mult: 100000, name: 'Canadian Dollar' },
  ZB: { mult: 1000, name: '30-Year Bond' }, UB: { mult: 1000, name: 'Ultra Bond' }, ZN: { mult: 1000, name: '10-Year Note' },
  ZF: { mult: 1000, name: '5-Year Note' }, ZT: { mult: 2000, name: '2-Year Note' },
  ZC: { mult: 50, name: 'Corn' }, ZS: { mult: 50, name: 'Soybeans' }, ZW: { mult: 50, name: 'Wheat' },
  BTC: { mult: 5, name: 'Bitcoin' }, MBT: { mult: 0.1, name: 'Micro Bitcoin' }, ETH: { mult: 50, name: 'Ether' }, MET: { mult: 0.1, name: 'Micro Ether' },
};

/** "NQ 12-26" (NinjaTrader), "NQZ6" (Tradovate), "/NQZ26" or "/NQZ26:XCME" (thinkorswim) -> "NQ" */
export function futuresRoot(symbol: string): string {
  const s = symbol.trim().toUpperCase().replace(/^\//, '').split(/[:\s]/)[0];
  if (FUTURES[s]) return s;
  const m = s.match(/^([A-Z0-9]+?)[FGHJKMNQUVXZ]\d{1,2}$/);
  return m ? m[1] : s;
}

export const isFuture = (symbol: string) => !!FUTURES[futuresRoot(symbol)];
export const futuresMult = (root: string) => FUTURES[root]?.mult;

// Smallest price move per instrument (futures); options and stocks move in cents
export const TICKS: Record<string, number> = {
  ES: 0.25, MES: 0.25, NQ: 0.25, MNQ: 0.25, YM: 1, MYM: 1, RTY: 0.1, M2K: 0.1, EMD: 0.1, NKD: 5,
  CL: 0.01, MCL: 0.01, QM: 0.025, NG: 0.001, QG: 0.005, GC: 0.1, MGC: 0.1, SI: 0.005, SIL: 0.005, HG: 0.0005,
  '6E': 0.00005, M6E: 0.0001, '6B': 0.0001, '6J': 0.0000005, '6A': 0.00005, '6C': 0.00005,
  ZB: 1 / 32, UB: 1 / 32, ZN: 1 / 64, ZF: 1 / 128, ZT: 1 / 256, ZC: 0.25, ZS: 0.25, ZW: 0.25, BTC: 5, MBT: 5, ETH: 0.5, MET: 0.5,
};
/** Dollars per tick for the whole position: 1 NQ = $5, 1 MNQ = $0.50, 1 ES = $12.50 */
export const tickDollars = (t: { root: string; asset: string; qty: number | string; multiplier: number | string }) =>
  Number(t.qty) * Number(t.multiplier) * (t.asset === 'future' ? TICKS[t.root] ?? 0.01 : 0.01);

/** Smallest price move for one contract (futures) or 1¢ for stocks/options */
export const tickSize = (t: { root: string; asset: string }) => (t.asset === 'future' ? TICKS[t.root] ?? 0.01 : 0.01);

/**
 * Net result in ticks, normalized to a 1-lot: net P&L ÷ what a tick was worth on that position.
 * Lets differently-sized trades on the same underlying compare directly — 1 NQ and 10 MNQ are the
 * same $5/tick, so a $50 trade on either reads as 10 ticks.
 */
export const ticksCaptured = (t: { net_pnl: number | string; root: string; asset: string; qty: number | string; multiplier: number | string }) => {
  const d = tickDollars(t);
  return d ? Number(t.net_pnl) / d : 0;
};
