"""Reads NinjaTrader 8 minute bar files: db/minute/<instrument>/<yyyymmdd>.Last.ncd

Worked out from the files themselves and checked against real fills (95% of fills land inside their bar, nearly all
the rest within 1-2 ticks).

Header: int32 version, double tick size, double base price, int64 first bar time (.NET ticks, US Eastern clock time).
Then one record per bar:
  byte 1: bits 0-1 size of the minutes since the last bar (none = 1 minute; 0 for the first bar),
          bits 2-3 size of the open's change from the last bar's open (signed),
          bits 4-7 volume size: 0x2 1 byte, 0xa 2 bytes, 0xc 4 bytes, 0x4 1 byte x 100
  byte 2: which price fields follow (bits 0-1, 4-5, 6-7; bits 2-3 unused), stored in the order bits 4-5, 6-7, 0-1:
          bits 4-5 high above the body, bits 6-7 open minus low, bits 0-1 close minus low. A missing field is 0.
  fields: big-endian; sizes 1, 2 or 4 bytes for codes 1, 2, 3. Prices are in ticks.
A bar's time is when it closed.
"""
import datetime
import struct
from zoneinfo import ZoneInfo

ET = ZoneInfo('America/New_York')
SZ = {0: 0, 1: 1, 2: 2, 3: 4}
VOL = {0x2: (1, 1), 0xa: (2, 1), 0xc: (4, 1), 0x4: (1, 100)}  # volume code -> (bytes, multiplier)


def read(path):
    """[(close time as an aware datetime, open, high, low, close, volume)]"""
    f = open(path, 'rb').read()
    _, tick, base, t0 = struct.unpack('<iddq', f[:28])
    t = datetime.datetime(1, 1, 1) + datetime.timedelta(microseconds=t0 // 10)
    o = round(base / tick)
    i, bars = 28, []

    def take(code, signed=False):
        nonlocal i
        n = SZ[code]
        v = int.from_bytes(f[i:i + n], 'big')
        i += n
        return v - (1 << (8 * n - 1)) if signed and n else v

    while i < len(f):
        b1, b2 = f[i], f[i + 1]
        i += 2
        if bars or b1 & 3:
            t += datetime.timedelta(minutes=take(b1 & 3) if b1 & 3 else 1)
        o += take((b1 >> 2) & 3, True)
        upper = take((b2 >> 4) & 3)
        below = take((b2 >> 6) & 3)
        close_up = take(b2 & 3)
        take((b2 >> 2) & 3)
        n, mult = VOL[b1 >> 4]
        v = int.from_bytes(f[i:i + n], 'big') * mult
        i += n
        low = o - below
        close = low + close_up
        high = max(o, close) + upper
        bars.append((t.replace(tzinfo=ET), o * tick, high * tick, low * tick, close * tick, v))
    return bars
