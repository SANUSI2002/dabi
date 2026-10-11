// Support cases and incidents: one queue with SLA targets, an append-only history per case, and
// updates guarded by version so two agents never overwrite each other.
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Clock, Plus } from 'lucide-react';
import type { LiveApiError } from '@/identity/liveIdentity';
import { cn } from '@/lib/cn';
import { CommandButton, CommandInput, CommandPageHeader, CommandSelect, Panel, PanelHeader, StatusPill } from '../components/ui';
import { caseMeta, createCase, getCase, listCases, updateCase, type CaseDetail } from './api';
import { Empty, ErrorBox, Field, FilterBar, Gate, KeyValues, Loading, Pagination, Table, Td, human, useCc, useFormat, useLoad } from './kit';
import { R } from './routes';

const PRIORITIES = [{ value: 'P1', label: 'P1 · Critical' }, { value: 'P2', label: 'P2 · High' }, { value: 'P3', label: 'P3 · Normal' }, { value: 'P4', label: 'P4 · Low' }];
const priorityTone: Record<string, string> = { P1: 'bg-red-600 text-white', P2: 'bg-orange-500 text-white', P3: 'bg-slate-200 text-slate-700', P4: 'bg-slate-100 text-slate-500' };
export const PriorityBadge = ({ p }: { p: string }) => <span className={cn('rounded px-1.5 py-0.5 text-[11px] font-bold', priorityTone[p])}>{p}</span>;

function CaseForm({ kind, subjectUserId, orderId, onClose }: { kind: 'SUPPORT' | 'INCIDENT'; subjectUserId?: string; orderId?: string; onClose: (createdId?: string) => void }) {
  const meta = useLoad(() => caseMeta(), []);
  const [form, setForm] = useState({ kind, category: kind === 'INCIDENT' ? 'TECHNICAL' : 'ORDER', priority: kind === 'INCIDENT' ? 'P2' : 'P3', title: '', description: '', assigneeUserId: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<LiveApiError | null>(null);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const sla = meta.data?.slaHours[form.kind]?.[form.priority];
  async function submit() {
    setBusy(true); setError(null);
    try {
      const created = await createCase({ ...form, assigneeUserId: form.assigneeUserId || undefined, subjectUserId, orderId });
      onClose(created.id);
    } catch (e) { setError(e as LiveApiError); } finally { setBusy(false); }
  }
  return <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-950/50 sm:items-center sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
    <div role="dialog" aria-modal="true" aria-label={`New ${kind === 'INCIDENT' ? 'incident' : 'support case'}`} className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl" onKeyDown={(e) => { if (e.key === 'Escape' && !busy) onClose(); }}>
      <h2 className="font-display text-lg font-bold">New {kind === 'INCIDENT' ? 'incident' : 'support case'}</h2>
      {(subjectUserId || orderId) && <p className="mt-1 text-xs text-slate-500">Linked to this {subjectUserId ? 'patient' : 'order'}.</p>}
      <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        <Field label="Type"><CommandSelect value={form.kind} onChange={set('kind')}><option value="SUPPORT">Support case</option><option value="INCIDENT">Incident</option></CommandSelect></Field>
        <Field label="Category"><CommandSelect value={form.category} onChange={set('category')}>{(meta.data?.categories ?? [form.category]).map((c) => <option key={c} value={c}>{human(c)}</option>)}</CommandSelect></Field>
        <Field label="Priority"><CommandSelect value={form.priority} onChange={set('priority')}>{PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}</CommandSelect>{sla && <span className="text-[11px] font-normal text-slate-500">Resolve within {sla} hours</span>}</Field>
        <Field label="Assign to (optional)"><CommandSelect value={form.assigneeUserId} onChange={set('assigneeUserId')}><option value="">Unassigned</option>{meta.data?.items.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</CommandSelect></Field>
        <Field label="Title" className="sm:col-span-2"><CommandInput value={form.title} onChange={set('title')} maxLength={160} placeholder="Short summary" /></Field>
        <Field label="What happened" className="sm:col-span-2"><textarea rows={4} value={form.description} onChange={set('description')} maxLength={2000} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal" placeholder="Facts, times, references. Avoid clinical detail unless needed." /></Field>
        {error && <div className="sm:col-span-2"><ErrorBox error={error} /></div>}
        <div className="flex justify-end gap-2 sm:col-span-2"><CommandButton type="button" variant="secondary" onClick={() => onClose()} disabled={busy}>Cancel</CommandButton><CommandButton type="submit" disabled={busy || form.title.trim().length < 5 || form.description.trim().length < 10}>{busy ? 'Opening…' : 'Open case'}</CommandButton></div>
      </form>
    </div>
  </div>;
}

export function NewCaseButton({ subjectUserId, orderId, kind = 'SUPPORT' }: { subjectUserId?: string; orderId?: string; kind?: 'SUPPORT' | 'INCIDENT' }) {
  const { can } = useCc();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  if (!can('platform.support.manage')) return null;
  return <><CommandButton variant="secondary" onClick={() => setOpen(true)}><Plus size={14} />{kind === 'INCIDENT' ? 'Declare incident' : 'Open case'}</CommandButton>{open && <CaseForm kind={kind} subjectUserId={subjectUserId} orderId={orderId} onClose={(id) => { setOpen(false); if (id) navigate(`${R.cases}/${id}`); }} />}</>;
}

function CaseList({ kind }: { kind: 'SUPPORT' | 'INCIDENT' }) {
  const navigate = useNavigate();
  const f = useFormat();
  const [params] = useSearchParams();
  const [status, setStatus] = useState(params.get('status') ?? 'ACTIVE');
  const [priority, setPriority] = useState('');
  const [assignee, setAssignee] = useState('');
  const [overdue, setOverdue] = useState(false);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [status, priority, assignee, overdue, q]);
  const { data, error, loading, reload } = useLoad(() => listCases({ kind, status: status || undefined, priority: priority || undefined, assignee: assignee || undefined, overdue: overdue ? 'true' : undefined, q: q || undefined, page }), [kind, status, priority, assignee, overdue, q, page]);
  const base = kind === 'INCIDENT' ? R.incidents : R.cases;
  return <>
    <CommandPageHeader eyebrow="Operations" title={kind === 'INCIDENT' ? 'Incidents' : 'Support cases'} description={kind === 'INCIDENT' ? 'Service problems affecting patients, providers or payments, from declaration to resolution.' : 'Patient and provider issues with response targets, owners and a full history.'} actions={<NewCaseButton kind={kind} />} />
    <Panel>
      <FilterBar>
        <Field label="Search"><CommandInput type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Reference or title" /></Field>
        <Field label="Status"><CommandSelect value={status} onChange={(e) => setStatus(e.target.value)}><option value="ACTIVE">Open (any)</option>{['OPEN', 'IN_PROGRESS', 'WAITING', 'RESOLVED', 'CLOSED'].map((s) => <option key={s} value={s}>{human(s)}</option>)}<option value="">All</option></CommandSelect></Field>
        <Field label="Priority"><CommandSelect value={priority} onChange={(e) => setPriority(e.target.value)}><option value="">All</option>{PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}</CommandSelect></Field>
        <Field label="Owner"><CommandSelect value={assignee} onChange={(e) => setAssignee(e.target.value)}><option value="">Anyone</option><option value="me">Me</option><option value="none">Unassigned</option></CommandSelect></Field>
        <label className="flex h-9 items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={overdue} onChange={(e) => setOverdue(e.target.checked)} />Overdue only</label>
      </FilterBar>
      <ErrorBox error={error} retry={reload} />
      {loading && !data ? <Loading /> : data && (data.items.length ? <>
        <Table caption={kind === 'INCIDENT' ? 'Incidents' : 'Support cases'} head={['Case', 'Title', 'Priority', 'Status', 'Owner', 'Due', 'Opened']}>{data.items.map((c) => <tr key={c.id} className="cursor-pointer hover:bg-slate-50" onClick={() => navigate(`${base}/${c.id}`)}>
          <Td><Link to={`${base}/${c.id}`} onClick={(e) => e.stopPropagation()} className="font-mono text-xs font-semibold text-emerald-700">{c.reference}</Link></Td><Td><span className="font-semibold text-slate-900">{c.title}</span><span className="block text-xs text-slate-500">{human(c.category)}{c.subject && ` · ${c.subject}`}</span></Td><Td><PriorityBadge p={c.priority} /></Td><Td><StatusPill status={human(c.status)} /></Td><Td>{c.assignee ?? <span className="text-slate-400">Unassigned</span>}</Td><Td className={c.overdue ? 'font-semibold text-red-700' : 'text-slate-600'}>{c.dueAt ? f.dateTime(c.dueAt) : '—'}{c.overdue && <span className="block text-[11px]">Overdue</span>}</Td><Td className="text-xs text-slate-500">{f.ago(c.createdAt)}</Td>
        </tr>)}</Table>
        <Pagination page={data.page} pages={data.pages} total={data.total} onPage={setPage} />
      </> : <Empty title={status === 'ACTIVE' ? 'Nothing open' : 'No cases match'} hint="Cases appear here when staff open them from a patient, an order, or this page." />)}
    </Panel>
  </>;
}

function UpdateForm({ c, onSaved }: { c: CaseDetail; onSaved: () => void }) {
  const meta = useLoad(() => caseMeta(), []);
  const [note, setNote] = useState('');
  const [status, setStatus] = useState('');
  const [resolution, setResolution] = useState(c.resolution ?? '');
  const [priority, setPriority] = useState(c.priority);
  const [assignee, setAssignee] = useState(c.assigneeUserId ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<LiveApiError | null>(null);
  const resolving = ['RESOLVED', 'CLOSED'].includes(status);
  const changed = note.trim() || status || priority !== c.priority || (assignee || null) !== c.assigneeUserId;
  async function save() {
    setBusy(true); setError(null);
    try {
      await updateCase(c.id, {
        version: c.version, note: note.trim() || undefined, status: status || undefined, resolution: resolving && resolution.trim() ? resolution.trim() : undefined,
        priority: priority !== c.priority ? priority : undefined, assigneeUserId: (assignee || null) !== c.assigneeUserId ? (assignee || null) : undefined,
      });
      setNote(''); setStatus(''); onSaved();
    } catch (e) { setError(e as LiveApiError); } finally { setBusy(false); }
  }
  if (c.status === 'CLOSED') return <Panel><p className="p-4 text-sm text-slate-500">This case is closed.</p></Panel>;
  return <Panel><PanelHeader title="Update" description="Every change is added to the history; nothing is overwritten." />
    <form className="grid gap-3 p-4" onSubmit={(e) => { e.preventDefault(); if (changed) void save(); }}>
      <Field label="Note"><textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal" placeholder="What you did or learned" /></Field>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Move to"><CommandSelect value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Keep {human(c.status).toLowerCase()}</option>{c.allowedTransitions.map((s) => <option key={s} value={s}>{human(s)}</option>)}</CommandSelect></Field>
        <Field label="Priority"><CommandSelect value={priority} onChange={(e) => setPriority(e.target.value)}>{PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}</CommandSelect></Field>
        <Field label="Owner"><CommandSelect value={assignee} onChange={(e) => setAssignee(e.target.value)}><option value="">Unassigned</option>{meta.data?.items.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</CommandSelect></Field>
      </div>
      {resolving && <Field label="Resolution (required)"><textarea rows={2} value={resolution} onChange={(e) => setResolution(e.target.value)} maxLength={1000} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal" placeholder="What was done to resolve it" /></Field>}
      {error && <ErrorBox error={error.code === 'STALE' ? Object.assign(new Error('Someone else updated this case. It has been refreshed; review their change and try again.'), { status: 409 }) : error} />}
      <div className="flex justify-end"><CommandButton type="submit" disabled={busy || !changed || (resolving && resolution.trim().length < 10 && !c.resolution)}>{busy ? 'Saving…' : 'Save update'}</CommandButton></div>
    </form>
  </Panel>;
}

function CaseView({ id, kind }: { id: string; kind: 'SUPPORT' | 'INCIDENT' }) {
  const f = useFormat();
  const { can } = useCc();
  const { data: c, error, loading, reload } = useLoad(() => getCase(id), [id]);
  const base = kind === 'INCIDENT' ? R.incidents : R.cases;
  if (loading && !c) return <Loading />;
  if (!c) return <ErrorBox error={error} retry={reload} />;
  return <>
    <Link to={base} className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-slate-600 hover:text-slate-900"><ArrowLeft size={14} />{kind === 'INCIDENT' ? 'All incidents' : 'All cases'}</Link>
    <CommandPageHeader eyebrow={`${c.reference} · ${human(c.kind)}`} title={c.title} actions={<><PriorityBadge p={c.priority} /><StatusPill status={human(c.status)} /></>} />
    {c.overdue && <p className="mb-3 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"><Clock size={14} />Past its response target ({f.dateTime(c.dueAt)}).</p>}
    <div className="grid gap-4 [&>*]:min-w-0 xl:grid-cols-[1fr_380px]">
      <div className="grid gap-4 [&>*]:min-w-0 self-start">
        <Panel><PanelHeader title="History" />
          <ol className="divide-y divide-slate-100">{c.events.map((e) => <li key={e.id} className="px-4 py-3 text-sm"><p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{human(e.kind)} · {e.actor} · {f.dateTime(e.createdAt)}</p>{e.kind === 'STATUS' && <p className="font-semibold text-slate-800">{human(e.fromStatus)} → {human(e.toStatus)}</p>}{e.body && <p className="mt-0.5 whitespace-pre-wrap text-slate-700">{e.body}</p>}</li>)}</ol>
        </Panel>
        {can('platform.support.manage') ? <UpdateForm key={c.version} c={c} onSaved={reload} /> : <Panel><p className="p-4 text-sm text-slate-500">You can view cases but not update them.</p></Panel>}
      </div>
      <Panel className="self-start"><PanelHeader title="Details" /><KeyValues items={[
        ['Category', human(c.category)], ['Owner', c.assignee ?? 'Unassigned'], ['Opened by', c.createdBy], ['Opened', f.dateTime(c.createdAt)], ['Due', f.dateTime(c.dueAt)], ['Resolved', f.dateTime(c.resolvedAt)],
        ['Patient', c.subject ? <Link key="k148-34" className="text-emerald-700" to={`${R.patients}/${c.subject.id}`}>{c.subject.name}</Link> : '—'],
        ['Order', c.order ? <Link key="k149-30" className="text-emerald-700" to={`${R.orders}/${c.order.id}`}>{c.order.reference}</Link> : '—'],
        ['Pharmacy', c.pharmacy?.name ?? '—'], ['Doctor', c.doctor?.name ?? '—'], ['Resolution', c.resolution ?? '—'],
      ]} /></Panel>
    </div>
  </>;
}

export default function CasesPage({ path, kind }: { path: string; kind: 'SUPPORT' | 'INCIDENT' }) {
  const base = kind === 'INCIDENT' ? R.incidents : R.cases;
  const id = path.startsWith(`${base}/`) ? path.slice(base.length + 1).split('/')[0] : null;
  return <Gate any={['platform.support.manage', 'platform.ops.read']} what={kind === 'INCIDENT' ? 'Incidents' : 'Support cases'}>{id ? <CaseView key={id} id={id} kind={kind} /> : <CaseList key={kind} kind={kind} />}</Gate>;
}
