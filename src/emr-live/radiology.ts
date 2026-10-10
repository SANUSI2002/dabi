import { useEffect } from "react";
import { create } from "zustand";
import type { Patient } from "@/data/types";
import type { ImagingModality, ImagingSeries, ImagingStatus, ImagingStudy } from "@/data/radiology";
import { emrRequest, newIdempotencyKey } from "./client";
import { patientFromApi, type ApiPatient } from "./mappers";

// Radiology in live mode: the hospital's imaging studies (GET /imaging/studies) and every step of
// the workflow — request, schedule, perform, report, verify, addenda, cancel, comparison.

type ApiModality = "XRAY" | "ULTRASOUND" | "CT" | "MRI" | "MAMMOGRAPHY" | "FLUOROSCOPY";
type ApiStatus = "REQUESTED" | "SCHEDULED" | "PERFORMED" | "REPORTED" | "VERIFIED" | "AMENDED" | "CANCELLED";
export type ApiStudy = {
  id: string; patientId: string; encounterId: string | null; accessionNumber: string; modality: ApiModality; bodySite: string;
  laterality: "LEFT" | "RIGHT" | "BILATERAL" | null; indication: string; priority: "ROUTINE" | "URGENT" | "EMERGENCY";
  preparation: string | null; externalStudy: boolean; status: ApiStatus; version: number; createdAt: string;
  requestedByName: string | null; scheduledFor: string | null; performedAt: string | null; cancellationReason: string | null;
  compareToStudyId: string | null;
  series: { id: string; seriesNumber: number; description: string; bodyPart: string; imageCount: number | null }[];
  report: { findings: string; impression: string; authorName: string | null; authoredAt: string; verifiedByName: string | null; verifiedAt: string | null } | null;
  addenda: { note: string; authorName: string | null; createdAt: string }[];
  patient?: Pick<ApiPatient, "id" | "medicalRecordNumber" | "givenName" | "familyName" | "dateOfBirth" | "sex">;
};

const MODALITY_FROM_API: Record<ApiModality, ImagingModality> = {
  XRAY: "X-ray", ULTRASOUND: "Ultrasound", CT: "CT", MRI: "MRI", MAMMOGRAPHY: "Mammography", FLUOROSCOPY: "Fluoroscopy",
};
const MODALITY_TO_API = Object.fromEntries(Object.entries(MODALITY_FROM_API).map(([api, label]) => [label, api])) as Record<ImagingModality, ApiModality>;
const title = (value: string) => value.charAt(0) + value.slice(1).toLowerCase();

/** A study as the Radiology screen and chart render it, plus its version and patient. */
export type LiveStudy = ImagingStudy & { version: number; patient?: Patient };

export function studyFromApi(row: ApiStudy): LiveStudy {
  return {
    id: row.id,
    version: row.version,
    patientId: row.patientId,
    patient: row.patient ? patientFromApi(row.patient) : undefined,
    accessionNumber: row.accessionNumber,
    modality: MODALITY_FROM_API[row.modality],
    bodySite: row.bodySite,
    laterality: row.laterality ? (title(row.laterality) as ImagingStudy["laterality"]) : "N/A",
    indication: row.indication,
    priority: title(row.priority) as ImagingStudy["priority"],
    preparation: row.preparation ?? undefined,
    requestedBy: row.requestedByName ?? "Unknown staff member",
    requestedAt: row.createdAt,
    status: title(row.status) as ImagingStatus,
    scheduledFor: row.scheduledFor ?? undefined,
    performedAt: row.performedAt ?? undefined,
    series: row.series.map((s): ImagingSeries => ({ id: s.id, seriesNumber: s.seriesNumber, description: s.description, bodyPart: s.bodyPart, imageCount: s.imageCount ?? undefined })),
    report: row.report
      ? {
        findings: row.report.findings, impression: row.report.impression,
        author: row.report.authorName ?? "Unknown staff member", authoredAt: row.report.authoredAt,
        verifiedBy: row.report.verifiedByName ?? undefined, verifiedAt: row.report.verifiedAt ?? undefined,
        addenda: row.addenda.map((a) => ({ by: a.authorName ?? "Unknown staff member", at: a.createdAt, note: a.note })),
      }
      : undefined,
    compareToStudyId: row.compareToStudyId ?? undefined,
    externalStudy: row.externalStudy,
    cancelledReason: row.cancellationReason ?? undefined,
  };
}

export type StudyRequest = {
  patientId: string; modality: ImagingModality; bodySite: string; laterality?: ImagingStudy["laterality"];
  indication: string; priority: ImagingStudy["priority"]; preparation?: string; externalStudy?: boolean;
};

const path = (study: LiveStudy, step: string) => `/imaging/studies/${study.id}/${step}`;

type RadiologyState = {
  studies: LiveStudy[];
  loaded: boolean;
  error: string;
  load: () => Promise<void>;
  request: (form: StudyRequest, idempotencyKey: string) => Promise<void>;
  schedule: (study: LiveStudy, date: string) => Promise<void>;
  perform: (study: LiveStudy, series: { description: string; bodyPart: string; imageCount?: number }[]) => Promise<void>;
  report: (study: LiveStudy, findings: string, impression: string) => Promise<void>;
  verify: (study: LiveStudy) => Promise<void>;
  addendum: (study: LiveStudy, note: string) => Promise<void>;
  cancel: (study: LiveStudy, reason: string) => Promise<void>;
  compare: (study: LiveStudy, priorId: string | null) => Promise<void>;
};

export const useLiveRadiology = create<RadiologyState>((set, get) => {
  const step = async (study: LiveStudy, name: string, body: object, method: "POST" | "PUT" = "POST") => {
    await emrRequest(path(study, name), { method, version: study.version, body });
    await get().load();
  };
  return {
    studies: [],
    loaded: false,
    error: "",
    load: async () => {
      try {
        const result = await emrRequest<{ data: { items: ApiStudy[] } }>("/imaging/studies?limit=200");
        set({ studies: result.data.items.map(studyFromApi), loaded: true, error: "" });
      } catch (cause) {
        set({ loaded: true, error: cause instanceof Error ? cause.message : "Imaging studies could not be loaded." });
      }
    },
    request: async (form, idempotencyKey) => {
      const preparation = form.preparation?.trim();
      await emrRequest("/imaging/studies", {
        method: "POST", idempotencyKey,
        body: {
          patientId: form.patientId, modality: MODALITY_TO_API[form.modality], bodySite: form.bodySite.trim(), indication: form.indication.trim(),
          priority: form.priority.toUpperCase(), externalStudy: Boolean(form.externalStudy),
          ...(form.laterality && form.laterality !== "N/A" ? { laterality: form.laterality.toUpperCase() } : {}),
          ...(preparation ? { preparation } : {}),
        },
      });
      await get().load();
    },
    schedule: (study, date) => step(study, "schedule", { scheduledFor: date }),
    perform: (study, series) => step(study, "perform", {
      series: series.map((s) => ({ description: s.description.trim(), ...(s.bodyPart.trim() ? { bodyPart: s.bodyPart.trim() } : {}), ...(s.imageCount ? { imageCount: s.imageCount } : {}) })),
    }),
    report: (study, findings, impression) => step(study, "report", { findings, impression }),
    verify: (study) => step(study, "verify", {}),
    addendum: (study, note) => step(study, "addenda", { note }),
    cancel: (study, reason) => step(study, "cancel", { reason }),
    compare: (study, priorId) => step(study, "comparison", { compareToStudyId: priorId }, "PUT"),
  };
});

export function useLiveRadiologyLoad(enabled: boolean) {
  useEffect(() => {
    if (enabled) void useLiveRadiology.getState().load();
  }, [enabled]);
}

export { newIdempotencyKey };
