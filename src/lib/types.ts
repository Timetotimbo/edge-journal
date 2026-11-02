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
  /** Worked out when loaded (lib/copies.ts), not stored: accounts that took this trade with a copier, and the one counted */
  copies?: number;
  lead?: boolean;
  copyGroup?: number;
  /** Worked out when loaded (lib/adds.ts): adds in the trade's direction, while red / green, and the most it was down when adding */
  adds?: number;
  addRed?: number;
  addGreen?: number;
  heat?: number;
  addPnlRed?: number;
  addPnlGreen?: number;
};

export type NewTrade = Omit<Trade, 'id'>;

export type Day = { day: string; plan: string | null; review: string | null; mood: string | null };

/** Study tab: one saved piece of study material (a transcript chunk, a screenshot, a clip, a voice note). Every chunk of one upload shares batch_id. */
export type StudyKind = 'mentor' | 'own';
export type StudyMedia = 'text' | 'screenshot' | 'video' | 'audio';
export type StudyItem = {
  id: string;
  batch_id: string;
  created_at: string;
  kind: StudyKind;
  media_type: StudyMedia;
  label: string;
  source_url: string | null;
  day: string | null;
  media_path: string | null;
  content: string;
  chunk_index: number;
  start_sec: number | null;
  end_sec: number | null;
  saved: boolean;
};
export type StudySource = { id: string; batchId: string; kind: StudyKind; mediaType: StudyMedia; label: string; sourceUrl: string | null; day: string | null; mediaPath: string | null; startSec: number | null; endSec: number | null; saved: boolean; snippet: string };
