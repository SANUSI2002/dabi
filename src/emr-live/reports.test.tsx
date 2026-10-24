import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/config/runtime", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/config/runtime")>()), apiBaseUrl: "https://api.test", apiConfigured: true }));
const api = vi.hoisted(() => ({ emrRequest: vi.fn() }));
vi.mock("@/emr-live/client", async (importOriginal) => ({ ...(await importOriginal<typeof import("./client")>()), emrRequest: api.emrRequest }));

import AuditLog from "@/pages/admin/AuditLog";
import MsfReport from "@/pages/admin/MsfReport";
import NhmisSync from "@/pages/admin/NhmisSync";
import Reports from "@/pages/admin/Reports";
import { auditFromApi, encounterFromReport, reportSourceFromApi, useLiveReports, type ApiReportSource } from "./reports";
import { liveRouteState } from "./routes";
import { useLiveEmr } from "./session";

const person = { id: "p1", medicalRecordNumber: "MRN-0000051", givenName: "Ngozi", familyName: "Eze", dateOfBirth: "1988-03-01", sex: "FEMALE" as const };
const source: ApiReportSource = {
  from: "2026-10-01", to: "2026-10-20", truncated: false,
  encounters: [{ id: "e1", patientId: "p1", date: "2026-10-15T09:00:00.000Z", complaint: "Fever", status: "FINISHED", visitType: null, provider: "Tunde Bakare",
    diagnoses: [{ code: "1F40", name: "Malaria, uncomplicated" }],
    prescriptions: [{ id: "i1", drug: "Artemether/lumefantrine", drugCode: "AL20_120", dose: 4, doseUnit: "tablet", frequency: "BD", route: "PO", durationDays: 3, quantity: 24, dispensed: 24, status: "ACTIVE" }] }],
  labOrders: [], patients: [person], registry: { total: 41, consentYes: 30, consentNo: 4, consentUnknown: 7 },
};
const counts = { from: "2026-10-01", to: "2026-10-20", datasets: { opd: 17, immunization: 5, maternal: 9, births: 2, surveillance: 1, familyPlanning: 3, referrals: 4, transfers: 1 }, msf: { "Total visits": 17, "Confirmed malaria": 6 } };
const audit = { id: "a1", action: "patient.viewed", resourceType: "patient", resourceId: "p1", actorUserId: "u1", actorName: "Grace Nwangbo", actorRoles: ["NURSE"], changedFields: [], createdAt: "2026-10-19T10:00:00.000Z" };

let msfSaved: unknown = null;
beforeEach(() => {
  msfSaved = null;
  vi.stubGlobal("IntersectionObserver", class { observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } });
  api.emrRequest.mockReset();
  api.emrRequest.mockImplementation(async (path: string, options?: { method?: string; body?: { values?: Record<string, number> } }) => {
    if (path.startsWith("/reports/source?")) return { data: source };
    if (path.startsWith("/reports/counts?")) return { data: counts };
    if (path.startsWith("/reports/msf/") && path.endsWith("/compile")) { msfSaved = { ...(msfSaved as object), status: "COMPILED", version: 2, compiledByName: "Hospital Admin", compiledAt: "2026-10-20T10:00:00.000Z" }; return { data: msfSaved }; }
    if (path.startsWith("/reports/msf/") && options?.method === "PUT") { msfSaved = { id: "m1", period: "2026-10", values: options.body?.values ?? {}, status: "DRAFT", version: 1, updatedByName: "Hospital Admin", compiledByName: null, compiledAt: null }; return { data: msfSaved }; }
    if (path.startsWith("/reports/msf/")) return { data: { period: "2026-10", derived: counts.msf, saved: msfSaved } };
    if (path.startsWith("/audit-events")) return { data: { items: [audit], nextCursor: null } };
    return { data: { items: [] } };
  });
  useLiveReports.setState({ source: null, counts: null, msf: null, audit: [], auditCursor: null, error: "" });
  useLiveEmr.setState({
    status: "ready", error: "", user: { id: "u9", name: "Hospital Admin", email: "admin@hospital.test", role: "Hospital Admin" },
    access: { organizationId: "11111111-1111-4111-8111-111111111111", facilityId: "f1", organizationName: "Sabi Test General Hospital", roles: ["HOSPITAL_ADMIN"], permissions: ["report.view", "report.compile", "audit.view"], clinicalApiConnected: true, patientRegistryEnabled: true } as never,
  });
});
afterEach(() => { cleanup(); useLiveEmr.setState({ status: "idle", access: null, user: null }); });

describe("live reporting", () => {
  it("connects the reporting screens and maps the record", () => {
    for (const route of ["/reports", "/nhmis-sync", "/msf-report"]) expect(liveRouteState(route, ["report.view"])).toBe("connected");
    expect(liveRouteState("/audit-log", ["audit.view"])).toBe("connected");
    expect(encounterFromReport(source.encounters[0])).toMatchObject({ provider: "Tunde Bakare", diagnoses: [{ name: "Malaria, uncomplicated" }], prescriptions: [{ drug: "Artemether/lumefantrine", status: "Dispensed", qty: 24 }] });
    expect(reportSourceFromApi(source).registry.total).toBe(41);
    expect(auditFromApi(audit)).toMatchObject({ user: "Grace Nwangbo", role: "Nurse", ip: "Not recorded", resource: "patient/p1" });
  });

  it("builds reports from the hospital's own record", async () => {
    render(<MemoryRouter><Reports /></MemoryRouter>);
    await waitFor(() => expect(api.emrRequest).toHaveBeenCalledWith(expect.stringMatching(/^\/reports\/source\?from=\d{4}-\d{2}-\d{2}&to=\d{4}-\d{2}-\d{2}$/)));
    expect(api.emrRequest).toHaveBeenCalledWith(expect.stringMatching(/^\/immunizations\?from=.*&limit=2000$/));
  });

  it("shows this month's dataset counts on NHMIS Sync", async () => {
    render(<MemoryRouter><NhmisSync /></MemoryRouter>);
    expect(await screen.findByText(/17 records/)).toBeInTheDocument();
    expect(screen.getByText(/Local dataset preview for this month/)).toBeInTheDocument();
  });

  it("compiles the MSF in the EMR and says it was not sent anywhere", async () => {
    render(<MemoryRouter><MsfReport /></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: /Compile & lock/ }));
    await waitFor(() => expect(api.emrRequest).toHaveBeenCalledWith(expect.stringMatching(/^\/reports\/msf\/\d{4}-\d{2}\/compile$/), expect.objectContaining({ method: "POST", version: 1 })));
    expect(await screen.findByText(/has not been sent to the LGA/)).toBeInTheDocument();
    const put = api.emrRequest.mock.calls.find(([, o]) => o?.method === "PUT");
    expect(put?.[1].body.values).toMatchObject({ "Total visits": 17, "Confirmed malaria": 6 });
  });

  it("shows the live audit trail with actor names and roles", async () => {
    render(<MemoryRouter><AuditLog /></MemoryRouter>);
    expect(await screen.findByText("Grace Nwangbo")).toBeInTheDocument();
    expect(screen.getByText("Not recorded")).toBeInTheDocument();
  });
});
