#!/usr/bin/env python3
"""Exports hourly charts for the zoomed-out trade charts (1h, 4h, daily), from NinjaTrader 8's 1-minute price history.

Usage: python3 tools/export_hourly.py "<NinjaTrader 8 folder>" [more NT8 folders ...]
Run after export_bars.py. For every instrument and month with a traded day in public/bars, plus the month before it,
writes public/bars/<ROOT>/h/<yyyy-mm>.json:
  {"tick": 0.25, "bars": [[unix seconds the hour opened, open, high, low, close, volume], ...]}
Each day uses whichever contract month traded the most that day, so the chart follows the rollover.
"""
import datetime, glob, json, os, sys
sys.path.insert(0, os.path.dirname(__file__))
import ncd

FULL = {'MNQ': 'NQ', 'MES': 'ES', 'MYM': 'YM', 'M2K': 'RTY', 'MGC': 'GC', 'MCL': 'CL'}
OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'bars')


def months_for(root):
    """The traded months of this instrument and the month before each"""
    out = set()
    for p in glob.glob(f'{OUT}/{root}/*.json'):
        d = datetime.date.fromisoformat(os.path.basename(p)[:10])
        out.add((d.year, d.month))
        out.add((d.year - 1, 12) if d.month == 1 else (d.year, d.month - 1))
    return sorted(out)


def day_bars(nts, root, d):
    """The most-traded contract's minute bars on this Eastern date (the micro's own, else the full-size contract's), from any of the folders"""
    for name in (root, FULL.get(root)):
        best = []
        for p in [p for nt in nts for p in glob.glob(f'{glob.escape(nt)}/db/minute/{name} *-*/{d:%Y%m%d}.Last.ncd')] if name else []:
            try:
                bars = ncd.read_et(p)
            except (KeyError, IndexError):
                continue
            if sum(b[5] for b in bars) > sum(b[5] for b in best):
                best = bars
        if best:
            return best
    return []


def main():
    nts = sys.argv[1:]
    for root in sorted(r for r in os.listdir(OUT) if os.path.isdir(f'{OUT}/{r}')):
        tick = json.load(open(next(iter(glob.glob(f'{OUT}/{root}/*.json'))))).get('tick') or 0.25
        for y, m in months_for(root):
            hours = {}
            d = datetime.date(y, m, 1)
            while d.month == m:
                for t, o, h, l, c, v in day_bars(nts, root, d):
                    k = int((t - datetime.timedelta(minutes=1)).timestamp()) // 3600 * 3600
                    b = hours.get(k)
                    if not b:
                        hours[k] = [k, o, h, l, c, v]
                    else:
                        b[2], b[3], b[4], b[5] = max(b[2], h), min(b[3], l), c, b[5] + v
                d += datetime.timedelta(days=1)
            if not hours:
                continue
            os.makedirs(f'{OUT}/{root}/h', exist_ok=True)
            rows = [[b[0], *[round(x, 6) for x in b[1:5]], b[5]] for b in sorted(hours.values())]
            json.dump({'tick': tick, 'bars': rows}, open(f'{OUT}/{root}/h/{y}-{m:02d}.json', 'w'), separators=(',', ':'))
            print(f'{root} {y}-{m:02d}: {len(rows)} hours')


if __name__ == '__main__':
    main()
