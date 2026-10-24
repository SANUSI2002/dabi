import { useEffect } from "react";
import { create } from "zustand";
import type { Patient, SurveillanceCase } from "@/data/types";
import { emrRequest, newIdempotencyKey } from "./client";
import { patientFromApi, type ApiPatient } from "./mappers";

// Disease surveillance in live mode: the hospital's line list (GET /surveillance), notifying a case,
// and a doctor confirming or discarding it.

type ApiPatientSummary = Pick<ApiPatient, "id" | "medicalRecordNumber" | "givenName" | "familyName" | "dateOfBirth" | "sex">;
export type ApiCase = {
  id: string; patientId: string; patient?: ApiPatientSummary; version: number; diseaseCode: string; diseaseName: string; immediate: boolean;
  onsetDate: string | null; notes: string | null; source: "MANUAL" | "AEFI"; status: "SUSPECTED" | "CONFIRMED" | "DISCARDED";
  reportedAt: string; reportedByName: string | null; classifiedByName: string | null; classificationNote: string | null;
};
export type ApiDisease = { code: string; name: string; class: string; immediate: boolean };

export type LiveCase = SurveillanceCase & { patient?: Patient; version: number; immediate: boolean; reportedBy?: string; classifiedBy?: string; classificationNote?: string };
const STATUS = { SUSPECTED: "Suspected", CONFIRMED: "Confirmed", DISCARDED: "Discarded" } as const;
export const caseFromApi = (c: ApiCase): LiveCase => ({
  id: c.id, patientId: c.patientId, patient: c.patient ? patientFromApi(c.patient) : undefined, version: c.version, disease: c.diseaseName, immediate: c.immediate,
  onset: c.onsetDate ?? "", reportedAt: c.reportedAt, status: STATUS[c.status], notes: c.notes ?? undefined,
  reportedBy: c.reportedByName ?? undefined, classifiedBy: c.classifiedByName ?? undefined, classificationNote: c.classificationNote ?? undefined,
});

type SurveillanceState = {
  cases: LiveCase[];
  diseases: ApiDisease[];
  error: string;
  load: () => Promise<void>;
  notify: (form: { patientId: string; disease: string; onset: string; notes: string }, idempotencyKey: string) => Promise<void>;
  classify: (c: LiveCase, status: "Confirmed" | "Discarded", note: string) => Promise<void>;
};

export const useLiveSurveillance = create<SurveillanceState>((set, get) => ({
  cases: [],
  diseases: [],
  error: "",
  load: async () => {
    try {
      const result = await emrRequest<{ data: { items: ApiCase[]; diseases: ApiDisease[] } }>("/surveillance?limit=500");
      set({ cases: result.data.items.map(caseFromApi), diseases: result.data.diseases, error: "" });
    } catch (cause) {
      set({ error: cause instanceof Error ? cause.message : "The line list could not be loaded." });
    }
  },
  notify: async (form, idempotencyKey) => {
    const disease = get().diseases.find((d) => d.name === form.disease);
    if (!disease) throw new Error("Choose a notifiable disease from the list.");
    await emrRequest("/surveillance", {
      method: "POST", idempotencyKey,
      body: { patientId: form.patientId, diseaseCode: disease.code, ...(form.onset ? { onsetDate: form.onset } : {}), ...(form.notes.trim() ? { notes: form.notes.trim() } : {}) },
    });
    await get().load();
  },
  classify: async (c, status, note) => {
    await emrRequest(`/surveillance/${c.id}/classify`, { method: "POST", version: c.version, body: { status: status.toUpperCase(), ...(note.trim() ? { note: note.trim() } : {}) } });
    await get().load();
  },
}));

export function useLiveSurveillanceLoad(enabled: boolean) {
  useEffect(() => {
    if (enabled) void useLiveSurveillance.getState().load();
  }, [enabled]);
}

export { newIdempotencyKey };
