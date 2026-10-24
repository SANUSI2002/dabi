import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/config/runtime", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/config/runtime")>()), apiBaseUrl: "https://api.test", apiConfigured: true }));
const api = vi.hoisted(() => ({ emrRequest: vi.fn() }));
vi.mock("@/emr-live/client", async (importOriginal) => ({ ...(await importOriginal<typeof import("./client")>()), emrRequest: api.emrRequest }));

import Inventory from "@/pages/admin/Inventory";
import { storesFromApi, useLiveStoresData, type ApiStores } from "./stores";
import { useLiveEquipment } from "./equipment";
import { liveRouteState } from "./routes";
import { useLiveEmr } from "./session";

const MAIN = "00000000-0000-4000-8000-000000000001";
const WARD = "00000000-0000-4000-8000-000000000002";
const data: ApiStores = {
  locations: [{ id: MAIN, code: "MAIN", name: "Main Store", type: "STORE", status: "ACTIVE", version: 1 }, { id: WARD, code: "MEDW", name: "Medical Ward", type: "WARD", status: "ACTIVE", version: 1 }],
  items: [{ id: "i1", sku: "GLV-M", name: "Examination gloves (M)", category: "PPE", unit: "box", minLevel: 5, reorderLevel: 20, reorderQty: null, active: true, version: 1 }],
  batches: [
    { id: "b1", itemId: "i1", locationId: MAIN, batchNumber: "LATE", expiryDate: "2099-01-01", qtyReceived: 30, qtyRemaining: 12, unitCostMinor: 250000, status: "ACTIVE", quarantineReason: null, quarantinedByName: null, quarantinedAt: null, receivedAt: "2026-10-01T09:00:00.000Z" },
    { id: "b2", itemId: "i1", locationId: WARD, batchNumber: "LATE", expiryDate: "2099-01-01", qtyReceived: 3, qtyRemaining: 3, unitCostMinor: 250000, status: "QUARANTINED", quarantineReason: "Torn packaging", quarantinedByName: "Store Officer", quarantinedAt: "2026-10-10T09:00:00.000Z", receivedAt: "2026-10-05T09:00:00.000Z" },
  ],
  movements: [{ id: "m1", itemId: "i1", locationId: MAIN, kind: "RECEIPT", qtyDelta: 30, unitCostMinor: 250000, reference: null, note: null, department: null, purpose: null, requisitionId: null, userName: "Store Officer", createdAt: "2026-10-01T09:00:00.000Z" }],
  requisitions: [{ id: "r1", number: "REQ-2026-000001", requestingLocationId: WARD, fulfillingLocationId: null, neededBy: null, justification: "Weekly restock", status: "PENDING_APPROVAL", requestedByName: "Grace Nwangbo", decidedByName: null, decidedAt: null, rejectionReason: null, version: 1, createdAt: "2026-10-19T09:00:00.000Z", lines: [{ itemId: "i1", qtyRequested: 10, qtyIssued: 0 }] }],
  counts: [], transfers: [],
};

const asOfficer = (permissions: string[]) => useLiveEmr.setState({
  status: "ready", error: "", user: { id: "u7", name: "Store Officer", email: "stores@hospital.test", role: "Inventory Officer" },
  access: { organizationId: "11111111-1111-4111-8111-111111111111", facilityId: "f1", organizationName: "Sabi Test General Hospital", roles: ["INVENTORY_OFFICER"], permissions, clinicalApiConnected: true, patientRegistryEnabled: true } as never,
});

beforeEach(() => {
  api.emrRequest.mockReset();
  api.emrRequest.mockImplementation(async (path: string) => (path.startsWith("/stores?") ? { data } : path === "/equipment" ? { data: { assets: [], jobs: [] } } : { data: { id: "new" } }));
  useLiveStoresData.setState({ locations: [], mainLocationId: "", items: [], layers: [], movements: [], requisitions: [], counts: [], locationTransfers: [], loaded: false, error: "", draftCounts: {} });
  useLiveEquipment.setState({ assets: [], jobs: [], error: "" });
  asOfficer(["stores.read", "stores.manage", "stores.approve", "stores.requisition", "equipment.read"]);
});
afterEach(() => { cleanup(); useLiveEmr.setState({ status: "idle", access: null, user: null }); });

describe("live hospital stores", () => {
  it("is connected and folds batches into on-hand, value and quarantine", () => {
    expect(liveRouteState("/inventory", ["stores.read"])).toBe("connected");
    const s = storesFromApi(data);
    expect(s.mainLocationId).toBe(MAIN);
    expect(s.items[0]).toMatchObject({ currentQty: 15, averageCost: 2500, valuationMethod: "FIFO" });
    expect(s.layers.find((l) => l.id === "b2")).toMatchObject({ status: "Quarantined", quarantinedBy: "Store Officer", unitCost: 2500 });
    expect(s.requisitions[0]).toMatchObject({ status: "Pending Approval", requestedBy: "Grace Nwangbo", version: 1 });
    expect(s.movements[0]).toMatchObject({ type: "Receipt", value: 75000 });
  });

  it("issues stock from a location in the hospital's EMR", async () => {
    render(<MemoryRouter><Inventory /></MemoryRouter>);
    fireEvent.click(await screen.findByRole("tab", { name: "Stock List" }));
    fireEvent.click(await screen.findByRole("button", { name: "Issue" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByRole("spinbutton"), { target: { value: "4" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Confirm" }));
    await waitFor(() => expect(api.emrRequest).toHaveBeenCalledWith("/stores/issues", expect.objectContaining({ method: "POST", idempotencyKey: expect.any(String), body: { itemId: "i1", locationId: MAIN, qty: 4 } })));
  });

  it("receives stock in kobo with its batch and expiry", async () => {
    render(<MemoryRouter><Inventory /></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: /Receive stock/ }));
    const dialog = await screen.findByRole("dialog");
    const [quantity, cost] = within(dialog).getAllByRole("spinbutton");
    fireEvent.change(quantity, { target: { value: "50" } });
    fireEvent.change(cost, { target: { value: "2600.50" } });
    fireEvent.change(dialog.querySelector('input[type="date"]')!, { target: { value: "2027-06-30" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Receive" }));
    await waitFor(() => expect(api.emrRequest).toHaveBeenCalledWith("/stores/receipts", expect.objectContaining({
      method: "POST", body: { itemId: "i1", locationId: MAIN, qty: 50, unitCostMinor: 260050, expiryDate: "2027-06-30" },
    })));
  });

  it("approves a ward's requisition with its version", async () => {
    render(<MemoryRouter><Inventory /></MemoryRouter>);
    fireEvent.click(await screen.findByRole("tab", { name: "Requisitions" }));
    fireEvent.click(await screen.findByRole("button", { name: "Approve" }));
    await waitFor(() => expect(api.emrRequest).toHaveBeenCalledWith("/stores/requisitions/r1/approve", { method: "POST", version: 1, body: {} }));
  });

  it("shows quarantined stock and releases it", async () => {
    render(<MemoryRouter><Inventory /></MemoryRouter>);
    fireEvent.click(await screen.findByRole("tab", { name: "Alerts" }));
    expect(await screen.findByText("Torn packaging")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Release" }));
    await waitFor(() => expect(api.emrRequest).toHaveBeenCalledWith("/stores/batches/b2/release", { method: "POST", body: {} }));
  });
});

describe("demo inventory", () => {
  it("still renders the demo stock ledger when not live", async () => {
    useLiveEmr.setState({ status: "idle", access: null, user: null });
    render(<MemoryRouter><Inventory /></MemoryRouter>);
    expect(await screen.findByText("Total items")).toBeInTheDocument();
    expect(api.emrRequest).not.toHaveBeenCalled();
  });
});
