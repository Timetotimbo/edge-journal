import { useEffect, useMemo, useState, useRef } from 'react';
import type { Session } from '@supabase/supabase-js';
import { BarChart3, BookOpen, List, LogOut, Upload } from 'lucide-react';
import { supabase } from './lib/supabase';
import { useJournal } from './lib/store';
import { applyFilters, COPIES, RANGES, type Filters } from './lib/filters';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Trades from './pages/Trades';
import JournalPage from './pages/JournalPage';
import Import from './pages/Import';
import TradeDetail from './components/TradeDetail';

const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
  { id: 'trades', label: 'Trades', icon: List },
  { id: 'journal', label: 'Journal', icon: BookOpen },
  { id: 'import', label: 'Import', icon: Upload },
] as const;
type Tab = (typeof TABS)[number]['id'];
const tabFromHash = (): Tab => (TABS.find(t => location.hash.startsWith(`#${t.id}`))?.id || 'dashboard');

const saved = (): Filters => {
  try { return { range: 'month', account: '', asset: '', side: '', copies: 'once', ...JSON.parse(localStorage.getItem('tj_filters') || '{}') }; }
  catch { return { range: 'month', account: '', asset: '', side: '', copies: 'once' }; }
};

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);
  const j = useJournal(session?.user.id);
  const [tab, setTab] = useState<Tab>(tabFromHash);
  useEffect(() => {
    const on = () => setTab(tabFromHash());
    addEventListener('hashchange', on);
    return () => removeEventListener('hashchange', on);
  }, []);
  const go = (t: Tab) => { location.hash = t; setTab(t); scrollTo(0, 0); };
  const [filters, setFiltersState] = useState<Filters>(saved);
  const setFilters = (f: Filters) => { setFiltersState(f); try { localStorage.setItem('tj_filters', JSON.stringify(f)); } catch { /* not remembered */ } };
  const [openId, setOpenId] = useState<string | null>(null);
  const [focusDay, setFocusDay] = useState<string | null>(null);

  const shown = useMemo(() => applyFilters(j.trades || [], filters), [j.trades, filters]);
  // Opening with nothing to show (old trades, a filter left on an account with no trades): show all time instead
  const checked = useRef(false);
  useEffect(() => {
    if (!j.trades?.length || checked.current) return;
    checked.current = true;
    if (shown.length) return;
    const account = j.trades.some(t => (t.account || t.broker) === filters.account) ? filters.account : '';
    setFilters({ ...filters, account, range: applyFilters(j.trades, { ...filters, account }).length ? filters.range : 'all' });
  }, [j.trades]); // eslint-disable-line react-hooks/exhaustive-deps
  const accounts = useMemo(() => [...new Set((j.trades || []).map(t => t.account || t.broker))].sort(), [j.trades]);

  if (session === undefined) return null;
  if (!session) return <Login />;
  const open = j.trades?.find(t => t.id === openId) || null;
  const openDay = (d: string) => { setFocusDay(d); go('journal'); };

  return (
    <div className="min-h-screen pb-20 md:pb-8">
      <header className="sticky top-0 z-30 border-b border-line bg-bg/90 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-4">
          <button onClick={() => go('dashboard')} className="flex items-center gap-2 font-extrabold tracking-tight">
            <span className="w-7 h-7 rounded-lg bg-edge text-black grid place-items-center text-sm">E</span>
            Edge Journal
          </button>
          <nav className="hidden md:flex gap-1 ml-4">
            {TABS.map(t => (
              <button key={t.id} onClick={() => go(t.id)} className={`btn ${tab === t.id ? 'bg-line text-ink' : 'text-mute hover:text-ink'}`}><t.icon className="w-4 h-4" />{t.label}</button>
            ))}
          </nav>
          <span className="ml-auto text-[11px] text-mute">v{__APP_VERSION__}</span>
          <button onClick={() => void supabase.auth.signOut()} title="Sign out" className="text-mute hover:text-ink"><LogOut className="w-4 h-4" /></button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-4 space-y-4">
        {j.error && <p className="card p-3 text-sm text-loss">{j.error}</p>}
        {(tab === 'dashboard' || tab === 'trades') && (
          <div className="flex flex-wrap gap-2">
            <select className="field !w-auto !h-9" value={filters.range} onChange={e => setFilters({ ...filters, range: e.target.value })}>
              {RANGES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            {accounts.length > 1 && (
              <select className="field !w-auto !h-9" value={filters.account} onChange={e => setFilters({ ...filters, account: e.target.value })}>
                <option value="">All accounts</option>
                {accounts.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            )}
            <select className="field !w-auto !h-9" value={filters.asset} onChange={e => setFilters({ ...filters, asset: e.target.value })}>
              <option value="">Futures & options</option><option value="future">Futures</option><option value="option">Options</option><option value="stock">Stocks</option>
            </select>
            <select className="field !w-auto !h-9" value={filters.side} onChange={e => setFilters({ ...filters, side: e.target.value })}>
              <option value="">Long & short</option><option value="long">Long</option><option value="short">Short</option>
            </select>
            {j.trades?.some(t => (t.copies || 1) > 1) && (
              <select className="field !w-auto !h-9" value={filters.copies || ''} onChange={e => setFilters({ ...filters, copies: e.target.value })}>
                {COPIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            )}
          </div>
        )}
        {j.trades === null ? <p className="text-mute text-sm">Loading…</p>
          : tab === 'dashboard' ? <Dashboard trades={shown} all={j.trades} onDay={openDay} onTrade={setOpenId} onImport={() => go('import')} />
          : tab === 'trades' ? <Trades trades={shown} j={j} onOpen={setOpenId} />
          : tab === 'journal' ? <JournalPage j={j} focus={focusDay} onTrade={setOpenId} />
          : <Import j={j} onDone={() => go('trades')} />}
      </main>

      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 border-t border-line bg-bg/95 backdrop-blur grid grid-cols-4 pb-[env(safe-area-inset-bottom)]">
        {TABS.map(t => (
          <button key={t.id} onClick={() => go(t.id)} className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${tab === t.id ? 'text-edge' : 'text-mute'}`}>
            <t.icon className="w-5 h-5" />{t.label}
          </button>
        ))}
      </nav>
      {open && <TradeDetail trade={open} j={j} onClose={() => setOpenId(null)} />}
    </div>
  );
}
