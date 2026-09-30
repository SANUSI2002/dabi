import { useEffect } from "react";
import { create } from "zustand";
import type { Patient, Prescription } from "@/data/types";
import type { SafetyAlert } from "@/data/medicationSafety";
import { emrRequest } from "./client";
import { patientFromApi, type ApiPatient } from "./mappers";

// The hospital pharmacy for the live Pharmacy screen. The backend works on prescriptions (one per
// visit, several medicines, reviewed as a whole); the screen lists one row per medicine, so each
// prescription line becomes a Prescription-shaped row that still knows its prescription. Stock,
// the formulary and the stock ledger come from the pharmacy store. Every action goes to the
// server and the data is reloaded from it.

const REFRESH_MS = 20_000;

type ApiAlert = { drugCode: string; type: string; severity: "HIGH" | "MODERATE" | "INFO"; message: string; overrideReason?: string };
type ApiRxItem = {
  id: string; drugCode: string; drugName: string; strength: string; form: string; dose: number; doseUnit: string; frequency: string;
  route: string; durationDays: number | null; prn: boolean; prnReason: string | null; instructions: string | null; dispenseUnit: string;
  quantityPrescribed: number; quantityDispensed: number; status: "ACTIVE" | "COMPLETED" | "CANCELLED"; controlled: boolean;
  safetyAlerts: ApiAlert[]; closeOutcome: "OUTSOURCED" | "NOT_DISPENSED" | null; closeReason: string | null; closedAt: string | null; closedByName: string | null;
};
type ApiRx = {
  id: string; encounterId: string; patientId: string; version: number; createdAt: string;
  status: "PENDING_REVIEW" | "APPROVED" | "PARTIALLY_DISPENSED" | "DISPENSED" | "REJECTED" | "CANCELLED";
  prescriberName: string | null; reviewedByName: string | null; reviewedAt: string | null; reviewNote: string | null; rejectionReason: string | null;
  patient: Pick<ApiPatient, "id" | "medicalRecordNumber" | "givenName" | "familyName" | "dateOfBirth" | "sex">;
  items: ApiRxItem[];
  dispenses: Array<{ id: string; dispensedAt: string; dispensedByName: string | null; witnessName: string | null; lines: Array<{ prescriptionItemId: string; quantity: number }> }>;
  allergies: Array<{ substance: string; reaction: string | null; severity: string }>;
};
type ApiBatch = { id: string; batchNumber: string; expiryDate: string; quantityOnHand: number; unitCostMinor: number | null; supplier: string | null; version: number; createdAt: string };
type ApiStock = { code: string; genericName: string; strength: string; dispenseUnit: string; reorderLevel: number; onHand: number; expiredOnHand: number; batches: ApiBatch[] };
export type ApiFormularyItem = {
  code: string; genericName: string; brandName: string | null; form: string; strength: string; doseUnit: string; dispenseUnit: string;
  defaultRoute: string; controlled: boolean; active: boolean; reorderLevel: number; version: number; inStock: number;
  category: string | null; manufacturer: string | null; prescriptionRequired: boolean; minStock: number;
  patientDescription: string | null; pharmacistNotes: string | null;
};
type ApiMovement = {
  id: string; kind: "RECEIPT" | "DISPENSE" | "RETURN" | "ADJUSTMENT"; quantity: number; reason: string | null; createdAt: string;
  userName: string | null; witnessName: string | null; patient: ApiRx["patient"] | null;
};

/** One prescribed medicine as the Pharmacy screen shows it, plus what live actions need. */
export type LiveRxLine = Prescription & {
  itemId: string;
  prescriptionId: string;
  prescriptionVersion: number;
  encounterId: string;
  patientId: string;
  patient: Patient;
  orderedAt: string;
  controlled: boolean;
  remaining: number;
  dispenseUnit: string;
  alerts: SafetyAlert[];
  allergies: string[];
  /** Other medicines approved or rejected together with this one (review covers the whole prescription). */
  siblings: string[];
};

// Every alert type the prescribing checks raise (see the backend's pharmacy.policy safetyAlerts).
const ALERT_KIND: Record<string, SafetyAlert["kind"]> = {
  ALLERGY: "allergy", DUPLICATE_THERAPY: "duplicate", DUPLICATE_CLASS: "duplicate", MAX_DOSE: "dose", CONTROLLED: "controlled", HIGH_ALERT: "high-alert",
};

export function alertFromApi(alert: ApiAlert): SafetyAlert {
  return {
    kind: ALERT_KIND[alert.type] ?? "other",
    severity: alert.severity === "HIGH" ? "high" : alert.severity === "MODERATE" ? "moderate" : "info",
    message: alert.overrideReason ? `${alert.message} — prescriber's override: ${alert.overrideReason}` : alert.message,
  };
}

function lineStatus(rx: ApiRx, item: ApiRxItem): Prescription["status"] {
  if (rx.status === "PENDING_REVIEW") return "Under Review";
  if (rx.status === "REJECTED") return "Rejected";
  if (item.closeOutcome === "OUTSOURCED") return "Outsourced";
  if (item.closeOutcome === "NOT_DISPENSED") return "Refused";
  if (item.status === "CANCELLED") return "Cancelled";
  if (item.status === "COMPLETED") return "Dispensed";
  return "Approved"; // still to dispense (possibly partly given already)
}

export function liveRxLine(rx: ApiRx, item: ApiRxItem): LiveRxLine {
  const given = rx.dispenses.filter((d) => d.lines.some((l) => l.prescriptionItemId === item.id));
  const last = given.at(-1);
  // Rejections are recorded as "Reason: note" (see reject below).
  const [rejectionReason, ...note] = (rx.rejectionReason ?? "").split(": ");
  const overrides = item.safetyAlerts.map((a) => a.overrideReason).filter(Boolean);
  return {
    id: item.id,
    itemId: item.id,
    prescriptionId: rx.id,
    prescriptionVersion: rx.version,
    encounterId: rx.encounterId,
    patientId: rx.patientId,
    patient: patientFromApi(rx.patient),
    orderedAt: rx.createdAt,
    controlled: item.controlled,
    remaining: item.quantityPrescribed - item.quantityDispensed,
    dispenseUnit: item.dispenseUnit,
    alerts: item.safetyAlerts.map(alertFromApi),
    allergies: rx.allergies.map((a) => `${a.substance}${a.reaction ? ` (${a.reaction})` : ""}`),
    siblings: rx.items.filter((other) => other.id !== item.id).map((other) => `${other.drugName} ${other.strength}`),
    drug: `${item.drugName} ${item.strength}`,
    drugCode: item.drugCode,
    doseUnit: item.doseUnit,
    dose: `${item.dose} ${item.doseUnit}`,
    frequency: item.prn ? `PRN${item.prnReason ? ` (${item.prnReason})` : ""}` : item.frequency,
    duration: item.durationDays ? `${item.durationDays} day${item.durationDays === 1 ? "" : "s"}` : item.prn ? "as needed" : "—",
    qty: item.quantityPrescribed,
    route: item.route,
    instructions: item.instructions ?? undefined,
    status: lineStatus(rx, item),
    source: "Doctor Prescription",
    priority: "Routine",
    prescribedBy: rx.prescriberName ?? undefined,
    reviewedBy: rx.reviewedByName ?? undefined,
    reviewedAt: rx.reviewedAt ?? undefined,
    rejectionReason: rx.status === "REJECTED" ? rejectionReason : undefined,
    rejectionNote: rx.status === "REJECTED" ? note.join(": ") : undefined,
    dispensedQty: item.quantityDispensed || undefined,
    dispensedBy: last?.dispensedByName ?? item.closedByName ?? undefined,
    dispensedAt: last?.dispensedAt ?? item.closedAt ?? undefined,
    refusalReason: item.closeReason ?? undefined,
    overrideReason: overrides.length ? overrides.join("; ") : undefined,
  };
}

/** A formulary product with its stock, in the shape of the screen's drug catalogue rows. */
export type LiveDrug = ApiFormularyItem & { name: string; onHand: number; expiredOnHand: number; batches: ApiBatch[] };

export type LiveRegisterEntry = {
  id: string; type: "Received" | "Dispensed"; adjustment: boolean; quantity: number; patient?: Patient;
  pharmacistName: string; witnessBy?: string; balanceAfter: number; at: string; reason?: string;
};

/** The controlled-medicine register: the ledger newest first, with the drug's balance after each entry. */
export function registerEntries(movements: ApiMovement[], balanceNow: number): LiveRegisterEntry[] {
  let balance = balanceNow;
  return movements.map((m) => {
    const entry: LiveRegisterEntry = {
      id: m.id,
      type: m.quantity > 0 ? "Received" : "Dispensed",
      adjustment: m.kind === "ADJUSTMENT" || m.kind === "RETURN",
      quantity: Math.abs(m.quantity),
      patient: m.patient ? patientFromApi(m.patient) : undefined,
      pharmacistName: m.userName ?? "—",
      witnessBy: m.witnessName ?? undefined,
      balanceAfter: balance,
      at: m.createdAt,
      reason: m.reason ?? undefined,
    };
    balance -= m.quantity;
    return entry;
  });
}

type Staff = { userId: string; name: string };

type LivePharmacyState = {
  lines: LiveRxLine[];
  drugs: LiveDrug[];
  register: Record<string, LiveRegisterEntry[]>;
  pharmacyStaff: Staff[];
  error: string;
  load: () => Promise<void>;
  loadStaff: () => Promise<void>;
  loadRegister: (code: string) => Promise<void>;
  approve: (line: LiveRxLine, note?: string) => Promise<void>;
  reject: (line: LiveRxLine, reason: string, note: string) => Promise<void>;
  dispense: (line: LiveRxLine, input: { quantity: number; witnessUserId?: string; note?: string; key: string }) => Promise<void>;
  close: (line: LiveRxLine, outcome: "OUTSOURCED" | "NOT_DISPENSED", reason: string) => Promise<void>;
  receive: (input: { code: string; batchNumber: string; expiryDate: string; quantity: number; unitCost?: number; supplier?: string; key: string }) => Promise<void>;
  adjust: (batch: ApiBatch, quantity: number, reason: string) => Promise<void>;
  saveDrug: (code: string, version: number, changes: Record<string, unknown>) => Promise<void>;
  createDrug: (drug: Record<string, unknown>) => Promise<void>;
};

const text = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : undefined);

export const useLivePharmacy = create<LivePharmacyState>((set, get) => {
  const after = async (action: Promise<unknown>) => { await action; await get().load(); };
  return {
    lines: [],
    drugs: [],
    register: {},
    pharmacyStaff: [],
    error: "",

    // Work in hand (oldest first), recent finished prescriptions (newest first), stock and formulary.
    load: async () => {
      try {
        const [open, closed, stock, formulary] = await Promise.all([
          emrRequest<{ data: { items: ApiRx[] } }>("/pharmacy/prescriptions?status=PENDING_REVIEW,APPROVED,PARTIALLY_DISPENSED&limit=100"),
          emrRequest<{ data: { items: ApiRx[] } }>("/pharmacy/prescriptions?status=DISPENSED,REJECTED,CANCELLED&sort=newest&limit=100"),
          emrRequest<{ data: { items: ApiStock[] } }>("/pharmacy/stock"),
          emrRequest<{ data: { items: ApiFormularyItem[] } }>("/pharmacy/formulary?includeInactive=true"),
        ]);
        const byCode = new Map(stock.data.items.map((s) => [s.code, s]));
        set({
          lines: [...open.data.items, ...closed.data.items].flatMap((rx) => rx.items.map((item) => liveRxLine(rx, item))),
          drugs: formulary.data.items.map((drug) => ({
            ...drug,
            name: `${drug.genericName} ${drug.strength}`,
            onHand: byCode.get(drug.code)?.onHand ?? 0,
            expiredOnHand: byCode.get(drug.code)?.expiredOnHand ?? 0,
            batches: byCode.get(drug.code)?.batches ?? [],
          })),
          error: "",
        });
      } catch (cause) {
        set({ error: cause instanceof Error ? cause.message : "The pharmacy could not be loaded." });
      }
    },

    loadStaff: async () => {
      const result = await emrRequest<{ data: { items: Staff[] } }>("/staff?permission=prescription.dispense");
      set({ pharmacyStaff: result.data.items });
    },

    loadRegister: async (code) => {
      const drug = get().drugs.find((d) => d.code === code);
      const result = await emrRequest<{ data: { items: ApiMovement[] } }>(`/pharmacy/stock/movements?formularyCode=${encodeURIComponent(code)}&limit=100`);
      set((state) => ({ register: { ...state.register, [code]: registerEntries(result.data.items, (drug?.onHand ?? 0) + (drug?.expiredOnHand ?? 0)) } }));
    },

    approve: (line, note) => after(emrRequest(`/pharmacy/prescriptions/${line.prescriptionId}/approve`, {
      method: "POST", version: line.prescriptionVersion, body: note?.trim() ? { note: note.trim() } : {},
    })),
    reject: (line, reason, note) => after(emrRequest(`/pharmacy/prescriptions/${line.prescriptionId}/reject`, {
      method: "POST", version: line.prescriptionVersion, body: { reason: `${reason}: ${note.trim()}` },
    })),
    dispense: (line, { quantity, witnessUserId, note, key }) => after(emrRequest(`/pharmacy/prescriptions/${line.prescriptionId}/dispense`, {
      method: "POST",
      idempotencyKey: key,
      body: { lines: [{ itemId: line.itemId, quantity }], ...(witnessUserId ? { witnessUserId } : {}), ...(note?.trim() ? { note: note.trim() } : {}) },
    })),
    close: (line, outcome, reason) => after(emrRequest(`/pharmacy/prescriptions/${line.prescriptionId}/items/${line.itemId}/close`, {
      method: "POST", version: line.prescriptionVersion, body: { outcome, reason },
    })),
    receive: ({ code, batchNumber, expiryDate, quantity, unitCost, supplier, key }) => after(emrRequest("/pharmacy/stock/receipts", {
      method: "POST",
      idempotencyKey: key,
      body: {
        formularyCode: code, batchNumber: batchNumber.trim(), expiryDate, quantity,
        ...(unitCost !== undefined ? { unitCostMinor: Math.round(unitCost * 100) } : {}),
        ...(text(supplier) ? { supplier: text(supplier) } : {}),
      },
    })),
    adjust: (batch, quantity, reason) => after(emrRequest(`/pharmacy/stock/batches/${batch.id}/adjust`, {
      method: "POST", version: batch.version, body: { quantity, reason: "OTHER", note: reason.trim() },
    })),
    saveDrug: (code, version, changes) => after(emrRequest(`/pharmacy/formulary/${encodeURIComponent(code)}`, { method: "PATCH", version, body: changes })),
    createDrug: (drug) => after(emrRequest("/pharmacy/formulary", { method: "POST", body: drug })),
  };
});

/** Loads the pharmacy now and keeps it fresh while the screen is open. */
export function useLivePharmacyRefresh(enabled: boolean, withStaff: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const { load, loadStaff } = useLivePharmacy.getState();
    void load();
    if (withStaff) loadStaff().catch(() => undefined);
    const timer = window.setInterval(() => { void load(); }, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [enabled, withStaff]);
}

export type { ApiBatch };
