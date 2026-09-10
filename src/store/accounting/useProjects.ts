import { create } from "zustand";
import { audit } from "@/store/useAudit";
import { useIdentity } from "@/store/useIdentity";
import { useLedger } from "@/store/accounting/useLedger";
import { seedProjects, seedTimeEntries, type Project, type TimeEntry, type ProjectStatus } from "@/data/accounting/projects";

const rid = () => Math.random().toString(36).slice(2, 9);
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export type ProjectPnl = {
  revenue: number;
  cost: number;
  margin: number;
  marginPct: number;
  budget: number;
  budgetUsedPct: number;
  unbilledTime: number;
  byAccount: { accountNumber: number; name: string; amount: number; kind: "revenue" | "cost" }[];
};

type ProjectsState = {
  projects: Project[];
  timeEntries: TimeEntry[];

  addProject: (p: Omit<Project, "id" | "createdBy" | "createdAt" | "status"> & { status?: ProjectStatus }) => string;
  updateProject: (id: string, patch: Partial<Project>) => void;
  projectById: (id?: string) => Project | undefined;

  addTimeEntry: (t: Omit<TimeEntry, "id" | "createdAt" | "status"> ) => void;
  removeTimeEntry: (id: string) => void;
  unbilledTimeOf: (projectId: string) => TimeEntry[];
  markTimeInvoiced: (ids: string[], invoiceId: string) => void;

  projectPnl: (projectId: string, asOf?: string) => ProjectPnl;
};

export const useProjects = create<ProjectsState>((set, get) => ({
  projects: seedProjects,
  timeEntries: seedTimeEntries,

  addProject: (p) => {
    const id = `prj-${rid()}`;
    const project: Project = { ...p, id, status: p.status ?? "Active", createdBy: useIdentity.getState().user.id, createdAt: new Date().toISOString() };
    set((s) => ({ projects: [project, ...s.projects] }));
    audit(`created project ${p.code} — ${p.name}`, `accounting/projects/${p.code}`);
    return id;
  },
  updateProject: (id, patch) => {
    set((s) => ({ projects: s.projects.map((x) => (x.id === id ? { ...x, ...patch } : x)) }));
    audit(`updated project`, `accounting/projects/${id}`);
  },
  projectById: (id) => get().projects.find((p) => p.id === id),

  addTimeEntry: (t) => {
    const entry: TimeEntry = { ...t, id: `te-${rid()}`, status: t.billable ? "Unbilled" : "Non-billable", createdAt: new Date().toISOString() };
    set((s) => ({ timeEntries: [entry, ...s.timeEntries] }));
    audit(`logged ${t.hours}h against a project`, `accounting/projects/${t.projectId}/time`);
  },
  removeTimeEntry: (id) => set((s) => ({ timeEntries: s.timeEntries.filter((t) => t.id !== id || t.status === "Invoiced") })),
  unbilledTimeOf: (projectId) => get().timeEntries.filter((t) => t.projectId === projectId && t.status === "Unbilled"),
  markTimeInvoiced: (ids, invoiceId) => set((s) => ({ timeEntries: s.timeEntries.map((t) => (ids.includes(t.id) ? { ...t, status: "Invoiced", invoiceId } : t)) })),

  projectPnl: (projectId, asOf = new Date().toISOString()) => {
    const project = get().projectById(projectId);
    const led = useLedger.getState();
    const end = new Date(asOf).getTime();
    let revenue = 0;
    let cost = 0;
    const byAccountMap = new Map<number, { amount: number; kind: "revenue" | "cost" }>();
    for (const je of led.entries) {
      if (je.status !== "Posted") continue;
      if (new Date(je.date).getTime() > end) continue;
      for (const l of je.lines) {
        if (l.projectId !== projectId) continue;
        const acct = led.accountByNumber(l.accountNumber);
        if (!acct) continue;
        if (acct.type === "revenue") {
          const amt = round2(l.credit - l.debit);
          revenue += amt;
          const cur = byAccountMap.get(l.accountNumber) ?? { amount: 0, kind: "revenue" as const };
          byAccountMap.set(l.accountNumber, { amount: cur.amount + amt, kind: "revenue" });
        } else if (acct.type === "expense" || acct.type === "cogs") {
          const amt = round2(l.debit - l.credit);
          cost += amt;
          const cur = byAccountMap.get(l.accountNumber) ?? { amount: 0, kind: "cost" as const };
          byAccountMap.set(l.accountNumber, { amount: cur.amount + amt, kind: "cost" });
        }
      }
    }
    revenue = round2(revenue);
    cost = round2(cost);
    const margin = round2(revenue - cost);
    const budget = project?.budgetAmount ?? 0;
    const unbilledTime = round2(get().unbilledTimeOf(projectId).reduce((n, t) => n + t.hours * (t.rate ?? 0), 0));
    return {
      revenue,
      cost,
      margin,
      marginPct: revenue > 0 ? round2((margin / revenue) * 100) : 0,
      budget,
      budgetUsedPct: budget > 0 ? round2((cost / budget) * 100) : 0,
      unbilledTime,
      byAccount: [...byAccountMap.entries()].map(([accountNumber, v]) => ({ accountNumber, name: led.accountByNumber(accountNumber)?.name ?? String(accountNumber), amount: round2(v.amount), kind: v.kind })).sort((a, b) => a.accountNumber - b.accountNumber),
    };
  },
}));
