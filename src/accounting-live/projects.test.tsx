import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/config/runtime", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/config/runtime")>()), apiBaseUrl: "https://api.test", apiConfigured: true }));
const api = vi.hoisted(() => ({ accountingRequest: vi.fn(), workforceRequest: vi.fn(), orgConfigRequest: vi.fn() }));
vi.mock("@/emr-live/client", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/emr-live/client")>()), ...api }));

import Projects from "@/pages/accounting/Projects";
import Notifications from "@/pages/accounting/Notifications";
import { useProjects } from "@/store/accounting/useProjects";
import { useNotifications } from "@/store/accounting/useNotifications";
import { useIdentity } from "@/store/useIdentity";
import { useLiveEmr } from "@/emr-live/session";
import { LiveWorkforceSync } from "@/workforce-live/LiveWorkforceSync";
import { useWorkforceSync } from "@/workforce-live/sync";
import { useLiveProjectsMeta } from "./projects";
import { useLiveAPMeta } from "./payables";
import { useLiveLedgerMeta } from "./ledger";

const V = "00000000-0000-4000-8000-0000000000a1";
const ledger = { accounts: [], branches: [], consolidationGroups: [], fiscalYears: [], periods: [], booksLockedBefore: null, fxRates: [], settingsVersion: 1, recurringJournals: [], yearEndClosings: [], approvalRules: [], entries: [] };
const pending = (mine: boolean) => ({ status: "Pending", currentLevel: 1, steps: [{ level: 1, approverRole: "Approver", decision: "Pending" }], submittedByMe: false, decidableByMe: mine });
const line = { id: "l1", accountNumber: 5230, description: "Service", qty: 1, unitPrice: 900000, taxRateId: "tax-vat-exempt" };
const bill = (id: string, mine: boolean) => ({ id, number: `BILL-${id}`, vendorId: V, date: "2026-10-19T12:00:00.000Z", dueDate: "2026-12-18T12:00:00.000Z", lines: [line], status: "Pending Approval", approval: pending(mine), amountPaid: 0, currency: "NGN", exchangeRate: 1, createdBy: "Tunde", createdAt: "2026-10-19T12:00:00.000Z", version: 1 });
const payables = {
  vendors: [{ id: V, name: "Emzor", category: "Pharmaceuticals", paymentTermsDays: 30, apAccountNumber: 2000, openingBalance: 0, active: true, createdAt: "2026-10-01T00:00:00.000Z", version: 1 }],
  requisitions: [], purchaseOrders: [], goodsReceipts: [], vendorPayments: [], vendorCredits: [], bills: [bill("b1", true), bill("b2", false)],
};
const projects = {
  projects: [{ id: "p1", code: "OCC-01", name: "Occupational health", customerId: "c1", status: "Active", startDate: "2026-10-01T00:00:00.000Z", billable: true, createdBy: "Ngozi", createdAt: "2026-10-01T00:00:00.000Z", version: 2 }],
  timeEntries: [{ id: "t1", projectId: "p1", staffId: "e1", date: "2026-10-10T00:00:00.000Z", hours: 3, description: "Screening", billable: true, rate: 20000, revenueAccount: 4000, status: "Unbilled", createdAt: "2026-10-10T00:00:00.000Z" }],
  notificationPrefs: { approvalPending: true, invoiceOverdue: true, billDueSoon: true, lowStock: true, budgetExceeded: true, largeJournal: false },
};

beforeEach(() => {
  vi.stubGlobal("IntersectionObserver", class { observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } });
  for (const fn of Object.values(api)) fn.mockReset();
  api.accountingRequest.mockImplementation(async (path: string) => ({ data: ({ "/ledger": ledger, "/payables": payables, "/projects": projects } as Record<string, unknown>)[path] ?? {} }));
  api.workforceRequest.mockResolvedValue({ data: {} });
  api.orgConfigRequest.mockResolvedValue({ data: {} });
  useWorkforceSync.setState({ error: "", pending: 0 });
  useLiveEmr.setState({
    status: "ready", error: "", user: { id: "u1", name: "Ngozi Eze", email: "finance@hospital.test", role: "Finance Officer" },
    access: { organizationId: "11111111-1111-4111-8111-111111111111", facilityId: "f1", organizationName: "Sabi Test General Hospital", roles: ["HOSPITAL_ADMIN"], permissions: ["acct.view", "acct.approve"], clinicalApiConnected: true, patientRegistryEnabled: true } as never,
  });
});
afterEach(() => { cleanup(); useLiveEmr.setState({ status: "idle", access: null, user: null }); });
const writes = () => api.accountingRequest.mock.calls.filter(([, o]) => o?.method).map(([p, o]) => [p, o.method, o.body]);
const ready = async () => {
  render(<LiveWorkforceSync />);
  await waitFor(() => expect(useLiveProjectsMeta.getState().loaded && useLiveAPMeta.getState().loaded && useLiveLedgerMeta.getState().loaded).toBe(true));
};

describe("live projects and notifications", () => {
  it("opens Projects with the organization's projects and time", async () => {
    await ready();
    expect(useProjects.getState().unbilledTimeOf("p1").map((t) => t.id)).toEqual(["t1"]);
    render(<MemoryRouter><Projects /></MemoryRouter>);
  });

  it("alerts only on approvals the server says are mine", async () => {
    await ready();
    const alerts = useNotifications.getState().alerts();
    expect(alerts.filter((a) => a.key === "approvalPending").map((a) => a.id)).toEqual(["ap-b1"]);
    expect(alerts.some((a) => a.key === "lowStock")).toBe(false); // the hospital's stores are empty here
    render(<MemoryRouter><Notifications /></MemoryRouter>);
  });

  it("saves the signed-in user's preferences", async () => {
    await ready();
    useNotifications.getState().setPref("largeJournal", true);
    expect(useNotifications.getState().prefsFor(useIdentity.getState().user.id).largeJournal).toBe(true);
    await waitFor(() => expect(writes()).toEqual([["/notification-prefs", "PUT", { ...projects.notificationPrefs, largeJournal: true }]]));
    // email alerts: the same preferences, with the digest switched on
    useNotifications.getState().setEmailDigest(true);
    await waitFor(() => expect(writes()).toContainEqual(["/notification-prefs", "PUT", expect.objectContaining({ emailDigest: true })]));
    render(<MemoryRouter><Notifications /></MemoryRouter>);
    expect(screen.getByLabelText(/Also email me these alerts/)).toBeInTheDocument();
  });
});
