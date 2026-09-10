import { create } from "zustand";
import { audit } from "@/store/useAudit";
import { useLedger } from "@/store/accounting/useLedger";
import { ACCT } from "@/data/accounting/coa";
import { useIdentity } from "@/store/useIdentity";
import { seedInventoryItems, seedCostLayers, seedInventoryMovements, seedStockTransfers, seedStockCounts, type InventoryItem, type CostLayer, type InventoryMovement, type ValuationMethod, type MovementType, type StockTransfer, type StockCount } from "@/data/accounting/inventory";

const rid = () => Math.random().toString(36).slice(2, 9);
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export type ReorderSuggestion = { item: InventoryItem; shortBy: number; suggestedQty: number; estCost: number; preferredVendorId?: string };

type InvState = {
  items: InventoryItem[];
  layers: CostLayer[];
  movements: InventoryMovement[];
  transfers: StockTransfer[];
  counts: StockCount[];

  itemById: (id: string) => InventoryItem | undefined;
  itemByDrugId: (drugId: string) => InventoryItem | undefined;
  addItem: (input: { sku: string; name: string; category: InventoryItem["category"]; unit: string; valuationMethod: ValuationMethod; inventoryAccountNumber: number; cogsAccountNumber: number; reorderLevel: number; linkedDrugId?: string }) => string;

  valuationOf: (itemId: string) => number;
  unitCostOf: (itemId: string) => number;
  totalValuation: () => number;
  movementsFor: (itemId: string) => InventoryMovement[];

  receiveStock: (input: { itemId: string; qty: number; unitCost: number; date: string; reference?: string; note?: string; sourceBillId?: string; postGL?: boolean; fundingAccount?: number }) => { ok: boolean; error?: string; value: number };
  issueStock: (input: { itemId: string; qty: number; date: string; reference?: string; note?: string; postGL?: boolean }) => { ok: boolean; error?: string; cogs: number };
  adjustStock: (input: { itemId: string; qtyDelta: number; date: string; reason: string }) => { ok: boolean; error?: string };
  writeOff: (input: { itemId: string; qty: number; date: string; reason: string }) => { ok: boolean; error?: string; value: number };

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

/** consume `qty` from FIFO layers (or use average cost), returns the cost value */
function consume(state: InvState, item: InventoryItem, qty: number): { value: number; layers: CostLayer[] } {
  if (item.valuationMethod === "Weighted Average") {
    return { value: round2(qty * item.averageCost), layers: state.layers };
  }
  let remaining = qty;
  let value = 0;
  const layers = state.layers
    .slice()
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .map((l) => {
      if (l.itemId !== item.id || remaining <= 0 || l.remainingQty <= 0) return l;
      const take = Math.min(remaining, l.remainingQty);
      value += take * l.unitCost;
      remaining -= take;
      return { ...l, remainingQty: round2(l.remainingQty - take) };
    });
  // if layers ran short, price the shortfall at average cost
  if (remaining > 0) value += remaining * item.averageCost;
  return { value: round2(value), layers };
}

export const useInventoryAccounting = create<InvState>((set, get) => ({
  items: seedInventoryItems,
  layers: seedCostLayers,
  movements: seedInventoryMovements,
  transfers: seedStockTransfers,
  counts: seedStockCounts,

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
    const layer: CostLayer = { id: `cl-${rid()}`, itemId: item.id, date: input.date, qty: input.qty, remainingQty: input.qty, unitCost: input.unitCost, sourceBillId: input.sourceBillId };
    const newQty = round2(item.currentQty + input.qty);
    const newAvg = newQty > 0 ? round2((item.currentQty * item.averageCost + value) / newQty) : item.averageCost;
    set((s) => ({
      layers: [...s.layers, layer],
      items: s.items.map((i) => (i.id === item.id ? { ...i, currentQty: newQty, averageCost: newAvg } : i)),
      movements: [{ id: `im-${rid()}`, itemId: item.id, date: input.date, type: "Receipt" as MovementType, qtyDelta: input.qty, unitCost: input.unitCost, value, reference: input.reference, note: input.note, journalEntryId: jeId, createdAt: new Date().toISOString() }, ...s.movements],
    }));
    audit(`received ${input.qty} ${item.unit} of ${item.name}`, `accounting/inventory/${item.sku}`);
    return { ok: true, value };
  },

  issueStock: (input) => {
    const item = get().itemById(input.itemId);
    if (!item) return { ok: false, error: "Item not found.", cogs: 0 };
    if (input.qty > item.currentQty + 0.001) return { ok: false, error: `Only ${item.currentQty} ${item.unit} on hand.`, cogs: 0 };
    const { value, layers } = consume(get(), item, input.qty);
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
      movements: [{ id: `im-${rid()}`, itemId: item.id, date: input.date, type: "Issue" as MovementType, qtyDelta: -input.qty, unitCost: round2(value / input.qty), value: -value, reference: input.reference, note: input.note, journalEntryId: jeId, createdAt: new Date().toISOString() }, ...s.movements],
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
      movements: [{ id: `im-${rid()}`, itemId: item.id, date: input.date, type: "Adjustment" as MovementType, qtyDelta: input.qtyDelta, unitCost: item.averageCost, value: up ? value : -value, note: input.reason, journalEntryId: je.entry?.id, createdAt: new Date().toISOString() }, ...s.movements],
    }));
    audit(`adjusted stock of ${item.name} by ${input.qtyDelta}`, `accounting/inventory/${item.sku}`);
    return { ok: true };
  },

  writeOff: (input) => {
    const item = get().itemById(input.itemId);
    if (!item) return { ok: false, error: "Item not found.", value: 0 };
    if (input.qty > item.currentQty + 0.001) return { ok: false, error: `Only ${item.currentQty} on hand.`, value: 0 };
    const { value, layers } = consume(get(), item, input.qty);
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
      movements: [{ id: `im-${rid()}`, itemId: item.id, date: input.date, type: "Write-off" as MovementType, qtyDelta: -input.qty, unitCost: round2(value / input.qty), value: -value, note: input.reason, journalEntryId: je.entry?.id, createdAt: new Date().toISOString() }, ...s.movements],
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
}));
