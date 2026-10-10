import { useEffect } from "react";
import { create } from "zustand";
import type { Appointment, Patient } from "@/data/types";
import { emrRequest, newIdempotencyKey } from "./client";
import { patientFromApi, type ApiPatient } from "./mappers";

// The Appointments screen in live mode: the hospital's bookings (GET /appointments), booking,
// check-in (which opens the visit and queues the patient) and no-show — and the visit requests
// patients made in the Sabi app (GET /appointments/requests), which the desk confirms (booking
// the patient for the requested time) or rejects with a reason the patient sees.

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

type ApiPatientSummary = Pick<ApiPatient, "id" | "medicalRecordNumber" | "givenName" | "familyName" | "dateOfBirth" | "sex" | "phone">;
export type ApiAppointmentRequest = {
  id: string; status: "PENDING" | "SCHEDULED" | "REJECTED" | "CHECKED_IN" | "CANCELLED"; requestedAt: string;
  appointmentType: string | null; reason: string | null; suggestedType: ApiType; appointmentId: string | null;
  requester: { userId: string; name: string | null; phone: string | null; email: string | null; dateOfBirth: string | null };
  dependent: { id: string; fullName: string; dateOfBirth: string | null; gender: string | null } | null;
  linkedPatient: ApiPatientSummary | null;
};

/** A patient-app request as the desk sees it: who it is for, when, and the record it will be booked on. */
export type AppointmentRequest = {
  id: string;
  requestedAt: string;
  time: string;
  /** The person the visit is for (the dependent, for a family member's visit). */
  name: string;
  /** The account holder who asked, when the visit is for their dependent. */
  requestedBy?: string;
  phone?: string;
  dateOfBirth?: string;
  visit: string;
  reason?: string;
  suggestedType: Appointment["type"];
  forDependent: boolean;
  /** The EMR record already linked to the requester's Sabi account (their own visits only). */
  linkedPatient?: Patient;
};

export function requestFromApi(row: ApiAppointmentRequest): AppointmentRequest {
  const when = new Date(row.requestedAt);
  const holder = row.requester.name ?? "Sabi patient";
  return {
    id: row.id,
    requestedAt: row.requestedAt,
    time: `${pad(when.getHours())}:${pad(when.getMinutes())}`,
    name: row.dependent?.fullName ?? holder,
    requestedBy: row.dependent ? holder : undefined,
    phone: row.requester.phone ?? undefined,
    dateOfBirth: (row.dependent ? row.dependent.dateOfBirth : row.requester.dateOfBirth) ?? undefined,
    visit: row.appointmentType ?? "Hospital appointment",
    reason: row.reason ?? undefined,
    suggestedType: TYPE_FROM_API[row.suggestedType],
    forDependent: !!row.dependent,
    linkedPatient: row.linkedPatient ? patientFromApi(row.linkedPatient) : undefined,
  };
}

/** The desk's answer to a request: the record (when none is linked), the type and the clinician. */
export type ConfirmForm = { patientId: string; type: Appointment["type"]; providerUserId: string };

const LOOKBACK_DAYS = 30;

type AppointmentsState = {
  items: LiveAppointment[];
  /** Requests from the Sabi app waiting for the desk. */
  requests: AppointmentRequest[];
  clinicians: Clinician[];
  loaded: boolean;
  error: string;
  load: () => Promise<void>;
  book: (form: BookingForm, idempotencyKey: string) => Promise<void>;
  checkIn: (appointment: LiveAppointment) => Promise<void>;
  noShow: (appointment: LiveAppointment) => Promise<void>;
  confirmRequest: (request: AppointmentRequest, form: ConfirmForm, idempotencyKey: string) => Promise<void>;
  rejectRequest: (request: AppointmentRequest, reason: string) => Promise<void>;
};

export const useLiveAppointments = create<AppointmentsState>((set, get) => ({
  items: [],
  requests: [],
  clinicians: [],
  loaded: false,
  error: "",
  load: async () => {
    const from = new Date(); from.setHours(0, 0, 0, 0); from.setDate(from.getDate() - LOOKBACK_DAYS);
    try {
      const [bookings, requests] = await Promise.all([
        emrRequest<{ data: { items: ApiAppointment[] } }>(`/appointments?from=${encodeURIComponent(from.toISOString())}&limit=200`),
        emrRequest<{ data: { items: ApiAppointmentRequest[] } }>("/appointments/requests?limit=200"),
      ]);
      set({ items: bookings.data.items.map(appointmentFromApi), requests: requests.data.items.map(requestFromApi), loaded: true, error: "" });
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
  confirmRequest: async (request, form, idempotencyKey) => {
    // A linked record is used by the hospital itself; otherwise the desk's chosen record is sent.
    await emrRequest(`/appointments/requests/${request.id}/confirm`, {
      method: "POST", idempotencyKey,
      body: {
        ...(request.linkedPatient ? {} : { patientId: form.patientId }), type: TYPE_TO_API[form.type],
        ...(form.providerUserId ? { providerUserId: form.providerUserId } : {}),
      },
    });
    await get().load();
  },
  rejectRequest: async (request, reason) => {
    await emrRequest(`/appointments/requests/${request.id}/reject`, { method: "POST", body: { reason: reason.trim() } });
    await get().load();
  },
}));

export function useLiveAppointmentsLoad(enabled: boolean) {
  useEffect(() => {
    if (enabled) void useLiveAppointments.getState().load();
  }, [enabled]);
}

export { newIdempotencyKey };
