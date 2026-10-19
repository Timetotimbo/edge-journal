export type Asset = 'future' | 'option' | 'stock';

/** One execution, from an import file. qty is + for a buy, - for a sell. */
export type Fill = {
  broker: string;
  account: string;
  symbol: string;          // what it's shown as: "NQ", "SPY 580C 10/17/26"…
  root: string;
  asset: Asset;
  option_type?: 'call' | 'put';
  strike?: number;
  expiry?: string;         // yyyy-mm-dd
  multiplier: number;
  at: Date;
  seq: number;             // file order, for executions with the same time
  qty: number;
  price: number;
  fees: number;
  cash?: number;           // the broker's own cash amount (fees included), when it gives one
  closeAll?: boolean;      // expired / assigned: closes whatever is left at this price
  mae?: number;
  mfe?: number;
};

export type Trade = {
  id: string;
  broker: string;
  account: string | null;
  symbol: string;
  root: string;
  asset: Asset;
  option_type: 'call' | 'put' | null;
  strike: number | null;
  expiry: string | null;
  side: 'long' | 'short';
  qty: number;
  entry_price: number;
  exit_price: number | null;
  entry_at: string;
  exit_at: string | null;
  multiplier: number;
  gross_pnl: number;
  fees: number;
  net_pnl: number;
  mae: number | null;
  mfe: number | null;
  fills: { at: string; qty: number; price: number }[] | null;
  setup: string | null;
  tags: string[];
  mistakes: string[];
  emotion: string | null;
  rating: number | null;
  notes: string | null;
  shots: string[];
  import_key: string | null;
};

export type NewTrade = Omit<Trade, 'id'>;

export type Day = { day: string; plan: string | null; review: string | null; mood: string | null };
