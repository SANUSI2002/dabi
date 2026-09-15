import { useMemo } from "react";
import { AlertTriangle, ArrowRight, Building2, CircleDollarSign, FileWarning, HeartPulse, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Bars, Donut, Lines } from "@/components/ui/Chart";
import { useCommandCenter } from "../useCommandCenter";
import { CommandButton, CommandPageHeader, MetricCard, Panel, PanelHeader, StatusPill } from "../components/ui";
import { daysUntil, formatMoney } from "../format";

const revenue = [
  { month: "Apr", mrr: 2870, arr: 34440 }, { month: "May", mrr: 3015, arr: 36180 }, { month: "Jun", mrr: 3260, arr: 39120 },
  { month: "Jul", mrr: 3510, arr: 42120 }, { month: "Aug", mrr: 3735, arr: 44820 }, { month: "Sep", mrr: 3980, arr: 47760 },
];
const growth = [
  { month: "Apr", tenants: 7, subscriptions: 6 }, { month: "May", tenants: 8, subscriptions: 7 }, { month: "Jun", tenants: 9, subscriptions: 8 },
  { month: "Jul", tenants: 10, subscriptions: 9 }, { month: "Aug", tenants: 11, subscriptions: 10 }, { month: "Sep", tenants: 12, subscriptions: 11 },
];

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
  const health = state.serviceHealth.every((s) => s.status === "Operational") ? "Operational" : "1 degraded";
  const alerts = [
    { tone: "amber", title: `${stats.expiring.length} hospital licenses expire within 30 days`, detail: "Renewal outreach is due this week", to: "/command-center/licenses" },
    { tone: "red", title: `${stats.overdue.length} customer invoices overdue`, detail: `${formatMoney(stats.overdue.reduce((n, i) => n + i.total, 0))} needs collection`, to: "/command-center/invoices" },
    { tone: "amber", title: `${stats.docs.length} onboarding documents awaiting review`, detail: "Compliance verification queue", to: "/command-center/documents" },
    { tone: "red", title: "1 subscription payment failed", detail: "Cedar Diagnostics · retry scheduled", to: "/command-center/transactions" },
    { tone: "amber", title: "Notification delivery is degraded", detail: "SMS latency elevated in West Africa", to: "/command-center/health" },
  ];

  return <div>
    <CommandPageHeader eyebrow="Executive operations" title="Platform overview" description="Commercial, identity and operational health across every Sabi OS tenant." actions={<><CommandButton variant="secondary" onClick={() => navigate("/command-center/audit")}>View audit log</CommandButton><CommandButton onClick={() => navigate("/command-center/organizations")}>Open organizations <ArrowRight size={15} /></CommandButton></>} />
    <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-8">
      <MetricCard label="Organizations" value={state.organizations.length} hint="total tenants" trend={9.1} icon={<Building2 size={15} />} />
      <MetricCard label="Active hospitals" value={stats.active} hint={`${stats.trials} trial`} trend={5.4} />
      <MetricCard label="Platform users" value={stats.users.toLocaleString()} hint="licensed active" trend={8.2} icon={<Users size={15} />} />
      <MetricCard label="Active subscriptions" value={state.subscriptions.filter((s) => s.status === "Active").length} hint={`${stats.suspended} suspended`} trend={3.6} />
      <MetricCard label="MRR" value={formatMoney(stats.mrr)} hint="recurring" trend={6.6} icon={<CircleDollarSign size={15} />} />
      <MetricCard label="ARR" value={formatMoney(stats.mrr * 12)} hint="run rate" trend={6.6} />
      <MetricCard label="Outstanding" value={formatMoney(state.invoices.filter((i) => ["Due", "Overdue"].includes(i.status)).reduce((n, i) => n + i.total, 0))} hint="customer invoices" trend={-2.8} />
      <MetricCard label="System health" value={health} hint={`${stats.openIncidents} open incident`} icon={<HeartPulse size={15} />} />
    </div>

    <div className="mt-4 grid gap-4 xl:grid-cols-[1.55fr_1fr]">
      <Panel><PanelHeader title="Revenue trend" description="Monthly and annual recurring revenue · ₦000" /><div className="p-3"><Lines data={revenue} x="month" series={[{ key: "mrr", label: "MRR", color: "#10b981" }, { key: "arr", label: "ARR", color: "#0f172a" }]} height={260} /></div></Panel>
      <Panel><PanelHeader title="Attention required" description="Prioritized across finance, onboarding and operations" /><div className="divide-y divide-slate-100">{alerts.map((alert) => <button key={alert.title} onClick={() => navigate(alert.to)} className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-slate-50"><span className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg ${alert.tone === "red" ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-600"}`}>{alert.tone === "red" ? <AlertTriangle size={14} /> : <FileWarning size={14} />}</span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-slate-800">{alert.title}</span><span className="block text-xs text-slate-500">{alert.detail}</span></span><ArrowRight size={14} className="mt-1 text-slate-300" /></button>)}</div></Panel>
    </div>

    <div className="mt-4 grid gap-4 lg:grid-cols-3">
      <Panel><PanelHeader title="Tenant & subscription growth" /><div className="p-3"><Lines data={growth} x="month" series={[{ key: "tenants", label: "Tenants", color: "#10b981" }, { key: "subscriptions", label: "Subscriptions", color: "#64748b" }]} height={220} area /></div></Panel>
      <Panel><PanelHeader title="Portfolio status" /><div className="px-2 pb-2"><Donut data={[{ label: "Active", value: stats.active, color: "#10b981" }, { label: "Trial", value: stats.trials, color: "#f59e0b" }, { label: "Onboarding", value: stats.onboarding, color: "#38bdf8" }, { label: "Restricted", value: state.organizations.length - stats.active - stats.trials - stats.onboarding, color: "#ef4444" }]} height={220} centerLabel="tenants" /></div></Panel>
      <Panel><PanelHeader title="Product adoption" description={`${moduleAdoption} tracked module groups`} /><div className="p-3"><Bars data={Object.values(PRODUCT_ADOPTION(state.subscriptions))} x="name" series={[{ key: "tenants", color: "#10b981" }]} height={220} layout="vertical" /></div></Panel>
    </div>

    <Panel className="mt-4"><PanelHeader title="Tenant onboarding" description="Commercial-to-go-live visibility" action={<CommandButton variant="quiet" onClick={() => navigate("/command-center/onboarding")}>View onboarding <ArrowRight size={14} /></CommandButton>} /><div className="overflow-x-auto"><table className="w-full"><thead><tr className="border-b border-slate-100 bg-slate-50/80"><th className="cc-th">Organization</th><th className="cc-th">Status</th><th className="cc-th">Owner</th><th className="cc-th">Progress</th><th className="cc-th">Target go-live</th></tr></thead><tbody>{state.workflows.map((workflow) => { const org = state.organizations.find((o) => o.id === workflow.organizationId)!; const tasks = state.onboardingTasks.filter((t) => t.workflowId === workflow.id); const progress = Math.round(tasks.filter((t) => t.status === "Completed").length / tasks.length * 100); return <tr key={workflow.id} className="border-b border-slate-100 last:border-0"><td className="cc-td font-semibold text-slate-900">{org.name}</td><td className="cc-td"><StatusPill status={workflow.status} /></td><td className="cc-td">{org.implementationManager}</td><td className="cc-td"><div className="flex items-center gap-2"><div className="h-1.5 w-28 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${progress}%` }} /></div><span className="text-xs font-semibold">{progress}%</span></div></td><td className="cc-td">{workflow.targetGoLiveDate}</td></tr>; })}</tbody></table></div></Panel>
  </div>;
}

function PRODUCT_ADOPTION(subscriptions: ReturnType<typeof useCommandCenter.getState>["subscriptions"]) {
  return {
    emr: { name: "Sabi EMR", tenants: subscriptions.filter((s) => s.snapshotModuleIds.some((m) => m.startsWith("emr."))).length },
    workforce: { name: "Workforce", tenants: subscriptions.filter((s) => s.snapshotModuleIds.some((m) => m.startsWith("workforce."))).length },
    accounting: { name: "Accounting", tenants: subscriptions.filter((s) => s.snapshotModuleIds.some((m) => m.startsWith("accounting."))).length },
  };
}
