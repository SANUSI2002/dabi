import { useEffect } from "react";
import { create } from "zustand";
import type { Appointment, Patient } from "@/data/types";
import { emrRequest, newIdempotencyKey } from "./client";
import { patientFromApi, type ApiPatient } from "./mappers";

// The Appointments screen in live mode: the hospital's bookings (GET /appointments), booking,
// check-in (which opens the visit and queues the patient) and no-show.

type ApiType = "GENERAL" | "ANC" | "PNC" | "FOLLOW_UP" | "IMMUNIZATION" | "SPECIALIST";
type ApiStatus = "SCHEDULED" | "ATTENDED" | "NO_SHOW" | "CANCELLED";
export type ApiAppointment = {
  id: string; patientId: string; scheduledAt: string; type: ApiType; reason: string | null; status: ApiStatus; version: number;
  providerUserId: string | null; providerName?: string | null; encounterId: string | null; checkedInAt: string | null;
  patient?: Pick<ApiPatient, "id" | "medicalRecordNumber" | "givenName" | "familyName" | "dateOfBirth" | "sex">;
};

export const TYPE_FROM_API: Record<ApiType, Appointment["type"]> = {
  GENERAL: "General", ANC: "ANC", PNC: "PNC", FOLLOW_UP: "Follow-up", IMMUNIZATION: "Immunization", SPECIALIST: "Specialist",
};
const TYPE_TO_API = Object.fromEntries(Object.entries(TYPE_FROM_API).map(([api, label]) => [label, api])) as Record<Appointment["type"], ApiType>;
const STATUS_FROM_API: Record<ApiStatus, Appointment["status"]> = { SCHEDULED: "Scheduled", ATTENDED: "Attended", NO_SHOW: "No-Show", CANCELLED: "Cancelled" };

/** A booking with what live actions need (its version) and the patient it is for. */
export type LiveAppointment = Appointment & { version: number; patient?: Patient };

const pad = (value: number) => String(value).padStart(2, "0");

export function appointmentFromApi(row: ApiAppointment): LiveAppointment {
  const when = new Date(row.scheduledAt);
  return {
    id: row.id,
    version: row.version,
    patientId: row.patientId,
    patient: row.patient ? patientFromApi(row.patient) : undefined,
    date: row.scheduledAt,
    time: `${pad(when.getHours())}:${pad(when.getMinutes())}`,
    provider: row.providerName ?? "—",
    type: TYPE_FROM_API[row.type],
    reason: row.reason ?? undefined,
    status: STATUS_FROM_API[row.status],
    encounterId: row.encounterId ?? undefined,
    checkedInAt: row.checkedInAt ?? undefined,
  };
}

/** The booking form's local date and time as an instant. */
export const scheduledAtFor = (date: string, time: string) => new Date(`${date}T${time || "09:00"}`).toISOString();

export type BookingForm = { patientId: string; date: string; time: string; type: Appointment["type"]; providerUserId: string; reason: string };
export type Clinician = { userId: string; name: string };

const LOOKBACK_DAYS = 30;

type AppointmentsState = {
  items: LiveAppointment[];
  clinicians: Clinician[];
  loaded: boolean;
  error: string;
  load: () => Promise<void>;
  book: (form: BookingForm, idempotencyKey: string) => Promise<void>;
  checkIn: (appointment: LiveAppointment) => Promise<void>;
  noShow: (appointment: LiveAppointment) => Promise<void>;
};

export const useLiveAppointments = create<AppointmentsState>((set, get) => ({
  items: [],
  clinicians: [],
  loaded: false,
  error: "",
  load: async () => {
    const from = new Date(); from.setHours(0, 0, 0, 0); from.setDate(from.getDate() - LOOKBACK_DAYS);
    try {
      const result = await emrRequest<{ data: { items: ApiAppointment[] } }>(`/appointments?from=${encodeURIComponent(from.toISOString())}&limit=200`);
      set({ items: result.data.items.map(appointmentFromApi), loaded: true, error: "" });
    } catch (cause) {
      set({ loaded: true, error: cause instanceof Error ? cause.message : "Appointments could not be loaded." });
    }
    // Doctors and nurses the desk can book with (names only).
    if (!get().clinicians.length) {
      emrRequest<{ data: { items: Clinician[] } }>("/staff?permission=vitals.record")
        .then((result) => set({ clinicians: result.data.items }))
        .catch(() => set({ clinicians: [] }));
    }
  },
  book: async (form, idempotencyKey) => {
    const reason = form.reason.trim();
    await emrRequest("/appointments", {
      method: "POST", idempotencyKey,
      body: {
        patientId: form.patientId, scheduledAt: scheduledAtFor(form.date, form.time), type: TYPE_TO_API[form.type],
        ...(form.providerUserId ? { providerUserId: form.providerUserId } : {}), ...(reason ? { reason } : {}),
      },
    });
    await get().load();
  },
  checkIn: async (appointment) => {
    await emrRequest(`/appointments/${appointment.id}/check-in`, { method: "POST", version: appointment.version, body: {} });
    await get().load();
  },
  noShow: async (appointment) => {
    await emrRequest(`/appointments/${appointment.id}/no-show`, { method: "POST", version: appointment.version, body: {} });
    await get().load();
  },
}));

export function useLiveAppointmentsLoad(enabled: boolean) {
  useEffect(() => {
    if (enabled) void useLiveAppointments.getState().load();
  }, [enabled]);
}

export { newIdempotencyKey };
