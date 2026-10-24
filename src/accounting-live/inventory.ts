import { create } from "zustand";
import { useInventoryAccounting } from "@/store/accounting/useInventoryAccounting";
import { accountingRequest, emrRequest, newIdempotencyKey } from "@/emr-live/client";
import { storesFromApi, type ApiStores } from "@/emr-live/stores";
import { adoptLiveIdentity, liveChange, uuid } from "@/workforce-live/sync";
import { loadLedger } from "./ledger";
import { useLedger } from "@/store/accounting/useLedger";
import { loadIntegrations } from "./integrations";

// Inventory accounting in live mode (GET /inventory): the hospital's own stores — items, batches and
// movements — valued at their batch costs, each item on its ledger accounts. Stock that is paid for
// outside a bill is received here straight into the books; issues, adjustments, write-offs and counts go
// to the hospital stores (they need stores rights) and the Stores connector posts them. Moving stock
// between branches is a move between store locations (Inventory → Transfers), and says so. Landed costs
// raise the cost of the batches on hand.

type Accounts = Record<string, { inventory: number; cogs: number }>;
export const useLiveInventoryMeta = create<{ loaded: boolean; mainLocationId: string }>(() => ({ loaded: false, mainLocationId: "" }));

export async function loadInventory() {
  const { data } = await accountingRequest<{ data: ApiStores & { accounts: Accounts } }>("/inventory");
  const stores = storesFromApi(data);
  useLiveInventoryMeta.setState({ loaded: true, mainLocationId: stores.mainLocationId });
  useInventoryAccounting.setState({
    items: stores.items.map((i) => ({ ...i, inventoryAccountNumber: data.accounts[i.id]?.inventory ?? 0, cogsAccountNumber: data.accounts[i.id]?.cogs ?? 0 })),
    layers: stores.layers, movements: stores.movements, counts: stores.counts, locationTransfers: stores.locationTransfers, requisitions: stores.requisitions, transfers: [],
  });
  adoptLiveIdentity(null);
}

// after a stores change the connector has something to post: the integrations status (and auto-sync) follow
const reload = async () => { await Promise.all([loadInventory(), loadLedger(), loadIntegrations()]); };
const I = () => useInventoryAccounting.getState();
const main = () => useLiveInventoryMeta.getState().mainLocationId;
const day = (iso?: string) => (iso ? iso.slice(0, 10) : undefined);
const defined = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== ""));
const stores = (path: string, body: unknown) => emrRequest(`/stores${path}`, { method: "POST", idempotencyKey: newIdempotencyKey(), body });
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function goLiveInventory() {
  useInventoryAccounting.setState({
    receiveStock: (input) => {
      if (!I().itemById(input.itemId)) return { ok: false, error: "Item not found.", value: 0 };
      if (!(input.qty > 0)) return { ok: false, error: "Enter a quantity.", value: 0 };
      // with a paying account the receipt is booked now; without one it waits for its bill
      void liveChange(() => accountingRequest("/inventory/receipts", {
        method: "POST", body: defined({
          itemId: input.itemId, locationId: input.locationId, qty: input.qty, unitCostMinor: Math.round(input.unitCost * 100), fundingAccount: input.postGL ? input.fundingAccount : undefined,
          batchNumber: input.batchNumber, expiryDate: day(input.expiryDate), reference: input.reference, note: input.note,
        }),
      }), reload);
      return { ok: true, value: round2(input.qty * input.unitCost) };
    },
    issueStock: (input) => {
      if (input.qty > I().availableQtyOf(input.itemId)) return { ok: false, error: "Not enough stock on hand.", cogs: 0 };
      void liveChange(() => stores("/issues", defined({ itemId: input.itemId, locationId: input.locationId ?? main(), qty: input.qty, department: input.department, purpose: input.purpose ?? input.note, reference: input.reference })), reload);
      return { ok: true, cogs: round2(input.qty * I().unitCostOf(input.itemId)) };
    },
    adjustStock: (input) => {
      if (!input.qtyDelta) return { ok: false, error: "The adjustment cannot be zero." };
      void liveChange(() => stores("/adjustments", { itemId: input.itemId, locationId: input.locationId ?? main(), qtyDelta: input.qtyDelta, reason: input.reason }), reload);
      return { ok: true };
    },
    writeOff: (input) => {
      if (input.qty > I().availableQtyOf(input.itemId) && !input.layerId) return { ok: false, error: "Not enough stock on hand.", value: 0 };
      void liveChange(() => stores("/write-offs", defined({ itemId: input.itemId, qty: input.qty, reason: input.reason, locationId: input.locationId, batchId: input.layerId })), reload);
      return { ok: true, value: round2(input.qty * I().unitCostOf(input.itemId)) };
    },

    createStockCount: (input) => {
      const id = uuid();
      void liveChange(() => emrRequest("/stores/counts", { method: "POST", body: defined({ id, locationId: main(), itemIds: input.itemIds, note: input.note }) }), reload);
      return id;
    },
    updateCountLine: (countId, itemId, countedQty) => useInventoryAccounting.setState((s) => ({
      counts: s.counts.map((c) => (c.id !== countId ? c : { ...c, lines: c.lines.map((l) => (l.itemId === itemId ? { ...l, countedQty } : l)) })),
    })),
    postStockCount: (countId) => {
      const count = I().counts.find((c) => c.id === countId) as (ReturnType<typeof I>["counts"][number] & { version?: number }) | undefined;
      if (!count || count.status !== "Draft") return { ok: false, error: "This count is not open." };
      const changed = count.lines.filter((l) => l.countedQty !== l.systemQty);
      const netValue = round2(changed.reduce((n, l) => n + (l.countedQty - l.systemQty) * I().unitCostOf(l.itemId), 0));
      void liveChange(async () => {
        for (const l of count.lines) await emrRequest(`/stores/counts/${countId}/lines`, { method: "POST", body: { itemId: l.itemId, countedQty: l.countedQty } });
        await emrRequest(`/stores/counts/${countId}/post`, { method: "POST", version: count.version ?? 1, body: {} });
      }, reload);
      return { ok: true, adjustments: changed.length, netValue };
    },

    transferStock: () => ({ ok: false, error: "Moving stock between branches isn't connected to the hospital stores: they are locations of one organization. Move stock between them in Inventory → Transfers." }),
    // Freight, duty and clearing on stock already received: each item's share raises the unit cost of its
    // batches on hand; what falls on stock already used goes to cost of goods sold (the server works it out).
    applyLandedCost: (input) => {
      const allocations = input.allocations.filter((a) => a.amount > 0);
      if (!allocations.length) return { ok: false, error: "Enter at least one cost allocation." };
      const credit = useLedger.getState().accountByNumber(input.creditAccount);
      if (!credit || !credit.isActive) return { ok: false, error: `Account ${input.creditAccount} is not available.` };
      if (!credit.allowManualEntry) return { ok: false, error: `${credit.number} ${credit.name} is posted only by its subledger. Record the charge as a bill instead.` };
      void liveChange(() => accountingRequest("/inventory/landed-costs", {
        method: "POST", body: { id: uuid(), date: input.date.slice(0, 10), description: input.description.trim() || "Landed costs", creditAccount: input.creditAccount, allocations },
      }), reload);
      return { ok: true };
    },
  });
}

export function clearInventory() {
  useLiveInventoryMeta.setState({ loaded: false, mainLocationId: "" });
  useInventoryAccounting.setState({ items: [], layers: [], movements: [], counts: [], locationTransfers: [], requisitions: [], transfers: [] });
}
