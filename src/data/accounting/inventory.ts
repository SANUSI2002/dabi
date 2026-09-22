// Inventory Accounting — items, cost layers, movements, valuation.
//
// Reference: InventoryItem (valuation_method fifo/lifo/average), InventoryCostLayer,
// InventoryTransaction, InventoryValuationService (FIFO/LIFO/AVCO + COGS),
// InventoryPostingService. Physical stock stays the responsibility of the
// clinical Inventory/Pharmacy modules; this tracks the FINANCIAL layer —
// value on the balance sheet and cost of goods sold on consumption.

export type ValuationMethod = "FIFO" | "Weighted Average";
export type MovementType = "Receipt" | "Issue" | "Adjustment" | "Write-off" | "Return" | "Transfer";

/** stock with no storage location recorded (opening balances) is treated as held here */
export const DEFAULT_STORE_LOCATION_ID = "loc-main";

export type InventoryItem = {
  id: string;
  sku: string;
  name: string;
  category: "Drugs" | "Consumables" | "Reagents" | "Other" | "PPE" | "Surgical Supplies" | "Linen" | "Medical Devices";
  subcategory?: string;
  unit: string;
  valuationMethod: ValuationMethod;
  inventoryAccountNumber: number; // 1200 / 1210
  cogsAccountNumber: number; // 5000 / 5010
  currentQty: number;
  averageCost: number;
  /** stock at/below this is a hard "Low Stock" alert, distinct from reorderLevel's softer nudge */
  minLevel?: number;
  reorderLevel: number;
  reorderQty?: number; // B27 — how many to order when low; defaults to reorderLevel * 2 - currentQty
  preferredVendorId?: string; // B27 — used to group reorder POs
  linkedDrugId?: string; // ties to useCatalog drug for the pharmacy bridge
  active: boolean;
};

// B24 — inventory value moved between operating branches
export type StockTransfer = {
  id: string;
  itemId: string;
  fromBranchId: string;
  toBranchId: string;
  qty: number;
  unitCost: number;
  value: number;
  date: string;
  reference?: string;
  journalEntryIds: string[];
  createdBy: string;
  createdAt: string;
};

// B25 — a physical count session
export type StockCountLine = { itemId: string; systemQty: number; countedQty: number };
export type StockCount = {
  id: string;
  number: string;
  date: string;
  status: "Draft" | "Posted";
  lines: StockCountLine[];
  note?: string;
  postedAt?: string;
  createdBy: string;
  createdAt: string;
};

export type CostLayer = {
  id: string;
  itemId: string;
  date: string;
  qty: number;
  remainingQty: number;
  unitCost: number;
  sourceBillId?: string;
  /** additive — turns a cost layer into a full physical batch record: which
   *  storage location holds it, its own batch/lot number, and its expiry.
   *  Optional so existing opening-balance layers (no expiry tracking) are unaffected. */
  expiryDate?: string;
  batchNumber?: string;
  locationId?: string;
  /** additive — a quarantined layer is held out of every issue/transfer/FEFO
   *  path until released or written off; absent/"Active" means normal stock. */
  status?: "Active" | "Quarantined";
  quarantineReason?: string;
  quarantinedBy?: string;
  quarantinedAt?: string;
};

// A physical move of stock between two storage locations inside ONE entity —
// unlike StockTransfer (inter-branch, posts intercompany GL), this posts no
// journal entry: same legal entity, same inventory account, only the location
// dimension changes.
export type LocationTransfer = {
  id: string;
  itemId: string;
  qty: number;
  unitCost: number;
  fromLocationId: string;
  toLocationId: string;
  date: string;
  reference?: string;
  requisitionId?: string;
  createdBy: string;
  createdAt: string;
};

export type RequisitionStatus = "Draft" | "Pending Approval" | "Approved" | "Rejected" | "Partially Fulfilled" | "Fulfilled" | "Cancelled";
export type RequisitionLine = { itemId: string; qtyRequested: number; qtyIssued: number };

// A ward/department asking a store for stock. Deliberately NOT an ApprovableDoc —
// it creates no vendor liability, so the finance-role approval chain doesn't apply;
// a single store-supervisor decision is the whole gate.
export type StockRequisition = {
  id: string;
  number: string;
  requestingLocationId: string;
  fulfillingLocationId?: string;
  date: string;
  neededBy?: string;
  lines: RequisitionLine[];
  justification?: string;
  status: RequisitionStatus;
  requestedBy: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectionReason?: string;
  createdAt: string;
};

export type InventoryMovement = {
  id: string;
  itemId: string;
  date: string;
  type: MovementType;
  qtyDelta: number; // + in, - out
  unitCost: number;
  value: number; // signed cost value moved
  reference?: string;
  note?: string;
  journalEntryId?: string;
  createdAt: string;
  /** additive — where/why stock moved, for Issue movements raised from Stock List */
  locationId?: string;
  department?: string;
  purpose?: string;
  requisitionId?: string;
};

const daysAgo = (n: number) => new Date(Date.now() - n * 864e5).toISOString();

export const seedInventoryItems: InventoryItem[] = [
  { id: "itm-act", sku: "DRG-ACT-001", name: "Artemether/Lumefantrine 20/120 (ACT)", category: "Drugs", unit: "pack", valuationMethod: "FIFO", inventoryAccountNumber: 1200, cogsAccountNumber: 5000, currentQty: 420, averageCost: 1_150, reorderLevel: 120, reorderQty: 400, preferredVendorId: "ven-emzor", linkedDrugId: "artemether/lumefantrine", active: true },
  { id: "itm-amox", sku: "DRG-AMX-002", name: "Amoxicillin 500mg caps", category: "Drugs", unit: "pack", valuationMethod: "Weighted Average", inventoryAccountNumber: 1200, cogsAccountNumber: 5000, currentQty: 300, averageCost: 850, reorderLevel: 100, reorderQty: 300, preferredVendorId: "ven-fidson", linkedDrugId: "amoxicillin", active: true },
  { id: "itm-para", sku: "DRG-PCM-003", name: "Paracetamol 500mg tabs", category: "Drugs", unit: "pack", valuationMethod: "Weighted Average", inventoryAccountNumber: 1200, cogsAccountNumber: 5000, currentQty: 500, averageCost: 220, reorderLevel: 150, reorderQty: 400, preferredVendorId: "ven-fidson", linkedDrugId: "paracetamol", active: true },
  { id: "itm-glove", sku: "CON-GLV-010", name: "Examination gloves (box of 100)", category: "Consumables", unit: "box", valuationMethod: "Weighted Average", inventoryAccountNumber: 1210, cogsAccountNumber: 5010, currentQty: 180, averageCost: 3_200, reorderLevel: 60, reorderQty: 120, preferredVendorId: "ven-medred", active: true },
  { id: "itm-rdt", sku: "RGT-RDT-020", name: "Malaria RDT kits", category: "Reagents", unit: "kit", valuationMethod: "FIFO", inventoryAccountNumber: 1210, cogsAccountNumber: 5010, currentQty: 95, averageCost: 480, reorderLevel: 150, reorderQty: 300, preferredVendorId: "ven-medred", active: true },
];

// Opening cost layers — value ties to opening 1200 (4,200,000 partial) / 1210.
export const seedCostLayers: CostLayer[] = [
  { id: "cl-1", itemId: "itm-act", date: daysAgo(60), qty: 200, remainingQty: 180, unitCost: 1_100 },
  { id: "cl-2", itemId: "itm-act", date: daysAgo(25), qty: 260, remainingQty: 240, unitCost: 1_190 },
  { id: "cl-3", itemId: "itm-rdt", date: daysAgo(40), qty: 100, remainingQty: 40, unitCost: 460 },
  { id: "cl-4", itemId: "itm-rdt", date: daysAgo(12), qty: 60, remainingQty: 55, unitCost: 520 },
];

export const seedInventoryMovements: InventoryMovement[] = [];
export const seedStockTransfers: StockTransfer[] = [];
export const seedStockCounts: StockCount[] = [];
export const seedLocationTransfers: LocationTransfer[] = [];
export const seedStockRequisitions: StockRequisition[] = [];
