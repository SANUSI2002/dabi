import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/config/runtime", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/config/runtime")>()), apiBaseUrl: "https://api.test", apiConfigured: true }));
const api = vi.hoisted(() => ({ accountingRequest: vi.fn(), workforceRequest: vi.fn(), orgConfigRequest: vi.fn() }));
vi.mock("@/emr-live/client", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/emr-live/client")>()), ...api }));

import FixedAssets from "@/pages/accounting/FixedAssets";
import Budgets from "@/pages/accounting/Budgets";
import TaxCenter from "@/pages/accounting/TaxCenter";
import { useFixedAssets } from "@/store/accounting/useFixedAssets";
import { useBudgets } from "@/store/accounting/useBudgets";
import { useTax } from "@/store/accounting/useTax";
import { useLiveEmr } from "@/emr-live/session";
import { LiveWorkforceSync } from "@/workforce-live/LiveWorkforceSync";
import { useWorkforceSync } from "@/workforce-live/sync";
import { useLiveAssetsMeta } from "./assets";
import { useLiveLedgerMeta } from "./ledger";

const ym = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
const monthsBack = (k: number) => { const d = new Date(); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - k, 15, 12)); };
const ledger = {
  accounts: [{ number: 1010, name: "Main bank", type: "asset", subtype: "bank", isActive: true, allowManualEntry: true, system: true, version: 1 }],
  branches: [], consolidationGroups: [], fiscalYears: [], periods: [], booksLockedBefore: null, fxRates: [], settingsVersion: 1, recurringJournals: [], yearEndClosings: [], approvalRules: [], entries: [],
};
const fixedAssets = {
  assets: [{ id: "a1", tag: "FA-0001", name: "Ultrasound scanner", category: "Medical Equipment", acquisitionDate: monthsBack(2).toISOString(), cost: 1200000, assetAccountNumber: 1510, method: "Reducing Balance", usefulLifeMonths: 60, salvageValue: 0, reducingRateAnnual: 24, accumulatedDepreciation: 0, status: "Active", revaluationReserve: 0, impairmentLoss: 0, cwipSpend: 0, createdAt: monthsBack(2).toISOString(), version: 1 }],
  runs: [], revaluations: [],
};
const planning = {
  costCentres: [{ id: "cc1", code: "LAB", name: "Laboratory", active: true, version: 3 }],
  budgets: [{ id: "b1", name: "FY budget", fiscalYear: 2026, status: "Draft", lines: [], createdAt: "2026-01-01T00:00:00.000Z", version: 1 }],
  taxReturns: [{ id: "t1", reference: "VAT-2026-10", kind: "VAT", returnType: "VAT", authority: "FIRS", liabilityAccount: 2200, periodStart: "2026-10-01T00:00:00.000Z", periodEnd: "2026-10-20T00:00:00.000Z", outputTax: 7500, inputTax: 0, netPayable: 7500, status: "Open", version: 1 }],
};

beforeEach(() => {
  vi.stubGlobal("IntersectionObserver", class { observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } });
  for (const fn of Object.values(api)) fn.mockReset();
  api.accountingRequest.mockImplementation(async (path: string) => ({ data: ({ "/ledger": ledger, "/fixed-assets": fixedAssets, "/planning": planning } as Record<string, unknown>)[path] ?? {} }));
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
const ready = async () => {
  render(<LiveWorkforceSync />);
  await waitFor(() => expect(useLiveAssetsMeta.getState().loaded && useLiveAssetsMeta.getState().planningLoaded && useLiveLedgerMeta.getState().loaded).toBe(true));
};

describe("live fixed assets, budgets and tax", () => {
  it("opens the screens with the organization's register, budgets and returns", async () => {
    await ready();
    expect(useFixedAssets.getState().assets.map((a) => a.tag)).toEqual(["FA-0001"]);
    expect(useBudgets.getState().costCentres.map((c) => c.code)).toEqual(["LAB"]);
    for (const Screen of [FixedAssets, Budgets]) {
      const { unmount } = render(<MemoryRouter><Screen /></MemoryRouter>);
      unmount();
    }
  });

  it("catches up depreciation on the server, predicting each month on the balance the month before leaves", async () => {
    await ready();
    const res = useFixedAssets.getState().catchUpDepreciation();
    // reducing balance at 2%/month: 24,000 then 23,520 then 23,049.60
    expect(res).toEqual({ ran: [ym(monthsBack(2)), ym(monthsBack(1)), ym(monthsBack(0))], total: 70569.6 });
    await waitFor(() => expect(writes()).toEqual([["/fixed-assets/depreciation/catch-up", "POST", { through: ym(new Date()) }]]));
  });

  it("records a tax filing with the authority's acknowledgement instead of inventing one", async () => {
    await ready();
    expect(useTax.getState().efileReturn("t1")).toEqual({ ok: false, needsAcknowledgement: true });
    render(<MemoryRouter><TaxCenter /></MemoryRouter>);
    fireEvent.click(screen.getByText("Returns"));
    fireEvent.click(await screen.findByText("E-file"));
    expect(await screen.findByText(/Direct e-filing to FIRS isn't connected/)).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText(/filing receipt number/), { target: { value: "FIRS-ACK-00123" } });
    fireEvent.click(screen.getByText("Record filing"));
    await waitFor(() => expect(writes()).toEqual([["/planning/tax-returns/t1/filing", "POST", { submissionRef: "FIRS-ACK-00123" }]]));
    expect(await screen.findByText(/Acknowledgement: FIRS-ACK-00123/)).toBeInTheDocument();
  });

  it("switches cost centres off on the server", async () => {
    await ready();
    useBudgets.getState().toggleCostCentre("cc1");
    expect(useBudgets.getState().costCentres[0].active).toBe(false);
    await waitFor(() => expect(writes()).toEqual([["/planning/cost-centres/cc1", "PATCH", { active: false }]]));
  });
});
