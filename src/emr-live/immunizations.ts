import { useEffect } from "react";
import { create } from "zustand";
import type { Immunization, Patient } from "@/data/types";
import { emrRequest, newIdempotencyKey } from "./client";
import { patientFromApi, type ApiPatient } from "./mappers";

// Immunization in live mode: one child's doses (GET /immunizations?patientId=), the hospital's
// defaulter list and AEFI reports, giving a dose and reporting an AEFI.

type ApiPatientSummary = Pick<ApiPatient, "id" | "medicalRecordNumber" | "givenName" | "familyName" | "dateOfBirth" | "sex">;
export type ApiDose = {
  id: string; patientId: string; patient?: ApiPatientSummary; vaccineCode: string; vaccineName: string; givenAt: string; batchNumber: string; site: string;
  givenByName: string | null; status: "ACTIVE" | "ENTERED_IN_ERROR";
  aefi: { symptoms: string; severity: "SERIOUS" | "NON_SERIOUS"; onsetHours: number; actionTaken: string; reportedAt: string; reportedByName: string | null; surveillanceCaseId: string | null } | null;
};
export type ApiDefaulter = { patientId: string; patient?: ApiPatientSummary; ageWeeks: number; missed: { vaccineCode: string; vaccineName: string; dueAgeWeeks: number; weeksLate: number }[] };

export type LiveDose = Immunization & { patient?: Patient };
export const doseFromApi = (d: ApiDose): LiveDose => ({
  id: d.id, patientId: d.patientId, patient: d.patient ? patientFromApi(d.patient) : undefined, vaccineCode: d.vaccineCode, vaccineName: d.vaccineName,
  givenAt: d.givenAt, givenBy: d.givenByName ?? "Unknown staff member", batchNo: d.batchNumber, site: d.site,
  aefi: d.aefi ? { symptoms: d.aefi.symptoms, severity: d.aefi.severity === "SERIOUS" ? "Serious" : "Non-serious", onsetHours: d.aefi.onsetHours, action: d.aefi.actionTaken, reportedAt: d.aefi.reportedAt, reportedBy: d.aefi.reportedByName ?? "Unknown staff member" } : undefined,
});
export type LiveDefaulter = { patient?: Patient; patientId: string; ageWeeks: number; missed: ApiDefaulter["missed"] };

type ImmunizationState = {
  childDoses: LiveDose[];
  childId: string | null;
  defaulters: LiveDefaulter[];
  aefi: LiveDose[];
  error: string;
  load: () => Promise<void>;
  loadChild: (patientId: string | null) => Promise<void>;
  give: (patientId: string, vaccineCode: string, batchNumber: string, site: string, idempotencyKey: string) => Promise<void>;
  reportAefi: (doseId: string, form: { symptoms: string; severity: "Serious" | "Non-serious"; onsetHours: number; action: string }) => Promise<LiveDose>;
};

export const useLiveImmunization = create<ImmunizationState>((set, get) => ({
  childDoses: [],
  childId: null,
  defaulters: [],
  aefi: [],
  error: "",
  load: async () => {
    try {
      const [defaulters, aefi] = await Promise.all([
        emrRequest<{ data: { items: ApiDefaulter[] } }>("/immunizations/defaulters"),
        emrRequest<{ data: { items: ApiDose[] } }>("/immunizations?aefi=true"),
      ]);
      set({
        defaulters: defaulters.data.items.map((d) => ({ patientId: d.patientId, patient: d.patient ? patientFromApi(d.patient) : undefined, ageWeeks: d.ageWeeks, missed: d.missed })),
        aefi: aefi.data.items.map(doseFromApi), error: "",
      });
    } catch (cause) {
      set({ error: cause instanceof Error ? cause.message : "Immunization records could not be loaded." });
    }
  },
  loadChild: async (patientId) => {
    set({ childId: patientId, childDoses: [] });
    if (!patientId) return;
    try {
      const result = await emrRequest<{ data: { items: ApiDose[] } }>(`/immunizations?patientId=${encodeURIComponent(patientId)}`);
      // Doses entered in error are not counted as given.
      if (get().childId === patientId) set({ childDoses: result.data.items.filter((d) => d.status === "ACTIVE").map(doseFromApi) });
    } catch (cause) {
      set({ error: cause instanceof Error ? cause.message : "This child's doses could not be loaded." });
    }
  },
  give: async (patientId, vaccineCode, batchNumber, site, idempotencyKey) => {
    await emrRequest("/immunizations", { method: "POST", idempotencyKey, body: { patientId, vaccineCode, batchNumber: batchNumber.trim(), site: site.trim() } });
    await Promise.all([get().loadChild(patientId), get().load()]);
  },
  reportAefi: async (doseId, form) => {
    const result = await emrRequest<{ data: ApiDose }>(`/immunizations/${doseId}/aefi`, {
      method: "POST", body: { symptoms: form.symptoms.trim(), severity: form.severity === "Serious" ? "SERIOUS" : "NON_SERIOUS", onsetHours: form.onsetHours, actionTaken: form.action.trim() },
    });
    await Promise.all([get().loadChild(get().childId), get().load()]);
    return doseFromApi(result.data);
  },
}));

export function useLiveImmunizationLoad(enabled: boolean, childId: string | null) {
  useEffect(() => {
    if (enabled) void useLiveImmunization.getState().load();
  }, [enabled]);
  useEffect(() => {
    if (enabled) void useLiveImmunization.getState().loadChild(childId);
  }, [enabled, childId]);
}

export { newIdempotencyKey };
