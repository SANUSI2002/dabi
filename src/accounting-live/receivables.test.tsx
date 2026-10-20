import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/config/runtime", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/config/runtime")>()), apiBaseUrl: "https://api.test", apiConfigured: true }));
const api = vi.hoisted(() => ({ accountingRequest: vi.fn(), workforceRequest: vi.fn(), orgConfigRequest: vi.fn() }));
vi.mock("@/emr-live/client", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/emr-live/client")>()), ...api }));

import Customers from "@/pages/accounting/Customers";
import Estimates from "@/pages/accounting/Estimates";
import SalesOrders from "@/pages/accounting/SalesOrders";
import Invoices from "@/pages/accounting/Invoices";
import CustomerReceipts from "@/pages/accounting/CustomerReceipts";
import CreditNotes from "@/pages/accounting/CreditNotes";
import SalesReceipts from "@/pages/accounting/SalesReceipts";
import DelayedCharges from "@/pages/accounting/DelayedCharges";
import { useAR } from "@/store/accounting/useAR";
import { useTax } from "@/store/accounting/useTax";
import { useAccountingSettings } from "@/store/accounting/useAccountingSettings";
import { useLiveEmr } from "@/emr-live/session";
import { LiveWorkforceSync } from "@/workforce-live/LiveWorkforceSync";
import { useWorkforceSync } from "@/workforce-live/sync";
import { useLiveARMeta } from "./receivables";
import { useLiveAcctSettingsMeta } from "./settings";

const C = "00000000-0000-4000-8000-0000000000c1";
const settings = {
  org: { legalName: "Sabi Test General Hospital Ltd", tradingName: "", tin: "", rcNumber: "", address: "", reportingCurrency: "NGN", fiscalYearStartMonth: 1 },
  sequences: [{ key: "invoice", label: "Sales Invoice", prefix: "INV-", padding: 6, next: 4 }], paymentTerms: [{ id: "pt-net30", name: "Net 30", netDays: 30, eom: false, active: true }],
  reminderRules: [{ id: "rr-1", level: 1, daysOverdue: 3, tone: "Friendly", subject: "s", body: "b", active: true }], taxRegistration: { vatTin: "", wht: false, payeStateId: "", vatRegistered: false },
  setup: { steps: {} }, version: 2,
  taxRates: [{ id: "tax-vat-standard", name: "VAT 7.5%", kind: "VAT", rate: 7.5, accountNumber: 2200, isCompound: false, isActive: true, version: 1 }, { id: "tax-vat-exempt", name: "VAT Exempt", kind: "Exempt", rate: 0, accountNumber: 2200, isCompound: false, isActive: true, version: 1 }],
};
const line = { id: "l1", accountNumber: 4010, description: "Lab panel", qty: 10, unitPrice: 20000, taxRateId: "tax-vat-standard" };
const receivables = {
  customers: [{ id: C, name: "Hygeia HMO", type: "HMO", email: "claims@hygeia.test", arAccountNumber: 1120, currency: "NGN", paymentTermsDays: 30, creditLimit: 100000, creditHold: false, openingBalance: 0, createdAt: "2026-10-01T00:00:00.000Z", version: 3 }],
  estimates: [], salesOrders: [], receipts: [], creditNotes: [], salesReceipts: [], refundReceipts: [], revenueSchedules: [], delayedCharges: [], reminders: [], statementLog: [],
  invoices: [
    { id: "i1", number: "INV-2026-000003", customerId: C, date: "2026-09-01T12:00:00.000Z", dueDate: "2026-10-01T12:00:00.000Z", lines: [line], status: "Overdue", amountPaid: 0, currency: "NGN", exchangeRate: 1, createdBy: "Ngozi", createdAt: "2026-09-01T12:00:00.000Z", source: "Manual", version: 2 },
    { id: "i2", number: "Draft", customerId: C, date: "2026-10-20T12:00:00.000Z", dueDate: "2026-11-19T12:00:00.000Z", lines: [line], status: "Draft", amountPaid: 0, currency: "NGN", exchangeRate: 1, createdBy: "Ngozi", createdAt: "2026-10-20T12:00:00.000Z", source: "Manual", version: 1 },
  ],
};

beforeEach(() => {
  vi.stubGlobal("IntersectionObserver", class { observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } });
  for (const fn of Object.values(api)) fn.mockReset();
  api.accountingRequest.mockImplementation(async (path: string) => ({ data: path === "/settings" ? settings : path === "/receivables" ? receivables : {} }));
  api.workforceRequest.mockResolvedValue({ data: {} });
  api.orgConfigRequest.mockResolvedValue({ data: {} });
  useWorkforceSync.setState({ error: "", pending: 0 });
  useLiveEmr.setState({
    status: "ready", error: "", user: { id: "u1", name: "Ngozi Eze", email: "finance@hospital.test", role: "Finance Officer" },
    access: { organizationId: "11111111-1111-4111-8111-111111111111", facilityId: "f1", organizationName: "Sabi Test General Hospital", roles: ["FINANCE_OFFICER"], permissions: ["acct.view", "acct.post"], clinicalApiConnected: true, patientRegistryEnabled: true } as never,
  });
});
afterEach(() => { cleanup(); useLiveEmr.setState({ status: "idle", access: null, user: null }); });
const writes = () => api.accountingRequest.mock.calls.filter(([, o]) => o?.method).map(([p, o]) => [p, o.method, o.body]);
const ready = async () => { render(<LiveWorkforceSync />); await waitFor(() => expect(useLiveARMeta.getState().loaded && useLiveAcctSettingsMeta.getState().loaded).toBe(true)); };

describe("live receivables", () => {
  it("opens every sales screen with the organization's customers, documents and tax rates", async () => {
    await ready();
    expect(useTax.getState().rates.map((r) => r.id)).toEqual(["tax-vat-standard", "tax-vat-exempt"]);
    expect(useAccountingSettings.getState().org.legalName).toBe("Sabi Test General Hospital Ltd");
    expect(useAR.getState().customerBalance(C)).toBe(215000); // 200,000 + VAT
    for (const Screen of [Customers, Estimates, SalesOrders, CustomerReceipts, CreditNotes, SalesReceipts, DelayedCharges]) {
      const { unmount } = render(<MemoryRouter><Screen /></MemoryRouter>);
      unmount();
    }
    render(<MemoryRouter><Invoices /></MemoryRouter>);
    expect(await screen.findByText("INV-2026-000003")).toBeInTheDocument();
  });

  it("checks credit before issuing, and sends documents to the API", async () => {
    await ready();
    const AR = useAR.getState();
    expect(AR.issueInvoice("i2")).toMatchObject({ ok: false, error: expect.stringMatching(/against a 100,000 limit/) });
    expect(AR.issueInvoice("i2", { overrideCredit: true })).toMatchObject({ ok: false, error: expect.stringMatching(/approval rights/) }); // an accountant cannot override
    const id = AR.createInvoice({ customerId: C, date: "2026-10-21T12:00:00.000Z", lines: [line] });
    expect(AR.sendReminder("i1")).toMatchObject({ ok: true, level: 1 });
    expect(AR.recordReceipt({ customerId: C, date: "2026-10-21T12:00:00.000Z", method: "Bank Transfer", depositAccountNumber: 1010, amount: 215000, allocations: [{ invoiceId: "i1", amount: 215000 }] }).ok).toBe(true);
    await waitFor(() => expect(writes()).toHaveLength(3));
    expect(writes()).toEqual([
      ["/receivables/invoices", "POST", { id, customerId: C, date: "2026-10-21T12:00:00.000Z", lines: [line] }],
      ["/receivables/invoices/i1/reminder", "POST", {}],
      ["/receivables/receipts", "POST", { id: expect.any(String), customerId: C, date: "2026-10-21T12:00:00.000Z", method: "Bank Transfer", depositAccountNumber: 1010, amount: 215000, allocations: [{ invoiceId: "i1", amount: 215000 }] }],
    ]);
  });
});
