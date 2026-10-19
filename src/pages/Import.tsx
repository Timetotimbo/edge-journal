import { useMemo, useState } from 'react';
import { FileUp } from 'lucide-react';
import type { Journal } from '../lib/store';
import type { NewTrade } from '../lib/types';
import { parseFile } from '../lib/parse';
import { buildTrades } from '../lib/build';
import { money, pnlClass } from '../lib/stats';

type Preview = { name: string; format: string; trades: NewTrade[]; open: number; warnings: string[] } | { name: string; error: string };

const HOW: [string, string[]][] = [
  ['NinjaTrader 8', [
    'Control Center → New → Trade Performance.',
    'Pick your account(s) and dates, then tap Generate.',
    'Open the Trades tab (or Executions), right-click the grid → Export… → save as CSV.',
    'Upload that file here. Trades include MAE/MFE and commissions.',
  ]],
  ['Tradovate', ['Reports → Performance (or Orders → Fills) → pick dates → Download CSV.', 'The Performance report leaves out commissions.']],
  ['Robinhood', ['Account → Reports and statements → Reports → Generate a report (Account activity, CSV).', 'Robinhood emails it; upload the CSV here. It has dates but no times.']],
  ['thinkorswim', ['Monitor → Account Statement → pick dates → the menu (☰) at top right → Export to File.', 'The journal reads its “Account Trade History” section.']],
  ['Schwab (website)', ['Accounts → History → Transactions → Export → CSV.']],
];

export default function Import({ j, onDone }: { j: Journal; onDone: () => void }) {
  const [files, setFiles] = useState<Preview[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [over, setOver] = useState(false);
  const have = useMemo(() => new Set((j.trades || []).map(t => t.import_key)), [j.trades]);

  const read = async (list: FileList | File[]) => {
    setMsg('');
    const out: Preview[] = [];
    for (const f of Array.from(list)) {
      try {
        const p = parseFile(await f.text(), f.name);
        const { trades, open } = buildTrades(p.fills);
        out.push({ name: f.name, format: p.format, trades, open, warnings: p.warnings });
      } catch (e) {
        out.push({ name: f.name, error: e instanceof Error ? e.message : String(e) });
      }
    }
    setFiles(out);
  };
  const ready = files.flatMap(f => ('trades' in f ? f.trades : []));
  const fresh = ready.filter(t => !have.has(t.import_key));
  const net = fresh.reduce((s, t) => s + t.net_pnl, 0);

  const go = async () => {
    setBusy(true);
    try {
      const added = await j.addTrades(fresh);
      setMsg(`Imported ${added} trade${added === 1 ? '' : 's'}.`);
      setFiles([]);
      if (added) setTimeout(onDone, 900);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <label onDragOver={e => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={e => { e.preventDefault(); setOver(false); void read(e.dataTransfer.files); }}
        className={`card border-dashed p-8 flex flex-col items-center gap-2 text-center cursor-pointer ${over ? 'border-edge bg-edge/5' : ''}`}>
        <FileUp className="w-8 h-8 text-edge" />
        <span className="font-semibold">Choose or drop your export files</span>
        <span className="text-sm text-mute">NinjaTrader 8 · Tradovate · Robinhood · thinkorswim · Schwab (CSV). Trades already in your journal are skipped.</span>
        <input type="file" accept=".csv,text/csv,text/plain" multiple className="hidden" onChange={e => e.target.files && void read(e.target.files)} />
      </label>

      {files.map(f => (
        <div key={f.name} className="card p-4 text-sm space-y-1">
          <div className="font-semibold">{f.name}</div>
          {'error' in f ? <p className="text-loss">{f.error}</p> : <>
            <p className="text-mute">{f.format} · {f.trades.length} trade{f.trades.length === 1 ? '' : 's'}{f.trades.length ? ` · ${new Date(f.trades[0].entry_at).toLocaleDateString()} – ${new Date(f.trades[f.trades.length - 1].entry_at).toLocaleDateString()}` : ''}</p>
            {f.trades.some(t => have.has(t.import_key)) && <p className="text-mute">{f.trades.filter(t => have.has(t.import_key)).length} already in your journal (skipped)</p>}
            {f.open > 0 && <p className="text-mute">{f.open} position{f.open === 1 ? ' is' : 's are'} still open at the end of the file; {f.open === 1 ? 'it' : 'they'}’ll come in once a later file shows the exit.</p>}
            {f.warnings.map(w => <p key={w} className="text-edge">{w}</p>)}
          </>}
        </div>
      ))}

      {ready.length > 0 && (
        <div className="card p-4 flex flex-wrap items-center gap-3">
          <span className="text-sm">{fresh.length} new trade{fresh.length === 1 ? '' : 's'} · <span className={`num font-bold ${pnlClass(net)}`}>{money(net, true)}</span></span>
          <button className="btn-edge ml-auto" disabled={busy || !fresh.length} onClick={() => void go()}>{busy ? 'Importing…' : `Import ${fresh.length}`}</button>
        </div>
      )}
      {msg && <p className="text-sm">{msg}</p>}

      <section className="card p-4">
        <h3 className="font-semibold mb-2">How to export</h3>
        <div className="space-y-2">
          {HOW.map(([name, steps], i) => (
            <details key={name} open={i === 0} className="text-sm">
              <summary className="cursor-pointer font-medium">{name}</summary>
              <ol className="list-decimal pl-5 mt-1 space-y-1 text-mute">{steps.map(s => <li key={s}>{s}</li>)}</ol>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
