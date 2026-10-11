// Patients: a masked, searchable list and the unified patient view. Opening a record needs a stated
// purpose (recorded and shown to the patient as "Sabi staff opened…"); health information needs
// clinical permission or time-limited emergency access. Nothing is shown as a current location.
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, LogOut, MapPin, ShieldAlert, ShieldCheck, UserCog } from 'lucide-react';
import { liveApiRequest, type LiveApiError } from '@/identity/liveIdentity';
import { CommandButton, CommandInput, CommandPageHeader, CommandSelect, Panel, PanelHeader, StatusPill } from '../components/ui';
import { listPatients, openPatientAccount, openPatientClinical, patientAccessHistory, revokePatientSessions, startEmergencyAccess, type PatientAccount, type PatientClinical } from './api';
import { ActionDialog, Empty, ErrorBox, Field, FilterBar, Gate, KeyValues, Loading, naira, Note, Pagination, Table, Tabs, Td, human, useCc, useFormat, useLoad, type ActionDialogProps } from './kit';
import { R } from './routes';
import { NewCaseButton } from './CasesPage';

const STATUSES = ['ACTIVE', 'PENDING', 'SUSPENDED', 'LOCKED', 'DISABLED', 'DEACTIVATED', 'BANNED'];
const PURPOSES = ['Patient contacted support', 'Order or delivery issue', 'Payment or refund query', 'Complaint investigation', 'Safety or quality review', 'Account security concern'];

export function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

function PatientList() {
  const navigate = useNavigate();
  const f = useFormat();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const query = useDebounced(q);
  useEffect(() => setPage(1), [query, status]);
  const { data, error, loading, reload } = useLoad(() => listPatients({ q: query || undefined, status: status || undefined, page }), [query, status, page]);
  return <>
    <CommandPageHeader eyebrow="Sabi Health · People" title="Patients" description="Every patient account. Contact details are masked here; opening a patient asks for your purpose and is recorded on their activity log." />
    <Panel>
      <FilterBar>
        <Field label="Search" className="min-w-[240px] flex-1"><CommandInput type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, email, phone or Sabi patient ID" /></Field>
        <Field label="Account status"><CommandSelect value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All</option>{STATUSES.map((s) => <option key={s} value={s}>{human(s)}</option>)}</CommandSelect></Field>
      </FilterBar>
      <ErrorBox error={error} retry={reload} />
      {loading && !data ? <Loading /> : data && (data.items.length ? <>
        <Table caption="Patients" head={['Patient', 'Sabi ID', 'Email', 'Phone', 'Status', 'Last sign-in']}>{data.items.map((p) => <tr key={p.id} className="cursor-pointer hover:bg-slate-50" onClick={() => navigate(`${R.patients}/${p.id}`)}>
          <Td><Link to={`${R.patients}/${p.id}`} className="font-semibold text-slate-900 hover:text-emerald-700" onClick={(e) => e.stopPropagation()}>{p.name || 'Unnamed'}</Link></Td><Td className="font-mono text-xs">{p.patientId}</Td><Td>{p.email ?? '—'}</Td><Td>{p.phone ?? '—'}</Td><Td><StatusPill status={human(p.accountStatus)} /></Td><Td className="text-xs text-slate-500">{p.lastSignInAt ? f.ago(p.lastSignInAt) : 'Never'}</Td>
        </tr>)}</Table>
        <Pagination page={data.page} pages={data.pages} total={data.total} onPage={setPage} />
      </> : <Empty title="No patients match" hint="Try a shorter search, or clear the status filter." />)}
    </Panel>
  </>;
}

/** Asks why the record is being opened before anything is loaded. */
function PurposeGate({ title, description, confirm, onOpen, busy, error, notice }: { title: string; description: string; confirm: string; onOpen: (reason: string) => void; busy: boolean; error: LiveApiError | null; notice: string }) {
  const [reason, setReason] = useState('');
  return <Panel><div className="max-w-2xl p-5">
    <h2 className="text-base font-bold text-slate-900">{title}</h2><p className="mt-1 text-sm leading-6 text-slate-600">{description}</p>
    <div className="mt-3 flex flex-wrap gap-1.5">{PURPOSES.map((p) => <button key={p} type="button" onClick={() => setReason(p)} className="rounded-full border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:border-emerald-400 hover:text-emerald-800">{p}</button>)}</div>
    <form className="mt-3 grid gap-2" onSubmit={(e) => { e.preventDefault(); if (reason.trim().length >= 5) onOpen(reason.trim()); }}>
      <Field label="Purpose (recorded and visible in audit review)"><textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal" placeholder="e.g. Patient called about order SHP-… not arriving" /></Field>
      <div className="flex items-center gap-2"><CommandButton type="submit" disabled={busy || reason.trim().length < 5}>{busy ? 'Opening…' : confirm}</CommandButton><span className="text-[11px] text-slate-500">The patient sees “{notice}” in their activity log.</span></div>
    </form>
    {error && <div className="mt-3"><ErrorBox error={error} /></div>}
  </div></Panel>;
}

function AccountTabs({ data, patientId }: { data: PatientAccount; patientId: string }) {
  const f = useFormat();
  const [tab, setTab] = useState<'overview' | 'addresses' | 'circle' | 'orders' | 'consents' | 'cases'>('overview');
  const a = data.account;
  return <>
    <Tabs label="Patient account" value={tab} onChange={setTab} tabs={[
      { value: 'overview', label: 'Account & sign-ins' }, { value: 'addresses', label: 'Addresses', count: data.addresses.length },
      { value: 'circle', label: 'Care circle', count: data.careCircle.caregivers.length + data.careCircle.doctors.length + data.careCircle.dependents.length },
      { value: 'orders', label: 'Orders & payments', count: data.orders.length }, { value: 'consents', label: 'Consents' }, { value: 'cases', label: 'Cases', count: data.cases.length },
    ]} />
    {tab === 'overview' && <div className="grid gap-4 [&>*]:min-w-0">
      <Panel><PanelHeader title="Account" /><KeyValues items={[
        ['Name', a.name], ['Sabi patient ID', <span key="k76-48" className="font-mono text-xs">{a.patientId}</span>], ['Status', <StatusPill key="k76-118" status={human(a.accountStatus)} />],
        ['Email', <>{a.email ?? '—'} {a.emailVerifiedAt && <span className="text-[11px] text-emerald-700">verified</span>}</>], ['Phone', <>{a.phone ?? '—'} {a.phoneVerifiedAt && <span className="text-[11px] text-emerald-700">verified</span>}</>],
        ['Date of birth', f.date(a.dateOfBirth)], ['Two-step verification', a.twoStepVerification ? 'On' : 'Off'], ['Last sign-in', a.lastSignInAt ? `${f.dateTime(a.lastSignInAt)} (${f.ago(a.lastSignInAt)})` : 'Never'], ['Roles', a.roles.map(human).join(', ')],
      ]} /></Panel>
      <Panel><PanelHeader title="Sessions and devices" description="Most recent first" />{data.sessions.length ? <Table head={['Device', 'Started', 'Last active', 'State', 'Two-step']}>{data.sessions.map((s) => <tr key={s.id}><Td>{s.device}</Td><Td>{f.dateTime(s.startedAt)}</Td><Td>{f.ago(s.lastActiveAt)}</Td><Td><StatusPill status={s.state === 'SIGNED_OUT' ? `Signed out${s.endedReason ? ` (${human(s.endedReason)})` : ''}` : human(s.state)} /></Td><Td>{s.twoStepVerifiedAt ? f.dateTime(s.twoStepVerifiedAt) : '—'}</Td></tr>)}</Table> : <Empty title="No sessions recorded" />}</Panel>
      <Panel><PanelHeader title="Sign-in locations" />
        <div className="p-4"><Note><MapPin size={12} className="mr-1 inline" />{data.location.note}</Note></div>
        {data.location.signIns.length ? <Table head={['When', 'Event', 'Device', 'Network address', 'Approximate location (at that time)']}>{data.location.signIns.map((s, i) => <tr key={i}><Td>{f.dateTime(s.at)}</Td><Td>{human(s.action)}</Td><Td>{s.device ?? '—'}</Td><Td className="font-mono text-xs">{s.ip ?? '—'}</Td><Td>{s.approximateLocation ? <>{[s.approximateLocation.city, s.approximateLocation.region, s.approximateLocation.country].filter(Boolean).join(', ')}<span className="block text-[11px] text-slate-500">From {s.approximateLocation.source.toLowerCase()}, {f.ago(s.approximateLocation.recordedAt)}</span></> : '—'}</Td></tr>)}</Table> : <Empty title="No sign-ins recorded" />}
      </Panel>
    </div>}
    {tab === 'addresses' && <Panel><PanelHeader title="Addresses and contacts" description="Each with where it came from and when it was recorded" />{data.addresses.length ? <ul className="divide-y divide-slate-100">{data.addresses.map((d, i) => <li key={i} className="grid gap-1 px-4 py-3 text-sm sm:grid-cols-[1fr_auto]"><div>{d.kind === 'EMERGENCY_CONTACT' ? <p className="font-semibold text-slate-900">Emergency contact: {d.recipientName ?? '—'} {d.relation && <span className="font-normal text-slate-500">({d.relation})</span>} · {d.recipientPhone ?? '—'}</p> : d.unavailable ? <p className="text-amber-700">{d.source}</p> : <><p className="font-semibold text-slate-900">{d.address}</p><p className="text-xs text-slate-500">Recipient: {d.recipientName} · {d.recipientPhone}</p></>}<p className="mt-0.5 text-[11px] text-slate-500">Source: {d.source}</p></div><div className="text-xs text-slate-500 sm:text-right">{f.dateTime(d.recordedAt)}{d.recordedAtNote && <span className="block text-[11px]">{d.recordedAtNote}</span>}{d.orderId && <Link to={`${R.orders}/${d.orderId}`} className="block font-semibold text-emerald-700">Open order</Link>}</div></li>)}</ul> : <Empty title="No addresses on file" hint="Addresses are recorded when the patient checks out a delivery order." />}</Panel>}
    {tab === 'circle' && <div className="grid gap-4 [&>*]:min-w-0 lg:grid-cols-2">
      <Panel><PanelHeader title="Caregivers" />{data.careCircle.caregivers.length ? <ul className="divide-y divide-slate-100">{data.careCircle.caregivers.map((c) => <li key={c.id} className="px-4 py-3 text-sm"><div className="flex justify-between gap-2"><span className="font-semibold">{c.name ?? c.invitedEmail}</span><StatusPill status={human(c.status)} /></div><p className="text-xs text-slate-500">{c.relationship} · since {f.date(c.since)}{c.accessExpiresAt && ` · until ${f.date(c.accessExpiresAt)}`}</p>{c.permissions.length > 0 && <p className="mt-1 text-[11px] text-slate-500">Can: {c.permissions.map(human).join(', ')}</p>}</li>)}</ul> : <Empty title="No caregivers" />}</Panel>
      <Panel><PanelHeader title="Doctors with access" />{data.careCircle.doctors.length ? <ul className="divide-y divide-slate-100">{data.careCircle.doctors.map((d) => <li key={d.id} className="flex justify-between gap-2 px-4 py-3 text-sm"><span><span className="font-semibold">{d.doctor}</span><span className="block text-xs text-slate-500">{d.specialty ?? 'General'} · requested {f.date(d.requestedAt)}</span></span><StatusPill status={human(d.status)} /></li>)}</ul> : <Empty title="No doctor relationships" />}</Panel>
      <Panel><PanelHeader title="Cares for" />{data.careCircle.caresFor.length ? <ul className="divide-y divide-slate-100">{data.careCircle.caresFor.map((c) => <li key={c.id} className="flex justify-between px-4 py-3 text-sm"><span>{c.name} <span className="text-xs text-slate-500">({c.relationship})</span></span><StatusPill status={human(c.status)} /></li>)}</ul> : <Empty title="Not a caregiver for anyone" />}</Panel>
      <Panel><PanelHeader title="Dependents and hospitals" /><ul className="divide-y divide-slate-100">{data.careCircle.dependents.map((d) => <li key={d.id} className="px-4 py-3 text-sm">Dependent: <span className="font-semibold">{d.name}</span> <span className="text-xs text-slate-500">added {f.date(d.addedAt)}</span></li>)}{data.careCircle.hospitals.map((h) => <li key={h.id} className="flex justify-between px-4 py-3 text-sm"><span>Hospital: <span className="font-semibold">{h.hospital}</span></span><StatusPill status={human(h.status)} /></li>)}</ul>{!data.careCircle.dependents.length && !data.careCircle.hospitals.length && <Empty title="None" />}</Panel>
    </div>}
    {tab === 'orders' && <div className="grid gap-4 [&>*]:min-w-0">
      <Panel><PanelHeader title="Orders" />{data.orders.length ? <Table head={['Order', 'Placed', 'Status', 'Pharmacies', 'Delivery', 'Total']}>{data.orders.map((o) => <tr key={o.id}><Td><Link className="font-semibold text-emerald-700" to={`${R.orders}/${o.id}`}>{o.reference}</Link></Td><Td>{f.dateTime(o.createdAt)}</Td><Td><StatusPill status={human(o.status)} /></Td><Td>{o.fulfilments.map((x) => `${x.pharmacy} (${human(x.status)})`).join('; ')}</Td><Td>{naira(o.deliveryFeeMinor)}</Td><Td className="font-semibold">{naira(o.totalPayableMinor)}</Td></tr>)}</Table> : <Empty title="No orders" />}</Panel>
      <Panel><PanelHeader title="Payment attempts" />{data.payments.length ? <Table head={['When', 'Order', 'Provider reference', 'Status', 'Amount']}>{data.payments.map((p) => <tr key={p.id}><Td>{f.dateTime(p.createdAt)}</Td><Td>{p.orderReference}</Td><Td className="font-mono text-xs">{p.providerReference}</Td><Td><StatusPill status={human(p.status)} /></Td><Td>{naira(p.amountMinor)}</Td></tr>)}</Table> : <Empty title="No payments" />}</Panel>
    </div>}
    {tab === 'consents' && <div className="grid gap-4 [&>*]:min-w-0 lg:grid-cols-2">
      <Panel><PanelHeader title="Sabi consents" /><ul className="divide-y divide-slate-100">{data.consents.platform.map((c) => <li key={c.key} className="flex items-center justify-between gap-2 px-4 py-3 text-sm"><span>{c.label}<span className="block text-[11px] text-slate-500">{c.at ? `Recorded ${f.dateTime(c.at)}` : 'No timestamp recorded'}</span></span><StatusPill status={c.given ? 'Given' : 'Not given'} /></li>)}</ul>{!data.consents.platform.length && <Empty title="No profile consents recorded" />}</Panel>
      <Panel><PanelHeader title="Access the patient granted" /><ul className="divide-y divide-slate-100">{data.consents.professionals.map((c) => <li key={c.id} className="flex justify-between gap-2 px-4 py-3 text-sm"><span>{c.professional} <span className="text-xs text-slate-500">({human(c.professionType)}) · {f.date(c.grantedAt)}</span></span><StatusPill status={c.active ? 'Active' : 'Revoked'} /></li>)}{data.consents.documentShares.map((s) => <li key={s.id} className="flex justify-between gap-2 px-4 py-3 text-sm"><span>Shared {human(s.documentKind)} with {s.recipient} <span className="text-xs text-slate-500">until {f.date(s.expiresAt)}</span></span><StatusPill status={s.revokedAt ? 'Revoked' : new Date(s.expiresAt) < new Date() ? 'Expired' : 'Active'} /></li>)}</ul>{!data.consents.professionals.length && !data.consents.documentShares.length && <Empty title="No access granted to professionals" />}</Panel>
    </div>}
    {tab === 'cases' && <Panel><PanelHeader title="Support cases and incidents" action={<NewCaseButton subjectUserId={patientId} />} />{data.cases.length ? <Table head={['Case', 'Title', 'Priority', 'Status', 'Opened']}>{data.cases.map((c) => <tr key={c.id}><Td><Link className="font-semibold text-emerald-700" to={`${R.cases}/${c.id}`}>{c.reference}</Link></Td><Td>{c.title}</Td><Td>{c.priority}</Td><Td><StatusPill status={human(c.status)} /></Td><Td>{f.date(c.createdAt)}</Td></tr>)}</Table> : <Empty title="No cases for this patient" />}</Panel>}
  </>;
}

function ClinicalView({ data }: { data: PatientClinical }) {
  const f = useFormat();
  const m = data.medicines;
  return <div className="grid gap-4 [&>*]:min-w-0">
    {data.access.kind === 'EMERGENCY' && <Note tone="warning">You are using emergency access until {f.dateTime(data.access.expiresAt)}. It will be reviewed by compliance.</Note>}
    <Panel><PanelHeader title="Allergies" description="Source and verification shown for each" />
      {data.allergies.reported.length ? <ul className="divide-y divide-slate-100">{data.allergies.reported.map((a, i) => <li key={i} className="flex flex-wrap items-start justify-between gap-2 px-4 py-3 text-sm"><span><span className="font-semibold text-slate-900">{a.text}</span><span className="block text-[11px] text-slate-500">{a.source} · {f.dateTime(a.recordedAt)}{a.recordedAtNote && ` (${a.recordedAtNote.toLowerCase()})`}</span></span><StatusPill status="Unverified" /></li>)}</ul> : <Empty title="No allergies reported to Sabi" />}
      <div className="px-4 pb-4"><Note>{data.allergies.note}</Note></div>
    </Panel>
    <Panel><PanelHeader title="Medicines: prescribed vs purchased vs handed over" description={m.definitions.prescribed} />
      {m.prescribed.length ? <Table head={['Medicine', 'Prescription', 'Prescriber', 'Prescribed', 'Purchased', 'Handed over']}>{m.prescribed.map((p) => <tr key={p.itemId}><Td><span className="font-semibold">{p.medicationName}</span><span className="block text-xs text-slate-500">{p.dosage} · {p.frequency} · {p.route} · {p.duration}</span></Td><Td>{p.reference}<span className="block text-xs text-slate-500">{p.status === 'CANCELLED' ? `Cancelled ${f.date(p.cancelledAt)}` : `Issued ${f.date(p.issuedAt)}`}</span></Td><Td>{p.prescriber}</Td><Td>{p.quantity}</Td><Td className={p.purchasedQuantity < p.quantity ? 'text-amber-700' : ''}>{p.purchasedQuantity}</Td><Td className={p.handedOverQuantity < p.purchasedQuantity ? 'text-amber-700' : ''}>{p.handedOverQuantity}</Td></tr>)}</Table> : <Empty title="No Sabi prescriptions" />}
    </Panel>
    <Panel><PanelHeader title="Purchased through Sabi" description={`${m.definitions.purchased} ${m.definitions.handedOver}`} />
      {m.purchased.length ? <Table head={['Medicine', 'Qty', 'Order', 'Pharmacy', 'Purchased', 'Status']}>{m.purchased.map((p, i) => <tr key={i}><Td>{p.medicationName}{p.prescriptionItemId && <span className="block text-[11px] text-slate-500">on prescription</span>}</Td><Td>{p.quantity}</Td><Td><Link className="text-emerald-700" to={`${R.orders}/${p.orderId}`}>{p.orderReference}</Link></Td><Td>{p.pharmacy} <span className="text-xs text-slate-500">({human(p.method)})</span></Td><Td>{f.date(p.purchasedAt)}</Td><Td><StatusPill status={p.handedOver ? `Handed over${p.handedOverAt ? ` ${f.date(p.handedOverAt)}` : ''}` : human(p.fulfilmentStatus)} /></Td></tr>)}</Table> : <Empty title="No medicines purchased through Sabi" />}
    </Panel>
    <Panel><PanelHeader title="Patient-reported medicines" description={m.definitions.patientReported} />
      {m.patientReported.length ? <ul className="divide-y divide-slate-100">{m.patientReported.map((r, i) => <li key={i} className="flex flex-wrap justify-between gap-2 px-4 py-3 text-sm"><span><span className="font-semibold">{r.name}</span>{r.dosage && <span className="text-slate-500"> · {r.dosage}</span>}<span className="block text-[11px] text-slate-500">{r.source} · {f.date(r.recordedAt)}</span></span>{r.status && <StatusPill status={human(r.status)} />}</li>)}</ul> : <Empty title="Nothing reported by the patient" />}
    </Panel>
    <div className="grid gap-4 [&>*]:min-w-0 lg:grid-cols-2">
      <Panel><PanelHeader title="Conditions and health details" /><KeyValues items={[['Blood type', data.health.bloodType], ['Genotype', data.health.genotype], ['Conditions (self-reported)', data.conditions.map((c) => c.text).join('; ') || '—']]} />
        {data.health.recentVitals.length > 0 && <Table head={['Vital', 'Value', 'Recorded', 'Source']}>{data.health.recentVitals.map((v, i) => <tr key={i}><Td>{human(v.type)}</Td><Td>{v.value} {v.unit}</Td><Td>{f.dateTime(v.recordedAt)}</Td><Td>{v.source}</Td></tr>)}</Table>}
      </Panel>
      <Panel><PanelHeader title="Lab results and documents" /><div className="p-4"><Note>{data.labResults.note}</Note></div>{data.documents.length ? <Table head={['Document', 'Status', 'Uploaded']}>{data.documents.map((d) => <tr key={d.id}><Td>{human(d.kind)}</Td><Td><StatusPill status={human(d.status)} /></Td><Td>{f.date(d.createdAt)}</Td></tr>)}</Table> : <Empty title="No documents uploaded" />}</Panel>
    </div>
    <Panel><PanelHeader title="Consultations" />{data.consultations.length ? <Table head={['When', 'Doctor', 'Type', 'Status', 'Note']}>{data.consultations.map((c) => <tr key={c.id}><Td><Link className="text-emerald-700" to={`${R.consultations}/${c.id}`}>{f.dateTime(c.startsAt)}</Link></Td><Td>{c.doctor}<span className="block text-xs text-slate-500">{c.specialty}</span></Td><Td>{human(c.type)}</Td><Td><StatusPill status={human(c.status)} /></Td><Td>{c.noteSigned ? 'Signed' : c.status === 'COMPLETED' ? <span className="text-amber-700">Not signed</span> : '—'}</Td></tr>)}</Table> : <Empty title="No consultations" />}</Panel>
  </div>;
}

function AccessHistory({ id }: { id: string }) {
  const f = useFormat();
  const [page, setPage] = useState(1);
  const [staffOnly, setStaffOnly] = useState(false);
  const { data, error, loading, reload } = useLoad(() => patientAccessHistory(id, { page, staffOnly }), [id, page, staffOnly]);
  return <Panel><PanelHeader title="Access history" description="Who opened or changed this person’s record, newest first" action={<label className="flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" checked={staffOnly} onChange={(e) => { setStaffOnly(e.target.checked); setPage(1); }} />Sabi staff only</label>} />
    <ErrorBox error={error} retry={reload} />
    {loading && !data ? <Loading /> : data && (data.items.length ? <><Table head={['When', 'Who', 'What', 'Purpose', 'Device / network']}>{data.items.map((e) => <tr key={e.id}><Td>{f.dateTime(e.at)}</Td><Td>{e.actor}{e.byStaff && <span className="ml-1 rounded bg-slate-900 px-1 text-[10px] font-bold text-white">STAFF</span>}{e.roles && <span className="block text-[11px] text-slate-500">{e.roles.join(', ')}</span>}</Td><Td>{e.summary}</Td><Td className="max-w-xs">{e.reason ?? '—'}</Td><Td className="text-xs text-slate-500">{e.device ?? '—'}<span className="block font-mono">{e.ip ?? ''}</span></Td></tr>)}</Table><Pagination page={data.page} pages={data.pages} total={data.total} onPage={setPage} /></> : <Empty title="Nobody has opened this record yet" />)}
  </Panel>;
}

function PatientDetail({ id }: { id: string }) {
  const { can, canAny } = useCc();
  const [account, setAccount] = useState<PatientAccount | null>(null);
  const [clinical, setClinical] = useState<PatientClinical | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<LiveApiError | null>(null);
  const [clinicalError, setClinicalError] = useState<LiveApiError | null>(null);
  const [view, setView] = useState<'account' | 'health' | 'access'>('account');
  const [dialog, setDialog] = useState<ActionDialogProps | null>(null);
  const [flash, setFlash] = useState('');
  const close = () => setDialog(null);

  async function open(reason: string) {
    setBusy(true); setError(null);
    try { setAccount(await openPatientAccount(id, reason)); } catch (e) { setError(e as LiveApiError); } finally { setBusy(false); }
  }
  async function openHealth(reason: string) {
    setBusy(true); setClinicalError(null);
    try { setClinical(await openPatientClinical(id, reason)); } catch (e) { setClinicalError(e as LiveApiError); } finally { setBusy(false); }
  }
  const a = account?.account;
  const emergency = () => setDialog({
    title: 'Start emergency access', confirm: 'Start emergency access', tone: 'danger', reasonLabel: 'Describe the emergency (at least 20 characters)', reasonMin: 20,
    description: <>Emergency access lets you open this patient’s health information for a short time without clinical permission. It is recorded, shown to the patient, and <b>must be reviewed</b> by compliance afterwards. Use it only when someone’s health depends on it.</>,
    fields: [{ name: 'minutes', label: 'For how long', type: 'select', required: true, defaultValue: '15', options: [5, 15, 30, 60].map((n) => ({ value: String(n), label: `${n} minutes` })) }],
    run: (v) => startEmergencyAccess(id, v.reason, Number(v.minutes)), onClose: close,
    onDone: () => { close(); setFlash('Emergency access started. Open health information with your purpose.'); setClinicalError(null); },
  });
  const signOut = () => setDialog({
    title: 'Sign this patient out everywhere', confirm: 'Sign out of all devices', tone: 'danger',
    description: 'Ends every active session and refresh token. Use when the patient reports a lost or stolen phone, or the account looks compromised.',
    run: (v) => revokePatientSessions(id, v.reason), onClose: close,
    onDone: (r) => { close(); setFlash(`Signed out of ${(r as { sessionsRevoked: number }).sessionsRevoked} session(s).`); },
  });
  const changeStatus = () => a && setDialog({
    title: 'Change account status', confirm: 'Change status', tone: 'danger',
    description: <>Currently <b>{human(a.accountStatus)}</b>. Suspending, disabling or banning signs the patient out everywhere.</>,
    fields: [{ name: 'status', label: 'New status', type: 'select', required: true, defaultValue: a.accountStatus === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE', options: ['ACTIVE', 'SUSPENDED', 'DISABLED', 'BANNED'].filter((s) => s !== a.accountStatus).map((s) => ({ value: s, label: human(s) })) }],
    run: (v) => liveApiRequest(`/api/v1/platform/users/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status: v.status, expectedStatus: a.accountStatus, reason: v.reason }) }), onClose: close,
    onDone: () => { close(); setFlash('Account status changed. Re-open the record to see it.'); setAccount(null); },
  });

  return <>
    <Link to={R.patients} className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-slate-600 hover:text-slate-900"><ArrowLeft size={14} />All patients</Link>
    <CommandPageHeader eyebrow="Patient" title={a ? a.name || 'Unnamed patient' : 'Patient record'} description={a ? `${a.patientId} · ${human(a.accountStatus)}` : 'Opening a patient record is logged with your purpose and shown to the patient.'}
      actions={a && <>
        {can('platform.users.manage') && <CommandButton variant="secondary" onClick={signOut}><LogOut size={14} />Sign out everywhere</CommandButton>}
        {can('platform.users.manage') && <CommandButton variant="secondary" onClick={changeStatus}><UserCog size={14} />Change status</CommandButton>}
        {can('platform.support.manage') && <NewCaseButton subjectUserId={id} />}
      </>} />
    {flash && <p role="status" className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{flash}</p>}
    <Tabs label="Patient record" value={view} onChange={setView} tabs={[{ value: 'account', label: 'Account' }, { value: 'health', label: 'Health information' }, { value: 'access', label: 'Access history' }]} />
    {view === 'account' && (account ? <AccountTabs data={account} patientId={id} /> : <PurposeGate title="Why are you opening this account?" description="You will see identity, sessions, sign-in locations, addresses, care circle, orders, payments and consents. Health information is separate." confirm="Open account" onOpen={open} busy={busy} error={error} notice="Sabi staff opened your account details" />)}
    {view === 'health' && (clinical ? <ClinicalView data={clinical} /> : <>
      {!canAny('platform.clinical.read', 'platform.emergency.access') ? <Panel><div className="flex items-start gap-3 p-5"><ShieldCheck size={18} className="mt-0.5 text-slate-400" /><p className="text-sm text-slate-600">Health information needs the clinical oversight role, or emergency access. Your role has neither.</p></div></Panel> : <>
        <PurposeGate title="Why do you need this patient’s health information?" description="Medicines (prescribed, purchased, handed over, self-reported), allergies with their source, conditions, consultations and documents. Opening it is recorded and shown to the patient." confirm="Open health information" onOpen={openHealth} busy={busy} error={clinicalError} notice="Sabi staff opened your health information" />
        {!can('platform.clinical.read') && can('platform.emergency.access') && <Panel className="mt-4"><div className="flex flex-wrap items-center gap-3 p-5"><ShieldAlert size={18} className="text-red-600" /><p className="min-w-0 flex-1 text-sm text-slate-700">Your role cannot open health information routinely. In an emergency you can start time-limited access, which compliance will review.</p><CommandButton variant="danger" onClick={emergency}><AlertTriangle size={14} />Emergency access</CommandButton></div></Panel>}
      </>}
    </>)}
    {view === 'access' && <AccessHistory id={id} />}
    {dialog && <ActionDialog {...dialog} />}
  </>;
}

export default function PatientsPage({ path }: { path: string }) {
  const id = path.startsWith(`${R.patients}/`) ? path.slice(R.patients.length + 1).split('/')[0] : null;
  return <Gate any={['platform.patients.read']} what="Patient records">{id ? <PatientDetail key={id} id={id} /> : <PatientList />}</Gate>;
}

