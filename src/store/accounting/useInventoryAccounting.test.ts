import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useInventoryAccounting } from "./useInventoryAccounting";
import { useLedger } from "./useLedger";
import { useIdentity } from "@/store/useIdentity";
import { DEFAULT_STORE_LOCATION_ID, type InventoryItem } from "@/data/accounting/inventory";

const inv = () => useInventoryAccounting.getState();
const today = () => new Date().toISOString();
const daysAhead = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();

const baseItem = (over: Partial<InventoryItem>): InventoryItem => ({
  id: "t-item", sku: "T-001", name: "Test item", category: "Consumables", unit: "box", valuationMethod: "FIFO",
  inventoryAccountNumber: 1210, cogsAccountNumber: 5010, currentQty: 0, averageCost: 0, reorderLevel: 0, active: true, ...over,
});

function reset(items: InventoryItem[]) {
  useInventoryAccounting.setState({ items, layers: [], movements: [], transfers: [], counts: [], locationTransfers: [], requisitions: [] });
}

/** receive a batch without posting to the GL — these tests are about stock, not the ledger */
function receive(itemId: string, qty: number, over: { locationId?: string; batchNumber?: string; expiryDate?: string; unitCost?: number } = {}) {
  const res = inv().receiveStock({ itemId, qty, unitCost: over.unitCost ?? 100, date: today(), batchNumber: over.batchNumber, expiryDate: over.expiryDate, locationId: over.locationId });
  expect(res.ok).toBe(true);
  return res.layer!;
}

describe("useInventoryAccounting — locations, quarantine, requisitions", () => {
  beforeEach(() => {
    useIdentity.getState().setUser("s1");
    reset([baseItem({ id: "fifo", valuationMethod: "FIFO" }), baseItem({ id: "wa", sku: "T-002", name: "Test WA item", valuationMethod: "Weighted Average" })]);
  });

  afterEach(() => {
    reset([]);
  });

  describe("relocateStock", () => {
    it("moves stock between locations, keeping batch and expiry, and posts no journal entry", () => {
      const expiry = daysAhead(120);
      receive("fifo", 50, { locationId: "loc-main", batchNumber: "B1", expiryDate: expiry });
      const journalsBefore = useLedger.getState().entries.length;

      const res = inv().relocateStock({ itemId: "fifo", qty: 20, fromLocationId: "loc-main", toLocationId: "loc-medward", date: today() });
      expect(res.ok).toBe(true);

      expect(inv().balanceByLocation("fifo", "loc-main")).toBe(30);
      expect(inv().balanceByLocation("fifo", "loc-medward")).toBe(20);
      expect(inv().itemById("fifo")!.currentQty).toBe(50); // a move never changes the total
      const moved = inv().layers.find((l) => l.locationId === "loc-medward")!;
      expect(moved.batchNumber).toBe("B1");
      expect(moved.expiryDate).toBe(expiry);
      expect(inv().movements.filter((m) => m.type === "Transfer")).toHaveLength(2);
      expect(inv().locationTransfers).toHaveLength(1);
      expect(useLedger.getState().entries.length).toBe(journalsBefore);
    });

    it("draws the earliest-expiring batch first", () => {
      receive("fifo", 10, { locationId: "loc-main", batchNumber: "LATE", expiryDate: daysAhead(300) });
      receive("fifo", 10, { locationId: "loc-main", batchNumber: "SOON", expiryDate: daysAhead(40) });
      inv().relocateStock({ itemId: "fifo", qty: 5, fromLocationId: "loc-main", toLocationId: "loc-er", date: today() });
      expect(inv().layers.find((l) => l.locationId === "loc-er")!.batchNumber).toBe("SOON");
      expect(inv().layers.find((l) => l.batchNumber === "SOON" && l.locationId === "loc-main")!.remainingQty).toBe(5);
    });

    it("refuses to move more than is available at the source, or between the same location", () => {
      receive("fifo", 10, { locationId: "loc-main" });
      expect(inv().relocateStock({ itemId: "fifo", qty: 11, fromLocationId: "loc-main", toLocationId: "loc-er", date: today() }).ok).toBe(false);
      expect(inv().relocateStock({ itemId: "fifo", qty: 1, fromLocationId: "loc-main", toLocationId: "loc-main", date: today() }).ok).toBe(false);
      expect(inv().relocateStock({ itemId: "fifo", qty: 0, fromLocationId: "loc-main", toLocationId: "loc-er", date: today() }).ok).toBe(false);
    });

    it("treats stock with no recorded location as held at the main store", () => {
      receive("fifo", 10); // no locationId
      expect(inv().availableAtLocation("fifo", DEFAULT_STORE_LOCATION_ID)).toBe(10);
      expect(inv().availableAtLocation("fifo", "loc-er")).toBe(0);
      expect(inv().relocateStock({ itemId: "fifo", qty: 4, fromLocationId: DEFAULT_STORE_LOCATION_ID, toLocationId: "loc-er", date: today() }).ok).toBe(true);
      expect(inv().balanceByLocation("fifo", DEFAULT_STORE_LOCATION_ID)).toBe(6);
    });

    it("can move weighted-average opening stock that has no batch record, and it becomes a tracked layer", () => {
      useInventoryAccounting.setState({ items: [baseItem({ id: "wa", valuationMethod: "Weighted Average", currentQty: 100, averageCost: 50 })] });
      expect(inv().untrackedQtyOf("wa")).toBe(100);
      expect(inv().relocateStock({ itemId: "wa", qty: 30, fromLocationId: DEFAULT_STORE_LOCATION_ID, toLocationId: "loc-mat", date: today() }).ok).toBe(true);
      expect(inv().balanceByLocation("wa", "loc-mat")).toBe(30);
      expect(inv().untrackedQtyOf("wa")).toBe(70);
      expect(inv().itemById("wa")!.currentQty).toBe(100);
    });
  });

  describe("quarantine", () => {
    it("a quarantined layer is excluded from FEFO and from availability", () => {
      const held = receive("fifo", 10, { locationId: "loc-main", batchNumber: "HELD", expiryDate: daysAhead(30) });
      receive("fifo", 10, { locationId: "loc-main", batchNumber: "FINE", expiryDate: daysAhead(200) });
      expect(inv().quarantineLayer({ layerId: held.id, reason: "Temperature excursion" }).ok).toBe(true);

      expect(inv().fefoLayersForItem("fifo", "loc-main").map((l) => l.batchNumber)).toEqual(["FINE"]);
      expect(inv().availableQtyOf("fifo")).toBe(10);
      expect(inv().itemById("fifo")!.currentQty).toBe(20); // still owned stock, just not usable
    });

    it("issuing never touches a quarantined layer, and an over-limit issue is blocked", () => {
      const held = receive("fifo", 10, { batchNumber: "HELD", expiryDate: daysAhead(30) });
      receive("fifo", 10, { batchNumber: "FINE", expiryDate: daysAhead(200) });
      inv().quarantineLayer({ layerId: held.id, reason: "Recall" });

      expect(inv().issueStock({ itemId: "fifo", qty: 11, date: today(), postGL: false }).ok).toBe(false);
      expect(inv().issueStock({ itemId: "fifo", qty: 10, date: today(), postGL: false }).ok).toBe(true);
      expect(inv().layers.find((l) => l.id === held.id)!.remainingQty).toBe(10); // untouched
      expect(inv().layers.find((l) => l.batchNumber === "FINE")!.remainingQty).toBe(0);
    });

    it("releasing a layer makes it issuable again", () => {
      const held = receive("fifo", 10, { batchNumber: "HELD" });
      inv().quarantineLayer({ layerId: held.id, reason: "Suspect" });
      expect(inv().availableQtyOf("fifo")).toBe(0);
      expect(inv().releaseLayer({ layerId: held.id }).ok).toBe(true);
      expect(inv().availableQtyOf("fifo")).toBe(10);
      expect(inv().issueStock({ itemId: "fifo", qty: 10, date: today(), postGL: false }).ok).toBe(true);
    });

    it("requires a reason, and won't quarantine twice", () => {
      const layer = receive("fifo", 5);
      expect(inv().quarantineLayer({ layerId: layer.id, reason: "  " }).ok).toBe(false);
      expect(inv().quarantineLayer({ layerId: layer.id, reason: "Damaged" }).ok).toBe(true);
      expect(inv().quarantineLayer({ layerId: layer.id, reason: "Damaged" }).ok).toBe(false);
    });

    it("a lot recall quarantines that lot in every location and nothing else", () => {
      receive("fifo", 10, { locationId: "loc-main", batchNumber: "LOT-7" });
      receive("fifo", 10, { locationId: "loc-er", batchNumber: "LOT-7" });
      receive("fifo", 10, { locationId: "loc-main", batchNumber: "LOT-8" });

      const res = inv().recallLot({ itemId: "fifo", batchNumber: "LOT-7", reason: "Manufacturer recall" });
      expect(res).toMatchObject({ ok: true, quarantined: 2 });
      expect(inv().layers.filter((l) => l.status === "Quarantined").map((l) => l.batchNumber)).toEqual(["LOT-7", "LOT-7"]);
      expect(inv().layers.find((l) => l.batchNumber === "LOT-8")!.status).not.toBe("Quarantined");
      expect(inv().recallLot({ itemId: "fifo", batchNumber: "NOPE", reason: "x" }).ok).toBe(false);
    });

    it("a quarantined batch can be written off on its own, posting a write-off to the ledger", () => {
      const held = receive("fifo", 10, { batchNumber: "HELD", unitCost: 200 });
      receive("fifo", 10, { batchNumber: "FINE", unitCost: 100 });
      inv().quarantineLayer({ layerId: held.id, reason: "Contaminated" });
      const journalsBefore = useLedger.getState().entries.length;

      const res = inv().writeOff({ itemId: "fifo", qty: 10, date: today(), reason: "Contaminated batch", layerId: held.id });
      expect(res.ok).toBe(true);
      expect(res.value).toBe(2000); // 10 × the quarantined batch's own unit cost, not FIFO order
      expect(inv().layers.find((l) => l.id === held.id)!.remainingQty).toBe(0);
      expect(inv().layers.find((l) => l.batchNumber === "FINE")!.remainingQty).toBe(10);
      expect(useLedger.getState().entries.length).toBe(journalsBefore + 1);
    });

    it("refuses a batch write-off larger than the batch", () => {
      const layer = receive("fifo", 5);
      expect(inv().writeOff({ itemId: "fifo", qty: 6, date: today(), reason: "x", layerId: layer.id }).ok).toBe(false);
    });
  });

  describe("weighted-average layer bookkeeping", () => {
    it("issuing a weighted-average item keeps its layers in step with on-hand quantity", () => {
      receive("wa", 40, { unitCost: 50 });
      receive("wa", 60, { unitCost: 70 });
      expect(inv().issueStock({ itemId: "wa", qty: 55, date: today(), postGL: false }).ok).toBe(true);

      const layerTotal = inv().layers.filter((l) => l.itemId === "wa").reduce((n, l) => n + l.remainingQty, 0);
      expect(layerTotal).toBe(inv().itemById("wa")!.currentQty);
      expect(inv().layers.find((l) => l.qty === 40)!.remainingQty).toBe(0); // oldest drawn first
    });
  });

  describe("location-aware issue", () => {
    it("prefers the named location's batches over older stock elsewhere", () => {
      receive("fifo", 10, { locationId: "loc-main", batchNumber: "OLD" });
      receive("fifo", 10, { locationId: "loc-er", batchNumber: "AT-ER" });
      inv().issueStock({ itemId: "fifo", qty: 4, date: today(), postGL: false, locationId: "loc-er" });
      expect(inv().layers.find((l) => l.batchNumber === "AT-ER")!.remainingQty).toBe(6);
      expect(inv().layers.find((l) => l.batchNumber === "OLD")!.remainingQty).toBe(10);
    });
  });

  describe("stock requisitions", () => {
    function raise(qty: number) {
      const id = inv().createRequisition({ requestingLocationId: "loc-medward", date: today(), lines: [{ itemId: "fifo", qtyRequested: qty }], justification: "Ward restock" });
      inv().submitRequisition(id);
      inv().decideRequisition(id, "Approved");
      return id;
    }
    const get = (id: string) => inv().requisitions.find((r) => r.id === id)!;

    it("runs draft → pending → approved → fulfilled, moving the stock", () => {
      receive("fifo", 50, { locationId: "loc-main" });
      const id = inv().createRequisition({ requestingLocationId: "loc-medward", date: today(), lines: [{ itemId: "fifo", qtyRequested: 20 }] });
      expect(get(id).status).toBe("Draft");
      inv().submitRequisition(id);
      expect(get(id).status).toBe("Pending Approval");
      inv().decideRequisition(id, "Approved");
      expect(get(id).status).toBe("Approved");
      expect(get(id).approvedBy).toBeTruthy();

      const res = inv().fulfillRequisition(id, "loc-main");
      expect(res).toMatchObject({ ok: true, issued: 20 });
      expect(get(id).status).toBe("Fulfilled");
      expect(get(id).lines[0].qtyIssued).toBe(20);
      expect(inv().balanceByLocation("fifo", "loc-medward")).toBe(20);
      expect(inv().balanceByLocation("fifo", "loc-main")).toBe(30);
      expect(inv().movements.filter((m) => m.requisitionId === id)).toHaveLength(2);
    });

    it("fulfils what it can when stock is short, then completes on a later top-up", () => {
      receive("fifo", 8, { locationId: "loc-main" });
      const id = raise(20);
      expect(inv().fulfillRequisition(id, "loc-main")).toMatchObject({ ok: true, issued: 8 });
      expect(get(id).status).toBe("Partially Fulfilled");
      expect(get(id).lines[0].qtyIssued).toBe(8);

      receive("fifo", 30, { locationId: "loc-main" });
      expect(inv().fulfillRequisition(id, "loc-main")).toMatchObject({ ok: true, issued: 12 });
      expect(get(id).status).toBe("Fulfilled");
    });

    it("cannot be fulfilled before approval, from its own location, or with nothing available", () => {
      receive("fifo", 10, { locationId: "loc-main" });
      const id = inv().createRequisition({ requestingLocationId: "loc-medward", date: today(), lines: [{ itemId: "fifo", qtyRequested: 5 }] });
      expect(inv().fulfillRequisition(id, "loc-main").ok).toBe(false); // still a draft
      inv().submitRequisition(id);
      inv().decideRequisition(id, "Approved");
      expect(inv().fulfillRequisition(id, "loc-medward").ok).toBe(false); // own location
      expect(inv().fulfillRequisition(id, "loc-er").ok).toBe(false); // nothing at ER
      expect(get(id).status).toBe("Approved");
    });

    it("a rejected requisition records why and can't be fulfilled", () => {
      receive("fifo", 10, { locationId: "loc-main" });
      const id = inv().createRequisition({ requestingLocationId: "loc-medward", date: today(), lines: [{ itemId: "fifo", qtyRequested: 5 }] });
      inv().submitRequisition(id);
      inv().decideRequisition(id, "Rejected", "Not needed this week");
      expect(get(id).status).toBe("Rejected");
      expect(get(id).rejectionReason).toBe("Not needed this week");
      expect(inv().fulfillRequisition(id, "loc-main").ok).toBe(false);
    });

    it("quarantined stock is never handed over", () => {
      const held = receive("fifo", 10, { locationId: "loc-main", batchNumber: "HELD" });
      inv().quarantineLayer({ layerId: held.id, reason: "Recall" });
      const id = raise(5);
      expect(inv().fulfillRequisition(id, "loc-main").ok).toBe(false);
    });

    it("can be cancelled until it's fulfilled", () => {
      const id = inv().createRequisition({ requestingLocationId: "loc-medward", date: today(), lines: [{ itemId: "fifo", qtyRequested: 5 }] });
      inv().cancelRequisition(id);
      expect(get(id).status).toBe("Cancelled");
    });
  });

  describe("stock count (existing engine, surfaced on the ops page)", () => {
    it("posts an adjustment for a counted variance", () => {
      receive("fifo", 20);
      const id = inv().createStockCount({ date: today(), itemIds: ["fifo"] });
      inv().updateCountLine(id, "fifo", 17);
      const res = inv().postStockCount(id);
      expect(res).toMatchObject({ ok: true, adjustments: 1 });
      expect(inv().itemById("fifo")!.currentQty).toBe(17);
      expect(inv().counts.find((c) => c.id === id)!.status).toBe("Posted");
    });
  });
});
