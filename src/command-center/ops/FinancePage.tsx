// Finance: what was collected and how it splits, payment attempts, refunds (proposed by one person,
// approved by another, refunded only on provider evidence), pharmacy settlements (prepared, approved
// by someone else, paid by recorded bank transfer), reconciliation checks and webhook health.
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Plus, XCircle } from 'lucide-react';
import { cn } from '@/lib/cn';
import { CommandButton, CommandInput, CommandPageHeader, CommandSelect, Panel, PanelHeader, StatusPill } from '../components/ui';
import { createSettlement, financeSummary, listPayables, listPayments, listRefunds, listSettlements, listWebhooks, previewSettlement, reconciliation, refundAction, refundEvidence, settlementAction, settlementPaid, submitRefund, type RefundRow, type Settlement, type SettlementPreview } from './api';
import { ActionDialog, Definition, Empty, ErrorBox, Field, FilterBar, Gate, Loading, naira, Note, Pagination, Table, Tabs, Td, human, useCc, useFormat, useLoad, type ActionDialogProps } from './kit';
import { PeriodControls, usePeriod } from './OverviewPanels';
import { R } from './routes';

type Tab = 'summary' | 'payments' | 'refunds' | 'settlements' | 'reconciliation' | 'webhooks';

function Summary() {
  const period = usePeriod();
  const { data, error, loading, reload } = useLoad(() => financeSummary(period.range), [period.range.from, period.range.to, period.range.tz]);
  const s = data;
  const tile = (label: string, value: number, def?: string, strong = false) => <div className={cn('rounded-xl p-4 ring-1 ring-slate-200', strong ? 'bg-slate-950 text-white ring-slate-950' : 'bg-white')}><p className={cn('flex items-center gap-1 text-[10px] font-bold uppercase tracking-[.1em]', strong ? 'text-emerald-300' : 'text-slate-500')}>{label}{def && <Definition text={def} />}</p><p className="mt-1 font-display text-xl font-bold [font-variant-numeric:tabular-nums]">{naira(value)}</p></div>;
  return <div className="grid gap-4">
    <PeriodControls period={period} generatedAt={s?.generatedAt} loading={loading} />
    <ErrorBox error={error} retry={reload} />
    {!s ? <Panel><Loading /></Panel> : <>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {tile('Collected', s.collected.amountMinor, s.definitions.collected, true)}
        {tile('Sabi revenue', s.breakdown.sabiRevenueMinor, s.definitions.sabiRevenue)}
        {tile('Owed to pharmacies', s.breakdown.pharmacyEarningsMinor, s.definitions.pharmacyEarnings)}
        {tile('Unsettled (all time)', s.unsettled.netPayableMinor, s.definitions.unsettled)}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel><PanelHeader title="How the money splits" description={`${s.collected.count} paid order${s.collected.count === 1 ? '' : 's'} in the period`} />
          <ul className="divide-y divide-slate-100 text-sm">{[['Medicines (paid to pharmacies, less commission)', s.breakdown.medicinesMinor], ['Commission (Sabi)', s.breakdown.commissionMinor], ['Delivery fees (Sabi)', s.breakdown.deliveryFeesMinor], ['Platform fees (Sabi)', s.breakdown.platformFeesMinor]].map(([l, v]) => <li key={l as string} className="flex justify-between px-4 py-2.5"><span className="text-slate-600">{l}</span><span className="font-semibold [font-variant-numeric:tabular-nums]">{naira(v as number)}</span></li>)}</ul>
        </Panel>
        <Panel><PanelHeader title="Refunds and settlements" description="Cases and settlements created in the period" />
          <ul className="divide-y divide-slate-100 text-sm">{Object.entries(s.refunds).map(([k, v]) => <li key={`r-${k}`} className="flex justify-between px-4 py-2.5"><span>Refunds · {human(k).toLowerCase()} ({v.count})</span><span className="font-semibold">{naira(v.amountMinor)}</span></li>)}{Object.entries(s.settlements).map(([k, v]) => <li key={`s-${k}`} className="flex justify-between px-4 py-2.5"><span>Settlements · {human(k).toLowerCase()} ({v.count})</span><span className="font-semibold">{naira(v.amountMinor)}</span></li>)}</ul>
          {!Object.keys(s.refunds).length && !Object.keys(s.settlements).length && <Empty title="None in this period" />}
          <div className="grid gap-2 p-4"><Note>Paystack: {human(s.providers.paystack)}. Payouts: {s.providers.payouts}.</Note></div>
        </Panel>
      </div>
    </>}
  </div>;
}

function Payments() {
  const f = useFormat();
  const [params] = useSearchParams();
  const [status, setStatus] = useState(params.get('status') ?? '');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [status, q]);
  const { data, error, loading, reload } = useLoad(() => listPayments({ status: status || undefined, q: q || undefined, page }), [status, q, page]);
  return <Panel>
    <FilterBar><Field label="Search"><CommandInput type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Order or Paystack reference" /></Field><Field label="Status"><CommandSelect value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All</option>{['PENDING', 'SUCCESS', 'FAILED', 'EXPIRED', 'CANCELLED'].map((s) => <option key={s} value={s}>{human(s)}</option>)}</CommandSelect></Field></FilterBar>
    <ErrorBox error={error} retry={reload} />
    {loading && !data ? <Loading /> : data && (data.items.length ? <><Table caption="Payment attempts" head={['Started', 'Order', 'Paystack reference', 'Status', 'Amount', 'Events', 'Ended']}>{data.items.map((p) => <tr key={p.id}><Td className="whitespace-nowrap text-xs">{f.dateTime(p.createdAt)}</Td><Td><Link className="font-semibold text-emerald-700" to={`${R.orders}/${p.order.id}`}>{p.order.reference}</Link></Td><Td className="font-mono text-xs">{p.providerReference}</Td><Td><StatusPill status={human(p.status)} /></Td><Td className={p.amountMinor !== p.order.totalPayableMinor ? 'text-red-700' : ''}>{naira(p.amountMinor)}</Td><Td>{p.providerEvents}</Td><Td className="text-xs">{f.dateTime(p.completedAt)}</Td></tr>)}</Table><Pagination page={data.page} pages={data.pages} total={data.total} onPage={setPage} /></> : <Empty title="No payment attempts match" />)}
  </Panel>;
}

function Refunds() {
  const f = useFormat();
  const { can, me } = useCc();
  const [status, setStatus] = useState('OPEN');
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState<ActionDialogProps | null>(null);
  useEffect(() => setPage(1), [status]);
  const { data, error, loading, reload } = useLoad(() => listRefunds({ status: status || undefined, page }), [status, page]);
  const close = () => setDialog(null);
  const done = () => { close(); reload(); };
  const act = (r: RefundRow, action: 'propose' | 'approve' | 'decline') => setDialog({
    title: `${human(action)} refund of ${naira(r.amountMinor)}`, confirm: human(action), tone: action === 'decline' ? 'danger' : 'primary', reasonLabel: 'Note (recorded)',
    description: action === 'approve' ? <>Approving lets finance send this refund to Paystack. You cannot approve a refund you proposed.</> : action === 'propose' ? <>A second finance user must approve before anything is sent to Paystack.</> : <>The patient will not be refunded through Sabi. Say why.</>,
    run: (v) => refundAction(r.id, action, v.reason), onClose: close, onDone: done,
  });
  const submit = (r: RefundRow) => setDialog({
    title: `Send refund of ${naira(r.amountMinor)} to Paystack`, confirm: 'Send to Paystack', tone: 'danger', reasonLabel: null,
    description: <>This asks Paystack to refund order {r.order.reference}. It is marked <b>refunded</b> only when Paystack confirms it.</>,
    run: () => submitRefund(r.id), onClose: close, onDone: done,
  });
  const evidence = (r: RefundRow) => setDialog({
    title: 'Record Paystack evidence', confirm: 'Record evidence', reasonLabel: 'What you checked (recorded)',
    description: 'Use when Paystack’s webhook did not arrive. Check the refund in the Paystack dashboard first. Someone other than the proposer must record this.',
    fields: [{ name: 'outcome', label: 'Outcome in Paystack', type: 'select', required: true, defaultValue: 'REFUNDED', options: [{ value: 'REFUNDED', label: 'Refund processed' }, { value: 'FAILED', label: 'Refund failed' }] }, { name: 'providerRefundReference', label: 'Paystack refund reference', defaultValue: r.providerRefundReference ?? '', pattern: '[\\w.:-]{3,120}', hint: 'Required when the refund was processed' }],
    run: (v) => refundEvidence(r.id, { outcome: v.outcome as 'REFUNDED' | 'FAILED', providerRefundReference: v.providerRefundReference || undefined, note: v.reason }), onClose: close, onDone: done,
  });
  return <Panel>
    <FilterBar><Field label="Show"><CommandSelect value={status} onChange={(e) => setStatus(e.target.value)}><option value="OPEN">Needing action</option>{['PENDING_REVIEW', 'PROPOSED', 'APPROVED', 'SUBMITTED', 'FAILED', 'REFUNDED', 'DECLINED', 'RESOLVED'].map((s) => <option key={s} value={s}>{human(s)}</option>)}<option value="">All</option></CommandSelect></Field>
      <div className="pb-1"><Note>Proposer and approver must be different people. Sabi marks a refund paid only with Paystack’s confirmation.</Note></div></FilterBar>
    <ErrorBox error={error} retry={reload} />
    {loading && !data ? <Loading /> : data && (data.items.length ? <><Table caption="Refunds" head={['Order', 'Pharmacy', 'Amount', 'Why', 'Status', 'Trail', '']}>{data.items.map((r) => {
      const mine = r.proposedByUserId === me?.id;
      return <tr key={r.id}><Td><Link className="font-semibold text-emerald-700" to={`${R.orders}/${r.order.id}`}>{r.order.reference}</Link><span className="block text-[11px] text-slate-500">{r.order.patient.full_name}</span></Td><Td>{r.pharmacy}</Td><Td className="font-semibold">{naira(r.amountMinor)}</Td><Td className="max-w-[220px] text-xs">{r.reason}</Td><Td><StatusPill status={human(r.status)} />{r.failureReason && <span className="block text-[11px] text-red-700">{r.failureReason}</span>}{r.providerRefundReference && <span className="block font-mono text-[11px] text-slate-500">{r.providerRefundReference}</span>}</Td>
        <Td className="text-[11px] text-slate-500">{r.proposedBy && <span className="block">Proposed: {r.proposedBy}, {f.date(r.proposedAt)}</span>}{r.decidedBy && <span className="block">{r.status === 'DECLINED' ? 'Declined' : 'Approved'}: {r.decidedBy}, {f.date(r.decidedAt)}</span>}{r.evidenceRecordedBy && <span className="block">Evidence: {r.evidenceRecordedBy}</span>}</Td>
        <Td><div className="flex flex-wrap justify-end gap-1">
          {r.status === 'PENDING_REVIEW' && can('platform.finance.manage') && <CommandButton className="h-8" variant="secondary" onClick={() => act(r, 'propose')}>Propose</CommandButton>}
          {r.status === 'PROPOSED' && can('platform.finance.approve') && <CommandButton className="h-8" variant="secondary" disabled={mine} title={mine ? 'You proposed this refund' : undefined} onClick={() => act(r, 'approve')}><CheckCircle2 size={13} />Approve</CommandButton>}
          {['PENDING_REVIEW', 'PROPOSED'].includes(r.status) && can('platform.finance.approve') && <CommandButton className="h-8" variant="quiet" onClick={() => act(r, 'decline')}><XCircle size={13} />Decline</CommandButton>}
          {['APPROVED', 'FAILED'].includes(r.status) && can('platform.finance.manage') && <CommandButton className="h-8" onClick={() => submit(r)}>Send to Paystack</CommandButton>}
          {r.status === 'SUBMITTED' && can('platform.finance.approve') && <CommandButton className="h-8" variant="secondary" disabled={mine} onClick={() => evidence(r)}>Record evidence</CommandButton>}
        </div></Td></tr>;
    })}</Table><Pagination page={data.page} pages={data.pages} total={data.total} onPage={setPage} /></> : <Empty title={status === 'OPEN' ? 'No refunds need action' : 'No refunds match'} hint="Refund cases open automatically when a paid order cannot be fulfilled." />)}
    {dialog && <ActionDialog {...dialog} />}
  </Panel>;
}

function NewSettlement({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const pharmacies = useLoad(() => (open ? listPayables().then((r) => r.items) : Promise.resolve([])), [open]);
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({ pharmacyId: '', from: '', to: today });
  const [preview, setPreview] = useState<SettlementPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [key] = useState(() => crypto.randomUUID());
  const period = () => ({ pharmacyId: form.pharmacyId, periodStart: new Date(`${form.from}T00:00:00`).toISOString(), periodEnd: (form.to >= today ? new Date() : new Date(`${form.to}T23:59:59.999`)).toISOString() });
  async function run(fn: () => Promise<void>) { setBusy(true); setError(null); try { await fn(); } catch (e) { setError(e as Error); } finally { setBusy(false); } }
  if (!open) return <CommandButton onClick={() => setOpen(true)}><Plus size={14} />Prepare settlement</CommandButton>;
  return <Panel className="mb-4"><PanelHeader title="Prepare a settlement" description="Pick a pharmacy and period, check what is owed, then prepare it for someone else to approve." />
    <div className="grid gap-3 p-4 sm:grid-cols-4">
      <Field label="Pharmacy" className="sm:col-span-2"><CommandSelect value={form.pharmacyId} onChange={(e) => { setForm({ ...form, pharmacyId: e.target.value }); setPreview(null); }}><option value="">Choose…</option>{pharmacies.data?.map((p) => <option key={p.pharmacyId} value={p.pharmacyId}>{p.name} · {naira(p.netPayableMinor)} unsettled ({p.fulfilments})</option>)}</CommandSelect></Field>
      <Field label="From"><input type="date" value={form.from} max={form.to} onChange={(e) => { setForm({ ...form, from: e.target.value }); setPreview(null); }} className="h-9 rounded-lg border border-slate-200 px-2 text-sm" /></Field>
      <Field label="To"><input type="date" value={form.to} max={today} onChange={(e) => { setForm({ ...form, to: e.target.value }); setPreview(null); }} className="h-9 rounded-lg border border-slate-200 px-2 text-sm" /></Field>
    </div>
    {pharmacies.error && <div className="px-4"><ErrorBox error={pharmacies.error} /></div>}
    {preview && <div className="border-t border-slate-100 p-4 text-sm"><Note>{preview.definition}</Note>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center"><div><p className="text-[11px] text-slate-500">Gross ({preview.fulfilmentCount})</p><p className="font-bold">{naira(preview.grossMinor)}</p></div><div><p className="text-[11px] text-slate-500">Commission</p><p className="font-bold">−{naira(preview.commissionMinor)}</p></div><div><p className="text-[11px] text-slate-500">Net payable</p><p className="font-display text-lg font-bold text-emerald-700">{naira(preview.netPayableMinor)}</p></div></div>
      {preview.excludedMissingCommission > 0 && <div className="mt-2"><Note tone="warning">{preview.excludedMissingCommission} fulfilment(s) left out: no commission was recorded on them.</Note></div>}
    </div>}
    {error && <div className="px-4 pb-2"><ErrorBox error={error} /></div>}
    <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 p-4"><CommandButton variant="secondary" onClick={() => setOpen(false)}>Cancel</CommandButton>
      <CommandButton variant="secondary" disabled={busy || !form.pharmacyId || !form.from} onClick={() => run(async () => setPreview(await previewSettlement(period())))}>Check amounts</CommandButton>
      <CommandButton disabled={busy || !preview?.fulfilmentCount} onClick={() => run(async () => { await createSettlement({ ...period(), idempotencyKey: key }); setOpen(false); onDone(); })}>Prepare for approval</CommandButton></div>
  </Panel>;
}

function Settlements() {
  const f = useFormat();
  const { can, me } = useCc();
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState<ActionDialogProps | null>(null);
  useEffect(() => setPage(1), [status]);
  const { data, error, loading, reload } = useLoad(() => listSettlements({ status: status || undefined, page }), [status, page]);
  const close = () => setDialog(null);
  const done = () => { close(); reload(); };
  const approve = (s: Settlement) => setDialog({ title: `Approve ${s.reference}`, confirm: 'Approve', reasonLabel: 'What you checked (recorded)', description: <>{naira(s.netPayableMinor)} to {s.pharmacy.name} for {s.fulfilmentCount} fulfilment(s). You cannot approve a settlement you prepared.</>, run: (v) => settlementAction(s.id, 'approve', v.reason), onClose: close, onDone: done });
  const paid = (s: Settlement) => setDialog({ title: `Record payment of ${s.reference}`, confirm: 'Record payment', tone: 'danger', reasonLabel: 'Note (recorded)', description: <>Sabi has no payout provider connected. Pay {naira(s.netPayableMinor)} by bank transfer, then record the transfer reference here.</>, fields: [{ name: 'payoutReference', label: 'Bank transfer reference', required: true, pattern: '[\\w ./:-]{4,120}' }], run: (v) => settlementPaid(s.id, v.payoutReference, v.reason), onClose: close, onDone: done });
  const cancel = (s: Settlement) => setDialog({ title: `Cancel ${s.reference}`, confirm: 'Cancel settlement', tone: 'danger', reasonLabel: 'Why (recorded)', description: 'Its fulfilments become available for a new settlement.', run: (v) => settlementAction(s.id, 'cancel', v.reason), onClose: close, onDone: done });
  return <>
    {can('platform.finance.manage') && <div className="mb-3"><NewSettlement onDone={reload} /></div>}
    <Panel>
      <FilterBar><Field label="Status"><CommandSelect value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All</option>{['DRAFT', 'APPROVED', 'PAID', 'CANCELLED'].map((s) => <option key={s} value={s}>{human(s)}</option>)}</CommandSelect></Field></FilterBar>
      <ErrorBox error={error} retry={reload} />
      {loading && !data ? <Loading /> : data && (data.items.length ? <><Table caption="Settlements" head={['Settlement', 'Pharmacy', 'Period', 'Net payable', 'Status', 'Trail', '']}>{data.items.map((s) => {
        const mine = s.preparedByUserId === me?.id;
        return <tr key={s.id}><Td className="font-mono text-xs font-semibold">{s.reference}</Td><Td>{s.pharmacy.name}</Td><Td className="text-xs">{f.date(s.periodStart)} – {f.date(s.periodEnd)}</Td><Td><span className="font-semibold">{naira(s.netPayableMinor)}</span><span className="block text-[11px] text-slate-500">{naira(s.grossMinor)} − {naira(s.commissionMinor)} · {s.fulfilmentCount} item(s)</span></Td><Td><StatusPill status={human(s.status)} />{s.payoutReference && <span className="block font-mono text-[11px] text-slate-500">{s.payoutReference}</span>}</Td>
          <Td className="text-[11px] text-slate-500"><span className="block">Prepared: {s.preparedBy}</span>{s.approvedBy && <span className="block">Approved: {s.approvedBy}, {f.date(s.approvedAt)}</span>}{s.paidBy && <span className="block">Paid: {s.paidBy}, {f.date(s.paidAt)}</span>}{s.cancelReason && <span className="block">Cancelled: {s.cancelReason}</span>}</Td>
          <Td><div className="flex flex-wrap justify-end gap-1">
            {s.status === 'DRAFT' && can('platform.finance.approve') && <CommandButton className="h-8" variant="secondary" disabled={mine} title={mine ? 'You prepared this settlement' : undefined} onClick={() => approve(s)}>Approve</CommandButton>}
            {s.status === 'APPROVED' && can('platform.finance.approve') && <CommandButton className="h-8" onClick={() => paid(s)}>Record payment</CommandButton>}
            {['DRAFT', 'APPROVED'].includes(s.status) && (can('platform.finance.manage') || can('platform.finance.approve')) && <CommandButton className="h-8" variant="quiet" onClick={() => cancel(s)}>Cancel</CommandButton>}
          </div></Td></tr>;
      })}</Table><Pagination page={data.page} pages={data.pages} total={data.total} onPage={setPage} /></> : <Empty title="No settlements yet" hint="Prepare one for a pharmacy and period; someone else approves it." />)}
      {dialog && <ActionDialog {...dialog} />}
    </Panel>
  </>;
}

function Reconciliation() {
  const f = useFormat();
  const { data, error, loading, reload } = useLoad(() => reconciliation(), []);
  if (loading && !data) return <Panel><Loading label="Running checks…" /></Panel>;
  return <div className="grid gap-3">
    <ErrorBox error={error} retry={reload} />
    {data && <p className="text-xs text-slate-500">Checked {f.dateTime(data.generatedAt)} · <button className="font-semibold text-emerald-700" onClick={reload}>Run again</button></p>}
    {data?.checks.map((c) => <Panel key={c.key}><details open={c.status === 'MISMATCH'}><summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3"><span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', c.status === 'OK' ? 'bg-emerald-500' : c.severity === 'critical' ? 'bg-red-600' : 'bg-amber-500')} /><span className="min-w-0 flex-1"><span className="text-sm font-semibold text-slate-900">{c.title}</span><span className="block text-xs text-slate-500">Expected: {c.expectation}</span></span><StatusPill status={c.status === 'OK' ? 'OK' : `${c.count} mismatch${c.count === 1 ? '' : 'es'}`} /></summary>
      {c.items.length > 0 && <Table head={['Order', 'Amount', 'When', 'Detail']}>{c.items.map((it, i) => <tr key={i}><Td>{it.id ? <Link className="font-semibold text-emerald-700" to={`${R.orders}/${it.id}`}>{String(it.reference)}</Link> : String(it.reference)}</Td><Td>{naira(Number(it.amountMinor))}{it.expectedMinor !== undefined && <span className="block text-[11px] text-slate-500">expected {naira(Number(it.expectedMinor))}</span>}</Td><Td className="text-xs">{f.dateTime(it.at as string)}</Td><Td className="text-xs text-slate-600">{[it.orderStatus && `order ${human(String(it.orderStatus)).toLowerCase()}`, it.successes && `${it.successes} successful payments`, it.providerReference, it.pharmacy, it.status && human(String(it.status)), it.note].filter(Boolean).join(' · ') || '—'}</Td></tr>)}</Table>}
    </details></Panel>)}
  </div>;
}

function Webhooks() {
  const f = useFormat();
  const [params] = useSearchParams();
  const [outcome, setOutcome] = useState(params.get('outcome') ?? '');
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [outcome]);
  const { data, error, loading, reload } = useLoad(() => listWebhooks({ outcome: outcome || undefined, page }), [outcome, page]);
  return <Panel>
    <FilterBar><Field label="Outcome"><CommandSelect value={outcome} onChange={(e) => setOutcome(e.target.value)}><option value="">All</option>{['APPLIED', 'DUPLICATE', 'IGNORED', 'REJECTED_SIGNATURE', 'REJECTED_INVALID', 'ERROR'].map((s) => <option key={s} value={s}>{human(s)}</option>)}</CommandSelect></Field>
      {data && <p className="pb-2 text-xs text-slate-500">Last 24 h: {Object.entries(data.last24h).map(([k, v]) => `${human(k).toLowerCase()} ${v}`).join(' · ') || 'none received'}</p>}</FilterBar>
    <ErrorBox error={error} retry={reload} />
    {loading && !data ? <Loading /> : data && (data.items.length ? <><Table caption="Payment webhooks" head={['Received', 'Event', 'Reference', 'Outcome', 'Detail']}>{data.items.map((w) => <tr key={w.id}><Td className="text-xs">{f.dateTime(w.receivedAt)}</Td><Td>{w.eventType ?? '—'}</Td><Td className="font-mono text-xs">{w.reference ?? '—'}</Td><Td><StatusPill status={human(w.outcome)} /></Td><Td className="text-xs text-slate-600">{w.detail ?? '—'}</Td></tr>)}</Table><Pagination page={data.page} pages={data.pages} total={data.total} onPage={setPage} /></> : <Empty title="No webhooks received" hint="Paystack posts here when payments and refunds change. Payloads are never stored." />)}
  </Panel>;
}

export default function FinancePage() {
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab) || 'summary';
  const setTab = (t: Tab) => setParams(t === 'summary' ? {} : { tab: t });
  return <Gate any={['platform.finance.read', 'platform.finance.manage', 'platform.finance.approve']} what="Finance">
    <CommandPageHeader eyebrow="Sabi Health · Finance" title="Payments & finance" description="Money collected, what Sabi keeps, what pharmacies are owed, and every refund and settlement — with two people on every payout." />
    <Tabs label="Finance" value={tab} onChange={setTab} tabs={[{ value: 'summary', label: 'Summary' }, { value: 'payments', label: 'Payments' }, { value: 'refunds', label: 'Refunds' }, { value: 'settlements', label: 'Settlements' }, { value: 'reconciliation', label: 'Reconciliation' }, { value: 'webhooks', label: 'Webhooks' }]} />
    {tab === 'summary' && <Summary />}{tab === 'payments' && <Payments />}{tab === 'refunds' && <Refunds />}{tab === 'settlements' && <Settlements />}{tab === 'reconciliation' && <Reconciliation />}{tab === 'webhooks' && <Webhooks />}
  </Gate>;
}
