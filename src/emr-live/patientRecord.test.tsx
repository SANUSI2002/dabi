import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/config/runtime", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/config/runtime")>()), apiBaseUrl: "https://api.test", apiConfigured: true }));
const api = vi.hoisted(() => ({ emrRequest: vi.fn() }));
vi.mock("@/emr-live/client", async (importOriginal) => ({ ...(await importOriginal<typeof import("./client")>()), emrRequest: api.emrRequest }));

import PatientChart from "@/pages/clinical/PatientChart";
import MedicalHistory from "@/pages/clinical/MedicalHistory";
import { allergySubstanceCode, recordFromApi, useLivePatientRecord, type ApiPatientRecord } from "./patientRecord";
import { liveRouteState } from "./routes";
import { useLiveEmr } from "./session";

const ORG = "11111111-1111-4111-8111-111111111111";
const patient = {
  id: "p1", medicalRecordNumber: "MRN-0000001", givenName: "Amaka", familyName: "Nwosu", dateOfBirth: "1992-02-14", sex: "FEMALE" as const,
  phone: "+2348030000001", payer: "HMO" as const, createdAt: "2026-09-01T08:00:00.000Z",
};
const note = (extra: Record<string, unknown> = {}) => ({
  id: "n1", kind: "CONSULTATION", status: "SIGNED", version: 2, subjective: "Headache for 3 days", objective: "Febrile", assessment: "Malaria", plan: "ACT for 3 days",
  body: null, followUp: "Review in 1 week", patientInstructions: null, authorName: "Tunde Bakare", signedByName: "Tunde Bakare", signedAt: "2026-10-09T09:40:00.000Z",
  createdAt: "2026-10-09T09:20:00.000Z", amendments: [], ...extra,
});
const visit = (extra: Record<string, unknown> = {}) => ({
  id: "e1", class: "OUTPATIENT", status: "IN_PROGRESS", reason: null, visitType: "New", arrivedAt: "2026-10-09T09:00:00.000Z", nhmisIndicators: [],
  attendingName: "Tunde Bakare", notes: [note()], queueEntry: { station: "Pharmacy", status: "WAITING" },
  diagnoses: [{ id: "d1", code: "1F40", codeSystem: "ICD11", description: "Malaria, uncomplicated", rank: "PRIMARY", onProblemList: false, createdAt: "2026-10-09T09:30:00.000Z", recordedByName: "Tunde Bakare" }],
  ...extra,
});
const labOrder = {
  id: "o1", patientId: "p1", encounterId: "e1", status: "COMPLETED", priority: "ROUTINE", accessionNumber: "LAB-2026-000001", version: 3,
  createdAt: "2026-10-09T09:35:00.000Z", orderedByName: "Tunde Bakare", collectedAt: "2026-10-09T09:50:00.000Z", collectedByName: "Grace Nwangbo",
  specimenNote: null, cancelledAt: null, cancelledByName: null, cancellationReason: null, patient,
  items: [{
    id: "li1", testCode: "MP_RDT", testName: "Malaria RDT", specimenType: "Whole blood", analytes: [], status: "VERIFIED", version: 3,
    resultedAt: "2026-10-09T10:10:00.000Z", resultedByName: "Kemi Adeola", verifiedAt: "2026-10-09T10:20:00.000Z", verifiedByName: "Kemi Adeola",
    returnReason: null, returnedAt: null, returnedByName: null, acknowledgedAt: null, acknowledgedByName: null,
    criticalCommunicatedAt: null, criticalCommunicatedByName: null, criticalCommunicatedToName: null,
    results: [{ analyteCode: "MP", analyteName: "Malaria parasites", valueNumeric: null, valueText: "Positive", unit: null, referenceLow: null, referenceHigh: null, flag: "ABNORMAL", status: "FINAL" }],
  }],
};
const prescription = {
  id: "rx1", encounterId: "e1", patientId: "p1", version: 2, createdAt: "2026-10-09T09:45:00.000Z", status: "APPROVED",
  prescriberName: "Tunde Bakare", reviewedByName: "Ifeoma Obi", reviewedAt: "2026-10-09T10:00:00.000Z", reviewNote: null, rejectionReason: null,
  patient, dispenses: [], allergies: [],
  items: [{
    id: "ri1", drugCode: "ACT80", drugName: "Artemether/Lumefantrine", strength: "80/480 mg", form: "Tablet", dose: 1, doseUnit: "tablet", frequency: "BD", route: "PO",
    durationDays: 3, prn: false, prnReason: null, instructions: null, dispenseUnit: "tablet", quantityPrescribed: 6, quantityDispensed: 0, status: "ACTIVE",
    controlled: false, safetyAlerts: [], closeOutcome: null, closeReason: null, closedAt: null, closedByName: null,
  }],
};
const record = (extra: Partial<Record<keyof ApiPatientRecord, unknown>> = {}) => ({
  patient,
  encounters: [visit()],
  vitals: [
    { code: "BP_SYSTOLIC", value: 128, recordedAt: "2026-10-09T09:10:00.000Z", recordedByName: "Grace Nwangbo", status: "ACTIVE" },
    { code: "BP_DIASTOLIC", value: 84, recordedAt: "2026-10-09T09:10:00.000Z", recordedByName: "Grace Nwangbo", status: "ACTIVE" },
    { code: "TEMPERATURE", value: 38.4, recordedAt: "2026-10-09T09:10:00.000Z", recordedByName: "Grace Nwangbo", status: "ACTIVE" },
  ],
  problems: [
    { id: "pr1", problemId: "pr1", encounterId: null, code: "BA00", codeSystem: "ICD11", description: "Essential hypertension", clinicalStatus: "ACTIVE", verificationStatus: "CONFIRMED",
      onsetDate: "2019-05-01", abatementDate: null, note: null, recordedByName: "Tunde Bakare", createdAt: "2026-09-02T09:00:00.000Z", version: 4 },
    { id: "diagnosis:d9", problemId: null, fromDiagnosisId: "d9", encounterId: "e0", code: "5A11", codeSystem: "ICD11", description: "Type 2 diabetes mellitus", clinicalStatus: "ACTIVE",
      verificationStatus: null, onsetDate: null, abatementDate: null, note: null, recordedByName: "Tunde Bakare", createdAt: "2026-09-02T09:00:00.000Z", version: null },
  ],
  allergies: [
    { id: "a1", substance: "Penicillin", substanceCode: "PENICILLIN", reaction: "Swelling of the lips", severity: "SEVERE", category: "MEDICATION", criticality: "HIGH",
      verificationStatus: "CONFIRMED", manifestations: ["Angioedema"], note: null, source: null, recordedByName: "Tunde Bakare", createdAt: "2026-09-02T09:00:00.000Z" },
    { id: "a2", substance: "Peanut", substanceCode: "PEANUT", reaction: null, severity: "MODERATE", category: null, criticality: null,
      verificationStatus: "UNCONFIRMED", manifestations: [], note: null, source: null, recordedByName: "Grace Nwangbo", createdAt: "2026-09-03T09:00:00.000Z" },
  ],
  labs: [labOrder],
  prescriptions: [prescription],
  admissions: [],
  invoices: [{
    id: "inv1", number: "INV-2026-000003", status: "PARTIALLY_PAID", issuedAt: "2026-10-09T11:00:00.000Z", taxMinor: 0, discountMinor: 50_000, totalMinor: 800_000, balanceMinor: 300_000,
    lines: [{ description: "Outpatient consultation", quantity: 1, unitPriceMinor: 500_000, category: "CONSULTATION", sourceKey: "e1" },
      { description: "Malaria RDT", quantity: 1, unitPriceMinor: 350_000, category: "LAB", sourceKey: "li1" }],
  }],
  sections: { labs: true, prescriptions: true, admissions: true, invoices: true },
  ...extra,
});

const clinician = (permissions: string[]) => useLiveEmr.setState({
  status: "ready", error: "", user: { id: "u1", name: "Tunde Bakare", email: "doctor@hospital.test", role: "Doctor" },
  access: { organizationId: ORG, facilityId: "f1", organizationName: "Sabi Test General Hospital", roles: ["DOCTOR"], permissions, clinicalApiConnected: true, patientRegistryEnabled: true } as never,
});

beforeEach(() => {
  api.emrRequest.mockReset();
  useLivePatientRecord.setState({ id: null, record: null, error: "" });
  clinician(["clinical.read", "diagnosis.record", "allergy.record", "patient.read"]);
});
afterEach(() => { cleanup(); useLiveEmr.setState({ status: "idle", access: null, user: null }); });

describe("the live patient record", () => {
  it("maps the chart onto the screens' shapes", () => {
    const mapped = recordFromApi(record() as unknown as ApiPatientRecord);
    expect(mapped.patient).toMatchObject({ id: "p1", firstName: "Amaka", mrn: "MRN-0000001" });
    expect(mapped.encounters[0]).toMatchObject({
      date: "2026-10-09T09:00:00.000Z", provider: "Tunde Bakare", complaint: "Headache for 3 days", assessment: "Malaria", plan: "ACT for 3 days",
      status: "signed", diagnoses: [{ code: "1F40", name: "Malaria, uncomplicated" }], labs: ["Malaria RDT"], followUp: "Review in 1 week",
    });
    expect(mapped.encounters[0].prescriptions.map((p) => p.drug)).toEqual(["Artemether/Lumefantrine 80/480 mg"]);
    expect(mapped.labs[0]).toMatchObject({ test: "Malaria RDT", status: "Resulted" });
    expect(mapped.vitals).toEqual([expect.objectContaining({ bp: "128/84", temp: 38.4, takenBy: "Grace Nwangbo" })]);
    // A stored problem keeps its version; a flagged diagnosis is listed but not verified yet.
    expect(mapped.conditions.map((c) => [c.code.display, c.clinicalStatus, c.verificationStatus, c.problemId, c.version])).toEqual([
      ["Essential hypertension", "active", "confirmed", "pr1", 4],
      ["Type 2 diabetes mellitus", "active", "unconfirmed", null, null],
    ]);
    expect(mapped.allergies[0]).toMatchObject({ substance: { system: "snomed", display: "Penicillin" }, criticality: "high", category: "medication",
      reactions: [{ manifestation: ["Angioedema"], severity: "severe", description: "Swelling of the lips" }] });
    // An older entry without details reads honestly: medication, criticality not assessed, no reaction recorded.
    expect(mapped.allergies[1]).toMatchObject({ category: "medication", criticality: "unable-to-assess", verificationStatus: "unconfirmed", reactions: [] });
    expect(mapped.invoices[0]).toMatchObject({ number: "INV-2026-000003", status: "Partially Paid" });
    expect(mapped.invoices[0].lines.reduce((sum, line) => sum + line.qty * line.unitPrice, 0)).toBe(8_000);
    expect(mapped.outstanding).toBe(3_000);
    expect(mapped.inClinic).toEqual({ station: "Pharmacy", status: "Waiting" });
    expect(mapped.lastUpdated).toBe("2026-10-09T09:35:00.000Z");
  });

  it("marks an amended visit and turns allergy names into the codes prescribing checks match", () => {
    const amended = recordFromApi(record({ encounters: [visit({ notes: [note({ amendments: [{ id: "am1", reason: "Travel history", body: "Travel history", authorName: "Tunde Bakare", createdAt: "2026-10-09T12:00:00.000Z" }] })] })] }) as unknown as ApiPatientRecord);
    expect(amended.encounters[0]).toMatchObject({ status: "amended", amendedBy: "Tunde Bakare", amendmentNote: "Travel history" });
    expect(allergySubstanceCode("Penicillin")).toBe("PENICILLIN");
    expect(allergySubstanceCode("NSAIDs")).toBe("NSAID");
    expect(allergySubstanceCode("Iodinated contrast")).toBe("IODINATED_CONTRAST");
    expect(allergySubstanceCode("5-FU")).toBe("FU");
  });

  it("connects the chart and Medical History for clinicians only", () => {
    expect(liveRouteState("/patients/p1", ["clinical.read"])).toBe("connected");
    expect(liveRouteState("/history", ["clinical.read"])).toBe("connected");
    expect(liveRouteState("/patients/p1", ["patient.read"])).toBe("no-permission");
  });
});

function renderChart() {
  return render(
    <MemoryRouter initialEntries={["/patients/p1"]}>
      <Routes>
        <Route path="/patients/:id" element={<PatientChart />} />
        <Route path="/queue" element={<p>Queue screen</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("the live patient chart", () => {
  it("shows the hospital's record and saves problem-list and allergy changes", async () => {
    api.emrRequest.mockImplementation(async (path: string) => (path.endsWith("/record") ? { data: record() } : { data: {} }));
    renderChart();
    expect(screen.getByText("Loading the patient record…")).toBeTruthy();
    expect(await screen.findByText(/High-risk allergy: Penicillin/)).toBeTruthy();
    expect(screen.getByText(/In clinic · Pharmacy queue · Waiting/)).toBeTruthy();
    expect(screen.getByText("₦3,000")).toBeTruthy();

    fireEvent.click(screen.getByRole("tab", { name: /Problems \(2\)/ }));
    const diabetes = screen.getByText("Type 2 diabetes mellitus").closest("li") as HTMLElement;
    fireEvent.change(within(diabetes).getAllByRole("combobox")[0], { target: { value: "resolved" } });
    await waitFor(() => expect(api.emrRequest).toHaveBeenCalledWith("/patients/p1/problems", { method: "POST", body: { fromDiagnosisId: "d9", clinicalStatus: "RESOLVED" } }));
    const hypertension = screen.getByText("Essential hypertension").closest("li") as HTMLElement;
    fireEvent.change(within(hypertension).getAllByRole("combobox")[1], { target: { value: "refuted" } });
    await waitFor(() => expect(api.emrRequest).toHaveBeenCalledWith("/patients/p1/problems/pr1", { method: "PATCH", version: 4, body: { verificationStatus: "REFUTED" } }));

    fireEvent.click(screen.getByRole("tab", { name: /Allergies \(2\)/ }));
    fireEvent.click(screen.getByRole("button", { name: "Mark confirmed" }));
    await waitFor(() => expect(api.emrRequest).toHaveBeenCalledWith("/patients/p1/allergies/a2/confirm", { method: "POST", body: {} }));

    fireEvent.click(screen.getByRole("button", { name: /Record allergy/ }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByPlaceholderText("e.g. Penicillin"), { target: { value: "Sulfonamides" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Rash" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Save allergy" }));
    await waitFor(() => expect(api.emrRequest).toHaveBeenCalledWith("/patients/p1/allergies", {
      method: "POST",
      body: { substance: "Sulfonamides", substanceCode: "SULFONAMIDE", category: "MEDICATION", criticality: "HIGH", severity: "MODERATE", verificationStatus: "CONFIRMED", manifestations: ["Rash"], source: "Recorded at consultation" },
    }));
    }, 30_000); // many steps; the full suite runs slowly on this machine

  it("adds a problem from the coded list and shows what the hospital refused", async () => {
    api.emrRequest.mockImplementation(async (path: string) => {
      if (path.endsWith("/record")) return { data: record() };
      throw Object.assign(new Error("This problem is already on the patient’s problem list."), { code: "PROBLEM_ALREADY_RECORDED" });
    });
    renderChart();
    await screen.findByText(/High-risk allergy: Penicillin/);
    fireEvent.click(screen.getByRole("tab", { name: /Problems/ }));
    fireEvent.click(screen.getByRole("button", { name: /Add problem/ }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByPlaceholderText("e.g. hypertension"), { target: { value: "hypertension" } });
    fireEvent.click(within(dialog).getByRole("button", { name: /Essential hypertension/ }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Add to problem list" }));
    await waitFor(() => expect(api.emrRequest).toHaveBeenCalledWith("/patients/p1/problems", { method: "POST", body: { codeSystem: "ICD11", code: "BA00", description: "Essential hypertension", verificationStatus: "PROVISIONAL" } }));
    expect(await within(dialog).findByText(/already on the patient’s problem list/)).toBeTruthy();
  });

  it("says when billing is not part of the role instead of showing nothing owed", async () => {
    api.emrRequest.mockImplementation(async () => ({ data: record({ invoices: null, sections: { labs: true, prescriptions: true, admissions: true, invoices: false } }) }));
    renderChart();
    await screen.findByText(/High-risk allergy: Penicillin/);
    expect(screen.getByText("Outstanding").parentElement?.textContent).toContain("—");
    fireEvent.click(screen.getByRole("tab", { name: /Billing \(0\)/ }));
    expect(screen.getByText("Billing history is not part of your role.")).toBeTruthy();
  });

  it("checks the patient in from the chart", async () => {
    api.emrRequest.mockImplementation(async (path: string) => {
      if (path.endsWith("/record")) return { data: record() };
      if (path.startsWith("/queue")) return { data: { items: [] } };
      return { data: {} };
    });
    renderChart();
    fireEvent.click(await screen.findByRole("button", { name: /Add to queue/ }));
    expect(await screen.findByText("Queue screen")).toBeTruthy();
    expect(api.emrRequest).toHaveBeenCalledWith("/encounters", { method: "POST", body: { patientId: "p1", station: "Vital", priority: "NORMAL" } });
  });
});

describe("live Medical History", () => {
  it("loads the picked patient's visits and records an amendment on the signed note", async () => {
    api.emrRequest.mockImplementation(async (path: string) => {
      if (path.startsWith("/patients?")) return { data: { items: [patient] } };
      if (path.endsWith("/record")) return { data: record() };
      return { data: {} };
    });
    render(<MemoryRouter><MedicalHistory /></MemoryRouter>);
    expect(screen.getByText("Select a patient to view their history.")).toBeTruthy();
    const search = screen.getByPlaceholderText("Search by name, MRN, phone…");
    fireEvent.focus(search);
    fireEvent.change(search, { target: { value: "Amaka" } });
    fireEvent.mouseDown(await screen.findByRole("button", { name: /Amaka Nwosu/ }));

    expect(await screen.findByText("Headache for 3 days", { exact: false })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Medication (1)" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Lab (1)" })).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: "Vitals" }));
    expect(screen.getByText(/1 set of vital signs recorded/)).toBeTruthy();

    fireEvent.click(screen.getByRole("tab", { name: "Consultation (1)" }));
    fireEvent.click(screen.getByRole("button", { name: "Amend" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByPlaceholderText("Why is this encounter being amended?"), { target: { value: "Added travel history" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save Amendment" }));
    await waitFor(() => expect(api.emrRequest).toHaveBeenCalledWith("/encounters/e1/notes/n1/amendments", { method: "POST", body: { reason: "Added travel history", body: "Added travel history" } }));
  });
});
