import { useEffect } from "react";
import { create } from "zustand";
import type { Patient, PncVisit } from "@/data/types";
import { emrRequest, newIdempotencyKey } from "./client";
import { patientFromApi, type ApiPatient } from "./mappers";
import { parseBloodPressure } from "./antenatal";

// Postnatal care in live mode: visits (GET /postnatal), the contacts-due list worked out by the
// hospital (GET /postnatal/due), the mother's deliveries for linking, and recording a visit.

type ApiPatientSummary = Pick<ApiPatient, "id" | "medicalRecordNumber" | "givenName" | "familyName" | "dateOfBirth" | "sex">;
export type ApiPncVisit = {
  id: string; patientId: string; patient?: ApiPatientSummary; deliveryId: string | null; visitDate: string; daysPostpartum: number; contact: 1 | 2 | 3 | 4;
  systolic: number | null; diastolic: number | null; uterus: string; lochia: string; breast: string; breastfeeding: string; dangerSigns: string[];
  fpCounselled: boolean; notes: string | null; escalatedEncounterId: string | null; status: "ACTIVE" | "ENTERED_IN_ERROR"; recordedByName: string | null;
};
export type ApiDue = {
  deliveryId: string; patientId: string; patient?: ApiPatientSummary; deliveredAt: string; deliveryMode: string; babyStatus: string;
  daysPostpartum: number; nextContact: 1 | 2 | 3 | 4; overdueDays: number; status: "OVERDUE" | "DUE" | "UPCOMING";
};
type ApiDeliveryOption = { id: string; deliveredAt: string; mode: string; babyStatus: string; status: string };

/** "Well contracted" ↔ WELL_CONTRACTED, "Not breastfeeding" ↔ NOT_BREASTFEEDING. */
export const toCode = (label: string) => label.trim().toUpperCase().replace(/\s+/g, "_");
export const toLabel = (code: string) => code.charAt(0) + code.slice(1).toLowerCase().replace(/_/g, " ");

export type LivePncVisit = PncVisit & { patient?: Patient; recordedBy?: string; escalated: boolean };
export function visitFromApi(v: ApiPncVisit): LivePncVisit {
  return {
    id: v.id, patientId: v.patientId, patient: v.patient ? patientFromApi(v.patient) : undefined, deliveryId: v.deliveryId ?? undefined,
    contact: v.contact, date: v.visitDate, timing: `PNC ${v.contact}`, daysPP: v.daysPostpartum,
    bp: v.systolic !== null && v.diastolic !== null ? `${v.systolic}/${v.diastolic}` : undefined,
    uterus: toLabel(v.uterus), lochia: toLabel(v.lochia), breast: toLabel(v.breast), breastfeeding: toLabel(v.breastfeeding),
    dangerSigns: v.dangerSigns, fpCounselled: v.fpCounselled, notes: v.notes ?? undefined, recordedBy: v.recordedByName ?? undefined, escalated: !!v.escalatedEncounterId,
  };
}

export type LiveDue = { deliveryId: string; patientId: string; patient?: Patient; deliveredAt: string; daysPP: number; nextContact: 1 | 2 | 3 | 4; overdueDays: number; status: "Overdue" | "Due" | "Upcoming" };
export const dueFromApi = (d: ApiDue): LiveDue => ({
  deliveryId: d.deliveryId, patientId: d.patientId, patient: d.patient ? patientFromApi(d.patient) : undefined, deliveredAt: d.deliveredAt,
  daysPP: d.daysPostpartum, nextContact: d.nextContact, overdueDays: d.overdueDays, status: d.status === "OVERDUE" ? "Overdue" : d.status === "DUE" ? "Due" : "Upcoming",
});

export type PncForm = { patientId: string; deliveryId: string; date: string; daysPP: number; bp: string; uterus: string; lochia: string; breast: string; breastfeeding: string; fpCounselled: boolean; notes: string };

type PostnatalState = {
  visits: LivePncVisit[];
  due: LiveDue[];
  deliveriesFor: Record<string, { id: string; date: string; mode: string; babyStatus: string }[]>;
  error: string;
  load: () => Promise<void>;
  loadDeliveries: (patientId: string) => Promise<void>;
  record: (form: PncForm, dangerSigns: string[], idempotencyKey: string) => Promise<LivePncVisit>;
};

export const useLivePostnatal = create<PostnatalState>((set, get) => ({
  visits: [],
  due: [],
  deliveriesFor: {},
  error: "",
  load: async () => {
    try {
      const [visits, due] = await Promise.all([
        emrRequest<{ data: { items: ApiPncVisit[] } }>("/postnatal?limit=200"),
        emrRequest<{ data: { items: ApiDue[] } }>("/postnatal/due"),
      ]);
      // Visits entered in error stay on the hospital's record but are not shown as care given.
      set({ visits: visits.data.items.filter((v) => v.status === "ACTIVE").map(visitFromApi), due: due.data.items.map(dueFromApi), error: "" });
    } catch (cause) {
      set({ error: cause instanceof Error ? cause.message : "Postnatal records could not be loaded." });
    }
  },
  loadDeliveries: async (patientId) => {
    if (!patientId || get().deliveriesFor[patientId]) return;
    try {
      const result = await emrRequest<{ data: { items: ApiDeliveryOption[] } }>(`/deliveries?patientId=${encodeURIComponent(patientId)}&limit=20`);
      const options = result.data.items.filter((d) => d.status === "ACTIVE").map((d) => ({ id: d.id, date: d.deliveredAt, mode: toLabel(d.mode), babyStatus: toLabel(d.babyStatus) }));
      set((state) => ({ deliveriesFor: { ...state.deliveriesFor, [patientId]: options } }));
    } catch {
      set((state) => ({ deliveriesFor: { ...state.deliveriesFor, [patientId]: [] } }));
    }
  },
  record: async (form, dangerSigns, idempotencyKey) => {
    const result = await emrRequest<{ data: ApiPncVisit }>("/postnatal", {
      method: "POST", idempotencyKey,
      body: {
        patientId: form.patientId, visitDate: form.date, ...parseBloodPressure(form.bp),
        ...(form.deliveryId ? { deliveryId: form.deliveryId } : { daysPostpartum: form.daysPP }),
        uterus: toCode(form.uterus), lochia: toCode(form.lochia), breast: toCode(form.breast), breastfeeding: toCode(form.breastfeeding),
        dangerSigns, fpCounselled: form.fpCounselled, ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
      },
    });
    await get().load();
    return visitFromApi(result.data);
  },
}));

export function useLivePostnatalLoad(enabled: boolean) {
  useEffect(() => {
    if (enabled) void useLivePostnatal.getState().load();
  }, [enabled]);
}

export { newIdempotencyKey };
