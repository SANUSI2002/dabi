import { useEffect } from "react";
import { create } from "zustand";
import type { Patient, Referral, ReferralFeedback, ReferralStatus } from "@/data/types";
import { emrRequest, newIdempotencyKey } from "./client";
import { patientFromApi, type ApiPatient } from "./mappers";

// Referrals in live mode: the hospital's referrals (GET /referrals), sending one, and each step to the
// outcome that closes the loop (POST /referrals/:id/{accept,decline,schedule,attend,cancel,outcome}).

type ApiPatientSummary = Pick<ApiPatient, "id" | "medicalRecordNumber" | "givenName" | "familyName" | "dateOfBirth" | "sex">;
export type ApiReferral = {
  id: string; patientId: string; patient?: ApiPatientSummary; version: number; direction: "OUT" | "INTERNAL" | "IN"; destination: string; diagnosis: string;
  reason: string; urgency: "ROUTINE" | "URGENT" | "EMERGENCY"; status: string; clinicalSummary: string | null;
  attachments: { labItemId: string; testName: string; verifiedAt: string | null }[]; referredByName: string | null; sourceReferralId: string | null;
  receivingClinician: string | null; declineReason: string | null; appointmentDate: string | null; attendedAt: string | null;
  feedback: { outcome: ReferralFeedback["outcome"]; note: string; by: string; at: string; backReferral: boolean } | null; createdAt: string;
};

const DIRECTION = { OUT: "Out", INTERNAL: "Internal", IN: "In" } as const;
const title = (code: string) => code.charAt(0) + code.slice(1).toLowerCase();

export type LiveReferral = Referral & { patient?: Patient; version: number; attachments: ApiReferral["attachments"] };
export const referralFromApi = (r: ApiReferral): LiveReferral => ({
  id: r.id, patientId: r.patientId, patient: r.patient ? patientFromApi(r.patient) : undefined, version: r.version, type: DIRECTION[r.direction],
  diagnosis: r.diagnosis, facility: r.destination, reason: r.reason, urgency: title(r.urgency) as Referral["urgency"], status: title(r.status) as ReferralStatus,
  date: r.createdAt, referredBy: r.referredByName ?? undefined, clinicalSummary: r.clinicalSummary ?? undefined,
  attachedResultIds: r.attachments.map((a) => a.labItemId), attachments: r.attachments, receivingClinician: r.receivingClinician ?? undefined,
  declineReason: r.declineReason ?? undefined, appointmentDate: r.appointmentDate ?? undefined, attendedDate: r.attendedAt ?? undefined,
  feedback: r.feedback ?? undefined,
});

type Form = { patientId: string; type: Referral["type"]; diagnosis: string; facility: string; reason: string; urgency: Referral["urgency"]; clinicalSummary: string; attachedResultIds: string[] };
type ReferralState = {
  referrals: LiveReferral[];
  error: string;
  load: () => Promise<void>;
  send: (form: Form, idempotencyKey: string) => Promise<void>;
  step: (referral: LiveReferral, action: "accept" | "decline" | "schedule" | "attend" | "cancel" | "outcome", body?: Record<string, unknown>) => Promise<void>;
};

export const useLiveReferrals = create<ReferralState>((set, get) => ({
  referrals: [],
  error: "",
  load: async () => {
    try {
      const result = await emrRequest<{ data: { items: ApiReferral[] } }>("/referrals?limit=500");
      set({ referrals: result.data.items.map(referralFromApi), error: "" });
    } catch (cause) {
      set({ error: cause instanceof Error ? cause.message : "Referrals could not be loaded." });
    }
  },
  send: async (form, idempotencyKey) => {
    await emrRequest("/referrals", {
      method: "POST", idempotencyKey,
      body: {
        patientId: form.patientId, direction: form.type === "Internal" ? "INTERNAL" : "OUT", destination: form.facility.trim(), diagnosis: form.diagnosis.trim(),
        reason: form.reason, urgency: form.urgency.toUpperCase(), ...(form.clinicalSummary.trim() ? { clinicalSummary: form.clinicalSummary.trim() } : {}),
        ...(form.attachedResultIds.length ? { attachedLabItemIds: form.attachedResultIds } : {}),
      },
    });
    await get().load();
  },
  step: async (referral, action, body = {}) => {
    await emrRequest(`/referrals/${referral.id}/${action}`, { method: "POST", version: referral.version, body });
    await get().load();
  },
}));

export function useLiveReferralsLoad(enabled: boolean) {
  useEffect(() => {
    if (enabled) void useLiveReferrals.getState().load();
  }, [enabled]);
}

export { newIdempotencyKey };
