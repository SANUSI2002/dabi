import { startOfDay, endOfDay, startOfMonth, startOfQuarter, startOfYear, subDays, isWithinInterval } from "date-fns";
import type { EmrSnapshot } from "./types";

export type DateRange = { from: Date; to: Date };

export const DATE_PRESETS = ["Today", "Last 7 days", "Last 30 days", "This month", "This quarter", "This year", "Custom"] as const;
export type DatePreset = (typeof DATE_PRESETS)[number];

export function resolveRange(preset: DatePreset, customFrom: string, customTo: string): DateRange {
  const now = new Date();
  switch (preset) {
    case "Today": return { from: startOfDay(now), to: endOfDay(now) };
    case "Last 7 days": return { from: startOfDay(subDays(now, 6)), to: endOfDay(now) };
    case "Last 30 days": return { from: startOfDay(subDays(now, 29)), to: endOfDay(now) };
    case "This month": return { from: startOfMonth(now), to: endOfDay(now) };
    case "This quarter": return { from: startOfQuarter(now), to: endOfDay(now) };
    case "This year": return { from: startOfYear(now), to: endOfDay(now) };
    case "Custom":
      return {
        from: customFrom ? startOfDay(new Date(`${customFrom}T00:00:00`)) : startOfMonth(now),
        to: customTo ? endOfDay(new Date(`${customTo}T00:00:00`)) : endOfDay(now),
      };
  }
}

function within(dateIso: string | undefined, range: DateRange): boolean {
  if (!dateIso) return false;
  const parsed = new Date(dateIso);
  if (Number.isNaN(parsed.getTime())) return false;
  return isWithinInterval(parsed, { start: range.from, end: range.to });
}

/**
 * Scopes an EmrSnapshot to a date range by filtering each entity on its own occurrence date
 * (encounter date, order date, admission date, etc.). Entities that represent ongoing caseload
 * rather than a single dated event — patients, the NCD/Family Planning/ANC registers, and asset
 * or ward master data — are intentionally left unscoped, since there is no reliable per-period
 * "active during this range" signal for them in this build. The Reports page discloses this.
 */
export function scopeSnapshot(snap: EmrSnapshot, range: DateRange): EmrSnapshot {
  return {
    ...snap,
    queue: snap.queue.filter((q) => within(q.enqueuedAt, range)),
    encounters: snap.encounters.filter((e) => within(e.date, range)),
    labOrders: snap.labOrders.filter((l) => within(l.orderedAt, range)),
    admissions: snap.admissions.filter((a) => within(a.admittedAt, range)),
    appointments: snap.appointments.filter((a) => within(a.date, range)),
    referrals: snap.referrals.filter((r) => within(r.date, range)),
    transfers: snap.transfers.filter((t) => within(t.date, range)),
    childVisits: snap.childVisits.filter((v) => within(v.date, range)),
    deliveries: snap.deliveries.filter((d) => within(d.date, range)),
    birthRegister: snap.birthRegister.filter((b) => within(b.bornAt, range)),
    immunizations: snap.immunizations.filter((i) => within(i.givenAt, range)),
    pncVisits: snap.pncVisits.filter((v) => within(v.date, range)),
    cmamScreenings: snap.cmamScreenings.filter((c) => within(c.date, range)),
    outreachActivities: snap.outreachActivities.filter((a) => within(a.date, range)),
    surveillanceCases: snap.surveillanceCases.filter((c) => within(c.reportedAt, range)),
  };
}
