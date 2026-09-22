import { create } from "zustand";
import { developmentFixturesEnabled } from "@/config/runtime";
import type { Id } from "./domain";
import { hasPermission } from "./access";
import { useCommandCenter, type MutationResult } from "./useCommandCenter";
import type {
  Consultation, DoctorApplicationStatus, DoctorProfile, LaboratoryProfile, MedicationOrder,
  MedicationOrderStatus, NetworkVerificationStatus, PatientAccountStatus, PatientProfile,
  PharmacyProfile, Prescription, PrescriptionStatus, ProviderOrganizationLink,
  SabiHealthAuditEvent, VerificationDocument, VerificationDocumentStatus, VerificationSubjectType,
} from "./sabihealth/domain";
import { DOCUMENT_LABELS } from "./sabihealth/domain";
import {
  seedConsultations, seedDoctors, seedLaboratories, seedMedicationOrders, seedPatients,
  seedPharmacies, seedPrescriptions, seedProviderOrganizationLinks, seedVerificationDocuments,
} from "./sabihealth/seed";

/** PHASE 4 — the required-document checklist for a network provider that isn't yet fully
 *  verified. Used to gate the VERIFIED transition and to render the Verification Center's
 *  blocker list — see setDoctorStatus/setPharmacyStatus/setLaboratoryStatus below. */
export function getVerificationBlockers(documents: VerificationDocument[], subjectType: VerificationSubjectType, subjectId: Id): string[] {
  return documents
    .filter((doc) => doc.subjectType === subjectType && doc.subjectId === subjectId && doc.required && doc.status !== "VERIFIED")
    .map((doc) => `${DOCUMENT_LABELS[doc.documentType]} is ${doc.status.toLowerCase()}`);
}

const STUCK_STATUSES: Consultation["status"][] = ["REQUESTED", "SCHEDULED", "WAITING"];

/** PHASE 5 — TELEMEDICINE OPERATIONS. A consultation needs operational attention if it failed,
 *  was disputed, or is still open well past its scheduled time with nobody having closed it out.
 *  Compared against the real clock (not a fixed demo "today") since seed dates are themselves
 *  generated relative to Date.now() — see sabihealth/seed.ts's iso() helper. */
export function consultationNeedsAttention(consultation: Consultation): boolean {
  if (consultation.reviewedAt) return false;
  if (consultation.status === "TECHNICAL_FAILURE" || consultation.status === "DISPUTED") return true;
  return STUCK_STATUSES.includes(consultation.status) && new Date(consultation.scheduledFor).getTime() < Date.now();
}

const TERMINAL_ORDER_STATUSES: MedicationOrderStatus[] = ["COMPLETED", "CANCELLED", "REFUNDED"];
const UNPAID_ORDER_STATUSES: MedicationOrderStatus[] = ["DRAFT", "AWAITING_PAYMENT"];
const STUCK_ORDER_MS = 2 * 24 * 60 * 60 * 1000;
const STALE_PRESCRIPTION_MS = 14 * 24 * 60 * 60 * 1000;

/** PHASE 6 — PRESCRIPTION & PHARMACY OPERATIONS. An order needs attention if it's flagged for
 *  refund, or has sat in any non-terminal status for more than two days without anyone
 *  progressing or closing it out — there's no live pharmacy-system webhook, so "stuck" is judged
 *  from Command Center's own last recorded update, same reasoning as consultationNeedsAttention
 *  above. The refundFlagged check must come first: flagging itself touches updatedAt, which would
 *  otherwise reset the staleness clock and make a flagged-but-unresolved order look "fresh". */
export function orderNeedsAttention(order: MedicationOrder): boolean {
  if (order.reviewedAt) return false;
  if (order.refundFlagged) return true;
  if (TERMINAL_ORDER_STATUSES.includes(order.status)) return false;
  return Date.now() - new Date(order.updatedAt).getTime() > STUCK_ORDER_MS;
}

/** A prescription needs attention if it was issued more than two weeks ago, is still open, and
 *  never resulted in a completed order — i.e. nobody ever picked it up. */
export function prescriptionNeedsAttention(prescription: Prescription, orders: MedicationOrder[]): boolean {
  if (prescription.status !== "ACTIVE" && prescription.status !== "PARTIALLY_FILLED") return false;
  if (Date.now() - new Date(prescription.issuedAt).getTime() < STALE_PRESCRIPTION_MS) return false;
  return !orders.some((order) => order.prescriptionId === prescription.id && order.status === "COMPLETED");
}

const uid = (prefix: string) => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

// Command Center's own model of Sabi Health network operations. Empty in production until a
// real Sabi Health backend is connected — never a live read of the separate patient-portal
// app's local state (there is no shared backend between them yet). See sabihealth/domain.ts.
type SabiHealthState = {
  patients: PatientProfile[];
  doctors: DoctorProfile[];
  pharmacies: PharmacyProfile[];
  laboratories: LaboratoryProfile[];
  consultations: Consultation[];
  prescriptions: Prescription[];
  medicationOrders: MedicationOrder[];
  providerOrganizationLinks: ProviderOrganizationLink[];
  auditEvents: SabiHealthAuditEvent[];
  verificationDocuments: VerificationDocument[];
  setPatientStatus: (id: Id, status: PatientAccountStatus, reason: string, actorId?: Id) => MutationResult;
  setDoctorStatus: (id: Id, status: DoctorApplicationStatus, reason: string, actorId?: Id) => MutationResult;
  setPharmacyStatus: (id: Id, status: NetworkVerificationStatus, reason: string, actorId?: Id) => MutationResult;
  setLaboratoryStatus: (id: Id, status: NetworkVerificationStatus, reason: string, actorId?: Id) => MutationResult;
  decideDocument: (documentId: Id, status: VerificationDocumentStatus, reason: string, actorId?: Id) => MutationResult;
  flagConsultationForRefund: (id: Id, reason: string, actorId?: Id) => MutationResult;
  markConsultationReviewed: (id: Id, note: string, actorId?: Id) => MutationResult;
  cancelConsultation: (id: Id, reason: string, actorId?: Id) => MutationResult;
  cancelMedicationOrder: (id: Id, reason: string, actorId?: Id) => MutationResult;
  flagOrderForRefund: (id: Id, reason: string, actorId?: Id) => MutationResult;
  markOrderReviewed: (id: Id, note: string, actorId?: Id) => MutationResult;
  setPrescriptionStatus: (id: Id, status: PrescriptionStatus, reason: string, actorId?: Id) => MutationResult;
  recordConsultationRefund: (id: Id, externalReference: string, actorId?: Id) => MutationResult;
  recordOrderRefund: (id: Id, externalReference: string, actorId?: Id) => MutationResult;
};

export const useSabiHealth = create<SabiHealthState>((set, get) => {
  // Sabi Health has no platform users of its own — actions here are attributed to the same
  // Command Center identities as Sabi OS (one SABI ID, one control plane; see useCommandCenter).
  const resolveActor = (actorId?: Id) => {
    const users = useCommandCenter.getState().platformUsers;
    return (actorId ? users.find((user) => user.id === actorId) : undefined) ?? users[0];
  };

  const audit = (event: Omit<SabiHealthAuditEvent, "id" | "timestamp" | "actorId" | "actorName" | "actorRole">, actorId?: Id) => {
    const actor = resolveActor(actorId);
    if (!actor) return;
    set((state) => ({ auditEvents: [{ ...event, id: uid("shaudit"), timestamp: new Date().toISOString(), actorId: actor.id, actorName: actor.name, actorRole: actor.role }, ...state.auditEvents] }));
  };

  return {
    patients: developmentFixturesEnabled ? seedPatients : [],
    doctors: developmentFixturesEnabled ? seedDoctors : [],
    pharmacies: developmentFixturesEnabled ? seedPharmacies : [],
    laboratories: developmentFixturesEnabled ? seedLaboratories : [],
    consultations: developmentFixturesEnabled ? seedConsultations : [],
    prescriptions: developmentFixturesEnabled ? seedPrescriptions : [],
    medicationOrders: developmentFixturesEnabled ? seedMedicationOrders : [],
    providerOrganizationLinks: developmentFixturesEnabled ? seedProviderOrganizationLinks : [],
    auditEvents: [],
    verificationDocuments: developmentFixturesEnabled ? seedVerificationDocuments : [],

    setPatientStatus: (id, status, reason, actorId) => {
      const actor = resolveActor(actorId);
      if (!actor || !hasPermission(actor, "sabihealth.network.manage")) return { ok: false, error: "You do not have permission to change patient account status." };
      const patient = get().patients.find((item) => item.id === id);
      if (!patient) return { ok: false, error: "Patient not found." };
      const now = new Date().toISOString();
      set((state) => ({ patients: state.patients.map((item) => item.id === id ? { ...item, accountStatus: status, updatedAt: now } : item) }));
      audit({ resourceType: "Patient", resourceId: id, action: `Set account status to ${status}`, previousValue: patient.accountStatus, newValue: status, reason }, actorId);
      return { ok: true, id };
    },

    setDoctorStatus: (id, status, reason, actorId) => {
      const actor = resolveActor(actorId);
      const permission = status === "VERIFIED" || status === "REJECTED" ? "sabihealth.verification.decide" : "sabihealth.network.manage";
      if (!actor || !hasPermission(actor, permission)) return { ok: false, error: `You do not have permission to ${permission === "sabihealth.verification.decide" ? "decide doctor verification" : "change doctor network status"}.` };
      const doctor = get().doctors.find((item) => item.id === id);
      if (!doctor) return { ok: false, error: "Doctor not found." };
      if (status === "VERIFIED") {
        const blockers = getVerificationBlockers(get().verificationDocuments, "Doctor", id);
        if (blockers.length > 0) return { ok: false, error: `Cannot verify — outstanding documents: ${blockers.join(", ")}.` };
      }
      const now = new Date().toISOString();
      set((state) => ({ doctors: state.doctors.map((item) => item.id === id ? { ...item, status, updatedAt: now } : item) }));
      audit({ resourceType: "Doctor", resourceId: id, action: `Set verification status to ${status}`, previousValue: doctor.status, newValue: status, reason }, actorId);
      return { ok: true, id };
    },

    setPharmacyStatus: (id, status, reason, actorId) => {
      const actor = resolveActor(actorId);
      const permission = status === "VERIFIED" || status === "REJECTED" ? "sabihealth.verification.decide" : "sabihealth.network.manage";
      if (!actor || !hasPermission(actor, permission)) return { ok: false, error: `You do not have permission to ${permission === "sabihealth.verification.decide" ? "decide pharmacy verification" : "change pharmacy network status"}.` };
      const pharmacy = get().pharmacies.find((item) => item.id === id);
      if (!pharmacy) return { ok: false, error: "Pharmacy not found." };
      if (status === "VERIFIED") {
        const blockers = getVerificationBlockers(get().verificationDocuments, "Pharmacy", id);
        if (blockers.length > 0) return { ok: false, error: `Cannot verify — outstanding documents: ${blockers.join(", ")}.` };
      }
      const now = new Date().toISOString();
      set((state) => ({ pharmacies: state.pharmacies.map((item) => item.id === id ? { ...item, status, updatedAt: now } : item) }));
      audit({ resourceType: "Pharmacy", resourceId: id, action: `Set verification status to ${status}`, previousValue: pharmacy.status, newValue: status, reason }, actorId);
      return { ok: true, id };
    },

    setLaboratoryStatus: (id, status, reason, actorId) => {
      const actor = resolveActor(actorId);
      const permission = status === "VERIFIED" || status === "REJECTED" ? "sabihealth.verification.decide" : "sabihealth.network.manage";
      if (!actor || !hasPermission(actor, permission)) return { ok: false, error: `You do not have permission to ${permission === "sabihealth.verification.decide" ? "decide laboratory verification" : "change laboratory network status"}.` };
      const laboratory = get().laboratories.find((item) => item.id === id);
      if (!laboratory) return { ok: false, error: "Laboratory not found." };
      if (status === "VERIFIED") {
        const blockers = getVerificationBlockers(get().verificationDocuments, "Laboratory", id);
        if (blockers.length > 0) return { ok: false, error: `Cannot verify — outstanding documents: ${blockers.join(", ")}.` };
      }
      const now = new Date().toISOString();
      set((state) => ({ laboratories: state.laboratories.map((item) => item.id === id ? { ...item, status, updatedAt: now } : item) }));
      audit({ resourceType: "Laboratory", resourceId: id, action: `Set verification status to ${status}`, previousValue: laboratory.status, newValue: status, reason }, actorId);
      return { ok: true, id };
    },

    decideDocument: (documentId, status, reason, actorId) => {
      const actor = resolveActor(actorId);
      if (!actor || !hasPermission(actor, "sabihealth.verification.decide")) return { ok: false, error: "You do not have permission to decide verification documents." };
      const document = get().verificationDocuments.find((item) => item.id === documentId);
      if (!document) return { ok: false, error: "Document not found." };
      const now = new Date().toISOString();
      set((state) => ({ verificationDocuments: state.verificationDocuments.map((item) => item.id === documentId ? { ...item, status, reviewedBy: actor.id, reviewedAt: now, reason: reason || undefined, updatedAt: now } : item) }));
      audit({ resourceType: document.subjectType, resourceId: document.subjectId, action: `Set ${DOCUMENT_LABELS[document.documentType]} to ${status}`, previousValue: document.status, newValue: status, reason }, actorId);
      return { ok: true, id: documentId };
    },

    flagConsultationForRefund: (id, reason, actorId) => {
      const actor = resolveActor(actorId);
      if (!actor || !hasPermission(actor, "sabihealth.operations.manage")) return { ok: false, error: "You do not have permission to flag consultations for refund review." };
      const consultation = get().consultations.find((item) => item.id === id);
      if (!consultation) return { ok: false, error: "Consultation not found." };
      if (!reason.trim()) return { ok: false, error: "A reason is required to flag a consultation for refund review." };
      const now = new Date().toISOString();
      set((state) => ({ consultations: state.consultations.map((item) => item.id === id ? { ...item, refundFlagged: true, refundFlagReason: reason, updatedAt: now } : item) }));
      audit({ resourceType: "Consultation", resourceId: id, action: "Flagged consultation for refund review", newValue: { refundFlagged: true }, reason }, actorId);
      return { ok: true, id };
    },

    markConsultationReviewed: (id, note, actorId) => {
      const actor = resolveActor(actorId);
      if (!actor || !hasPermission(actor, "sabihealth.operations.manage")) return { ok: false, error: "You do not have permission to close out consultation reviews." };
      const consultation = get().consultations.find((item) => item.id === id);
      if (!consultation) return { ok: false, error: "Consultation not found." };
      const now = new Date().toISOString();
      set((state) => ({ consultations: state.consultations.map((item) => item.id === id ? { ...item, reviewedAt: now, reviewedBy: actor.id, reviewNote: note || undefined, updatedAt: now } : item) }));
      audit({ resourceType: "Consultation", resourceId: id, action: "Marked consultation as reviewed", reason: note }, actorId);
      return { ok: true, id };
    },

    cancelConsultation: (id, reason, actorId) => {
      const actor = resolveActor(actorId);
      if (!actor || !hasPermission(actor, "sabihealth.operations.manage")) return { ok: false, error: "You do not have permission to cancel a consultation." };
      const consultation = get().consultations.find((item) => item.id === id);
      if (!consultation) return { ok: false, error: "Consultation not found." };
      if (!STUCK_STATUSES.includes(consultation.status)) return { ok: false, error: `Cannot cancel a consultation that is already ${consultation.status.toLowerCase().replaceAll("_", " ")}.` };
      if (!reason.trim()) return { ok: false, error: "A reason is required to cancel a consultation." };
      const now = new Date().toISOString();
      set((state) => ({ consultations: state.consultations.map((item) => item.id === id ? { ...item, status: "CANCELLED", reviewedAt: now, reviewedBy: actor.id, reviewNote: reason, updatedAt: now } : item) }));
      audit({ resourceType: "Consultation", resourceId: id, action: "Cancelled stuck consultation", previousValue: consultation.status, newValue: "CANCELLED", reason }, actorId);
      return { ok: true, id };
    },

    cancelMedicationOrder: (id, reason, actorId) => {
      const actor = resolveActor(actorId);
      if (!actor || !hasPermission(actor, "sabihealth.operations.manage")) return { ok: false, error: "You do not have permission to cancel a medication order." };
      const order = get().medicationOrders.find((item) => item.id === id);
      if (!order) return { ok: false, error: "Order not found." };
      if (TERMINAL_ORDER_STATUSES.includes(order.status)) return { ok: false, error: `Cannot cancel an order that is already ${order.status.toLowerCase().replaceAll("_", " ")}.` };
      if (!reason.trim()) return { ok: false, error: "A reason is required to cancel an order." };
      const now = new Date().toISOString();
      set((state) => ({ medicationOrders: state.medicationOrders.map((item) => item.id === id ? { ...item, status: "CANCELLED", reviewedAt: now, reviewedBy: actor.id, reviewNote: reason, updatedAt: now } : item) }));
      audit({ resourceType: "MedicationOrder", resourceId: id, action: "Cancelled stalled order", previousValue: order.status, newValue: "CANCELLED", reason }, actorId);
      return { ok: true, id };
    },

    flagOrderForRefund: (id, reason, actorId) => {
      const actor = resolveActor(actorId);
      if (!actor || !hasPermission(actor, "sabihealth.operations.manage")) return { ok: false, error: "You do not have permission to flag orders for refund review." };
      const order = get().medicationOrders.find((item) => item.id === id);
      if (!order) return { ok: false, error: "Order not found." };
      if (UNPAID_ORDER_STATUSES.includes(order.status)) return { ok: false, error: "Cannot flag for refund — no payment has been collected on this order yet." };
      if (!reason.trim()) return { ok: false, error: "A reason is required to flag an order for refund review." };
      const now = new Date().toISOString();
      set((state) => ({ medicationOrders: state.medicationOrders.map((item) => item.id === id ? { ...item, refundFlagged: true, refundFlagReason: reason, updatedAt: now } : item) }));
      audit({ resourceType: "MedicationOrder", resourceId: id, action: "Flagged order for refund review", newValue: { refundFlagged: true }, reason }, actorId);
      return { ok: true, id };
    },

    markOrderReviewed: (id, note, actorId) => {
      const actor = resolveActor(actorId);
      if (!actor || !hasPermission(actor, "sabihealth.operations.manage")) return { ok: false, error: "You do not have permission to close out order reviews." };
      const order = get().medicationOrders.find((item) => item.id === id);
      if (!order) return { ok: false, error: "Order not found." };
      const now = new Date().toISOString();
      set((state) => ({ medicationOrders: state.medicationOrders.map((item) => item.id === id ? { ...item, reviewedAt: now, reviewedBy: actor.id, reviewNote: note || undefined, updatedAt: now } : item) }));
      audit({ resourceType: "MedicationOrder", resourceId: id, action: "Marked order as reviewed", reason: note }, actorId);
      return { ok: true, id };
    },

    setPrescriptionStatus: (id, status, reason, actorId) => {
      const actor = resolveActor(actorId);
      if (!actor || !hasPermission(actor, "sabihealth.operations.manage")) return { ok: false, error: "You do not have permission to change prescription status." };
      const prescription = get().prescriptions.find((item) => item.id === id);
      if (!prescription) return { ok: false, error: "Prescription not found." };
      if (status !== "EXPIRED" && status !== "CANCELLED") return { ok: false, error: "Command Center can only expire or cancel a stale prescription — fulfillment status is derived from orders." };
      if (!reason.trim()) return { ok: false, error: "A reason is required to change prescription status." };
      const now = new Date().toISOString();
      set((state) => ({ prescriptions: state.prescriptions.map((item) => item.id === id ? { ...item, status, updatedAt: now } : item) }));
      audit({ resourceType: "Prescription", resourceId: id, action: `Set prescription status to ${status}`, previousValue: prescription.status, newValue: status, reason }, actorId);
      return { ok: true, id };
    },

    // PHASE 7 — PAYMENTS. Command Center has no payment gateway connected, so it can never
    // process a refund itself. These two mutations only let finance record that a refund was
    // completed through an external channel (the payment processor's own dashboard) — the
    // external reference is mandatory precisely so this stays an honest log entry, never a
    // one-click fake success. Gated by sabihealth.billing.manage, not sabihealth.operations.manage,
    // since resolving a flagged refund is a finance decision distinct from the ops team that raised it.
    recordConsultationRefund: (id, externalReference, actorId) => {
      const actor = resolveActor(actorId);
      if (!actor || !hasPermission(actor, "sabihealth.billing.manage")) return { ok: false, error: "You do not have permission to record a refund as processed." };
      const consultation = get().consultations.find((item) => item.id === id);
      if (!consultation) return { ok: false, error: "Consultation not found." };
      if (!consultation.refundFlagged) return { ok: false, error: "This consultation has not been flagged for refund review." };
      if (consultation.paymentStatus === "REFUNDED") return { ok: false, error: "This consultation has already been refunded." };
      if (!externalReference.trim()) return { ok: false, error: "Record how the refund was processed externally (e.g. the payment processor's reference) before closing this out." };
      const now = new Date().toISOString();
      set((state) => ({ consultations: state.consultations.map((item) => item.id === id ? { ...item, paymentStatus: "REFUNDED", reviewedAt: item.reviewedAt ?? now, reviewedBy: item.reviewedBy ?? actor.id, updatedAt: now } : item) }));
      audit({ resourceType: "Consultation", resourceId: id, action: "Recorded refund processed externally", previousValue: consultation.paymentStatus, newValue: "REFUNDED", reason: externalReference }, actorId);
      return { ok: true, id };
    },

    recordOrderRefund: (id, externalReference, actorId) => {
      const actor = resolveActor(actorId);
      if (!actor || !hasPermission(actor, "sabihealth.billing.manage")) return { ok: false, error: "You do not have permission to record a refund as processed." };
      const order = get().medicationOrders.find((item) => item.id === id);
      if (!order) return { ok: false, error: "Order not found." };
      if (!order.refundFlagged) return { ok: false, error: "This order has not been flagged for refund review." };
      if (order.status === "REFUNDED") return { ok: false, error: "This order has already been refunded." };
      if (!externalReference.trim()) return { ok: false, error: "Record how the refund was processed externally (e.g. the payment processor's reference) before closing this out." };
      const now = new Date().toISOString();
      set((state) => ({ medicationOrders: state.medicationOrders.map((item) => item.id === id ? { ...item, status: "REFUNDED", reviewedAt: item.reviewedAt ?? now, reviewedBy: item.reviewedBy ?? actor.id, updatedAt: now } : item) }));
      audit({ resourceType: "MedicationOrder", resourceId: id, action: "Recorded refund processed externally", previousValue: order.status, newValue: "REFUNDED", reason: externalReference }, actorId);
      return { ok: true, id };
    },
  };
});
