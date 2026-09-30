import { describe, expect, it } from "vitest";
import { alertFromApi, liveRxLine, registerEntries } from "./pharmacy";

type Rx = Parameters<typeof liveRxLine>[0];
type Item = Parameters<typeof liveRxLine>[1];

const item = (extra: Partial<Item> = {}): Item => ({
  id: "i1", drugCode: "TRAM50", drugName: "Tramadol", strength: "50 mg", form: "Capsule", dose: 50, doseUnit: "mg", frequency: "TDS", route: "PO",
  durationDays: 3, prn: false, prnReason: null, instructions: null, dispenseUnit: "capsule", quantityPrescribed: 9, quantityDispensed: 0, status: "ACTIVE",
  controlled: true, safetyAlerts: [], closeOutcome: null, closeReason: null, closedAt: null, closedByName: null, ...extra,
});
const rx = (extra: Partial<Rx> = {}, items: Item[] = [item()]): Rx => ({
  id: "rx1", encounterId: "e1", patientId: "p1", version: 2, createdAt: "2026-09-30T09:00:00.000Z", status: "APPROVED",
  prescriberName: "Tunde Bakare", reviewedByName: "Ifeoma Obi", reviewedAt: "2026-09-30T09:10:00.000Z", reviewNote: null, rejectionReason: null,
  patient: { id: "p1", medicalRecordNumber: "MRN-0000001", givenName: "Chidi", familyName: "Okeke", dateOfBirth: "1979-11-02", sex: "MALE" },
  items, dispenses: [], allergies: [{ substance: "Sulfonamides", reaction: "Rash", severity: "MODERATE" }], ...extra,
});

describe("live prescription lines", () => {
  it("shows each line's state on the pharmacy's workflow", () => {
    expect(liveRxLine(rx({ status: "PENDING_REVIEW" }), item()).status).toBe("Under Review");
    expect(liveRxLine(rx(), item()).status).toBe("Approved");
    expect(liveRxLine(rx(), item({ quantityDispensed: 4 }))).toMatchObject({ status: "Approved", remaining: 5, dispensedQty: 4 });
    expect(liveRxLine(rx({ status: "DISPENSED" }), item({ status: "COMPLETED", quantityDispensed: 9 })).status).toBe("Dispensed");
    expect(liveRxLine(rx(), item({ status: "CANCELLED", closeOutcome: "OUTSOURCED", closeReason: "Out of stock" }))).toMatchObject({ status: "Outsourced", refusalReason: "Out of stock" });
    expect(liveRxLine(rx(), item({ status: "CANCELLED", closeOutcome: "NOT_DISPENSED", closeReason: "Declined" })).status).toBe("Refused");
    expect(liveRxLine(rx({ status: "REJECTED", rejectionReason: "Wrong dose: 50 mg is too high for this patient" }), item())).toMatchObject({
      status: "Rejected", rejectionReason: "Wrong dose", rejectionNote: "50 mg is too high for this patient",
    });
  });

  it("describes the medicine as prescribed, with who gave it and the patient's allergies", () => {
    const line = liveRxLine(rx({
      dispenses: [{ id: "d1", dispensedAt: "2026-09-30T10:00:00.000Z", dispensedByName: "Ifeoma Obi", witnessName: "Musa Bello", lines: [{ prescriptionItemId: "i1", quantity: 9 }] }],
    }, [item({ status: "COMPLETED", quantityDispensed: 9 }), item({ id: "i2", drugName: "Paracetamol", strength: "500 mg", prn: true, prnReason: "fever", durationDays: null })]), item({ status: "COMPLETED", quantityDispensed: 9 }));
    expect(line).toMatchObject({
      drug: "Tramadol 50 mg", dose: "50 mg", duration: "3 days", qty: 9, prescribedBy: "Tunde Bakare", dispensedBy: "Ifeoma Obi",
      allergies: ["Sulfonamides (Rash)"], siblings: ["Paracetamol 500 mg"], controlled: true,
    });
    const prn = liveRxLine(rx(), item({ prn: true, prnReason: "fever", durationDays: null }));
    expect(prn).toMatchObject({ frequency: "PRN (fever)", duration: "as needed" });
  });

  it("keeps the prescriber's override with the alert and maps every alert type", () => {
    expect(alertFromApi({ drugCode: "AMOX500", type: "ALLERGY", severity: "HIGH", message: "Penicillin allergy", overrideReason: "Tolerated before" })).toEqual({
      kind: "allergy", severity: "high", message: "Penicillin allergy — prescriber's override: Tolerated before",
    });
    expect(alertFromApi({ drugCode: "TRAM50", type: "CONTROLLED", severity: "INFO", message: "Needs a witness" })).toMatchObject({ kind: "controlled", severity: "info" });
    expect(alertFromApi({ drugCode: "X", type: "DUPLICATE_CLASS", severity: "MODERATE", message: "m" }).kind).toBe("duplicate");
  });
});

describe("controlled-medicine register", () => {
  it("works back from today's balance so each entry shows the balance after it", () => {
    const entries = registerEntries([
      { id: "m3", kind: "ADJUSTMENT", quantity: -1, reason: "OTHER: broken ampoule", createdAt: "2026-09-30T12:00:00.000Z", userName: "Ifeoma Obi", witnessName: null, patient: null },
      { id: "m2", kind: "DISPENSE", quantity: -9, reason: null, createdAt: "2026-09-30T11:00:00.000Z", userName: "Ifeoma Obi", witnessName: "Musa Bello",
        patient: { id: "p1", medicalRecordNumber: "MRN-0000001", givenName: "Chidi", familyName: "Okeke", dateOfBirth: "1979-11-02", sex: "MALE" } },
      { id: "m1", kind: "RECEIPT", quantity: 30, reason: "Received from Emzor", createdAt: "2026-09-30T10:00:00.000Z", userName: "Ifeoma Obi", witnessName: null, patient: null },
    ], 20);
    expect(entries.map((e) => [e.type, e.adjustment, e.quantity, e.balanceAfter])).toEqual([
      ["Dispensed", true, 1, 20], ["Dispensed", false, 9, 21], ["Received", false, 30, 30],
    ]);
    expect(entries[1]).toMatchObject({ witnessBy: "Musa Bello", patient: expect.objectContaining({ firstName: "Chidi" }) });
  });
});
