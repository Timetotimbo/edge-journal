import type { Trade } from './types';

/**
 * Adding to a position: each time a trade added in its own direction, was it red or green at that moment (the add's
 * price against the average entry so far)? Fills of one order (same direction within a second) count as one.
 * Sets on each trade: adds (how many), addRed / addGreen (adds while losing / winning), heat (the most it was down,
 * in dollars, when it added while losing), greenBefore / greenBeforePts (the most it was up, in dollars and in
 * points of price move, when it added while winning), addPnlRed / addPnlGreen (what just the added contracts made
 * or lost, to the trade's exit price).
 */
export type AddKind = 'red' | 'green-lost' | 'green' | 'none';
export const ADD_KINDS: [AddKind, string][] = [
  ['red', 'Added to a loser'], ['green-lost', 'Added to a winner, then lost'], ['green', 'Added to a winner, stayed a win'], ['none', 'No adds'],
];

export function markAdds(trades: Trade[]) {
  for (const t of trades) {
    const dir = t.side === 'long' ? 1 : -1;
    const orders: { at: number; qty: number; price: number }[] = [];
    for (const f of t.fills || []) {
      const at = Date.parse(f.at), last = orders[orders.length - 1];
      if (last && Math.sign(last.qty) === Math.sign(f.qty) && at - last.at <= 1000) {
        last.price = (last.price * Math.abs(last.qty) + f.price * Math.abs(f.qty)) / (Math.abs(last.qty) + Math.abs(f.qty));
        last.qty += f.qty;
      } else orders.push({ at, qty: f.qty, price: f.price });
    }
    let pos = 0, avg = 0, adds = 0, red = 0, green = 0, heat = 0, greenBefore = 0, greenBeforePts = 0, pnlRed = 0, pnlGreen = 0;
    const exit = t.exit_price === null ? null : Number(t.exit_price);
    for (const o of orders) {
      if (Math.sign(o.qty) === dir) {
        if (pos !== 0) {
          adds++;
          const move = (o.price - avg) * dir; // + when the position was in profit
          const made = exit === null ? 0 : (exit - o.price) * dir * Math.abs(o.qty) * Number(t.multiplier);
          if (move < 0) { red++; pnlRed += made; heat = Math.max(heat, -move * Math.abs(pos) * Number(t.multiplier)); }
          else if (move > 0) {
            green++; pnlGreen += made;
            const up = move * Math.abs(pos) * Number(t.multiplier);
            if (up > greenBefore) { greenBefore = up; greenBeforePts = move; }
          }
        }
        avg = (avg * Math.abs(pos) + o.price * Math.abs(o.qty)) / (Math.abs(pos) + Math.abs(o.qty));
        pos += o.qty;
      } else pos += o.qty;
    }
    t.adds = adds; t.addRed = red; t.addGreen = green; t.heat = heat; t.greenBefore = greenBefore; t.greenBeforePts = greenBeforePts;
    t.addPnlRed = pnlRed; t.addPnlGreen = pnlGreen;
  }
}

export const addKind = (t: Trade): AddKind => (t.addRed ? 'red' : t.addGreen ? (t.net_pnl < 0 ? 'green-lost' : 'green') : 'none');
