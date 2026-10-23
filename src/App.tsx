import { useEffect, useMemo, useState, useRef } from 'react';
import type { Session } from '@supabase/supabase-js';
import { BarChart3, BookOpen, List, LogOut, TrendingUp, Upload } from 'lucide-react';
import ThemePicker from './components/ThemePicker';
import { supabase } from './lib/supabase';
import { useJournal } from './lib/store';
import { applyFilters, COPIES, RANGES, rangeLabel, yearRanges, type Filters } from './lib/filters';
import { accountKind, KINDS } from './lib/accounts';
import { ADD_KINDS } from './lib/adds';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Trades from './pages/Trades';
import Progress from './pages/Progress';
import JournalPage from './pages/JournalPage';
import Import from './pages/Import';
import TradeDetail from './components/TradeDetail';

const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
  { id: 'progress', label: 'Progress', icon: TrendingUp },
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
  // The trades the back and forward buttons step through: the Trades page's list as sorted, else everything shown, newest first
  const [navIds, setNavIds] = useState<string[] | null>(null);
  const openFrom = (id: string, list: string[]) => { setNavIds(list); setOpenId(id); };
  const [focusDay, setFocusDay] = useState<string | null>(null);

  const shown = useMemo(() => applyFilters(j.trades || [], filters), [j.trades, filters]);
  // The same filters across every account, to compare one account with the rest
  // Every trade on each account (copies too), for each account's own running P&L
  const perAccount = useMemo(() => applyFilters(j.trades || [], { ...filters, copies: '' }), [j.trades, filters]);
  // Every account type, to compare funded with evaluation and sim trading
  // The adds report compares every kind of trade, so it ignores the Adds filter
  const anyAdds = useMemo(() => applyFilters(j.trades || [], { ...filters, adds: '' }), [j.trades, filters]);
  const everyKind = useMemo(() => applyFilters(j.trades || [], { ...filters, account: '', kind: '', copies: '' }), [j.trades, filters]);
  const kindsPresent = useMemo(() => KINDS.filter(([k]) => (j.trades || []).some(t => accountKind(t.account) === k)), [j.trades]);
  const everyAccount = useMemo(() => (filters.account ? applyFilters(j.trades || [], { ...filters, account: '' }) : null), [j.trades, filters]);
  // Opening with nothing to show (old trades, a filter left on an account with no trades): show all time instead
  const checked = useRef(false);
  useEffect(() => {
    if (!j.trades?.length || checked.current) return;
    checked.current = true;
    if (shown.length) return;
    const account = j.trades.some(t => (t.account || t.broker) === filters.account) ? filters.account : '';
    setFilters({ ...filters, account, range: applyFilters(j.trades, { ...filters, account }).length ? filters.range : 'all' });
  }, [j.trades]); // eslint-disable-line react-hooks/exhaustive-deps
  const years = useMemo(() => yearRanges(j.trades || []), [j.trades]);
  // Every date with the other filters, for the Progress page's year-by-year table
  const every = useMemo(() => applyFilters(j.trades || [], { ...filters, range: 'all' }), [j.trades, filters]);
  const scope = [filters.kind ? KINDS.find(k => k[0] === filters.kind)?.[1] : 'all account types', filters.account || (filters.kind ? '' : 'all accounts'), rangeLabel(filters).toLowerCase(), filters.side ? `${filters.side} only` : ''].filter(Boolean).join(' · ');
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
            <img src="/gospel-logo.png" alt="Gospel Trading Academy" className="w-10 h-10" />
            Edge Journal
          </button>
          <nav className="hidden md:flex gap-1 ml-4">
            {TABS.map(t => (
              <button key={t.id} onClick={() => go(t.id)} className={`btn ${tab === t.id ? 'bg-line text-ink' : 'text-mute hover:text-ink'}`}><t.icon className="w-4 h-4" />{t.label}</button>
            ))}
          </nav>
          <span className="ml-auto text-[11px] text-mute">v{__APP_VERSION__}</span>
          <ThemePicker />
          <button onClick={() => void supabase.auth.signOut()} title="Sign out" className="text-mute hover:text-ink"><LogOut className="w-4 h-4" /></button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-4 space-y-4">
        {j.error && <p className="card p-3 text-sm text-loss">{j.error}</p>}
        {(tab === 'dashboard' || tab === 'trades' || tab === 'progress') && (
          <div className="flex flex-wrap gap-2">
            <select className="field !w-auto !h-9" value={filters.range} onChange={e => setFilters({ ...filters, range: e.target.value })}>
              {RANGES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              <optgroup label="Year">{years.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</optgroup>
              <option value="custom">Custom dates…</option>
            </select>
            {filters.range === 'custom' && (
              <span className="flex items-center gap-1 text-sm text-mute">
                <input type="date" aria-label="From" className="field !w-auto !h-9" value={filters.from || ''} onChange={e => setFilters({ ...filters, from: e.target.value })} />
                to
                <input type="date" aria-label="To" className="field !w-auto !h-9" value={filters.to || ''} onChange={e => setFilters({ ...filters, to: e.target.value })} />
              </span>
            )}
            {kindsPresent.length > 1 && (
              <select className="field !w-auto !h-9" value={filters.kind || ''} onChange={e => setFilters({ ...filters, kind: e.target.value, account: '' })}>
                <option value="">All account types</option>
                {kindsPresent.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            )}
            {accounts.length > 1 && (
              <select className="field !w-auto !h-9" value={filters.account} onChange={e => setFilters({ ...filters, account: e.target.value })}>
                <option value="">All accounts</option>
                {accounts.filter(a => !filters.kind || accountKind(a) === filters.kind).map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            )}
            <select className="field !w-auto !h-9" value={filters.asset} onChange={e => setFilters({ ...filters, asset: e.target.value })}>
              <option value="">Futures & options</option><option value="future">Futures</option><option value="option">Options</option><option value="stock">Stocks</option>
            </select>
            <select className="field !w-auto !h-9" value={filters.side} onChange={e => setFilters({ ...filters, side: e.target.value })}>
              <option value="">Long & short</option><option value="long">Long</option><option value="short">Short</option>
            </select>
            <select className="field !w-auto !h-9" value={filters.adds || ''} onChange={e => setFilters({ ...filters, adds: e.target.value })}>
              <option value="">Adds: any or none</option><option value="any">Trades I added to</option>
              {ADD_KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
            {j.trades?.some(t => (t.copies || 1) > 1) && (
              <select className="field !w-auto !h-9" value={filters.copies || ''} onChange={e => setFilters({ ...filters, copies: e.target.value })}>
                {COPIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            )}
          </div>
        )}
        {j.trades === null ? <p className="text-mute text-sm">Loading…</p>
          : tab === 'progress' ? <Progress every={every} trades={shown} scope={scope} />
          : tab === 'dashboard' ? <Dashboard trades={shown} anyAdds={anyAdds} scope={scope} onAdds={k => { setFilters({ ...filters, adds: k }); go('trades'); }} everyKind={everyKind} perAccount={perAccount} accountSizes={j.sizes} subs={j.subs} onSize={(a, n) => void j.saveSize(a, n)} everyAccount={everyAccount} all={j.trades} onDay={openDay} onTrade={setOpenId} onImport={() => go('import')} />
          : tab === 'trades' ? <Trades trades={shown} j={j} onOpen={openFrom} />
          : tab === 'journal' ? <JournalPage j={j} focus={focusDay} onTrade={setOpenId} />
          : <Import j={j} onDone={() => go('trades')} />}
      </main>

      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 border-t border-line bg-bg/95 backdrop-blur grid grid-cols-5 pb-[env(safe-area-inset-bottom)]">
        {TABS.map(t => (
          <button key={t.id} onClick={() => go(t.id)} className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${tab === t.id ? 'text-edge' : 'text-mute'}`}>
            <t.icon className="w-5 h-5" />{t.label}
          </button>
        ))}
      </nav>
      {open && (() => {
        const ids = navIds?.includes(open.id) ? navIds : [...shown].sort((a, b) => b.entry_at.localeCompare(a.entry_at)).map(t => t.id);
        const pos = ids.indexOf(open.id);
        return <TradeDetail trade={open} j={j} onClose={() => { setOpenId(null); setNavIds(null); }}
          nav={pos < 0 ? undefined : { pos, count: ids.length, go: by => { const id = ids[pos + by]; if (id) setOpenId(id); } }} />;
      })()}
    </div>
  );
}
