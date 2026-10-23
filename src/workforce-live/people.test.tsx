import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/config/runtime", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/config/runtime")>()), apiBaseUrl: "https://api.test", apiConfigured: true }));
const api = vi.hoisted(() => ({ workforceRequest: vi.fn(), orgConfigRequest: vi.fn() }));
vi.mock("@/emr-live/client", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/emr-live/client")>()), workforceRequest: api.workforceRequest, orgConfigRequest: api.orgConfigRequest }));

import EmployeeDirectory from "@/pages/hr/EmployeeDirectory";
import { useHr } from "@/store/useHr";
import { useOrg } from "@/store/useOrg";
import { useEmployees } from "@/store/useEmployees";
import { liveRouteState } from "@/emr-live/routes";
import { useLiveEmr } from "@/emr-live/session";
import { LiveWorkforceSync } from "./LiveWorkforceSync";
import { useWorkforceSync } from "./sync";

const HQ = "00000000-0000-4000-8000-0000000000a1";
const people = {
  companies: [{ id: HQ, name: "Sabi Test General Hospital", code: "HQ", isHeadquarters: true, address: "", lga: "", state: "Lagos", country: "Nigeria", version: 1 }],
  departments: [{ id: "d1", name: "Nursing", code: "NURS", description: null, companyIds: [HQ], status: "Active", hodId: "e1", deputyHodId: null, staffIds: ["e1"], parentDepartmentId: null, createdAt: "2026-10-01T00:00:00.000Z", version: 2 }],
  hodChanges: [], jobPositions: [], jobRoles: [], employeeTypes: [{ id: "t1", name: "Permanent" }], tags: [],
  employees: [{ id: "e1", userId: "u1", name: "Grace Nwangbo", role: "Nurse", cadre: "Nursing Officer I", phone: null, email: "grace@hospital.test", hireDate: "2024-03-01", license: null, status: "ACTIVE", companyId: HQ, departmentId: "d1", tagIds: [], version: 3 }],
  documents: [], actionTypes: [], disciplinaryActions: [], notes: [], bonusPoints: [], qualifications: [], policies: [],
};

const signIn = (permissions: string[]) => useLiveEmr.setState({
  status: "ready", error: "", user: { id: "u9", name: "HR Officer", email: "hr@hospital.test", role: "HR Officer" },
  access: { organizationId: "11111111-1111-4111-8111-111111111111", facilityId: "f1", organizationName: "Sabi Test General Hospital", roles: ["HR_OFFICER"], permissions, clinicalApiConnected: true, patientRegistryEnabled: true } as never,
});

beforeEach(() => {
  api.workforceRequest.mockReset();
  api.orgConfigRequest.mockReset();
  api.orgConfigRequest.mockImplementation(async (path: string) => ({ data: path === "/modules"
    ? { package: null, products: { emr: true, workforce: true, accounting: false }, modules: [], disabled: [], version: 1, editable: false }
    : { data: {}, terms: { overrides: {}, version: 1 }, templates: [], letters: [] } }));
  api.workforceRequest.mockImplementation(async (path: string) => (path === "/people" ? { data: people } : path === "/people/employees/import-members" ? { data: { imported: 4 } } : { data: {} }));
  useWorkforceSync.setState({ error: "", pending: 0 });
});
afterEach(() => { cleanup(); useLiveEmr.setState({ status: "idle", access: null, user: null }); });

describe("live people & organization", () => {
  it("connects the people screens", () => {
    for (const path of ["/hr/employees", "/hr/employees/e1", "/hr/org-setup", "/hr/departments", "/hr/departments/d1", "/hr/org-chart"]) expect(liveRouteState(path, ["hr.read"])).toBe("connected");
  });

  it("fills the stores from the organization's records, replacing the demo people", async () => {
    signIn(["hr.read", "hr.manage"]);
    render(<LiveWorkforceSync />);
    await waitFor(() => expect(useHr.getState().staff).toEqual([expect.objectContaining({ id: "e1", name: "Grace Nwangbo", status: "Active", username: "grace" })]));
    expect(useOrg.getState().departments).toEqual([expect.objectContaining({ id: "d1", hodId: "e1", staffIds: ["e1"] })]);
    expect(useEmployees.getState().profiles[0]).toMatchObject({ id: "e1", departmentId: "d1", companyId: HQ });
  });

  it("writes changes to the Workforce API in order, with the id the screen uses", async () => {
    signIn(["hr.read", "hr.manage"]);
    render(<LiveWorkforceSync />);
    await waitFor(() => expect(useHr.getState().staff).toHaveLength(1));
    const id = useOrg.getState().addDepartment({ name: "Pharmacy", code: "PHAR", companyIds: [HQ] });
    expect(useOrg.getState().departments.find((d) => d.id === id)).toMatchObject({ name: "Pharmacy" }); // shown at once
    useOrg.getState().changeHod("d1", "hod", undefined, { effectiveDate: "2026-10-20T00:00:00.000Z", reason: "Leave" });
    useEmployees.getState().upsertProfile("e1", { reportingManagerId: "e9", dateJoining: "2024-03-01T00:00:00.000Z" });
    await waitFor(() => expect(api.workforceRequest).toHaveBeenCalledWith("/people/employees/e1", { method: "PATCH", version: 3, body: { reportingManagerId: "e9", dateJoining: "2024-03-01" } }));
    const calls = api.workforceRequest.mock.calls.filter(([, o]) => o?.method).map(([path]) => path);
    expect(calls).toEqual(["/people/departments", "/people/departments/d1/leader", "/people/employees/e1"]);
    expect(api.workforceRequest.mock.calls.find(([p]) => p === "/people/departments")?.[1].body).toMatchObject({ id, name: "Pharmacy", code: "PHAR" });
    expect(api.workforceRequest.mock.calls.find(([p]) => p === "/people/departments/d1/leader")?.[1]).toMatchObject({ version: 2, body: { role: "hod", employeeId: null, effectiveDate: "2026-10-20", reason: "Leave" } });
  });

  it("reports a refused change and shows no demo staff to roles without HR access", async () => {
    signIn(["hr.read", "hr.manage"]);
    api.workforceRequest.mockImplementation(async (path: string, o?: { method?: string }) => {
      if (o?.method) throw Object.assign(new Error("That code or name is already in use."), { status: 409 });
      return { data: people };
    });
    render(<LiveWorkforceSync />);
    await waitFor(() => expect(useHr.getState().staff).toHaveLength(1));
    useOrg.getState().addDepartment({ name: "Nursing again", code: "NURS", companyIds: [HQ] });
    expect(await screen.findByRole("alert")).toHaveTextContent("already in use");
    await waitFor(() => expect(useOrg.getState().departments).toHaveLength(1)); // reload put it back
    cleanup();
    signIn(["patient.read"]);
    render(<LiveWorkforceSync />);
    await waitFor(() => expect(useHr.getState().staff).toEqual([]));
  });

  it("adds the organization's Sabi ID members from the directory", async () => {
    signIn(["hr.read", "hr.manage"]);
    render(<MemoryRouter><LiveWorkforceSync /><EmployeeDirectory /></MemoryRouter>);
    expect(await screen.findByText(/people on record · Sabi Test General Hospital/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Add Sabi ID members/ }));
    expect(await screen.findByText("Added 4 members as employees.")).toBeInTheDocument();
  });
});
