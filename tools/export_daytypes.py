#!/usr/bin/env python3
"""Labels each traded day trend, range or mixed for the Progress page's coaching, from the 1-minute charts in public/bars.

Usage: python3 tools/export_daytypes.py   (after export_bars.py)
Writes public/bars/days.json: {"NQ": {"2026-02-09": ["trend", 1, 412.5], ...}, ...} = [type, direction of the day
(1 up, -1 down), regular-hours range in points]. Regular hours are 9:30-16:00 Eastern; the day "travelled" |close - open|
of its high-low range: 60% or more is a trend day, under 30% a range day, anything between is mixed.
"""
import datetime, glob, json, os
from zoneinfo import ZoneInfo

ET = ZoneInfo('America/New_York')
OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'bars')


def main():
    days = {}
    for p in sorted(glob.glob(f'{OUT}/*/????-??-??.json')):
        root, d = p.split(os.sep)[-2], os.path.basename(p)[:10]
        rth = [b for b in json.load(open(p))['bars'] if 570 <= (lambda t: t.hour * 60 + t.minute)(datetime.datetime.fromtimestamp(b[0], ET)) < 960]
        if len(rth) < 100:
            continue
        o, c = rth[0][1], rth[-1][4]
        h, l = max(b[2] for b in rth), min(b[3] for b in rth)
        eff = abs(c - o) / (h - l) if h > l else 0
        days.setdefault(root, {})[d] = ['trend' if eff >= 0.6 else 'range' if eff < 0.3 else 'mixed', 1 if c >= o else -1, round(h - l, 2)]
    json.dump(days, open(f'{OUT}/days.json', 'w'), separators=(',', ':'))
    print(sum(len(v) for v in days.values()), 'days labelled in public/bars/days.json')


if __name__ == '__main__':
    main()
