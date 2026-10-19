import { useEffect } from "react";
import { create } from "zustand";
import type { AncRecord, Patient } from "@/data/types";
import { emrRequest, newIdempotencyKey } from "./client";
import { patientFromApi, type ApiPatient } from "./mappers";

// Antenatal care in live mode: the hospital's pregnancies (GET /antenatal), enrolment and visits.
// EDD, gestational age and risk flags come from the server; the screen only shows them.

type ApiStatus = "ACTIVE" | "DELIVERED" | "TRANSFERRED_OUT" | "ENDED";
type ApiVisit = {
  id: string; visitDate: string; gestationalWeeks: number; weightKg: number | null; systolic: number | null; diastolic: number | null;
  hb: number | null; fetalHeartRate: number | null; nextVisitDate: string | null; notes: string | null; status: "ACTIVE" | "ENTERED_IN_ERROR";
  recordedByName: string | null;
};
export type ApiPregnancy = {
  id: string; patientId: string; version: number; status: ApiStatus; lmp: string; edd: string; gravida: number; parity: number;
  bloodGroup: string | null; bookingHb: number | null; ttDoses: number; gestationalWeeksToday: number | null;
  riskFlags: { code: string; label: string }[]; visits: ApiVisit[];
  labs: { orderId: string; itemId: string; testName: string; status: "PENDING" | "RESULTED" | "VERIFIED"; orderedAt: string; result: string | null }[] | null;
  patient?: Pick<ApiPatient, "id" | "medicalRecordNumber" | "givenName" | "familyName" | "dateOfBirth" | "sex">;
};

const STATUS: Record<ApiStatus, AncRecord["status"]> = { ACTIVE: "Active", DELIVERED: "Delivered", TRANSFERRED_OUT: "Transferred", ENDED: "Ended" };

/** A pregnancy as the Antenatal screen renders it, plus what live steps need. */
export type LiveAncRecord = AncRecord & { version: number; patient?: Patient };

export function ancFromApi(row: ApiPregnancy): LiveAncRecord {
  // Entered-in-error visits stay on the hospital's record but are not shown as care given.
  const visits = row.visits.filter((v) => v.status === "ACTIVE");
  const hbs = visits.filter((v) => v.hb !== null).map((v) => v.hb as number);
  return {
    id: row.id,
    version: row.version,
    patientId: row.patientId,
    patient: row.patient ? patientFromApi(row.patient) : undefined,
    lmp: row.lmp,
    edd: row.edd,
    gravida: row.gravida,
    para: row.parity,
    bloodGroup: row.bloodGroup ?? undefined,
    hb: hbs.length ? hbs[hbs.length - 1] : row.bookingHb ?? undefined,
    ttDoses: row.ttDoses,
    status: STATUS[row.status],
    gestationalWeeksToday: row.gestationalWeeksToday ?? undefined,
    riskFlags: row.riskFlags,
    visits: visits.map((v) => ({
      id: v.id,
      date: v.visitDate,
      weeks: v.gestationalWeeks,
      weight: v.weightKg ?? undefined,
      bp: v.systolic !== null && v.diastolic !== null ? `${v.systolic}/${v.diastolic}` : "",
      hb: v.hb ?? undefined,
      fhr: v.fetalHeartRate ?? undefined,
      next: v.nextVisitDate ?? "",
      recordedBy: v.recordedByName ?? undefined,
    })),
    labs: row.labs === null ? null : row.labs.map((l) => ({ id: l.itemId, testName: l.testName, orderedAt: l.orderedAt, status: l.status === "PENDING" ? "Pending" : l.status === "RESULTED" ? "Resulted" : "Verified", result: l.result ?? undefined })),
  };
}

/** "120/80" → { systolic, diastolic }; empty → nothing; anything else is a typing mistake. */
export function parseBloodPressure(text: string): { systolic?: number; diastolic?: number } {
  const value = text.trim();
  if (!value) return {};
  const match = /^(\d{2,3})\s*\/\s*(\d{2,3})$/.exec(value);
  if (!match) throw new Error("Write the blood pressure as systolic/diastolic, for example 120/80.");
  return { systolic: Number(match[1]), diastolic: Number(match[2]) };
}

export type EnrolForm = { patientId: string; lmp: string; gravida: number; para: number; bloodGroup: string; hb: number; ttDoses: number };
export type VisitForm = { recordId: string; date: string; weight: number; bp: string; hb: number; fhr: number; next: string };

type AntenatalState = {
  records: LiveAncRecord[];
  loaded: boolean;
  error: string;
  load: () => Promise<void>;
  enrol: (form: EnrolForm, idempotencyKey: string) => Promise<void>;
  recordVisit: (form: VisitForm, idempotencyKey: string) => Promise<void>;
};

export const useLiveAntenatal = create<AntenatalState>((set, get) => ({
  records: [],
  loaded: false,
  error: "",
  load: async () => {
    try {
      const result = await emrRequest<{ data: { items: ApiPregnancy[] } }>("/antenatal?limit=200");
      set({ records: result.data.items.map(ancFromApi), loaded: true, error: "" });
    } catch (cause) {
      set({ loaded: true, error: cause instanceof Error ? cause.message : "Antenatal records could not be loaded." });
    }
  },
  enrol: async (form, idempotencyKey) => {
    await emrRequest("/antenatal", {
      method: "POST", idempotencyKey,
      body: {
        patientId: form.patientId, lmp: form.lmp, gravida: form.gravida, parity: form.para, ttDoses: form.ttDoses,
        ...(form.bloodGroup ? { bloodGroup: form.bloodGroup } : {}),
        ...(form.hb > 0 ? { bookingHb: form.hb } : {}),
      },
    });
    await get().load();
  },
  recordVisit: async (form, idempotencyKey) => {
    const bp = parseBloodPressure(form.bp);
    await emrRequest(`/antenatal/${form.recordId}/visits`, {
      method: "POST", idempotencyKey,
      body: {
        visitDate: form.date, ...bp,
        ...(form.weight > 0 ? { weightKg: form.weight } : {}),
        ...(form.hb > 0 ? { hb: form.hb } : {}),
        ...(form.fhr > 0 ? { fetalHeartRate: form.fhr } : {}),
        ...(form.next ? { nextVisitDate: form.next } : {}),
      },
    });
    await get().load();
  },
}));

export function useLiveAntenatalLoad(enabled: boolean) {
  useEffect(() => {
    if (enabled) void useLiveAntenatal.getState().load();
  }, [enabled]);
}

/** Whole weeks from the LMP to a visit date (what the server will record). */
export const weeksFromLmp = (lmp: string, date: string) =>
  lmp && date ? Math.floor((new Date(`${date}T00:00:00Z`).getTime() - new Date(`${lmp}T00:00:00Z`).getTime()) / (7 * 86_400_000)) : 0;

export { newIdempotencyKey };
