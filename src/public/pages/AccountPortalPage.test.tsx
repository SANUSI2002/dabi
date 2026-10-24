import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/config/runtime", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/config/runtime")>()), apiBaseUrl: "https://api.test", apiConfigured: true }));
import AccountPortalPage from "./AccountPortalPage";

const TOKEN = "t".repeat(43);
const open = () => render(<MemoryRouter initialEntries={[`/portal/${TOKEN}`]}><Routes><Route path="/portal/:token" element={<AccountPortalPage />} /></Routes></MemoryRouter>);
const reply = (status: number, body: unknown) => vi.fn(async () => ({ ok: status < 400, status, json: async () => body }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("customer portal page", () => {
  it("shows the customer's balance, invoices with PDF links and how to pay, without credentials", async () => {
    const fetch = reply(200, { data: {
      kind: "customer", hospital: { name: "Lekki Test Hospital", address: "1 Admiralty Way", phone: "", email: "accounts@lekki.test", paymentInstructions: "Test Bank 0000000000" },
      party: { name: "AXA Mansard HMO" }, expiresAt: "2026-11-24T00:00:00.000Z",
      statement: { from: "2025-10-24T00:00:00.000Z", to: "2026-10-24T23:59:59.999Z", openingBalance: 0, closingBalance: 420000, lines: [{ date: "2026-10-01T12:00:00.000Z", reference: "INV-2026-000001", description: "Invoice INV-2026-000001", debit: 420000, credit: 0, balance: 420000 }], aging: [{ label: "Current", amount: 420000 }] },
      invoices: [{ id: "i1", number: "INV-2026-000001", date: "2026-10-01T12:00:00.000Z", dueDate: "2026-10-31T12:00:00.000Z", currency: "NGN", status: "Open", total: 420000, balance: 420000 }],
    } });
    vi.stubGlobal("fetch", fetch);
    open();
    expect(await screen.findByText("AXA Mansard HMO")).toBeInTheDocument();
    expect(screen.getAllByText("₦420,000.00").length).toBeGreaterThan(0);
    expect(screen.getByText("Test Bank 0000000000")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^PDF$/ })).toHaveAttribute("href", `https://api.test/api/v1/accounting/portal/${TOKEN}/invoices/i1.pdf`);
    expect(fetch).toHaveBeenCalledWith(`https://api.test/api/v1/accounting/portal/${TOKEN}`, expect.objectContaining({ credentials: "omit", referrerPolicy: "no-referrer" }));
  });

  it("says plainly when a link no longer works", async () => {
    vi.stubGlobal("fetch", reply(404, { error: { message: "This link has expired or is no longer valid. Ask the hospital for a new one." } }));
    open();
    expect(await screen.findByText(/expired or is no longer valid/)).toBeInTheDocument();
  });
});
