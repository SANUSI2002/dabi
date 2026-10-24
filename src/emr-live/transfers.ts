import { useEffect } from "react";
import { create } from "zustand";
import type { Patient, PatientTransfer } from "@/data/types";
import { emrRequest, newIdempotencyKey } from "./client";
import { patientFromApi, type ApiPatient } from "./mappers";

// Patient transfers of care in live mode: the hospital's transfers (GET /transfers), recording one, and
// completing (records handed over) or cancelling it.

type ApiPatientSummary = Pick<ApiPatient, "id" | "medicalRecordNumber" | "givenName" | "familyName" | "dateOfBirth" | "sex">;
export type ApiTransfer = {
  id: string; version: number; direction: "IN" | "OUT"; patientId: string | null; patient?: ApiPatientSummary; patientName: string; facility: string;
  reason: PatientTransfer["reason"]; summary: string | null; status: "PENDING" | "COMPLETED" | "CANCELLED"; recordsSent: boolean;
  initiatedByName: string | null; completedByName: string | null; completedAt: string | null; cancelledAt: string | null; createdAt: string;
};

export type LiveTransfer = PatientTransfer & { patient?: Patient; version: number };
const STATUS = { PENDING: "Pending", COMPLETED: "Completed", CANCELLED: "Cancelled" } as const;
export const transferFromApi = (t: ApiTransfer): LiveTransfer => ({
  id: t.id, version: t.version, direction: t.direction === "IN" ? "In" : "Out", patientId: t.patientId ?? undefined, patient: t.patient ? patientFromApi(t.patient) : undefined,
  patientName: t.patientName, facility: t.facility, reason: t.reason, summary: t.summary ?? undefined, date: t.createdAt, status: STATUS[t.status],
  recordsSent: t.recordsSent, completedAt: t.completedAt ?? undefined, handledBy: t.completedByName ?? undefined,
});

type Form = { direction: "In" | "Out"; patientId: string; patientName: string; facility: string; reason: PatientTransfer["reason"]; summary: string };
type TransferState = {
  transfers: LiveTransfer[];
  error: string;
  load: () => Promise<void>;
  record: (form: Form, idempotencyKey: string) => Promise<void>;
  finish: (transfer: LiveTransfer, action: "complete" | "cancel") => Promise<void>;
};

export const useLiveTransfers = create<TransferState>((set, get) => ({
  transfers: [],
  error: "",
  load: async () => {
    try {
      const result = await emrRequest<{ data: { items: ApiTransfer[] } }>("/transfers?limit=500");
      set({ transfers: result.data.items.map(transferFromApi), error: "" });
    } catch (cause) {
      set({ error: cause instanceof Error ? cause.message : "Transfers could not be loaded." });
    }
  },
  record: async (form, idempotencyKey) => {
    await emrRequest("/transfers", {
      method: "POST", idempotencyKey,
      body: {
        direction: form.direction === "Out" ? "OUT" : "IN", ...(form.direction === "Out" ? { patientId: form.patientId } : { patientName: form.patientName.trim() }),
        facility: form.facility.trim(), reason: form.reason, ...(form.summary.trim() ? { summary: form.summary.trim() } : {}),
      },
    });
    await get().load();
  },
  finish: async (transfer, action) => {
    await emrRequest(`/transfers/${transfer.id}/${action}`, { method: "POST", version: transfer.version, body: {} });
    await get().load();
  },
}));

export function useLiveTransfersLoad(enabled: boolean) {
  useEffect(() => {
    if (enabled) void useLiveTransfers.getState().load();
  }, [enabled]);
}

export { newIdempotencyKey };
