# Changelog

Every version is tagged vX.Y.Z on GitHub, and every deploy is tagged deploy-<date>-<time>.

## 1.2.0 — 2026-10-22
- Copy trades: trades taken on several accounts with a trade copier (same instrument and direction, opened within 2 seconds) are found automatically. A new filter shows all trades, counts each copied trade once (the default), or shows only copied or only single trades. Copied trades are labeled "copied ×N". Nothing is deleted.
- More stats: average size (winners vs losers), average hold (winners vs losers), longest win and loss streaks, average day and trades per day, expectancy.
- New tables: best time of day by half hour, by hold time, by size, long vs short, and by number of trades that day, each with trades, win rate, average, profit factor and net, with the best and worst rows marked. Also P&L by account.

## 1.1.0 — 2026-10-22
- Each trade shows the chart at the time of the trade: 1, 5 or 15-minute candles from NinjaTrader's own price history, with every buy and sell marked and the entry and exit lines. Made with `tools/export_bars.py`, which reads NinjaTrader 8's minute files (`tools/ncd.py`).
- When the saved filters show no trades (old history, or an account with no trades), the journal opens on All time.

## 1.0.0 — 2026-10-19
- First version: imports from NinjaTrader 8, Tradovate, Robinhood, thinkorswim and Schwab; trades built flat to flat.
- Dashboard (stats, equity curve, P&L calendar, breakdowns by day, hour, instrument, setup, mistakes and emotion).
- Trades list with search and filters, manual entry, and each trade's setup, emotion, rating, tags, mistakes, notes and screenshots.
- Daily journal: plan, review and mood for each day.
