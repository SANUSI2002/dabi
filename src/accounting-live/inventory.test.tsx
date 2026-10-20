import { cleanup, render, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/config/runtime", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/config/runtime")>()), apiBaseUrl: "https://api.test", apiConfigured: true }));
const api = vi.hoisted(() => ({ accountingRequest: vi.fn(), workforceRequest: vi.fn(), orgConfigRequest: vi.fn(), emrRequest: vi.fn() }));
vi.mock("@/emr-live/client", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/emr-live/client")>()), ...api }));

import InventoryAccounting from "@/pages/accounting/InventoryAccounting";
import { useInventoryAccounting } from "@/store/accounting/useInventoryAccounting";
import { useNotifications } from "@/store/accounting/useNotifications";
import { useLiveEmr } from "@/emr-live/session";
import { LiveWorkforceSync } from "@/workforce-live/LiveWorkforceSync";
import { useWorkforceSync } from "@/workforce-live/sync";
import { useLiveInventoryMeta } from "./inventory";

const ITEM = "00000000-0000-4000-8000-0000000000d1";
const MAIN = "00000000-0000-4000-8000-0000000000d9";
const inventory = {
  locations: [{ id: MAIN, code: "MAIN", name: "Main store", type: "STORE", status: "ACTIVE", version: 1 }],
  items: [{ id: ITEM, sku: "GLV-01", name: "Examination gloves (box)", category: "PPE", unit: "box", minLevel: null, reorderLevel: 20, reorderQty: 50, active: true, version: 1 }],
  batches: [{ id: "b1", itemId: ITEM, locationId: MAIN, batchNumber: "G-1", expiryDate: null, qtyReceived: 20, qtyRemaining: 15, unitCostMinor: 450_000, status: "ACTIVE", quarantineReason: null, quarantinedByName: null, quarantinedAt: null, receivedAt: "2026-10-01T00:00:00.000Z" }],
  movements: [], requisitions: [], counts: [], transfers: [],
  accounts: { [ITEM]: { inventory: 1210, cogs: 5010 } },
};

beforeEach(() => {
  vi.stubGlobal("IntersectionObserver", class { observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } });
  for (const fn of Object.values(api)) fn.mockReset();
  api.accountingRequest.mockImplementation(async (path: string) => ({ data: path === "/inventory" ? inventory : {} }));
  api.emrRequest.mockResolvedValue({ data: {} });
  api.workforceRequest.mockResolvedValue({ data: {} });
  api.orgConfigRequest.mockResolvedValue({ data: {} });
  useWorkforceSync.setState({ error: "", pending: 0 });
  useLiveEmr.setState({
    status: "ready", error: "", user: { id: "u1", name: "Ngozi Eze", email: "finance@hospital.test", role: "Finance Officer" },
    access: { organizationId: "11111111-1111-4111-8111-111111111111", facilityId: "f1", organizationName: "Sabi Test General Hospital", roles: ["FINANCE_OFFICER"], permissions: ["acct.view", "acct.post"], clinicalApiConnected: true, patientRegistryEnabled: true } as never,
  });
});
afterEach(() => { cleanup(); useLiveEmr.setState({ status: "idle", access: null, user: null }); });
const sent = (fn: typeof api.accountingRequest) => fn.mock.calls.filter(([, o]) => o?.method).map(([p, o]) => [p, o.body]);
const ready = async () => { render(<LiveWorkforceSync />); await waitFor(() => expect(useLiveInventoryMeta.getState().loaded).toBe(true)); };

describe("live inventory accounting", () => {
  it("values the hospital's own stores on their ledger accounts", async () => {
    await ready();
    const inv = useInventoryAccounting.getState();
    expect(inv.items[0]).toMatchObject({ sku: "GLV-01", inventoryAccountNumber: 1210, cogsAccountNumber: 5010, currentQty: 15 });
    expect(inv.totalValuation()).toBe(67500);
    expect(useNotifications.getState().alerts().some((a) => a.key === "lowStock")).toBe(true); // 15 at or below 20
    render(<MemoryRouter><InventoryAccounting /></MemoryRouter>);
  });

  it("books a paid-for receipt here and sends stock movements to the hospital stores", async () => {
    await ready();
    const inv = useInventoryAccounting.getState();
    inv.receiveStock({ itemId: ITEM, qty: 10, unitCost: 4500, date: "2026-10-20", postGL: true, fundingAccount: 1000, reference: "Cash purchase" });
    inv.receiveStock({ itemId: ITEM, qty: 5, unitCost: 4500, date: "2026-10-20", postGL: false }); // from a goods receipt: its bill carries it
    expect(inv.issueStock({ itemId: ITEM, qty: 99, date: "2026-10-20" })).toMatchObject({ ok: false });
    inv.issueStock({ itemId: ITEM, qty: 4, date: "2026-10-20", department: "Theatre" });
    await waitFor(() => expect(sent(api.emrRequest)).toHaveLength(1));
    expect(sent(api.accountingRequest)).toEqual([
      ["/inventory/receipts", { itemId: ITEM, qty: 10, unitCostMinor: 450_000, fundingAccount: 1000, reference: "Cash purchase" }],
      ["/inventory/receipts", { itemId: ITEM, qty: 5, unitCostMinor: 450_000 }],
    ]);
    expect(sent(api.emrRequest)).toEqual([["/stores/issues", { itemId: ITEM, locationId: MAIN, qty: 4, department: "Theatre" }]]);
  });

  it("says plainly what is not connected to the stores", async () => {
    await ready();
    const inv = useInventoryAccounting.getState();
    expect(inv.transferStock({ itemId: ITEM, qty: 1, fromBranchId: "a", toBranchId: "b", date: "2026-10-20" })).toMatchObject({ ok: false, error: expect.stringMatching(/between branches/) });
    expect(inv.applyLandedCost({ date: "2026-10-20", description: "Freight", creditAccount: 2000, allocations: [{ itemId: ITEM, amount: 100 }] })).toMatchObject({ ok: false, error: expect.stringMatching(/Landed costs/) });
  });
});
