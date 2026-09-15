import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Check, CheckCircle2, CircleAlert, LockKeyhole, Rocket, Search, ShieldCheck } from "lucide-react";
import { useTenantSetup } from "@/tenant-setup/useTenantSetup";
import type { TenantSetupRecord } from "@/tenant-setup/domain";
import { useAuth } from "@/store/useAuth";
import { hasPermission } from "../access";
import { CommandButton, CommandInput, CommandPageHeader, CommandSelect, Panel, PanelHeader, StatusPill } from "../components/ui";
import { formatDate } from "../format";
import { useCommandCenter } from "../useCommandCenter";

export default function TenantSetupManagement() {
  const { organizationId } = useParams();
  const navigate = useNavigate();
  const command = useCommandCenter();
  const records = useTenantSetup((state) => state.records);
  const syncProvisionedTenants = useTenantSetup((state) => state.syncProvisionedTenants);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("ALL");
  useEffect(() => { syncProvisionedTenants(); }, [syncProvisionedTenants]);
  const selected = organizationId ? records.find((item) => item.organizationId === organizationId) : undefined;
  const rows = useMemo(() => records.filter((record) => {
    const organization = command.organizations.find((item) => item.id === record.organizationId);
    return `${organization?.name ?? ""} ${organization?.tenantId ?? ""}`.toLowerCase().includes(query.toLowerCase()) && (status === "ALL" || record.status === status);
  }), [command.organizations, query, records, status]);
  if (organizationId && !selected) return <div><CommandPageHeader eyebrow="Customers" title="Setup record unavailable" description="Only successfully provisioned onboarding tenants receive a first-run setup record."/><Link className="text-sm font-bold text-emerald-700" to="/command-center/setup">Back to setup queue</Link></div>;
  if (selected) return <SetupDetail record={selected}/>;
  return <div>
    <CommandPageHeader eyebrow="Customers" title="Go-live setup" description="Review module-aware hospital configuration and control the final activation boundary." actions={<span className="rounded-lg bg-slate-950 px-3 py-2 text-xs font-bold text-white">{rows.length} tenants</span>}/>
    <Panel className="mb-4"><div className="flex flex-wrap gap-2 p-3"><label className="relative min-w-[260px] flex-1"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/><CommandInput className="w-full pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Organization or tenant ID"/></label><CommandSelect value={status} onChange={(event) => setStatus(event.target.value)}><option value="ALL">All statuses</option>{["NOT_STARTED", "IN_PROGRESS", "CHANGES_REQUESTED", "READY_FOR_REVIEW", "APPROVED", "LIVE"].map((value) => <option key={value}>{value}</option>)}</CommandSelect></div></Panel>
    <Panel><div className="overflow-x-auto"><table className="w-full"><thead><tr className="bg-slate-50"><th className="cc-th">Organization</th><th className="cc-th">Tenant</th><th className="cc-th">Configuration</th><th className="cc-th">Required steps</th><th className="cc-th">Submitted</th><th className="cc-th">Status</th><th className="cc-th"></th></tr></thead><tbody>{rows.map((record) => { const organization = command.organizations.find((item) => item.id === record.organizationId); const completed = record.steps.filter((item) => item.status === "COMPLETED").length; return <tr key={record.id} className="border-t border-slate-100"><td className="cc-td font-semibold text-slate-900">{organization?.name ?? "Unavailable"}</td><td className="cc-td font-mono text-xs">{organization?.tenantId ?? "—"}</td><td className="cc-td"><div className="flex items-center gap-2"><div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-emerald-500" style={{ width: `${Math.round(completed / record.steps.length * 100)}%` }}/></div><span className="text-xs font-semibold">{completed}/{record.steps.length}</span></div></td><td className="cc-td">{record.steps.filter((item) => item.required).length}</td><td className="cc-td">{formatDate(record.submittedAt)}</td><td className="cc-td"><StatusPill status={record.status.replaceAll("_", " ")}/></td><td className="cc-td"><CommandButton variant="quiet" onClick={() => navigate(`/command-center/setup/${record.organizationId}`)}>Open</CommandButton></td></tr>; })}{rows.length === 0 && <tr><td colSpan={7} className="p-10 text-center text-sm text-slate-500">No provisioned tenants are waiting for first-run setup.</td></tr>}</tbody></table></div></Panel>
  </div>;
}

function SetupDetail({ record }: { record: TenantSetupRecord }) {
  const command = useCommandCenter();
  const setup = useTenantSetup();
  const identity = useAuth((state) => state.identity);
  const actor = command.platformUsers.find((item) => item.id === identity?.platformUserId);
  const organization = command.organizations.find((item) => item.id === record.organizationId);
  const subscription = command.subscriptions.find((item) => item.organizationId === record.organizationId);
  const license = command.licenses.find((item) => item.organizationId === record.organizationId);
  const branch = command.branches.find((item) => item.organizationId === record.organizationId);
  const owner = command.tenantUsers.find((item) => item.organizationId === record.organizationId && item.role === "Organization Administrator");
  const canReview = hasPermission(actor, "onboarding.manage") && hasPermission(actor, "organizations.manage");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const act = (action: () => { ok: true } | { ok: false; error: string }, success: string) => { setError(""); setMessage(""); const result = action(); if (!result.ok) setError(result.error); else { setMessage(success); setReason(""); } };
  const completed = record.steps.filter((item) => item.status === "COMPLETED").length;
  return <div>
    <Link to="/command-center/setup" className="mb-4 inline-flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-emerald-700"><ArrowLeft size={14}/>Go-live setup queue</Link>
    <CommandPageHeader eyebrow={organization?.tenantId ?? "Tenant setup"} title={organization?.name ?? "Unavailable organization"} description="First-run configuration, readiness evidence and controlled activation" actions={<StatusPill status={record.status.replaceAll("_", " ")}/>}/>
    {message && <p role="status" className="mb-4 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">{message}</p>}
    {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_350px]"><div className="space-y-4">
      <Panel><PanelHeader title="Module-aware setup" description={`${completed} of ${record.steps.length} steps complete`}/><div className="divide-y divide-slate-100">{record.steps.map((step, index) => <div key={step.key} className="flex items-start gap-4 p-4"><span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${step.status === "COMPLETED" ? "bg-emerald-100 text-emerald-700" : step.status === "CHANGES_REQUESTED" ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-500"}`}>{step.status === "COMPLETED" ? <Check size={16}/> : step.status === "CHANGES_REQUESTED" ? <CircleAlert size={16}/> : index + 1}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-bold text-slate-800">{step.label}</p>{step.moduleKey && <span className="font-mono text-[9px] text-slate-400">{step.moduleKey}</span>}</div><p className="mt-1 text-xs leading-5 text-slate-500">{step.description}</p></div><StatusPill status={step.status.replaceAll("_", " ")}/></div>)}</div></Panel>
      {record.readinessChecks.length > 0 && <Panel><PanelHeader title="Readiness checks" description="Re-evaluated before approval and again at activation"/><div className="divide-y divide-slate-100">{record.readinessChecks.map((check) => <div key={check.key} className="flex gap-3 p-4">{check.status === "PASS" ? <CheckCircle2 size={18} className="shrink-0 text-emerald-600"/> : <CircleAlert size={18} className="shrink-0 text-red-600"/>}<div><p className="text-sm font-bold text-slate-800">{check.label}</p><p className="mt-1 text-xs text-slate-500">{check.detail}</p></div></div>)}</div></Panel>}
      <Panel><PanelHeader title="Immutable setup history"/><div className="space-y-4 p-4">{[...record.events].reverse().map((event) => <div key={event.id} className="border-l border-slate-200 pl-4"><p className="text-xs font-bold text-slate-800">{event.action}</p><p className="mt-1 text-[10px] text-slate-400">{event.actorName} · {event.actorRole} · {formatDate(event.timestamp)}</p>{event.reason && <p className="mt-1 text-xs leading-5 text-slate-600">{event.reason}</p>}</div>)}</div></Panel>
    </div><aside className="space-y-4">
      <Panel><PanelHeader title="Activation boundary"/><div className="space-y-3 p-4"><Snapshot label="Organization" value={organization?.status ?? "Missing"}/><Snapshot label="Onboarding" value={organization?.onboardingStatus ?? "Missing"}/><Snapshot label="Subscription" value={subscription?.status ?? "Missing"}/><Snapshot label="License" value={license?.status ?? "Missing"}/><Snapshot label="Primary branch" value={branch?.status ?? "Missing"}/><Snapshot label="Owner" value={owner?.status ?? "Missing"}/></div></Panel>
      <Panel><PanelHeader title="Configuration snapshot"/><div className="space-y-3 p-4"><Snapshot label="Departments" value={String(record.configuration.departments.length)}/><Snapshot label="Services" value={String(record.configuration.services.length)}/><Snapshot label="Expected users" value={String(record.configuration.staff.expectedUsers)}/><Snapshot label="Patient migration" value={record.configuration.patientImport.approach.replaceAll("_", " ")}/><Snapshot label="Training" value={record.configuration.training.pathway.replaceAll("_", " ")}/><Snapshot label="Brand" value={record.configuration.branding.organizationDisplayName}/></div></Panel>
      {["READY_FOR_REVIEW", "APPROVED"].includes(record.status) && <Panel><PanelHeader title={record.status === "APPROVED" ? "Activate workspace" : "Readiness decision"} description="A reason is mandatory and retained in history."/><div className="space-y-3 p-4"><textarea className="min-h-24 w-full rounded-lg border border-slate-200 p-3 text-sm outline-none focus:border-emerald-500" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Decision rationale"/>{record.status === "READY_FOR_REVIEW" ? <div className="grid gap-2"><CommandButton disabled={!canReview} onClick={() => act(() => setup.approveReadiness(record.organizationId, actor?.id ?? "", reason), "Readiness approved. The tenant is eligible for activation.")}><ShieldCheck size={14}/>Approve readiness</CommandButton><CommandButton disabled={!canReview} variant="secondary" onClick={() => act(() => setup.requestChanges(record.organizationId, actor?.id ?? "", reason), "Configuration returned to the tenant administrator.")}>Request changes</CommandButton></div> : <CommandButton className="w-full" disabled={!canReview} onClick={() => act(() => setup.activateTenant(record.organizationId, actor?.id ?? "", reason), "Tenant activated. The organization, branch and owner are now live.")}><Rocket size={14}/>Activate tenant</CommandButton>}</div></Panel>}
      <div className="rounded-xl bg-slate-950 p-4 text-xs leading-5 text-white/60"><LockKeyhole className="mb-3 text-emerald-300" size={18}/><b className="block text-white">Two-step go-live</b>Readiness approval and tenant activation are separate audited actions. Until activation, clinical routes stay inaccessible.</div>
    </aside></div>
  </div>;
}

function Snapshot({ label, value }: { label: string; value: string }) { return <div className="flex items-start justify-between gap-4 text-xs"><span className="shrink-0 text-slate-400">{label}</span><b className="break-all text-right text-slate-700">{value}</b></div>; }
