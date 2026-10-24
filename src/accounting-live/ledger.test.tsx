import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/config/runtime", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/config/runtime")>()), apiBaseUrl: "https://api.test", apiConfigured: true }));
const api = vi.hoisted(() => ({ accountingRequest: vi.fn(), workforceRequest: vi.fn(), orgConfigRequest: vi.fn() }));
vi.mock("@/emr-live/client", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/emr-live/client")>()), ...api }));

import ChartOfAccounts from "@/pages/accounting/ChartOfAccounts";
import JournalEntries from "@/pages/accounting/JournalEntries";
import GeneralLedger from "@/pages/accounting/GeneralLedger";
import TrialBalance from "@/pages/accounting/TrialBalance";
import Consolidation from "@/pages/accounting/Consolidation";
import { useLedger } from "@/store/accounting/useLedger";
import { useIdentity } from "@/store/useIdentity";
import { liveRouteState } from "@/emr-live/routes";
import { useLiveEmr } from "@/emr-live/session";
import { LiveWorkforceSync } from "@/workforce-live/LiveWorkforceSync";
import { useWorkforceSync } from "@/workforce-live/sync";
import { useLiveLedgerMeta } from "./ledger";

const HO = "00000000-0000-4000-8000-0000000000b1";
const acct = (number: number, name: string, type: string, subtype: string, allowManualEntry = true) => ({ id: `a${number}`, number, name, type, subtype, isActive: true, allowManualEntry, openingBalance: 0, currency: "NGN", version: 1 });
const ledger = {
  accounts: [acct(1010, "Bank — Current Account", "asset", "bank"), acct(1100, "Accounts Receivable — Patients", "asset", "accounts_receivable", false), acct(5200, "Rent", "expense", "operating_expense")],
  branches: [{ id: HO, code: "HO", name: "Head Office", isHeadOffice: true, baseCurrency: "NGN", active: true }], consolidationGroups: [],
  fiscalYears: [{ id: "fy", year: 2026, startDate: "2026-01-01T00:00:00.000Z", endDate: "2026-12-31T23:59:59.999Z", status: "Open" }],
  periods: Array.from({ length: 12 }, (_, i) => ({ id: `p${i + 1}`, fiscalYear: 2026, month: i + 1, label: `M${i + 1}`, startDate: new Date(Date.UTC(2026, i, 1)).toISOString(), endDate: new Date(Date.UTC(2026, i + 1, 0, 23, 59, 59)).toISOString(), status: i === 0 ? "Locked" : "Open" })),
  booksLockedBefore: null, fxRates: [{ code: "NGN", name: "Naira", symbol: "₦", rateToNgn: 1 }], settingsVersion: 3,
  entries: [
    { id: "e1", number: "JE-2026-000001", date: "2026-03-10T12:00:00.000Z", branchId: HO, source: "Manual", memo: "March rent", status: "Reversed", reversedByEntryId: "e2", createdBy: "Ngozi", createdAt: "2026-03-10T12:00:00.000Z", version: 2, lines: [{ id: "l1", accountNumber: 5200, debit: 400000, credit: 0 }, { id: "l2", accountNumber: 1010, debit: 0, credit: 400000 }] },
    { id: "e2", number: "JE-2026-000002", date: "2026-03-11T12:00:00.000Z", branchId: HO, source: "Reversal", memo: "Reversal", status: "Posted", reversesEntryId: "e1", createdBy: "Ngozi", createdAt: "2026-03-11T12:00:00.000Z", version: 1, lines: [{ id: "l3", accountNumber: 5200, debit: 0, credit: 400000 }, { id: "l4", accountNumber: 1010, debit: 400000, credit: 0 }] },
    { id: "e3", number: "JE-2026-000003", date: "2026-04-10T12:00:00.000Z", branchId: HO, source: "Manual", memo: "April rent", status: "Posted", createdBy: "Ngozi", createdAt: "2026-04-10T12:00:00.000Z", version: 1, lines: [{ id: "l5", accountNumber: 5200, debit: 400000, credit: 0 }, { id: "l6", accountNumber: 1010, debit: 0, credit: 400000 }] },
  ],
  recurringJournals: [], yearEndClosings: [],
};

beforeEach(() => {
  vi.stubGlobal("IntersectionObserver", class { observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } });
  for (const fn of Object.values(api)) fn.mockReset();
  api.accountingRequest.mockImplementation(async (path: string) => (path === "/ledger" ? { data: ledger } : { data: {} }));
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

describe("live general ledger", () => {
  it("connects the general-ledger screens for finance staff", () => {
    expect(liveRouteState("/accounting/journals", ["acct.view"])).toBe("connected");
    expect(liveRouteState("/accounting/trial-balance", ["hr.read"])).toBe("no-permission");
  });

  it("shows the organization's books, and a reversed entry nets to nothing", async () => {
    render(<LiveWorkforceSync />);
    await waitFor(() => expect(useLiveLedgerMeta.getState().loaded).toBe(true));
    expect(useLedger.getState().balanceOf(5200)).toBe(400000); // March reversed, April stands
    expect(useLedger.getState().isInBalance(new Date().toISOString())).toBe(true);
    expect(useIdentity.getState().user.financeRole).toBe("Accountant");
    for (const Screen of [ChartOfAccounts, GeneralLedger, TrialBalance, Consolidation]) {
      const { unmount } = render(<MemoryRouter><Screen /></MemoryRouter>);
      unmount();
    }
    render(<MemoryRouter><JournalEntries /></MemoryRouter>);
    expect(await screen.findByText("JE-2026-000003")).toBeInTheDocument();
  });

  it("checks entries before sending them, and sends what passes", async () => {
    render(<LiveWorkforceSync />);
    await waitFor(() => expect(useLiveLedgerMeta.getState().loaded).toBe(true));
    const L = useLedger.getState();
    expect(L.postJournal({ date: "2026-05-02T12:00:00.000Z", source: "Manual", memo: "x", lines: [{ accountNumber: 5200, debit: 100, credit: 0 }, { accountNumber: 1010, debit: 0, credit: 90 }] })).toMatchObject({ ok: false, error: expect.stringMatching(/Out of balance/) });
    expect(L.postJournal({ date: "2026-01-15T12:00:00.000Z", source: "Manual", memo: "x", lines: [{ accountNumber: 5200, debit: 100, credit: 0 }, { accountNumber: 1010, debit: 0, credit: 100 }] })).toMatchObject({ ok: false, error: expect.stringMatching(/locked/) });
    const res = L.postJournal({ date: "2026-05-02T12:00:00.000Z", source: "Manual", memo: "May rent", lines: [{ accountNumber: 5200, debit: 400000, credit: 0 }, { accountNumber: 1010, debit: 0, credit: 400000 }] });
    expect(res.ok).toBe(true);
    expect(L.reverseEntry("e1").ok).toBe(false); // already reversed
    L.reverseEntry("e3", { date: "2026-05-03T12:00:00.000Z" });
    L.setBooksLockedBefore("2026-02-01T00:00:00.000Z");
    await waitFor(() => expect(writes()).toHaveLength(3));
    expect(writes()).toEqual([
      ["/ledger/entries", "POST", { id: res.entry!.id, date: "2026-05-02T12:00:00.000Z", memo: "May rent", lines: [{ accountNumber: 5200, debit: 400000, credit: 0 }, { accountNumber: 1010, debit: 0, credit: 400000 }], status: "Posted", branchId: HO }],
      ["/ledger/entries/e3/reverse", "POST", { date: "2026-05-03T12:00:00.000Z" }],
      ["/ledger/lock", "PUT", { booksLockedBefore: "2026-02-01T00:00:00.000Z" }],
    ]);
  });
});
