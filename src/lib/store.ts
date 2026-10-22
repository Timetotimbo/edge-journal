import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';
import type { Day, NewTrade, Trade } from './types';
import { markCopies } from './copies';

/** Every trade and day note, loaded once and kept in step with edits. */
export function useJournal(userId: string | undefined) {
  const [trades, setTrades] = useState<Trade[] | null>(null);
  const [days, setDays] = useState<Record<string, Day>>({});
  // Sizes the user set on their accounts (50K, 300K…)
  const [sizes, setSizes] = useState<Record<string, number>>({});
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!userId) return;
    const all: Trade[] = [];
    // A page at a time (the server sends up to 1000 rows per request)
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase.from('tj_trades').select('*').order('entry_at', { ascending: false }).range(from, from + 999);
      if (error) { setError(error.message); return; }
      all.push(...(data as Trade[]));
      if (!data || data.length < 1000) break;
    }
    markCopies(all);
    setTrades(all);
    const { data: d } = await supabase.from('tj_days').select('day, plan, review, mood');
    setDays(Object.fromEntries((d || []).map((x: Day) => [x.day, x])));
    const { data: a } = await supabase.from('tj_accounts').select('account, size');
    setSizes(Object.fromEntries((a || []).filter((x: { size: number | null }) => x.size).map((x: { account: string; size: number }) => [x.account, Number(x.size)])));
  }, [userId]);
  useEffect(() => { void load(); }, [load]);

  const saveTrade = async (id: string, patch: Partial<Trade>) => {
    setTrades(ts => ts && ts.map(t => (t.id === id ? { ...t, ...patch } : t)));
    const { error } = await supabase.from('tj_trades').update(patch).eq('id', id);
    if (error) throw new Error(error.message);
  };
  const deleteTrades = async (ids: string[]) => {
    const { error } = await supabase.from('tj_trades').delete().in('id', ids);
    if (error) throw new Error(error.message);
    setTrades(ts => ts && ts.filter(t => !ids.includes(t.id)));
  };
  /** New trades; ones already imported (same import key) are skipped. Returns how many were added. */
  const addTrades = async (rows: NewTrade[]) => {
    let added = 0;
    for (let i = 0; i < rows.length; i += 500) {
      const { data, error } = await supabase.from('tj_trades').upsert(rows.slice(i, i + 500), { onConflict: 'user_id,import_key', ignoreDuplicates: true }).select('id');
      if (error) throw new Error(error.message);
      added += data?.length || 0;
    }
    await load();
    return added;
  };
  const saveDay = async (day: string, patch: Partial<Day>) => {
    const next: Day = { ...{ plan: null, review: null, mood: null }, ...days[day], ...patch, day };
    setDays(ds => ({ ...ds, [day]: next }));
    const { error } = await supabase.from('tj_days').upsert({ ...next, updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
  };

  const saveSize = async (account: string, size: number | null) => {
    setSizes(s => { const n = { ...s }; if (size) n[account] = size; else delete n[account]; return n; });
    const { error } = await supabase.from('tj_accounts').upsert({ account, size, updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
  };

  return { trades, days, sizes, error, reload: load, saveTrade, deleteTrades, addTrades, saveDay, saveSize };
}
export type Journal = ReturnType<typeof useJournal>;
