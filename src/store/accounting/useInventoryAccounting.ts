import { create } from "zustand";
import { audit } from "@/store/useAudit";
import { useLedger } from "@/store/accounting/useLedger";
import { ACCT } from "@/data/accounting/coa";
import { seedInventoryItems, seedCostLayers, seedInventoryMovements, type InventoryItem, type CostLayer, type InventoryMovement, type ValuationMethod, type MovementType } from "@/data/accounting/inventory";

const rid = () => Math.random().toString(36).slice(2, 9);
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

type InvState = {
  items: InventoryItem[];
  layers: CostLayer[];
  movements: InventoryMovement[];

  itemById: (id: string) => InventoryItem | undefined;
  itemByDrugId: (drugId: string) => InventoryItem | undefined;
  addItem: (input: { sku: string; name: string; category: InventoryItem["category"]; unit: string; valuationMethod: ValuationMethod; inventoryAccountNumber: number; cogsAccountNumber: number; reorderLevel: number; linkedDrugId?: string }) => string;

  valuationOf: (itemId: string) => number;
  totalValuation: () => number;
  movementsFor: (itemId: string) => InventoryMovement[];

  receiveStock: (input: { itemId: string; qty: number; unitCost: number; date: string; reference?: string; note?: string; sourceBillId?: string; postGL?: boolean; fundingAccount?: number }) => { ok: boolean; error?: string; value: number };
  issueStock: (input: { itemId: string; qty: number; date: string; reference?: string; note?: string; postGL?: boolean }) => { ok: boolean; error?: string; cogs: number };
  adjustStock: (input: { itemId: string; qtyDelta: number; date: string; reason: string }) => { ok: boolean; error?: string };
  writeOff: (input: { itemId: string; qty: number; date: string; reason: string }) => { ok: boolean; error?: string; value: number };
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

  itemById: (id) => get().items.find((i) => i.id === id),
  itemByDrugId: (drugId) => get().items.find((i) => i.linkedDrugId === drugId),

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
}));
