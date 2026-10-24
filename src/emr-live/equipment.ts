import { useEffect } from "react";
import { create } from "zustand";
import type { Asset, AssetCategory, AssetStatus, JobStatus, MaintenanceJob } from "@/data/assets";
import { emrRequest, newIdempotencyKey } from "./client";

// Equipment & maintenance in live mode: the hospital's asset register and maintenance jobs
// (GET /equipment), with the same actions the screen offers (register, report a fault, start/resolve a
// job, raise a preventive job, log a service, change status).

export type ApiAsset = {
  id: string; tag: string; name: string; category: AssetCategory; location: string; status: "IN_SERVICE" | "UNDER_REPAIR" | "OUT_OF_SERVICE" | "RETIRED";
  serialNumber: string | null; costMinor: number | null; commissionedOn: string; serviceIntervalDays: number; lastServicedOn: string; version: number;
};
export type ApiJob = {
  id: string; assetId: string; type: "CORRECTIVE" | "PREVENTIVE"; summary: string; priority: "LOW" | "MEDIUM" | "HIGH"; status: "OPEN" | "IN_PROGRESS" | "RESOLVED";
  version: number; reportedByName: string | null; openedAt: string; closedAt: string | null; resolution: string | null;
};

const ASSET_STATUS: Record<ApiAsset["status"], AssetStatus> = { IN_SERVICE: "In service", UNDER_REPAIR: "Under repair", OUT_OF_SERVICE: "Out of service", RETIRED: "Retired" };
const JOB_STATUS: Record<ApiJob["status"], JobStatus> = { OPEN: "Open", IN_PROGRESS: "In Progress", RESOLVED: "Resolved" };
export const assetStatusCode = (label: AssetStatus) => (Object.entries(ASSET_STATUS).find(([, l]) => l === label)?.[0] ?? "IN_SERVICE") as ApiAsset["status"];
const title = (code: string) => code.charAt(0) + code.slice(1).toLowerCase();

export type LiveAsset = Asset & { version: number; serialNumber?: string; cost?: number };
export const assetFromApi = (a: ApiAsset): LiveAsset => ({
  id: a.id, tag: a.tag, name: a.name, category: a.category, location: a.location, status: ASSET_STATUS[a.status], commissionedOn: a.commissionedOn,
  serviceIntervalDays: a.serviceIntervalDays, lastServicedOn: a.lastServicedOn, version: a.version, serialNumber: a.serialNumber ?? undefined,
  cost: a.costMinor === null ? undefined : a.costMinor / 100,
});
export type LiveJob = MaintenanceJob & { version: number };
export const jobFromApi = (j: ApiJob): LiveJob => ({
  id: j.id, assetId: j.assetId, type: j.type === "PREVENTIVE" ? "Preventive" : "Corrective", summary: j.summary, reportedBy: j.reportedByName ?? "Unknown staff member",
  priority: title(j.priority) as MaintenanceJob["priority"], status: JOB_STATUS[j.status], openedOn: j.openedAt, closedOn: j.closedAt ?? undefined,
  resolution: j.resolution ?? undefined, version: j.version,
});

type NewAsset = Omit<Asset, "id" | "status"> & { serialNumber?: string; cost?: number; status?: AssetStatus };
type EquipmentState = {
  assets: LiveAsset[];
  jobs: LiveJob[];
  error: string;
  load: () => Promise<void>;
  addAsset: (a: NewAsset, idempotencyKey?: string) => Promise<void>;
  reportFault: (assetId: string, data: { summary: string; priority: MaintenanceJob["priority"] }, idempotencyKey?: string) => Promise<void>;
  setJobStatus: (id: string, status: JobStatus) => Promise<void>;
  resolveJob: (id: string, resolution: string) => Promise<void>;
  schedulePm: (assetId: string) => Promise<void>;
  completePm: (assetId: string, note: string) => Promise<void>;
  setAssetStatus: (id: string, status: AssetStatus) => Promise<void>;
};

const day = (iso: string) => iso.slice(0, 10);

export const useLiveEquipment = create<EquipmentState>((set, get) => {
  const after = async (work: Promise<unknown>) => { await work; await get().load(); };
  const job = (id: string) => {
    const found = get().jobs.find((j) => j.id === id);
    if (!found) throw new Error("This job is no longer in the list; refresh and try again.");
    return found;
  };
  return {
    assets: [], jobs: [], error: "",
    load: async () => {
      try {
        const result = await emrRequest<{ data: { assets: ApiAsset[]; jobs: ApiJob[] } }>("/equipment");
        set({ assets: result.data.assets.map(assetFromApi), jobs: result.data.jobs.map(jobFromApi), error: "" });
      } catch (cause) {
        set({ error: cause instanceof Error ? cause.message : "The equipment register could not be loaded." });
      }
    },
    addAsset: (a, idempotencyKey = newIdempotencyKey()) => after(emrRequest("/equipment/assets", {
      method: "POST", idempotencyKey,
      body: {
        tag: a.tag, name: a.name, category: a.category, location: a.location.trim() || "Unassigned", commissionedOn: day(a.commissionedOn), lastServicedOn: day(a.lastServicedOn),
        serviceIntervalDays: a.serviceIntervalDays, ...(a.serialNumber ? { serialNumber: a.serialNumber } : {}), ...(a.cost ? { costMinor: Math.round(a.cost * 100) } : {}),
        ...(a.status ? { status: assetStatusCode(a.status) } : {}),
      },
    })),
    reportFault: (assetId, data, idempotencyKey = newIdempotencyKey()) => after(emrRequest("/equipment/faults", { method: "POST", idempotencyKey, body: { assetId, summary: data.summary, priority: data.priority.toUpperCase() } })),
    setJobStatus: async (id, status) => {
      if (status !== "In Progress") throw new Error("Use Resolve to close a job.");
      await after(emrRequest(`/equipment/jobs/${id}/start`, { method: "POST", version: job(id).version, body: {} }));
    },
    resolveJob: (id, resolution) => after(emrRequest(`/equipment/jobs/${id}/resolve`, { method: "POST", version: job(id).version, body: { resolution } })),
    schedulePm: (assetId) => after(emrRequest(`/equipment/assets/${assetId}/pm-jobs`, { method: "POST", body: {} })),
    completePm: (assetId, note) => after(emrRequest(`/equipment/assets/${assetId}/service`, { method: "POST", body: note ? { note } : {} })),
    setAssetStatus: async (id, status) => {
      const asset = get().assets.find((a) => a.id === id);
      if (!asset) throw new Error("This asset is no longer in the list; refresh and try again.");
      await after(emrRequest(`/equipment/assets/${id}/status`, { method: "POST", version: asset.version, body: { status: assetStatusCode(status) } }));
    },
  };
});

export function useLiveEquipmentLoad(enabled: boolean) {
  useEffect(() => { if (enabled) void useLiveEquipment.getState().load(); }, [enabled]);
}
