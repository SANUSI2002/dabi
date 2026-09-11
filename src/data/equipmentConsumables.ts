// Consumable tracking for equipment (directive section 25): Test -> Consumable consumption ->
// Inventory deduction -> Stock ledger -> Reorder threshold. A device only participates in
// consumable gating once someone registers a reagent/consumable for it — equipment with none
// registered is treated as "not tracked" here, not silently given infinite supply.
export type ConsumableItem = {
  id: string;
  equipmentId: string;
  name: string;
  lotNumber: string;
  expiryDate: string;
  unit: string;
  quantityOnHand: number;
  reorderThreshold: number;
  costPerUnit: number;
  supplier?: string;
  registeredAt: string;
  registeredBy: string;
};

export type ConsumableUsageSource = "SIMULATOR" | "USER";

export type ConsumableUsageEvent = {
  id: string;
  equipmentId: string;
  consumableId: string;
  quantityUsed: number;
  reason: "Test" | "Wastage" | "Expired — discarded";
  at: string;
  source: ConsumableUsageSource;
  testName?: string;
  orderId?: string;
};

export type ConsumableStockState = "OK" | "Low Stock" | "Out of Stock" | "Expired";

export function consumableStateFor(item: ConsumableItem): ConsumableStockState {
  if (new Date(item.expiryDate).getTime() < Date.now()) return "Expired";
  if (item.quantityOnHand <= 0) return "Out of Stock";
  if (item.quantityOnHand <= item.reorderThreshold) return "Low Stock";
  return "OK";
}
