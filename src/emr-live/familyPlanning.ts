import { useEffect } from "react";
import { create } from "zustand";
import type { FpClient, FpVisitType, Patient } from "@/data/types";
import { emrRequest, newIdempotencyKey } from "./client";
import { patientFromApi, type ApiPatient } from "./mappers";

// Family planning in live mode: the hospital's clients (GET /family-planning), registration, visits
// (resupply, switch, removal) and discontinuation.

type ApiPatientSummary = Pick<ApiPatient, "id" | "medicalRecordNumber" | "givenName" | "familyName" | "dateOfBirth" | "sex">;
export type ApiFpClient = {
  id: string; patientId: string; patient?: ApiPatientSummary; version: number; method: string; firstTime: boolean; startDate: string; nextVisitDate: string | null;
  counselled: boolean; notes: string | null; status: "ACTIVE" | "DISCONTINUED"; discontinueReason: string | null; registeredByName: string | null;
  visits: { id: string; visitDate: string; visitType: string; method: string; nextVisitDate: string | null; notes: string | null; recordedByName: string | null }[];
};

const TYPE_LABEL: Record<string, FpVisitType> = { NEW_VISIT: "New Visit", REVISIT: "Revisit", RESUPPLY: "Resupply", SWITCH_METHOD: "Switch method", REMOVAL: "Removal" };
export const visitTypeCode = (label: FpVisitType) => Object.entries(TYPE_LABEL).find(([, l]) => l === label)?.[0] ?? "REVISIT";

export type LiveFpClient = FpClient & { patient?: Patient; version: number };
export const fpFromApi = (c: ApiFpClient): LiveFpClient => ({
  id: c.id, patientId: c.patientId, patient: c.patient ? patientFromApi(c.patient) : undefined, version: c.version, method: c.method, firstTime: c.firstTime,
  startDate: c.startDate, nextVisit: c.nextVisitDate ?? undefined, counselled: c.counselled, status: c.status === "ACTIVE" ? "Active" : "Discontinued",
  notes: c.notes ?? undefined, discontinueReason: c.discontinueReason ?? undefined,
  visits: c.visits.map((v) => ({ date: v.visitDate, type: TYPE_LABEL[v.visitType] ?? "Revisit", method: v.method, nextVisit: v.nextVisitDate ?? undefined, notes: v.notes ?? undefined, by: v.recordedByName ?? "Unknown staff member" })),
});

type FpState = {
  clients: LiveFpClient[];
  error: string;
  load: () => Promise<void>;
  register: (form: { patientId: string; method: string; firstTime: boolean; startDate: string; nextVisit: string; counselled: boolean; notes: string }, idempotencyKey: string) => Promise<void>;
  visit: (client: LiveFpClient, form: { type: FpVisitType; method: string; nextVisit: string; notes: string }) => Promise<void>;
  discontinue: (client: LiveFpClient, reason: string) => Promise<void>;
};

export const useLiveFamilyPlanning = create<FpState>((set, get) => ({
  clients: [],
  error: "",
  load: async () => {
    try {
      const result = await emrRequest<{ data: { items: ApiFpClient[] } }>("/family-planning?limit=500");
      set({ clients: result.data.items.map(fpFromApi), error: "" });
    } catch (cause) {
      set({ error: cause instanceof Error ? cause.message : "Family planning clients could not be loaded." });
    }
  },
  register: async (form, idempotencyKey) => {
    await emrRequest("/family-planning", {
      method: "POST", idempotencyKey,
      body: {
        patientId: form.patientId, method: form.method, firstTime: form.firstTime, startDate: form.startDate, counselled: form.counselled,
        ...(form.nextVisit ? { nextVisitDate: form.nextVisit } : {}), ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
      },
    });
    await get().load();
  },
  visit: async (client, form) => {
    await emrRequest(`/family-planning/${client.id}/visits`, {
      method: "POST", version: client.version,
      body: {
        visitType: visitTypeCode(form.type), ...(form.type === "Switch method" ? { method: form.method } : {}),
        ...(form.nextVisit ? { nextVisitDate: form.nextVisit } : {}), ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
      },
    });
    await get().load();
  },
  discontinue: async (client, reason) => {
    await emrRequest(`/family-planning/${client.id}/discontinue`, { method: "POST", version: client.version, body: { reason } });
    await get().load();
  },
}));

export function useLiveFamilyPlanningLoad(enabled: boolean) {
  useEffect(() => {
    if (enabled) void useLiveFamilyPlanning.getState().load();
  }, [enabled]);
}

export { newIdempotencyKey };
