import { useEffect } from "react";
import { create } from "zustand";
import type { Patient } from "@/data/types";
import type { ProcedureRecord, ProcedureStatus, SafetyChecklistPhase } from "@/data/procedures";
import { emrRequest, newIdempotencyKey } from "./client";
import { patientFromApi, type ApiPatient } from "./mappers";

// Procedures in live mode: the hospital's procedures (GET /procedures) and every step — request,
// schedule, consent, safety checklist, pre-procedure, perform, recovery, follow-up, sign, amend, cancel.

type ApiStatus = "REQUESTED" | "SCHEDULED" | "CONSENTED" | "PRE_PROCEDURE" | "PERFORMED" | "RECOVERY" | "FOLLOW_UP" | "CANCELLED";
export type ApiProcedure = {
  id: string; patientId: string; encounterId: string | null; name: string; code: string; indication: string; bodySite: string | null;
  laterality: "LEFT" | "RIGHT" | "BILATERAL" | null; priority: "ROUTINE" | "URGENT" | "EMERGENCY"; status: ApiStatus; version: number; createdAt: string;
  requestedByName: string | null; scheduledFor: string | null; performerUserId: string | null; performerName: string | null;
  assistants: { userId: string; name: string | null }[]; consentObtainedByUserId: string | null; consentObtainedByName: string | null; consentAt: string | null;
  performedAt: string | null; anaesthesia: string | null; device: string | null; complications: string | null; outcome: string | null; findings: string | null;
  specimenSentToLab: boolean; recoveryNotes: string | null; followUpPlan: string | null;
  noteSignedByName: string | null; noteSignedAt: string | null; cancellationReason: string | null;
  checklist: { id: string; phase: "SIGN_IN" | "TIME_OUT" | "SIGN_OUT"; position: number; label: string; completed: boolean; exceptionReason: string | null }[];
  amendments: { note: string; authorName: string | null; createdAt: string }[];
  patient?: Pick<ApiPatient, "id" | "medicalRecordNumber" | "givenName" | "familyName" | "dateOfBirth" | "sex">;
};

const STATUS: Record<ApiStatus, ProcedureStatus> = {
  REQUESTED: "Requested", SCHEDULED: "Scheduled", CONSENTED: "Consented", PRE_PROCEDURE: "Pre-procedure",
  PERFORMED: "Performed", RECOVERY: "Recovery", FOLLOW_UP: "Follow-up", CANCELLED: "Cancelled",
};
const PHASE: Record<ApiProcedure["checklist"][number]["phase"], SafetyChecklistPhase> = { SIGN_IN: "Sign In", TIME_OUT: "Time Out", SIGN_OUT: "Sign Out" };
const title = (value: string) => value.charAt(0) + value.slice(1).toLowerCase();
const unknown = "Unknown staff member";

/** A procedure as the Procedures screen and chart render it, plus what live steps need. */
export type LiveProcedure = ProcedureRecord & { version: number; patient?: Patient; performerUserId?: string; assistantUserIds: string[] };

export function procedureFromApi(row: ApiProcedure): LiveProcedure {
  return {
    id: row.id,
    version: row.version,
    patientId: row.patientId,
    patient: row.patient ? patientFromApi(row.patient) : undefined,
    name: row.name,
    indication: row.indication,
    bodySite: row.bodySite ?? undefined,
    laterality: row.laterality ? (title(row.laterality) as ProcedureRecord["laterality"]) : "N/A",
    priority: title(row.priority) as ProcedureRecord["priority"],
    status: STATUS[row.status],
    requestedBy: row.requestedByName ?? unknown,
    requestedAt: row.createdAt,
    scheduledFor: row.scheduledFor ?? undefined,
    performer: row.performerName ?? undefined,
    performerUserId: row.performerUserId ?? undefined,
    assistants: row.assistants.map((a) => a.name ?? unknown),
    assistantUserIds: row.assistants.map((a) => a.userId),
    anaesthesia: row.anaesthesia ?? undefined,
    consentObtainedBy: row.consentObtainedByName ?? undefined,
    consentAt: row.consentAt ?? undefined,
    checklist: row.checklist.map((item) => ({ id: item.id, phase: PHASE[item.phase], label: item.label, completed: item.completed, exceptionReason: item.exceptionReason ?? undefined })),
    performedAt: row.performedAt ?? undefined,
    device: row.device ?? undefined,
    complications: row.complications ?? undefined,
    outcome: row.outcome ?? undefined,
    findings: row.findings ?? undefined,
    specimenSentToLab: row.specimenSentToLab,
    recoveryNotes: row.recoveryNotes ?? undefined,
    followUpPlan: row.followUpPlan ?? undefined,
    noteSigned: Boolean(row.noteSignedAt),
    noteSignedBy: row.noteSignedByName ?? undefined,
    noteSignedAt: row.noteSignedAt ?? undefined,
    amendments: row.amendments.map((a) => ({ by: a.authorName ?? unknown, at: a.createdAt, note: a.note })),
    cancelledReason: row.cancellationReason ?? undefined,
  };
}

export type ProcedureRequest = { patientId: string; name: string; indication: string; bodySite?: string; laterality?: ProcedureRecord["laterality"]; priority: ProcedureRecord["priority"] };
export type PerformForm = { anaesthesia?: string; device?: string; complications?: string; outcome: string; findings?: string; specimenSentToLab: boolean };
export type Clinician = { userId: string; name: string };

const optional = (value: string | undefined) => (value?.trim() ? value.trim() : undefined);

type ProceduresState = {
  procedures: LiveProcedure[];
  clinicians: Clinician[];
  loaded: boolean;
  error: string;
  load: () => Promise<void>;
  request: (form: ProcedureRequest, idempotencyKey: string) => Promise<void>;
  schedule: (p: LiveProcedure, date: string, performerUserId: string, assistantUserIds: string[]) => Promise<void>;
  consent: (p: LiveProcedure, obtainedByUserId: string) => Promise<void>;
  checklistItem: (p: LiveProcedure, itemId: string, completed: boolean, exceptionReason?: string) => Promise<void>;
  preProcedure: (p: LiveProcedure) => Promise<void>;
  perform: (p: LiveProcedure, form: PerformForm) => Promise<void>;
  recovery: (p: LiveProcedure, notes: string) => Promise<void>;
  followUp: (p: LiveProcedure, plan: string) => Promise<void>;
  sign: (p: LiveProcedure) => Promise<void>;
  amend: (p: LiveProcedure, note: string) => Promise<void>;
  cancel: (p: LiveProcedure, reason: string) => Promise<void>;
};

export const useLiveProcedures = create<ProceduresState>((set, get) => {
  const step = async (p: LiveProcedure, name: string, body: object) => {
    await emrRequest(`/procedures/${p.id}/${name}`, { method: "POST", version: p.version, body });
    await get().load();
  };
  return {
    procedures: [],
    clinicians: [],
    loaded: false,
    error: "",
    load: async () => {
      try {
        const result = await emrRequest<{ data: { items: ApiProcedure[] } }>("/procedures?limit=200");
        set({ procedures: result.data.items.map(procedureFromApi), loaded: true, error: "" });
      } catch (cause) {
        set({ loaded: true, error: cause instanceof Error ? cause.message : "Procedures could not be loaded." });
      }
      // Clinicians who may perform, assist and take consent (names only).
      if (!get().clinicians.length) {
        emrRequest<{ data: { items: Clinician[] } }>("/staff?permission=procedure.perform")
          .then((result) => set({ clinicians: result.data.items }))
          .catch(() => set({ clinicians: [] }));
      }
    },
    request: async (form, idempotencyKey) => {
      await emrRequest("/procedures", {
        method: "POST", idempotencyKey,
        body: {
          patientId: form.patientId, name: form.name.trim(), indication: form.indication.trim(), priority: form.priority.toUpperCase(),
          ...(optional(form.bodySite) ? { bodySite: optional(form.bodySite) } : {}),
          ...(form.laterality && form.laterality !== "N/A" ? { laterality: form.laterality.toUpperCase() } : {}),
        },
      });
      await get().load();
    },
    schedule: (p, date, performerUserId, assistantUserIds) => step(p, "schedule", { scheduledFor: date, performerUserId, assistantUserIds }),
    consent: (p, obtainedByUserId) => step(p, "consent", { obtainedByUserId }),
    checklistItem: async (p, itemId, completed, exceptionReason) => {
      const reason = optional(exceptionReason);
      await emrRequest(`/procedures/${p.id}/checklist/${itemId}`, { method: "PUT", body: { completed, ...(!completed && reason ? { exceptionReason: reason } : {}) } });
      await get().load();
    },
    preProcedure: (p) => step(p, "pre-procedure", {}),
    perform: (p, form) => step(p, "perform", {
      outcome: form.outcome.trim(), specimenSentToLab: form.specimenSentToLab,
      ...(optional(form.anaesthesia) ? { anaesthesia: optional(form.anaesthesia) } : {}),
      ...(optional(form.device) ? { device: optional(form.device) } : {}),
      ...(optional(form.complications) ? { complications: optional(form.complications) } : {}),
      ...(optional(form.findings) ? { findings: optional(form.findings) } : {}),
    }),
    recovery: (p, notes) => step(p, "recovery", { recoveryNotes: notes.trim() }),
    followUp: (p, plan) => step(p, "follow-up", { followUpPlan: plan.trim() }),
    sign: (p) => step(p, "sign", {}),
    amend: async (p, note) => {
      await emrRequest(`/procedures/${p.id}/amendments`, { method: "POST", body: { note } });
      await get().load();
    },
    cancel: (p, reason) => step(p, "cancel", { reason }),
  };
});

export function useLiveProceduresLoad(enabled: boolean) {
  useEffect(() => {
    if (enabled) void useLiveProcedures.getState().load();
  }, [enabled]);
}

export { newIdempotencyKey };
