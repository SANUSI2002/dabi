import { create } from "zustand";
import { audit } from "@/store/useAudit";
import { useIdentity } from "@/store/useIdentity";
import {
  frequencyToTimes, durationToDays,
  type NursingObservation, type MedicationAdministration, type AdministrationStatus,
} from "@/data/nursing";
import type { Admission, Prescription } from "@/data/types";
import { persisted } from "@/platform/persist";

const rid = () => Math.random().toString(36).slice(2, 9);
const now = () => new Date().toISOString();
const actor = () => useIdentity.getState().user.name;

/** one scheduled dose slot on the MAR before any nurse action */
export type MarSlot = {
  slotKey: string;
  prescriptionId: string;
  drug: string;
  dose: string;
  route: string;
  scheduledFor: string;
  status: AdministrationStatus;
  administeredBy?: string;
  administeredAt?: string;
  reason?: string;
};

type NursingState = {
  observations: NursingObservation[];
  administrations: MedicationAdministration[];

  observationsFor: (admissionId: string) => NursingObservation[];
  addObservation: (input: Omit<NursingObservation, "id" | "recordedAt" | "recordedBy">) => void;

  /** the full MAR schedule for an admission, merging recorded administrations */
  marFor: (admission: Admission, prescriptions: Prescription[]) => MarSlot[];
  recordDose: (
    admission: Admission,
    slot: { slotKey: string; prescriptionId: string; drug: string; dose: string; route: string; scheduledFor: string },
    status: AdministrationStatus,
    reason?: string,
  ) => void;
};

function slotStatus(scheduledFor: string): AdministrationStatus {
  const due = new Date(scheduledFor).getTime();
  const nowMs = Date.now();
  if (nowMs < due - 30 * 60000) return "scheduled";
  return "due";
}

export const useNursing = create<NursingState>(persisted<NursingState>("nursing", (set, get) => ({
  observations: [],
  administrations: [],

  observationsFor: (admissionId) =>
    get()
      .observations.filter((observation) => observation.admissionId === admissionId)
      .sort((left, right) => +new Date(right.recordedAt) - +new Date(left.recordedAt)),

  addObservation: (input) => {
    set((state) => ({
      observations: [{ ...input, id: `obs-${rid()}`, recordedAt: now(), recordedBy: actor() }, ...state.observations],
    }));
    audit("recorded nursing observations", `inpatient/${input.patientId}`);
  },

  marFor: (admission, prescriptions) => {
    const recorded = get().administrations.filter((administration) => administration.admissionId === admission.id);
    const admissionDate = new Date(admission.admittedAt);
    admissionDate.setHours(0, 0, 0, 0);
    const slots: MarSlot[] = [];

    for (const prescription of prescriptions) {
      if (!["Dispensed", "Partially Dispensed"].includes(prescription.status)) continue;
      const times = frequencyToTimes(prescription.frequency);
      if (times.length === 0) {
        // PRN / as-required — one open slot
        const slotKey = `${prescription.id}:prn`;
        const recordedSlot = recorded.find((administration) => administration.slotKey === slotKey);
        slots.push({
          slotKey, prescriptionId: prescription.id, drug: prescription.drug, dose: prescription.dose,
          route: prescription.route ?? "Oral", scheduledFor: admission.admittedAt,
          status: recordedSlot?.status ?? "scheduled",
          administeredBy: recordedSlot?.administeredBy, administeredAt: recordedSlot?.administeredAt, reason: recordedSlot?.reason,
        });
        continue;
      }
      const days = Math.min(durationToDays(prescription.duration), 7);
      for (let day = 0; day < days; day += 1) {
        for (const time of times) {
          const [hour, minute] = time.split(":").map(Number);
          const scheduled = new Date(admissionDate);
          scheduled.setDate(scheduled.getDate() + day);
          scheduled.setHours(hour, minute, 0, 0);
          const scheduledFor = scheduled.toISOString();
          const slotKey = `${prescription.id}:${day}:${time}`;
          const recordedSlot = recorded.find((administration) => administration.slotKey === slotKey);
          slots.push({
            slotKey, prescriptionId: prescription.id, drug: prescription.drug, dose: prescription.dose,
            route: prescription.route ?? "Oral", scheduledFor,
            status: recordedSlot?.status ?? slotStatus(scheduledFor),
            administeredBy: recordedSlot?.administeredBy, administeredAt: recordedSlot?.administeredAt, reason: recordedSlot?.reason,
          });
        }
      }
    }
    return slots.sort((left, right) => +new Date(left.scheduledFor) - +new Date(right.scheduledFor));
  },

  recordDose: (admission, slot, status, reason) => {
    const who = actor();
    audit(`medication ${status}`, `inpatient/${admission.patientId}/mar/${slot.drug}`, { user: who, ...(reason ? { meta: { reason } } : {}) });
    set((state) => {
      const existing = state.administrations.find(
        (administration) => administration.admissionId === admission.id && administration.slotKey === slot.slotKey,
      );
      const record: MedicationAdministration = {
        id: existing?.id ?? `mar-${rid()}`,
        slotKey: slot.slotKey,
        admissionId: admission.id,
        patientId: admission.patientId,
        prescriptionId: slot.prescriptionId,
        drug: slot.drug,
        dose: slot.dose,
        route: slot.route,
        scheduledFor: slot.scheduledFor,
        status,
        administeredBy: who,
        administeredAt: now(),
        reason,
      };
      return {
        administrations: existing
          ? state.administrations.map((administration) => (administration.id === existing.id ? record : administration))
          : [record, ...state.administrations],
      };
    });
  },
})));
