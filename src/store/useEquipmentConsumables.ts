import { create } from "zustand";
import { audit } from "@/store/useAudit";
import { useIdentity } from "@/store/useIdentity";
import type { ConsumableItem, ConsumableUsageEvent, ConsumableUsageSource } from "@/data/equipmentConsumables";

const rid = () => Math.random().toString(36).slice(2, 9);

type NewConsumableInput = {
  name: string;
  lotNumber: string;
  expiryDate: string;
  unit: string;
  quantityOnHand: number;
  reorderThreshold: number;
  costPerUnit: number;
  supplier?: string;
};

type EquipmentConsumablesState = {
  items: ConsumableItem[];
  usageEvents: ConsumableUsageEvent[];

  registerConsumable: (equipmentId: string, input: NewConsumableInput) => ConsumableItem;
  receiveStock: (id: string, quantity: number) => void;
  consume: (id: string, quantity: number, opts: { reason: ConsumableUsageEvent["reason"]; source: ConsumableUsageSource; testName?: string; orderId?: string }) => boolean;

  itemsFor: (equipmentId: string) => ConsumableItem[];
  usageFor: (equipmentId: string) => ConsumableUsageEvent[];
};

export const useEquipmentConsumables = create<EquipmentConsumablesState>((set, get) => ({
  items: [],
  usageEvents: [],

  registerConsumable: (equipmentId, input) => {
    const who = useIdentity.getState().user.name;
    const item: ConsumableItem = {
      id: rid(),
      equipmentId,
      name: input.name,
      lotNumber: input.lotNumber,
      expiryDate: input.expiryDate,
      unit: input.unit,
      quantityOnHand: input.quantityOnHand,
      reorderThreshold: input.reorderThreshold,
      costPerUnit: input.costPerUnit,
      supplier: input.supplier,
      registeredAt: new Date().toISOString(),
      registeredBy: who,
    };
    audit("registered equipment consumable", `equipment-scada/consumable/${equipmentId}`, { user: who, meta: { name: input.name, lot: input.lotNumber } });
    set((s) => ({ items: [item, ...s.items] }));
    return item;
  },

  receiveStock: (id, quantity) => {
    const who = useIdentity.getState().user.name;
    audit("received equipment consumable stock", `equipment-scada/consumable/${id}`, { user: who, meta: { quantity } });
    set((s) => ({ items: s.items.map((i) => (i.id === id ? { ...i, quantityOnHand: i.quantityOnHand + quantity } : i)) }));
  },

  // Returns false (and deducts nothing) if there isn't enough stock — callers must not silently
  // let a test proceed as if reagent were available when it wasn't.
  consume: (id, quantity, opts) => {
    const item = get().items.find((i) => i.id === id);
    if (!item || item.quantityOnHand < quantity) return false;
    const who = opts.source === "USER" ? useIdentity.getState().user.name : "Analyzer simulation";
    set((s) => ({
      items: s.items.map((i) => (i.id === id ? { ...i, quantityOnHand: i.quantityOnHand - quantity } : i)),
      usageEvents: [
        { id: rid(), equipmentId: item.equipmentId, consumableId: id, quantityUsed: quantity, reason: opts.reason, at: new Date().toISOString(), source: opts.source, testName: opts.testName, orderId: opts.orderId },
        ...s.usageEvents,
      ],
    }));
    if (opts.source === "USER") audit("recorded equipment consumable usage", `equipment-scada/consumable/${id}`, { user: who, meta: { quantity, reason: opts.reason } });
    return true;
  },

  itemsFor: (equipmentId) => get().items.filter((i) => i.equipmentId === equipmentId),
  usageFor: (equipmentId) => get().usageEvents.filter((e) => e.equipmentId === equipmentId),
}));
