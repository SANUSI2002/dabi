import { useEffect } from "react";
import { create } from "zustand";
import type { NcdClient, Patient } from "@/data/types";
import { emrRequest, newIdempotencyKey } from "./client";
import { patientFromApi, type ApiPatient } from "./mappers";

// Programmes in live mode: the hospital's NCD register (GET/POST /programmes/ncd) and the malaria
// indicators the server works out from recorded visits, diagnoses, lab results and prescriptions
// (GET /programmes/malaria).

type ApiPatientSummary = Pick<ApiPatient, "id" | "medicalRecordNumber" | "givenName" | "familyName" | "dateOfBirth" | "sex">;
export type ApiNcdClient = {
  id: string; patientId: string; patient?: ApiPatientSummary; condition: string; systolic: number | null; diastolic: number | null;
  fastingGlucoseMmol: number | null; control: "CONTROLLED" | "UNCONTROLLED"; nextVisitDate: string; enrolledAt: string; enrolledByName: string | null;
};
export type ApiMalaria = {
  since: string; suspected: number; tested: number; positive: number; confirmed: number; treatedWithAct: number;
  cases: { encounterId: string; patientId: string; patient?: ApiPatientSummary; diagnosedAt: string; diagnoses: string[]; treatment: string[] }[];
  weeklyTrend: { weekStart: string; tested: number; positive: number }[];
};

export type LiveNcdClient = NcdClient & { patient?: Patient };
export const ncdFromApi = (c: ApiNcdClient): LiveNcdClient => ({
  id: c.id, patientId: c.patientId, patient: c.patient ? patientFromApi(c.patient) : undefined, condition: c.condition, enrolledAt: c.enrolledAt,
  bp: c.systolic !== null && c.diastolic !== null ? `${c.systolic}/${c.diastolic}` : undefined, fbs: c.fastingGlucoseMmol ?? undefined,
  control: c.control === "CONTROLLED" ? "Controlled" : "Uncontrolled", nextVisit: c.nextVisitDate,
});
export type LiveMalaria = Omit<ApiMalaria, "cases"> & { cases: (Omit<ApiMalaria["cases"][number], "patient"> & { patient?: Patient })[] };

/** "120/80" → { systolic, diastolic }; blank → {}; anything else is refused before it reaches the server. */
export function parseBp(text: string): { systolic?: number; diastolic?: number } {
  const value = text.trim();
  if (!value) return {};
  const match = /^(\d{2,3})\s*\/\s*(\d{2,3})$/.exec(value);
  if (!match) throw new Error("Enter blood pressure as systolic/diastolic, for example 140/90.");
  return { systolic: Number(match[1]), diastolic: Number(match[2]) };
}

type ProgrammeState = {
  ncd: LiveNcdClient[];
  malaria: LiveMalaria | null;
  error: string;
  loadNcd: () => Promise<void>;
  loadMalaria: () => Promise<void>;
  enrol: (form: { patientId: string; condition: string; bp: string; fbs: number; nextVisit: string; control: "Controlled" | "Uncontrolled" }, idempotencyKey: string) => Promise<void>;
};

const message = (cause: unknown, fallback: string) => (cause instanceof Error ? cause.message : fallback);

export const useLiveProgrammes = create<ProgrammeState>((set, get) => ({
  ncd: [],
  malaria: null,
  error: "",
  loadNcd: async () => {
    try {
      const result = await emrRequest<{ data: { items: ApiNcdClient[] } }>("/programmes/ncd?limit=500");
      set({ ncd: result.data.items.map(ncdFromApi), error: "" });
    } catch (cause) {
      set({ error: message(cause, "The NCD register could not be loaded.") });
    }
  },
  loadMalaria: async () => {
    try {
      const result = await emrRequest<{ data: ApiMalaria }>("/programmes/malaria");
      set({ malaria: { ...result.data, cases: result.data.cases.map((c) => ({ ...c, patient: c.patient ? patientFromApi(c.patient) : undefined })) }, error: "" });
    } catch (cause) {
      set({ error: message(cause, "Malaria indicators could not be loaded.") });
    }
  },
  enrol: async (form, idempotencyKey) => {
    await emrRequest("/programmes/ncd", {
      method: "POST", idempotencyKey,
      body: {
        patientId: form.patientId, condition: form.condition, ...parseBp(form.bp), ...(form.fbs ? { fastingGlucoseMmol: Math.round(form.fbs * 10) / 10 } : {}),
        control: form.control === "Controlled" ? "CONTROLLED" : "UNCONTROLLED",
        nextVisitDate: form.nextVisit || new Date(Date.now() + 28 * 864e5).toISOString().slice(0, 10),
      },
    });
    await get().loadNcd();
  },
}));

export function useLiveNcdLoad(enabled: boolean) {
  useEffect(() => {
    if (enabled) void useLiveProgrammes.getState().loadNcd();
  }, [enabled]);
}
export function useLiveMalariaLoad(enabled: boolean) {
  useEffect(() => {
    if (enabled) void useLiveProgrammes.getState().loadMalaria();
  }, [enabled]);
}

export { newIdempotencyKey };
