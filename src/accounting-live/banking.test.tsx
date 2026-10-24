import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/config/runtime", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/config/runtime")>()), apiBaseUrl: "https://api.test", apiConfigured: true }));
const api = vi.hoisted(() => ({ accountingRequest: vi.fn(), workforceRequest: vi.fn(), orgConfigRequest: vi.fn() }));
vi.mock("@/emr-live/client", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/emr-live/client")>()), ...api }));

import BankAccounts from "@/pages/accounting/BankAccounts";
import BankTransactions from "@/pages/accounting/BankTransactions";
import BankReconciliation from "@/pages/accounting/BankReconciliation";
import BankFeeds from "@/pages/accounting/BankFeeds";
import Expenses from "@/pages/accounting/Expenses";
import AccountingApprovals from "@/pages/accounting/AccountingApprovals";
import { useBanking } from "@/store/accounting/useBanking";
import { useExpenses } from "@/store/accounting/useExpenses";
import { useLiveEmr } from "@/emr-live/session";
import { LiveWorkforceSync } from "@/workforce-live/LiveWorkforceSync";
import { useWorkforceSync } from "@/workforce-live/sync";
import { useLiveBankingMeta } from "./banking";
import { useLiveLedgerMeta } from "./ledger";

const E = "00000000-0000-4000-8000-0000000000e1";
const L1 = "00000000-0000-4000-8000-0000000000f1";
const ledger = {
  accounts: [
    { number: 1010, name: "Main bank", type: "asset", subtype: "bank", isActive: true, allowManualEntry: true, system: true, version: 1 },
    { number: 5600, name: "Bank Charges", type: "expense", subtype: "other_expense", isActive: true, allowManualEntry: true, system: true, version: 1 },
  ],
  branches: [], consolidationGroups: [], fiscalYears: [], periods: [], booksLockedBefore: null, fxRates: [], settingsVersion: 1, recurringJournals: [], yearEndClosings: [], approvalRules: [],
  entries: [{ id: E, number: "JE-2026-000001", date: "2026-10-10T12:00:00.000Z", source: "Bank Transaction", memo: "Deposit", status: "Posted", lines: [{ id: L1, accountNumber: 1010, debit: 5000, credit: 0 }, { id: "x2", accountNumber: 5600, debit: 0, credit: 5000 }], version: 1 }],
};
const banking = {
  accounts: [{ id: "gl-1010", accountNumber: 1010, bankName: "", accountName: "Main bank", accountNo: "—", currency: "NGN", active: true }],
  statementLines: [{ id: "s1", accountNumber: 1010, date: "2026-10-11T12:00:00.000Z", description: "COMMISSION ON TURNOVER", amount: -120, reconciled: false, importedAt: "2026-10-12T00:00:00.000Z", origin: "import", reference: null }],
  reconciliations: [{ id: "rc1", accountNumber: 1010, statementDate: "2026-10-15T23:59:59.000Z", openingBalance: 0, closingBalance: 5000, status: "In Progress", reconciledLineIds: [], version: 1 }],
  reconciliationRules: [{ id: "r1", accountNumber: 1010, name: "Charges", descriptionContains: "commission", direction: "out", contraAccount: 5600, active: true, version: 2 }],
  connections: [], feedProvider: null,
};
const expenses = {
  claims: [{ id: "c1", number: "EXP-2026-000001", claimantId: "emp-1", date: "2026-10-12T12:00:00.000Z", title: "Fuel", payMode: "Reimburse to staff", lines: [{ id: "el1", accountNumber: 5230, description: "Fuel", amount: 60000 }], status: "Pending Approval",
    approval: { status: "Pending", currentLevel: 1, steps: [{ level: 1, approverRole: "Approver", decision: "Pending" }], submittedByMe: false, decidableByMe: true }, createdAt: "2026-10-12T12:00:00.000Z", version: 2 }],
};

beforeEach(() => {
  vi.stubGlobal("IntersectionObserver", class { observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } });
  for (const fn of Object.values(api)) fn.mockReset();
  api.accountingRequest.mockImplementation(async (path: string) => ({ data: ({ "/ledger": ledger, "/banking": banking, "/expenses": expenses } as Record<string, unknown>)[path] ?? {} }));
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
  await waitFor(() => expect(useLiveBankingMeta.getState().loaded && useLiveBankingMeta.getState().expensesLoaded && useLiveLedgerMeta.getState().loaded).toBe(true));
};

describe("live banking and expenses", () => {
  it("opens every banking screen and the approvals queue with the organization's records", async () => {
    await ready();
    expect(useBanking.getState().connections).toEqual([]);
    expect(useExpenses.getState().claims.map((c) => c.number)).toEqual(["EXP-2026-000001"]);
    for (const Screen of [BankAccounts, BankTransactions, BankReconciliation, BankFeeds, Expenses, AccountingApprovals]) {
      const { unmount } = render(<MemoryRouter><Screen /></MemoryRouter>);
      unmount();
    }
  });

  it("refuses a live bank feed instead of linking a simulated one", async () => {
    await ready();
    expect(useBanking.getState().connectBank(1010, "Mono")).toMatchObject({ ok: false, error: expect.stringMatching(/open-banking provider/) });
    expect(writes()).toEqual([]);
  });

  it("connects a bank through Mono's consent screen, then syncs and disconnects through the server", async () => {
    const withFeed = { ...banking, feedProvider: { name: "Mono", publicKey: "test_pk" }, connections: [{ id: "c1", accountNumber: 1010, provider: "Mono", institution: "GTBank", status: "Reauth Required", connectedAt: "2026-10-01T00:00:00.000Z", accountNoMasked: "••••6789", lastError: "MONO_HTTP_401" }] };
    api.accountingRequest.mockImplementation(async (path: string, o?: { method?: string }) => {
      if (o?.method) return { data: path.endsWith("/sync") ? { imported: 2, autoMatched: 1 } : path === "/banking/connections" ? { id: "c2", imported: 5, autoMatched: 2 } : {} };
      return { data: path === "/banking" ? withFeed : path === "/expenses" ? expenses : path === "/ledger" ? ledger : {} };
    });
    await ready();
    expect(useLiveBankingMeta.getState().feedProvider).toEqual({ name: "Mono", publicKey: "test_pk" });
    expect(useBanking.getState().connections[0]).toMatchObject({ status: "Reauth Required", accountNoMasked: "••••6789" });
    // Mono's widget, stubbed: it is opened with the public key, and its one-time code goes to the server
    let options: { key: string; onSuccess: (r: { code: string }) => void } | undefined;
    const open = vi.fn();
    window.Connect = class { constructor(o: never) { options = o; } setup() {} open() { open(); } } as never;
    const { connectBankFeed, syncBankFeed } = await import("./bankFeeds");
    const pending = connectBankFeed(1010, "test_pk");
    await waitFor(() => expect(open).toHaveBeenCalled());
    expect(options?.key).toBe("test_pk");
    options!.onSuccess({ code: "code_123" });
    expect(await pending).toBe("Bank connected. 5 transaction(s) pulled; 2 posted by your rules. The rest are waiting in Reconciliation.");
    expect(writes()).toContainEqual(["/banking/connections", "POST", { accountNumber: 1010, code: "code_123" }]);
    expect(await syncBankFeed("c1")).toBe("Pulled 2 new transaction(s); 1 posted by your rules. The rest are in Reconciliation.");
    render(<MemoryRouter><BankFeeds /></MemoryRouter>);
    expect(await screen.findByRole("button", { name: /Reconnect/ })).toBeInTheDocument();
    expect(screen.getByText("the bank needs fresh consent")).toBeInTheDocument();
    delete window.Connect;
  });

  it("checks locally first, then sends banking work to the API", async () => {
    await ready();
    const bank = useBanking.getState();
    expect(bank.recordTransfer({ fromAccount: 1010, toAccount: 1010, amount: 5, date: "2026-10-20" })).toMatchObject({ ok: false });
    expect(bank.completeReconciliation("rc1")).toMatchObject({ ok: false, error: expect.stringMatching(/out/) });
    expect(bank.applyRulesTo(1010)).toEqual({ matched: 1 });
    bank.toggleCleared("rc1", `${E}:${L1}`);
    expect(useBanking.getState().reconciliationProgress("rc1").difference).toBe(0); // the tick shows at once
    await waitFor(() => expect(writes()).toEqual([["/banking/accounts/1010/apply-rules", "POST", {}], ["/banking/reconciliations/rc1/toggle", "POST", { movementKey: `${E}:${L1}` }]]));
  });

  it("imports a bank's statement file after showing what it read", async () => {
    await ready();
    render(<MemoryRouter><BankTransactions /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: /Import statement/ }));
    const csv = [
      "Account Number,0123456789",
      "Trans Date,Reference,Narration,Debit,Credit,Balance",
      '01-Sep-2026,,Opening Balance,,,"2,000,000.00"',
      '03/09/2026,NIP/778,"TRF FROM ADEBAYO, OLUWASEUN",,"45,000.00","2,045,000.00"',
    ].join("\n");
    fireEvent.change(screen.getByLabelText("Statement file"), { target: { files: [new File([csv], "gtb-september.csv", { type: "text/csv" })] } });
    expect(await screen.findByText(/gtb-september.csv: 1 transaction/)).toBeInTheDocument();
    expect(screen.getByText(/1 row left out/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Import 1 line" }));
    await waitFor(() => expect(writes()).toContainEqual(["/banking/statement-lines/import", "POST", { accountNumber: expect.any(Number), lines: [{ date: "2026-09-03T12:00:00.000Z", amount: 45000, description: "TRF FROM ADEBAYO, OLUWASEUN", reference: "NIP/778" }] }]));
  });

  it("decides expense claims on the server", async () => {
    await ready();
    useExpenses.getState().decideClaim("c1", "Approved");
    await waitFor(() => expect(writes()).toContainEqual(["/expenses/c1/decide", "POST", { decision: "Approved" }]));
  });
});
