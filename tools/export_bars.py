#!/usr/bin/env python3
"""Exports 1-minute charts for the days you traded, from NinjaTrader 8's own price history, for the trade charts.

Usage: python3 tools/export_bars.py "<NinjaTrader 8 folder>" executions.csv [more.csv ...]
The CSVs are NinjaTrader executions (Instrument, Time, ...) like the ones imported into the journal. For each instrument
and US Eastern date in them, writes public/bars/<ROOT>/<yyyy-mm-dd>.json:
  {"contract": "NQ 09-23", "tick": 0.25, "bars": [[unix seconds the bar opened, open, high, low, close, volume], ...]}
from the contract traded most that day (or the full-size contract's chart for a micro, when the micro has none).
"""
import collections, csv, datetime, json, os, sys
sys.path.insert(0, os.path.dirname(__file__))
import ncd
from zoneinfo import ZoneInfo

CT = ZoneInfo('America/Chicago')  # the CSVs' times

FULL = {'MNQ': 'NQ', 'MES': 'ES', 'MYM': 'YM', 'M2K': 'RTY', 'MGC': 'GC', 'MCL': 'CL'}
OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'bars')


def main():
    nt, files = sys.argv[1], sys.argv[2:]
    traded = collections.defaultdict(collections.Counter)  # (root, date) -> contract months traded
    for path in files:
        for r in csv.DictReader(open(path)):
            root, month = r['Instrument'].split()
            local = datetime.datetime.strptime(r['Time'], '%m/%d/%Y %I:%M:%S %p').replace(tzinfo=CT)
            d = local.astimezone(ncd.ET).date()  # the chart files are by Eastern date, like NinjaTrader's
            traded[(root, d)][month] += 1
    done = missing = 0
    for (root, d), months in sorted(traded.items()):
        bars = None
        for month, _ in months.most_common():
            for name in (root, FULL.get(root)):
                p = f'{nt}/db/minute/{name} {month}/{d:%Y%m%d}.Last.ncd' if name else ''
                if p and os.path.exists(p):
                    try:
                        bars, contract, tick = ncd.read(p), f'{name} {month}', None
                    except (KeyError, IndexError):
                        continue
                    break
            if bars:
                break
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
