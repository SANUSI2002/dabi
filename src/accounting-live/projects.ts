import { create } from "zustand";
import { useProjects } from "@/store/accounting/useProjects";
import { useNotifications, type Alert, type NotificationKey } from "@/store/accounting/useNotifications";
import { useAcctControl } from "@/store/accounting/useAcctControl";
import { useAP } from "@/store/accounting/useAP";
import { useExpenses } from "@/store/accounting/useExpenses";
import { useIdentity } from "@/store/useIdentity";
import { accountingRequest } from "@/emr-live/client";
import type { Project, TimeEntry } from "@/data/accounting/projects";
import { adoptLiveIdentity, liveChange, uuid } from "@/workforce-live/sync";
import { loadLedger } from "./ledger";

// Projects and accounting notifications in live mode (GET /projects). Projects and time entries are the
// organization's; billing time is an invoice (receivables marks the time invoiced on the server). The
// alert feed is still derived from the live books, with two differences: "waiting for my approval" is
// whatever the server says is yours to decide, and low-stock alerts are left out until inventory
// accounting is connected (the demo stock is not the hospital's). Preferences are saved per user.

type Versioned = { version?: number };
type ApiProjects = { projects: (Project & Versioned)[]; timeEntries: TimeEntry[]; notificationPrefs: Record<NotificationKey, boolean> | null };

export const useLiveProjectsMeta = create<{ loaded: boolean }>(() => ({ loaded: false }));
const noNull = <T extends object>(row: T) => Object.fromEntries(Object.entries(row).filter(([, v]) => v !== null && v !== undefined)) as T;

// the demo's own alert feed, kept to derive the live one from
const demoAlerts = useNotifications.getState().alerts;

export async function loadProjects() {
  const { data } = await accountingRequest<{ data: ApiProjects }>("/projects");
  adoptLiveIdentity(null);
  useLiveProjectsMeta.setState({ loaded: true });
  useProjects.setState({ projects: data.projects.map((p) => noNull(p)), timeEntries: data.timeEntries.map((t) => noNull(t)) });
  const uid = useIdentity.getState().user.id;
  useNotifications.setState({ prefs: data.notificationPrefs ? { [uid]: data.notificationPrefs } : {} });
}

const reload = async () => { await Promise.all([loadProjects(), loadLedger()]); };
const post = (path: string, body: unknown = {}) => accountingRequest(path, { method: "POST", body });
const defined = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== ""));

function liveAlerts(): Alert[] {
  const prefs = useNotifications.getState().prefsFor(useIdentity.getState().user.id);
  const mine = useAcctControl.getState().canDecide;
  const out = demoAlerts().filter((a) => a.key !== "approvalPending" && a.key !== "lowStock");
  if (prefs.approvalPending) {
    const ap = useAP.getState();
    for (const b of ap.bills.filter((x) => x.status === "Pending Approval" && mine(x.approval))) out.unshift({ id: `ap-${b.id}`, key: "approvalPending", severity: "urgent", title: `Bill ${b.number} needs your approval`, detail: ap.vendorById(b.vendorId)?.name ?? "", href: "/accounting/approvals" });
    for (const r of ap.requisitions.filter((x) => x.status === "Pending Approval" && mine(x.approval))) out.unshift({ id: `pr-${r.id}`, key: "approvalPending", severity: "urgent", title: `Requisition ${r.number} needs your approval`, detail: r.justification, href: "/accounting/approvals" });
    for (const c of useExpenses.getState().claims.filter((x) => x.status === "Pending Approval" && mine(x.approval))) out.unshift({ id: `ex-${c.id}`, key: "approvalPending", severity: "urgent", title: `Expense claim ${c.number} needs your approval`, detail: c.title, href: "/accounting/approvals" });
  }
  return out;
}

export function goLiveProjects() {
  useProjects.setState({
    addProject: (p) => {
      const id = uuid();
      void liveChange(() => post("/projects", defined({ id, code: p.code, name: p.name, customerId: p.customerId, status: p.status, startDate: p.startDate, endDate: p.endDate, budgetAmount: p.budgetAmount, billable: p.billable, description: p.description })), reload);
      return id;
    },
    updateProject: (id, change) => {
      const version = (useProjects.getState().projects.find((x) => x.id === id) as (Project & Versioned) | undefined)?.version ?? 1;
      const body = defined({ name: change.name, customerId: change.customerId, status: change.status, startDate: change.startDate, endDate: change.endDate, budgetAmount: change.budgetAmount, billable: change.billable, description: change.description });
      void liveChange(() => accountingRequest(`/projects/${id}`, { method: "PATCH", body, version }), reload, () => useProjects.setState((s) => ({ projects: s.projects.map((x) => (x.id === id ? { ...x, ...change } : x)) })));
    },
    addTimeEntry: (t) => { void liveChange(() => post("/projects/time", defined({ id: uuid(), ...t, rate: t.billable ? t.rate : undefined })), reload); },
    removeTimeEntry: (id) => {
      if (useProjects.getState().timeEntries.find((t) => t.id === id)?.status === "Invoiced") return;
      void liveChange(() => post(`/projects/time/${id}/remove`), reload, () => useProjects.setState((s) => ({ timeEntries: s.timeEntries.filter((t) => t.id !== id) })));
    },
    markTimeInvoiced: () => {}, // the server marks time invoiced with the invoice that bills it
  });

  useNotifications.setState({
    setPref: (key, on) => {
      const uid = useIdentity.getState().user.id;
      const next = { ...useNotifications.getState().prefsFor(uid), [key]: on };
      void liveChange(() => accountingRequest("/notification-prefs", { method: "PUT", body: next }), loadProjects, () => useNotifications.setState((s) => ({ prefs: { ...s.prefs, [uid]: next } })));
    },
    alerts: liveAlerts,
  });
}

export function clearProjects() {
  useLiveProjectsMeta.setState({ loaded: false });
  useProjects.setState({ projects: [], timeEntries: [] });
  useNotifications.setState({ prefs: {} });
}
