import { create } from "zustand";
import { audit } from "@/store/useAudit";
import { useIdentity } from "@/store/useIdentity";
import { seedProcedures, defaultChecklist, type ProcedureRecord, type ProcedureStatus } from "@/data/procedures";

const rid = () => Math.random().toString(36).slice(2, 9);
const now = () => new Date().toISOString();
const actor = () => useIdentity.getState().user.name;

type ProceduresState = {
  procedures: ProcedureRecord[];

  proceduresFor: (patientId?: string | null) => ProcedureRecord[];
  requestProcedure: (input: {
    patientId: string; name: string; indication: string; bodySite?: string;
    laterality?: ProcedureRecord["laterality"]; priority: ProcedureRecord["priority"];
  }) => string;
  scheduleProcedure: (id: string, scheduledFor: string, performer: string, assistants: string[]) => void;
  recordConsent: (id: string, obtainedBy: string) => void;
  setChecklistItem: (id: string, itemId: string, completed: boolean, exceptionReason?: string) => void;
  beginPreProcedure: (id: string) => void;
  performProcedure: (id: string, input: {
    anaesthesia?: string; device?: string; complications?: string; outcome: string; findings?: string; specimenSentToLab: boolean;
  }) => void;
  moveToRecovery: (id: string, recoveryNotes: string) => void;
  setFollowUp: (id: string, followUpPlan: string) => void;
  signNote: (id: string) => void;
  amendNote: (id: string, note: string) => void;
  cancelProcedure: (id: string, reason: string) => void;
};

export const useProcedures = create<ProceduresState>((set, get) => ({
  procedures: seedProcedures,

  proceduresFor: (patientId) => (!patientId ? [] : get().procedures.filter((procedure) => procedure.patientId === patientId)),

  requestProcedure: (input) => {
    const id = `proc-${rid()}`;
    const record: ProcedureRecord = {
      id,
      patientId: input.patientId,
      name: input.name,
      indication: input.indication,
      bodySite: input.bodySite,
      laterality: input.laterality,
      priority: input.priority,
      status: "Requested",
      requestedBy: actor(),
      requestedAt: now(),
      checklist: defaultChecklist(),
    };
    set((state) => ({ procedures: [record, ...state.procedures] }));
    audit(`requested procedure — ${input.name}`, `procedure/${input.patientId}`);
    return id;
  },

  scheduleProcedure: (id, scheduledFor, performer, assistants) => {
    audit("scheduled procedure", `procedure/${id}`);
    set((state) => ({
      procedures: state.procedures.map((procedure) =>
        procedure.id === id ? { ...procedure, status: "Scheduled", scheduledFor, performer, assistants } : procedure,
      ),
    }));
  },

  recordConsent: (id, obtainedBy) => {
    audit("recorded procedure consent", `procedure/${id}`, { user: obtainedBy });
    set((state) => ({
      procedures: state.procedures.map((procedure) =>
        procedure.id === id ? { ...procedure, status: "Consented", consentObtainedBy: obtainedBy, consentAt: now() } : procedure,
      ),
    }));
  },

  setChecklistItem: (id, itemId, completed, exceptionReason) => {
    set((state) => ({
      procedures: state.procedures.map((procedure) =>
        procedure.id === id
          ? { ...procedure, checklist: procedure.checklist.map((item) => (item.id === itemId ? { ...item, completed, exceptionReason: completed ? undefined : exceptionReason } : item)) }
          : procedure,
      ),
    }));
  },

  beginPreProcedure: (id) => {
    audit("moved to pre-procedure", `procedure/${id}`);
    set((state) => ({ procedures: state.procedures.map((procedure) => (procedure.id === id ? { ...procedure, status: "Pre-procedure" } : procedure)) }));
  },

  performProcedure: (id, input) => {
    const who = actor();
    audit("procedure performed", `procedure/${id}`, { user: who });
    set((state) => ({
      procedures: state.procedures.map((procedure) =>
        procedure.id === id
          ? {
              ...procedure, status: "Performed", performedAt: now(),
              anaesthesia: input.anaesthesia ?? procedure.anaesthesia,
              device: input.device, complications: input.complications || "None",
              outcome: input.outcome, findings: input.findings, specimenSentToLab: input.specimenSentToLab,
            }
          : procedure,
      ),
    }));
  },

  moveToRecovery: (id, recoveryNotes) => {
    set((state) => ({ procedures: state.procedures.map((procedure) => (procedure.id === id ? { ...procedure, status: "Recovery", recoveryNotes } : procedure)) }));
    audit("procedure recovery notes recorded", `procedure/${id}`);
  },

  setFollowUp: (id, followUpPlan) => {
    set((state) => ({ procedures: state.procedures.map((procedure) => (procedure.id === id ? { ...procedure, status: "Follow-up", followUpPlan } : procedure)) }));
    audit("procedure follow-up plan set", `procedure/${id}`);
  },

  signNote: (id) => {
    const who = actor();
    audit("signed procedure note", `procedure/${id}`, { user: who });
    set((state) => ({ procedures: state.procedures.map((procedure) => (procedure.id === id ? { ...procedure, noteSigned: true, noteSignedBy: who, noteSignedAt: now() } : procedure)) }));
  },

  amendNote: (id, note) => {
    const who = actor();
    audit("amended procedure note", `procedure/${id}`, { user: who, meta: { note } });
    set((state) => ({
      procedures: state.procedures.map((procedure) =>
        procedure.id === id ? { ...procedure, amendments: [...(procedure.amendments ?? []), { by: who, at: now(), note }] } : procedure,
      ),
    }));
  },

  cancelProcedure: (id, reason) => {
    audit("cancelled procedure", `procedure/${id}`, { meta: { reason } });
    set((state) => ({ procedures: state.procedures.map((procedure) => (procedure.id === id ? { ...procedure, status: "Cancelled", cancelledReason: reason } : procedure)) }));
  },
}));

export const PROCEDURE_LIFECYCLE: ProcedureStatus[] = [
  "Requested", "Scheduled", "Consented", "Pre-procedure", "Performed", "Recovery", "Follow-up", "Cancelled",
];
