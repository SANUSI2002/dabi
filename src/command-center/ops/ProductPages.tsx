// The rest of Sabi Health in the Command Centre: prescriptions, quote requests and stock holds,
// wellness, hospitals (plans, enrolments, appointments), laboratories, the verification queue, the
// waitlist and EMR usage per organisation. Clinical content stays behind clinical permission.
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Pill } from 'lucide-react';
import { CommandButton, CommandInput, CommandPageHeader, CommandSelect, Panel, PanelHeader, StatusPill } from '../components/ui';
import { emrTenants, getPrescription, laboratories, listHolds, listHospitals, listPrescriptions, listQuoteRequests, listWaitlist, listWellness, openPrescriptionItems, verificationQueue, type PrescriptionItem, type TenantActivity } from './api.platform';
import { ActionDialog, Empty, ErrorBox, Field, FilterBar, Gate, Loading, naira, Note, Pagination, Table, Tabs, Td, Timeline, human, useCc, useFormat, useLoad, type ActionDialogProps } from './kit';
import { CC, R } from './routes';
import { useDebounced } from './PatientsPage';

export const P = {
  prescriptions: R.prescriptions,
  quotes: `${CC}/sabi-health/quotes`,
  wellness: `${CC}/sabi-health/wellness`,
  hospitals: `${CC}/sabi-health/hospitals`,
  laboratories: `${CC}/sabi-health/laboratories`,
  verification: `${CC}/sabi-health/verification`,
  waitlist: `${CC}/waitlist`,
  emrUsage: `${CC}/emr-usage`,
};

const patientCell = (p: { id: string; patientId: string; name: string | null } | null, can: boolean) => p ? <>{can ? <Link className="text-emerald-700" to={`${R.patients}/${p.id}`}>{p.name ?? 'Unnamed'}</Link> : p.name ?? 'Unnamed'}<span className="block font-mono text-[11px] text-slate-500">{p.patientId}</span></> : '—';
const STAGE: Record<string, string> = { NOT_YET_SHOPPED: 'Not yet shopped', QUOTES_REQUESTED: 'Quotes requested', PURCHASED: 'Purchased', CANCELLED: 'Cancelled', DRAFT: 'Draft' };

// ------------------------------------------------------------------------------------------------
// Prescriptions
// ------------------------------------------------------------------------------------------------
function PrescriptionList() {
  const navigate = useNavigate();
  const f = useFormat();
  const { can } = useCc();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const query = useDebounced(q);
  useEffect(() => setPage(1), [query, status]);
  const { data, error, loading, reload } = useLoad(() => listPrescriptions({ q: query || undefined, status: status || undefined, page }), [query, status, page]);
  return <>
    <CommandPageHeader eyebrow="Sabi Health · Telemedicine" title="Prescriptions" description="Every prescription Sabi doctors issue and what happened next: quotes, stock holds and orders. Medicine names need clinical permission and a reason." />
    <Panel>
      <FilterBar>
        <Field label="Search" className="min-w-[220px] flex-1"><CommandInput type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Prescription reference or patient ID" /></Field>
        <Field label="Status"><CommandSelect value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Issued and cancelled</option><option value="ISSUED">Issued</option><option value="CANCELLED">Cancelled</option><option value="DRAFT">Draft</option></CommandSelect></Field>
      </FilterBar>
      <ErrorBox error={error} retry={reload} />
      {loading && !data ? <Loading /> : data && (data.items.length ? <><Table caption="Prescriptions" head={['Prescription', 'Issued', 'Patient', 'Doctor', 'Items', 'Where it is']}>{data.items.map((p) => <tr key={p.id} className="cursor-pointer hover:bg-slate-50" onClick={() => navigate(`${P.prescriptions}/${p.id}`)}>
        <Td><Link to={`${P.prescriptions}/${p.id}`} onClick={(e) => e.stopPropagation()} className="font-mono text-xs font-semibold text-emerald-700">{p.reference}</Link></Td><Td className="text-xs">{f.dateTime(p.issuedAt ?? p.createdAt)}</Td><Td>{patientCell(p.patient, can('platform.patients.read'))}</Td><Td>{p.doctor.name}<span className="block text-xs text-slate-500">{p.doctor.specialty ?? 'General'}</span></Td><Td>{p.items}</Td>
        <Td><StatusPill status={STAGE[p.stage] ?? human(p.stage)} />{p.orders.map((o) => <span key={o.id} className="block text-[11px] text-slate-500">{o.reference} · {human(o.status).toLowerCase()}</span>)}</Td>
      </tr>)}</Table><Pagination page={data.page} pages={data.pages} total={data.total} onPage={setPage} /></> : <Empty title="No prescriptions match" />)}
    </Panel>
  </>;
}

function PrescriptionView({ id }: { id: string }) {
  const f = useFormat();
  const { can } = useCc();
  const { data: p, error, loading, reload } = useLoad(() => getPrescription(id), [id]);
  const [items, setItems] = useState<PrescriptionItem[] | null>(null);
  const [dialog, setDialog] = useState<ActionDialogProps | null>(null);
  const open = () => setDialog({ title: 'Open the medicines on this prescription', confirm: 'Open medicines', reasonLabel: 'Why you need them (recorded, shown to the patient as Sabi staff access)', description: 'Medicine names and doses are clinical information.', run: (v) => openPrescriptionItems(id, v.reason), onClose: () => setDialog(null), onDone: (r) => { setDialog(null); setItems((r as { items: PrescriptionItem[] }).items); } });
  return <>
    <Link to={P.prescriptions} className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-slate-600 hover:text-slate-900"><ArrowLeft size={14} />All prescriptions</Link>
    {loading && !p ? <Loading /> : !p ? <ErrorBox error={error} retry={reload} /> : <>
      <CommandPageHeader eyebrow="Prescription" title={p.reference} description={`${p.doctor.name ?? 'Doctor'} for ${p.patient?.name ?? 'patient'} · ${p.itemCount} item(s)`} actions={<StatusPill status={human(p.status)} />} />
      <div className="grid gap-4 [&>*]:min-w-0 xl:grid-cols-[1fr_380px]">
        <div className="grid gap-4 [&>*]:min-w-0 self-start">
          <Panel><PanelHeader title="Medicines" action={!items && can('platform.clinical.read') && <CommandButton variant="secondary" onClick={open}><Pill size={14} />Open medicines</CommandButton>} />
            {items ? <Table head={['Medicine', 'Dose', 'How often', 'Route', 'Duration', 'Qty']}>{items.map((i) => <tr key={i.id}><Td className="font-semibold">{i.medicationName}</Td><Td>{i.dosage}</Td><Td>{i.frequency}</Td><Td>{i.route}</Td><Td>{i.duration}</Td><Td>{i.quantity}</Td></tr>)}</Table> : <div className="p-4"><Note>{p.contentNote}{!can('platform.clinical.read') && ' Your role does not include it.'}</Note></div>}
          </Panel>
          <Panel><PanelHeader title="Pharmacy quotes" />{p.requests.length ? <Table head={['Pharmacy', 'Requested', 'Status', 'Quotes']}>{p.requests.map((r) => <tr key={r.id}><Td>{r.pharmacy.name}</Td><Td className="text-xs">{f.dateTime(r.requestedAt)}</Td><Td><StatusPill status={human(r.status)} /></Td><Td className="text-xs">{r.quotes.map((q) => <span key={q.id} className="block">Rev {q.revision}: {naira(q.totalMinor)} · {human(q.status).toLowerCase()}{q.unavailableLines ? ` · ${q.unavailableLines} line(s) unavailable` : ''} · expires {f.dateTime(q.expiresAt)}</span>)}{!r.quotes.length && 'No quote yet'}</Td></tr>)}</Table> : <Empty title="No quotes requested" />}</Panel>
          <Panel><PanelHeader title="Stock holds and orders" />{p.reservations.length ? <Table head={['Held', 'Until', 'Status', 'Order']}>{p.reservations.map((r) => <tr key={r.id}><Td className="text-xs">{f.dateTime(r.createdAt)}</Td><Td className="text-xs">{f.dateTime(r.expiresAt)}</Td><Td><StatusPill status={human(r.status)} /></Td><Td>{r.order ? <Link className="text-emerald-700" to={`${R.orders}/${r.order.id}`}>{r.order.reference} · {naira(r.order.totalPayableMinor)}</Link> : '—'}</Td></tr>)}</Table> : <Empty title="Not checked out" />}</Panel>
        </div>
        <Panel className="self-start"><PanelHeader title="Timeline" /><Timeline events={p.timeline} /></Panel>
      </div>
    </>}
    {dialog && <ActionDialog {...dialog} />}
  </>;
}

export function PrescriptionsPage({ path }: { path: string }) {
  const id = path.startsWith(`${P.prescriptions}/`) ? path.slice(P.prescriptions.length + 1).split('/')[0] : null;
  return <Gate any={['platform.ops.read']} what="Prescriptions">{id ? <PrescriptionView key={id} id={id} /> : <PrescriptionList />}</Gate>;
}

// ------------------------------------------------------------------------------------------------
// Quotes and stock holds
// ------------------------------------------------------------------------------------------------
export function QuotesPage() {
  const f = useFormat();
  const { can } = useCc();
  const [tab, setTab] = useState<'requests' | 'holds'>('requests');
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); setFilter(''); }, [tab]);
  useEffect(() => setPage(1), [filter]);
  const requests = useLoad(() => (tab === 'requests' ? listQuoteRequests(filter === 'unanswered' ? { unanswered: 'true', page } : { status: filter || undefined, page }) : Promise.resolve(null)), [tab, filter, page]);
  const holds = useLoad(() => (tab === 'holds' ? listHolds({ status: filter || undefined, page }) : Promise.resolve(null)), [tab, filter, page]);
  return <Gate any={['platform.ops.read']} what="Quotes and stock holds">
    <CommandPageHeader eyebrow="Sabi Health · Pharmacy operations" title="Quotes & stock holds" description="Patients asking pharmacies to quote a prescription, how fast pharmacies answer, and stock held for patients while they check out." />
    <Tabs label="Quotes and holds" value={tab} onChange={setTab} tabs={[{ value: 'requests', label: 'Quote requests' }, { value: 'holds', label: 'Stock holds', count: holds.data?.counts.ACTIVE }]} />
    <Panel>
      <FilterBar><Field label="Show"><CommandSelect value={filter} onChange={(e) => setFilter(e.target.value)}>{tab === 'requests'
        ? <><option value="">All</option><option value="unanswered">Waiting over 2 h for a quote</option><option value="REQUESTED">Requested</option><option value="QUOTED">Quoted</option><option value="CANCELLED">Cancelled</option></>
        : <><option value="">All</option>{['ACTIVE', 'CONVERTED', 'EXPIRED', 'RELEASED'].map((s) => <option key={s} value={s}>{human(s)}</option>)}</>}</CommandSelect></Field></FilterBar>
      {tab === 'requests' ? <><ErrorBox error={requests.error} retry={requests.reload} />{requests.loading && !requests.data ? <Loading /> : requests.data && (requests.data.items.length ? <><Table caption="Quote requests" head={['Requested', 'Pharmacy', 'Patient', 'Prescription', 'Status', 'First quote']}>{requests.data.items.map((r) => <tr key={r.id}>
        <Td className="text-xs">{f.dateTime(r.requestedAt)}</Td><Td>{r.pharmacy.name}</Td><Td>{patientCell(r.patient, can('platform.patients.read'))}</Td><Td><Link className="font-mono text-xs text-emerald-700" to={`${P.prescriptions}/${r.prescription.id}`}>{r.prescription.reference}</Link></Td><Td><StatusPill status={human(r.status)} /></Td>
        <Td className="text-xs">{r.firstQuoteMinutes !== null ? `${r.firstQuoteMinutes} min` : <span className="text-amber-700">Waiting {f.ago(r.requestedAt).replace(' ago', '')}</span>}{r.latestQuote && <span className="block text-slate-500">latest {human(r.latestQuote.status).toLowerCase()}, expires {f.dateTime(r.latestQuote.expiresAt)}</span>}</Td>
      </tr>)}</Table><Pagination page={requests.data.page} pages={requests.data.pages} total={requests.data.total} onPage={setPage} /></> : <Empty title="No quote requests match" />)}</>
        : <><ErrorBox error={holds.error} retry={holds.reload} />{holds.loading && !holds.data ? <Loading /> : holds.data && (holds.data.items.length ? <><Table caption="Stock holds" head={['Held', 'Patient', 'Kind', 'Pharmacies', 'Units · value', 'Until', 'Status']}>{holds.data.items.map((h) => <tr key={h.id}>
          <Td className="text-xs">{f.dateTime(h.createdAt)}</Td><Td>{patientCell(h.patient, can('platform.patients.read'))}</Td><Td>{human(h.kind)}</Td><Td>{h.pharmacies.join(', ')}</Td><Td>{h.units} · {naira(h.valueMinor)}</Td><Td className="text-xs">{f.dateTime(h.releasedAt ?? h.expiresAt)}</Td>
          <Td><StatusPill status={human(h.status)} />{h.order && <Link className="block text-[11px] text-emerald-700" to={`${R.orders}/${h.order.id}`}>{h.order.reference}</Link>}</Td>
        </tr>)}</Table><Pagination page={holds.data.page} pages={holds.data.pages} total={holds.data.total} onPage={setPage} /></> : <Empty title="No stock holds match" />)}</>}
    </Panel>
  </Gate>;
}

// ------------------------------------------------------------------------------------------------
// Wellness
// ------------------------------------------------------------------------------------------------
export function WellnessPage() {
  const f = useFormat();
  const { can } = useCc();
  const [view, setView] = useState<'bookings' | 'offerings' | 'providers'>('bookings');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); setStatus(''); }, [view]);
  useEffect(() => setPage(1), [status]);
  const { data, error, loading, reload } = useLoad(() => listWellness({ view, status: status || undefined, page }), [view, status, page]);
  const s = (r: Record<string, unknown>, k: string) => (r[k] === null || r[k] === undefined ? '—' : String(r[k]));
  return <Gate any={['platform.ops.read']} what="Wellness">
    <CommandPageHeader eyebrow="Sabi Health · Wellness" title="Wellness" description="Wellness providers, what they offer, and patients' booking requests with how long they have waited." />
    <Tabs label="Wellness" value={view} onChange={setView} tabs={[{ value: 'bookings', label: 'Bookings', count: data?.counts.PENDING }, { value: 'offerings', label: 'Offerings' }, { value: 'providers', label: 'Providers' }]} />
    <Panel>
      {view !== 'providers' && <FilterBar><Field label="Status"><CommandSelect value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All</option>{(view === 'bookings' ? ['PENDING', 'CONFIRMED', 'REJECTED', 'CANCELLED'] : ['DRAFT', 'PUBLISHED', 'ARCHIVED']).map((x) => <option key={x} value={x}>{human(x)}</option>)}</CommandSelect></Field></FilterBar>}
      <ErrorBox error={error} retry={reload} />
      {loading && !data ? <Loading /> : data && (data.items.length ? <>
        {view === 'bookings' && <Table caption="Wellness bookings" head={['Requested', 'Patient', 'Offering', 'Provider', 'Price', 'Status']}>{data.items.map((r) => <tr key={r.id}><Td className="text-xs">{f.dateTime(r.requestedAt as string)}</Td><Td>{patientCell(r.patient as never, can('platform.patients.read'))}</Td><Td>{s(r, 'offering')}<span className="block text-xs text-slate-500">{human(s(r, 'category'))}</span></Td><Td>{s(r, 'provider')}</Td><Td>{naira(r.priceMinor as number | null)}</Td><Td><StatusPill status={human(s(r, 'status'))} />{Boolean(r.waitingTooLong) && <span className="block text-[11px] text-amber-700">Waiting over 2 days</span>}{Boolean(r.decisionReason) && <span className="block text-[11px] text-slate-500">{s(r, 'decisionReason')}</span>}</Td></tr>)}</Table>}
        {view === 'offerings' && <Table caption="Wellness offerings" head={['Offering', 'Provider', 'Price', 'Bookings', 'Status', 'Updated']}>{data.items.map((r) => <tr key={r.id}><Td className="font-semibold">{s(r, 'name')}<span className="block text-xs font-normal text-slate-500">{human(s(r, 'category'))}</span></Td><Td>{s(r, 'provider')}</Td><Td>{naira(r.priceMinor as number | null)}</Td><Td>{s(r, 'bookings')}</Td><Td><StatusPill status={human(s(r, 'status'))} /></Td><Td className="text-xs">{f.date(r.updatedAt as string)}</Td></tr>)}</Table>}
        {view === 'providers' && <Table caption="Wellness providers" head={['Provider', 'Kind', 'Status', 'Offerings', 'Bookings', 'Joined']}>{data.items.map((r) => <tr key={r.id}><Td className="font-semibold">{s(r, 'name')}</Td><Td>{human(s(r, 'kind'))}</Td><Td><StatusPill status={human(s(r, 'status'))} /></Td><Td>{s(r, 'published')} published / {s(r, 'offerings')}</Td><Td>{s(r, 'bookings')}</Td><Td className="text-xs">{f.date(r.createdAt as string)}</Td></tr>)}</Table>}
        <Pagination page={data.page} pages={data.pages} total={data.total} onPage={setPage} />
      </> : <Empty title={`No ${view} yet`} />)}
    </Panel>
  </Gate>;
}

// ------------------------------------------------------------------------------------------------
// Hospitals: member plans, enrolments, appointment requests
// ------------------------------------------------------------------------------------------------
export function HospitalsPage() {
  const f = useFormat();
  const { can } = useCc();
  const [view, setView] = useState<'enrollments' | 'appointments' | 'plans'>('enrollments');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); setStatus(''); }, [view]);
  useEffect(() => setPage(1), [status]);
  const { data, error, loading, reload } = useLoad(() => listHospitals({ view, status: status || undefined, page }), [view, status, page]);
  const s = (r: Record<string, unknown>, k: string) => (r[k] === null || r[k] === undefined ? '—' : String(r[k]));
  const hospital = (r: Record<string, unknown>) => (r.hospital as { name: string } | undefined)?.name ?? '—';
  const options = { enrollments: ['PENDING', 'ACTIVE', 'REJECTED'], appointments: ['PENDING', 'SCHEDULED', 'CHECKED_IN', 'REJECTED', 'CANCELLED'], plans: ['ACTIVE', 'ARCHIVED'] }[view];
  return <Gate any={['platform.ops.read']} what="Hospitals">
    <CommandPageHeader eyebrow="Sabi Health · Hospitals" title="Hospitals & plans" description="Patients joining hospital member plans and requesting hospital appointments through Sabi, and how quickly hospitals respond." />
    <Tabs label="Hospitals" value={view} onChange={setView} tabs={[{ value: 'enrollments', label: 'Enrolments', count: data?.counts.enrollments.PENDING }, { value: 'appointments', label: 'Appointment requests', count: data?.counts.appointments.PENDING }, { value: 'plans', label: 'Member plans' }]} />
    <Panel>
      <FilterBar><Field label="Status"><CommandSelect value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All</option>{options.map((x) => <option key={x} value={x}>{human(x)}</option>)}</CommandSelect></Field></FilterBar>
      <ErrorBox error={error} retry={reload} />
      {loading && !data ? <Loading /> : data && (data.items.length ? <>
        {view === 'enrollments' && <Table caption="Hospital enrolments" head={['Requested', 'Patient', 'Hospital', 'Plan', 'Status']}>{data.items.map((r) => <tr key={r.id}><Td className="text-xs">{f.dateTime(r.requestedAt as string)}</Td><Td>{patientCell(r.patient as never, can('platform.patients.read'))}{Boolean(r.forDependent) && <span className="block text-[11px] text-slate-500">for a dependent</span>}</Td><Td>{hospital(r)}</Td><Td>{(r.plan as { name: string; feeMinor: number }).name}<span className="block text-xs text-slate-500">{naira((r.plan as { feeMinor: number }).feeMinor)}</span></Td><Td><StatusPill status={human(s(r, 'status'))} />{Boolean(r.waitingTooLong) && <span className="block text-[11px] text-amber-700">Waiting over 2 days</span>}{Boolean(r.decisionReason) && <span className="block text-[11px] text-slate-500">{s(r, 'decisionReason')}</span>}</Td></tr>)}</Table>}
        {view === 'appointments' && <Table caption="Hospital appointment requests" head={['Requested', 'Patient', 'Hospital', 'Type', 'Status', 'Checked in']}>{data.items.map((r) => <tr key={r.id}><Td className="text-xs">{f.dateTime(r.requestedAt as string)}</Td><Td>{patientCell(r.patient as never, can('platform.patients.read'))}</Td><Td>{hospital(r)}</Td><Td>{human(s(r, 'type'))}</Td><Td><StatusPill status={human(s(r, 'status'))} />{Boolean(r.waitingTooLong) && <span className="block text-[11px] text-amber-700">Waiting over 2 days</span>}</Td><Td className="text-xs">{f.dateTime(r.checkedInAt as string | null)}</Td></tr>)}</Table>}
        {view === 'plans' && <><Table caption="Hospital member plans" head={['Plan', 'Hospital', 'Fee', 'Members', 'Status', 'Updated']}>{data.items.map((r) => <tr key={r.id}><Td className="font-semibold">{s(r, 'name')}</Td><Td>{hospital(r)}</Td><Td>{naira(r.feeMinor as number)}</Td><Td>{s(r, 'enrollments')}</Td><Td><StatusPill status={human(s(r, 'status'))} /></Td><Td className="text-xs">{f.date(r.updatedAt as string)}</Td></tr>)}</Table><div className="p-4"><Note>Plan fees are set by each hospital and are not collected through Sabi.</Note></div></>}
        <Pagination page={data.page} pages={data.pages} total={data.total} onPage={setPage} />
      </> : <Empty title={`No ${view === 'plans' ? 'member plans' : view} yet`} />)}
    </Panel>
  </Gate>;
}

// ------------------------------------------------------------------------------------------------
// Laboratories and EMR usage
// ------------------------------------------------------------------------------------------------
const activityText = (a: TenantActivity) => (a ? `${a.patients} patients · ${a.encounters30d} visits, ${a.labOrders30d} lab orders, ${a.invoices30d} invoices (30 days)` : 'No EMR activity data');

export function LaboratoriesPage() {
  const f = useFormat();
  const { data, error, loading, reload } = useLoad(() => laboratories(), []);
  return <Gate any={['platform.ops.read']} what="Laboratories">
    <CommandPageHeader eyebrow="Sabi Health · Providers" title="Laboratories" description="Laboratory and diagnostic organisations registered on Sabi, their verification and EMR activity (counts only)." />
    <Panel><ErrorBox error={error} retry={reload} />{loading && !data ? <Loading /> : data && (data.items.length ? <Table caption="Laboratories" head={['Laboratory', 'Type', 'Status', 'Staff', 'Activity', 'Registered']}>{data.items.map((l) => <tr key={l.id}><Td className="font-semibold">{l.name}<span className="block text-xs font-normal text-slate-500">{l.city}, {l.state}</span></Td><Td>{human(l.type)}</Td><Td><StatusPill status={human(l.status)} /></Td><Td>{l.activeMembers}</Td><Td className="text-xs">{activityText(l.activity)}</Td><Td className="text-xs">{f.date(l.createdAt)}</Td></tr>)}</Table> : <Empty title="No laboratories registered yet" hint="Laboratories appear once they apply through Sabi OS onboarding." />)}</Panel>
  </Gate>;
}

export function EmrUsagePage() {
  const f = useFormat();
  const { data, error, loading, reload } = useLoad(() => emrTenants(), []);
  return <Gate any={['platform.ops.read']} what="EMR usage">
    <CommandPageHeader eyebrow="Sabi OS · Customers" title="EMR usage" description="Each organisation on the Sabi EMR: package, go-live, staff and activity. Counts only — patient records stay inside each organisation." />
    {data && <div className="mb-3"><Note>{data.note}</Note></div>}
    <Panel><ErrorBox error={error} retry={reload} />{loading && !data ? <Loading /> : data && (data.items.length ? <Table caption="EMR organisations" head={['Organisation', 'Package', 'Live since', 'Staff', 'Activity (30 days)', 'Webhooks given up', 'API since restart']}>{data.items.map((t) => <tr key={t.organizationId}>
      <Td className="font-semibold">{t.name}<span className="block text-xs font-normal text-slate-500">{human(t.type)}{t.city ? ` · ${t.city}` : ''}</span></Td><Td>{t.package ?? '—'}{!t.emrEnabled && <span className="block text-[11px] text-slate-500">EMR not in package</span>}</Td><Td className="text-xs">{f.date(t.goLive)}</Td><Td>{t.activeMembers}</Td>
      <Td className="text-xs">{activityText(t.activity)}</Td><Td className={t.deadWebhooks ? 'font-semibold text-red-700' : ''}>{t.deadWebhooks}</Td><Td className="text-xs">{t.apiSinceRestart ? `${t.apiSinceRestart.requests} req · ${t.apiSinceRestart.errors} errors · ${t.apiSinceRestart.avgMs} ms` : '—'}</Td>
    </tr>)}</Table> : <Empty title="No organisations use the EMR yet" />)}</Panel>
  </Gate>;
}

// ------------------------------------------------------------------------------------------------
// Verification queue
// ------------------------------------------------------------------------------------------------
const QUEUE_HREF = { doctors: R.doctors, pharmacies: R.pharmacies, listings: R.listings, organizations: `${CC}/organizations`, onboarding: `${CC}/onboarding` } as const;

export function VerificationPage() {
  const f = useFormat();
  const { data, error, loading, reload } = useLoad(() => verificationQueue(), []);
  const kinds = data ? [...new Set(data.items.map((i) => i.kind))] : [];
  return <Gate any={['platform.ops.read', 'platform.onboarding.review', 'platform.pharmacy.manage', 'platform.providers.manage']} what="Verification">
    <CommandPageHeader eyebrow="Sabi Health" title="Verification center" description="Every application and listing waiting for a Sabi decision, oldest first. Decisions are made on each item's own review page." />
    {data && <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-5">{kinds.map((k) => <div key={k} className="rounded-xl bg-white p-3 ring-1 ring-slate-200"><p className="text-[10px] font-bold uppercase tracking-[.1em] text-slate-500">{k}</p><p className="font-display text-xl font-bold">{data.items.filter((i) => i.kind === k).length}</p></div>)}</div>}
    <Panel><ErrorBox error={error} retry={reload} />{loading && !data ? <Loading /> : data && (data.items.length ? <Table caption="Waiting for verification" head={['Waiting since', 'What', 'Who', 'Details', '']}>{data.items.map((i) => <tr key={`${i.kind}-${i.id}`}><Td className="text-xs">{f.dateTime(i.since)}<span className="block text-slate-500">{f.ago(i.since)}</span></Td><Td>{i.kind}</Td><Td className="font-semibold">{i.title}</Td><Td className="text-xs">{i.subtitle}</Td><Td><Link className="text-xs font-semibold text-emerald-700" to={QUEUE_HREF[i.href]}>Review</Link></Td></tr>)}</Table> : <Empty title="Nothing is waiting for verification" />)}
      {data && <div className="grid gap-2 p-4"><Note>{data.note}</Note>{data.draftWellnessOfferings > 0 && <Note>{data.draftWellnessOfferings} wellness offering(s) are still drafts with their providers.</Note>}</div>}</Panel>
  </Gate>;
}

// ------------------------------------------------------------------------------------------------
// Waitlist
// ------------------------------------------------------------------------------------------------
export function WaitlistPage() {
  const f = useFormat();
  const [page, setPage] = useState(1);
  const { data, error, loading, reload } = useLoad(() => listWaitlist({ page }), [page]);
  return <Gate any={['platform.ops.read']} what="Waitlist">
    <CommandPageHeader eyebrow="Product management" title="Waitlist" description="People who joined a product waitlist (e.g. Sabi AI), with the consent they gave. Emails are masked." />
    {data && <div className="mb-4 flex flex-wrap gap-2 text-xs">{Object.entries(data.byProduct).map(([k, v]) => <span key={k} className="rounded-full bg-white px-3 py-1 ring-1 ring-slate-200">{human(k)}: <b>{v}</b></span>)}{Object.entries(data.byRole).map(([k, v]) => <span key={k} className="rounded-full bg-slate-100 px-3 py-1">{human(k)}: {v}</span>)}</div>}
    <Panel><ErrorBox error={error} retry={reload} />{loading && !data ? <Loading /> : data && (data.items.length ? <><Table caption="Waitlist" head={['Joined', 'Product', 'Name', 'Email', 'Role', 'Organisation', 'Source']}>{data.items.map((w) => <tr key={w.id}><Td className="text-xs">{f.dateTime(w.createdAt)}</Td><Td>{human(w.product)}</Td><Td>{w.name ?? '—'}</Td><Td>{w.email}</Td><Td>{human(w.role)}</Td><Td>{w.organisation ?? '—'}</Td><Td className="text-xs">{w.source ?? '—'}</Td></tr>)}</Table><Pagination page={data.page} pages={data.pages} total={data.total} onPage={setPage} /></> : <Empty title="Nobody has joined a waitlist yet" />)}</Panel>
  </Gate>;
}
