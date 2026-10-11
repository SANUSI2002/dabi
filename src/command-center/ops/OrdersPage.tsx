// Pharmacy orders end to end: list with filters, and the order trace — payment attempts and provider
// webhooks, each pharmacy's fulfilment and pharmacist decision, the delivery quote it was priced with,
// riders and handover, refunds, settlement and a single timeline.
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Bike } from 'lucide-react';
import { CommandButton, CommandInput, CommandPageHeader, CommandSelect, Panel, PanelHeader, StatusPill } from '../components/ui';
import { assignRider, getOrder, listDeliveries, listOrders, type DeliveryQuote, type OrderTrace } from './api';
import { ActionDialog, Empty, ErrorBox, Field, FilterBar, Gate, KeyValues, Loading, naira, Note, Pagination, Table, Td, Timeline, human, useCc, useFormat, useLoad, type ActionDialogProps } from './kit';
import { R } from './routes';
import { NewCaseButton } from './CasesPage';
import { useDebounced } from './PatientsPage';

const ORDER_STATUSES = ['PENDING_PAYMENT', 'PAID', 'PAYMENT_FAILED', 'CANCELLED'];
const FULFILMENT_STATUSES = ['AWAITING_PAYMENT', 'AWAITING_PHARMACIST_REVIEW', 'APPROVED_FOR_DISPENSING', 'PREPARING', 'READY_FOR_PICKUP', 'PICKED_UP', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CLARIFICATION_REQUIRED', 'REJECTED', 'UNABLE_TO_FULFILL', 'CANCELLED'];

export function QuoteBreakdown({ quote }: { quote: DeliveryQuote }) {
  return <div className="text-sm">
    <ul className="divide-y divide-slate-100">{quote.lines.map((l, i) => <li key={i} className="flex justify-between gap-3 py-1.5"><span className="text-slate-600">{l.label}</span><span className="font-medium [font-variant-numeric:tabular-nums]">{l.amountMinor < 0 ? '−' : ''}{naira(Math.abs(l.amountMinor))}</span></li>)}</ul>
    <p className="mt-1 flex justify-between border-t border-slate-200 pt-1.5 font-semibold"><span>Delivery fee</span><span>{naira(quote.feeMinor)}</span></p>
    <p className="mt-1 text-[11px] text-slate-500">{quote.distanceKm} km {quote.method === 'ROAD' ? 'by road' : 'straight-line'} · pricing version {quote.pricingVersion} · quoted {new Date(quote.quotedAt).toLocaleString()}{quote.zone && ` · zone ${quote.zone.name}`}{quote.methodFallback && ` · road distance unavailable (${quote.methodFallback.reason}), straight-line used`}</p>
  </div>;
}

function OrderList() {
  const navigate = useNavigate();
  const f = useFormat();
  const [params] = useSearchParams();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState(params.get('status') ?? '');
  const [fulfilmentStatus, setFulfilmentStatus] = useState(params.get('fulfilmentStatus') ?? '');
  const [method, setMethod] = useState('');
  const [page, setPage] = useState(1);
  const query = useDebounced(q);
  useEffect(() => setPage(1), [query, status, fulfilmentStatus, method]);
  const { data, error, loading, reload } = useLoad(() => listOrders({ q: query || undefined, status: status || undefined, fulfilmentStatus: fulfilmentStatus || undefined, method: method || undefined, page }), [query, status, fulfilmentStatus, method, page]);
  return <>
    <CommandPageHeader eyebrow="Sabi Health · Pharmacy operations" title="Orders" description="Every marketplace order. Open one to trace payment, pharmacy, delivery and refund end to end." />
    <Panel>
      <FilterBar>
        <Field label="Search" className="min-w-[220px] flex-1"><CommandInput type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Order reference, patient ID or payment reference" /></Field>
        <Field label="Payment"><CommandSelect value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All</option>{ORDER_STATUSES.map((s) => <option key={s} value={s}>{human(s)}</option>)}</CommandSelect></Field>
        <Field label="Fulfilment"><CommandSelect value={fulfilmentStatus} onChange={(e) => setFulfilmentStatus(e.target.value)}><option value="">All</option>{FULFILMENT_STATUSES.map((s) => <option key={s} value={s}>{human(s)}</option>)}</CommandSelect></Field>
        <Field label="Method"><CommandSelect value={method} onChange={(e) => setMethod(e.target.value)}><option value="">All</option><option value="DELIVERY">Delivery</option><option value="PICKUP">Pickup</option></CommandSelect></Field>
      </FilterBar>
      <ErrorBox error={error} retry={reload} />
      {loading && !data ? <Loading /> : data && (data.items.length ? <>
        <Table caption="Orders" head={['Order', 'Placed', 'Patient', 'Payment', 'Pharmacies', 'Delivery fee', 'Total']}>{data.items.map((o) => <tr key={o.id} className="cursor-pointer hover:bg-slate-50" onClick={() => navigate(`${R.orders}/${o.id}`)}>
          <Td><Link to={`${R.orders}/${o.id}`} onClick={(e) => e.stopPropagation()} className="font-semibold text-emerald-700">{o.reference}</Link></Td><Td className="whitespace-nowrap text-xs">{f.dateTime(o.createdAt)}</Td><Td>{o.patient.name ?? '—'}<span className="block font-mono text-[11px] text-slate-500">{o.patient.patientId}</span></Td><Td><StatusPill status={human(o.status)} /></Td>
          <Td>{o.fulfilments.map((x) => <span key={x.id} className="block text-xs">{x.pharmacy} · <span className="text-slate-500">{human(x.method)}, {human(x.status).toLowerCase()}</span></span>)}</Td><Td>{naira(o.deliveryFeeMinor)}</Td><Td className="font-semibold">{naira(o.totalPayableMinor)}</Td>
        </tr>)}</Table>
        <Pagination page={data.page} pages={data.pages} total={data.total} onPage={setPage} />
      </> : <Empty title="No orders match" />)}
    </Panel>
  </>;
}

function Trace({ o }: { o: OrderTrace }) {
  const f = useFormat();
  return <div className="grid gap-4 xl:grid-cols-[1fr_400px]">
    <div className="grid gap-4 self-start">
      <Panel><PanelHeader title="Money" description={`Priced with delivery pricing version ${o.money.pricingVersion}`} /><KeyValues items={[['Medicines', naira(o.money.subtotalMinor)], ['Delivery', naira(o.money.deliveryFeeMinor)], ['Platform fee', naira(o.money.platformFeeMinor)], ['Total paid', <b key="k62-300">{naira(o.money.totalPayableMinor)}</b>], ['Delivery details on file', o.deliveryDetailsOnFile ? 'Yes (encrypted, not shown here)' : 'No']]} /></Panel>
      {o.fulfilments.map((x) => <Panel key={x.id}>
        <PanelHeader title={`${x.pharmacy.name} · ${human(x.method)}`} description={`${x.pharmacy.city}, ${x.pharmacy.state}`} action={<StatusPill status={human(x.status)} />} />
        <Table head={['Item', 'Qty', 'Unit', 'Line']}>{x.lines.map((l) => <tr key={l.id}><Td>{l.medicationName}{l.prescriptionItemId && <span className="block text-[11px] text-slate-500">on prescription</span>}</Td><Td>{l.selectedQuantity}</Td><Td>{naira(l.unitPriceMinor)}</Td><Td>{naira(l.lineTotalMinor)}</Td></tr>)}</Table>
        <KeyValues items={[['Commission', x.commissionMinor === null ? 'Not recorded' : `${naira(x.commissionMinor)} (${(x.commissionBps ?? 0) / 100}%, tier v${x.tierVersion})`], ['Pharmacy earns', naira(x.pharmacyEarningMinor)], ['Settlement', x.settlement ? `${x.settlement.reference} (${human(x.settlement.status)})` : 'Not yet settled'],
          ['Pharmacist decision', x.pharmacistDecision ? `${f.dateTime(x.pharmacistDecision.at)}${x.pharmacistDecision.by ? ` by ${x.pharmacistDecision.by}` : ''}` : 'Pending'], ['Decision note', x.pharmacistDecision?.note ?? '—']]} />
        {x.deliveryQuote && <div className="border-t border-slate-100 p-4"><p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Delivery quote (frozen at checkout)</p><QuoteBreakdown quote={x.deliveryQuote} /></div>}
        {x.deliveries.length > 0 && <div className="border-t border-slate-100"><Table head={['Rider', 'Assigned', 'Collected', 'Delivered', 'Status']}>{x.deliveries.map((d) => <tr key={d.id}><Td>{d.partner.displayName}</Td><Td>{f.dateTime(d.assignedAt)}</Td><Td>{f.dateTime(d.pickedUpAt)}</Td><Td>{f.dateTime(d.deliveredAt)}</Td><Td><StatusPill status={human(d.status)} />{d.rejectionReason && <span className="block text-[11px] text-slate-500">{d.rejectionReason}</span>}</Td></tr>)}</Table><p className="px-4 pb-3 text-[11px] text-slate-500">Pickup and delivery codes are never shown in the Command Centre.</p></div>}
        {x.refund && <div className="border-t border-slate-100 p-4 text-sm"><p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Refund</p><p><StatusPill status={human(x.refund.status)} /> {naira(x.refund.amountMinor)} · {x.refund.reason}</p>{x.refund.providerRefundReference && <p className="mt-1 text-xs text-slate-500">Provider reference {x.refund.providerRefundReference}</p>}<Link to={`${R.finance}?tab=refunds`} className="mt-1 inline-block text-xs font-semibold text-emerald-700">Open refunds</Link></div>}
      </Panel>)}
      <Panel><PanelHeader title="Payment attempts and provider events" />{o.payments.length ? <Table head={['Started', 'Reference', 'Status', 'Amount', 'Provider events']}>{o.payments.map((p) => <tr key={p.id}><Td>{f.dateTime(p.createdAt)}</Td><Td className="font-mono text-xs">{p.providerReference}</Td><Td><StatusPill status={human(p.status)} /></Td><Td>{naira(p.amountMinor)}</Td><Td className="text-xs">{p.events.map((e) => `${e.eventType} → ${human(e.status)}`).join(', ') || '—'}</Td></tr>)}</Table> : <Empty title="No payment attempts" />}
        {o.webhooks.length > 0 && <div className="border-t border-slate-100 px-4 py-3 text-xs text-slate-600">Webhooks received: {o.webhooks.map((w) => `${w.eventType ?? 'unknown'} (${human(w.outcome).toLowerCase()})`).join(', ')}</div>}
      </Panel>
    </div>
    <div className="grid gap-4 self-start">
      <Panel><PanelHeader title="Timeline" /><Timeline events={o.timeline} /></Panel>
      <Panel><PanelHeader title="Cases" action={<NewCaseButton orderId={o.id} subjectUserId={o.patient.id} />} />{o.cases.length ? <ul className="divide-y divide-slate-100">{o.cases.map((c) => <li key={c.id} className="px-4 py-2.5 text-sm"><Link className="font-semibold text-emerald-700" to={`${R.cases}/${c.id}`}>{c.reference}</Link> {c.title} <StatusPill status={human(c.status)} /></li>)}</ul> : <Empty title="No cases on this order" />}</Panel>
    </div>
  </div>;
}

function OrderView({ id }: { id: string }) {
  const { can } = useCc();
  const { data, error, loading, reload } = useLoad(() => getOrder(id), [id]);
  return <>
    <Link to={R.orders} className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-slate-600 hover:text-slate-900"><ArrowLeft size={14} />All orders</Link>
    {loading && !data ? <Loading /> : !data ? <ErrorBox error={error} retry={reload} /> : <>
      <CommandPageHeader eyebrow="Order trace" title={data.reference} description={`${data.patient.name ?? 'Patient'} (${data.patient.patientId}) · placed ${new Date(data.createdAt).toLocaleString()}`} actions={<><StatusPill status={human(data.status)} />{can('platform.patients.read') && <Link to={`${R.patients}/${data.patient.id}`} className="text-sm font-semibold text-emerald-700">Open patient</Link>}</>} />
      <Trace o={data} />
    </>}
  </>;
}

export default function OrdersPage({ path }: { path: string }) {
  const id = path.startsWith(`${R.orders}/`) ? decodeURIComponent(path.slice(R.orders.length + 1).split('/')[0]) : null;
  return <Gate any={['platform.ops.read', 'platform.finance.read']} what="Orders">{id ? <OrderView key={id} id={id} /> : <OrderList />}</Gate>;
}

// ------------------------------------------------------------------------------------------------
// Deliveries board
// ------------------------------------------------------------------------------------------------
const STATES = [{ value: '', label: 'All active' }, { value: 'UNASSIGNED', label: 'Ready, no rider' }, { value: 'ASSIGNED', label: 'Rider assigned' }, { value: 'IN_TRANSIT', label: 'Out for delivery' }, { value: 'DELIVERED', label: 'Delivered' }, { value: 'PROBLEM', label: 'Problem' }];

export function DeliveriesPage() {
  const f = useFormat();
  const { can } = useCc();
  const [params] = useSearchParams();
  const [state, setState] = useState(params.get('unassigned') ? 'UNASSIGNED' : '');
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState<ActionDialogProps | null>(null);
  const [flash, setFlash] = useState('');
  useEffect(() => setPage(1), [state]);
  const { data, error, loading, reload } = useLoad(() => listDeliveries({ state: state || undefined, page }), [state, page]);
  const activeRiders = data?.riders.filter((r) => r.active) ?? [];
  const dispatch = (fulfilmentId: string, reference: string) => setDialog({
    title: `Assign a rider to ${reference}`, confirm: 'Assign rider', reasonLabel: 'Why Sabi is assigning (recorded)',
    description: 'Normally the pharmacy assigns its rider. Assign here when the pharmacy has not, or a rider declined. The rider gets the job and the codes are issued as usual.',
    fields: [{ name: 'partnerId', label: 'Rider', type: 'select', required: true, defaultValue: activeRiders[0]?.id ?? '', options: activeRiders.map((r) => ({ value: r.id, label: `${r.name} · ${r.openAssignments} open job${r.openAssignments === 1 ? '' : 's'}` })) }],
    run: (v) => assignRider(fulfilmentId, v.partnerId, v.reason), onClose: () => setDialog(null),
    onDone: (r) => { setDialog(null); setFlash(`Assigned to ${(r as { rider: string }).rider}.`); reload(); },
  });
  return <Gate any={['platform.ops.read', 'platform.delivery.manage']} what="Deliveries">
    <CommandPageHeader eyebrow="Sabi Health · Logistics" title="Deliveries" description="Every paid delivery: who has it, where it is in the handover chain, and what it was priced at." />
    {flash && <p role="status" className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{flash}</p>}
    <div className="grid gap-4 xl:grid-cols-[1fr_300px]">
      <Panel>
        <FilterBar><Field label="Show"><CommandSelect value={state} onChange={(e) => setState(e.target.value)}>{STATES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</CommandSelect></Field></FilterBar>
        <ErrorBox error={error} retry={reload} />
        {loading && !data ? <Loading /> : data && (data.items.length ? <>
          <Table caption="Deliveries" head={['Order', 'Pharmacy', 'Status', 'Rider', 'Distance · fee', '']}>{data.items.map((d) => <tr key={d.fulfilmentId}>
            <Td><Link className="font-semibold text-emerald-700" to={`${R.orders}/${d.order.id}`}>{d.order.reference}</Link><span className="block text-[11px] text-slate-500">{f.ago(d.createdAt)}</span></Td><Td>{d.pharmacy.name}<span className="block text-xs text-slate-500">{d.pharmacy.city}</span></Td><Td><StatusPill status={human(d.status)} /></Td>
            <Td>{d.assignment ? <>{d.assignment.rider}<span className="block text-[11px] text-slate-500">{human(d.assignment.status)} · {f.ago(d.assignment.assignedAt)}</span></> : <span className="text-amber-700">No rider</span>}</Td>
            <Td>{d.distanceKm !== null ? `${d.distanceKm} km` : '—'} · {naira(d.deliveryFeeMinor)}{d.pricingVersion && <span className="block text-[11px] text-slate-500">pricing v{d.pricingVersion}</span>}</Td>
            <Td>{can('platform.delivery.manage') && d.status === 'READY_FOR_PICKUP' && !d.assignment ? <CommandButton variant="secondary" className="h-8" disabled={!activeRiders.length} onClick={() => dispatch(d.fulfilmentId, d.order.reference)}><Bike size={13} />Assign</CommandButton> : null}</Td>
          </tr>)}</Table>
          <Pagination page={data.page} pages={data.pages} total={data.total} onPage={setPage} />
        </> : <Empty title="No deliveries in this view" />)}
      </Panel>
      <Panel className="self-start"><PanelHeader title="Riders" description="Active riders and their open jobs" />{data?.riders.length ? <ul className="divide-y divide-slate-100">{data.riders.map((r) => <li key={r.id} className="flex items-center justify-between px-4 py-2.5 text-sm"><span>{r.name}</span><span className="flex items-center gap-2"><span className="text-xs text-slate-500">{r.openAssignments} open</span><StatusPill status={r.active ? 'Active' : 'Inactive'} /></span></li>)}</ul> : <Empty title="No riders yet" hint="Riders appear once they are verified and activated." />}
        {!activeRiders.length && can('platform.delivery.manage') && <div className="p-4"><Note tone="warning">No active riders: deliveries cannot be dispatched until one is activated.</Note></div>}
      </Panel>
    </div>
    {dialog && <ActionDialog {...dialog} />}
  </Gate>;
}
