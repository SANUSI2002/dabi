import { useEffect } from "react";
import { create } from "zustand";
import type { ChildVisit, CmamOutcome, CmamScreening, Patient } from "@/data/types";
import { emrRequest, newIdempotencyKey } from "./client";
import { patientFromApi, type ApiPatient } from "./mappers";

// Child health (growth monitoring) and nutrition (CMAM) in live mode. The hospital classifies and picks
// the programme; a malnourished growth visit enrols the child in CMAM there.

type ApiPatientSummary = Pick<ApiPatient, "id" | "medicalRecordNumber" | "givenName" | "familyName" | "dateOfBirth" | "sex">;
export type ApiGrowthVisit = {
  id: string; patientId: string; patient?: ApiPatientSummary; visitDate: string; weightKg: number; heightCm: number; muacCm: number; waz: number | null;
  feeding: string; classification: "NORMAL" | "MAM" | "SAM"; status: "ACTIVE" | "ENTERED_IN_ERROR"; enrolledInCmam: boolean;
};
export type ApiScreening = {
  id: string; patientId: string; patient?: ApiPatientSummary; version: number; screeningDate: string; muacCm: number; oedema: string; appetite: "PASS" | "FAIL";
  growthMonitoringDone: boolean | null; notes: string | null; classification: "NORMAL" | "MAM" | "SAM"; programme: "OTP" | "SC" | "SFP" | null;
  source: "NUTRITION" | "CHILD_HEALTH"; outcome: string | null; dischargedAt: string | null;
};

export const FEEDING: Record<string, string> = {
  "Exclusive breastfeeding": "EXCLUSIVE_BREASTFEEDING", "Complementary + breast": "COMPLEMENTARY_AND_BREAST", "Family diet": "FAMILY_DIET", Formula: "FORMULA",
};
export const OEDEMA: Record<string, string> = { None: "NONE", "+ (mild)": "MILD", "++ (moderate)": "MODERATE", "+++ (severe)": "SEVERE" };
const OUTCOME: Record<string, CmamOutcome> = { CURED: "Cured", NON_RESPONSE: "Non-response", DEFAULTER: "Defaulter", DEATH: "Death", TRANSFERRED: "Transferred" };
const label = (map: Record<string, string>, code: string) => Object.keys(map).find((k) => map[k] === code) ?? code;
const cls = (c: "NORMAL" | "MAM" | "SAM") => (c === "NORMAL" ? "Normal" : c);

export type LiveGrowthVisit = ChildVisit & { patient?: Patient; enrolledInCmam: boolean };
export const growthFromApi = (v: ApiGrowthVisit): LiveGrowthVisit => ({
  id: v.id, patientId: v.patientId, patient: v.patient ? patientFromApi(v.patient) : undefined, date: v.visitDate, weight: v.weightKg, height: v.heightCm,
  muac: v.muacCm, waz: v.waz ?? undefined, status: cls(v.classification), feeding: label(FEEDING, v.feeding), enrolledInCmam: v.enrolledInCmam,
});
export type LiveScreening = CmamScreening & { patient?: Patient; version: number };
export const screeningFromApi = (s: ApiScreening): LiveScreening => ({
  id: s.id, patientId: s.patientId, patient: s.patient ? patientFromApi(s.patient) : undefined, version: s.version, date: s.screeningDate,
  growthMonitoringDone: s.growthMonitoringDone ?? undefined, notes: s.notes ?? undefined, muac: s.muacCm, oedema: label(OEDEMA, s.oedema),
  appetite: s.appetite === "PASS" ? "Pass" : "Fail", cls: cls(s.classification), program: s.programme ?? "—", source: s.source === "CHILD_HEALTH" ? "Child Health" : "Nutrition",
  outcome: s.outcome ? OUTCOME[s.outcome] : undefined, dischargedAt: s.dischargedAt ?? undefined,
});

type NutritionState = {
  visits: LiveGrowthVisit[];
  screenings: LiveScreening[];
  error: string;
  load: () => Promise<void>;
  recordGrowth: (f: { patientId: string; date: string; weight: number; height: number; muac: number; waz: number; feeding: string }, idempotencyKey: string) => Promise<LiveGrowthVisit>;
  screen: (f: { patientId: string; date: string; muac: number; oedema: string; appetite: string; growthMonitoringDone: boolean; notes: string }, idempotencyKey: string) => Promise<void>;
  discharge: (s: LiveScreening, outcome: CmamOutcome) => Promise<void>;
};

export const useLiveNutrition = create<NutritionState>((set, get) => ({
  visits: [],
  screenings: [],
  error: "",
  load: async () => {
    try {
      const [visits, screenings] = await Promise.all([
        emrRequest<{ data: { items: ApiGrowthVisit[] } }>("/nutrition/growth?limit=500"),
        emrRequest<{ data: { items: ApiScreening[] } }>("/nutrition/cmam?limit=500"),
      ]);
      set({ visits: visits.data.items.filter((v) => v.status === "ACTIVE").map(growthFromApi), screenings: screenings.data.items.map(screeningFromApi), error: "" });
    } catch (cause) {
      set({ error: cause instanceof Error ? cause.message : "Nutrition records could not be loaded." });
    }
  },
  recordGrowth: async (f, idempotencyKey) => {
    const result = await emrRequest<{ data: ApiGrowthVisit }>("/nutrition/growth", {
      method: "POST", idempotencyKey,
      body: { patientId: f.patientId, visitDate: f.date, weightKg: f.weight, heightCm: f.height, muacCm: f.muac, ...(f.waz ? { waz: f.waz } : {}), feeding: FEEDING[f.feeding] },
    });
    await get().load();
    return growthFromApi(result.data);
  },
  screen: async (f, idempotencyKey) => {
    await emrRequest("/nutrition/cmam", {
      method: "POST", idempotencyKey,
      body: { patientId: f.patientId, screeningDate: f.date, muacCm: f.muac, oedema: OEDEMA[f.oedema], appetite: f.appetite.toUpperCase(), growthMonitoringDone: f.growthMonitoringDone, ...(f.notes.trim() ? { notes: f.notes.trim() } : {}) },
    });
    await get().load();
  },
  discharge: async (s, outcome) => {
    const code = Object.keys(OUTCOME).find((k) => OUTCOME[k] === outcome)!;
    await emrRequest(`/nutrition/cmam/${s.id}/discharge`, { method: "POST", version: s.version, body: { outcome: code } });
    await get().load();
  },
}));

export function useLiveNutritionLoad(enabled: boolean) {
  useEffect(() => {
    if (enabled) void useLiveNutrition.getState().load();
  }, [enabled]);
}

export { newIdempotencyKey };
