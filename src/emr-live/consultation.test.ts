import { describe, expect, it } from "vitest";
import type { Prescription } from "@/data/types";
import { allergySummary, prescriptionLine, vitalsSets } from "./consultation";

const row = (extra: Partial<Prescription>): Prescription => ({
  id: "r1", drug: "Amoxicillin 500 mg", drugCode: "AMOX500", doseUnit: "mg", dose: "500", frequency: "TDS", duration: "5 days", qty: 0, status: "Under Review", ...extra,
});

describe("prescription rows → API lines", () => {
  it("reads dose, frequency and duration the way prescribers write them", () => {
    expect(prescriptionLine(row({}))).toEqual({ drugCode: "AMOX500", dose: 500, doseUnit: "mg", frequency: "TDS", durationDays: 5 });
    expect(prescriptionLine(row({ dose: "500 MG", frequency: "tds", duration: "1 week", qty: 21 }))).toMatchObject({ dose: 500, frequency: "TDS", durationDays: 7, quantity: 21 });
    expect(prescriptionLine(row({ frequency: "PRN severe pain", duration: "", qty: 10 }))).toEqual({
      drugCode: "AMOX500", dose: 500, doseUnit: "mg", frequency: "PRN", quantity: 10, prnReason: "severe pain",
    });
  });

  it("refuses what the pharmacy could not dispense safely, saying how to fix it", () => {
    expect(() => prescriptionLine(row({ drugCode: undefined }))).toThrow(/choose it from the formulary/);
    expect(() => prescriptionLine(row({ dose: "two" }))).toThrow(/dose as a number/);
    expect(() => prescriptionLine(row({ dose: "0.5 g" }))).toThrow(/must be in mg/);
    expect(() => prescriptionLine(row({ frequency: "twice daily" }))).toThrow(/frequency must be one of/);
    expect(() => prescriptionLine(row({ duration: "until better" }))).toThrow(/days or weeks/);
  });
});

describe("vitals and allergies for the consultation header", () => {
  it("groups readings taken together, skips readings marked in error, and names who took them", () => {
    const at = "2026-09-30T09:00:00.000Z";
    const sets = vitalsSets([
      { code: "BP_SYSTOLIC", value: 132, recordedAt: at, recordedByName: "Grace Nwangbo", status: "ACTIVE" },
      { code: "BP_DIASTOLIC", value: 86, recordedAt: at, recordedByName: "Grace Nwangbo", status: "ACTIVE" },
      { code: "TEMPERATURE", value: 39.9, recordedAt: at, recordedByName: "Grace Nwangbo", status: "ENTERED_IN_ERROR" },
      { code: "MUAC", value: 23.5, recordedAt: at, recordedByName: "Grace Nwangbo", status: "ACTIVE" },
      { code: "HEART_RATE", value: 88, recordedAt: "2026-09-30T08:00:00.000Z", recordedByName: null, status: "ACTIVE" },
    ]);
    expect(sets).toEqual([
      { takenAt: "2026-09-30T08:00:00.000Z", takenBy: "Unknown staff member", pulse: 88 },
      { takenAt: at, takenBy: "Grace Nwangbo", muac: 23.5, bp: "132/86" },
    ]);
  });

  it("never turns 'nothing recorded' into 'no known allergies'", () => {
    expect(allergySummary([], null)).toBe("");
    expect(allergySummary([{ substance: "Penicillin", reaction: "Rash", severity: "MODERATE" }], "Sulfa drugs")).toBe(
      "Penicillin (Rash); reported at registration: Sulfa drugs",
    );
  });
});
