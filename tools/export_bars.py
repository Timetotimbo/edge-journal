#!/usr/bin/env python3
"""Exports 1-minute charts for the days you traded, from NinjaTrader 8's own price history, for the trade charts.

Usage: python3 tools/export_bars.py "<NinjaTrader 8 folder>" [more NT8 folders ...] executions.csv [more.csv ...]
Folders are NinjaTrader 8 folders (this PC's, a copy of the laptop's db); for each day the first folder with a chart wins.
The CSVs are NinjaTrader executions (Instrument, Time, ...) like the ones imported into the journal. For each instrument
and US Eastern date in them, writes public/bars/<ROOT>/<yyyy-mm-dd>.json:
  {"contract": "NQ 09-23", "tick": 0.25, "bars": [[unix seconds the bar opened, open, high, low, close, volume], ...]}
from whichever contract file (the traded months, the micro's own or its full-size contract's, in any folder) covers the
most of that day's trade times, then the most bars; NinjaTrader sometimes saved only part of a day.
"""
import collections, csv, datetime, json, os, sys
sys.path.insert(0, os.path.dirname(__file__))
import ncd
from zoneinfo import ZoneInfo

CT = ZoneInfo('America/Chicago')  # the CSVs' times

FULL = {'MNQ': 'NQ', 'MES': 'ES', 'MYM': 'YM', 'M2K': 'RTY', 'MGC': 'GC', 'MCL': 'CL'}
OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'bars')


def main():
    nts = [a for a in sys.argv[1:] if os.path.isdir(a)]
    files = [a for a in sys.argv[1:] if not os.path.isdir(a)]
    traded = collections.defaultdict(collections.Counter)  # (root, date) -> contract months traded
    times = collections.defaultdict(list)  # (root, date) -> when each fill happened
    for path in files:
        for r in csv.DictReader(open(path)):
            root, month = r['Instrument'].split()
            local = datetime.datetime.strptime(r['Time'], '%m/%d/%Y %I:%M:%S %p').replace(tzinfo=CT)
            d = local.astimezone(ncd.ET).date()  # the chart files are by Eastern date, like NinjaTrader's
            traded[(root, d)][month] += 1
            times[(root, d)].append(local)
    done = missing = 0
    for (root, d), months in sorted(traded.items()):
        best, score = None, None
        for month, _ in months.most_common():
            for nt, name in ((nt, name) for name in (root, FULL.get(root)) for nt in nts):
                p = f'{nt}/db/minute/{name} {month}/{d:%Y%m%d}.Last.ncd' if name else ''
                if not (p and os.path.exists(p)):
                    continue
                try:
                    b = ncd.read(p)
                except (KeyError, IndexError):
                    continue
                if not b:
                    continue
                lo, hi = b[0][0] - datetime.timedelta(minutes=2), b[-1][0] + datetime.timedelta(minutes=1)
                sc = (sum(lo <= t <= hi for t in times[(root, d)]), len(b))
                if score is None or sc > score:
                    best, score = (b, f'{name} {month}'), sc
        bars, contract = best if best else (None, None)
        if not bars:
            missing += 1
            continue
        tick = min((abs(b - a) for a, b in zip([x[4] for x in bars], [x[4] for x in bars[1:]]) if b != a), default=0.25)
        rows = [[int((b[0] - datetime.timedelta(minutes=1)).timestamp()), *[round(x, 6) for x in b[1:5]], b[5]] for b in bars]
        os.makedirs(f'{OUT}/{root}', exist_ok=True)
        json.dump({'contract': contract, 'tick': tick, 'bars': rows}, open(f'{OUT}/{root}/{d.isoformat()}.json', 'w'), separators=(',', ':'))
        done += 1
    print(f'{done} days written to public/bars, {missing} days without chart data')


if __name__ == '__main__':
    main()
