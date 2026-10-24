import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/config/runtime", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/config/runtime")>()), apiBaseUrl: "https://api.test", apiConfigured: true }));
const api = vi.hoisted(() => ({ workforceRequest: vi.fn() }));
vi.mock("@/emr-live/client", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/emr-live/client")>()), workforceRequest: api.workforceRequest }));

import Payroll from "@/pages/hr/Payroll";
import { usePayroll } from "@/store/usePayroll";
import { useHr } from "@/store/useHr";
import { liveRouteState } from "@/emr-live/routes";
import { useLiveEmr } from "@/emr-live/session";
import { LiveWorkforceSync } from "./LiveWorkforceSync";
import { useLivePayrollMeta } from "./payroll";
import { useWorkforceSync } from "./sync";

const payroll = {
  salaryStructures: [{ id: "ss1", employeeId: "e1", basicSalary: 180000, allowances: [{ name: "Housing", amount: 40000 }], deductions: [], effectiveFrom: "2026-10-01T00:00:00.000Z" }],
  payslips: [{ id: "ps1", employeeId: "e1", batch: "Nov 2026", startDate: "2026-11-01", endDate: "2026-11-30", basicSalary: 180000, allowances: [], deductions: [], grossPay: 220000, totalDeductions: 0, netPay: 220000, status: "Review Ongoing", generatedByMe: false }],
  contracts: [], loans: [], loanPayments: [], escalationLetters: [], loanEligibilityTiers: [], reimbursements: [],
};
const people = {
  companies: [], departments: [], hodChanges: [], jobPositions: [], jobRoles: [], employeeTypes: [], tags: [], documents: [], actionTypes: [], disciplinaryActions: [], notes: [], bonusPoints: [], qualifications: [], policies: [],
  employees: [{ id: "e1", userId: "u1", name: "Grace Nwangbo", role: "Nurse", cadre: "", phone: null, email: null, hireDate: "2024-03-01", license: null, status: "ACTIVE", companyId: null, tagIds: [], version: 1 }],
};

beforeEach(() => {
  vi.stubGlobal("IntersectionObserver", class { observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } });
  api.workforceRequest.mockReset();
  api.workforceRequest.mockImplementation(async (path: string) => (path === "/payroll" ? { data: payroll } : path === "/people" ? { data: people } : { data: {} }));
  useWorkforceSync.setState({ error: "", pending: 0 });
  useLiveEmr.setState({
    status: "ready", error: "", user: { id: "u9", name: "Ngozi Eze", email: "finance@hospital.test", role: "Finance Officer" },
    access: { organizationId: "11111111-1111-4111-8111-111111111111", facilityId: "f1", organizationName: "Sabi Test General Hospital", roles: ["FINANCE_OFFICER"], permissions: ["payroll.read", "payroll.manage", "hr.read"], clinicalApiConnected: true, patientRegistryEnabled: true } as never,
  });
});
afterEach(() => { cleanup(); useLiveEmr.setState({ status: "idle", access: null, user: null }); });
const writes = () => api.workforceRequest.mock.calls.filter(([, o]) => o?.method).map(([p, o]) => [p, o.method, o.body]);

describe("live payroll", () => {
  it("is connected for payroll staff only", () => {
    expect(liveRouteState("/hr/payroll", ["payroll.read"])).toBe("connected");
    expect(liveRouteState("/hr/payroll", ["hr.read", "hr.manage"])).toBe("no-permission");
  });

  it("shows the organization's payslips and sends payroll actions to the API", async () => {
    render(<LiveWorkforceSync />);
    await waitFor(() => expect(useLivePayrollMeta.getState().loaded).toBe(true));
    await waitFor(() => expect(useHr.getState().staff).toHaveLength(1));
    render(<MemoryRouter><Payroll /></MemoryRouter>);
    expect((await screen.findAllByText(/Nov 2026/)).length).toBeGreaterThan(0);
    usePayroll.getState().confirmBatch("Nov 2026");
    usePayroll.getState().runBatch("Dec 2026", "2026-12-01T00:00:00.000Z", "2026-12-31T00:00:00.000Z", ["e1"]);
    usePayroll.getState().setStructure("e1", 200000, [], [{ name: "Pension", amount: 16000 }]);
    usePayroll.getState().decideReimbursement("r1", "Paid");
    await waitFor(() => expect(writes()).toHaveLength(4));
    expect(writes()).toEqual([
      ["/payroll/batches/confirm", "POST", { batch: "Nov 2026" }],
      ["/payroll/batches", "POST", { batch: "Dec 2026", startDate: "2026-12-01", endDate: "2026-12-31", employeeIds: ["e1"] }],
      ["/payroll/structures/e1", "PUT", { basicSalary: 200000, allowances: [], deductions: [{ name: "Pension", amount: 16000 }] }],
      ["/payroll/reimbursements/r1/decide", "POST", { status: "Paid" }],
    ]);
  });
});
