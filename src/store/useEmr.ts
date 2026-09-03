import { create } from "zustand";
import * as mock from "@/data/mock";
import type {
  Patient,
  QueueEntry,
  Encounter,
  Vitals,
  LabOrder,
  Admission,
  Appointment,
  Referral,
  AncRecord,
  FpClient,
  ChildVisit,
  Prescription,
  Station,
  Delivery,
  PncVisit,
  CmamScreening,
  OutreachActivity,
  SurveillanceCase,
  NcdClient,
} from "@/data/types";

const rid = () => Math.random().toString(36).slice(2, 9);

type EmrState = {
  patients: Patient[];
  queue: QueueEntry[];
  encounters: Encounter[];
  labOrders: LabOrder[];
  admissions: Admission[];
  appointments: Appointment[];
  referrals: Referral[];
  ancRecords: AncRecord[];
  fpClients: FpClient[];
  childVisits: ChildVisit[];
  deliveries: Delivery[];
  pncVisits: PncVisit[];
  cmamScreenings: CmamScreening[];
  outreachActivities: OutreachActivity[];
  surveillanceCases: SurveillanceCase[];
  ncdClients: NcdClient[];
  vitals: Record<string, Vitals[]>;
  activePatientId: string | null;

  setActivePatient: (id: string | null) => void;
  patientById: (id?: string | null) => Patient | undefined;

  registerPatient: (p: Omit<Patient, "id" | "mrn" | "registeredAt">) => Patient;
  addToQueue: (patientId: string, station: Station, priority: QueueEntry["priority"], complaint?: string) => void;
  advanceQueue: (id: string, status: QueueEntry["status"], station?: Station) => void;

  saveEncounter: (e: Omit<Encounter, "id" | "date">) => void;
  addLabOrders: (patientId: string, tests: { test: string; category: string }[]) => void;
  resolveLab: (id: string, result: string, flag: LabOrder["flag"], verifiedBy: string) => void;
  dispense: (encounterId: string, rxId: string, status: Prescription["status"]) => void;

  admit: (patientId: string, ward: string, bed: string, diagnosis: string) => void;
  discharge: (id: string, outcome: string) => void;

  bookAppointment: (a: Omit<Appointment, "id" | "status">) => void;
  addReferral: (r: Omit<Referral, "id" | "date" | "status">) => void;
  enrollAnc: (r: Omit<AncRecord, "id" | "visits" | "status" | "edd">) => void;
  addFpClient: (c: Omit<FpClient, "id" | "status">) => void;
  addChildVisit: (c: Omit<ChildVisit, "id">) => void;
  addDelivery: (d: Omit<Delivery, "id">) => void;
  addPncVisit: (v: Omit<PncVisit, "id">) => void;
  addCmamScreening: (c: Omit<CmamScreening, "id">) => void;
  addOutreach: (a: Omit<OutreachActivity, "id">) => void;
  addSurveillanceCase: (c: Omit<SurveillanceCase, "id" | "reportedAt" | "status">) => void;
  addNcdClient: (c: Omit<NcdClient, "id" | "enrolledAt">) => void;
  recordVitals: (patientId: string, v: Omit<Vitals, "takenAt" | "takenBy">) => void;
  latestVitals: (patientId?: string | null) => Vitals | undefined;
};

export const useEmr = create<EmrState>((set, get) => ({
  patients: mock.patients,
  queue: mock.queue,
  encounters: mock.encounters,
  labOrders: mock.labOrders,
  admissions: mock.admissions,
  appointments: mock.appointments,
  referrals: mock.referrals,
  ancRecords: mock.ancRecords,
  fpClients: mock.fpClients,
  childVisits: mock.childVisits,
  deliveries: [],
  pncVisits: [],
  cmamScreenings: [],
  outreachActivities: mock.outreachSeed,
  surveillanceCases: [],
  ncdClients: mock.ncdSeed,
  vitals: {
    p13: [{ bp: "138/78", temp: 38.6, pulse: 96, resp: 22, spo2: 98, weight: 89, takenAt: new Date(Date.now() - 34 * 864e5).toISOString(), takenBy: "Nurse Grace Nwangbo" }],
  },
  activePatientId: "p13",

  setActivePatient: (id) => set({ activePatientId: id }),
  patientById: (id) => get().patients.find((p) => p.id === id),

  registerPatient: (p) => {
    const n = get().patients.length + 35;
    const patient: Patient = {
      ...p,
      id: rid(),
      mrn: `${mock.FACILITY.code}-26-${String(n).padStart(6, "0")}`,
      registeredAt: new Date().toISOString(),
    };
    set((s) => ({ patients: [patient, ...s.patients] }));
    return patient;
  },

  addToQueue: (patientId, station, priority, complaint) =>
    set((s) => ({
      queue: [
        ...s.queue,
        {
          id: rid(),
          patientId,
          station,
          priority,
          complaint,
          status: "Waiting",
          enqueuedAt: new Date().toISOString(),
          waitMins: 0,
        },
      ],
    })),

  advanceQueue: (id, status, station) =>
    set((s) => ({
      queue: s.queue.map((q) => (q.id === id ? { ...q, status, station: station ?? q.station } : q)),
    })),

  saveEncounter: (e) =>
    set((s) => ({
      encounters: [{ ...e, id: rid(), date: new Date().toISOString() }, ...s.encounters],
    })),

  addLabOrders: (patientId, tests) =>
    set((s) => ({
      labOrders: [
        ...tests.map((t) => ({
          id: rid(),
          patientId,
          test: t.test,
          category: t.category,
          urgency: "Routine" as const,
          status: "Pending" as const,
          orderedAt: new Date().toISOString(),
          orderedBy: "Dr. Adaeze Okonjo",
        })),
        ...s.labOrders,
      ],
    })),

  resolveLab: (id, result, flag, verifiedBy) =>
    set((s) => ({
      labOrders: s.labOrders.map((l) =>
        l.id === id ? { ...l, status: "Resulted", result, flag, verifiedBy } : l,
      ),
    })),

  dispense: (encounterId, rxId, status) =>
    set((s) => ({
      encounters: s.encounters.map((e) =>
        e.id === encounterId
          ? { ...e, prescriptions: e.prescriptions.map((r) => (r.id === rxId ? { ...r, status } : r)) }
          : e,
      ),
    })),

  admit: (patientId, ward, bed, diagnosis) =>
    set((s) => ({
      admissions: [
        { id: rid(), patientId, ward, bed, diagnosis, admittedAt: new Date().toISOString(), status: "Active" },
        ...s.admissions,
      ],
    })),

  discharge: (id, outcome) =>
    set((s) => ({
      admissions: s.admissions.map((a) => (a.id === id ? { ...a, status: "Discharged", outcome } : a)),
    })),

  bookAppointment: (a) =>
    set((s) => ({ appointments: [{ ...a, id: rid(), status: "Scheduled" }, ...s.appointments] })),

  addReferral: (r) =>
    set((s) => ({
      referrals: [{ ...r, id: rid(), date: new Date().toISOString(), status: "Open" }, ...s.referrals],
    })),

  enrollAnc: (r) =>
    set((s) => {
      const edd = new Date(r.lmp);
      edd.setDate(edd.getDate() + 280);
      return {
        ancRecords: [
          { ...r, id: rid(), edd: edd.toISOString(), status: "Active", visits: [] },
          ...s.ancRecords,
        ],
      };
    }),

  addFpClient: (c) => set((s) => ({ fpClients: [{ ...c, id: rid(), status: "Active" }, ...s.fpClients] })),
  addChildVisit: (c) => set((s) => ({ childVisits: [{ ...c, id: rid() }, ...s.childVisits] })),

  addDelivery: (d) => set((s) => ({ deliveries: [{ ...d, id: rid() }, ...s.deliveries] })),
  addPncVisit: (v) => set((s) => ({ pncVisits: [{ ...v, id: rid() }, ...s.pncVisits] })),
  addCmamScreening: (c) => set((s) => ({ cmamScreenings: [{ ...c, id: rid() }, ...s.cmamScreenings] })),
  addOutreach: (a) => set((s) => ({ outreachActivities: [{ ...a, id: rid() }, ...s.outreachActivities] })),
  addSurveillanceCase: (c) =>
    set((s) => ({
      surveillanceCases: [
        { ...c, id: rid(), reportedAt: new Date().toISOString(), status: "Suspected" },
        ...s.surveillanceCases,
      ],
    })),
  addNcdClient: (c) =>
    set((s) => ({ ncdClients: [{ ...c, id: rid(), enrolledAt: new Date().toISOString() }, ...s.ncdClients] })),

  recordVitals: (patientId, v) =>
    set((s) => ({
      vitals: {
        ...s.vitals,
        [patientId]: [
          { ...v, takenAt: new Date().toISOString(), takenBy: "Nurse Grace Nwangbo" },
          ...(s.vitals[patientId] ?? []),
        ],
      },
    })),

  latestVitals: (patientId) => (patientId ? get().vitals[patientId]?.[0] : undefined),
}));
