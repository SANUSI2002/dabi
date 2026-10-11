// The platform audit trail (append-only): who did what, to whom, why, with before/after; a CSV export
// that is itself audited; and emergency (break-glass) access waiting for review.
import { Fragment, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Download, ShieldAlert } from 'lucide-react';
import { CommandButton, CommandInput, CommandPageHeader, CommandSelect, Panel, PanelHeader, StatusPill } from '../components/ui';
import { endEmergencyAccess, exportAudit, listAudit, listEmergencyAccess, reviewEmergencyAccess, type EmergencyGrant } from './api';
import { ActionDialog, Empty, ErrorBox, Field, FilterBar, Gate, Loading, Note, Pagination, Table, Tabs, Td, human, useCc, useFormat, useLoad, type ActionDialogProps } from './kit';
import { R } from './routes';

const CATEGORIES = ['ADMIN', 'SIGN_IN', 'RECORD_ACCESS', 'RECORD_CHANGE', 'PERMISSION', 'ACCOUNT', 'ACTIVITY'];

function Diff({ before, after }: { before: unknown; after: unknown }) {
  if (before === null && after === null) return null;
  const b = (before ?? {}) as Record<string, unknown>; const a = (after ?? {}) as Record<string, unknown>;
  const keys = [...new Set([...Object.keys(b), ...Object.keys(a)])].filter((k) => JSON.stringify(b[k]) !== JSON.stringify(a[k]));
  if (!keys.length) return <p className="text-xs text-slate-500">No field changed.</p>;
  return <table className="w-full text-xs"><thead><tr className="text-left text-slate-500"><th className="py-1 pr-3 font-semibold">Field</th><th className="py-1 pr-3 font-semibold">Before</th><th className="py-1 font-semibold">After</th></tr></thead><tbody>{keys.map((k) => <tr key={k} className="align-top"><td className="py-1 pr-3 font-mono">{k}</td><td className="py-1 pr-3 text-red-700"><code className="break-all">{JSON.stringify(b[k] ?? null)}</code></td><td className="py-1 text-emerald-700"><code className="break-all">{JSON.stringify(a[k] ?? null)}</code></td></tr>)}</tbody></table>;
}

function Trail() {
  const f = useFormat();
  const [params] = useSearchParams();
  const [filters, setFilters] = useState({ category: params.get('category') ?? '', action: '', actorUserId: params.get('actorUserId') ?? '', subjectUserId: params.get('subjectUserId') ?? '', resourceType: '', from: '', to: '' });
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<string | null>(null);
  const [dialog, setDialog] = useState<ActionDialogProps | null>(null);
  const [flash, setFlash] = useState('');
  useEffect(() => setPage(1), [filters]);
  const apiFilters = Object.fromEntries(Object.entries({ ...filters, from: filters.from ? new Date(`${filters.from}T00:00:00`).toISOString() : '', to: filters.to ? new Date(`${filters.to}T23:59:59.999`).toISOString() : '' }).filter(([, v]) => v));
  const { data, error, loading, reload } = useLoad(() => listAudit({ ...apiFilters, page }), [JSON.stringify(apiFilters), page]);
  const set = (k: keyof typeof filters) => (e: { target: { value: string } }) => setFilters((x) => ({ ...x, [k]: e.target.value }));
  const doExport = () => setDialog({
    title: 'Export audit entries', confirm: 'Export CSV', reasonLabel: 'Why you need the export (recorded)',
    description: <>Exports up to 5,000 entries matching the current filters ({data?.total.toLocaleString() ?? '…'} now). The export itself is recorded in the audit trail. Store the file securely.</>,
    run: (v) => exportAudit(v.reason, apiFilters as Record<string, string>), onClose: () => setDialog(null),
    onDone: (r) => {
      setDialog(null);
      const { text, filename } = r as { text: string; filename: string | null };
      const url = URL.createObjectURL(new Blob([text], { type: 'text/csv' }));
      const a = document.createElement('a'); a.href = url; a.download = filename ?? 'sabi-audit.csv'; a.click(); URL.revokeObjectURL(url);
      setFlash('Export downloaded and recorded.'); reload();
    },
  });
  return <Panel>
    <FilterBar>
      <Field label="Category"><CommandSelect value={filters.category} onChange={set('category')}><option value="">All</option>{CATEGORIES.map((c) => <option key={c} value={c}>{c === 'ADMIN' ? 'Sabi staff' : human(c)}</option>)}</CommandSelect></Field>
      <Field label="Action"><CommandInput value={filters.action} onChange={(e) => setFilters((x) => ({ ...x, action: e.target.value.toUpperCase().replace(/[^A-Z_]/g, '') }))} placeholder="e.g. ADMIN_CLINICAL_VIEWED" /></Field>
      <Field label="Record type"><CommandInput value={filters.resourceType} onChange={(e) => setFilters((x) => ({ ...x, resourceType: e.target.value.toLowerCase().replace(/[^a-z_:-]/g, '') }))} placeholder="e.g. order" /></Field>
      <Field label="From"><input type="date" value={filters.from} onChange={set('from')} className="h-9 rounded-lg border border-slate-200 px-2 text-sm" /></Field>
      <Field label="To"><input type="date" value={filters.to} onChange={set('to')} className="h-9 rounded-lg border border-slate-200 px-2 text-sm" /></Field>
      {(filters.actorUserId || filters.subjectUserId) && <CommandButton variant="quiet" onClick={() => setFilters((x) => ({ ...x, actorUserId: '', subjectUserId: '' }))}>Clear person filter</CommandButton>}
      <div className="ml-auto"><CommandButton variant="secondary" disabled={!data?.total} onClick={doExport}><Download size={14} />Export</CommandButton></div>
    </FilterBar>
    {flash && <p role="status" className="mx-4 mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{flash}</p>}
    <ErrorBox error={error} retry={reload} />
    {loading && !data ? <Loading /> : data && (data.items.length ? <>
      <Table caption="Audit trail" head={['When', 'Who', 'What', 'About', 'Reason', '']}>{data.items.map((e) => <Fragment key={e.id}>
        <tr className={open === e.id ? 'bg-slate-50' : ''}><Td className="whitespace-nowrap text-xs">{f.dateTime(e.at)}</Td><Td>{e.actor}{e.roles && <span className="block text-[11px] text-slate-500">{e.roles.join(', ')}</span>}</Td><Td><span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400">{e.category === 'ADMIN' ? 'Sabi staff' : human(e.category)}</span>{e.summary}</Td><Td className="text-xs">{e.subject && (e.subjectUserId ? <Link className="text-emerald-700" to={`${R.patients}/${e.subjectUserId}`}>{e.subject}</Link> : e.subject)}{e.resourceType && <span className="block text-slate-500">{e.resourceType}{e.resourceId && ` · ${e.resourceId.slice(0, 8)}`}</span>}</Td><Td className="max-w-[220px] text-xs">{e.reason ?? '—'}</Td>
          <Td><CommandButton variant="quiet" className="h-7 px-2 text-xs" aria-expanded={open === e.id} onClick={() => setOpen(open === e.id ? null : e.id)}>{open === e.id ? 'Hide' : 'Details'}</CommandButton></Td></tr>
        {open === e.id && <tr className="bg-slate-50"><td colSpan={6} className="px-4 pb-4"><div className="grid gap-3 md:grid-cols-2"><div><p className="mb-1 text-[11px] font-semibold uppercase text-slate-400">Change</p><Diff before={e.before} after={e.after} />{e.before === null && e.after === null && <p className="text-xs text-slate-500">No before/after recorded (a view or an action, not a configuration change).</p>}</div><div className="text-xs text-slate-600"><p className="mb-1 text-[11px] font-semibold uppercase text-slate-400">Context</p><p>Action code: <code>{e.action}</code></p><p>Device: {e.device ?? '—'}</p><p>Network: {e.ip ?? '—'}{e.location && ` (approx. ${e.location})`}</p><p>Entry id: <code>{e.id}</code></p></div></div></td></tr>}
      </Fragment>)}</Table>
      <Pagination page={data.page} pages={data.pages} total={data.total} onPage={setPage} />
      <div className="px-4 pb-4"><Note>The audit trail is append-only: the database refuses any edit or deletion, including by Sabi staff.</Note></div>
    </> : <Empty title="No entries match these filters" />)}
    {dialog && <ActionDialog {...dialog} />}
  </Panel>;
}

function EmergencyReview() {
  const f = useFormat();
  const { can, me } = useCc();
  const [unreviewed, setUnreviewed] = useState(true);
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState<ActionDialogProps | null>(null);
  const { data, error, loading, reload } = useLoad(() => listEmergencyAccess({ unreviewed, page }), [unreviewed, page]);
  const review = (g: EmergencyGrant) => setDialog({
    title: `Review emergency access by ${g.actor}`, confirm: 'Record review', reasonLabel: 'Review note (what you checked)',
    description: <><p>Reason given: “{g.reason}”</p><p className="mt-1 text-xs">Check it against the call log, case or incident, and the records they opened (Audit trail → filter by this person).</p></>,
    fields: [{ name: 'outcome', label: 'Outcome', type: 'select', required: true, defaultValue: 'APPROPRIATE', options: [{ value: 'APPROPRIATE', label: 'Appropriate' }, { value: 'INAPPROPRIATE', label: 'Not appropriate (escalate)' }] }],
    run: (v) => reviewEmergencyAccess(g.id, v.outcome as 'APPROPRIATE' | 'INAPPROPRIATE', v.reason), onClose: () => setDialog(null), onDone: () => { setDialog(null); reload(); },
  });
  return <Panel>
    <FilterBar><label className="flex h-9 items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={unreviewed} onChange={(e) => { setUnreviewed(e.target.checked); setPage(1); }} />Awaiting review only</label></FilterBar>
    <ErrorBox error={error} retry={reload} />
    {loading && !data ? <Loading /> : data && (data.items.length ? <><Table caption="Emergency access" head={['Started', 'Staff member', 'Patient', 'Reason', 'Window', 'Review', '']}>{data.items.map((g) => <tr key={g.id}>
      <Td className="text-xs">{f.dateTime(g.startedAt)}</Td><Td><Link className="text-emerald-700" to={`${R.audit}?actorUserId=${g.actorUserId}`}>{g.actor}</Link></Td><Td><Link className="text-emerald-700" to={`${R.patients}/${g.subjectUserId}`}>{g.subject}</Link></Td><Td className="max-w-[260px] text-xs">{g.reason}</Td>
      <Td><StatusPill status={human(g.state)} /><span className="block text-[11px] text-slate-500">until {f.dateTime(g.endedAt ?? g.expiresAt)}</span></Td>
      <Td>{g.reviewedAt ? <><StatusPill status={human(g.reviewOutcome)} /><span className="block text-[11px] text-slate-500">{g.reviewer}: {g.reviewNote}</span></> : <span className="text-amber-700">Not reviewed</span>}</Td>
      <Td><div className="flex justify-end gap-1">
        {g.state === 'ACTIVE' && g.actorUserId === me?.id && <CommandButton className="h-8" variant="secondary" onClick={async () => { await endEmergencyAccess(g.id); reload(); }}>End now</CommandButton>}
        {!g.reviewedAt && g.state !== 'ACTIVE' && can('platform.audit.read') && g.actorUserId !== me?.id && <CommandButton className="h-8" variant="secondary" onClick={() => review(g)}><ShieldAlert size={13} />Review</CommandButton>}
      </div></Td>
    </tr>)}</Table><Pagination page={data.page} pages={data.pages} total={data.total} onPage={setPage} /></> : <Empty title={unreviewed ? 'Nothing awaiting review' : 'No emergency access has been used'} />)}
    {dialog && <ActionDialog {...dialog} />}
  </Panel>;
}

export default function AuditPage() {
  const { can } = useCc();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'emergency' ? 'emergency' : 'trail';
  return <Gate any={['platform.audit.read', 'platform.emergency.access']} what="Audit logs">
    <CommandPageHeader eyebrow="Administration" title="Audit logs" description="Every sign-in, record access, change and Sabi staff action, with the stated reason and before/after. Append-only." />
    <Tabs label="Audit" value={tab} onChange={(t) => setParams(t === 'trail' ? {} : { tab: t })} tabs={[...(can('platform.audit.read') ? [{ value: 'trail' as const, label: 'Audit trail' }] : []), { value: 'emergency' as const, label: 'Emergency access' }]} />
    {tab === 'trail' && can('platform.audit.read') ? <Trail /> : <EmergencyReview />}
  </Gate>;
}
