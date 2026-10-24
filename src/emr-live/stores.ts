import { useEffect } from "react";
import { create } from "zustand";
import type { CostLayer, InventoryItem, InventoryMovement, LocationTransfer, MovementType, RequisitionStatus, StockCount, StockRequisition } from "@/data/accounting/inventory";
import type { ReorderSuggestion } from "@/store/accounting/useInventoryAccounting";
import { DEFAULT_STORE_LOCATION_ID } from "@/data/accounting/inventory";
import { useInventoryAccounting } from "@/store/accounting/useInventoryAccounting";
import { useInventoryLocations, type StorageLocation } from "@/store/useInventoryLocations";
import { describeEmrError, emrRequest, newIdempotencyKey } from "./client";
import { useIsLiveEmr } from "./session";

// Hospital stores in live mode (GET /stores and its actions). The Inventory screens read the same
// shapes as the demo stock ledger, so this store presents the hospital's items, batches (as cost
// layers), movements, requisitions, counts and transfers in those shapes and offers the same actions.
// Live actions are asynchronous and resolve to { ok, error } like the demo's; nothing is posted to
// accounting (the screens say so in live mode).

type ApiLocation = { id: string; code: string; name: string; type: "STORE" | "DEPARTMENT" | "WARD"; status: "ACTIVE" | "INACTIVE"; version: number };
type ApiItem = { id: string; sku: string; name: string; category: InventoryItem["category"]; unit: string; minLevel: number | null; reorderLevel: number; reorderQty: number | null; active: boolean; version: number };
type ApiBatch = {
  id: string; itemId: string; locationId: string; batchNumber: string | null; expiryDate: string | null; qtyReceived: number; qtyRemaining: number; unitCostMinor: number;
  status: "ACTIVE" | "QUARANTINED"; quarantineReason: string | null; quarantinedByName: string | null; quarantinedAt: string | null; receivedAt: string;
};
type ApiMovement = {
  id: string; itemId: string; locationId: string; kind: "RECEIPT" | "ISSUE" | "ADJUSTMENT" | "WRITE_OFF" | "TRANSFER_OUT" | "TRANSFER_IN" | "COUNT"; qtyDelta: number; unitCostMinor: number;
  reference: string | null; note: string | null; department: string | null; purpose: string | null; requisitionId: string | null; userName: string | null; createdAt: string;
};
type ApiRequisition = {
  id: string; number: string; requestingLocationId: string; fulfillingLocationId: string | null; neededBy: string | null; justification: string | null;
  status: "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "REJECTED" | "PARTIALLY_FULFILLED" | "FULFILLED" | "CANCELLED"; requestedByName: string | null; decidedByName: string | null;
  decidedAt: string | null; rejectionReason: string | null; version: number; createdAt: string; lines: { itemId: string; qtyRequested: number; qtyIssued: number }[];
};
type ApiCount = { id: string; number: string; locationId: string; status: "DRAFT" | "POSTED"; note: string | null; createdByName: string | null; postedAt: string | null; version: number; createdAt: string; lines: { itemId: string; systemQty: number; countedQty: number | null }[] };
type ApiTransfer = { id: string; itemId: string; qty: number; valueMinor: number; fromLocationId: string; toLocationId: string; reference: string | null; requisitionId: string | null; userName: string | null; createdAt: string };
export type ApiStores = { locations: ApiLocation[]; items: ApiItem[]; batches: ApiBatch[]; movements: ApiMovement[]; requisitions: ApiRequisition[]; counts: ApiCount[]; transfers: ApiTransfer[] };

const naira = (minor: number) => minor / 100;
const round2 = (n: number) => Math.round(n * 100) / 100;
const LOCATION_TYPE = { STORE: "Store", DEPARTMENT: "Department", WARD: "Ward" } as const;
const MOVEMENT: Record<ApiMovement["kind"], MovementType> = { RECEIPT: "Receipt", ISSUE: "Issue", ADJUSTMENT: "Adjustment", WRITE_OFF: "Write-off", TRANSFER_OUT: "Transfer", TRANSFER_IN: "Transfer", COUNT: "Adjustment" };
const REQ_STATUS: Record<ApiRequisition["status"], RequisitionStatus> = {
  DRAFT: "Draft", PENDING_APPROVAL: "Pending Approval", APPROVED: "Approved", REJECTED: "Rejected", PARTIALLY_FULFILLED: "Partially Fulfilled", FULFILLED: "Fulfilled", CANCELLED: "Cancelled",
};

export type LiveStoresData = {
  locations: StorageLocation[]; mainLocationId: string; items: InventoryItem[]; layers: CostLayer[]; movements: InventoryMovement[];
  requisitions: (StockRequisition & { version: number })[]; counts: (StockCount & { version: number; locationId: string })[]; locationTransfers: LocationTransfer[];
};

export function storesFromApi(data: ApiStores): LiveStoresData {
  const layers: CostLayer[] = data.batches.map((b) => ({
    id: b.id, itemId: b.itemId, date: b.receivedAt, qty: b.qtyReceived, remainingQty: b.qtyRemaining, unitCost: naira(b.unitCostMinor), expiryDate: b.expiryDate ?? undefined,
    batchNumber: b.batchNumber ?? undefined, locationId: b.locationId, status: b.status === "QUARANTINED" ? "Quarantined" : "Active", quarantineReason: b.quarantineReason ?? undefined,
    quarantinedBy: b.quarantinedByName ?? undefined, quarantinedAt: b.quarantinedAt ?? undefined,
  }));
  const items: InventoryItem[] = data.items.map((i) => {
    const own = layers.filter((l) => l.itemId === i.id);
    const qty = own.reduce((n, l) => n + l.remainingQty, 0);
    const value = own.reduce((n, l) => n + l.remainingQty * l.unitCost, 0);
    return {
      id: i.id, sku: i.sku, name: i.name, category: i.category, unit: i.unit, valuationMethod: "FIFO", inventoryAccountNumber: 0, cogsAccountNumber: 0,
      currentQty: qty, averageCost: qty ? round2(value / qty) : 0, minLevel: i.minLevel ?? undefined, reorderLevel: i.reorderLevel, reorderQty: i.reorderQty ?? undefined, active: i.active,
    };
  });
  const main = data.locations.find((l) => l.code === "MAIN") ?? data.locations.find((l) => l.type === "STORE") ?? data.locations[0];
  return {
    locations: data.locations.map((l) => ({ id: l.id, name: l.name, code: l.code, type: LOCATION_TYPE[l.type], status: l.status === "ACTIVE" ? "Active" : "Inactive" })),
    mainLocationId: main?.id ?? "",
    items, layers,
    movements: data.movements.map((m) => ({
      id: m.id, itemId: m.itemId, date: m.createdAt, type: MOVEMENT[m.kind], qtyDelta: m.qtyDelta, unitCost: naira(m.unitCostMinor), value: round2(m.qtyDelta * naira(m.unitCostMinor)),
      reference: m.reference ?? undefined, note: m.note ?? undefined, createdAt: m.createdAt, locationId: m.locationId, department: m.department ?? undefined, purpose: m.purpose ?? undefined,
      requisitionId: m.requisitionId ?? undefined,
    })),
    requisitions: data.requisitions.map((r) => ({
      id: r.id, number: r.number, requestingLocationId: r.requestingLocationId, fulfillingLocationId: r.fulfillingLocationId ?? undefined, date: r.createdAt, neededBy: r.neededBy ?? undefined,
      lines: r.lines, justification: r.justification ?? undefined, status: REQ_STATUS[r.status], requestedBy: r.requestedByName ?? "Unknown staff member", approvedBy: r.decidedByName ?? undefined,
      approvedAt: r.decidedAt ?? undefined, rejectionReason: r.rejectionReason ?? undefined, createdAt: r.createdAt, version: r.version,
    })),
    counts: data.counts.map((c) => ({
      id: c.id, number: c.number, date: c.createdAt, status: c.status === "POSTED" ? "Posted" : "Draft", note: c.note ?? undefined, postedAt: c.postedAt ?? undefined,
      createdBy: c.createdByName ?? "Unknown staff member", createdAt: c.createdAt, version: c.version, locationId: c.locationId,
      lines: c.lines.map((l) => ({ itemId: l.itemId, systemQty: l.systemQty, countedQty: l.countedQty ?? l.systemQty })),
    })),
    locationTransfers: data.transfers.map((t) => ({
      id: t.id, itemId: t.itemId, qty: t.qty, unitCost: t.qty ? naira(t.valueMinor) / t.qty : 0, fromLocationId: t.fromLocationId, toLocationId: t.toLocationId, date: t.createdAt,
      reference: t.reference ?? undefined, requisitionId: t.requisitionId ?? undefined, createdBy: t.userName ?? "Unknown staff member", createdAt: t.createdAt,
    })),
  };
}

type Result = { ok: boolean; error?: string };
const attempt = async <T extends object = object>(work: () => Promise<T | void>): Promise<Result & Partial<T>> => {
  try {
    const value = await work();
    return { ok: true, ...(value ?? {}) } as Result & Partial<T>;
  } catch (cause) {
    return { ok: false, error: describeEmrError(cause) } as Result & Partial<T>;
  }
};
const day = (iso?: string) => (iso ? iso.slice(0, 10) : undefined);

type LiveStoresState = LiveStoresData & {
  loaded: boolean;
  error: string;
  load: () => Promise<void>;
  /** counted quantities typed on a draft count, sent with the count when it is posted */
  draftCounts: Record<string, Record<string, number>>;
};

const empty: LiveStoresData = { locations: [], mainLocationId: "", items: [], layers: [], movements: [], requisitions: [], counts: [], locationTransfers: [] };

export const useLiveStoresData = create<LiveStoresState>((set) => ({
  ...empty, loaded: false, error: "", draftCounts: {},
  load: async () => {
    try {
      const result = await emrRequest<{ data: ApiStores }>("/stores?movementLimit=1000");
      set({ ...storesFromApi(result.data), loaded: true, error: "" });
    } catch (cause) {
      set({ error: cause instanceof Error ? cause.message : "Hospital stores could not be loaded." });
    }
  },
}));

export function useLiveStoresLoad(enabled: boolean) {
  useEffect(() => { if (enabled) void useLiveStoresData.getState().load(); }, [enabled]);
}

const reload = () => useLiveStoresData.getState().load();
const send = async (path: string, options: Parameters<typeof emrRequest>[1]) => { await emrRequest(path, options); await reload(); };
const requisitionOf = (id: string) => {
  const found = useLiveStoresData.getState().requisitions.find((r) => r.id === id);
  if (!found) throw new Error("This requisition is no longer in the list; refresh and try again.");
  return found;
};

/** The Inventory screens' data and actions for a live hospital, in the demo stock ledger's shapes. */
function liveStores(state: LiveStoresState) {
  const { items, layers, movements } = state;
  const itemById = (id: string) => items.find((i) => i.id === id);
  const layersForItem = (itemId: string) => layers.filter((l) => l.itemId === itemId).sort((a, b) => a.date.localeCompare(b.date));
  const expiryStatus = (layer: CostLayer, alertDays = 30): "Active" | "Expiring Soon" | "Expired" => {
    if (!layer.expiryDate) return "Active";
    const days = Math.ceil((new Date(`${layer.expiryDate}T23:59:59`).getTime() - Date.now()) / 86_400_000);
    return days < 0 ? "Expired" : days <= alertDays ? "Expiring Soon" : "Active";
  };
  const usable = (l: CostLayer) => l.remainingQty > 0 && l.status !== "Quarantined" && expiryStatus(l) !== "Expired";
  const valuationOf = (itemId: string) => round2(layers.filter((l) => l.itemId === itemId).reduce((n, l) => n + l.remainingQty * l.unitCost, 0));
  return {
    ...state,
    itemById, layersForItem, expiryStatus,
    valuationOf,
    movementsFor: (itemId: string) => movements.filter((m) => m.itemId === itemId),
    balanceByLocation: (itemId: string, locationId: string) => layers.filter((l) => l.itemId === itemId && l.locationId === locationId).reduce((n, l) => n + l.remainingQty, 0),
    availableAtLocation: (itemId: string, locationId: string) => layers.filter((l) => l.itemId === itemId && l.locationId === locationId && usable(l)).reduce((n, l) => n + l.remainingQty, 0),
    availableQtyOf: (itemId: string) => layers.filter((l) => l.itemId === itemId && l.status !== "Quarantined").reduce((n, l) => n + l.remainingQty, 0),
    reorderSuggestions: (): ReorderSuggestion[] => items
      .filter((i) => i.active && i.reorderLevel > 0 && i.currentQty <= i.reorderLevel)
      .map((item) => {
        const suggestedQty = item.reorderQty ?? Math.max(item.reorderLevel * 2 - item.currentQty, item.reorderLevel);
        return { item, shortBy: item.reorderLevel - item.currentQty, suggestedQty, estCost: round2(suggestedQty * item.averageCost) };
      }),

    addItem: (input: { sku: string; name: string; category: InventoryItem["category"]; unit: string; reorderLevel: number; minLevel?: number }) =>
      attempt(() => send("/stores/items", { method: "POST", body: { sku: input.sku, name: input.name, category: input.category, unit: input.unit, reorderLevel: input.reorderLevel, ...(input.minLevel !== undefined ? { minLevel: input.minLevel } : {}) } })),
    receiveStock: (input: { itemId: string; qty: number; unitCost: number; locationId?: string; batchNumber?: string; expiryDate?: string; reference?: string; note?: string }) =>
      attempt(() => send("/stores/receipts", {
        method: "POST", idempotencyKey: newIdempotencyKey(),
        body: {
          itemId: input.itemId, locationId: input.locationId ?? state.mainLocationId, qty: input.qty, unitCostMinor: Math.round(input.unitCost * 100),
          ...(input.batchNumber ? { batchNumber: input.batchNumber } : {}), ...(input.expiryDate ? { expiryDate: day(input.expiryDate) } : {}),
          ...(input.reference ? { reference: input.reference } : {}), ...(input.note ? { note: input.note } : {}),
        },
      })),
    issueStock: (input: { itemId: string; qty: number; locationId?: string; department?: string; purpose?: string }) =>
      attempt(() => send("/stores/issues", {
        method: "POST", idempotencyKey: newIdempotencyKey(),
        body: { itemId: input.itemId, locationId: input.locationId ?? state.mainLocationId, qty: input.qty, ...(input.department?.trim() ? { department: input.department.trim() } : {}), ...(input.purpose?.trim() ? { purpose: input.purpose.trim() } : {}) },
      })),
    /** The screen's "new quantity" is for the whole item; live stock is per location, so the change is applied there. */
    adjustStock: (input: { itemId: string; qtyDelta: number; reason: string; locationId?: string }) =>
      attempt(() => send("/stores/adjustments", { method: "POST", idempotencyKey: newIdempotencyKey(), body: { itemId: input.itemId, locationId: input.locationId ?? state.mainLocationId, qtyDelta: input.qtyDelta, reason: input.reason } })),
    writeOff: (input: { itemId: string; qty: number; reason: string; locationId?: string; layerId?: string }) =>
      attempt(() => send("/stores/write-offs", { method: "POST", idempotencyKey: newIdempotencyKey(), body: { itemId: input.itemId, qty: input.qty, reason: input.reason, ...(input.layerId ? { batchId: input.layerId } : { locationId: input.locationId ?? state.mainLocationId }) } })),
    quarantineLayer: (input: { layerId: string; reason: string }) => attempt(() => send(`/stores/batches/${input.layerId}/quarantine`, { method: "POST", body: { reason: input.reason } })),
    releaseLayer: (input: { layerId: string }) => attempt(() => send(`/stores/batches/${input.layerId}/release`, { method: "POST", body: {} })),
    recallLot: (input: { itemId: string; batchNumber: string; reason: string }) => attempt(() => send("/stores/recalls", { method: "POST", body: input })),
    relocateStock: (input: { itemId: string; qty: number; fromLocationId: string; toLocationId: string; reference?: string }) =>
      attempt(() => send("/stores/transfers", { method: "POST", idempotencyKey: newIdempotencyKey(), body: { itemId: input.itemId, qty: input.qty, fromLocationId: input.fromLocationId, toLocationId: input.toLocationId, ...(input.reference ? { reference: input.reference } : {}) } })),

    createRequisition: async (input: { requestingLocationId: string; neededBy?: string; lines: { itemId: string; qtyRequested: number }[]; justification?: string; submit?: boolean }) => {
      const result = await emrRequest<{ data: { id: string } }>("/stores/requisitions", {
        method: "POST", idempotencyKey: newIdempotencyKey(),
        body: { requestingLocationId: input.requestingLocationId, lines: input.lines, submit: input.submit ?? false, ...(input.neededBy ? { neededBy: day(input.neededBy) } : {}), ...(input.justification ? { justification: input.justification } : {}) },
      });
      await reload();
      return result.data.id;
    },
    submitRequisition: (id: string) => attempt(() => send(`/stores/requisitions/${id}/submit`, { method: "POST", version: requisitionOf(id).version, body: {} })),
    decideRequisition: (id: string, decision: "Approved" | "Rejected", comment?: string) =>
      attempt(() => send(`/stores/requisitions/${id}/${decision === "Approved" ? "approve" : "reject"}`, { method: "POST", version: requisitionOf(id).version, body: decision === "Rejected" ? { reason: comment ?? "" } : {} })),
    cancelRequisition: (id: string) => attempt(() => send(`/stores/requisitions/${id}/cancel`, { method: "POST", version: requisitionOf(id).version, body: {} })),
    fulfillRequisition: (id: string, fulfillingLocationId: string) =>
      attempt(async () => {
        const result = await emrRequest<{ data: { issued: number } }>(`/stores/requisitions/${id}/fulfil`, { method: "POST", version: requisitionOf(id).version, body: { fulfillingLocationId } });
        await reload();
        return { issued: result.data.issued };
      }),

    createStockCount: async (input: { itemIds: string[]; note?: string; locationId?: string }) => {
      const result = await emrRequest<{ data: { id: string } }>("/stores/counts", { method: "POST", body: { locationId: input.locationId ?? state.mainLocationId, itemIds: input.itemIds, ...(input.note ? { note: input.note } : {}) } });
      await reload();
      return result.data.id;
    },
    updateCountLine: (countId: string, itemId: string, countedQty: number) => {
      useLiveStoresData.setState((s) => ({
        draftCounts: { ...s.draftCounts, [countId]: { ...s.draftCounts[countId], [itemId]: countedQty } },
        counts: s.counts.map((c) => (c.id === countId ? { ...c, lines: c.lines.map((l) => (l.itemId === itemId ? { ...l, countedQty } : l)) } : c)),
      }));
    },
    /** Sends every line as counted (untouched lines at the system quantity, so they post no change), then posts. */
    postStockCount: (countId: string) =>
      attempt(async () => {
        const count = useLiveStoresData.getState().counts.find((c) => c.id === countId);
        if (!count) throw new Error("This count is no longer in the list; refresh and try again.");
        for (const line of count.lines) await emrRequest(`/stores/counts/${countId}/lines`, { method: "POST", body: { itemId: line.itemId, countedQty: line.countedQty } });
        const result = await emrRequest<{ data: { adjustments: number } }>(`/stores/counts/${countId}/post`, { method: "POST", version: count.version, body: {} });
        useLiveStoresData.setState((s) => { const { [countId]: _posted, ...rest } = s.draftCounts; return { draftCounts: rest }; });
        await reload();
        return { adjustments: result.data.adjustments };
      }),
  };
}

export type LiveStores = ReturnType<typeof liveStores>;

/** Live hospital → its stores; otherwise the demo stock ledger, unchanged. */
export function useStoresSource() {
  const live = useIsLiveEmr();
  useLiveStoresLoad(live);
  const liveState = useLiveStoresData();
  const demo = useInventoryAccounting();
  return live ? liveStores(liveState) : demo;
}

/** Live hospital → its storage locations; otherwise the demo locations. Also names the main store. */
export function useStoreLocationsSource() {
  const live = useIsLiveEmr();
  const liveLocations = useLiveStoresData((s) => s.locations);
  const mainLocationId = useLiveStoresData((s) => s.mainLocationId);
  const demo = useInventoryLocations();
  if (!live) return { ...demo, mainLocationId: DEFAULT_STORE_LOCATION_ID };
  const locationById = (id?: string) => liveLocations.find((l) => l.id === id);
  return {
    locations: liveLocations,
    activeLocations: () => liveLocations.filter((l) => l.status === "Active"),
    locationById,
    locationName: (id?: string) => locationById(id)?.name ?? "—",
    mainLocationId,
  };
}
