import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/config/runtime", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/config/runtime")>()), apiBaseUrl: "https://api.test", apiConfigured: true }));
const api = vi.hoisted(() => ({ emrRequest: vi.fn() }));
vi.mock("@/emr-live/client", async (importOriginal) => ({ ...(await importOriginal<typeof import("./client")>()), emrRequest: api.emrRequest }));

import Dashboard from "@/pages/Dashboard";
import { dashboardWindow, describeAction, overdueLabTests, useLiveDashboard, type LiveDashboard } from "./dashboard";
import { liveRouteState } from "./routes";
import { useLiveEmr } from "./session";

const ORG = "11111111-1111-4111-8111-111111111111";
const amaka = { id: "p1", name: "Amaka Nwosu", medicalRecordNumber: "MRN-0000001" };
const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();
const board = (extra: Partial<LiveDashboard> = {}): LiveDashboard => ({
  queue: { waiting: 4, inProgress: 2, completed: 9, referred: 1 },
  patients: 312,
  labPending: 3,
  prescriptionsPending: 5,
  beds: { available: 7, occupied: 13, total: 20, admitted: 13 },
  lowStock: [{ code: "PARA500", name: "Paracetamol 500 mg", form: "Tablet", onHand: 40, reorderLevel: 500 }],
  work: {
    unsignedNotes: [{ id: "n1", encounterId: "e1", kind: "CONSULTATION", reason: "Fever for three days", createdAt: minutesAgo(30), patient: amaka }],
    criticalResults: [{ id: "c1", testName: "Full blood count", result: "Haemoglobin: 6.2 g/dL", resultedAt: minutesAgo(20), patient: amaka }],
    resultsToAcknowledge: [{ id: "r1", testName: "Malaria parasite (RDT)", result: "Malaria antigen: POSITIVE", abnormal: true, verifiedAt: minutesAgo(10), patient: amaka }],
    pendingLabTests: [{ id: "t1", testName: "Lipid profile", orderedAt: minutesAgo(600), collectedAt: minutesAgo(590), patient: amaka }],
  },
  month: { outpatientVisits: 128, admissions: 6, labTestsResulted: 71, prescriptionsDispensed: 44 },
  revenue: null,
  activity: null,
  ...extra,
});
const signIn = (permissions: string[], role = "Doctor") => useLiveEmr.setState({
  status: "ready", error: "", user: { id: "u1", name: "Tunde Bakare", email: "doctor@hospital.test", role },
  access: { organizationId: ORG, facilityId: "f1", organizationName: "Sabi Test General Hospital", roles: ["DOCTOR"], permissions, clinicalApiConnected: true, patientRegistryEnabled: true } as never,
});

beforeEach(() => {
  // The page reveals cards as they scroll into view.
  globalThis.IntersectionObserver ??= class { observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } } as unknown as typeof IntersectionObserver;
  api.emrRequest.mockReset();
  useLiveDashboard.setState({ data: null, error: "" });
  signIn(["queue.read", "patient.read", "lab.order.read", "clinical.read"]);
});
afterEach(() => { cleanup(); useLiveEmr.setState({ status: "idle", access: null, user: null }); });

describe("live dashboard helpers", () => {
  it("asks for the caller's own day and month, and words audit actions plainly", () => {
    const window = dashboardWindow(new Date(2026, 9, 10, 14, 30));
    expect(new Date(window.since).getHours()).toBe(0);
    expect(new Date(window.since).getDate()).toBe(10);
    expect(new Date(window.monthStart).getDate()).toBe(1);
    expect(describeAction("lab_result.verified")).toBe("verified lab result");
    expect(describeAction("problem.recorded")).toBe("recorded problem");
  });

  it("flags tests past their turnaround from collection", () => {
    const tests = board().work.pendingLabTests!;
    expect(overdueLabTests(tests, () => 60)).toHaveLength(1);
    expect(overdueLabTests(tests, () => 24 * 60)).toHaveLength(0);
  });

  it("opens the workspace to any role with something on it", () => {
    expect(liveRouteState("/workspace", ["billing.read"])).toBe("connected");
    expect(liveRouteState("/workspace", ["emr.stock.view"])).toBe("connected");
    expect(liveRouteState("/workspace", ["organization.read"])).toBe("no-permission");
  });
});

describe("the live workspace dashboard", () => {
  it("shows the hospital's figures, the doctor's own work queue and this month's counts", async () => {
    api.emrRequest.mockResolvedValue({ data: board() });
    render(<MemoryRouter><Dashboard /></MemoryRouter>);
    expect(screen.getByText("Welcome, Bakare")).toBeTruthy();
    expect(await screen.findByText("312")).toBeTruthy();
    expect(api.emrRequest.mock.calls[0][0]).toMatch(/^\/dashboard\?since=.+&monthStart=.+/);

    expect(screen.getByText("Today Waiting").parentElement?.textContent).toContain("4");
    expect(screen.getByText("Beds Available").parentElement?.textContent).toContain("7");
    expect(screen.getByText("Fever for three days", { exact: false })).toBeTruthy();
    expect(screen.getByText("Full blood count: Haemoglobin: 6.2 g/dL")).toBeTruthy();
    expect(screen.getByText("Malaria parasite (RDT): Malaria antigen: POSITIVE (Abnormal)")).toBeTruthy();
    expect(screen.getByText(/Lipid profile · ordered/)).toBeTruthy();
    expect(screen.getByText("4 outstanding")).toBeTruthy();
    // Modules not connected yet say so instead of "nothing due".
    expect(screen.getByText("Referrals are not connected for your hospital yet.")).toBeTruthy();
    expect(screen.getByText("Appointments are not connected for your hospital yet.")).toBeTruthy();

    // Real monthly counts, no made-up targets.
    expect(screen.getByText("OPD Visits").parentElement?.textContent).toContain("128");
    expect(screen.getByText(/No monthly targets are set for your hospital yet/)).toBeTruthy();
    expect(screen.queryByText("/ 500", { exact: false })).toBeNull();

    expect(screen.getByText("Paracetamol 500 mg — 40 left")).toBeTruthy();
    expect(screen.getByText("The hospital’s activity trail is shown to administrators.")).toBeTruthy();
  });

  it("shows a cashier only billing figures and says what is not part of the role", async () => {
    signIn(["billing.read", "patient.read"], "Receptionist");
    api.emrRequest.mockResolvedValue({ data: board({
      queue: null, labPending: null, prescriptionsPending: null, beds: null, lowStock: null, work: {}, month: {},
      revenue: { collectedThisMonthMinor: 1_250_000, unpaidInvoices: 3 },
      activity: [{ id: "a1", action: "payment.recorded", resourceType: "payment", actorName: "Ada Desk", createdAt: minutesAgo(5) }],
    }) });
    render(<MemoryRouter><Dashboard /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText(/Revenue collected this month: ₦12,500 · 3 unpaid invoices/)).toBeTruthy());
    expect(screen.getByText("Lab Pending").parentElement?.textContent).toContain("—");
    expect(screen.getAllByText("Not part of your role.").length).toBe(4);
    expect(screen.getByText("Pharmacy stock is not part of your role.")).toBeTruthy();
    expect(screen.getByText("This month’s clinical figures are not part of your role.")).toBeTruthy();
    expect(screen.getByText("recorded payment")).toBeTruthy();
  });
});
