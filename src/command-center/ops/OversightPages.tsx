// Consultation oversight (status and timeline, never clinical content) and provider credentials
// (licence expiry across doctors, pharmacies and branches; suspend or reinstate a doctor with a reason).
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/cn';
import { CommandButton, CommandPageHeader, CommandSelect, Panel, PanelHeader, StatusPill } from '../components/ui';
import { getConsultation, listConsultations, listCredentials, providerSummary, setDoctorStatus, type CredentialRow } from './api';
import { ActionDialog, Empty, ErrorBox, Field, FilterBar, Gate, KeyValues, Loading, Note, Pagination, Table, Td, Timeline, human, useCc, useFormat, useLoad, type ActionDialogProps } from './kit';
import { R } from './routes';

const ATTENTION = [
  { value: '', label: 'Everything' },
  { value: 'overdue-confirmation', label: 'Requested > 24 h, not answered' },
  { value: 'not-completed', label: 'Ended > 2 h ago, not completed' },
  { value: 'unsigned-note', label: 'Completed, note not signed' },
];

function ConsultationList() {
  const navigate = useNavigate();
  const f = useFormat();
  const [params] = useSearchParams();
  const [status, setStatus] = useState(params.get('status') ?? '');
  const [type, setType] = useState('');
  const [attention, setAttention] = useState('');
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [status, type, attention]);
  const { data, error, loading, reload } = useLoad(() => listConsultations({ status: status || undefined, type: type || undefined, attention: attention || undefined, page }), [status, type, attention, page]);
  return <>
    <CommandPageHeader eyebrow="Sabi Health · Telemedicine" title="Consultations" description="Every doctor appointment, its status and timeline. Clinical notes are not shown here." />
    <Panel>
      <FilterBar>
        <Field label="Needs attention"><CommandSelect value={attention} onChange={(e) => setAttention(e.target.value)}>{ATTENTION.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}</CommandSelect></Field>
        <Field label="Status"><CommandSelect value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All</option>{['REQUESTED', 'CONFIRMED', 'COMPLETED', 'DECLINED', 'CANCELLED'].map((s) => <option key={s} value={s}>{human(s)}</option>)}</CommandSelect></Field>
        <Field label="Type"><CommandSelect value={type} onChange={(e) => setType(e.target.value)}><option value="">All</option><option value="VIRTUAL">Video</option><option value="IN_PERSON">In person</option></CommandSelect></Field>
      </FilterBar>
      <ErrorBox error={error} retry={reload} />
      {loading && !data ? <Loading /> : data && (data.items.length ? <><Table caption="Consultations" head={['When', 'Patient', 'Doctor', 'Type', 'Status', 'Note']}>{data.items.map((c) => <tr key={c.id} className="cursor-pointer hover:bg-slate-50" onClick={() => navigate(`${R.consultations}/${c.id}`)}>
        <Td><Link to={`${R.consultations}/${c.id}`} onClick={(e) => e.stopPropagation()} className="font-semibold text-emerald-700">{f.dateTime(c.startsAt)}</Link></Td><Td>{c.patient.name ?? '—'}<span className="block font-mono text-[11px] text-slate-500">{c.patient.patientId}{c.forDependent && ' · for a dependent'}</span></Td><Td>{c.doctor.name}<span className="block text-xs text-slate-500">{c.doctor.specialty ?? 'General'}</span></Td><Td>{c.type === 'VIRTUAL' ? 'Video' : 'In person'}</Td><Td><StatusPill status={human(c.status)} /></Td><Td>{c.noteSigned ? 'Signed' : c.status === 'COMPLETED' ? <span className="text-amber-700">Not signed</span> : '—'}</Td>
      </tr>)}</Table><Pagination page={data.page} pages={data.pages} total={data.total} onPage={setPage} /></> : <Empty title="No consultations match" />)}
    </Panel>
  </>;
}

function ConsultationView({ id }: { id: string }) {
  const f = useFormat();
  const { can } = useCc();
  const { data: c, error, loading, reload } = useLoad(() => getConsultation(id), [id]);
  return <>
    <Link to={R.consultations} className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-slate-600 hover:text-slate-900"><ArrowLeft size={14} />All consultations</Link>
    {loading && !c ? <Loading /> : !c ? <ErrorBox error={error} retry={reload} /> : <>
      <CommandPageHeader eyebrow="Consultation" title={`${c.doctor.name ?? 'Doctor'} with ${c.patient.name ?? 'patient'}`} description={`${c.type === 'VIRTUAL' ? 'Video' : 'In person'} · ${f.dateTime(c.startsAt)}`} actions={<StatusPill status={human(c.status)} />} />
      <div className="grid gap-4 [&>*]:min-w-0 xl:grid-cols-[1fr_380px]">
        <Panel className="self-start"><PanelHeader title="Timeline" /><Timeline events={c.timeline} /></Panel>
        <Panel className="self-start"><PanelHeader title="Details" /><KeyValues items={[
          ['Patient', can('platform.patients.read') ? <Link key="k56-56" className="text-emerald-700" to={`${R.patients}/${c.patient.id}`}>{c.patient.name} ({c.patient.patientId})</Link> : c.patient.patientId], ['Doctor', `${c.doctor.name} · ${c.doctor.specialty ?? 'General'}`],
          ['Ends', f.dateTime(c.endsAt)], ['Reason given by patient', c.reasonGiven ? 'Yes (not shown)' : 'No'], ['Note', c.note.signed ? 'Signed' : c.note.started ? 'Started, not signed' : 'Not started'], ['Note last changed', f.dateTime(c.note.lastChangedAt)],
        ]} /><div className="px-4 pb-4"><Note>{c.contentNote}</Note></div></Panel>
      </div>
    </>}
  </>;
}

export function ConsultationsPage({ path }: { path: string }) {
  const id = path.startsWith(`${R.consultations}/`) ? path.slice(R.consultations.length + 1).split('/')[0] : null;
  return <Gate any={['platform.ops.read']} what="Consultations">{id ? <ConsultationView key={id} id={id} /> : <ConsultationList />}</Gate>;
}

const STATE_TONE: Record<CredentialRow['state'], string> = { EXPIRED: 'text-red-700', EXPIRING: 'text-amber-700', VALID: 'text-slate-600', UNKNOWN: 'text-slate-500' };

export function CredentialsPage() {
  const f = useFormat();
  const { can } = useCc();
  const [within, setWithin] = useState(60);
  const [kind, setKind] = useState('');
  const [dialog, setDialog] = useState<ActionDialogProps | null>(null);
  const [flash, setFlash] = useState('');
  const { data, error, loading, reload } = useLoad(() => listCredentials({ within, kind: kind || undefined }), [within, kind]);
  const summary = useLoad(() => providerSummary(), []);
  const doctorAction = (row: CredentialRow, action: 'suspend' | 'reinstate') => setDialog({
    title: `${action === 'suspend' ? 'Suspend' : 'Reinstate'} ${row.name}`, confirm: action === 'suspend' ? 'Suspend doctor' : 'Reinstate doctor', tone: action === 'suspend' ? 'danger' : 'primary',
    description: action === 'suspend' ? 'A suspended doctor cannot take new consultations or prescribe through Sabi until reinstated. The reason is recorded and shown to auditors.' : 'The doctor regains access. Confirm their licence has been renewed or the concern resolved.',
    run: (v) => setDoctorStatus(row.id, action, v.reason), onClose: () => setDialog(null), onDone: () => { setDialog(null); setFlash(`${row.name} ${action === 'suspend' ? 'suspended' : 'reinstated'}.`); reload(); summary.reload(); },
  });
  const counts = summary.data;
  return <Gate any={['platform.ops.read', 'platform.providers.manage']} what="Provider credentials">
    <CommandPageHeader eyebrow="Sabi Health · Providers" title="Credentials & expiry" description="Practising and premises licences that have expired or expire soon, across doctors, pharmacies and branches." />
    {counts && <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4">{(['doctors', 'pharmacies', 'organisations', 'riders'] as const).map((k) => <div key={k} className="rounded-xl bg-white p-3 ring-1 ring-slate-200"><p className="text-[10px] font-bold uppercase tracking-[.1em] text-slate-500">{k}</p><p className="mt-1 text-xs text-slate-600">{Object.entries(counts[k]).map(([s, n]) => `${k === 'riders' ? (s === 'true' ? 'active' : 'inactive') : human(s).toLowerCase()} ${n}`).join(' · ') || 'none'}</p></div>)}</div>}
    {flash && <p role="status" className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{flash}</p>}
    <Panel>
      <FilterBar>
        <Field label="Expiring within"><CommandSelect value={within} onChange={(e) => setWithin(Number(e.target.value))}>{[14, 30, 60, 90, 180].map((d) => <option key={d} value={d}>{d} days (and expired)</option>)}</CommandSelect></Field>
        <Field label="Provider"><CommandSelect value={kind} onChange={(e) => setKind(e.target.value)}><option value="">All</option><option value="doctor">Doctors</option><option value="pharmacy">Pharmacies</option><option value="branch">Pharmacy branches</option></CommandSelect></Field>
      </FilterBar>
      <ErrorBox error={error} retry={reload} />
      {loading && !data ? <Loading /> : data && (data.items.length ? <Table caption="Credentials" head={['Provider', 'Credential', 'Expires', 'Provider status', '']}>{data.items.map((r) => <tr key={`${r.kind}-${r.id}`}>
        <Td><span className="font-semibold">{r.name}</span><span className="block text-xs text-slate-500">{human(r.kind)}</span></Td><Td>{r.credential}</Td>
        <Td className={cn('font-semibold', STATE_TONE[r.state])}>{r.expiresAt ? f.date(r.expiresAt) : 'No date on file'}<span className="block text-[11px] font-normal">{r.state === 'EXPIRED' ? `Expired ${Math.abs(r.daysLeft ?? 0)} day(s) ago` : r.daysLeft !== null ? `${r.daysLeft} day(s) left` : 'Check the application'}</span></Td>
        <Td><StatusPill status={human(r.providerStatus)} /></Td>
        <Td><div className="flex justify-end gap-1">
          {r.kind === 'doctor' && can('platform.providers.manage') && r.providerStatus === 'VERIFIED' && <CommandButton className="h-8" variant="secondary" onClick={() => doctorAction(r, 'suspend')}>Suspend</CommandButton>}
          {r.kind === 'doctor' && can('platform.providers.manage') && r.providerStatus === 'SUSPENDED' && <CommandButton className="h-8" variant="secondary" onClick={() => doctorAction(r, 'reinstate')}>Reinstate</CommandButton>}
          {r.kind === 'doctor' && <Link className="self-center text-xs font-semibold text-emerald-700" to={R.doctors}>Doctors</Link>}
          {r.kind !== 'doctor' && <Link className="self-center text-xs font-semibold text-emerald-700" to={`${R.pharmacies}/${r.pharmacyId ?? r.id}`}>Open pharmacy</Link>}
        </div></Td>
      </tr>)}</Table> : <Empty title="Nothing expires in this window" hint="Widen the window to plan renewals further ahead." />)}
      <div className="p-4"><Note>Pharmacies are suspended from their pharmacy page (it also updates their branches and emails the owner). Doctors can be suspended here.</Note></div>
    </Panel>
    {dialog && <ActionDialog {...dialog} />}
  </Gate>;
}
