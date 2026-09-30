import { describe, expect, it } from "vitest";
import { analyteRange, liveLabTest, overallFlag, referenceText, type LabResultRow } from "./lab";

const result = (extra: Partial<LabResultRow>): LabResultRow => ({
  analyteCode: "HB", analyteName: "Haemoglobin", valueNumeric: 13, valueText: null, unit: "g/dL",
  referenceLow: 12, referenceHigh: 15.5, flag: "NORMAL", status: "FINAL", ...extra,
});

const order = (status: string, itemStatus: string, extra: Record<string, unknown> = {}) => ({
  id: "o1", patientId: "p1", encounterId: "e1", status, priority: "STAT", accessionNumber: "LAB-2026-000001", version: 3,
  createdAt: "2026-09-30T09:00:00.000Z", orderedByName: "Tunde Bakare", collectedAt: "2026-09-30T09:10:00.000Z", collectedByName: "Grace Nwangbo",
  specimenNote: "Sample: Whole blood (EDTA)", cancelledAt: null, cancelledByName: null, cancellationReason: null,
  patient: { id: "p1", medicalRecordNumber: "MRN-0000001", givenName: "Amaka", familyName: "Nwosu", dateOfBirth: "1992-02-14", sex: "FEMALE" as const },
  items: [{
    id: "i1", testCode: "FBC", testName: "Full blood count", specimenType: "Whole blood (EDTA)", analytes: [], status: itemStatus, version: 2,
    resultedAt: null, resultedByName: "Kemi Adeola", verifiedAt: null, verifiedByName: null, returnReason: "Recheck PCV", returnedAt: null, returnedByName: null,
    acknowledgedAt: null, acknowledgedByName: null, criticalCommunicatedAt: null, criticalCommunicatedByName: null, criticalCommunicatedToName: null,
    results: [result({ flag: "CRITICAL_LOW", valueNumeric: 6.5 }), result({ analyteCode: "OLD", status: "SUPERSEDED", flag: "HIGH" })],
  }],
  ...extra,
});

describe("live laboratory rows", () => {
  it("maps each ordered test onto the screen's workflow states", () => {
    // Types are loose in this fixture on purpose: the mapping reads only these fields.
    const test = (o: ReturnType<typeof order>) => liveLabTest(o as never, o.items[0] as never);
    expect(test(order("ORDERED", "PENDING")).status).toBe("Pending");
    expect(test(order("COLLECTED", "PENDING"))).toMatchObject({ status: "In Process", revisionNote: "Recheck PCV", accessionNumber: "LAB-2026-000001" });
    expect(test(order("IN_PROGRESS", "RESULTED")).status).toBe("Awaiting Approval");
    expect(test(order("COMPLETED", "VERIFIED"))).toMatchObject({ status: "Resulted", flag: "Critical", urgency: "STAT", orderedBy: "Tunde Bakare", revisionNote: undefined });
    expect(test(order("CANCELLED", "PENDING", { cancellationReason: "Haemolysed sample", cancelledByName: "Kemi Adeola" }))).toMatchObject({
      status: "Rejected", rejectedReason: "Haemolysed sample", rejectedBy: "Kemi Adeola",
    });
    // Superseded (amended) values are history, never part of the current result.
    expect(test(order("COMPLETED", "VERIFIED")).results.map((r) => r.analyteCode)).toEqual(["HB"]);
  });

  it("takes the worst analyte as the test's flag", () => {
    expect(overallFlag([])).toBeUndefined();
    expect(overallFlag([result({}), result({ flag: "HIGH" })])).toBe("High");
    expect(overallFlag([result({ flag: "LOW" }), result({ flag: "CRITICAL_HIGH" })])).toBe("Critical");
    expect(overallFlag([result({ flag: null })])).toBeUndefined();
  });

  it("shows the reference range the server flags against, including sex-specific ranges", () => {
    const hb = { code: "HB", name: "Haemoglobin", kind: "NUMERIC" as const, low: 12, high: 17, female: { low: 12, high: 15.5 }, male: { low: 13.5, high: 17.5 } };
    expect(referenceText(analyteRange(hb, "F"))).toBe("12–15.5");
    expect(referenceText(analyteRange(hb, "M"))).toBe("13.5–17.5");
    expect(referenceText(analyteRange(hb, "Unknown"))).toBe("12–17");
    expect(referenceText({ referenceLow: null, referenceHigh: 5 })).toBe("≤ 5");
  });
});
