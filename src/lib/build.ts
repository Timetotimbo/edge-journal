import type { Fill, NewTrade } from './types';

const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d;
const EPS = 1e-9;

/**
 * Executions -> trades, flat to flat on each account + instrument (like TraderSync): adding to a position or scaling
 * out stays one trade; going through zero closes it and opens the next. A position still open at the end of the file
 * isn't a trade yet (it's counted in `open`).
 */
export function buildTrades(fills: Fill[]): { trades: NewTrade[]; open: number } {
  const groups = new Map<string, Fill[]>();
  for (const f of fills) {
    const k = `${f.broker}|${f.account}|${f.symbol}`;
    (groups.get(k) || groups.set(k, []).get(k)!).push(f);
  }
  const trades: NewTrade[] = [];
  let open = 0;
  for (const list of groups.values()) {
    list.sort((a, b) => a.at.getTime() - b.at.getTime() || a.seq - b.seq);
    let pos = 0;
    let cur: Fill[] = [];
    const close = () => {
      trades.push(toTrade(cur));
      cur = [];
    };
    for (const raw of list) {
      let f = raw;
      if (f.closeAll) {
        if (Math.abs(pos) < EPS) continue; // nothing left to expire
        f = { ...f, qty: -pos };
      }
      if (Math.abs(pos) < EPS) { cur = [f]; pos = f.qty; continue; }
      const next = pos + f.qty;
      if (Math.sign(next) === -Math.sign(pos) && Math.abs(next) > EPS) {
        // Through zero: the part that flattens closes this trade, the rest opens the next one
        const part = -pos / f.qty;
        cur.push(split(f, part));
        close();
        const rest = split(f, 1 - part);
        cur = [rest];
        pos = rest.qty;
        continue;
      }
      cur.push(f);
      pos = next;
      if (Math.abs(pos) < EPS) { pos = 0; close(); }
    }
    if (cur.length && Math.abs(pos) > EPS) open++;
  }
  trades.sort((a, b) => a.entry_at.localeCompare(b.entry_at));
  return { trades, open };
}

function split(f: Fill, part: number): Fill {
  return { ...f, qty: f.qty * part, fees: f.fees * part, cash: f.cash === undefined ? undefined : f.cash * part, mae: undefined, mfe: undefined };
}

function toTrade(fs: Fill[]): NewTrade {
  const first = fs[0];
  const dir = Math.sign(first.qty);
  const opening = fs.filter(f => Math.sign(f.qty) === dir);
  const closing = fs.filter(f => Math.sign(f.qty) !== dir);
  const qty = opening.reduce((s, f) => s + Math.abs(f.qty), 0);
  const avg = (xs: Fill[]) => xs.reduce((s, f) => s + Math.abs(f.qty) * f.price, 0) / Math.max(EPS, xs.reduce((s, f) => s + Math.abs(f.qty), 0));
  const gross = fs.reduce((s, f) => s - f.qty * f.price * f.multiplier, 0);
  let fees = fs.reduce((s, f) => s + f.fees, 0);
  let net = gross - fees;
  // The broker's cash amounts are the real result (its fees included)
  if (fs.every(f => f.cash !== undefined)) {
    net = fs.reduce((s, f) => s + (f.cash as number), 0);
    fees = Math.max(0, gross - net);
  }
  const last = fs[fs.length - 1];
  const mae = fs.some(f => f.mae !== undefined) ? fs.reduce((s, f) => s + (f.mae || 0), 0) : null;
  const mfe = fs.some(f => f.mfe !== undefined) ? fs.reduce((s, f) => s + (f.mfe || 0), 0) : null;
  const entryAt = first.at.toISOString();
  return {
    broker: first.broker, account: first.account || null, symbol: first.symbol, root: first.root, asset: first.asset,
    option_type: first.option_type ?? null, strike: first.strike ?? null, expiry: first.expiry ?? null,
    side: dir > 0 ? 'long' : 'short', qty: round(qty, 4),
    entry_price: round(avg(opening), 6), exit_price: closing.length ? round(avg(closing), 6) : null,
    entry_at: entryAt, exit_at: last.at.toISOString(), multiplier: first.multiplier,
    gross_pnl: round(gross), fees: round(fees), net_pnl: round(net), mae: mae === null ? null : round(mae), mfe: mfe === null ? null : round(mfe),
    fills: fs.map(f => ({ at: f.at.toISOString(), qty: round(f.qty, 4), price: f.price })),
    setup: null, tags: [], mistakes: [], emotion: null, rating: null, notes: null, shots: [],
    import_key: `${first.broker}|${first.account}|${first.symbol}|${entryAt}|${round(qty, 4)}`,
  };
}
