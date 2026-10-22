import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/config/runtime", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/config/runtime")>()), apiBaseUrl: "https://api.test", apiConfigured: true }));
const api = vi.hoisted(() => ({ emrRequest: vi.fn() }));
vi.mock("@/emr-live/client", async (importOriginal) => ({ ...(await importOriginal<typeof import("./client")>()), emrRequest: api.emrRequest }));

import WardRound from "@/pages/clinical/WardRound";
import type { Prescription } from "@/data/types";
import { useWorkforceSync } from "@/workforce-live/sync";
import { liveRouteState } from "./routes";
import { useLiveEmr } from "./session";
import { liveWardRoundActions, routeCode, useLiveWardRound } from "./wardRound";

const ORG = "11111111-1111-4111-8111-111111111111";
const patient = { id: "p1", medicalRecordNumber: "MRN-0000001", givenName: "Amaka", familyName: "Nwosu", dateOfBirth: "1992-02-14", sex: "FEMALE", createdAt: "2026-09-01T08:00:00.000Z" };
const admission = {
  id: "ad1", encounterId: "e1", patientId: "p1", status: "ADMITTED", wardId: "w1", bedId: "b1", version: 1, reason: "Pneumonia", admittedAt: "2026-10-18T08:00:00.000Z",
  attendingUserId: "u1", attendingName: "Tunde Bakare", expectedDischargeDate: null, admittingDiagnosis: "Community-acquired pneumonia", service: "Medicine", isolation: null,
  dischargeReady: false, dischargedAt: null, dischargedByName: null, dischargeOutcome: null, dischargeDisposition: null, dischargeDestination: null, dischargeSummary: null,
  lastObservedAt: null, ward: { code: "MED", name: "Medical ward" }, bed: { code: "M1" }, patient, assignments: [],
};
const round = (extra: Record<string, unknown> = {}) => ({
  id: "wr1", admissionId: "ad1", patientId: "p1", encounterId: "e1", roundAt: "2026-10-20T08:30:00.000Z", clinicianUserId: "u1", clinicianName: "Tunde Bakare", department: "Medicine",
  participants: [{ id: "p-1", role: "Consultant", name: "Tunde Bakare" }], clinicalProgress: "", progressNote: "", devices: [], problems: [], tasks: [],
  safetyChecklist: { medicationReconciliationReviewed: false, drugAllergiesReviewed: false, antibioticsReviewed: false, anticoagulationReviewed: false, highRiskMedicinesReviewed: false,
    prnMedicinesReviewed: false, ivMedicationReviewed: false, monitoringRequired: false, changesCommunicated: false },
  escalationPlan: null, dischargeReadiness: { fit: null, barriers: [] },
  communication: { patientUpdated: null, medicationChangesExplained: null, planDiscussed: null, caregiverUpdated: null, interpreterRequired: null },
  examination: null, summary: "", status: "draft", signedBy: undefined, signedAt: null, updatedBy: undefined, updatedAt: null, createdAt: "2026-10-20T08:30:00.000Z", version: 3, amendments: [],
  ...extra,
});
const item = {
  id: "ri1", drugCode: "AMOX500", drugName: "Amoxicillin", strength: "500 mg", form: "Capsule", dose: 500, doseUnit: "mg", frequency: "TDS", route: "PO",
  durationDays: 5, prn: false, prnReason: null, instructions: null, dispenseUnit: "capsule", quantityPrescribed: 15, quantityDispensed: 0, status: "ACTIVE",
  controlled: false, safetyAlerts: [], closeOutcome: null, closeReason: null, closedAt: null, closedByName: null, heldAt: null, heldReason: null,
};
const record = {
  patient, encounters: [], vitals: [], allergies: [], labs: [], admissions: [], invoices: [],
  problems: [{ id: "pr1", problemId: "pr1", encounterId: null, code: "CA40", codeSystem: "ICD11", description: "Pneumonia", clinicalStatus: "ACTIVE", verificationStatus: "CONFIRMED",
    onsetDate: null, abatementDate: null, note: null, recordedByName: "Tunde Bakare", createdAt: "2026-10-18T09:00:00.000Z", version: 1 }],
  prescriptions: [{
    id: "rx1", encounterId: "e1", patientId: "p1", version: 2, createdAt: "2026-10-18T09:00:00.000Z", status: "APPROVED", prescriberName: "Tunde Bakare",
    reviewedByName: "Ifeoma Obi", reviewedAt: "2026-10-18T10:00:00.000Z", reviewNote: null, rejectionReason: null, patient, dispenses: [], allergies: [], items: [item],
  }],
  sections: { labs: true, prescriptions: true, admissions: true, invoices: true },
};
let rounds: ReturnType<typeof round>[] = [];

function serve() {
  api.emrRequest.mockImplementation(async (path: string, options?: { method?: string }) => {
    if (options?.method === "PATCH") return { data: { version: 4, updatedAt: "2026-10-20T09:00:00.000Z" } };
    if (options?.method) return { data: {} };
    if (path === "/admissions/ad1") return { data: admission };
    if (path === "/admissions/ad1/ward-rounds") return { data: { rounds, medicationChanges: [] } };
    if (path === "/admissions/ad1/mar") return { data: { medicines: [{ prescriptionItemId: "ri1", lastGivenAt: "2026-10-20T06:00:00.000Z" }], entries: [] } };
    if (path === "/encounters/e1/vitals") return { data: { items: [
      { code: "TEMPERATURE", value: 37.9, recordedAt: "2026-10-20T06:00:00.000Z", recordedByName: "Grace Nwangbo", status: "ACTIVE" },
      { code: "HEART_RATE", value: 96, recordedAt: "2026-10-20T06:00:00.000Z", recordedByName: "Grace Nwangbo", status: "ACTIVE" },
    ] } };
    if (path === "/admissions/ad1/nursing") return { data: { items: [] } };
    if (path === "/patients/p1/record") return { data: record };
    throw new Error(`unexpected ${path}`);
  });
}
const loaded = async () => expect((await screen.findAllByText(/Community-acquired pneumonia/)).length).toBeGreaterThan(0);
const writes = () => api.emrRequest.mock.calls.filter(([, o]) => o?.method).map(([p, o]) => [p, o.method, o.body, o.version]);
const open = () => render(<MemoryRouter initialEntries={["/ward-round/ad1"]}><Routes><Route path="/ward-round/:admissionId/:roundId?" element={<WardRound />} /></Routes></MemoryRouter>);

beforeEach(() => {
  vi.stubGlobal("IntersectionObserver", class { observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } });
  api.emrRequest.mockReset();
  rounds = [round()];
  serve();
  useWorkforceSync.setState({ error: "", pending: 0 });
  useLiveWardRound.setState({ admissionId: null, loaded: false, error: "", rounds: [] });
  useLiveEmr.setState({
    status: "ready", error: "", user: { id: "u1", name: "Tunde Bakare", email: "doctor@hospital.test", role: "Doctor" },
    access: { organizationId: ORG, facilityId: "f1", organizationName: "Sabi Test General Hospital", roles: ["DOCTOR"], permissions: ["clinical.read", "diagnosis.record", "clinical.note.sign", "prescription.create"], clinicalApiConnected: true, patientRegistryEnabled: true } as never,
  });
});
afterEach(() => { cleanup(); useLiveEmr.setState({ status: "idle", access: null, user: null }); });

describe("the live ward round", () => {
  it("is a connected screen for anyone who reads clinical records", () => {
    expect(liveRouteState("/ward-round/ad1", ["clinical.read"])).toBe("connected");
  });

  it("opens the admission's draft with its chart, problems and medicines from the server", async () => {
    open();
    await loaded();
    expect(useLiveWardRound.getState().medications.map((m) => [m.drug, m.status])).toEqual([["Amoxicillin 500 mg", "Approved"]]);
    expect(useLiveWardRound.getState().lastGiven).toEqual({ ri1: "2026-10-20T06:00:00.000Z" });
    expect(screen.getAllByText("Pneumonia").length).toBeGreaterThan(0);
    expect(writes()).toEqual([]); // an open draft is resumed, never a second one started
  });

  it("starts a round when the admission has no draft", async () => {
    rounds = [];
    open();
    await waitFor(() => expect(writes()).toEqual([["/admissions/ad1/ward-rounds", "POST", { id: expect.any(String) }, undefined]]));
  });

  it("saves typing a moment after it stops, as one change against the current version", async () => {
    open();
    await loaded();
    const note = document.querySelector("textarea") as HTMLTextAreaElement;
    fireEvent.change(note, { target: { value: "Afebrile" } });
    fireEvent.change(note, { target: { value: "Afebrile overnight" } });
    expect(writes()).toEqual([]);
    // a reload while typing never undoes what has not been sent yet
    await useLiveWardRound.getState().load("ad1");
    expect(useLiveWardRound.getState().rounds[0].progressNote).toBe("Afebrile overnight");
    const reads = () => api.emrRequest.mock.calls.filter(([p, o]) => p === "/admissions/ad1/ward-rounds" && !o?.method).length;
    const before = reads();
    await waitFor(() => expect(writes()).toEqual([["/ward-rounds/wr1", "PATCH", { progressNote: "Afebrile overnight" }, 3]]), { timeout: 2000 });
    await waitFor(() => expect(useLiveWardRound.getState().rounds[0].version).toBe(4)); // takes back the new version…
    expect(reads()).toBe(before); // …without reloading the whole screen
  });

  it("sends medication decisions in the formulary's terms, and saves the draft before signing", async () => {
    open();
    await loaded();
    const target = useLiveWardRound.getState().medications[0] as Prescription;
    liveWardRoundActions.changeMedication({ patientId: "p1", wardRoundId: "wr1", encounterId: "e1", target, action: "DOSE_INCREASED", newDose: "1000 mg", reason: "Slow response" });
    liveWardRoundActions.changeMedication({ patientId: "p1", wardRoundId: "wr1", encounterId: "e1", target, action: "ROUTE_CHANGED", newRoute: "Intravenous", reason: "Vomiting" });
    expect(liveWardRoundActions.sign("wr1")).toMatchObject({ ok: false, error: expect.stringMatching(/progress note/) });
    liveWardRoundActions.updateDraft("wr1", { progressNote: "Improving" });
    liveWardRoundActions.addTask("wr1", { type: "Repeat vitals", description: "4-hourly", priority: "Routine", status: "Pending" });
    expect(liveWardRoundActions.sign("wr1")).toEqual({ ok: true });
    await waitFor(() => expect(writes().map(([p]) => p)).toEqual(["/ward-rounds/wr1/medication-changes", "/ward-rounds/wr1/medication-changes", "/ward-rounds/wr1", "/ward-rounds/wr1/sign"]));
    expect(writes()[0][2]).toEqual({ prescriptionItemId: "ri1", action: "DOSE_INCREASED", reason: "Slow response", newDose: 1000 });
    expect(writes()[1][2]).toEqual({ prescriptionItemId: "ri1", action: "ROUTE_CHANGED", reason: "Vomiting", newRoute: "IV" });
    expect(writes()[2][2]).toMatchObject({ progressNote: "Improving", tasks: [expect.objectContaining({ description: "4-hourly" })] });
  });

  it("refuses a dose in the wrong unit in the banner, before anything is sent", async () => {
    open();
    await loaded();
    const target = useLiveWardRound.getState().medications[0] as Prescription;
    liveWardRoundActions.changeMedication({ patientId: "p1", wardRoundId: "wr1", encounterId: "e1", target, action: "DOSE_INCREASED", newDose: "1 g", reason: "Slow response" });
    await waitFor(() => expect(useWorkforceSync.getState().error).toMatch(/must be in mg/));
    expect(writes()).toEqual([]);
    expect(() => routeCode("by magic", "Amoxicillin")).toThrow(/route must be one of/);
  });
});
