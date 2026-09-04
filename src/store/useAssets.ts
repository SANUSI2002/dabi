import { create } from "zustand";
import { addDays, differenceInCalendarDays } from "date-fns";
import * as seed from "@/data/assets";
import { audit } from "@/store/useAudit";
import { useIdentity } from "@/store/useIdentity";
import type { Asset, MaintenanceJob, JobStatus } from "@/data/assets";

const rid = () => Math.random().toString(36).slice(2, 9);
const me = () => useIdentity.getState().user.name;

export const nextPmDue = (a: Asset) => addDays(new Date(a.lastServicedOn), a.serviceIntervalDays);

export function pmState(a: Asset): { label: "Overdue" | "Due soon" | "Scheduled"; days: number } {
  const days = differenceInCalendarDays(nextPmDue(a), new Date());
  if (days < 0) return { label: "Overdue", days };
  if (days <= 14) return { label: "Due soon", days };
  return { label: "Scheduled", days };
}

type AssetsState = {
  assets: Asset[];
  jobs: MaintenanceJob[];
  addAsset: (a: Omit<Asset, "id" | "status">) => void;
  reportFault: (assetId: string, data: { summary: string; reportedBy: string; priority: MaintenanceJob["priority"] }) => void;
  setJobStatus: (id: string, status: JobStatus) => void;
  resolveJob: (id: string, resolution: string) => void;
  schedulePm: (assetId: string) => void;
  completePm: (assetId: string, note: string) => void;
  setAssetStatus: (id: string, status: Asset["status"]) => void;
};

export const useAssets = create<AssetsState>((set, get) => ({
  assets: seed.assets,
  jobs: seed.maintenanceJobs,

  addAsset: (a) => {
    audit("added asset", `equipment/${a.tag}`);
    set((s) => ({ assets: [{ ...a, id: rid(), status: "In service" }, ...s.assets] }));
  },

  reportFault: (assetId, data) => {
    const asset = get().assets.find((x) => x.id === assetId);
    audit("reported equipment fault", `equipment/${asset?.tag ?? assetId}`, { user: data.reportedBy });
    set((s) => ({
      jobs: [
        { id: rid(), assetId, type: "Corrective", summary: data.summary, reportedBy: data.reportedBy, priority: data.priority, status: "Open", openedOn: new Date().toISOString() },
        ...s.jobs,
      ],
      assets: s.assets.map((x) => (x.id === assetId && data.priority === "High" && x.status === "In service" ? { ...x, status: "Under repair" } : x)),
    }));
  },

  setJobStatus: (id, status) => {
    const j = get().jobs.find((x) => x.id === id);
    audit(`maintenance job ${status.toLowerCase()}`, `equipment/${j?.assetId ?? id}`);
    set((s) => ({ jobs: s.jobs.map((x) => (x.id === id ? { ...x, status } : x)) }));
  },

  resolveJob: (id, resolution) => {
    const j = get().jobs.find((x) => x.id === id);
    if (!j) return;
    const asset = get().assets.find((x) => x.id === j.assetId);
    audit("resolved maintenance job", `equipment/${asset?.tag ?? j.assetId}`);
    const now = new Date().toISOString();
    set((s) => {
      const jobs = s.jobs.map((x) => (x.id === id ? { ...x, status: "Resolved" as JobStatus, closedOn: now, resolution } : x));
      const stillOpen = jobs.some((x) => x.assetId === j.assetId && x.status !== "Resolved");
      return {
        jobs,
        assets: s.assets.map((x) =>
          x.id === j.assetId
            ? {
                ...x,
                lastServicedOn: now,
                status: stillOpen ? x.status : x.status === "Under repair" ? "In service" : x.status,
              }
            : x,
        ),
      };
    });
  },

  schedulePm: (assetId) => {
    const asset = get().assets.find((x) => x.id === assetId);
    audit("scheduled preventive maintenance", `equipment/${asset?.tag ?? assetId}`);
    set((s) => ({
      jobs: [
        { id: rid(), assetId, type: "Preventive", summary: `Scheduled service — ${asset?.name ?? "asset"}`, reportedBy: me(), priority: "Low", status: "Open", openedOn: new Date().toISOString() },
        ...s.jobs,
      ],
    }));
  },

  completePm: (assetId, note) => {
    const asset = get().assets.find((x) => x.id === assetId);
    audit("completed preventive maintenance", `equipment/${asset?.tag ?? assetId}`);
    const now = new Date().toISOString();
    const summary = note || "Routine preventive service";
    set((s) => {
      const openPm = s.jobs.find((x) => x.assetId === assetId && x.type === "Preventive" && x.status !== "Resolved");
      const jobs = openPm
        ? s.jobs.map((x) => (x.id === openPm.id ? { ...x, status: "Resolved" as JobStatus, closedOn: now, resolution: summary } : x))
        : [
            { id: rid(), assetId, type: "Preventive" as const, summary, reportedBy: me(), priority: "Low" as const, status: "Resolved" as JobStatus, openedOn: now, closedOn: now, resolution: summary },
            ...s.jobs,
          ];
      return {
        jobs,
        assets: s.assets.map((x) => (x.id === assetId ? { ...x, lastServicedOn: now, status: x.status === "Under repair" ? x.status : "In service" } : x)),
      };
    });
  },

  setAssetStatus: (id, status) => {
    const asset = get().assets.find((x) => x.id === id);
    audit("updated asset status", `equipment/${asset?.tag ?? id}`);
    set((s) => ({ assets: s.assets.map((x) => (x.id === id ? { ...x, status } : x)) }));
  },
}));
