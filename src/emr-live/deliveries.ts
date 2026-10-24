import { useEffect } from "react";
import { create } from "zustand";
import type { BirthRegisterEntry, Delivery, Patient, Sex } from "@/data/types";
import { emrRequest, newIdempotencyKey } from "./client";
import { patientFromApi, type ApiPatient } from "./mappers";

// Labour & delivery in live mode: the hospital's deliveries (GET /deliveries), the birth register
// (GET /births) and every step — record a delivery, notify, register (with the civil registration
// number NPopC issued) and record the certificate. The screen keeps its own labels; this file
// translates them to the hospital's codes and back.

type ApiPatientSummary = Pick<ApiPatient, "id" | "medicalRecordNumber" | "givenName" | "familyName" | "dateOfBirth" | "sex">;
type ApiRegistration = {
  id: string; deliveryId: string; patientId: string; version: number; status: "NOTIFIED" | "REGISTERED" | "CERTIFICATE_ISSUED";
  babyName: string | null; fatherName: string | null; informantName: string; informantRelation: string;
  notificationNumber: string; registrationNumber: string | null; notifiedAt: string; registeredAt: string | null; certificateIssuedAt: string | null;
  notifiedByName: string | null; registeredByName: string | null; certificateIssuedByName: string | null;
};
export type ApiDelivery = {
  id: string; patientId: string; pregnancyId: string | null; status: "ACTIVE" | "ENTERED_IN_ERROR"; patient?: ApiPatientSummary;
  bookingStatus: string; deliveredAt: string; gestationalWeeks: number; mode: string; motherStatus: string; bloodLossMl: number;
  complications: string | null; notes: string | null; nhmisIndicators: string[]; babySex: "FEMALE" | "MALE"; babyStatus: string;
  birthWeightKg: number; apgar1: number | null; apgar5: number | null; breastfedWithinHour: boolean;
  conductedByName: string | null; registration: ApiRegistration | null;
};
export type ApiRegisterEntry = ApiRegistration & { patient?: ApiPatientSummary; bornAt: string; babySex: "FEMALE" | "MALE"; birthWeightKg: number; deliveryMode: string };

// The screen's labels ↔ the hospital's codes.
const pairs = <T extends string>(entries: [T, string][]) => ({ code: new Map(entries.map(([c, l]) => [l, c])), label: new Map(entries) });
export const MODES = pairs([["SVD", "SVD"], ["ASSISTED_VACUUM", "Assisted (vacuum)"], ["BREECH", "Breech"], ["CAESAREAN_REFERRED", "Caesarean (referred)"]]);
export const BOOKING = pairs([["BOOKED", "Booked"], ["UNBOOKED", "Unbooked"], ["REFERRED_IN", "Referred in"]]);
export const MOTHER = pairs([["ALIVE", "Alive"], ["DIED", "Died"], ["REFERRED", "Referred"]]);
export const BABY = pairs([["ALIVE", "Alive"], ["FRESH_STILLBIRTH", "Fresh stillbirth"], ["MACERATED_STILLBIRTH", "Macerated stillbirth"]]);
export const RELATION = pairs([["MOTHER", "Mother"], ["FATHER", "Father"], ["GRANDPARENT", "Grandparent"], ["GUARDIAN", "Guardian"], ["HEALTH_WORKER", "Health worker"]]);
const REGISTER_STATUS = { NOTIFIED: "Notified", REGISTERED: "Registered", CERTIFICATE_ISSUED: "Certificate issued" } as const;
const sexOf = (value: "FEMALE" | "MALE"): Sex => (value === "FEMALE" ? "F" : "M");
const label = (map: Map<string, string>, code: string) => map.get(code) ?? code;
const nameOf = (p?: ApiPatientSummary) => (p ? `${p.givenName} ${p.familyName}` : "—");

/** A register entry as the screen renders it, plus what live steps and the printout need. */
export type LiveBirthEntry = BirthRegisterEntry & {
  version: number; patient?: Patient; notifiedBy?: string; registeredBy?: string; certificateIssuedBy?: string; deliveryMode: string;
};
/** A delivery as the screen renders it, plus its live register entry. */
export type LiveDelivery = Delivery & { patient?: Patient; linkedToAntenatal: boolean; registration?: LiveBirthEntry };

function entryFromApi(r: ApiRegistration, born: { bornAt: string; babySex: "FEMALE" | "MALE"; birthWeightKg: number; deliveryMode: string; patient?: ApiPatientSummary }, placeOfBirth: string): LiveBirthEntry {
  return {
    id: r.id, version: r.version, deliveryId: r.deliveryId, patientId: r.patientId, patient: born.patient ? patientFromApi(born.patient) : undefined,
    babyName: r.babyName ?? "", sex: sexOf(born.babySex), bornAt: born.bornAt, weight: born.birthWeightKg, placeOfBirth,
    motherName: nameOf(born.patient), fatherName: r.fatherName ?? undefined, informantName: r.informantName, informantRelation: label(RELATION.label, r.informantRelation),
    npopcNo: r.notificationNumber, regNo: r.registrationNumber ?? undefined, status: REGISTER_STATUS[r.status],
    notifiedAt: r.notifiedAt, registeredAt: r.registeredAt ?? undefined, certIssuedAt: r.certificateIssuedAt ?? undefined,
    notifiedBy: r.notifiedByName ?? undefined, registeredBy: r.registeredByName ?? undefined, certificateIssuedBy: r.certificateIssuedByName ?? undefined,
    deliveryMode: label(MODES.label, born.deliveryMode),
  };
}

export function deliveryFromApi(d: ApiDelivery, placeOfBirth: string): LiveDelivery {
  return {
    id: d.id, patientId: d.patientId, patient: d.patient ? patientFromApi(d.patient) : undefined, linkedToAntenatal: !!d.pregnancyId,
    date: d.deliveredAt, bookingStatus: label(BOOKING.label, d.bookingStatus), complications: d.complications ?? undefined, notes: d.notes ?? undefined,
    nhmisIndicators: d.nhmisIndicators, mode: label(MODES.label, d.mode), gaWeeks: d.gestationalWeeks,
    motherStatus: label(MOTHER.label, d.motherStatus) as Delivery["motherStatus"], bloodLoss: d.bloodLossMl, babySex: sexOf(d.babySex),
    babyStatus: label(BABY.label, d.babyStatus) as Delivery["babyStatus"], weight: d.birthWeightKg, apgar1: d.apgar1 ?? 0, apgar5: d.apgar5 ?? 0,
    breastfed1h: d.breastfedWithinHour, conductedBy: d.conductedByName ?? "Unknown staff member",
    registration: d.registration ? entryFromApi(d.registration, { bornAt: d.deliveredAt, babySex: d.babySex, birthWeightKg: d.birthWeightKg, deliveryMode: d.mode, patient: d.patient }, placeOfBirth) : undefined,
  };
}
export const registerEntryFromApi = (r: ApiRegisterEntry, placeOfBirth: string) => entryFromApi(r, r, placeOfBirth);

export type DeliveryForm = {
  patientId: string; date: string; mode: string; gaWeeks: number; bookingStatus: string; complications: string; notes: string; nhmisIndicators: string[];
  motherStatus: string; bloodLoss: number; babySex: Sex; babyStatus: string; weight: number; apgar1: number; apgar5: number; breastfed1h: boolean; conductedBy: string;
};
export type NotifyForm = { babyName: string; informantName: string; informantRelation: string; fatherName: string };
type Clinician = { userId: string; name: string };
const optional = (value: string) => value.trim() || undefined;

/** What the hospital needs for a delivery; `conductedBy` is the colleague's user id in live mode. */
export function deliveryBody(f: DeliveryForm) {
  const alive = f.babyStatus === "Alive";
  return {
    patientId: f.patientId, bookingStatus: BOOKING.code.get(f.bookingStatus), deliveredAt: new Date(f.date).toISOString(), gestationalWeeks: f.gaWeeks,
    mode: MODES.code.get(f.mode), motherStatus: MOTHER.code.get(f.motherStatus), bloodLossMl: f.bloodLoss,
    ...(optional(f.complications) ? { complications: optional(f.complications) } : {}), ...(optional(f.notes) ? { notes: optional(f.notes) } : {}),
    nhmisIndicators: f.nhmisIndicators, babySex: f.babySex === "F" ? "FEMALE" : "MALE", babyStatus: BABY.code.get(f.babyStatus),
    birthWeightKg: Math.round(f.weight * 100) / 100, ...(alive ? { apgar1: f.apgar1, apgar5: f.apgar5, breastfedWithinHour: f.breastfed1h } : { breastfedWithinHour: false }),
    conductedByUserId: f.conductedBy,
  };
}

type DeliveriesState = {
  deliveries: LiveDelivery[];
  register: LiveBirthEntry[];
  clinicians: Clinician[];
  loaded: boolean;
  error: string;
  load: (placeOfBirth: string) => Promise<void>;
  record: (form: DeliveryForm, idempotencyKey: string) => Promise<void>;
  notify: (deliveryId: string, form: NotifyForm, idempotencyKey: string) => Promise<void>;
  registerBirth: (entry: LiveBirthEntry, registrationNumber: string, babyName: string) => Promise<void>;
  recordCertificate: (entry: LiveBirthEntry) => Promise<void>;
};

let place = "";
export const useLiveDeliveries = create<DeliveriesState>((set, get) => ({
  deliveries: [],
  register: [],
  clinicians: [],
  loaded: false,
  error: "",
  load: async (placeOfBirth) => {
    place = placeOfBirth;
    try {
      const [deliveries, births] = await Promise.all([
        emrRequest<{ data: { items: ApiDelivery[] } }>("/deliveries?limit=200"),
        emrRequest<{ data: { items: ApiRegisterEntry[] } }>("/births?limit=200"),
      ]);
      set({
        // Deliveries entered in error stay on the hospital's record but are not shown as births.
        deliveries: deliveries.data.items.filter((d) => d.status === "ACTIVE").map((d) => deliveryFromApi(d, place)),
        register: births.data.items.map((r) => registerEntryFromApi(r, place)),
        loaded: true, error: "",
      });
    } catch (cause) {
      set({ loaded: true, error: cause instanceof Error ? cause.message : "Deliveries could not be loaded." });
    }
    if (!get().clinicians.length) {
      emrRequest<{ data: { items: Clinician[] } }>("/staff?permission=delivery.record")
        .then((result) => set({ clinicians: result.data.items }))
        .catch(() => set({ clinicians: [] }));
    }
  },
  record: async (form, idempotencyKey) => {
    await emrRequest("/deliveries", { method: "POST", idempotencyKey, body: deliveryBody(form) });
    await get().load(place);
  },
  notify: async (deliveryId, form, idempotencyKey) => {
    await emrRequest(`/deliveries/${deliveryId}/birth-notification`, {
      method: "POST", idempotencyKey,
      body: {
        informantName: form.informantName.trim(), informantRelation: RELATION.code.get(form.informantRelation),
        ...(optional(form.babyName) ? { babyName: optional(form.babyName) } : {}), ...(optional(form.fatherName) ? { fatherName: optional(form.fatherName) } : {}),
      },
    });
    await get().load(place);
  },
  registerBirth: async (entry, registrationNumber, babyName) => {
    await emrRequest(`/births/${entry.id}/register`, {
      method: "POST", version: entry.version,
      body: { registrationNumber: registrationNumber.trim(), ...(optional(babyName) ? { babyName: optional(babyName) } : {}) },
    });
    await get().load(place);
  },
  recordCertificate: async (entry) => {
    await emrRequest(`/births/${entry.id}/certificate`, { method: "POST", version: entry.version, body: {} });
    await get().load(place);
  },
}));

export function useLiveDeliveriesLoad(enabled: boolean, placeOfBirth: string) {
  useEffect(() => {
    if (enabled) void useLiveDeliveries.getState().load(placeOfBirth);
  }, [enabled, placeOfBirth]);
}

export { newIdempotencyKey };
