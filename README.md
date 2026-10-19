# Edge Journal

A private trade journal (like TraderSync) at https://journal.eefavorbooks.com. Signs in with the Social Bloom account;
trades live in the Social Bloom Supabase project (`tj_trades`, `tj_days`, bucket `tj-shots`; migration
`social-bloom-sync/supabase/migrations/20261019150000_trade_journal.sql`).

- Imports NinjaTrader 8 (Trades or Executions grid), Tradovate (Performance or Fills), Robinhood (account activity),
  thinkorswim (Account Statement) and Schwab (transactions) CSVs: `src/lib/parse.ts`. Executions become trades flat to
  flat per account and instrument: `src/lib/build.ts`. Futures point values: `src/lib/instruments.ts`.
- `npm run dev` to work on it; `./deploy.sh` builds and publishes to Cloudflare Pages (project edge-journal).
