import { create } from "zustand";
import { audit } from "@/store/useAudit";
import { useIdentity } from "@/store/useIdentity";
import { seedImagingStudies, type ImagingStudy, type ImagingModality, type ImagingSeries } from "@/data/radiology";
import { persisted } from "@/platform/persist";

const rid = () => Math.random().toString(36).slice(2, 9);
const now = () => new Date().toISOString();
const actor = () => useIdentity.getState().user.name;

type RadiologyState = {
  studies: ImagingStudy[];

  studiesFor: (patientId?: string | null) => ImagingStudy[];
  priorStudiesFor: (patientId: string, bodySite: string, excludeId?: string) => ImagingStudy[];
  requestStudy: (input: {
    patientId: string; modality: ImagingModality; bodySite: string; laterality?: ImagingStudy["laterality"];
    indication: string; priority: ImagingStudy["priority"]; preparation?: string; externalStudy?: boolean;
  }) => string;
  scheduleStudy: (id: string, scheduledFor: string) => void;
  performStudy: (id: string, series: Omit<ImagingSeries, "id">[]) => void;
  addReport: (id: string, findings: string, impression: string) => void;
  verifyReport: (id: string, verifiedBy: string) => void;
  addAddendum: (id: string, note: string) => void;
  cancelStudy: (id: string, reason: string) => void;
  setCompareStudy: (id: string, compareToStudyId: string | undefined) => void;
};

export const useRadiology = create<RadiologyState>(persisted<RadiologyState>("radiology", (set, get) => ({
  studies: seedImagingStudies,

  studiesFor: (patientId) => (!patientId ? [] : get().studies.filter((study) => study.patientId === patientId)),

  priorStudiesFor: (patientId, bodySite, excludeId) =>
    get().studies.filter((study) => study.patientId === patientId && study.bodySite === bodySite && study.id !== excludeId && study.status === "Verified"),

  requestStudy: (input) => {
    const id = `img-${rid()}`;
    const accession = `ACC-2026-${String(100 + get().studies.length).padStart(6, "0")}`;
    const study: ImagingStudy = {
      id, patientId: input.patientId, accessionNumber: accession, modality: input.modality,
      bodySite: input.bodySite, laterality: input.laterality, indication: input.indication,
      priority: input.priority, preparation: input.preparation, requestedBy: actor(), requestedAt: now(),
      status: input.externalStudy ? "Performed" : "Requested", series: [], externalStudy: input.externalStudy,
    };
    set((state) => ({ studies: [study, ...state.studies] }));
    audit(`requested imaging — ${input.modality} ${input.bodySite}`, `imaging/${input.patientId}`);
    return id;
  },

  scheduleStudy: (id, scheduledFor) => {
    audit("scheduled imaging study", `imaging/${id}`);
    set((state) => ({ studies: state.studies.map((study) => (study.id === id ? { ...study, status: "Scheduled", scheduledFor } : study)) }));
  },

  performStudy: (id, series) => {
    audit("imaging study performed", `imaging/${id}`);
    set((state) => ({
      studies: state.studies.map((study) =>
        study.id === id
          ? { ...study, status: "Performed", performedAt: now(), series: series.map((entry) => ({ ...entry, id: `ser-${rid()}` })) }
          : study,
      ),
    }));
  },

  addReport: (id, findings, impression) => {
    const who = actor();
    audit("imaging report drafted", `imaging/${id}`, { user: who });
    set((state) => ({
      studies: state.studies.map((study) =>
        study.id === id ? { ...study, status: "Reported", report: { findings, impression, author: who, authoredAt: now() } } : study,
      ),
    }));
  },

  verifyReport: (id, verifiedBy) => {
    audit("imaging report verified", `imaging/${id}`, { user: verifiedBy });
    set((state) => ({
      studies: state.studies.map((study) =>
        study.id === id && study.report ? { ...study, status: "Verified", report: { ...study.report, verifiedBy, verifiedAt: now() } } : study,
      ),
    }));
  },

  addAddendum: (id, note) => {
    const who = actor();
    audit("imaging report addendum", `imaging/${id}`, { user: who, meta: { note } });
    set((state) => ({
      studies: state.studies.map((study) =>
        study.id === id && study.report
          ? { ...study, status: "Amended", report: { ...study.report, addenda: [...(study.report.addenda ?? []), { by: who, at: now(), note }] } }
          : study,
      ),
    }));
  },

  cancelStudy: (id, reason) => {
    audit("imaging study cancelled", `imaging/${id}`, { meta: { reason } });
    set((state) => ({ studies: state.studies.map((study) => (study.id === id ? { ...study, status: "Cancelled", cancelledReason: reason } : study)) }));
  },

  setCompareStudy: (id, compareToStudyId) => {
    set((state) => ({ studies: state.studies.map((study) => (study.id === id ? { ...study, compareToStudyId } : study)) }));
  },
})));
