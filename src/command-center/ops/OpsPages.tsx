// Background jobs (with safe, audited retries), integrations (status only — never a key or token) and
// system health: alerts evaluated live with where to act.
import { Fragment, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertOctagon, AlertTriangle, CheckCircle2, Info, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/cn';
import { CommandButton, CommandPageHeader, CommandSelect, Panel, PanelHeader, StatusPill } from '../components/ui';
import { alerts, integrations, jobSummary, listJobs, retryJob, type Integration, type JobRow, type JobType } from './api';
import { ActionDialog, Empty, ErrorBox, Field, FilterBar, Gate, Loading, Note, Pagination, Table, Tabs, Td, human, useCc, useFormat, useLoad, type ActionDialogProps } from './kit';
import { drillTo } from './routes';

const TYPES: { value: JobType; label: string }[] = [{ value: 'notification', label: 'Notifications' }, { value: 'reminder', label: 'Medicine reminders' }, { value: 'pharmacy-email', label: 'Pharmacy emails' }, { value: 'emr-webhook', label: 'Hospital webhooks' }, { value: 'document-scan', label: 'Malware scans' }, { value: 'subscription-email', label: 'Subscription emails' }, { value: 'rider-email', label: 'Rider emails' }, { value: 'rider-transfer', label: 'Rider transfer checks' }];
const STATUS_OPTIONS: Record<JobType, string[]> = {
  'subscription-email': ['QUEUED', 'SENDING', 'SENT', 'FAILED'],
  'rider-email': ['PENDING', 'SENT', 'FAILED', 'CANCELLED'],
  'rider-transfer': ['SUBMITTED', 'UNKNOWN', 'NEEDS_PROVIDER_AUTH', 'PAID', 'FAILED', 'REVERSED'],
  notification: ['PENDING', 'SENT', 'DELIVERED', 'READ', 'FAILED', 'SKIPPED', 'CANCELLED'],
  reminder: ['SCHEDULED', 'SENT', 'FAILED', 'CANCELLED', 'SKIPPED'],
  'pharmacy-email': ['QUEUED', 'SENT', 'FAILED', 'CANCELLED'],
  'emr-webhook': ['PENDING', 'DELIVERED', 'DEAD'],
  'document-scan': ['PENDING', 'FAILED', 'INFECTED', 'REJECTED'],
};

function jobCells(type: JobType, j: JobRow, f: ReturnType<typeof useFormat>) {
  const s = (k: string) => (j[k] === null || j[k] === undefined ? '—' : String(j[k]));
  if (type === 'subscription-email' || type === 'rider-email' || type === 'rider-transfer') return [s('recipient'), s('reference') === '—' ? human(s('kind')) : s('reference'), s(type === 'rider-transfer' ? 'number' : 'attempts'), s('errorCode') === '—' ? s('lastErrorCode') : s('errorCode'), f.dateTime((j.sentAt ?? j.createdAt) as string)];
  if (type === 'notification') return [<>{s('recipient')}<span className="block text-[11px] text-slate-500">{human(s('channel'))}</span></>, <>{human(s('category'))}<span className="block text-[11px] text-slate-500">{s('eventType')}</span></>, s('attempts'), <span key="k22-261" className="text-xs text-red-700">{j.lastError ? s('lastError') : ''}</span>, f.dateTime(j.updatedAt as string)];
  if (type === 'document-scan') return [<Fragment key="file">{s('source')}<span className="block text-[11px] text-slate-500">{human(s('what'))}</span></Fragment>, s('owner'), j.attempts === null ? '—' : s('attempts'), <span key="problem" className="text-xs text-red-700">{j.error ? human(s('error')) : j.status === 'PENDING' ? 'Waiting for the scanner' : ''}</span>, <Fragment key="since">{f.dateTime(j.since as string)}{j.retryOn ? <span className="block text-[11px] text-slate-500">Retry from the {String(j.retryOn)} review page</span> : null}</Fragment>];
  if (type === 'reminder') return [s('recipient'), f.dateTime(j.dueAt as string), s('snoozeCount'), <span key="k23-102" className="text-xs text-red-700">{j.lastError ? s('lastError') : ''}</span>, f.dateTime(j.processedAt as string)];
  if (type === 'pharmacy-email') return [<>{(j.pharmacy as { name: string } | null)?.name ?? '—'}<span className="block text-[11px] text-slate-500">{s('recipient')}</span></>, human(s('kind')), s('attempts'), <span key="k24-213" className="text-xs text-red-700">{j.lastErrorCode ? human(s('lastErrorCode')) : ''}</span>, f.dateTime((j.sentAt ?? j.createdAt) as string)];
  return [s('organization'), <span key="k25-31" className="font-mono text-[11px]">{s('eventId').slice(0, 8)}</span>, s('attempts'), <span key="k25-121" className="text-xs text-red-700">{[j.lastStatusCode && `HTTP ${s('lastStatusCode')}`, j.lastError && s('lastError')].filter(Boolean).join(' · ')}</span>, f.dateTime((j.deliveredAt ?? j.createdAt) as string)];
}
const HEADS: Record<JobType, string[]> = {
  'subscription-email': ['Recipient', 'Email', 'Attempts', 'Last error', 'Sent / created'],
  'rider-email': ['Recipient (not exposed)', 'Email', 'Attempts', 'Last error', 'Sent / created'],
  'rider-transfer': ['Recipient (not exposed)', 'Reference', 'Attempt', 'Last error', 'Created'],
  notification: ['Recipient', 'What', 'Attempts', 'Last error', 'Updated'],
  reminder: ['Patient', 'Due', 'Snoozes', 'Last error', 'Processed'],
  'pharmacy-email': ['Pharmacy', 'Email', 'Attempts', 'Last error', 'Sent / created'],
  'emr-webhook': ['Hospital', 'Event', 'Attempts', 'Last response', 'Delivered / created'],
  'document-scan': ['File', 'Owner', 'Attempts', 'Problem', 'Since'],
};

export function JobsPage({ defaultType = 'notification' }: { defaultType?: JobType }) {
  const f = useFormat();
  const { can } = useCc();
  const [params] = useSearchParams();
  const [type, setType] = useState<JobType>((params.get('type') as JobType) || defaultType);
  const [status, setStatus] = useState(params.get('status') ?? '');
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState<ActionDialogProps | null>(null);
  useEffect(() => { setPage(1); }, [type, status]);
  const summary = useLoad(() => jobSummary(), []);
  const { data, error, loading, reload } = useLoad(() => listJobs({ type, status: status || undefined, page }), [type, status, page]);
  const retry = (j: JobRow) => setDialog({
    title: 'Retry this job', confirm: 'Queue retry', reasonLabel: 'Why it is safe to retry now (recorded)',
    description: type === 'notification' ? 'The notification is re-checked before sending and is skipped if it has become stale.' : 'The job is queued for another attempt with fresh retry limits.',
    run: (v) => retryJob(type, j.id, v.reason), onClose: () => setDialog(null), onDone: () => { setDialog(null); reload(); summary.reload(); },
  });
  const counts = summary.data?.types[type];
  return <Gate any={['platform.ops.read', 'platform.jobs.manage']} what="Background jobs">
    <CommandPageHeader eyebrow="Platform operations" title="Jobs & notifications" description="Everything Sabi sends or syncs in the background: patient notifications, medicine reminders, pharmacy emails and hospital webhooks." />
    <Tabs label="Job type" value={type} onChange={(t) => { setType(t); setStatus(''); }} tabs={TYPES.map((t) => ({ ...t, count: summary.data ? (summary.data.types[t.value].counts.FAILED ?? 0) + (summary.data.types[t.value].counts.DEAD ?? 0) : undefined }))} />
    {counts && <div className="mb-3 flex flex-wrap gap-2 text-xs">{Object.entries(counts.counts).map(([k, v]) => <button key={k} onClick={() => setStatus(k)} className={cn('rounded-full px-2.5 py-1 ring-1', status === k ? 'bg-slate-900 text-white ring-slate-900' : 'bg-white text-slate-600 ring-slate-200')}>{human(k)} · {v}</button>)}<span className="self-center text-slate-500">({counts.window})</span>{counts.outbox && <span className="self-center text-slate-500">· outbox waiting: {counts.outbox.pending}{counts.outbox.oldestPendingAt && `, oldest ${f.ago(counts.outbox.oldestPendingAt)}`}</span>}</div>}
    {counts?.note && <div className="mb-3"><Note>{counts.note}</Note></div>}
    <Panel>
      <FilterBar><Field label="Status"><CommandSelect value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All</option>{STATUS_OPTIONS[type].map((s) => <option key={s} value={s}>{human(s)}</option>)}</CommandSelect></Field></FilterBar>
      <ErrorBox error={error} retry={reload} />
      {loading && !data ? <Loading /> : data && (data.items.length ? <><Table caption={`${type} jobs`} head={['Status', ...HEADS[type], '']}>{data.items.map((j) => <tr key={j.id}><Td><StatusPill status={human(j.status)} /></Td>{jobCells(type, j, f).map((c, i) => <Td key={i}>{c}</Td>)}<Td>{j.retryable && can('platform.jobs.manage') && <CommandButton className="h-8" variant="secondary" onClick={() => retry(j)}><RotateCcw size={13} />Retry</CommandButton>}</Td></tr>)}</Table><Pagination page={data.page} pages={data.pages} total={data.total} onPage={setPage} /></> : <Empty title="No jobs in this view" />)}
    </Panel>
    {dialog && <ActionDialog {...dialog} />}
  </Gate>;
}

const INTEGRATION_TONE: Record<Integration['status'], string> = { CONFIGURED: 'Connected', SANDBOX: 'Sandbox', DEGRADED: 'Degraded', NOT_CONFIGURED: 'Not configured' };

export function IntegrationsPage() {
  const f = useFormat();
  const { data, error, loading, reload } = useLoad(() => integrations(), []);
  return <Gate any={['platform.ops.read', 'platform.jobs.manage']} what="Integrations">
    <CommandPageHeader eyebrow="Platform" title="Integrations" description="Each external service Sabi relies on: whether it is configured, in sandbox, or off, and its recent activity. Keys and tokens are never shown." />
    <ErrorBox error={error} retry={reload} />
    {loading && !data ? <Panel><Loading /></Panel> : data && <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{data.items.map((i) => <Panel key={i.key}><div className="p-4">
      <div className="flex items-start justify-between gap-2"><div><h2 className="text-sm font-bold text-slate-900">{i.name}</h2><p className="text-xs text-slate-500">{i.purpose}</p></div><StatusPill status={INTEGRATION_TONE[i.status]} /></div>
      <p className="mt-3 text-sm text-slate-700">{i.detail}</p>
      {i.activity && <dl className="mt-3 grid gap-1 text-xs text-slate-500">{Object.entries(i.activity).map(([k, v]) => <div key={k} className="flex justify-between gap-2"><dt>{human(k.replace(/([A-Z])/g, '_$1'))}</dt><dd className="text-right text-slate-700">{v === null ? '—' : typeof v === 'object' ? Object.entries(v as Record<string, number>).map(([a, b]) => `${human(a).toLowerCase()} ${b}`).join(' · ') || 'none' : String(v).includes('T') ? f.dateTime(String(v)) : String(v)}</dd></div>)}</dl>}
    </div></Panel>)}</div>}
    {data && <p className="mt-3 text-xs text-slate-500">Checked {f.dateTime(data.generatedAt)}. Configuration changes are made on the server (environment settings), not here.</p>}
  </Gate>;
}

const ALERT_ICON = { critical: <AlertOctagon size={17} className="text-red-600" />, warning: <AlertTriangle size={17} className="text-amber-600" />, info: <Info size={17} className="text-sky-600" /> };

export function HealthPage() {
  const f = useFormat();
  const list = useLoad(() => alerts(), []);
  const ints = useLoad(() => integrations(), []);
  const jobs = useLoad(() => jobSummary(), []);
  const failing = jobs.data ? Object.entries(jobs.data.types).map(([k, v]) => [k, (v.counts.FAILED ?? 0) + (v.counts.DEAD ?? 0)] as const) : [];
  return <Gate any={['platform.ops.read', 'platform.audit.read', 'platform.jobs.manage']} what="System health">
    <CommandPageHeader eyebrow="Platform operations" title="System health & alerts" description="Live alerts for suspicious access, account security, payments, notifications, integrations and expiring licences." actions={<CommandButton variant="secondary" onClick={() => { list.reload(); ints.reload(); jobs.reload(); }}><RotateCcw size={14} />Re-check</CommandButton>} />
    <div className="grid gap-4 [&>*]:min-w-0 xl:grid-cols-[1.4fr_1fr]">
      <Panel className="self-start"><PanelHeader title="Alerts" description={list.data ? `Evaluated ${f.dateTime(list.data.generatedAt)}` : undefined} />
        <ErrorBox error={list.error} retry={list.reload} />
        {list.loading && !list.data ? <Loading /> : list.data && (list.data.items.length ? <ul className="divide-y divide-slate-100">{list.data.items.map((a) => { const href = drillTo(a.drill); return <li key={a.key} className="flex gap-3 px-4 py-3">{ALERT_ICON[a.severity]}<div className="min-w-0 flex-1"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{a.category} · {a.severity}</p><p className="text-sm font-semibold text-slate-900">{a.title}</p><p className="text-xs text-slate-600">{a.at && <>{f.dateTime(a.at)} · </>}{a.detail}</p></div>{href && <Link to={href} className="self-center text-xs font-semibold text-emerald-700">Act</Link>}</li>; })}</ul> : <div className="flex items-center gap-2 p-6 text-sm text-emerald-700"><CheckCircle2 size={17} />No alerts right now.</div>)}
      </Panel>
      <div className="grid gap-4 [&>*]:min-w-0 self-start">
        <Panel><PanelHeader title="Integrations" action={<Link to="/command-center/integrations" className="text-xs font-semibold text-emerald-700">Details</Link>} />{ints.data ? <ul className="divide-y divide-slate-100">{ints.data.items.map((i) => <li key={i.key} className="flex items-center justify-between px-4 py-2 text-sm"><span>{i.name}</span><StatusPill status={INTEGRATION_TONE[i.status]} /></li>)}</ul> : <Loading />}</Panel>
        <Panel><PanelHeader title="Background jobs" action={<Link to="/command-center/jobs" className="text-xs font-semibold text-emerald-700">Open</Link>} />{jobs.data ? <ul className="divide-y divide-slate-100">{failing.map(([k, n]) => <li key={k} className="flex items-center justify-between px-4 py-2 text-sm"><span>{TYPES.find((t) => t.value === k)?.label}</span><StatusPill status={n ? `${n} failed` : 'Healthy'} /></li>)}</ul> : <Loading />}</Panel>
      </div>
    </div>
  </Gate>;
}
