import { useMemo } from "react";
import { AlertTriangle, ArrowRight, Building2, CircleDollarSign, FileWarning, HeartPulse, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Bars, Donut } from "@/components/ui/Chart";
import { useCommandCenter } from "../useCommandCenter";
import { CommandButton, CommandPageHeader, MetricCard, Panel, PanelHeader, StatusPill } from "../components/ui";
import { daysUntil, formatMoney } from "../format";

// No dated revenue/tenant-growth history is tracked yet (subscriptions and organizations are a
// current snapshot, not periodic samples), so this panel states that honestly instead of
// plotting an invented trend line — see PanelEmptyNote below.
function PanelEmptyNote({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center justify-center px-4 py-10 text-center text-sm text-slate-400">{children}</div>;
}

export default function CommandDashboard() {
  const navigate = useNavigate();
  const state = useCommandCenter();
  const stats = useMemo(() => {
    const active = state.organizations.filter((o) => o.status === "Active").length;
    const mrr = state.subscriptions.filter((s) => ["Active", "Trialing", "Grace Period"].includes(s.status)).reduce((sum, s) => sum + s.finalAmount, 0);
    const overdue = state.invoices.filter((i) => i.status === "Overdue");
    const expiring = state.licenses.filter((l) => daysUntil(l.validUntil) <= 30 && daysUntil(l.validUntil) >= 0);
    const docs = state.documents.filter((d) => d.status === "Under Review");
    return { active, mrr, overdue, expiring, docs, users: state.organizations.reduce((sum, o) => sum + o.activeUsers, 0), suspended: state.organizations.filter((o) => o.status === "Suspended").length, trials: state.organizations.filter((o) => o.status === "Trial").length, onboarding: state.organizations.filter((o) => o.status === "Onboarding").length, openIncidents: state.incidents.filter((i) => i.status !== "Resolved").length };
  }, [state]);
  const moduleAdoption = Object.values(state.modules.reduce<Record<string, number>>((acc, module) => ({ ...acc, [module.productId]: state.subscriptions.filter((s) => s.snapshotModuleIds.some((m) => m.startsWith(module.productId))).length }), {})).length;
  const degradedServices = state.serviceHealth.filter((s) => s.status !== "Operational");
  const health = state.serviceHealth.length === 0 ? "No data" : degradedServices.length === 0 ? "Operational" : `${degradedServices.length} degraded`;
  // Every alert here is derived from real store state — nothing is a hardcoded placeholder
  // incident. When nothing needs attention (including in production, where these arrays start
  // empty until a backend is connected), the panel says so instead of showing invented items.
  const alerts = [
    stats.expiring.length > 0 && { tone: "amber" as const, title: `${stats.expiring.length} hospital license${stats.expiring.length === 1 ? "" : "s"} expire within 30 days`, detail: "Renewal outreach is due this week", to: "/command-center/licenses" },
    stats.overdue.length > 0 && { tone: "red" as const, title: `${stats.overdue.length} customer invoice${stats.overdue.length === 1 ? "" : "s"} overdue`, detail: `${formatMoney(stats.overdue.reduce((n, i) => n + i.total, 0))} needs collection`, to: "/command-center/invoices" },
    stats.docs.length > 0 && { tone: "amber" as const, title: `${stats.docs.length} onboarding document${stats.docs.length === 1 ? "" : "s"} awaiting review`, detail: "Compliance verification queue", to: "/command-center/documents" },
    ...degradedServices.map((service) => ({ tone: "red" as const, title: `${service.name} is ${service.status.toLowerCase()}`, detail: `Last checked ${new Date(service.lastCheckedAt).toLocaleString()}`, to: "/command-center/health" })),
    ...state.incidents.filter((i) => i.status !== "Resolved").map((incident) => ({ tone: (incident.severity === "Critical" ? "red" : "amber") as "red" | "amber", title: incident.title, detail: `${incident.service} · ${incident.status}`, to: "/command-center/health" })),
  ].filter((alert): alert is Exclude<typeof alert, false> => Boolean(alert));

  return <div>
    <CommandPageHeader eyebrow="Executive operations" title="Platform overview" description="Commercial, identity and operational health across every Sabi OS tenant." actions={<><CommandButton variant="secondary" onClick={() => navigate("/command-center/audit")}>View audit log</CommandButton><CommandButton onClick={() => navigate("/command-center/organizations")}>Open organizations <ArrowRight size={15} /></CommandButton></>} />
    <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-8">
      <MetricCard label="Organizations" value={state.organizations.length} hint="total tenants" icon={<Building2 size={15} />} />
      <MetricCard label="Active hospitals" value={stats.active} hint={`${stats.trials} trial`} />
      <MetricCard label="Platform users" value={stats.users.toLocaleString()} hint="licensed active" icon={<Users size={15} />} />
      <MetricCard label="Active subscriptions" value={state.subscriptions.filter((s) => s.status === "Active").length} hint={`${stats.suspended} suspended`} />
      <MetricCard label="MRR" value={formatMoney(stats.mrr)} hint="recurring" icon={<CircleDollarSign size={15} />} />
      <MetricCard label="ARR" value={formatMoney(stats.mrr * 12)} hint="run rate" />
      <MetricCard label="Outstanding" value={formatMoney(state.invoices.filter((i) => ["Due", "Overdue"].includes(i.status)).reduce((n, i) => n + i.total, 0))} hint="customer invoices" />
      <MetricCard label="System health" value={health} hint={`${stats.openIncidents} open incident`} icon={<HeartPulse size={15} />} />
    </div>

    <div className="mt-4 grid gap-4 xl:grid-cols-[1.55fr_1fr]">
      <Panel>
        <PanelHeader title="Revenue" description="Current recurring revenue snapshot" />
        <div className="grid grid-cols-2 gap-3 p-4">
          <div><p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">MRR</p><p className="mt-1 font-display text-2xl font-bold text-slate-950">{formatMoney(stats.mrr)}</p></div>
          <div><p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">ARR</p><p className="mt-1 font-display text-2xl font-bold text-slate-950">{formatMoney(stats.mrr * 12)}</p></div>
        </div>
        <PanelEmptyNote>Historical revenue trend requires backend-tracked monthly snapshots — not yet available.</PanelEmptyNote>
      </Panel>
      <Panel>
        <PanelHeader title="Attention required" description="Prioritized across finance, onboarding and operations" />
        {alerts.length === 0 ? (
          <PanelEmptyNote>Nothing needs attention right now.</PanelEmptyNote>
        ) : (
          <div className="divide-y divide-slate-100">{alerts.map((alert) => <button key={alert.title} onClick={() => navigate(alert.to)} className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-slate-50"><span className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg ${alert.tone === "red" ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-600"}`}>{alert.tone === "red" ? <AlertTriangle size={14} /> : <FileWarning size={14} />}</span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-slate-800">{alert.title}</span><span className="block text-xs text-slate-500">{alert.detail}</span></span><ArrowRight size={14} className="mt-1 text-slate-300" /></button>)}</div>
        )}
      </Panel>
    </div>

    <div className="mt-4 grid gap-4 lg:grid-cols-3">
      <Panel>
        <PanelHeader title="Tenant & subscription growth" />
        <PanelEmptyNote>Historical tenant growth requires backend-tracked periodic snapshots — not yet available.</PanelEmptyNote>
      </Panel>
      <Panel><PanelHeader title="Portfolio status" /><div className="px-2 pb-2">{state.organizations.length === 0 ? <PanelEmptyNote>No organizations recorded yet.</PanelEmptyNote> : <Donut data={[{ label: "Active", value: stats.active, color: "#10b981" }, { label: "Trial", value: stats.trials, color: "#f59e0b" }, { label: "Onboarding", value: stats.onboarding, color: "#38bdf8" }, { label: "Restricted", value: state.organizations.length - stats.active - stats.trials - stats.onboarding, color: "#ef4444" }]} height={220} centerLabel="tenants" />}</div></Panel>
      <Panel><PanelHeader title="Product adoption" description={`${moduleAdoption} tracked module groups`} /><div className="p-3">{state.subscriptions.length === 0 ? <PanelEmptyNote>No subscriptions recorded yet.</PanelEmptyNote> : <Bars data={Object.values(PRODUCT_ADOPTION(state.subscriptions))} x="name" series={[{ key: "tenants", color: "#10b981" }]} height={220} layout="vertical" />}</div></Panel>
    </div>

    <Panel className="mt-4">
      <PanelHeader title="Tenant onboarding" description="Commercial-to-go-live visibility" action={<CommandButton variant="quiet" onClick={() => navigate("/command-center/onboarding")}>View onboarding <ArrowRight size={14} /></CommandButton>} />
      {state.workflows.length === 0 ? (
        <PanelEmptyNote>No onboarding workflows in progress.</PanelEmptyNote>
      ) : (
        <div className="overflow-x-auto"><table className="w-full"><thead><tr className="border-b border-slate-100 bg-slate-50/80"><th className="cc-th">Organization</th><th className="cc-th">Status</th><th className="cc-th">Owner</th><th className="cc-th">Progress</th><th className="cc-th">Target go-live</th></tr></thead><tbody>{state.workflows.map((workflow) => { const org = state.organizations.find((o) => o.id === workflow.organizationId)!; const tasks = state.onboardingTasks.filter((t) => t.workflowId === workflow.id); const progress = tasks.length > 0 ? Math.round(tasks.filter((t) => t.status === "Completed").length / tasks.length * 100) : 0; return <tr key={workflow.id} className="border-b border-slate-100 last:border-0"><td className="cc-td font-semibold text-slate-900">{org.name}</td><td className="cc-td"><StatusPill status={workflow.status} /></td><td className="cc-td">{org.implementationManager}</td><td className="cc-td"><div className="flex items-center gap-2"><div className="h-1.5 w-28 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${progress}%` }} /></div><span className="text-xs font-semibold">{tasks.length > 0 ? `${progress}%` : "No tasks"}</span></div></td><td className="cc-td">{workflow.targetGoLiveDate}</td></tr>; })}</tbody></table></div>
      )}
    </Panel>
  </div>;
}

function PRODUCT_ADOPTION(subscriptions: ReturnType<typeof useCommandCenter.getState>["subscriptions"]) {
  return {
    emr: { name: "Sabi EMR", tenants: subscriptions.filter((s) => s.snapshotModuleIds.some((m) => m.startsWith("emr."))).length },
    workforce: { name: "Workforce", tenants: subscriptions.filter((s) => s.snapshotModuleIds.some((m) => m.startsWith("workforce."))).length },
    accounting: { name: "Accounting", tenants: subscriptions.filter((s) => s.snapshotModuleIds.some((m) => m.startsWith("accounting."))).length },
  };
}
