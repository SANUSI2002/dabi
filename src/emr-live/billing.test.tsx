import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/config/runtime", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/config/runtime")>()), apiBaseUrl: "https://api.test", apiConfigured: true }));
const api = vi.hoisted(() => ({ emrRequest: vi.fn() }));
vi.mock("@/emr-live/client", async (importOriginal) => ({ ...(await importOriginal<typeof import("./client")>()), emrRequest: api.emrRequest }));

import Billing from "@/pages/admin/Billing";
import BillingInvoiceDetail from "@/pages/admin/BillingInvoiceDetail";
import { financialStatusFor, invoiceViewFromApi, rowFromApi, useLiveBilling, useLiveInvoice } from "./billing";
import { liveRouteState } from "./routes";
import { useLiveEmr } from "./session";

const ORG = "11111111-1111-4111-8111-111111111111";
const patient = { id: "p-1", medicalRecordNumber: "MRN-0000001", givenName: "Bisi", familyName: "Adeyemi", dateOfBirth: "1990-04-12", sex: "FEMALE" as const, phone: "+2348030000001", payer: null };
const charge = (extra: Record<string, unknown> = {}) => ({
  id: "c-1", encounterId: "e-1", patientId: "p-1", category: "CONSULTATION", description: "Consultation (outpatient)", quantity: 1, unitPriceMinor: 500_000,
  amountMinor: 500_000, taxMinor: 0, currency: "NGN", sourceType: "ENCOUNTER", sourceKey: "e-1", serviceAt: "2026-10-09T09:00:00.000Z", status: "UNBILLED",
  invoiceId: null, createdByName: "Ada Desk", createdAt: "2026-10-09T09:05:00.000Z", ...extra,
});
const invoice = (extra: Record<string, unknown> = {}) => ({
  id: "inv-1", number: "INV-2026-000007", status: "ISSUED", patientId: "p-1", encounterId: "e-1", currency: "NGN", subtotalMinor: 850_000, taxMinor: 0,
  discountMinor: 0, totalMinor: 850_000, amountPaidMinor: 0, balanceMinor: 850_000, dueDate: null, issuedAt: "2026-10-09T10:00:00.000Z", createdAt: "2026-10-09T10:00:00.000Z", version: 1, ...extra,
});
const encounter = { id: "e-1", class: "OUTPATIENT", status: "IN_PROGRESS", source: "DIRECT", visitType: null, arrivedAt: "2026-10-09T09:00:00.000Z", endedAt: null, attendingName: "Dr Tunde Bakare" };
const row = (extra: Record<string, unknown> = {}) => ({
  encounter, patient, charges: [charge(), charge({ id: "c-2", category: "LAB", description: "Full blood count", amountMinor: 350_000, unitPriceMinor: 350_000, sourceType: "LAB_ORDER_ITEM", sourceKey: "li-1" })],
  invoices: [], payments: [], unpriced: [{ category: "LAB", reference: "LIPID", description: "Lipid profile" }], ...extra,
});
type Row = Parameters<typeof rowFromApi>[0];
type Detail = Parameters<typeof invoiceViewFromApi>[0];

beforeEach(() => {
  api.emrRequest.mockReset();
  useLiveBilling.setState({ rows: [], totals: null, nextCursor: null, query: "", loaded: false, error: "" });
  useLiveInvoice.setState({ view: null, id: null, error: "" });
  useLiveEmr.setState({ status: "ready", error: "", user: { id: "u1", name: "Ada Desk", email: "desk@hospital.test", role: "Receptionist" },
    access: { organizationId: ORG, facilityId: "f1", organizationName: "Sabi Test General Hospital", roles: ["RECEPTIONIST"], permissions: ["billing.read", "billing.invoice.create", "billing.payment.record"], clinicalApiConnected: true, patientRegistryEnabled: true } as never });
});
afterEach(() => { cleanup(); useLiveEmr.setState({ status: "idle", access: null, user: null }); });

describe("live billing data", () => {
  it("turns a visit into a billing account with charges, status and missing prices", () => {
    const mapped = rowFromApi(row() as unknown as Row);
    expect(mapped.account).toMatchObject({ id: "e-1", encounterId: "e-1", visitType: "Outpatient", payer: "Out of Pocket", financialStatus: "READY_TO_BILL", readinessReasons: [] });
    expect(mapped.charges.map((c) => [c.department, c.status, c.netAmountMinor])).toEqual([["Consultation", "BILLABLE", 500_000], ["Laboratory", "BILLABLE", 350_000]]);
    expect(mapped.exceptions[0]).toMatchObject({ reason: "MISSING_PRICE", status: "NEEDS_REVIEW" });
    expect(mapped.exceptions[0].detail).toMatch(/Lipid profile — no laboratory price is set for "LIPID"/);
  });

  it("follows the visit from unbilled to paid", () => {
    const rows = (extra: Record<string, unknown>) => rowFromApi(row({ unpriced: null, ...extra }) as unknown as Row);
    const invoiced = (status: string, paid: number) => ({ charges: [charge({ status: "INVOICED", invoiceId: "inv-1" })], invoices: [invoice({ status, amountPaidMinor: paid, balanceMinor: 850_000 - paid })] });
    expect(rows({ charges: [], invoices: [] }).account.financialStatus).toBe("OPEN");
    expect(rows(invoiced("ISSUED", 0)).account.financialStatus).toBe("INVOICED");
    expect(rows(invoiced("PARTIALLY_PAID", 200_000)).account.financialStatus).toBe("PARTIALLY_PAID");
    expect(rows(invoiced("PAID", 850_000)).account.financialStatus).toBe("PAID");
    expect(financialStatusFor([], [])).toBe("OPEN");
  });

  it("builds the invoice view with lines, receipts, payment details and an audit trail with names", () => {
    const view = invoiceViewFromApi({
      ...invoice({ status: "PARTIALLY_PAID", amountPaidMinor: 200_000, balanceMinor: 650_000 }), patient,
      charges: [charge({ status: "INVOICED", invoiceId: "inv-1" })], issuedByName: "Ada Desk", encounter,
      payments: [{ id: "pay-1", invoiceId: "inv-1", patientId: "p-1", receiptNumber: "RCPT-2026-000003", method: "POS", amountMinor: 200_000, reference: "POS-778", transactionDate: "2026-10-09", receivingAccount: "POS clearing account", notes: null, status: "POSTED", receivedAt: "2026-10-09T11:00:00.000Z", receivedByName: "Ada Desk" }],
      ledger: [
        { id: "l-1", kind: "INVOICE_ISSUED", amountMinor: 850_000, balanceAfterMinor: 850_000, paymentId: null, createdAt: "2026-10-09T10:00:00.000Z", createdByName: "Ada Desk" },
        { id: "l-2", kind: "PAYMENT", amountMinor: -200_000, balanceAfterMinor: 650_000, paymentId: "pay-1", createdAt: "2026-10-09T11:00:00.000Z", createdByName: "Ada Desk" },
      ],
    } as unknown as Detail);
    expect(view.invoice).toMatchObject({ number: "INV-2026-000007", status: "PARTIALLY_PAID", paidMinor: 200_000, balanceMinor: 650_000 });
    expect(view.invoice.lines[0]).toMatchObject({ description: "Consultation (outpatient)", department: "Consultation", netAmountMinor: 500_000 });
    expect(view.payments[0]).toMatchObject({ method: "CARD_POS", status: "SUCCEEDED", receivingAccount: "POS clearing account", receivedBy: "Ada Desk", paymentDate: "2026-10-09T12:00:00.000Z" });
    expect(view.receipts[0].number).toBe("RCPT-2026-000003");
    expect(view.audit.map((e) => [e.action, e.actor, e.resourceId])).toEqual([["INVOICE_ISSUED", "Ada Desk", "INV-2026-000007"], ["PAYMENT_RECORDED", "Ada Desk", "RCPT-2026-000003"]]);
    expect(view.provider).toBe("Dr Tunde Bakare");
  });

  it("connects /billing and its invoice pages for staff who may read billing", () => {
    expect(liveRouteState("/billing", ["billing.read"])).toBe("connected");
    expect(liveRouteState("/billing/invoices/inv-1", ["billing.read"])).toBe("connected");
    expect(liveRouteState("/billing/invoices/inv-1", ["queue.read"])).toBe("no-permission");
    expect(liveRouteState("/billingx", ["billing.read"])).toBe("not-connected");
  });
});

describe("live Billing screens", () => {
  it("shows the hospital's visits and totals, and invoices a visit", async () => {
    api.emrRequest.mockImplementation(async (path: string, request: { method?: string; idempotencyKey?: string } = {}) => {
      if (path.startsWith("/billing/worklist")) return { data: { items: [row()], nextCursor: null, totals: { collectedMinor: 1_200_000, unbilledMinor: 850_000, outstandingMinor: 2_000_000 }, captured: true } };
      if (path === "/billing/encounters/e-1/invoices" && request.method === "POST") return { data: { id: "inv-9", number: "INV-2026-000009" } };
      throw new Error(`Unexpected ${path}`);
    });
    render(<MemoryRouter initialEntries={["/billing"]}><Routes><Route path="/billing" element={<Billing />} /><Route path="/billing/invoices/:invoiceId" element={<p>Invoice page</p>} /></Routes></MemoryRouter>);
    expect(await screen.findByText("MRN-0000001")).toBeInTheDocument();
    expect(api.emrRequest.mock.calls[0][0]).toBe("/billing/worklist?capture=true&limit=50");
    expect(screen.getByText("₦12,000.00")).toBeInTheDocument(); // collected, hospital-wide
    expect(screen.getByText("₦20,000.00")).toBeInTheDocument(); // outstanding
    expect(screen.getByText("MISSING PRICE")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Generate invoice" }));
    expect(await screen.findByText("Invoice page")).toBeInTheDocument();
    const call = api.emrRequest.mock.calls.find(([path]) => path === "/billing/encounters/e-1/invoices");
    expect(call?.[1]).toMatchObject({ method: "POST", idempotencyKey: expect.any(String) });
  });

  it("searches the server as the cashier types", async () => {
    api.emrRequest.mockResolvedValue({ data: { items: [], nextCursor: null, totals: { collectedMinor: 0, unbilledMinor: 0, outstandingMinor: 0 }, captured: true } });
    render(<MemoryRouter><Billing /></MemoryRouter>);
    await waitFor(() => expect(api.emrRequest).toHaveBeenCalledTimes(1));
    fireEvent.change(screen.getByPlaceholderText(/Search patient/), { target: { value: "INV-2026-000007" } });
    await waitFor(() => expect(api.emrRequest).toHaveBeenLastCalledWith("/billing/worklist?capture=true&limit=50&q=INV-2026-000007"), { timeout: 2000 });
  });

  it("records a payment on a live invoice with the cashier's details", async () => {
    const detail = { ...invoice(), patient, charges: [charge({ status: "INVOICED", invoiceId: "inv-1" })], payments: [], ledger: [], issuedByName: "Ada Desk", encounter };
    api.emrRequest.mockImplementation(async (path: string, request: { method?: string } = {}) => {
      if (path === "/billing/invoices/inv-1") return { data: detail };
      if (path === "/billing/invoices/inv-1/payments" && request.method === "POST") return { data: {} };
      if (path.startsWith("/billing/worklist")) return { data: { items: [], nextCursor: null, totals: null, captured: false } };
      throw new Error(`Unexpected ${path}`);
    });
    render(<MemoryRouter initialEntries={["/billing/invoices/inv-1"]}><Routes><Route path="/billing/invoices/:invoiceId" element={<BillingInvoiceDetail />} /></Routes></MemoryRouter>);
    expect(await screen.findByText("Invoice INV-2026-000007")).toBeInTheDocument();
    expect(screen.getByText("Sabi Test General Hospital")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: /Record payment/ })[0]);
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getAllByRole("option").map((o) => o.textContent)).toContain("Cheque");
    expect(within(dialog).queryByRole("option", { name: "Insurance" })).not.toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText("Payment method"), { target: { value: "BANK_TRANSFER" } });
    fireEvent.change(within(dialog).getByLabelText("Reference (optional)"), { target: { value: "TRF-1" } });
    fireEvent.change(within(dialog).getByLabelText("Receiving account"), { target: { value: "Primary bank account" } });
    fireEvent.click(within(dialog).getByRole("button", { name: /Record ₦8,500.00/ }));
    await waitFor(() => expect(api.emrRequest).toHaveBeenCalledWith("/billing/invoices/inv-1/payments", expect.objectContaining({ method: "POST", idempotencyKey: expect.any(String) })));
    const [, request] = api.emrRequest.mock.calls.find(([path]) => path === "/billing/invoices/inv-1/payments")!;
    expect(request.body).toMatchObject({ amountMinor: 850_000, method: "BANK_TRANSFER", reference: "TRF-1", receivingAccount: "Primary bank account", transactionDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) });
  });
});
