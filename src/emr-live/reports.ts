import { useEffect } from "react";
import { create } from "zustand";
import type { AuditEvent, Encounter, LabOrder, Patient, Prescription } from "@/data/types";
import { emrRequest } from "./client";
import { liveLabTest } from "./lab";
import { patientFromApi, type ApiPatient } from "./mappers";

// Reporting in live mode, all computed by the hospital's EMR from its own record:
// - the report builder's source for a period (GET /reports/source): visits with diagnoses and
//   prescriptions, lab orders, the people they name, and register totals;
// - NHMIS dataset sizes and derivable MSF figures (GET /reports/counts);
// - the Monthly Summary Form, saved per month and locked as compiled (GET/PUT /reports/msf/:period,
//   POST …/compile) — compiling does NOT send the return to the LGA or any other platform;
// - the audit trail (GET /audit-events), with each actor's name and roles.

type ApiPatientSummary = Pick<ApiPatient, "id" | "medicalRecordNumber" | "givenName" | "familyName" | "dateOfBirth" | "sex">;
type ApiLabOrder = Parameters<typeof liveLabTest>[0];
type ApiRxLine = { id: string; drug: string; drugCode: string | null; dose: number; doseUnit: string; frequency: string; route: string; durationDays: number | null; quantity: number; dispensed: number; status: "ACTIVE" | "COMPLETED" | "CANCELLED" };
export type ApiReportSource = {
  from: string; to: string; truncated: boolean;
  encounters: { id: string; patientId: string; date: string; complaint: string; status: string; visitType: string | null; provider: string | null; diagnoses: { code: string; name: string }[]; prescriptions: ApiRxLine[] }[];
  labOrders: ApiLabOrder[];
  patients: ApiPatientSummary[];
  registry: { total: number; consentYes: number; consentNo: number; consentUnknown: number };
};
export type ReportCounts = {
  from: string; to: string;
  datasets: { opd: number; immunization: number; maternal: number; births: number; surveillance: number; familyPlanning: number; referrals: number; transfers: number };
  msf: Record<string, number>;
};

const rxStatus = (line: ApiRxLine): Prescription["status"] =>
  line.status === "CANCELLED" ? "Cancelled" : line.dispensed >= line.quantity && line.quantity > 0 ? "Dispensed" : line.dispensed > 0 ? "Partially Dispensed" : "Pending";

export function encounterFromReport(e: ApiReportSource["encounters"][number]): Encounter {
  return {
    id: e.id, patientId: e.patientId, date: e.date, provider: e.provider ?? "Unassigned", complaint: e.complaint, station: "Consultation",
    diagnoses: e.diagnoses, labs: [],
    prescriptions: e.prescriptions.map((p) => ({
      id: p.id, drug: p.drug, drugCode: p.drugCode ?? undefined, dose: `${p.dose} ${p.doseUnit}`, doseUnit: p.doseUnit, frequency: p.frequency, route: p.route,
      duration: p.durationDays ? `${p.durationDays} days` : "—", qty: p.quantity, status: rxStatus(p),
    })),
    visitType: e.visitType ?? undefined,
  };
}

export type LiveReportSource = { encounters: Encounter[]; labOrders: LabOrder[]; patients: Patient[]; registry: ApiReportSource["registry"]; truncated: boolean };
export const reportSourceFromApi = (data: ApiReportSource): LiveReportSource => ({
  encounters: data.encounters.map(encounterFromReport),
  labOrders: data.labOrders.flatMap((order) => order.items.map((item) => liveLabTest(order, item))),
  patients: data.patients.map(patientFromApi),
  registry: data.registry,
  truncated: data.truncated,
});

export type ApiAuditEvent = { id: string; action: string; resourceType: string; resourceId: string | null; actorUserId: string | null; actorName: string | null; actorRoles: string[]; changedFields: string[]; createdAt: string };
const roleLabel = (code: string) => code.split("_").map((w) => w.charAt(0) + w.slice(1).toLowerCase()).join(" ");
export const auditFromApi = (e: ApiAuditEvent): AuditEvent => ({
  id: e.id, ts: e.createdAt, user: e.actorName ?? (e.actorUserId ? "Former member" : "System"), role: e.actorRoles.map(roleLabel).join(", ") || "—",
  action: e.action, resource: e.resourceId ? `${e.resourceType}/${e.resourceId}` : e.resourceType,
  ip: "Not recorded", // the EMR trail records who, what and when — not the network address
  ...(e.changedFields.length ? { meta: { changedFields: e.changedFields } } : {}),
});

export type MsfReturn = { id: string; period: string; values: Record<string, number>; status: "DRAFT" | "COMPILED"; version: number; updatedByName: string | null; compiledByName: string | null; compiledAt: string | null };

type ReportState = {
  source: LiveReportSource | null;
  counts: ReportCounts | null;
  msf: { period: string; derived: Record<string, number>; saved: MsfReturn | null } | null;
  audit: AuditEvent[];
  auditCursor: string | null;
  error: string;
  loadSource: (from: string, to: string) => Promise<void>;
  loadCounts: (from: string, to: string) => Promise<void>;
  loadMsf: (period: string) => Promise<void>;
  saveMsf: (values: Record<string, number>) => Promise<void>;
  compileMsf: (values: Record<string, number>) => Promise<void>;
  loadAudit: (more?: boolean) => Promise<void>;
};

const message = (cause: unknown, fallback: string) => (cause instanceof Error ? cause.message : fallback);

export const useLiveReports = create<ReportState>((set, get) => ({
  source: null, counts: null, msf: null, audit: [], auditCursor: null, error: "",
  loadSource: async (from, to) => {
    try {
      const result = await emrRequest<{ data: ApiReportSource }>(`/reports/source?from=${from}&to=${to}`);
      set({ source: reportSourceFromApi(result.data), error: "" });
    } catch (cause) { set({ error: message(cause, "The report could not be loaded.") }); }
  },
  loadCounts: async (from, to) => {
    try {
      const result = await emrRequest<{ data: ReportCounts }>(`/reports/counts?from=${from}&to=${to}`);
      set({ counts: result.data, error: "" });
    } catch (cause) { set({ error: message(cause, "Report counts could not be loaded.") }); }
  },
  loadMsf: async (period) => {
    try {
      const result = await emrRequest<{ data: { period: string; derived: Record<string, number>; saved: MsfReturn | null } }>(`/reports/msf/${period}`);
      set({ msf: result.data, error: "" });
    } catch (cause) { set({ error: message(cause, "The monthly return could not be loaded.") }); }
  },
  saveMsf: async (values) => {
    const msf = get().msf;
    if (!msf) throw new Error("The monthly return is not loaded yet.");
    await emrRequest(`/reports/msf/${msf.period}`, { method: "PUT", ...(msf.saved ? { version: msf.saved.version } : {}), body: { values } });
    await get().loadMsf(msf.period);
  },
  compileMsf: async (values) => {
    await get().saveMsf(values);
    const msf = get().msf;
    if (!msf?.saved) throw new Error("The monthly return could not be saved.");
    await emrRequest(`/reports/msf/${msf.period}/compile`, { method: "POST", version: msf.saved.version, body: {} });
    await get().loadMsf(msf.period);
  },
  loadAudit: async (more = false) => {
    try {
      const cursor = more ? get().auditCursor : null;
      const result = await emrRequest<{ data: { items: ApiAuditEvent[]; nextCursor: string | null } }>(`/audit-events?limit=200${cursor ? `&cursor=${cursor}` : ""}`);
      const page = result.data.items.map(auditFromApi);
      set({ audit: more ? [...get().audit, ...page] : page, auditCursor: result.data.nextCursor, error: "" });
    } catch (cause) { set({ error: message(cause, "The audit trail could not be loaded.") }); }
  },
}));

export function useLiveReportSource(enabled: boolean, from: string, to: string) {
  useEffect(() => { if (enabled) void useLiveReports.getState().loadSource(from, to); }, [enabled, from, to]);
}
export function useLiveReportCounts(enabled: boolean, from: string, to: string) {
  useEffect(() => { if (enabled) void useLiveReports.getState().loadCounts(from, to); }, [enabled, from, to]);
}
export function useLiveMsf(enabled: boolean, period: string) {
  useEffect(() => { if (enabled) void useLiveReports.getState().loadMsf(period); }, [enabled, period]);
}
export function useLiveAudit(enabled: boolean) {
  useEffect(() => { if (enabled) void useLiveReports.getState().loadAudit(); }, [enabled]);
}
