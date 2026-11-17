# Changelog

Every version is tagged vX.Y.Z on GitHub, and every deploy is tagged deploy-<date>-<time>.

## 1.19.0 — 2026-11-16
- News on the dashboard: this week's economic calendar (ForexFactory-style — NFP, CPI, FOMC and the rest), soonest event first with a live countdown. Filter by impact and currency; defaults to High/Medium USD. Fetched server-side through a new Pages Function so the browser never hits the feed directly.

## 1.18.0 — 2026-11-13
- Mark up chart: pinch with two fingers to zoom in and drag to pan, for drawing precisely on small details. A reset-zoom button and a "% zoomed" readout appear while zoomed in.
- Lines, arrows and boxes (not freehand strokes) can now be grabbed and dragged to reposition, the same way text and the price line already could.

## 1.17.0 — 2026-11-13
- Mark up chart: a new Price line tool draws a full-width horizontal line at any level, drag it into place and drag it again later to move it.
- Text you've placed can now be grabbed and dragged to reposition it, instead of having to erase it and type it again.

## 1.16.0 — 2026-11-12
- Mark up charts: a drawing tool for chart pictures — freehand, straight lines, arrows, boxes and text, seven colours, three thicknesses, undo and erase-all. Save keeps a full-size copy with your drawing; the original stays as it was.
- On a trade: every screenshot has a Mark up button, and the trade's own chart has one too (it draws on the chart exactly as you have it zoomed, with your entries and exits on it).
- On each Journal day: a Charts section. "Mark up a chart" takes a screenshot from your phone straight into the drawing tool; "Add as is" just saves it. Kept privately with that day.

## 1.15.0 — 2026-11-11
- Progress → Year by year: the projected P&L for every year. Three new rows show each year's net if losers had been closed at that year's average winner hold, the difference from what really happened, and the cut-off time with how many losers were re-priced. A line under the table adds all years together.

## 1.14.0 — 2026-11-11
- Projected P&L on the dashboard, next to Avg hold: what your net would be if every loser had been closed at your winners' average hold time. Each loser that ran longer is re-priced from the 1-minute chart at that moment (fills up to then stand, whatever was still open is closed at the market price, fees unchanged). Shows the difference from what really happened, how many losers were re-priced and how many of those came out better. Losers already closed sooner, and ones with no chart data for that minute, keep their real result. Follows the account, date and other filters like every other card.

## 1.13.1 — 2026-11-03
- "Added to a winner" on the trade view now shows points and ticks of profit before the add, not just dollars (e.g. "up $140 (+5.6 pts, +22.4 ticks) right before adding").

## 1.13.0 — 2026-11-03
- Net edge (ticks): net P&L normalized to a 1-lot (net $ ÷ $-per-tick of that position), so differently-sized trades and instruments (MNQ vs NQ) compare directly instead of in dollars, which get distorted by how many contracts you ran. On the dashboard, and a per-trade Ticks tile next to Points in the trade view.
- Avg R-multiple on the Progress page's desk report: net P&L ÷ MAE, the standard size-independent edge measure. Scoped honestly to trades with MAE logged (NinjaTrader imports only for now), with a count of how many that is.
- "Up before adding": for trades where you added to a winner and it stayed a winner, shows how much you were up right before the add vs. where the trade finished, so you can see what adding into strength actually bought you. On the dashboard's Adding to positions report and on the individual trade view.

## 1.12.1 — 2026-10-23
- The real Gospel Trading Academy logo (background removed) in the header, on the sign-in page, and as the browser and home-screen icon.

## 1.12.0 — 2026-10-22
- Charts line up with your fills again: some NinjaTrader minute files were saved in Central time instead of Eastern (all of the laptop's, and this PC's from about 2025), which put every candle an hour early. tools/ncd.py's read_et() spots them by when volume jumps at the 9:30 Eastern open, and export_bars.py lets each day's fills decide (whichever version puts their prices inside the candles). Fills now land inside their minute's candle about 99% of the time in every year (2026 was 11%). Day types and hourly charts rebuilt.

## 1.11.1 — 2026-10-22
- Year by year shows the number of days traded under Trades.

## 1.11.0 — 2026-10-22
- Back and Next buttons in the trade view's pinned header (and the arrow keys) step through trades in the Trades page's order and filters, with "32 of 43".
- Trade charts always fit the entry and exit lines. When NinjaTrader saved only part of a day, the chart says so instead of pinning orders to the nearest candle.
- tools/export_bars.py picks the contract file that covers the most of each day's trades (often the full-size NQ for an MNQ day): trades outside their chart's data fell from 124 to 48.
- Year by year: ▲/▼ show better or worse than the year before, and dollar amounts are red when negative (a smaller drawdown was showing as a green negative number).

## 1.10.0 — 2026-10-22
- Progress tab: a verdict, every year side by side (net, win rate, average win and loss in points, payoff, win rate needed, profit factor, expectancy, Sharpe, Sortino, max drawdown, green days, worst day, hold times; green or red against the year before), a desk report (Sharpe, Sortino, profit factor, payoff, drawdown and recovery, worst 5% of days, consistency, tail losses, expectancy, Kelly) and a coach that prices each habit in dollars against the rest of your trades: losses bigger than wins, a hard-stop what-if, holding losers, adding to losers, trades right after a loss, trades after the third of the day, worst hours and weekday, trend-day fades, range days, oversized positions, longs vs shorts.
- tools/export_daytypes.py labels each traded day trend, range or mixed (public/bars/days.json) for the coach.
- Subscriptions and resets on the dashboard: each prop subscription with its resets as one line, from tj_accounts.subscription and reset_at (Take Profit Trader PRO chains and sizes saved).

## 1.9.0 — 2026-10-22
- Colour themes: a palette button in the header picks Edge (match device, dark, light), Voice Bible's dark themes (Purple Night, Midnight Blue, Forest, Rose) or its neon ones (Neon Book, Neon Pink, Neon Purple, Neon Blue, Electric Blue, Neon Green, Neon Orange, Synthwave), with a glow on neon. Remembered on each device.
- Chart tooltips on the dashboard have their border again.

## 1.8.2 — 2026-10-22
- Account 1710563 (Take Profit Trader PRO+, a live account with a number for a name) counts as funded.

## 1.8.1 — 2026-10-22
- Take Profit Trader accounts get their account type: TAKEPROFITPRO… are funded (PRO), TAKEPROFIT… are evaluations (Test). They were all under Other, so 2026 showed no funded trades.

## 1.8.0 — 2026-10-22
- Trades list: filter by instrument and size, and sort by newest, oldest, biggest win or loss, most or fewest points, largest size or longest hold.
- Dates: the range menu has each year with trades (2026, 2025, …) and "Custom dates…" with From/To. Trade dates show the year when it isn't this year.
- Charts for the laptop's 2026 trades: tools/export_bars.py and export_hourly.py take several NinjaTrader folders (this PC's and a copy of the laptop's db) and use whichever has each day.

## 1.7.2 — 2026-10-22
- The Gospel Trading logo replaces the orange "E" badge in the header and on the sign-in page.

## 1.7.1 — 2026-10-22
- Trade charts mark each order on its own (Buy, Add, Exit) instead of merging orders in the same bar into one averaged arrow, and list every order's size, price and time under the chart. The entry line says "Avg entry" when you added. Prices show to the quarter point (21,237.75 was showing as 21,237.5).

## 1.7.0 — 2026-10-22
- Zoomed-out trade charts: 1h, 4h and daily buttons beside 1m/5m/15m show the days and weeks around a trade, from hourly bars for the trade's month and the months either side (tools/export_hourly.py makes them from NinjaTrader's minute history, following the most-traded contract each day).

## 1.6.1 — 2026-10-22
- The adding-to-positions report ignores the Adds filter (it compares every kind of trade), so its month-by-month table shows the real share of trades where you averaged down. It names what it's counting (account type, account, dates).

## 1.6.0 — 2026-10-22
- Adding to positions: each trade's adds are checked against the average entry at that moment, so the journal knows when you averaged down (added while losing) and when you added to a winner that then turned into a loss. A report shows how each kind of trade did, what just the added contracts made or lost, how many of the biggest losses came from averaging down, and a month-by-month view of the habit.
- New "Adds" filter (tap a row in the report to see those trades), and a warning on each trade where you averaged down or added to a winner that turned.

## 1.5.2 — 2026-10-22
- Trading days follow the futures session: 5 pm Central the evening before to the 4 pm close, so Sunday night counts as Monday and weekends never count. Used everywhere days are counted (calendar, days traded, daily stats, the journal).
- The accounts table shows each account's number of trading days, and can sort by it.

## 1.5.1 — 2026-10-22
- Size is now dollars per tick (1 NQ = $5, 1 MNQ = $0.50), so NQ and MNQ compare fairly, plus contracts per instrument (NQ and MNQ apart) on winners and losers. The "By size" table groups by $ per tick, and a new "Contracts by instrument" table.
- The funded vs evaluation comparison uses $ per tick and NQ / MNQ contract rows, and fits a phone.

## 1.5.0 — 2026-10-22
- Account types: funded (Apex PA, Bulenox BX-M), evaluation (Apex, Bulenox) and sim. New filter for the type.
- "Funded vs evaluation vs sim": the same numbers side by side (size, hold, win rate, average win and loss, profit factor, trades and days, best and worst half hour…) and the biggest differences in plain words. Copies counted once within each type.
- The Avg day card shows how many days were traded.

## 1.4.0 — 2026-10-22
- Account sizes: the accounts table shows each account's size (50K, 300K…), guessed from the most contracts traded on it (Apex: up to 10 = 50K, 25 = 150K, 35 = 300K) until you set the real one with a tap. Saved to your account (new table tj_accounts).
- Filter the accounts table by size, and see each account's high as a % of its size.

## 1.3.1 — 2026-10-22
- "Highest / lowest P&L" card with the running total's high and low (and across all accounts when one is picked).
- The accounts high/low table moved up, right under the stat cards.

## 1.3.0 — 2026-10-22
- Accounts table: each account's highest and lowest running P&L (and the day it got there), final P&L, biggest drop from a high, trades and dates. Sort by any column.

## 1.2.1 — 2026-10-22
- With one account picked, every stat card also shows the same number across all accounts.
- Fix: with one account picked, "Count copies once" no longer hides that account's own copied trades.

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
