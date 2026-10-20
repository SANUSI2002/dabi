import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/config/runtime", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/config/runtime")>()), apiBaseUrl: "https://api.test", apiConfigured: true }));
const api = vi.hoisted(() => ({ accountingRequest: vi.fn(), workforceRequest: vi.fn(), orgConfigRequest: vi.fn() }));
vi.mock("@/emr-live/client", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/emr-live/client")>()), ...api }));

import Vendors from "@/pages/accounting/Vendors";
import PurchaseRequisitions from "@/pages/accounting/PurchaseRequisitions";
import PurchaseOrders from "@/pages/accounting/PurchaseOrders";
import GoodsReceipts from "@/pages/accounting/GoodsReceipts";
import Bills from "@/pages/accounting/Bills";
import VendorPayments from "@/pages/accounting/VendorPayments";
import VendorCredits from "@/pages/accounting/VendorCredits";
import { useAP } from "@/store/accounting/useAP";
import { useAcctControl } from "@/store/accounting/useAcctControl";
import { useLiveEmr } from "@/emr-live/session";
import { LiveWorkforceSync } from "@/workforce-live/LiveWorkforceSync";
import { useWorkforceSync } from "@/workforce-live/sync";
import { useLiveAPMeta } from "./payables";
import { useLiveLedgerMeta } from "./ledger";

const V = "00000000-0000-4000-8000-0000000000a1";
const line = { id: "l1", accountNumber: 1200, description: "Artemether-lumefantrine", qty: 500, unitPrice: 3000, taxRateId: "tax-vat-exempt" };
const pending = (mine: boolean) => ({ status: "Pending", currentLevel: 1, steps: [{ level: 1, approverRole: "Approver", decision: "Pending" }], submittedBy: "Ngozi Eze", submittedByMe: mine, decidableByMe: !mine });
const ledger = {
  accounts: [], branches: [], consolidationGroups: [], fiscalYears: [], periods: [], booksLockedBefore: null, fxRates: [], settingsVersion: 1, entries: [], recurringJournals: [], yearEndClosings: [],
  approvalRules: [{ id: "r1", docType: "Bill", minAmount: 500000, maxAmount: 3000000, approverRole: "Accountant", level: 1, active: true, version: 4 }],
};
const payables = {
  vendors: [{ id: V, name: "Emzor Pharmaceuticals", category: "Pharmaceuticals", paymentTermsDays: 30, apAccountNumber: 2000, openingBalance: 250000, active: true, createdAt: "2026-10-01T00:00:00.000Z", version: 2, email: null }],
  requisitions: [{ id: "pr1", number: "PR-2026-000001", requestedBy: "Ngozi Eze", date: "2026-10-18T12:00:00.000Z", lines: [line], justification: "Malaria season", status: "Pending Approval", approval: pending(true), createdAt: "2026-10-18T12:00:00.000Z", version: 2 }],
  purchaseOrders: [], goodsReceipts: [], vendorPayments: [], vendorCredits: [],
  bills: [
    { id: "b1", number: "BILL-2026-000001", vendorId: V, date: "2026-10-19T12:00:00.000Z", dueDate: "2026-11-18T12:00:00.000Z", lines: [line], status: "Pending Approval", approval: pending(false), amountPaid: 0, currency: "NGN", exchangeRate: 1, createdBy: "Tunde", createdAt: "2026-10-19T12:00:00.000Z", version: 3 },
    { id: "b2", number: "Draft", vendorId: V, date: "2026-10-20T12:00:00.000Z", dueDate: "2026-11-19T12:00:00.000Z", lines: [{ ...line, qty: 0 }], status: "Draft", approval: { status: "Not Required", currentLevel: 0, steps: [] }, amountPaid: 0, currency: "NGN", exchangeRate: 1, createdBy: "Ngozi", createdAt: "2026-10-20T12:00:00.000Z", version: 1 },
  ],
};

beforeEach(() => {
  vi.stubGlobal("IntersectionObserver", class { observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } });
  for (const fn of Object.values(api)) fn.mockReset();
  api.accountingRequest.mockImplementation(async (path: string) => ({ data: path === "/ledger" ? ledger : path === "/payables" ? payables : {} }));
  api.workforceRequest.mockResolvedValue({ data: {} });
  api.orgConfigRequest.mockResolvedValue({ data: {} });
  useWorkforceSync.setState({ error: "", pending: 0 });
  useLiveEmr.setState({
    status: "ready", error: "", user: { id: "u1", name: "Ngozi Eze", email: "finance@hospital.test", role: "Finance Officer" },
    access: { organizationId: "11111111-1111-4111-8111-111111111111", facilityId: "f1", organizationName: "Sabi Test General Hospital", roles: ["FINANCE_OFFICER"], permissions: ["acct.view", "acct.post"], clinicalApiConnected: true, patientRegistryEnabled: true } as never,
  });
});
afterEach(() => { cleanup(); useLiveEmr.setState({ status: "idle", access: null, user: null }); });
const writes = () => api.accountingRequest.mock.calls.filter(([, o]) => o?.method).map(([p, o]) => [p, o.method, o.body, o.version]);
const ready = async () => { render(<LiveWorkforceSync />); await waitFor(() => expect(useLiveAPMeta.getState().loaded && useLiveLedgerMeta.getState().loaded).toBe(true)); };

describe("live payables", () => {
  it("opens every purchasing screen with the organization's vendors, documents and approval rules", async () => {
    await ready();
    expect(useAP.getState().vendors[0]).not.toHaveProperty("email"); // nulls dropped
    expect(useAcctControl.getState().rules.map((r) => r.id)).toEqual(["r1"]);
    for (const Screen of [Vendors, PurchaseRequisitions, PurchaseOrders, GoodsReceipts, VendorPayments, VendorCredits]) {
      const { unmount } = render(<MemoryRouter><Screen /></MemoryRouter>);
      unmount();
    }
    render(<MemoryRouter><Bills /></MemoryRouter>);
    expect(await screen.findByText("BILL-2026-000001")).toBeInTheDocument();
  });

  it("takes whether an approval is yours from the server, never your own submission", async () => {
    await ready();
    const { canDecide } = useAcctControl.getState();
    const AP = useAP.getState();
    expect(canDecide(AP.requisitions[0].approval)).toBe(false); // submitted by me
    expect(canDecide(AP.bills[0].approval)).toBe(true);
    AP.decideBill("b1", "Approved", "Checked against GRN");
    await waitFor(() => expect(writes()).toContainEqual(["/payables/bills/b1/decide", "POST", { decision: "Approved", comment: "Checked against GRN" }, undefined]));
  });

  it("checks locally first, then sends purchasing actions to the API", async () => {
    await ready();
    const AP = useAP.getState();
    expect(AP.postBill("b2")).toMatchObject({ ok: false, error: expect.stringMatching(/at least one line/) });
    expect(AP.payVendor({ vendorId: V, date: "2026-10-20", method: "Bank Transfer", fromAccountNumber: 1010, amount: 100, allocations: [{ billId: "b1", amount: 500 }] })).toMatchObject({ ok: false });
    expect(AP.convertRequisitionToPO("pr1", V)).toBeUndefined(); // not approved yet
    AP.updateVendor(V, { phone: "0803" });
    const id = AP.createBill({ vendorId: V, date: "2026-10-20T12:00:00.000Z", lines: [line] });
    await waitFor(() => expect(writes().length).toBe(2));
    expect(writes()).toContainEqual([`/payables/vendors/${V}`, "PATCH", { phone: "0803" }, 2]);
    expect(writes()).toContainEqual(["/payables/bills", "POST", expect.objectContaining({ id, vendorId: V, lines: [line] }), undefined]);
  });

  it("lets the rules be tuned and switched off, never deleted", async () => {
    await ready();
    useAcctControl.getState().removeRule("r1");
    await waitFor(() => expect(writes()).toContainEqual(["/approval-rules/r1", "PATCH", { active: false }, 4]));
  });
});
