import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/config/runtime", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/config/runtime")>()), apiBaseUrl: "https://api.test", apiConfigured: true }));
const api = vi.hoisted(() => ({ accountingRequest: vi.fn(), accountingDownload: vi.fn(), workforceRequest: vi.fn(), orgConfigRequest: vi.fn() }));
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
import { emailStatementNow, loadReceivables, sendRemindersNow, useLiveARMeta } from "./receivables";
import { useLiveAcctSettingsMeta } from "./settings";
import { customerStatementPdf, emailInvoiceNow, loadStatement } from "./documents";
import { PortalLinks } from "@/pages/accounting/_portalLinks";
import Payers from "@/pages/accounting/Payers";
import { usePayers } from "./payers";

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
    // an issued invoice offers its PDF and emailing; a draft only its PDF
    screen.getByText("INV-2026-000003").click();
    expect(await screen.findByRole("button", { name: /Email invoice/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Open PDF/ })).toBeInTheDocument();
    cleanup();
    render(<MemoryRouter><Customers /></MemoryRouter>);
    // the statement in live mode is the server's, from the receivable ledger
    api.accountingRequest.mockImplementation(async (path: string) => ({ data: path.includes("/statement") ? { party: { id: C, name: "Hygeia HMO", email: "claims@hygeia.test" }, from: "2026-07-01T00:00:00.000Z", to: "2026-10-24T23:59:59.999Z", currency: "NGN", openingBalance: 500000, closingBalance: 715000, totalDebits: 215000, totalCredits: 0, lines: [{ date: "2026-09-01T12:00:00.000Z", reference: "INV-2026-000003", description: "Invoice INV-2026-000003 — Hygeia HMO", debit: 215000, credit: 0, balance: 715000 }], open: [], aging: [{ label: "Current", amount: 715000 }] } : path === "/settings" ? settings : receivables }));
    await screen.findByText("claims@hygeia.test");
    document.querySelector<HTMLButtonElement>("tr button.btn-ghost")!.click(); // the row's statement (print) button
    expect(await screen.findByText("Invoice INV-2026-000003 — Hygeia HMO")).toBeInTheDocument();
    expect(screen.getAllByText("₦715,000.00").length).toBeGreaterThan(0);
    expect(api.accountingRequest).toHaveBeenCalledWith(expect.stringMatching(new RegExp(`^/receivables/customers/${C}/statement\\?from=`)));
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

  it("issues a brand-new invoice straight away (Save & issue), checking credit on what was sent", async () => {
    await ready();
    const AR = useAR.getState();
    const limit = (creditLimit: number) => useAR.setState((st) => ({ customers: st.customers.map((c) => ({ ...c, creditLimit })) }));
    // no limit: created, then issued behind it
    limit(0);
    const small = AR.createInvoice({ customerId: C, date: "2026-10-21T12:00:00.000Z", lines: [{ ...line, qty: 1, taxRateId: "tax-vat-exempt" }] });
    expect(AR.issueInvoice(small)).toMatchObject({ ok: true });
    // over a 100,000 limit (215,000 already owed): refused before anything is issued
    limit(100000);
    const big = AR.createInvoice({ customerId: C, date: "2026-10-21T12:00:00.000Z", lines: [line] });
    expect(AR.issueInvoice(big)).toMatchObject({ ok: false, error: expect.stringMatching(/limit/) });
    await waitFor(() => expect(writes().map(([p]) => p)).toEqual(["/receivables/invoices", `/receivables/invoices/${small}/issue`, "/receivables/invoices"]));
  });

  it("says plainly whether reminders and statements were emailed", async () => {
    await ready();
    const reply = (data: unknown) => async (path: string, o?: { method?: string }) => (o?.method ? { data } : { data: path === "/settings" ? settings : path === "/receivables" ? receivables : {} });
    api.accountingRequest.mockImplementation(reply({ sent: 3, emailed: 2, notEmailed: 1 }));
    expect(await sendRemindersNow()).toBe("3 reminders recorded: 2 emailed, 1 not emailed (no email address on file, or email isn't set up).");
    api.accountingRequest.mockImplementation(reply({ to: "claims@hygeia.test", delivery: { status: "QUEUED" } }));
    expect(await emailStatementNow(C)).toBe("Statement emailed to claims@hygeia.test, with the PDF attached.");
    api.accountingRequest.mockImplementation(reply({ to: "claims@hygeia.test", delivery: { status: "NOT_SENT", reason: "EMAIL_NOT_CONFIGURED" } }));
    expect(await emailStatementNow(C)).toBe("Statement recorded, not emailed — email isn't set up for this deployment.");
    expect(writes()).toContainEqual([`/receivables/customers/${C}/statement`, "POST", {}]);
    await emailStatementNow(C, { from: "2026-07-01", to: "2026-09-30" });
    expect(writes()).toContainEqual([`/receivables/customers/${C}/statement`, "POST", { from: "2026-07-01", to: "2026-09-30" }]);
  });

  it("emails invoices with their PDF, reads statements from the server and downloads PDFs with the session", async () => {
    await ready();
    const reply = (data: unknown) => async (path: string, o?: { method?: string }) => (o?.method ? { data } : { data: path === "/settings" ? settings : path === "/receivables" ? receivables : { party: { id: C }, lines: [] } });
    api.accountingRequest.mockImplementation(reply({ to: "accounts@hygeia.test", delivery: { status: "QUEUED" } }));
    expect(await emailInvoiceNow("inv-1", "accounts@hygeia.test")).toBe("Invoice emailed to accounts@hygeia.test, with the PDF attached.");
    expect(writes()).toContainEqual(["/receivables/invoices/inv-1/email", "POST", { to: "accounts@hygeia.test" }]);
    api.accountingRequest.mockImplementation(reply({ to: "c@x.test", delivery: { status: "NOT_SENT", reason: "EMAIL_NOT_CONFIGURED" } }));
    expect(await emailInvoiceNow("inv-1")).toBe("Invoice recorded, not emailed — email isn't set up for this deployment.");
    expect(writes()).toContainEqual(["/receivables/invoices/inv-1/email", "POST", {}]);
    await loadStatement("vendor", "v-1", { from: "2026-01-01" });
    expect(api.accountingRequest).toHaveBeenCalledWith("/payables/vendors/v-1/statement?from=2026-01-01");
    // the PDF is fetched with the session's credentials and saved, never opened from a token in a URL
    const created = vi.fn(() => "blob:statement"); const revoked = vi.fn();
    Object.assign(URL, { createObjectURL: created, revokeObjectURL: revoked });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    api.accountingDownload.mockResolvedValue({ blob: new Blob(["%PDF-"]), filename: "Statement-Hygeia.pdf" });
    expect(await customerStatementPdf(C, { from: "2026-07-01", to: "2026-09-30" })).toBe("");
    expect(api.accountingDownload).toHaveBeenCalledWith(`/receivables/customers/${C}/statement?format=pdf&from=2026-07-01&to=2026-09-30`);
    expect(click).toHaveBeenCalled();
    api.accountingDownload.mockRejectedValue(Object.assign(new Error("Customer not found."), { status: 404 }));
    expect(await customerStatementPdf(C)).toBe("Customer not found.");
    click.mockRestore();
  });

  it("creates a portal link, shows it once, emails it to the customer and revokes it", async () => {
    let items: unknown[] = [];
    api.accountingRequest.mockImplementation(async (path: string, o?: { method?: string; body?: { email?: boolean } }) => {
      if (path.startsWith("/portal-links?")) return { data: { items } };
      if (path === "/portal-links") { items = [{ id: "pl1", createdAt: "2026-10-24T10:00:00.000Z", createdBy: "Ngozi Eze", expiresAt: "2026-11-23T10:00:00.000Z", useCount: 0, status: "Active" }]; return { data: { url: "https://app.test/portal/abc", ...(o?.body?.email ? { delivery: { status: "QUEUED" } } : {}) } }; }
      if (path === "/portal-links/pl1/revoke") { items = [{ ...(items[0] as object), status: "Revoked" }]; return { data: {} }; }
      return { data: {} };
    });
    render(<PortalLinks partyKind="customer" partyId={C} email="claims@hygeia.test" />);
    (await screen.findByRole("button", { name: /Email link to claims@hygeia.test/ })).click();
    expect(await screen.findByDisplayValue("https://app.test/portal/abc")).toBeInTheDocument();
    expect(screen.getByText("Link emailed to claims@hygeia.test.")).toBeInTheDocument();
    expect(writes()).toContainEqual(["/portal-links", "POST", { partyKind: "customer", partyId: C, days: 30, email: true }]);
    (await screen.findByRole("button", { name: /Revoke/ })).click();
    expect(await screen.findByText("Revoked")).toBeInTheDocument();
  });

  it("bills a patient's invoice to their HMO from the claims page, and reloads the payers", async () => {
    await ready();
    const H = "00000000-0000-4000-8000-0000000000c9";
    const withHmo = { ...receivables, customers: [...receivables.customers.map((c) => ({ ...c, type: "Patient", arAccountNumber: 1100 })), { ...receivables.customers[0], id: H, name: "Reliance HMO", type: "HMO", arAccountNumber: 1120 }] };
    const overview = { payers: [{ id: H, name: "Reliance HMO", type: "HMO" }], transfers: [], claims: [], capitations: [], writeOffs: [], creditLossRuns: [], allowance: 0, bands: ["Current", "1-30 days", "31-60 days", "61-90 days", "Over 90 days"], defaultLossRates: { patient: [2, 5, 15, 30, 60], payer: [1, 2, 5, 15, 35] } };
    api.accountingRequest.mockImplementation(async (path: string, o?: { method?: string }) => ({ data: o?.method ? { id: "t1", payerInvoiceNumber: "INV-2026-000009" } : path === "/settings" ? settings : path === "/receivables" ? withHmo : path === "/receivables/payers" ? overview : {} }));
    await loadReceivables();
    render(<MemoryRouter><Payers /></MemoryRouter>);
    await waitFor(() => expect(usePayers.getState().payers).toHaveLength(1));
    (await screen.findAllByRole("button", { name: /Bill payer/ }))[0].click();
    await screen.findByText(/Bill all or part of it to their payer/);
    (await screen.findAllByRole("button", { name: /Bill payer/ })).at(-1)!.click(); // the dialog's
    expect(await screen.findByText("Billed: payer invoice INV-2026-000009.")).toBeInTheDocument();
    expect(writes()).toContainEqual(["/receivables/invoices/i1/bill-payer", "POST", expect.objectContaining({ payerId: H, amount: 215000 })]);
  });
});
