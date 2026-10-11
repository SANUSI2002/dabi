// Platform administration with real data: roles and staff, staff sessions, security posture,
// Sabi OS customers (subscriptions, licences, entitlements, provisioning, go-live, documents) and
// usage analytics. Items with no service behind them say so plainly instead of showing demo data.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Construction, KeyRound, ShieldCheck, UserMinus, UserPlus } from 'lucide-react';
import { cn } from '@/lib/cn';
import { CommandButton, CommandPageHeader, CommandSelect, Panel, PanelHeader, StatusPill } from '../components/ui';
import { accessState, analytics, changeStaffRole, revokeStaffSession, securityState, staffSessions, tenants, type Tenant } from './api.platform';
import { ActionDialog, Empty, ErrorBox, Field, FilterBar, Gate, Loading, naira, Note, Table, Tabs, Td, human, useCc, useFormat, useLoad, type ActionDialogProps } from './kit';
import { CC } from './routes';

const STAFF_READ = ['platform.staff.invite', 'platform.security.view', 'platform.audit.read', 'platform.users.manage'];

// ------------------------------------------------------------------------------------------------
// Roles & permissions
// ------------------------------------------------------------------------------------------------
export function AccessPage() {
  const f = useFormat();
  const { me } = useCc();
  const [tab, setTab] = useState<'staff' | 'roles'>('staff');
  const [dialog, setDialog] = useState<ActionDialogProps | null>(null);
  const { data, error, loading, reload } = useLoad(() => accessState(), []);
  const change = (userId: string, name: string, action: 'grant' | 'remove', options: string[]) => setDialog({
    title: action === 'grant' ? `Grant a role to ${name}` : `Remove a role from ${name}`, confirm: action === 'grant' ? 'Grant role' : 'Remove role', tone: action === 'grant' ? 'primary' : 'danger',
    description: action === 'grant' ? 'They get the role’s permissions on their next request. Least privilege: grant only what their work needs.' : 'They lose the role’s permissions immediately.',
    fields: [{ name: 'roleCode', label: 'Role', type: 'select', required: true, defaultValue: options[0], options: options.map((o) => ({ value: o, label: human(o.replace('SABI_', '')) })) }],
    run: (v) => changeStaffRole(userId, action, v.roleCode, v.reason), onClose: () => setDialog(null), onDone: () => { setDialog(null); reload(); },
  });
  return <Gate any={STAFF_READ} what="Roles & permissions">
    <CommandPageHeader eyebrow="Identity" title="Roles & permissions" description="Who on the Sabi team can do what. Every permission is checked by the server; changes need a reason and two-step verification and are audited." actions={<Link to={`${CC}/internal-users`} className="text-sm font-semibold text-emerald-700">Invite new staff</Link>} />
    <Tabs label="Access" value={tab} onChange={setTab} tabs={[{ value: 'staff', label: 'Staff', count: data?.staff.length }, { value: 'roles', label: 'Roles', count: data?.roles.length }]} />
    <ErrorBox error={error} retry={reload} />
    {loading && !data ? <Panel><Loading /></Panel> : data && (tab === 'staff' ? <Panel>
      <Table caption="Sabi staff" head={['Staff member', 'Roles', 'Two-step', 'Last sign-in', 'Status', '']}>{data.staff.map((s) => {
        const self = s.id === me?.id;
        const grantable = data.grantable.filter((r) => !s.roles.includes(r));
        const removable = s.roles.filter((r) => data.grantable.includes(r));
        return <tr key={s.id}><Td className="font-semibold">{s.name ?? '—'}<span className="block text-xs font-normal text-slate-500">{s.email}</span></Td><Td><div className="flex flex-wrap gap-1">{s.roles.map((r) => <span key={r} className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-700">{human(r.replace('SABI_', ''))}</span>)}</div></Td>
          <Td>{s.twoStepVerification ? <StatusPill status="On" /> : <StatusPill status="Off — blocked from data" />}</Td><Td className="text-xs">{s.lastSignInAt ? f.ago(s.lastSignInAt) : 'Never'}</Td><Td><StatusPill status={human(s.accountStatus)} /></Td>
          <Td><div className="flex justify-end gap-1">{!self && grantable.length > 0 && <CommandButton variant="secondary" className="h-8" onClick={() => change(s.id, s.name ?? 'staff member', 'grant', grantable)}><UserPlus size={13} />Grant</CommandButton>}{!self && removable.length > 0 && <CommandButton variant="quiet" className="h-8" onClick={() => change(s.id, s.name ?? 'staff member', 'remove', removable)}><UserMinus size={13} />Remove</CommandButton>}{self && <span className="text-[11px] text-slate-400">You</span>}</div></Td></tr>;
      })}</Table>
      <div className="p-4"><Note>{data.note}{!data.grantable.length && ' Your role cannot change roles.'}</Note></div>
    </Panel> : <div className="grid gap-3 [&>*]:min-w-0 lg:grid-cols-2">{data.roles.map((r) => <Panel key={r.code}><PanelHeader title={human(r.code.replace('SABI_', ''))} description={r.description ?? undefined} action={<span className="text-xs text-slate-500">{r.members} member{r.members === 1 ? '' : 's'}</span>} />
      <ul className="grid gap-1 p-4 text-xs">{r.permissions.map((p) => <li key={p.code} className="flex gap-2"><code className="shrink-0 rounded bg-slate-100 px-1 text-[11px]">{p.code}</code><span className="text-slate-600">{p.description}</span></li>)}</ul></Panel>)}</div>)}
    {dialog && <ActionDialog {...dialog} />}
  </Gate>;
}

// ------------------------------------------------------------------------------------------------
// Staff sessions
// ------------------------------------------------------------------------------------------------
export function SessionsPage() {
  const f = useFormat();
  const { canAny } = useCc();
  const [include, setInclude] = useState<'active' | 'all'>('active');
  const [dialog, setDialog] = useState<ActionDialogProps | null>(null);
  const { data, error, loading, reload } = useLoad(() => staffSessions(include), [include]);
  const revoke = (id: string, who: string) => setDialog({ title: `Sign ${who} out of this session`, confirm: 'Sign out', tone: 'danger', description: 'Ends this session and its refresh token. Their other sessions continue.', run: (v) => revokeStaffSession(id, v.reason), onClose: () => setDialog(null), onDone: () => { setDialog(null); reload(); } });
  return <Gate any={STAFF_READ} what="Sessions">
    <CommandPageHeader eyebrow="Identity" title="Staff sessions" description="Where Sabi staff are signed in to the Command Centre. Patient sessions are on each patient's record." />
    <Panel>
      <FilterBar><Field label="Show"><CommandSelect value={include} onChange={(e) => setInclude(e.target.value as 'active' | 'all')}><option value="active">Active now</option><option value="all">Last 30 days</option></CommandSelect></Field></FilterBar>
      <ErrorBox error={error} retry={reload} />
      {loading && !data ? <Loading /> : data && (data.items.length ? <Table caption="Staff sessions" head={['Staff member', 'Device', 'Started', 'Last active', 'Two-step', 'State', '']}>{data.items.map((s) => <tr key={s.id}><Td className="font-semibold">{s.staff}{s.current && <span className="ml-1 rounded bg-emerald-50 px-1 text-[10px] font-bold text-emerald-700">THIS SESSION</span>}</Td><Td>{s.device}</Td><Td className="text-xs">{f.dateTime(s.createdAt)}</Td><Td className="text-xs">{f.ago(s.lastUsedAt)}</Td><Td className="text-xs">{s.mfaVerifiedAt ? f.dateTime(s.mfaVerifiedAt) : '—'}</Td><Td><StatusPill status={s.state === 'SIGNED_OUT' ? `Signed out${s.revokedReason ? ` (${human(s.revokedReason)})` : ''}` : human(s.state)} /></Td>
        <Td>{s.state === 'ACTIVE' && !s.current && canAny('platform.users.manage', 'platform.security.view') && <CommandButton variant="quiet" className="h-8" onClick={() => revoke(s.id, s.staff)}><KeyRound size={13} />Sign out</CommandButton>}</Td></tr>)}</Table> : <Empty title="No staff sessions in this view" />)}
    </Panel>
    {dialog && <ActionDialog {...dialog} />}
  </Gate>;
}

// ------------------------------------------------------------------------------------------------
// Security
// ------------------------------------------------------------------------------------------------
export function SecurityPage() {
  const f = useFormat();
  const { data: s, error, loading, reload } = useLoad(() => securityState(), []);
  const tile = (label: string, value: number | string, bad = false, href?: string) => <div className={cn('rounded-xl bg-white p-4 ring-1', bad ? 'ring-red-200' : 'ring-slate-200')}><p className="text-[10px] font-bold uppercase tracking-[.1em] text-slate-500">{label}</p><p className={cn('mt-1 font-display text-xl font-bold', bad && 'text-red-700')}>{value}</p>{href && <Link to={href} className="text-[11px] font-semibold text-emerald-700">Open</Link>}</div>;
  return <Gate any={['platform.security.view', 'platform.audit.read']} what="Security">
    <CommandPageHeader eyebrow="Administration" title="Security" description="Staff two-step coverage, failed sign-ins, emergency access, exports and forged payment webhooks." />
    <ErrorBox error={error} retry={reload} />
    {loading && !s ? <Panel><Loading /></Panel> : s && <>
      <div className="mb-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
        {tile('Staff without two-step', s.staff.withoutTwoStep.length, s.staff.withoutTwoStep.length > 0, `${CC}/roles`)}
        {tile('Failed sign-ins (24 h)', s.signIns.failed24h, s.signIns.accountsWithFailures24h > 3)}
        {tile('Emergency access to review', s.staffActivity.emergencyAwaitingReview, s.staffActivity.emergencyAwaitingReview > 0, `${CC}/audit?tab=emergency`)}
        {tile('Forged payment webhooks (30 d)', s.payments.forgedWebhooks30d, s.payments.forgedWebhooks30d > 0, `${CC}/sabi-health/payments?tab=webhooks`)}
        {tile('Super admins', s.staff.superAdmins, s.staff.superAdmins > 3)}
        {tile('Staff actions (24 h)', s.staffActivity.adminActions24h, false, `${CC}/audit?category=ADMIN`)}
        {tile('Exports (30 d)', s.staffActivity.exports30d)}
        {tile('Emergency access (30 d)', s.staffActivity.emergencyAccess30d)}
      </div>
      <div className="grid gap-4 [&>*]:min-w-0 xl:grid-cols-[1.4fr_1fr]">
        <Panel><PanelHeader title="Recent failed sign-ins" />{s.signIns.recentFailures.length ? <Table head={['When', 'Account', 'Device', 'Network', 'Approx. location']}>{s.signIns.recentFailures.map((r) => <tr key={r.id}><Td className="text-xs">{f.dateTime(r.at)}</Td><Td>{r.account ?? '—'}</Td><Td>{r.device ?? '—'}</Td><Td className="font-mono text-xs">{r.ip ?? '—'}</Td><Td className="text-xs">{r.location ?? '—'}</Td></tr>)}</Table> : <Empty title="No failed sign-ins" />}</Panel>
        <div className="grid gap-4 [&>*]:min-w-0 self-start">
          {s.staff.withoutTwoStep.length > 0 && <Panel><PanelHeader title="Staff without two-step verification" /><ul className="p-4 text-sm">{s.staff.withoutTwoStep.map((x) => <li key={x.id}>{x.name ?? 'Unnamed'}</li>)}</ul><div className="px-4 pb-4"><Note>They cannot open any Command Centre data until they set up an authenticator.</Note></div></Panel>}
          <Panel><PanelHeader title="Controls in force" /><ul className="grid gap-2 p-4 text-sm text-slate-700">{s.controls.map((c) => <li key={c} className="flex gap-2"><ShieldCheck size={15} className="mt-0.5 shrink-0 text-emerald-600" />{c}</li>)}</ul></Panel>
        </div>
      </div>
    </>}
  </Gate>;
}

// ------------------------------------------------------------------------------------------------
// Sabi OS customers (one data set, several views)
// ------------------------------------------------------------------------------------------------
export type TenantView = 'provisioning' | 'setup' | 'subscriptions' | 'licenses' | 'entitlements' | 'documents';
const TENANT_COPY: Record<TenantView, { title: string; description: string }> = {
  provisioning: { title: 'Tenant provisioning', description: 'Approved Sabi OS customers and whether their workspace has been provisioned and set up.' },
  setup: { title: 'Go-live setup', description: 'Where each approved customer is in setup: invitation sent, deadline, live.' },
  subscriptions: { title: 'Subscriptions', description: 'The package and price each customer was approved on.' },
  licenses: { title: 'License center', description: 'What each customer’s package allows: branches, storage and support level.' },
  entitlements: { title: 'Entitlements', description: 'Which modules each customer’s package switches on.' },
  documents: { title: 'Documents', description: 'Onboarding documents and application evidence on file for each customer (names only).' },
};
const STATE: Record<string, string> = { LIVE: 'Live', SETUP_SENT: 'Setup in progress', SETUP_OVERDUE: 'Setup overdue', APPROVED_NOT_PROVISIONED: 'Approved, not provisioned' };

export function TenantsPage({ view }: { view: TenantView }) {
  const f = useFormat();
  const { data, error, loading, reload } = useLoad(() => tenants(), []);
  const head: Record<TenantView, string[]> = {
    provisioning: ['Customer', 'Type', 'Approved', 'State', 'Staff'], setup: ['Customer', 'Setup sent', 'Deadline', 'Live since', 'State'],
    subscriptions: ['Customer', 'Package', 'Billing', 'Price'], licenses: ['Customer', 'Package', 'Branches', 'Storage', 'Support'],
    entitlements: ['Customer', 'Package', 'Modules'], documents: ['Customer', 'Onboarding documents', 'Application evidence'],
  };
  const cells = (t: Tenant) => {
    const customer = <><span className="font-semibold">{t.organisation.name}</span><span className="block text-xs text-slate-500">{t.reference} · {t.owner}</span></>;
    const pkg = `${t.subscription.package} v${t.subscription.version}`;
    return {
      provisioning: [customer, human(t.organisation.type ?? '—'), f.date(t.provisioning.approvedAt), <StatusPill key="s" status={STATE[t.provisioning.state]} />, t.activeMembers],
      setup: [customer, f.dateTime(t.provisioning.setupSentAt), f.dateTime(t.provisioning.setupDeadlineAt), f.dateTime(t.provisioning.liveAt), <StatusPill key="s" status={STATE[t.provisioning.state]} />],
      subscriptions: [customer, pkg, t.subscription.billingCycle, `${naira(t.subscription.priceMinor)} / ${t.subscription.billingCycle === 'Annual' ? 'year' : 'month'}`],
      licenses: [customer, pkg, t.licence.branches, `${t.licence.storageGb} GB`, human(t.licence.support)],
      entitlements: [customer, pkg, <div key="m" className="flex flex-wrap gap-1">{t.entitlements.map((m) => <span key={m} className="rounded bg-emerald-50 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-800">{m}</span>)}</div>],
      documents: [customer, t.documents.onboarding.length ? t.documents.onboarding.map((d) => d.name).join(', ') : 'None', t.documents.applicationEvidence],
    }[view];
  };
  return <Gate any={['platform.ops.read', 'platform.onboarding.review', 'platform.catalog.manage']} what={TENANT_COPY[view].title}>
    <CommandPageHeader eyebrow="Sabi OS · Customers" title={TENANT_COPY[view].title} description={TENANT_COPY[view].description} />
    {(view === 'subscriptions' || view === 'licenses') && data && <div className="mb-3"><Note>{data.billingNote}</Note></div>}
    <Panel><ErrorBox error={error} retry={reload} />{loading && !data ? <Loading /> : data && (data.items.length ? <Table caption={TENANT_COPY[view].title} head={head[view]}>{data.items.map((t) => <tr key={t.applicationId}>{cells(t).map((c, i) => <Td key={i}>{c}</Td>)}</tr>)}</Table> : <Empty title="No approved customers yet" hint="Customers appear here once their Sabi OS application is approved in the Verification center." />)}</Panel>
  </Gate>;
}

// ------------------------------------------------------------------------------------------------
// Usage analytics
// ------------------------------------------------------------------------------------------------
export function AnalyticsPage() {
  const [weeks, setWeeks] = useState(8);
  const { data, error, loading, reload } = useLoad(() => analytics(weeks), [weeks]);
  const bars = (rows: Record<string, number | string>[], key: string) => {
    const max = Math.max(1, ...rows.map((r) => Number(r[key])));
    return <div className="flex h-16 items-end gap-0.5" aria-hidden>{rows.map((r) => <div key={String(r.week)} title={`${r.week}: ${r[key]}`} className="flex-1 rounded-t bg-emerald-500/80" style={{ height: `${Math.max(3, (Number(r[key]) / max) * 100)}%` }} />)}</div>;
  };
  const series = (title: string, rows: Record<string, number | string>[], keys: [string, string][]) => <Panel><PanelHeader title={title} />
    <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">{keys.map(([k, label]) => <div key={k}><p className="text-xs font-semibold text-slate-600">{label}</p><p className="font-display text-lg font-bold">{rows.at(-1)?.[k] ?? 0} <span className="text-xs font-normal text-slate-500">this week</span></p>{bars(rows, k)}</div>)}</div>
    <table className="sr-only"><caption>{title}</caption><thead><tr><th>Week</th>{keys.map(([, l]) => <th key={l}>{l}</th>)}</tr></thead><tbody>{rows.map((r) => <tr key={String(r.week)}><td>{r.week}</td>{keys.map(([k]) => <td key={k}>{r[k]}</td>)}</tr>)}</tbody></table>
  </Panel>;
  return <Gate any={['platform.ops.read']} what="Usage analytics">
    <CommandPageHeader eyebrow="Platform operations" title="Usage analytics" description="Weekly active people by what they are on Sabi, and weekly activity across products." actions={<Field label="Weeks"><CommandSelect value={weeks} onChange={(e) => setWeeks(Number(e.target.value))}>{[4, 8, 12, 26].map((w) => <option key={w} value={w}>{w}</option>)}</CommandSelect></Field>} />
    <ErrorBox error={error} retry={reload} />
    {loading && !data ? <Panel><Loading /></Panel> : data && <div className="grid gap-4">
      <Note>{data.definitions.active}</Note>
      {series('Weekly active people', data.active as never, [['patients', 'Patients'], ['professionals', 'Professionals'], ['organisationStaff', 'Hospital & pharmacy staff'], ['sabiStaff', 'Sabi staff']])}
      {series('Weekly activity', data.activity as never, [['orders', 'Orders'], ['consultations', 'Consultations booked'], ['prescriptions', 'Prescriptions issued'], ['wellnessBookings', 'Wellness bookings'], ['hospitalAppointments', 'Hospital appointment requests']])}
    </div>}
  </Gate>;
}

// ------------------------------------------------------------------------------------------------
// Sections with no service behind them yet: say what is missing, never show demo data.
// ------------------------------------------------------------------------------------------------
const NOT_BUILT: Record<string, { title: string; needs: string; instead?: [string, string] }> = {
  '/command-center/support': { title: 'Support access', needs: 'A time-limited, customer-approved way for Sabi staff to enter a hospital’s EMR workspace. Hospitals own their clinical data, so this needs the hospital’s approval flow on their side first.', instead: ['Support cases', `${CC}/cases`] },
  '/command-center/sso': { title: 'SSO', needs: 'An identity-provider integration (SAML or OpenID Connect) for organisations that sign in with their own directory. No provider is connected.' },
  '/command-center/feature-flags': { title: 'Feature flags', needs: 'A flag service that the apps read at runtime. The apps do not read flags today, so a flag set here would change nothing.' },
  '/command-center/branding': { title: 'Branding', needs: 'Tenant branding stored on the server and applied by the EMR workspace. Branding is currently kept in each browser only.' },
  '/command-center/themes': { title: 'Themes', needs: 'Server-stored themes applied by the workspaces. Themes are currently kept in each browser only.' },
  '/command-center/terminology': { title: 'Terminology', needs: 'Server-stored terminology that the EMR reads. Terminology is currently kept in each browser only.' },
  '/command-center/opportunities': { title: 'Deals & activation', needs: 'A sales pipeline (CRM). Applications themselves are tracked in the Verification center.', instead: ['Verification center', `${CC}/onboarding`] },
  '/command-center/roadmap': { title: 'Product roadmap', needs: 'A roadmap store. Nothing records roadmap items on the server yet.' },
  '/command-center/releases': { title: 'Releases', needs: 'Release records from the deployment pipeline. Deployments are not reported to Sabi yet.' },
  '/command-center/invoices': { title: 'Invoices', needs: 'Sabi OS subscription billing. Sabi does not invoice or collect subscriptions yet; prices are on Subscriptions.', instead: ['Subscriptions', `${CC}/subscriptions`] },
  '/command-center/transactions': { title: 'Transactions', needs: 'Sabi OS subscription payments, which are not collected yet. Sabi Health marketplace payments are on Payments & finance.', instead: ['Payments & finance', `${CC}/sabi-health/payments`] },
  '/command-center/settings': { title: 'Global settings', needs: 'A server-side settings store. Commercial settings that exist live on their own pages.', instead: ['Delivery pricing', `${CC}/sabi-health/delivery-pricing`] },
};
export const isNotBuilt = (path: string) => path in NOT_BUILT;
export function NotBuiltPage({ path }: { path: string }) {
  const item = NOT_BUILT[path];
  return <><CommandPageHeader eyebrow="Not built yet" title={item.title} />
    <Panel><div className="flex items-start gap-3 p-6"><Construction size={20} className="mt-0.5 shrink-0 text-amber-600" /><div><h2 className="text-sm font-bold text-slate-900">There is no service behind this section yet</h2><p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">{item.needs}</p><p className="mt-2 max-w-2xl text-xs text-slate-500">Nothing here is shown as real data until that exists.</p>{item.instead && <Link to={item.instead[1]} className="mt-4 inline-flex text-sm font-semibold text-emerald-700">Go to {item.instead[0]}</Link>}</div></div></Panel>
  </>;
}
