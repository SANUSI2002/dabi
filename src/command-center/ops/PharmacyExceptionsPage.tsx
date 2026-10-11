// Pharmacy exceptions: a read-only, platform-wide view of marketplace stock that needs attention —
// published products out of stock or low, batches expired or expiring, and listings withdrawn or
// rejected — grouped by pharmacy and branch, each linking to the pharmacy's own page.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/cn';
import { CommandInput, CommandPageHeader, CommandSelect, Panel, StatusPill } from '../components/ui';
import { listPharmacyExceptions, type PharmacyExceptionGroup, type PharmacyExceptionRow, type PharmacyExceptions, type PharmacyExceptionType } from './api';
import { Empty, ErrorBox, Field, FilterBar, Gate, Loading, Note, Pagination, Table, Td, human, useFormat, useLoad } from './kit';
import { useDebounced } from './PatientsPage';
import { R } from './routes';

const LABEL: Record<PharmacyExceptionType, string> = {
  OUT_OF_STOCK: 'Out of stock', LOW_STOCK: 'Low stock', EXPIRED: 'Expired', EXPIRING: 'Expiring', WITHDRAWN: 'Withdrawn', REJECTED: 'Rejected',
};
const TONE: Record<PharmacyExceptionType, string> = {
  OUT_OF_STOCK: 'bg-red-50 text-red-700 ring-red-200', EXPIRED: 'bg-red-50 text-red-700 ring-red-200',
  LOW_STOCK: 'bg-amber-50 text-amber-700 ring-amber-200', EXPIRING: 'bg-amber-50 text-amber-700 ring-amber-200',
  REJECTED: 'bg-slate-100 text-slate-700 ring-slate-300', WITHDRAWN: 'bg-slate-100 text-slate-600 ring-slate-200',
};

type Tile = { key: string; label: string; value: (s: PharmacyExceptions['summary']) => number; type: PharmacyExceptionType; within?: number };
const TILES: Tile[] = [
  { key: 'out', label: 'Out of stock', value: (s) => s.outOfStock, type: 'OUT_OF_STOCK' },
  { key: 'low', label: 'Low stock', value: (s) => s.lowStock, type: 'LOW_STOCK' },
  { key: 'expired', label: 'Expired in stock', value: (s) => s.expired, type: 'EXPIRED' },
  { key: 'e30', label: 'Expiring ≤ 30 days', value: (s) => s.expiring30, type: 'EXPIRING', within: 30 },
  { key: 'e60', label: 'Expiring ≤ 60 days', value: (s) => s.expiring60, type: 'EXPIRING', within: 60 },
  { key: 'e90', label: 'Expiring ≤ 90 days', value: (s) => s.expiring90, type: 'EXPIRING', within: 90 },
  { key: 'withdrawn', label: 'Listings withdrawn', value: (s) => s.withdrawn, type: 'WITHDRAWN' },
  { key: 'rejected', label: 'Listings rejected', value: (s) => s.rejected, type: 'REJECTED' },
];

const groupKey = (r: { pharmacy: { id: string }; branch: { id: string } | null }) => `${r.pharmacy.id}:${r.branch?.id ?? ''}`;

/** Consecutive rows of the page that share a pharmacy and branch (the server sorts by both). */
function byBranch(items: PharmacyExceptionRow[]) {
  const out: { key: string; rows: PharmacyExceptionRow[] }[] = [];
  for (const row of items) {
    const key = groupKey(row);
    if (out.at(-1)?.key === key) out.at(-1)!.rows.push(row);
    else out.push({ key, rows: [row] });
  }
  return out;
}

function GroupHeader({ row, group }: { row: PharmacyExceptionRow; group?: PharmacyExceptionGroup }) {
  const c = group?.counts;
  const parts = c ? ([['out of stock', c.outOfStock], ['low', c.lowStock], ['expired', c.expired], ['expiring', c.expiring], ['withdrawn', c.withdrawn], ['rejected', c.rejected]] as const).filter(([, n]) => n > 0).map(([l, n]) => `${n} ${l}`) : [];
  return <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-slate-200 bg-slate-50/70 px-4 py-2.5">
    <h3 className="text-sm font-bold text-slate-900">{row.pharmacy.name}</h3>
    <span className="text-xs text-slate-500">{row.branch ? row.branch.name : 'No branch assigned'}</span>
    {row.pharmacy.status !== 'VERIFIED' && <StatusPill status={human(row.pharmacy.status)} />}
    {row.branch?.status && row.branch.status !== 'VERIFIED' && <StatusPill status={`Branch ${human(row.branch.status).toLowerCase()}`} />}
    {parts.length > 0 && <span className="text-[11px] text-slate-500">{parts.join(' · ')}</span>}
    <Link to={`${R.pharmacies}/${row.pharmacy.id}`} className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">Open pharmacy <ArrowRight size={12} /></Link>
  </div>;
}

function Expiry({ row }: { row: PharmacyExceptionRow }) {
  const f = useFormat();
  if (!row.expiryDate) return <span className="text-slate-400">—</span>;
  const days = row.daysToExpiry ?? 0;
  return <span className={cn(row.expiryBand === 'EXPIRED' ? 'font-semibold text-red-700' : row.expiryBand ? 'font-semibold text-amber-700' : 'text-slate-600')}>
    {f.date(`${row.expiryDate}T12:00:00Z`)}
    <span className="block text-[11px] font-normal">{days < 0 ? `Expired ${Math.abs(days)} day(s) ago` : days === 0 ? 'Expires today' : `${days} day(s) left`}</span>
  </span>;
}

function Exceptions() {
  const f = useFormat();
  const [type, setType] = useState<PharmacyExceptionType | ''>('');
  const [within, setWithin] = useState(90);
  const [lowStockAt, setLowStockAt] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const search = useDebounced(q);
  const threshold = useDebounced(lowStockAt);
  const lowAt = /^\d+$/.test(threshold) ? Number(threshold) : undefined;
  useEffect(() => setPage(1), [type, within, lowAt, search]);
  const { data, error, loading, reload } = useLoad(() => listPharmacyExceptions({ type: type || undefined, within, lowStockAt: lowAt, search: search.trim() || undefined, page, limit: 50 }), [type, within, lowAt, search, page]);
  const groups = new Map((data?.groups ?? []).map((g) => [groupKey(g), g]));

  return <>
    <CommandPageHeader eyebrow="Sabi Health · Pharmacy operations" title="Pharmacy exceptions" description="Marketplace stock that needs attention across every pharmacy: published products out of stock or low, batches expired or expiring, and listings withdrawn or rejected. Read-only — pharmacies fix stock in their own portal." />
    {data && <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4">{TILES.map((t) => {
      const active = type === t.type && (t.within === undefined || within === t.within);
      return <button key={t.key} type="button" aria-pressed={active} onClick={() => { setType(active ? '' : t.type); if (t.within) setWithin(t.within); }}
        className={cn('min-w-0 rounded-xl bg-white p-3 text-left ring-1 transition hover:ring-emerald-300', active ? 'ring-2 ring-emerald-500' : 'ring-slate-200')}>
        <span className="block truncate text-[10px] font-bold uppercase tracking-[.1em] text-slate-500">{t.label}</span>
        <span className={cn('mt-1 block font-display text-xl font-bold [font-variant-numeric:tabular-nums]', t.value(data.summary) > 0 && (t.type === 'OUT_OF_STOCK' || t.type === 'EXPIRED') ? 'text-red-700' : 'text-slate-950')}>{t.value(data.summary).toLocaleString()}</span>
      </button>;
    })}</div>}
    <Panel>
      <FilterBar>
        <Field label="Search" className="min-w-[220px] flex-1"><CommandInput type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Product, batch number or pharmacy" /></Field>
        <Field label="Exception"><CommandSelect value={type} onChange={(e) => setType(e.target.value as PharmacyExceptionType | '')}><option value="">All exceptions</option>{(Object.keys(LABEL) as PharmacyExceptionType[]).map((k) => <option key={k} value={k}>{LABEL[k]}</option>)}</CommandSelect></Field>
        <Field label="Expiry window"><CommandSelect value={within} onChange={(e) => setWithin(Number(e.target.value))}>{[30, 60, 90].map((d) => <option key={d} value={d}>{d} days</option>)}</CommandSelect></Field>
        <Field label="Low stock at or below"><CommandInput type="number" min={0} inputMode="numeric" value={lowStockAt} onChange={(e) => setLowStockAt(e.target.value)} placeholder="Reorder point" className="w-36" /></Field>
      </FilterBar>
      <ErrorBox error={error} retry={reload} />
      {loading && !data ? <Loading /> : data && (data.items.length ? <>
        {byBranch(data.items).map(({ key, rows }) => <section key={key} aria-label={`${rows[0].pharmacy.name} ${rows[0].branch?.name ?? ''}`.trim()}>
          <GroupHeader row={rows[0]} group={groups.get(key)} />
          <Table caption={`Exceptions at ${rows[0].pharmacy.name}`} head={['Product', 'Exception', 'Stock', 'Expiry', 'Listing']}>{rows.map((r) => <tr key={r.id}>
            <Td><span className="font-semibold">{r.medicationName}</span><span className="block font-mono text-[11px] text-slate-500">{r.batchNumber ? `Batch ${r.batchNumber}` : 'No batch number'}{!r.isActive && ' · inactive'}</span></Td>
            <Td><span className="flex flex-wrap gap-1">{r.types.map((t) => <span key={t} className={cn('inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset', TONE[t])}>{LABEL[t]}</span>)}</span></Td>
            <Td className="[font-variant-numeric:tabular-nums]"><span className={cn(r.availableQuantity <= 0 && 'font-semibold text-red-700')}>{r.availableQuantity.toLocaleString()} available</span><span className="block text-[11px] text-slate-500">Reorder point {r.reorderPoint.toLocaleString()}</span></Td>
            <Td><Expiry row={r} /></Td>
            <Td>{r.listing ? <><StatusPill status={human(r.listing.status)} />{r.listing.reviewNote && <span className="mt-1 block max-w-xs text-xs text-slate-600">“{r.listing.reviewNote}”</span>}{(r.listing.status === 'WITHDRAWN' || r.listing.status === 'REJECTED') && <span className="block text-[11px] text-slate-500">{f.date(r.listing.status === 'REJECTED' ? r.listing.reviewedAt : r.listing.updatedAt)}</span>}</> : <span className="text-xs text-slate-400">Not listed</span>}</Td>
          </tr>)}</Table>
        </section>)}
        <Pagination page={data.page} pages={data.pages} total={data.total} onPage={setPage} />
      </> : <Empty title="No pharmacy exceptions match" hint="Nothing is out of stock, low, expiring in this window, withdrawn or rejected for these filters." />)}
      {data && <div className="grid gap-1.5 border-t border-slate-100 p-4">
        {(Object.keys(LABEL) as PharmacyExceptionType[]).map((k) => <p key={k} className="flex items-start gap-1.5 text-xs text-slate-600"><span className="shrink-0 font-semibold text-slate-800">{LABEL[k]}:</span><span className="min-w-0">{data.definitions[k]}</span></p>)}
        <Note>{data.freshness} Generated {f.dateTime(data.generatedAt)}. Hospital (EMR) pharmacy stock belongs to each hospital and is not shown here.</Note>
      </div>}
    </Panel>
  </>;
}

export default function PharmacyExceptionsPage() {
  return <Gate any={['platform.ops.read']} what="Pharmacy exceptions"><Exceptions /></Gate>;
}
