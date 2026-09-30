import type { Vitals } from "@/data/types";
import { emrRequest } from "./client";

// Vitals-station capture for a live visit: the readings become observations on the visit, and the
// free-text notes become a signed nursing note (the clinical record has no unsigned side notes).

export type VitalsForm = Pick<Vitals, "bp" | "notes" | "temp" | "pulse" | "resp" | "spo2" | "weight" | "height" | "muac" | "glucose">;
type Reading = { code: string; value: number };

const CODES: Array<[keyof VitalsForm, string]> = [
  ["temp", "TEMPERATURE"], ["pulse", "HEART_RATE"], ["resp", "RESPIRATORY_RATE"], ["spo2", "SPO2"],
  ["weight", "WEIGHT"], ["height", "HEIGHT"], ["muac", "MUAC"], ["glucose", "BLOOD_GLUCOSE"],
];

/** The form's values as coded readings. Blood pressure must be written systolic/diastolic, e.g. 120/80. */
export function vitalsReadings(form: VitalsForm): Reading[] {
  const readings: Reading[] = [];
  const bp = form.bp?.trim();
  if (bp) {
    const match = /^(\d{2,3})\s*\/\s*(\d{2,3})$/.exec(bp);
    if (!match) throw new Error("Blood pressure: write it as systolic/diastolic, for example 120/80.");
    readings.push({ code: "BP_SYSTOLIC", value: Number(match[1]) }, { code: "BP_DIASTOLIC", value: Number(match[2]) });
  }
  for (const [field, code] of CODES) {
    const value = form[field];
    if (typeof value === "number" && Number.isFinite(value)) readings.push({ code, value });
  }
  return readings;
}

export async function recordLiveVitals(encounterId: string, readings: Reading[]) {
  if (readings.length) await emrRequest(`/encounters/${encounterId}/vitals`, { method: "POST", body: { readings } });
}

export async function recordLiveVitalsNote(encounterId: string, notes: string) {
  const created = await emrRequest<{ data: { id: string; version: number } }>(`/encounters/${encounterId}/notes`, {
    method: "POST",
    body: { kind: "NURSING", body: notes },
  });
  await emrRequest(`/encounters/${encounterId}/notes/${created.data.id}/sign`, { method: "POST", body: {}, version: created.data.version });
}
