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
  ReferralFeedback,
  PatientTransfer,
  Immunization,
  Aefi,
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
  Invoice,
  InvoiceLine,
  BirthRegisterEntry,
} from "@/data/types";
import { SERVICE_TYPES, PATIENT_CATEGORIES } from "@/data/catalog";
import { audit } from "@/store/useAudit";
import { useIdentity } from "@/store/useIdentity";

const rid = () => Math.random().toString(36).slice(2, 9);

type EmrState = {
  patients: Patient[];
  queue: QueueEntry[];
  encounters: Encounter[];
  labOrders: LabOrder[];
  admissions: Admission[];
  appointments: Appointment[];
  referrals: Referral[];
  transfers: PatientTransfer[];
  ancRecords: AncRecord[];
  fpClients: FpClient[];
  childVisits: ChildVisit[];
  deliveries: Delivery[];
  birthRegister: BirthRegisterEntry[];
  immunizations: Immunization[];
  pncVisits: PncVisit[];
  cmamScreenings: CmamScreening[];
  outreachActivities: OutreachActivity[];
  surveillanceCases: SurveillanceCase[];
  ncdClients: NcdClient[];
  vitals: Record<string, Vitals[]>;
  invoices: Invoice[];
  activePatientId: string | null;

  setActivePatient: (id: string | null) => void;
  patientById: (id?: string | null) => Patient | undefined;

  registerPatient: (p: Omit<Patient, "id" | "mrn" | "registeredAt">) => Patient;
  addToQueue: (patientId: string, station: Station, priority: QueueEntry["priority"], complaint?: string) => void;
  advanceQueue: (id: string, status: QueueEntry["status"], station?: Station) => void;

  saveEncounter: (e: Omit<Encounter, "id" | "date">) => void;
  addLabOrders: (patientId: string, tests: { test: string; category: string }[], orderedBy?: string) => void;
  resolveLab: (id: string, result: string, flag: LabOrder["flag"], verifiedBy: string) => void;
  dispense: (encounterId: string, rxId: string, status: Prescription["status"]) => void;

  admit: (patientId: string, ward: string, bed: string, diagnosis: string) => void;
  discharge: (id: string, outcome: string) => void;

  bookAppointment: (a: Omit<Appointment, "id" | "status">) => void;
  markAppointment: (id: string, status: Appointment["status"], queueStation?: Station) => void;
  addReferral: (r: Omit<Referral, "id" | "date" | "status">) => void;
  setReferralStatus: (id: string, status: Referral["status"]) => void;
  recordReferralFeedback: (id: string, feedback: Omit<ReferralFeedback, "at">) => void;
  addTransfer: (t: Omit<PatientTransfer, "id" | "status" | "completedAt">) => void;
  completeTransfer: (id: string, handledBy: string) => void;
  cancelTransfer: (id: string) => void;
  enrollAnc: (r: Omit<AncRecord, "id" | "visits" | "status" | "edd">) => void;
  addAncVisit: (recordId: string, v: AncRecord["visits"][number]) => void;
  addFpClient: (c: Omit<FpClient, "id" | "status">) => void;
  addFpVisit: (clientId: string, v: { type: import("@/data/types").FpVisitType; method: string; nextVisit?: string; notes?: string; by: string }) => void;
  discontinueFp: (clientId: string, reason: string) => void;
  addChildVisit: (c: Omit<ChildVisit, "id">) => void;
  addDelivery: (d: Omit<Delivery, "id">) => void;
  recordImmunization: (patientId: string, data: { vaccineCode: string; vaccineName: string; batchNo: string; site: string; givenBy: string }) => void;
  recordAefi: (immunizationId: string, aefi: Omit<Aefi, "reportedAt">) => void;
  notifyBirth: (deliveryId: string, data: { babyName: string; informantName: string; informantRelation: string; fatherName?: string }) => void;
  registerBirth: (id: string) => void;
  issueBirthCertificate: (id: string) => void;
  addPncVisit: (v: Omit<PncVisit, "id">) => void;
  addCmamScreening: (c: Omit<CmamScreening, "id">) => void;
  addOutreach: (a: Omit<OutreachActivity, "id">) => void;
  addSurveillanceCase: (c: Omit<SurveillanceCase, "id" | "reportedAt" | "status">) => void;
  addNcdClient: (c: Omit<NcdClient, "id" | "enrolledAt">) => void;
  recordVitals: (patientId: string, v: Omit<Vitals, "takenAt" | "takenBy">) => void;
  latestVitals: (patientId?: string | null) => Vitals | undefined;
  createInvoice: (patientId: string, lines: InvoiceLine[]) => Invoice;
  settleInvoice: (id: string, method: NonNullable<Invoice["method"]>) => void;
};

export const useEmr = create<EmrState>((set, get) => ({
  patients: mock.patients,
  queue: mock.queue,
  encounters: mock.encounters,
  labOrders: mock.labOrders,
  admissions: mock.admissions,
  appointments: mock.appointments,
  referrals: mock.referrals,
  transfers: mock.transfers,
  ancRecords: mock.ancRecords,
  fpClients: mock.fpClients,
  childVisits: mock.childVisits,
  deliveries: [],
  birthRegister: [],
  immunizations: mock.immunizations,
  pncVisits: [],
  cmamScreenings: [],
  outreachActivities: mock.outreachSeed,
  surveillanceCases: [],
  ncdClients: mock.ncdSeed,
  vitals: {
    p13: [{ bp: "138/78", temp: 38.6, pulse: 96, resp: 22, spo2: 98, weight: 89, takenAt: new Date(Date.now() - 34 * 864e5).toISOString(), takenBy: "Nurse Grace Nwangbo" }],
  },
  invoices: mock.invoiceSeed,
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
    audit("registered patient", `patient/${patient.mrn}`);
    return patient;
  },

  addToQueue: (patientId, station, priority, complaint) => {
    audit("added to queue", `queue/${station.toLowerCase()}`);
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
    }));
  },

  advanceQueue: (id, status, station) =>
    set((s) => ({
      queue: s.queue.map((q) => (q.id === id ? { ...q, status, station: station ?? q.station } : q)),
    })),

  saveEncounter: (e) => {
    const patient = get().patients.find((p) => p.id === e.patientId);
    audit("created encounter", `encounter/${patient?.mrn ?? e.patientId}`);
    set((s) => ({
      encounters: [{ ...e, id: rid(), date: new Date().toISOString() }, ...s.encounters],
    }));
  },

  addLabOrders: (patientId, tests, orderedBy = "Dr. Adaeze Okonjo") =>
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
          orderedBy,
        })),
        ...s.labOrders,
      ],
    })),

  resolveLab: (id, result, flag, verifiedBy) => {
    const l = get().labOrders.find((x) => x.id === id);
    audit("resulted lab test", `lab/${l?.test ?? id}`);
    set((s) => ({
      labOrders: s.labOrders.map((x) =>
        x.id === id ? { ...x, status: "Resulted", result, flag, verifiedBy } : x,
      ),
    }));
  },

  dispense: (encounterId, rxId, status) => {
    const rx = get().encounters.find((e) => e.id === encounterId)?.prescriptions.find((r) => r.id === rxId);
    audit(status === "Dispensed" ? "dispensed drug" : "outsourced drug", `pharmacy/${rx?.drug ?? rxId}`);
    set((s) => ({
      encounters: s.encounters.map((e) =>
        e.id === encounterId
          ? { ...e, prescriptions: e.prescriptions.map((r) => (r.id === rxId ? { ...r, status } : r)) }
          : e,
      ),
    }));
  },

  admit: (patientId, ward, bed, diagnosis) => {
    const p = get().patients.find((x) => x.id === patientId);
    audit("admitted patient", `inpatient/${p?.mrn ?? patientId}`);
    set((s) => ({
      admissions: [
        { id: rid(), patientId, ward, bed, diagnosis, admittedAt: new Date().toISOString(), status: "Active" },
        ...s.admissions,
      ],
    }));
  },

  discharge: (id, outcome) => {
    audit("discharged patient", `inpatient/${id}`);
    set((s) => ({
      admissions: s.admissions.map((a) => (a.id === id ? { ...a, status: "Discharged", outcome } : a)),
    }));
  },

  bookAppointment: (a) => {
    audit("booked appointment", `appointment/${a.type.toLowerCase()}`);
    set((s) => ({ appointments: [{ ...a, id: rid(), status: "Scheduled" }, ...s.appointments] }));
  },

  markAppointment: (id, status, queueStation) => {
    const appt = get().appointments.find((a) => a.id === id);
    audit(`appointment ${status.toLowerCase()}`, `appointment/${id}`);
    set((s) => ({ appointments: s.appointments.map((a) => (a.id === id ? { ...a, status } : a)) }));
    if (status === "Attended" && appt && queueStation) {
      get().addToQueue(appt.patientId, queueStation, "Normal", `${appt.type} appointment — ${appt.reason ?? ""}`.trim());
    }
  },

  addReferral: (r) => {
    audit("created referral", `referral/${r.type.toLowerCase()}`);
    set((s) => ({
      referrals: [{ ...r, id: rid(), date: new Date().toISOString(), status: "Open" }, ...s.referrals],
    }));
  },

  setReferralStatus: (id, status) => {
    const r = get().referrals.find((x) => x.id === id);
    audit(`referral ${status.toLowerCase()}`, `referral/${r ? r.patientId : id}`);
    set((s) => ({ referrals: s.referrals.map((x) => (x.id === id ? { ...x, status } : x)) }));
  },

  addTransfer: (t) => {
    audit(`initiated ${t.direction.toLowerCase()}-transfer`, `transfer/${t.patientId ?? t.patientName}`);
    set((s) => ({ transfers: [{ ...t, id: rid(), status: "Pending" }, ...s.transfers] }));
  },

  completeTransfer: (id, handledBy) => {
    const t = get().transfers.find((x) => x.id === id);
    audit("completed transfer", `transfer/${t?.patientId ?? t?.patientName ?? id}`, { user: handledBy });
    set((s) => ({
      transfers: s.transfers.map((x) =>
        x.id === id ? { ...x, status: "Completed", completedAt: new Date().toISOString(), handledBy, recordsSent: true } : x,
      ),
    }));
  },

  cancelTransfer: (id) => {
    const t = get().transfers.find((x) => x.id === id);
    audit("cancelled transfer", `transfer/${t?.patientId ?? t?.patientName ?? id}`);
    set((s) => ({ transfers: s.transfers.map((x) => (x.id === id ? { ...x, status: "Cancelled" } : x)) }));
  },

  recordReferralFeedback: (id, feedback) => {
    const r = get().referrals.find((x) => x.id === id);
    audit("recorded referral feedback", `referral/${r ? r.patientId : id}`);
    set((s) => ({
      referrals: s.referrals.map((x) =>
        x.id === id
          ? { ...x, status: "Completed", feedback: { ...feedback, at: new Date().toISOString() } }
          : x,
      ),
    }));
    // a back-referral opens an inbound referral for continued PHC care
    if (feedback.backReferral && r) {
      set((s) => ({
        referrals: [
          {
            id: rid(), patientId: r.patientId, type: "In", diagnosis: r.diagnosis,
            facility: r.facility, reason: "Continued care after referral", urgency: "Routine",
            status: "Open", date: new Date().toISOString(), referredBy: feedback.by,
          },
          ...s.referrals,
        ],
      }));
    }
  },

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

  addAncVisit: (recordId, v) =>
    set((s) => ({
      ancRecords: s.ancRecords.map((r) =>
        r.id === recordId ? { ...r, visits: [...r.visits, v] } : r,
      ),
    })),

  addFpClient: (c) => {
    audit("registered FP client", `mch/fp/${c.patientId}`);
    set((s) => ({
      fpClients: [
        {
          ...c, id: rid(), status: "Active",
          visits: [{ date: c.startDate, type: "New Visit", method: c.method, nextVisit: c.nextVisit, notes: c.notes, by: useIdentity.getState().user.name }],
        },
        ...s.fpClients,
      ],
    }));
  },

  addFpVisit: (clientId, v) => {
    const c = get().fpClients.find((x) => x.id === clientId);
    audit(`FP ${v.type.toLowerCase()}`, `mch/fp/${c?.patientId ?? clientId}`, { user: v.by });
    set((s) => ({
      fpClients: s.fpClients.map((x) =>
        x.id === clientId
          ? {
              ...x,
              method: v.type === "Switch method" ? v.method : x.method,
              nextVisit: v.nextVisit ?? x.nextVisit,
              status: v.type === "Removal" ? "Discontinued" : x.status,
              visits: [...(x.visits ?? []), { date: new Date().toISOString(), ...v }],
            }
          : x,
      ),
    }));
  },

  discontinueFp: (clientId, reason) => {
    const c = get().fpClients.find((x) => x.id === clientId);
    audit("FP discontinued", `mch/fp/${c?.patientId ?? clientId}`);
    set((s) => ({
      fpClients: s.fpClients.map((x) => (x.id === clientId ? { ...x, status: "Discontinued", discontinueReason: reason } : x)),
    }));
  },
  addChildVisit: (c) => set((s) => ({ childVisits: [{ ...c, id: rid() }, ...s.childVisits] })),

  addDelivery: (d) => {
    audit("recorded delivery", `mch/delivery/${d.patientId}`);
    set((s) => ({ deliveries: [{ ...d, id: rid() }, ...s.deliveries] }));
  },

  recordImmunization: (patientId, data) => {
    audit("recorded immunization", `mch/immunization/${patientId}`, { user: data.givenBy });
    set((s) => ({
      immunizations: [
        { id: rid(), patientId, vaccineCode: data.vaccineCode, vaccineName: data.vaccineName, givenAt: new Date().toISOString(), givenBy: data.givenBy, batchNo: data.batchNo, site: data.site },
        ...s.immunizations,
      ],
    }));
  },

  recordAefi: (immunizationId, aefi) => {
    const s = get();
    const imm = s.immunizations.find((x) => x.id === immunizationId);
    if (!imm) return;
    const now = new Date().toISOString();
    audit(`reported AEFI (${aefi.severity.toLowerCase()})`, `mch/immunization/aefi/${imm.patientId}`, { user: aefi.reportedBy });
    set((st) => ({
      immunizations: st.immunizations.map((x) => (x.id === immunizationId ? { ...x, aefi: { ...aefi, reportedAt: now } } : x)),
      // a serious AEFI becomes a notifiable surveillance event
      surveillanceCases:
        aefi.severity === "Serious"
          ? [{ id: rid(), patientId: imm.patientId, disease: `AEFI — ${imm.vaccineName}`, onset: now.slice(0, 10), reportedAt: now, status: "Suspected" as const }, ...st.surveillanceCases]
          : st.surveillanceCases,
    }));
  },

  notifyBirth: (deliveryId, data) => {
    const s = get();
    const d = s.deliveries.find((x) => x.id === deliveryId);
    if (!d) return;
    const mother = s.patients.find((p) => p.id === d.patientId);
    const yr = new Date(d.date).getFullYear();
    const seq = String(s.birthRegister.length + 1).padStart(4, "0");
    audit("issued birth notification", `mch/birth-register/${d.patientId}`);
    set((st) => ({
      birthRegister: [
        {
          id: rid(),
          deliveryId,
          patientId: d.patientId,
          babyName: data.babyName,
          sex: d.babySex,
          bornAt: d.date,
          weight: d.weight,
          placeOfBirth: `${mock.FACILITY.name} (${mock.FACILITY.code})`,
          motherName: mother ? `${mother.firstName} ${mother.lastName}` : "—",
          fatherName: data.fatherName || undefined,
          informantName: data.informantName,
          informantRelation: data.informantRelation,
          npopcNo: `NOT/${mock.FACILITY.code}/${yr}/${seq}`,
          status: "Notified",
          notifiedAt: new Date().toISOString(),
        },
        ...st.birthRegister,
      ],
    }));
  },

  registerBirth: (id) => {
    const e = get().birthRegister.find((x) => x.id === id);
    if (!e || e.status !== "Notified") return;
    const yr = new Date(e.bornAt).getFullYear();
    const seq = String(get().birthRegister.filter((x) => x.regNo).length + 1).padStart(4, "0");
    audit("registered birth", `mch/birth-register/${e.patientId}`);
    set((s) => ({
      birthRegister: s.birthRegister.map((x) =>
        x.id === id
          ? { ...x, status: "Registered", regNo: `BR/${mock.FACILITY.lga}/${yr}/${seq}`, registeredAt: new Date().toISOString() }
          : x,
      ),
    }));
  },

  issueBirthCertificate: (id) => {
    const e = get().birthRegister.find((x) => x.id === id);
    if (!e || e.status !== "Registered") return;
    audit("issued birth certificate", `mch/birth-register/${e.patientId}`);
    set((s) => ({
      birthRegister: s.birthRegister.map((x) =>
        x.id === id ? { ...x, status: "Certificate issued", certIssuedAt: new Date().toISOString() } : x,
      ),
    }));
  },
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

  createInvoice: (patientId, lines) => {
    const patient = get().patients.find((p) => p.id === patientId)!;
    const cat = PATIENT_CATEGORIES.find((c) => c.code === patient.category);
    const exempt = !!cat?.exempt || patient.payer === "NHIS";
    const n = get().invoices.length + 4012;
    const inv: Invoice = {
      id: rid(),
      number: `INV-26-${String(n).padStart(6, "0")}`,
      patientId,
      payer: patient.payer,
      category: patient.category,
      lines,
      exempt,
      createdAt: new Date().toISOString(),
      status: exempt ? "Waived" : "Unpaid",
      method: exempt ? (patient.payer === "NHIS" ? "NHIS" : "Waiver") : undefined,
      paidAt: exempt ? new Date().toISOString() : undefined,
    };
    set((s) => ({ invoices: [inv, ...s.invoices] }));
    audit(exempt ? "waived invoice" : "raised invoice", `billing/${inv.number}`);
    return inv;
  },

  settleInvoice: (id, method) => {
    const inv = get().invoices.find((i) => i.id === id);
    audit("recorded payment", `billing/${inv?.number ?? id}`);
    set((s) => ({
      invoices: s.invoices.map((i) =>
        i.id === id ? { ...i, status: "Paid", method, paidAt: new Date().toISOString() } : i,
      ),
    }));
  },
}));

export const priceFor = (code: string) => SERVICE_TYPES.find((s) => s.code === code)?.price ?? 0;
export const serviceLine = (code: string, qty = 1): InvoiceLine => {
  const s = SERVICE_TYPES.find((x) => x.code === code);
  return { code, name: s?.name ?? code, qty, unitPrice: s?.price ?? 0 };
};
