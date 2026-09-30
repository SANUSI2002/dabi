import { useEffect } from "react";
import { create } from "zustand";
import type { QueueEntry, Station } from "@/data/types";
import { emrRequest } from "./client";
import { PRIORITY_TO_API, STATUS_TO_API, queueEntryFromApi, type ApiQueueEntry, type LiveQueueEntry } from "./mappers";

// The hospital's live station queue. Loaded from the backend and refreshed while the queue screen
// is open, so staff at different desks see the same patients. Every change goes to the server and
// the list is reloaded from it — the browser never invents queue state.

const REFRESH_MS = 15_000;
const ALL_STATUSES = "WAITING,IN_PROGRESS,COMPLETED,REFERRED";

type LiveQueueState = {
  entries: LiveQueueEntry[];
  loaded: boolean;
  error: string;
  load: () => Promise<void>;
  /** Check-in: opens a visit for the patient and places it at the station. */
  checkIn: (patientId: string, station: Station, priority: QueueEntry["priority"], complaint?: string) => Promise<void>;
  /** Most urgent, longest-waiting patient at the station (or anywhere); null when nobody is waiting. */
  callNext: (station?: Station) => Promise<LiveQueueEntry | null>;
  update: (entry: LiveQueueEntry, change: { station?: Station; status?: QueueEntry["status"]; priority?: QueueEntry["priority"] }) => Promise<void>;
  reset: () => void;
};

export const useLiveQueue = create<LiveQueueState>((set, get) => ({
  entries: [],
  loaded: false,
  error: "",

  load: async () => {
    try {
      const result = await emrRequest<{ data: { items: ApiQueueEntry[] } }>(`/queue?status=${ALL_STATUSES}&limit=500`);
      set({ entries: result.data.items.map(queueEntryFromApi), loaded: true, error: "" });
    } catch (cause) {
      set({ loaded: true, error: cause instanceof Error ? cause.message : "The queue could not be loaded." });
    }
  },

  checkIn: async (patientId, station, priority, complaint) => {
    const reason = complaint?.trim();
    await emrRequest("/encounters", {
      method: "POST",
      body: { patientId, station, priority: PRIORITY_TO_API[priority], ...(reason ? { reason } : {}) },
    });
    await get().load();
  },

  callNext: async (station) => {
    try {
      const result = await emrRequest<{ data: ApiQueueEntry }>("/queue/call-next", { method: "POST", body: station ? { station } : {} });
      await get().load();
      return queueEntryFromApi(result.data);
    } catch (cause) {
      if ((cause as { code?: string }).code === "NOTHING_WAITING") return null;
      throw cause;
    }
  },

  update: async (entry, change) => {
    await emrRequest(`/queue/${entry.id}`, {
      method: "PATCH",
      version: entry.version,
      body: {
        ...(change.station ? { station: change.station } : {}),
        ...(change.status ? { status: STATUS_TO_API[change.status] } : {}),
        ...(change.priority ? { priority: PRIORITY_TO_API[change.priority] } : {}),
      },
    });
    await get().load();
  },

  reset: () => set({ entries: [], loaded: false, error: "" }),
}));

/** Loads the queue now and refreshes it while the calling screen is open. */
export function useLiveQueueRefresh(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const { load } = useLiveQueue.getState();
    void load();
    const timer = window.setInterval(() => { void load(); }, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [enabled]);
}
