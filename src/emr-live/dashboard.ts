import { useEffect } from "react";
import { create } from "zustand";
import { emrRequest } from "./client";

// The workspace dashboard in live mode: one read of GET /dashboard. Parts the signed-in role may
// not see come back as null, so the screen says so instead of showing a zero.

type ApiPerson = { id: string; name: string; medicalRecordNumber: string } | null;
export type LiveDashboard = {
  queue: { waiting: number; inProgress: number; completed: number; referred: number } | null;
  patients: number | null;
  labPending: number | null;
  prescriptionsPending: number | null;
  beds: { available: number; occupied: number; total: number; admitted: number } | null;
  lowStock: { code: string; name: string; form: string; onHand: number; reorderLevel: number }[] | null;
  work: {
    unsignedNotes?: { id: string; encounterId: string; kind: string; reason: string | null; createdAt: string; patient: ApiPerson }[];
    criticalResults?: { id: string; testName: string; result: string; resultedAt: string | null; patient: ApiPerson }[];
    resultsToAcknowledge?: { id: string; testName: string; result: string; abnormal: boolean; verifiedAt: string | null; patient: ApiPerson }[];
    pendingLabTests?: { id: string; testName: string; orderedAt: string; collectedAt: string | null; patient: ApiPerson }[];
    followUpsDue?: { id: string; scheduledAt: string; reason: string | null; patient: ApiPerson }[];
  };
  month: { outpatientVisits?: number; admissions?: number; labTestsResulted?: number; prescriptionsDispensed?: number };
  revenue: { collectedThisMonthMinor: number; unpaidInvoices: number } | null;
  activity: { id: string; action: string; resourceType: string; actorName: string | null; createdAt: string }[] | null;
};

/** The caller's local start of day and of month, so "today" matches the clock on the wall. */
export function dashboardWindow(now = new Date()) {
  const day = new Date(now); day.setHours(0, 0, 0, 0);
  const month = new Date(day); month.setDate(1);
  return { since: day.toISOString(), monthStart: month.toISOString() };
}

/** Tests still waiting for results past their turnaround time (from collection, else from ordering). */
export function overdueLabTests(tests: NonNullable<LiveDashboard["work"]["pendingLabTests"]>, turnaroundMinutes: (testName: string) => number, now = Date.now()) {
  return tests.filter((test) => now - new Date(test.collectedAt ?? test.orderedAt).getTime() > turnaroundMinutes(test.testName) * 60_000);
}

/** "lab_result.verified" → "verified lab result". */
export function describeAction(action: string) {
  const [resource, verb] = action.split(".");
  if (!verb) return action.replace(/_/g, " ");
  return `${verb.replace(/_/g, " ")} ${resource.replace(/_/g, " ")}`;
}

type DashboardState = { data: LiveDashboard | null; error: string; load: () => Promise<void> };

export const useLiveDashboard = create<DashboardState>((set) => ({
  data: null,
  error: "",
  load: async () => {
    const { since, monthStart } = dashboardWindow();
    try {
      const result = await emrRequest<{ data: LiveDashboard }>(`/dashboard?since=${encodeURIComponent(since)}&monthStart=${encodeURIComponent(monthStart)}`);
      set({ data: result.data, error: "" });
    } catch (cause) {
      set({ error: cause instanceof Error ? cause.message : "The dashboard could not be loaded." });
    }
  },
}));

const REFRESH_MS = 60_000;

/** Loads the dashboard when live and keeps it current while the screen is open. */
export function useLiveDashboardRefresh(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    void useLiveDashboard.getState().load();
    const timer = window.setInterval(() => { void useLiveDashboard.getState().load(); }, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [enabled]);
}
