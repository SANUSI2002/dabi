import { create } from "zustand";
import * as seed from "@/data/companyAssets";
import { audit } from "@/store/useAudit";
import { useHr } from "@/store/useHr";
import type { AssetCategory, CompanyAsset, AssetAllocation, AssetRequest, AssetRequestStatus } from "@/data/companyAssets";

const rid = () => Math.random().toString(36).slice(2, 9);
const who = (id: string) => useHr.getState().byId(id)?.name ?? id;

type CompanyAssetsState = {
  categories: AssetCategory[];
  assets: CompanyAsset[];
  allocations: AssetAllocation[];
  requests: AssetRequest[];

  addCategory: (c: Omit<AssetCategory, "id">) => void;
  addAsset: (a: Omit<CompanyAsset, "id" | "status">) => void;

  requestAsset: (employeeId: string, categoryId: string, description: string) => void;
  decideRequest: (id: string, status: "Approved" | "Rejected") => void;
  allocateAsset: (assetId: string, employeeId: string, requestId?: string) => void;
  returnAsset: (allocationId: string, condition: "Good" | "Damaged" | "Lost", note?: string) => void;

  currentHolder: (assetId: string) => string | undefined;
};

export const useCompanyAssets = create<CompanyAssetsState>((set, get) => ({
  categories: seed.categories,
  assets: seed.assets,
  allocations: seed.allocations,
  requests: seed.requests,

  addCategory: (c) => {
    audit("added asset category", `hr/assets/category/${c.name}`);
    set((s) => ({ categories: [{ ...c, id: rid() }, ...s.categories] }));
  },

  addAsset: (a) => {
    audit("added company asset", `hr/assets/${a.trackingId}`);
    set((s) => ({ assets: [{ ...a, id: rid(), status: "Available" }, ...s.assets] }));
  },

  requestAsset: (employeeId, categoryId, description) => {
    audit("requested asset", `hr/assets/request/${who(employeeId)}`);
    set((s) => ({
      requests: [{ id: rid(), employeeId, categoryId, description, requestedDate: new Date().toISOString(), status: "Requested" }, ...s.requests],
    }));
  },

  decideRequest: (id, status) => {
    const r = get().requests.find((x) => x.id === id);
    audit(`asset request ${status.toLowerCase()}`, `hr/assets/request/${r ? who(r.employeeId) : id}`);
    set((s) => ({ requests: s.requests.map((x) => (x.id === id ? { ...x, status } : x)) }));
  },

  allocateAsset: (assetId, employeeId, requestId) => {
    const asset = get().assets.find((a) => a.id === assetId);
    audit("allocated asset", `hr/assets/${asset?.trackingId ?? assetId}`, { user: who(employeeId) });
    set((s) => ({
      allocations: [{ id: rid(), assetId, employeeId, assignedDate: new Date().toISOString() }, ...s.allocations],
      assets: s.assets.map((a) => (a.id === assetId ? { ...a, status: "In Use" } : a)),
      requests: requestId ? s.requests.map((r) => (r.id === requestId ? { ...r, status: "Allocated" } : r)) : s.requests,
    }));
  },

  returnAsset: (allocationId, condition, note) => {
    const alloc = get().allocations.find((a) => a.id === allocationId);
    if (!alloc) return;
    audit("returned asset", `hr/assets/${alloc.assetId}`, { user: who(alloc.employeeId) });
    const now = new Date().toISOString();
    set((s) => ({
      allocations: s.allocations.map((a) => (a.id === allocationId ? { ...a, returnDate: now, returnCondition: condition, returnNote: note } : a)),
      assets: s.assets.map((a) => (a.id === alloc.assetId ? { ...a, status: condition === "Good" ? "Available" : "Not Available" } : a)),
    }));
  },

  currentHolder: (assetId) => {
    const alloc = get().allocations.find((a) => a.assetId === assetId && !a.returnDate);
    return alloc ? who(alloc.employeeId) : undefined;
  },
}));
