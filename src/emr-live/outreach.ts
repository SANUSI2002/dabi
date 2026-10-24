import { useEffect } from "react";
import { create } from "zustand";
import type { OutreachActivity } from "@/data/types";
import { emrRequest, newIdempotencyKey } from "./client";

// Community outreach in live mode: the hospital's activity log (GET /outreach), logging an activity, and
// the CHW roster (members who carry out outreach: GET /staff?permission=outreach.chw — names only).

export type ApiOutreach = {
  id: string; chwUserId: string; chwName: string | null; activityType: string; ward: string; households: number; referrals: number;
  activityDate: string; notes: string | null; status: "ACTIVE" | "ENTERED_IN_ERROR"; recordedByName: string | null; createdAt: string;
};
export type Chw = { userId: string; name: string };

export const outreachFromApi = (a: ApiOutreach): OutreachActivity => ({
  id: a.id, chw: a.chwName ?? "Unknown staff member", type: a.activityType, ward: a.ward, households: a.households, referrals: a.referrals,
  date: a.activityDate, notes: a.notes ?? undefined,
});

type OutreachState = {
  activities: OutreachActivity[];
  chws: Chw[];
  error: string;
  load: () => Promise<void>;
  log: (form: { chwUserId: string; type: string; ward: string; households: number; referrals: number; date: string; notes: string }, idempotencyKey: string) => Promise<void>;
};

export const useLiveOutreach = create<OutreachState>((set, get) => ({
  activities: [],
  chws: [],
  error: "",
  load: async () => {
    try {
      const [log, roster] = await Promise.all([
        emrRequest<{ data: { items: ApiOutreach[] } }>("/outreach?limit=500"),
        emrRequest<{ data: { items: Chw[] } }>("/staff?permission=outreach.chw"),
      ]);
      set({ activities: log.data.items.map(outreachFromApi), chws: roster.data.items, error: "" });
    } catch (cause) {
      set({ error: cause instanceof Error ? cause.message : "Outreach activities could not be loaded." });
    }
  },
  log: async (form, idempotencyKey) => {
    await emrRequest("/outreach", {
      method: "POST", idempotencyKey,
      body: {
        chwUserId: form.chwUserId, activityType: form.type, ward: form.ward.trim(), households: form.households, referrals: form.referrals,
        activityDate: form.date, ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
      },
    });
    await get().load();
  },
}));

export function useLiveOutreachLoad(enabled: boolean) {
  useEffect(() => {
    if (enabled) void useLiveOutreach.getState().load();
  }, [enabled]);
}

export { newIdempotencyKey };
