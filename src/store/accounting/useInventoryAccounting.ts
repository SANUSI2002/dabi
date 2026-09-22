import { create } from "zustand";
import { audit } from "@/store/useAudit";
import { useLedger } from "@/store/accounting/useLedger";
import { ACCT } from "@/data/accounting/coa";
import { useIdentity } from "@/store/useIdentity";
import {
  seedInventoryItems, seedCostLayers, seedInventoryMovements, seedStockTransfers, seedStockCounts, seedLocationTransfers, seedStockRequisitions, DEFAULT_STORE_LOCATION_ID,
  type InventoryItem, type CostLayer, type InventoryMovement, type ValuationMethod, type MovementType, type StockTransfer, type StockCount, type LocationTransfer, type StockRequisition,
} from "@/data/accounting/inventory";

const rid = () => Math.random().toString(36).slice(2, 9);
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export type ReorderSuggestion = { item: InventoryItem; shortBy: number; suggestedQty: number; estCost: number; preferredVendorId?: string };

type InvState = {
  items: InventoryItem[];
  layers: CostLayer[];
  movements: InventoryMovement[];
  transfers: StockTransfer[];
  counts: StockCount[];
  locationTransfers: LocationTransfer[];
  requisitions: StockRequisition[];

  itemById: (id: string) => InventoryItem | undefined;
  itemByDrugId: (drugId: string) => InventoryItem | undefined;
  addItem: (input: { sku: string; name: string; category: InventoryItem["category"]; unit: string; valuationMethod: ValuationMethod; inventoryAccountNumber: number; cogsAccountNumber: number; reorderLevel: number; linkedDrugId?: string }) => string;

  valuationOf: (itemId: string) => number;
  unitCostOf: (itemId: string) => number;
  totalValuation: () => number;
  movementsFor: (itemId: string) => InventoryMovement[];

  receiveStock: (input: { itemId: string; qty: number; unitCost: number; date: string; reference?: string; note?: string; sourceBillId?: string; postGL?: boolean; fundingAccount?: number; expiryDate?: string; batchNumber?: string; locationId?: string }) => { ok: boolean; error?: string; value: number; layer?: CostLayer };
  issueStock: (input: { itemId: string; qty: number; date: string; reference?: string; note?: string; postGL?: boolean; locationId?: string; department?: string; purpose?: string; requisitionId?: string }) => { ok: boolean; error?: string; cogs: number };
  adjustStock: (input: { itemId: string; qtyDelta: number; date: string; reason: string; locationId?: string }) => { ok: boolean; error?: string };
  writeOff: (input: { itemId: string; qty: number; date: string; reason: string; locationId?: string; layerId?: string }) => { ok: boolean; error?: string; value: number };

  /** physical-batch view over cost layers — never stored, always derived */
  layersForItem: (itemId: string) => CostLayer[];
  expiryStatus: (layer: CostLayer, alertDays?: number) => "Active" | "Expiring Soon" | "Expired";
  fefoLayersForItem: (itemId: string, locationId?: string) => CostLayer[];
  balanceByLocation: (itemId: string, locationId: string) => number;

  /** on-hand minus stock held in quarantine — what may actually be issued or moved */
  availableQtyOf: (itemId: string) => number;
  /** weighted-average stock with no batch record (opening balances) — implicitly held at the default store */
  untrackedQtyOf: (itemId: string) => number;
  /** how much of an item can be moved out of / issued from one location right now */
  availableAtLocation: (itemId: string, locationId: string) => number;
  quarantineLayer: (input: { layerId: string; reason: string }) => { ok: boolean; error?: string };
  releaseLayer: (input: { layerId: string; note?: string }) => { ok: boolean; error?: string };
  /** quarantine every remaining layer of one lot, across all locations */
  recallLot: (input: { itemId: string; batchNumber: string; reason: string }) => { ok: boolean; quarantined: number; error?: string };

  // physical move between storage locations inside one entity — posts no journal entry
  relocateStock: (input: { itemId: string; qty: number; fromLocationId: string; toLocationId: string; date: string; reference?: string; requisitionId?: string }) => { ok: boolean; error?: string };
  createRequisition: (input: { requestingLocationId: string; date: string; neededBy?: string; lines: { itemId: string; qtyRequested: number }[]; justification?: string }) => string;
  submitRequisition: (id: string) => void;
  decideRequisition: (id: string, decision: "Approved" | "Rejected", comment?: string) => void;
  cancelRequisition: (id: string) => void;
  fulfillRequisition: (id: string, fulfillingLocationId: string) => { ok: boolean; issued: number; error?: string };
  requisitionsFor: (locationId: string) => StockRequisition[];

  // B24 — transfer inventory value between branches (intercompany accounts, eliminated on consolidation)
  transferStock: (input: { itemId: string; qty: number; fromBranchId: string; toBranchId: string; date: string; reference?: string }) => { ok: boolean; error?: string };
  // B25 — physical count session
  createStockCount: (input: { date: string; itemIds: string[]; note?: string }) => string;
  updateCountLine: (countId: string, itemId: string, countedQty: number) => void;
  postStockCount: (countId: string) => { ok: boolean; error?: string; adjustments?: number; netValue?: number };
  // B26 — capitalise landed costs (freight/duty/clearing) into inventory
  applyLandedCost: (input: { date: string; description: string; creditAccount: number; allocations: { itemId: string; amount: number }[] }) => { ok: boolean; error?: string };
  // B27 — reorder
  reorderSuggestions: () => ReorderSuggestion[];
};

const inLocation = (layer: CostLayer, locationId?: string) =>
  !locationId || layer.locationId === locationId || (!layer.locationId && locationId === DEFAULT_STORE_LOCATION_ID);

/** consume `qty` from cost layers, returns the cost value. Layers held in quarantine are
 *  never touched unless one is named explicitly (a quarantined batch being written off).
 *  Weighted-average items are still VALUED at the running average, but the layers are
 *  walked too so each layer's remainingQty (the physical batch balance) stays true. */
function consume(state: InvState, item: InventoryItem, qty: number, opts?: { layerId?: string; locationId?: string }): { value: number; layers: CostLayer[] } {
  const eligible = (l: CostLayer) => l.itemId === item.id && l.remainingQty > 0 && (opts?.layerId ? l.id === opts.layerId : l.status !== "Quarantined");
  const preferred = (l: CostLayer) => (opts?.locationId && inLocation(l, opts.locationId) ? 0 : 1);
  let remaining = qty;
  let layerValue = 0;
  const layers = state.layers
    .slice()
    .sort((a, b) => preferred(a) - preferred(b) || new Date(a.date).getTime() - new Date(b.date).getTime())
    .map((l) => {
      if (remaining <= 0 || !eligible(l)) return l;
      const take = Math.min(remaining, l.remainingQty);
      layerValue += take * l.unitCost;
      remaining = round2(remaining - take);
      return { ...l, remainingQty: round2(l.remainingQty - take) };
    });
  if (item.valuationMethod === "Weighted Average") return { value: round2(qty * item.averageCost), layers };
  // if layers ran short, price the shortfall at average cost
  if (remaining > 0) layerValue += remaining * item.averageCost;
  return { value: round2(layerValue), layers };
}

export const useInventoryAccounting = create<InvState>((set, get) => ({
  items: seedInventoryItems,
  layers: seedCostLayers,
  movements: seedInventoryMovements,
  transfers: seedStockTransfers,
  counts: seedStockCounts,
  locationTransfers: seedLocationTransfers,
  requisitions: seedStockRequisitions,

  itemById: (id) => get().items.find((i) => i.id === id),
  itemByDrugId: (drugId) => get().items.find((i) => i.linkedDrugId === drugId),
  unitCostOf: (itemId) => {
    const item = get().itemById(itemId);
    if (!item) return 0;
    if (item.valuationMethod === "Weighted Average") return item.averageCost;
    const open = get().layers.filter((l) => l.itemId === itemId && l.remainingQty > 0).sort((a, b) => a.date.localeCompare(b.date))[0];
    return open?.unitCost ?? item.averageCost;
  },

  addItem: (input) => {
    const id = `itm-${rid()}`;
    set((s) => ({ items: [...s.items, { ...input, id, currentQty: 0, averageCost: 0, active: true }] }));
    audit(`created inventory item ${input.name}`, `accounting/inventory/${input.sku}`);
    return id;
  },

  valuationOf: (itemId) => {
    const item = get().itemById(itemId);
    if (!item) return 0;
    if (item.valuationMethod === "Weighted Average") return round2(item.currentQty * item.averageCost);
    return round2(get().layers.filter((l) => l.itemId === itemId).reduce((n, l) => n + l.remainingQty * l.unitCost, 0));
  },
  totalValuation: () => round2(get().items.reduce((n, i) => n + get().valuationOf(i.id), 0)),
  movementsFor: (itemId) => get().movements.filter((m) => m.itemId === itemId),

  receiveStock: (input) => {
    const item = get().itemById(input.itemId);
    if (!item) return { ok: false, error: "Item not found.", value: 0 };
    const value = round2(input.qty * input.unitCost);
    let jeId: string | undefined;
    if (input.postGL) {
      const je = useLedger.getState().postJournal({
        date: input.date,
        source: "Inventory",
        memo: `Stock receipt — ${item.name}`,
        reference: input.reference,
        lines: [
          { accountNumber: item.inventoryAccountNumber, debit: value, credit: 0, description: `${input.qty} ${item.unit} @ ${input.unitCost}` },
          { accountNumber: input.fundingAccount ?? ACCT.apTrade, debit: 0, credit: value, description: `Purchase — ${item.name}` },
        ],
      });
      if (!je.ok) return { ok: false, error: je.error, value: 0 };
      jeId = je.entry?.id;
    }
    const layer: CostLayer = {
      id: `cl-${rid()}`, itemId: item.id, date: input.date, qty: input.qty, remainingQty: input.qty, unitCost: input.unitCost, sourceBillId: input.sourceBillId,
      expiryDate: input.expiryDate, batchNumber: input.batchNumber, locationId: input.locationId,
    };
    const newQty = round2(item.currentQty + input.qty);
    const newAvg = newQty > 0 ? round2((item.currentQty * item.averageCost + value) / newQty) : item.averageCost;
    set((s) => ({
      layers: [...s.layers, layer],
      items: s.items.map((i) => (i.id === item.id ? { ...i, currentQty: newQty, averageCost: newAvg } : i)),
      movements: [{ id: `im-${rid()}`, itemId: item.id, date: input.date, type: "Receipt" as MovementType, qtyDelta: input.qty, unitCost: input.unitCost, value, reference: input.reference, note: input.note, journalEntryId: jeId, createdAt: new Date().toISOString(), locationId: input.locationId }, ...s.movements],
    }));
    audit(`received ${input.qty} ${item.unit} of ${item.name}`, `accounting/inventory/${item.sku}`);
    return { ok: true, value, layer };
  },

  issueStock: (input) => {
    const item = get().itemById(input.itemId);
    if (!item) return { ok: false, error: "Item not found.", cogs: 0 };
    if (!(input.qty > 0)) return { ok: false, error: "Enter a quantity greater than zero.", cogs: 0 };
    const available = get().availableQtyOf(item.id);
    if (input.qty > available + 0.001) return { ok: false, error: `Only ${available} ${item.unit} available${available < item.currentQty ? " (the rest is in quarantine)" : ""}.`, cogs: 0 };
    const { value, layers } = consume(get(), item, input.qty, { locationId: input.locationId });
    let jeId: string | undefined;
    if (input.postGL !== false) {
      const je = useLedger.getState().postJournal({
        date: input.date,
        source: "Inventory",
        memo: `Stock issued — ${item.name}`,
        reference: input.reference,
        lines: [
          { accountNumber: item.cogsAccountNumber, debit: value, credit: 0, description: `COGS — ${input.qty} ${item.unit}` },
          { accountNumber: item.inventoryAccountNumber, debit: 0, credit: value, description: `Inventory relieved — ${item.name}` },
        ],
      });
      if (!je.ok) return { ok: false, error: je.error, cogs: 0 };
      jeId = je.entry?.id;
    }
    set((s) => ({
      layers,
      items: s.items.map((i) => (i.id === item.id ? { ...i, currentQty: round2(i.currentQty - input.qty) } : i)),
      movements: [{ id: `im-${rid()}`, itemId: item.id, date: input.date, type: "Issue" as MovementType, qtyDelta: -input.qty, unitCost: round2(value / input.qty), value: -value, reference: input.reference, note: input.note, journalEntryId: jeId, createdAt: new Date().toISOString(), locationId: input.locationId, department: input.department, purpose: input.purpose, requisitionId: input.requisitionId }, ...s.movements],
    }));
    audit(`issued ${input.qty} ${item.unit} of ${item.name} (COGS ${value.toLocaleString()})`, `accounting/inventory/${item.sku}`);
    return { ok: true, cogs: value };
  },

  adjustStock: (input) => {
    const item = get().itemById(input.itemId);
    if (!item) return { ok: false, error: "Item not found." };
    const value = round2(Math.abs(input.qtyDelta) * item.averageCost);
    const up = input.qtyDelta > 0;
    const je = useLedger.getState().postJournal({
      date: input.date,
      source: "Inventory",
      memo: `Stock adjustment — ${item.name} (${input.reason})`,
      lines: up
        ? [{ accountNumber: item.inventoryAccountNumber, debit: value, credit: 0 }, { accountNumber: ACCT.miscExpense, debit: 0, credit: value, description: "Stock count gain" }]
        : [{ accountNumber: ACCT.miscExpense, debit: value, credit: 0, description: "Stock count shrinkage" }, { accountNumber: item.inventoryAccountNumber, debit: 0, credit: value }],
    });
    if (!je.ok) return { ok: false, error: je.error };
    set((s) => ({
      items: s.items.map((i) => (i.id === item.id ? { ...i, currentQty: round2(i.currentQty + input.qtyDelta) } : i)),
      movements: [{ id: `im-${rid()}`, itemId: item.id, date: input.date, type: "Adjustment" as MovementType, qtyDelta: input.qtyDelta, unitCost: item.averageCost, value: up ? value : -value, note: input.reason, journalEntryId: je.entry?.id, createdAt: new Date().toISOString(), locationId: input.locationId }, ...s.movements],
    }));
    audit(`adjusted stock of ${item.name} by ${input.qtyDelta}`, `accounting/inventory/${item.sku}`);
    return { ok: true };
  },

  writeOff: (input) => {
    const item = get().itemById(input.itemId);
    if (!item) return { ok: false, error: "Item not found.", value: 0 };
    if (!(input.qty > 0)) return { ok: false, error: "Enter a quantity greater than zero.", value: 0 };
    if (input.layerId) {
      // a named batch (e.g. a quarantined one) is written off on its own, whatever its status
      const layer = get().layers.find((l) => l.id === input.layerId && l.itemId === item.id);
      if (!layer) return { ok: false, error: "That batch was not found for this item.", value: 0 };
      if (input.qty > layer.remainingQty + 0.001) return { ok: false, error: `Only ${layer.remainingQty} ${item.unit} left in that batch.`, value: 0 };
    } else {
      const available = get().availableQtyOf(item.id);
      if (input.qty > available + 0.001) return { ok: false, error: `Only ${available} ${item.unit} available${available < item.currentQty ? " (the rest is in quarantine)" : ""}.`, value: 0 };
    }
    const { value, layers } = consume(get(), item, input.qty, { layerId: input.layerId, locationId: input.locationId });
    const je = useLedger.getState().postJournal({
      date: input.date,
      source: "Inventory",
      memo: `Stock write-off — ${item.name} (${input.reason})`,
      lines: [
        { accountNumber: ACCT.miscExpense, debit: value, credit: 0, description: `Write-off — ${input.reason}` },
        { accountNumber: item.inventoryAccountNumber, debit: 0, credit: value, description: `Inventory written off — ${item.name}` },
      ],
    });
    if (!je.ok) return { ok: false, error: je.error, value: 0 };
    set((s) => ({
      layers,
      items: s.items.map((i) => (i.id === item.id ? { ...i, currentQty: round2(i.currentQty - input.qty) } : i)),
      movements: [{ id: `im-${rid()}`, itemId: item.id, date: input.date, type: "Write-off" as MovementType, qtyDelta: -input.qty, unitCost: round2(value / input.qty), value: -value, note: input.reason, journalEntryId: je.entry?.id, createdAt: new Date().toISOString(), locationId: input.locationId }, ...s.movements],
    }));
    audit(`wrote off ${input.qty} ${item.unit} of ${item.name}`, `accounting/inventory/${item.sku}`);
    return { ok: true, value };
  },

  transferStock: (input) => {
    const item = get().itemById(input.itemId);
    if (!item) return { ok: false, error: "Item not found." };
    if (input.fromBranchId === input.toBranchId) return { ok: false, error: "Pick two different branches." };
    const led = useLedger.getState();
    const unit = get().unitCostOf(input.itemId);
    const value = round2(input.qty * unit);
    const fromName = led.branchById(input.fromBranchId)?.name;
    const toName = led.branchById(input.toBranchId)?.name;
    // from-branch: Dr Intercompany Receivable (1150) / Cr Inventory
    const out = led.postJournal({
      date: input.date, source: "Inventory", branchId: input.fromBranchId, memo: `Stock transfer out — ${item.name} to ${toName}`, reference: input.reference,
      lines: [
        { accountNumber: ACCT.intercompanyReceivable, debit: value, credit: 0, description: `Due from ${toName}` },
        { accountNumber: item.inventoryAccountNumber, debit: 0, credit: value, description: `${input.qty} ${item.unit} transferred out` },
      ],
    });
    // to-branch: Dr Inventory / Cr Intercompany Payable (2150)
    const inn = led.postJournal({
      date: input.date, source: "Inventory", branchId: input.toBranchId, memo: `Stock transfer in — ${item.name} from ${fromName}`, reference: input.reference,
      lines: [
        { accountNumber: item.inventoryAccountNumber, debit: value, credit: 0, description: `${input.qty} ${item.unit} received` },
        { accountNumber: ACCT.intercompanyPayable, debit: 0, credit: value, description: `Due to ${fromName}` },
      ],
    });
    if (!out.ok || !inn.ok) return { ok: false, error: out.error ?? inn.error };
    const transfer: StockTransfer = { id: `st-${rid()}`, itemId: input.itemId, fromBranchId: input.fromBranchId, toBranchId: input.toBranchId, qty: input.qty, unitCost: unit, value, date: input.date, reference: input.reference, journalEntryIds: [out.entry?.id, inn.entry?.id].filter((x): x is string => !!x), createdBy: useIdentity.getState().user.id, createdAt: new Date().toISOString() };
    set((s) => ({ transfers: [transfer, ...s.transfers] }));
    audit(`transferred ${input.qty} ${item.unit} of ${item.name} between branches`, `accounting/inventory/${item.sku}`);
    return { ok: true };
  },

  createStockCount: (input) => {
    const id = `sc-${rid()}`;
    const lines = input.itemIds.map((itemId) => ({ itemId, systemQty: get().itemById(itemId)?.currentQty ?? 0, countedQty: get().itemById(itemId)?.currentQty ?? 0 }));
    const number = `SC-${new Date().getUTCFullYear()}-${String(get().counts.length + 1).padStart(4, "0")}`;
    set((s) => ({ counts: [{ id, number, date: input.date, status: "Draft", lines, note: input.note, createdBy: useIdentity.getState().user.id, createdAt: new Date().toISOString() }, ...s.counts] }));
    audit(`opened stock count ${number} (${lines.length} items)`, `accounting/inventory/count/${number}`);
    return id;
  },
  updateCountLine: (countId, itemId, countedQty) =>
    set((s) => ({ counts: s.counts.map((c) => (c.id === countId ? { ...c, lines: c.lines.map((l) => (l.itemId === itemId ? { ...l, countedQty } : l)) } : c)) })),
  postStockCount: (countId) => {
    const count = get().counts.find((c) => c.id === countId);
    if (!count) return { ok: false, error: "Count not found." };
    if (count.status === "Posted") return { ok: false, error: "Already posted." };
    let adjustments = 0;
    let netValue = 0;
    for (const l of count.lines) {
      const delta = round2(l.countedQty - (get().itemById(l.itemId)?.currentQty ?? l.systemQty));
      if (Math.abs(delta) < 0.001) continue;
      const item = get().itemById(l.itemId)!;
      const res = get().adjustStock({ itemId: l.itemId, qtyDelta: delta, date: count.date, reason: `Stock count ${count.number}` });
      if (res.ok) { adjustments++; netValue = round2(netValue + delta * item.averageCost); }
    }
    set((s) => ({ counts: s.counts.map((c) => (c.id === countId ? { ...c, status: "Posted", postedAt: new Date().toISOString() } : c)) }));
    audit(`posted stock count ${count.number} — ${adjustments} adjustment(s), net ${netValue.toLocaleString()}`, `accounting/inventory/count/${count.number}`);
    return { ok: true, adjustments, netValue };
  },

  applyLandedCost: (input) => {
    const led = useLedger.getState();
    const total = round2(input.allocations.reduce((n, a) => n + a.amount, 0));
    if (total <= 0) return { ok: false, error: "Enter at least one cost allocation." };
    const lines = input.allocations.filter((a) => a.amount > 0).map((a) => {
      const item = get().itemById(a.itemId)!;
      return { accountNumber: item.inventoryAccountNumber, debit: round2(a.amount), credit: 0, description: `Landed cost — ${item.name}` };
    });
    lines.push({ accountNumber: input.creditAccount, debit: 0, credit: total, description: input.description });
    const je = led.postJournal({ date: input.date, source: "Inventory", memo: `Landed costs — ${input.description}`, lines });
    if (!je.ok) return { ok: false, error: je.error };
    set((s) => ({
      items: s.items.map((i) => {
        const alloc = input.allocations.find((a) => a.itemId === i.id);
        if (!alloc || alloc.amount <= 0 || i.currentQty <= 0) return i;
        return { ...i, averageCost: round2(i.averageCost + alloc.amount / i.currentQty) };
      }),
      layers: s.layers.map((l) => {
        const alloc = input.allocations.find((a) => a.itemId === l.itemId);
        const item = get().itemById(l.itemId);
        if (!alloc || alloc.amount <= 0 || !item || item.currentQty <= 0) return l;
        return { ...l, unitCost: round2(l.unitCost + alloc.amount / item.currentQty) };
      }),
    }));
    audit(`capitalised ${total.toLocaleString()} of landed costs across ${lines.length - 1} item(s)`, "accounting/inventory/landed-cost");
    return { ok: true };
  },

  reorderSuggestions: () =>
    get().items
      .filter((i) => i.active && i.reorderLevel > 0 && i.currentQty <= i.reorderLevel)
      .map((item) => {
        const suggestedQty = item.reorderQty ?? Math.max(item.reorderLevel * 2 - item.currentQty, item.reorderLevel);
        return { item, shortBy: round2(item.reorderLevel - item.currentQty), suggestedQty, estCost: round2(suggestedQty * (get().unitCostOf(item.id) || item.averageCost)), preferredVendorId: item.preferredVendorId };
      }),

  layersForItem: (itemId) => get().layers.filter((l) => l.itemId === itemId).sort((a, b) => a.date.localeCompare(b.date)),

  // "Expiring Soon"/"Expired" are always derived from today's date against the
  // layer's own expiryDate, never stored — so they can't go stale.
  expiryStatus: (layer, alertDays = 30) => {
    if (!layer.expiryDate) return "Active";
    const daysRemaining = Math.ceil((new Date(layer.expiryDate).getTime() - Date.now()) / 86400000);
    if (daysRemaining < 0) return "Expired";
    if (daysRemaining <= alertDays) return "Expiring Soon";
    return "Active";
  },

  // First Expiry, First Out — earliest-expiring usable layer(s) first, optionally
  // scoped to one storage location. Quarantined and expired layers are never usable.
  // Ordinary FIFO/weighted-average costing (consume(), above) is a separate concern —
  // this is purely which physical batch a move or dispense should be picked from.
  fefoLayersForItem: (itemId, locationId) =>
    get()
      .layersForItem(itemId)
      .filter((l) => l.remainingQty > 0 && l.status !== "Quarantined" && inLocation(l, locationId) && get().expiryStatus(l) !== "Expired")
      .sort((a, b) => {
        if (!a.expiryDate) return 1;
        if (!b.expiryDate) return -1;
        return a.expiryDate.localeCompare(b.expiryDate);
      }),

  balanceByLocation: (itemId, locationId) =>
    round2(
      get()
        .layersForItem(itemId)
        .filter((l) => inLocation(l, locationId))
        .reduce((sum, l) => sum + l.remainingQty, 0),
    ),

  availableQtyOf: (itemId) => {
    const item = get().itemById(itemId);
    if (!item) return 0;
    const held = get().layers.filter((l) => l.itemId === itemId && l.status === "Quarantined").reduce((n, l) => n + l.remainingQty, 0);
    return Math.max(0, round2(item.currentQty - held));
  },

  untrackedQtyOf: (itemId) => {
    const item = get().itemById(itemId);
    // FIFO valuation IS the sum of its layers, so stock without a layer can't be moved
    // around without changing the books — only weighted-average stock can.
    if (!item || item.valuationMethod !== "Weighted Average") return 0;
    const tracked = get().layers.filter((l) => l.itemId === itemId).reduce((n, l) => n + l.remainingQty, 0);
    return Math.max(0, round2(item.currentQty - tracked));
  },

  availableAtLocation: (itemId, locationId) => {
    const tracked = get().fefoLayersForItem(itemId, locationId).reduce((n, l) => n + l.remainingQty, 0);
    const untracked = locationId === DEFAULT_STORE_LOCATION_ID ? get().untrackedQtyOf(itemId) : 0;
    return round2(Math.min(tracked + untracked, get().availableQtyOf(itemId)));
  },

  quarantineLayer: (input) => {
    const layer = get().layers.find((l) => l.id === input.layerId);
    if (!layer) return { ok: false, error: "Batch not found." };
    if (!input.reason.trim()) return { ok: false, error: "A reason is required to quarantine a batch." };
    if (layer.status === "Quarantined") return { ok: false, error: "That batch is already in quarantine." };
    const item = get().itemById(layer.itemId);
    set((s) => ({
      layers: s.layers.map((l) => (l.id === layer.id ? { ...l, status: "Quarantined" as const, quarantineReason: input.reason.trim(), quarantinedBy: useIdentity.getState().user.name, quarantinedAt: new Date().toISOString() } : l)),
    }));
    audit(`quarantined ${item?.name ?? layer.itemId} batch ${layer.batchNumber ?? layer.id} — ${input.reason.trim()}`, `accounting/inventory/${item?.sku ?? layer.itemId}`);
    return { ok: true };
  },

  releaseLayer: (input) => {
    const layer = get().layers.find((l) => l.id === input.layerId);
    if (!layer) return { ok: false, error: "Batch not found." };
    if (layer.status !== "Quarantined") return { ok: false, error: "That batch is not in quarantine." };
    const item = get().itemById(layer.itemId);
    set((s) => ({
      layers: s.layers.map((l) => (l.id === layer.id ? { ...l, status: "Active" as const, quarantineReason: undefined, quarantinedBy: undefined, quarantinedAt: undefined } : l)),
    }));
    audit(`released ${item?.name ?? layer.itemId} batch ${layer.batchNumber ?? layer.id} from quarantine${input.note ? ` — ${input.note}` : ""}`, `accounting/inventory/${item?.sku ?? layer.itemId}`);
    return { ok: true };
  },

  recallLot: (input) => {
    if (!input.reason.trim()) return { ok: false, quarantined: 0, error: "A reason is required to recall a lot." };
    const hit = get().layers.filter((l) => l.itemId === input.itemId && l.batchNumber === input.batchNumber && l.remainingQty > 0 && l.status !== "Quarantined");
    if (hit.length === 0) return { ok: false, quarantined: 0, error: "No unquarantined stock found for that lot." };
    for (const l of hit) get().quarantineLayer({ layerId: l.id, reason: `Lot recall — ${input.reason.trim()}` });
    return { ok: true, quarantined: hit.length };
  },

  relocateStock: (input) => {
    const item = get().itemById(input.itemId);
    if (!item) return { ok: false, error: "Item not found." };
    if (input.fromLocationId === input.toLocationId) return { ok: false, error: "Pick two different locations." };
    if (!(input.qty > 0)) return { ok: false, error: "Enter a quantity greater than zero." };
    const available = get().availableAtLocation(item.id, input.fromLocationId);
    if (input.qty > available + 0.001) return { ok: false, error: `Only ${available} ${item.unit} can be moved from that location.` };

    // draw earliest-expiring batches first; whatever's left over came from opening-balance
    // stock with no batch record, which lands at the destination as an untracked layer
    let remaining = input.qty;
    const takes: { layer: CostLayer; qty: number }[] = [];
    for (const layer of get().fefoLayersForItem(item.id, input.fromLocationId)) {
      if (remaining <= 0) break;
      const take = Math.min(remaining, layer.remainingQty);
      takes.push({ layer, qty: take });
      remaining = round2(remaining - take);
    }
    const unit = get().unitCostOf(item.id);
    const moved: CostLayer[] = takes.map(({ layer, qty }) => ({
      id: `cl-${rid()}`, itemId: item.id, date: layer.date, qty, remainingQty: qty, unitCost: layer.unitCost,
      sourceBillId: layer.sourceBillId, expiryDate: layer.expiryDate, batchNumber: layer.batchNumber, locationId: input.toLocationId,
    }));
    if (remaining > 0.001) moved.push({ id: `cl-${rid()}`, itemId: item.id, date: input.date, qty: remaining, remainingQty: remaining, unitCost: unit, locationId: input.toLocationId });

    const value = round2(takes.reduce((n, t) => n + t.qty * t.layer.unitCost, 0) + Math.max(0, remaining) * unit);
    const takenById = new Map(takes.map((t) => [t.layer.id, t.qty]));
    const createdAt = new Date().toISOString();
    const user = useIdentity.getState().user.id;
    const movement = (dir: 1 | -1): InventoryMovement => ({
      id: `im-${rid()}`, itemId: item.id, date: input.date, type: "Transfer" as MovementType, qtyDelta: dir * input.qty, unitCost: round2(value / input.qty), value: dir * value,
      reference: input.reference, note: dir === -1 ? "Relocated out" : "Relocated in", createdAt, locationId: dir === -1 ? input.fromLocationId : input.toLocationId, requisitionId: input.requisitionId,
    });
    const transfer: LocationTransfer = {
      id: `lt-${rid()}`, itemId: item.id, qty: input.qty, unitCost: round2(value / input.qty), fromLocationId: input.fromLocationId, toLocationId: input.toLocationId,
      date: input.date, reference: input.reference, requisitionId: input.requisitionId, createdBy: user, createdAt,
    };
    set((s) => ({
      layers: [...s.layers.map((l) => (takenById.has(l.id) ? { ...l, remainingQty: round2(l.remainingQty - takenById.get(l.id)!) } : l)), ...moved],
      movements: [movement(1), movement(-1), ...s.movements],
      locationTransfers: [transfer, ...s.locationTransfers],
    }));
    audit(`moved ${input.qty} ${item.unit} of ${item.name} between storage locations`, `accounting/inventory/${item.sku}`);
    return { ok: true };
  },

  createRequisition: (input) => {
    const id = `req-${rid()}`;
    const number = `REQ-${new Date().getUTCFullYear()}-${String(get().requisitions.length + 1).padStart(4, "0")}`;
    const lines = input.lines.filter((l) => l.qtyRequested > 0).map((l) => ({ itemId: l.itemId, qtyRequested: l.qtyRequested, qtyIssued: 0 }));
    const requisition: StockRequisition = {
      id, number, requestingLocationId: input.requestingLocationId, date: input.date, neededBy: input.neededBy, lines, justification: input.justification,
      status: "Draft", requestedBy: useIdentity.getState().user.name, createdAt: new Date().toISOString(),
    };
    set((s) => ({ requisitions: [requisition, ...s.requisitions] }));
    audit(`raised stock requisition ${number} (${lines.length} line${lines.length === 1 ? "" : "s"})`, `accounting/inventory/requisition/${number}`);
    return id;
  },

  submitRequisition: (id) => {
    const r = get().requisitions.find((x) => x.id === id);
    if (!r || r.status !== "Draft") return;
    set((s) => ({ requisitions: s.requisitions.map((x) => (x.id === id ? { ...x, status: "Pending Approval" as const } : x)) }));
    audit(`submitted stock requisition ${r.number} for approval`, `accounting/inventory/requisition/${r.number}`);
  },

  decideRequisition: (id, decision, comment) => {
    const r = get().requisitions.find((x) => x.id === id);
    if (!r || r.status !== "Pending Approval") return;
    const by = useIdentity.getState().user.name;
    set((s) => ({
      requisitions: s.requisitions.map((x) =>
        x.id === id ? { ...x, status: decision, approvedBy: by, approvedAt: new Date().toISOString(), rejectionReason: decision === "Rejected" ? comment : undefined } : x,
      ),
    }));
    audit(`${decision.toLowerCase()} stock requisition ${r.number}${comment ? ` — ${comment}` : ""}`, `accounting/inventory/requisition/${r.number}`);
  },

  cancelRequisition: (id) => {
    const r = get().requisitions.find((x) => x.id === id);
    if (!r || !["Draft", "Pending Approval", "Approved"].includes(r.status)) return;
    set((s) => ({ requisitions: s.requisitions.map((x) => (x.id === id ? { ...x, status: "Cancelled" as const } : x)) }));
    audit(`cancelled stock requisition ${r.number}`, `accounting/inventory/requisition/${r.number}`);
  },

  fulfillRequisition: (id, fulfillingLocationId) => {
    const r = get().requisitions.find((x) => x.id === id);
    if (!r) return { ok: false, issued: 0, error: "Requisition not found." };
    if (r.status !== "Approved" && r.status !== "Partially Fulfilled") return { ok: false, issued: 0, error: "Only an approved requisition can be fulfilled." };
    if (fulfillingLocationId === r.requestingLocationId) return { ok: false, issued: 0, error: "A location can't fulfil its own requisition." };
    const today = new Date().toISOString();
    let issued = 0;
    const lines = r.lines.map((line) => {
      const outstanding = round2(line.qtyRequested - line.qtyIssued);
      if (outstanding <= 0) return line;
      const give = Math.min(outstanding, get().availableAtLocation(line.itemId, fulfillingLocationId));
      if (give <= 0) return line;
      const res = get().relocateStock({ itemId: line.itemId, qty: give, fromLocationId: fulfillingLocationId, toLocationId: r.requestingLocationId, date: today, reference: r.number, requisitionId: r.id });
      if (!res.ok) return line;
      issued = round2(issued + give);
      return { ...line, qtyIssued: round2(line.qtyIssued + give) };
    });
    if (issued <= 0) return { ok: false, issued: 0, error: "Nothing on this requisition is available at the chosen location." };
    const complete = lines.every((l) => l.qtyIssued >= l.qtyRequested);
    set((s) => ({ requisitions: s.requisitions.map((x) => (x.id === id ? { ...x, lines, fulfillingLocationId, status: complete ? ("Fulfilled" as const) : ("Partially Fulfilled" as const) } : x)) }));
    audit(`${complete ? "fulfilled" : "partially fulfilled"} stock requisition ${r.number}`, `accounting/inventory/requisition/${r.number}`);
    return { ok: true, issued };
  },

  requisitionsFor: (locationId) => get().requisitions.filter((r) => r.requestingLocationId === locationId || r.fulfillingLocationId === locationId),
}));
