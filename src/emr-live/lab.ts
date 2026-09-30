import { useEffect } from "react";
import { create } from "zustand";
import type { LabOrder, Patient } from "@/data/types";
import { emrRequest } from "./client";
import { patientFromApi, type ApiPatient } from "./mappers";

// The hospital's laboratory for the live Laboratory screen. The backend groups tests into orders
// (one specimen, one accession number per order); the screen shows one card per test, so each
// ordered test becomes a LabOrder-shaped row that still knows its order. Every action goes to the
// server and the worklist is reloaded from it.

const REFRESH_MS = 20_000;

type Range = { low?: number; high?: number };
export type LabAnalyte = {
  code: string; name: string; kind: "NUMERIC" | "CHOICE" | "TEXT"; unit?: string;
  low?: number; high?: number; female?: Range; male?: Range; options?: string[];
};

/** The reference range the server flags against for this patient (sex-specific when defined). */
export function analyteRange(analyte: LabAnalyte, sex: Patient["sex"]) {
  const specific = sex === "F" ? analyte.female : sex === "M" ? analyte.male : undefined;
  return { referenceLow: specific?.low ?? analyte.low ?? null, referenceHigh: specific?.high ?? analyte.high ?? null };
}
type ApiFlag = "NORMAL" | "LOW" | "HIGH" | "CRITICAL_LOW" | "CRITICAL_HIGH" | "ABNORMAL";
export type LabResultRow = {
  analyteCode: string; analyteName: string; valueNumeric: number | null; valueText: string | null; unit: string | null;
  referenceLow: number | null; referenceHigh: number | null; flag: ApiFlag | null; status: "PRELIMINARY" | "FINAL" | "SUPERSEDED";
};
type ApiLabItem = {
  id: string; testCode: string; testName: string; specimenType: string; analytes: LabAnalyte[];
  status: "PENDING" | "RESULTED" | "VERIFIED"; version: number;
  resultedAt: string | null; resultedByName: string | null; verifiedAt: string | null; verifiedByName: string | null;
  returnReason: string | null; returnedAt: string | null; returnedByName: string | null;
  acknowledgedAt: string | null; acknowledgedByName: string | null;
  criticalCommunicatedAt: string | null; criticalCommunicatedByName: string | null; criticalCommunicatedToName: string | null;
  results: LabResultRow[];
};
type ApiLabOrder = {
  id: string; patientId: string; encounterId: string; status: "ORDERED" | "COLLECTED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  priority: "ROUTINE" | "URGENT" | "STAT"; accessionNumber: string | null; version: number; createdAt: string;
  orderedByName: string | null; collectedAt: string | null; collectedByName: string | null; specimenNote: string | null;
  cancelledAt: string | null; cancelledByName: string | null; cancellationReason: string | null;
  patient: Pick<ApiPatient, "id" | "medicalRecordNumber" | "givenName" | "familyName" | "dateOfBirth" | "sex">;
  items: ApiLabItem[];
};

/** One ordered test as the Laboratory screen shows it, plus what live actions need. */
export type LiveLabTest = LabOrder & {
  orderId: string;
  orderVersion: number;
  itemVersion: number;
  accessionNumber: string | null;
  analytes: LabAnalyte[];
  results: LabResultRow[];
  patient: Patient;
};

const FLAG_ORDER: Record<ApiFlag, number> = { NORMAL: 0, ABNORMAL: 1, LOW: 1, HIGH: 1, CRITICAL_LOW: 2, CRITICAL_HIGH: 2 };

/** The test's overall flag, from its worst analyte (the server computes every flag). */
export function overallFlag(results: LabResultRow[]): LabOrder["flag"] {
  const flagged = results.map((r) => r.flag).filter((flag): flag is ApiFlag => Boolean(flag));
  if (!flagged.length) return undefined;
  const worst = flagged.reduce((a, b) => (FLAG_ORDER[b] > FLAG_ORDER[a] ? b : a));
  return ({ NORMAL: "Normal", LOW: "Low", HIGH: "High", ABNORMAL: "Abnormal", CRITICAL_LOW: "Critical", CRITICAL_HIGH: "Critical" } as const)[worst];
}

export const resultValue = (r: LabResultRow) => (r.valueNumeric !== null ? `${r.valueNumeric}${r.unit ? ` ${r.unit}` : ""}` : r.valueText ?? "—");
export const referenceText = (r: Pick<LabResultRow, "referenceLow" | "referenceHigh">) =>
  r.referenceLow !== null && r.referenceHigh !== null ? `${r.referenceLow}–${r.referenceHigh}`
    : r.referenceLow !== null ? `≥ ${r.referenceLow}` : r.referenceHigh !== null ? `≤ ${r.referenceHigh}` : "";

function status(order: ApiLabOrder, item: ApiLabItem): LabOrder["status"] {
  if (order.status === "CANCELLED") return "Rejected";
  if (order.status === "ORDERED") return "Pending";
  if (item.status === "VERIFIED") return "Resulted";
  if (item.status === "RESULTED") return "Awaiting Approval";
  return "In Process";
}

export function liveLabTest(order: ApiLabOrder, item: ApiLabItem): LiveLabTest {
  const current = item.results.filter((r) => r.status !== "SUPERSEDED");
  const flag = overallFlag(current);
  return {
    id: item.id,
    orderId: order.id,
    orderVersion: order.version,
    itemVersion: item.version,
    accessionNumber: order.accessionNumber,
    analytes: item.analytes,
    results: current,
    patient: patientFromApi(order.patient),
    patientId: order.patientId,
    encounterId: order.encounterId,
    test: item.testName,
    category: item.specimenType,
    urgency: order.priority === "ROUTINE" ? "Routine" : order.priority === "STAT" ? "STAT" : "Urgent",
    status: status(order, item),
    orderedAt: order.createdAt,
    orderedBy: order.orderedByName ?? "—",
    result: current.length ? current.map((r) => `${r.analyteName} ${resultValue(r)}${referenceText(r) ? ` (${referenceText(r)})` : ""}`).join("; ") : undefined,
    flag,
    verifiedBy: item.verifiedByName ?? undefined,
    sampleType: order.specimenNote ?? item.specimenType,
    sampleCollectedBy: order.collectedByName ?? undefined,
    sampleCollectedAt: order.collectedAt ?? undefined,
    phaseIndex: 0,
    phaseLog: [],
    resultFields: Object.fromEntries(current.map((r) => [r.analyteCode, resultValue(r)])),
    submittedBy: item.resultedByName ?? undefined,
    submittedAt: item.resultedAt ?? undefined,
    approvedBy: item.verifiedByName ?? undefined,
    approvedAt: item.verifiedAt ?? undefined,
    revisionNote: item.status === "PENDING" ? item.returnReason ?? undefined : undefined,
    acknowledgedBy: item.acknowledgedByName ?? undefined,
    acknowledgedAt: item.acknowledgedAt ?? undefined,
    criticalCommunicatedBy: item.criticalCommunicatedByName ?? undefined,
    criticalCommunicatedTo: item.criticalCommunicatedToName ?? undefined,
    criticalCommunicatedAt: item.criticalCommunicatedAt ?? undefined,
    rejectedReason: order.cancellationReason ?? undefined,
    rejectedBy: order.cancelledByName ?? undefined,
    rejectedAt: order.cancelledAt ?? undefined,
  };
}

type Clinician = { userId: string; name: string };

type LiveLabState = {
  tests: LiveLabTest[];
  clinicians: Clinician[];
  error: string;
  load: () => Promise<void>;
  loadClinicians: () => Promise<void>;
  collect: (test: LiveLabTest, sampleType: string) => Promise<void>;
  reject: (test: LiveLabTest, reason: string) => Promise<void>;
  enterResults: (test: LiveLabTest, values: Record<string, string>) => Promise<void>;
  sendBack: (test: LiveLabTest, reason: string) => Promise<void>;
  verify: (test: LiveLabTest) => Promise<void>;
  acknowledge: (test: LiveLabTest) => Promise<void>;
  communicate: (test: LiveLabTest, toUserId: string) => Promise<void>;
};

const itemPath = (test: LiveLabTest) => `/lab/orders/${test.orderId}/items/${test.id}`;

export const useLiveLab = create<LiveLabState>((set, get) => {
  const after = async (action: Promise<unknown>) => { await action; await get().load(); };
  return {
    tests: [],
    clinicians: [],
    error: "",

    // Work still open, oldest first (the bench's order), and the most recent finished orders.
    load: async () => {
      try {
        const [open, closed] = await Promise.all([
          emrRequest<{ data: { items: ApiLabOrder[] } }>("/lab/orders?status=ORDERED,COLLECTED,IN_PROGRESS&limit=100"),
          emrRequest<{ data: { items: ApiLabOrder[] } }>("/lab/orders?status=COMPLETED,CANCELLED&sort=newest&limit=50"),
        ]);
        const tests = [...open.data.items, ...closed.data.items].flatMap((order) => order.items.map((item) => liveLabTest(order, item)));
        set({ tests, error: "" });
      } catch (cause) {
        set({ error: cause instanceof Error ? cause.message : "The laboratory worklist could not be loaded." });
      }
    },

    loadClinicians: async () => {
      const result = await emrRequest<{ data: { items: Clinician[] } }>("/staff?permission=lab.order.create");
      set({ clinicians: result.data.items });
    },

    collect: (test, sampleType) => after(emrRequest(`/lab/orders/${test.orderId}/collect`, {
      method: "POST", version: test.orderVersion, body: { note: `Sample: ${sampleType}` },
    })),
    reject: (test, reason) => after(emrRequest(`/lab/orders/${test.orderId}/cancel`, { method: "POST", version: test.orderVersion, body: { reason } })),
    enterResults: (test, values) => after(emrRequest(`${itemPath(test)}/results`, {
      method: "PUT",
      version: test.itemVersion,
      body: {
        results: test.analytes.map((analyte) => {
          const raw = (values[analyte.code] ?? "").trim();
          return { analyteCode: analyte.code, value: analyte.kind === "NUMERIC" && raw !== "" && Number.isFinite(Number(raw)) ? Number(raw) : raw };
        }),
      },
    }).catch((cause) => {
      // Problems come back per analyte code (e.g. PLT); name them as the form does (Platelets).
      const error = cause as { details?: Array<{ field?: string; message: string }> };
      error.details = error.details?.map((detail) => ({ ...detail, field: test.analytes.find((a) => a.code === detail.field)?.name ?? detail.field }));
      throw cause;
    })),
    sendBack: (test, reason) => after(emrRequest(`${itemPath(test)}/return`, { method: "POST", version: test.itemVersion, body: { reason } })),
    verify: (test) => after(emrRequest(`${itemPath(test)}/verify`, { method: "POST", version: test.itemVersion, body: {} })),
    acknowledge: (test) => after(emrRequest(`${itemPath(test)}/acknowledge`, { method: "POST", version: test.itemVersion, body: {} })),
    communicate: (test, toUserId) => after(emrRequest(`${itemPath(test)}/communicate`, { method: "POST", version: test.itemVersion, body: { toUserId } })),
  };
});

/** Loads the worklist now and keeps it fresh while the Laboratory screen is open. */
export function useLiveLabRefresh(enabled: boolean, withClinicians: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const { load, loadClinicians } = useLiveLab.getState();
    void load();
    if (withClinicians) loadClinicians().catch(() => undefined);
    const timer = window.setInterval(() => { void load(); }, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [enabled, withClinicians]);
}
