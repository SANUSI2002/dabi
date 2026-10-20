import { cleanup, render, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/config/runtime", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/config/runtime")>()), apiBaseUrl: "https://api.test", apiConfigured: true }));
const api = vi.hoisted(() => ({ workforceRequest: vi.fn() }));
vi.mock("@/emr-live/client", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/emr-live/client")>()), workforceRequest: api.workforceRequest }));

import HrDashboard from "@/pages/hr/HrDashboard";
import HrReports from "@/pages/hr/Reports";
import EmployeeDetail from "@/pages/hr/EmployeeDetail";
import { audit, useAudit } from "@/store/useAudit";
import { useHr } from "@/store/useHr";
import { liveRouteState } from "@/emr-live/routes";
import { useLiveEmr } from "@/emr-live/session";
import { LiveWorkforceSync } from "./LiveWorkforceSync";
import { useWorkforceSync } from "./sync";

const people = {
  companies: [], departments: [], hodChanges: [], jobPositions: [], jobRoles: [], employeeTypes: [], tags: [], documents: [], actionTypes: [], disciplinaryActions: [], notes: [], bonusPoints: [], qualifications: [], policies: [],
  employees: [{ id: "e1", userId: "u1", name: "Grace Nwangbo", role: "Nurse", cadre: "GL 08", phone: null, email: null, hireDate: "2024-03-01", license: null, status: "ACTIVE", companyId: null, tagIds: [], version: 2 }],
};
const events = { items: [{ id: "ev1", at: "2026-10-20T09:00:00.000Z", action: "employee.updated", resourceType: "employee", resourceId: "e1", changedFields: ["cadre"], actorName: "Ngozi Okafor", actorRoles: ["HR_OFFICER"] }] };

beforeEach(() => {
  vi.stubGlobal("IntersectionObserver", class { observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } });
  api.workforceRequest.mockReset();
  api.workforceRequest.mockImplementation(async (path: string) => (path === "/people" ? { data: people } : path.startsWith("/people/audit-events") ? { data: events } : { data: {} }));
  useWorkforceSync.setState({ error: "", pending: 0 });
  useLiveEmr.setState({
    status: "ready", error: "", user: { id: "u9", name: "Ngozi Okafor", email: "hr@hospital.test", role: "HR Officer" },
    access: { organizationId: "11111111-1111-4111-8111-111111111111", facilityId: "f1", organizationName: "Sabi Test General Hospital", roles: ["HR_OFFICER"], permissions: ["hr.read", "hr.manage"], clinicalApiConnected: true, patientRegistryEnabled: true } as never,
  });
});
afterEach(() => { cleanup(); useLiveEmr.setState({ status: "idle", access: null, user: null }); });

describe("live HR dashboard, reports and audit trail", () => {
  it("connects the HR dashboard and reports for HR", () => {
    expect(liveRouteState("/hr/dashboard", ["hr.read"])).toBe("connected");
    expect(liveRouteState("/hr/reports", ["workforce.self"])).toBe("no-permission");
  });

  it("shows the organization's HR trail and keeps no audit log in the browser", async () => {
    render(<LiveWorkforceSync />);
    await waitFor(() => expect(useAudit.getState().events.map((e) => e.action)).toEqual(["EMPLOYEE UPDATED"]));
    await waitFor(() => expect(useHr.getState().staff).toHaveLength(1));
    expect(useAudit.getState().events[0]).toMatchObject({ user: "Ngozi Okafor", role: "HR Officer", resource: "hr/employee/e1" });
    audit("something local", "hr/x");
    expect(useAudit.getState().events).toHaveLength(1); // the server keeps the trail
    for (const view of [<HrDashboard key="d" />, <HrReports key="r" />]) {
      const { unmount } = render(<MemoryRouter>{view}</MemoryRouter>);
      unmount();
    }
    render(<MemoryRouter initialEntries={["/hr/employees/e1"]}><Routes><Route path="/hr/employees/:id" element={<EmployeeDetail />} /></Routes></MemoryRouter>);
  });
});
