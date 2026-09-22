// Development-only seed data for Sabi Health, gated the same way as every other seed array in
// this app (src/config/runtime.ts). Real deployments start empty until a backend is connected —
// see useSabiHealth.ts.
import type {
  Consultation, DoctorProfile, LaboratoryProfile, MedicationOrder, PatientProfile,
  PharmacyProfile, Prescription, ProviderOrganizationLink, VerificationDocument,
  VerificationDocumentStatus, VerificationSubjectType,
} from "./domain";
import { REQUIRED_DOCUMENTS } from "./domain";

const iso = (daysAgo: number) => new Date(Date.now() - daysAgo * 86_400_000).toISOString();

export const seedPatients: PatientProfile[] = [
  { id: "pat_1", sabiHealthId: "SH-PT-0001", name: "Ngozi Adeyemi", email: "ngozi.a@example.com", phone: "+234 803 111 2222", country: "Nigeria", accountStatus: "Active", verificationStatus: "Verified", joinedAt: iso(210), lastActivityAt: iso(1), consultationCount: 6, activeOrderCount: 1, createdAt: iso(210), updatedAt: iso(1), createdBy: "system" },
  { id: "pat_2", sabiHealthId: "SH-PT-0002", name: "Emeka Nwachukwu", email: "emeka.n@example.com", phone: "+234 802 333 4444", country: "Nigeria", accountStatus: "Active", verificationStatus: "Verified", joinedAt: iso(150), lastActivityAt: iso(3), consultationCount: 2, activeOrderCount: 0, createdAt: iso(150), updatedAt: iso(3), createdBy: "system" },
  { id: "pat_3", sabiHealthId: "SH-PT-0003", name: "Zainab Bello", email: "zainab.b@example.com", phone: "+234 809 555 6666", country: "Nigeria", accountStatus: "Suspended", verificationStatus: "Pending", joinedAt: iso(40), lastActivityAt: iso(20), consultationCount: 0, activeOrderCount: 0, createdAt: iso(40), updatedAt: iso(20), createdBy: "system" },
];

export const seedDoctors: DoctorProfile[] = [
  { id: "doc_1", name: "Dr. Adaeze Okonjo", specialty: "Family Medicine", country: "Nigeria", city: "Lagos", medicalRegistrationNumber: "MDCN/78421", status: "ACTIVE", employmentType: "BOTH", organizationId: undefined, completedConsultations: 118, joinedAt: iso(300), lastActivityAt: iso(1), createdAt: iso(300), updatedAt: iso(1), createdBy: "system" },
  { id: "doc_2", name: "Dr. Ifeoma Chukwu", specialty: "Pediatrics", country: "Nigeria", city: "Abuja", medicalRegistrationNumber: "MDCN/65310", status: "UNDER_REVIEW", employmentType: "INDEPENDENT", completedConsultations: 0, joinedAt: iso(5), createdAt: iso(5), updatedAt: iso(5), createdBy: "system" },
  { id: "doc_3", name: "Dr. Tunde Bakare", specialty: "Internal Medicine", country: "Nigeria", city: "Ibadan", medicalRegistrationNumber: "MDCN/71922", status: "ACTIVE", employmentType: "INDEPENDENT", completedConsultations: 64, joinedAt: iso(180), lastActivityAt: iso(2), createdAt: iso(180), updatedAt: iso(2), createdBy: "system" },
];

export const seedPharmacies: PharmacyProfile[] = [
  { id: "phm_1", businessName: "Sabi Premium Pharmacy", legalEntity: "Sabi Premium Pharmacy Ltd", country: "Nigeria", city: "Lagos", licenseNumber: "PCN-11029", licenseExpiresAt: iso(-200), status: "ACTIVE", coverageRadiusKm: 8, activeOrderCount: 3, fulfilledOrderCount: 212, joinedAt: iso(260), createdAt: iso(260), updatedAt: iso(1), createdBy: "system" },
  { id: "phm_2", businessName: "City Care Meds", legalEntity: "City Care Meds Ltd", country: "Nigeria", city: "Lagos", licenseNumber: "PCN-11844", licenseExpiresAt: iso(-30), status: "PENDING_VERIFICATION", coverageRadiusKm: 5, activeOrderCount: 0, fulfilledOrderCount: 0, joinedAt: iso(4), createdAt: iso(4), updatedAt: iso(4), createdBy: "system" },
];

export const seedLaboratories: LaboratoryProfile[] = [
  { id: "lab_1", name: "Metropolitan Diagnostics", legalEntity: "Metropolitan Diagnostics Ltd", country: "Nigeria", city: "Lagos", licenseNumber: "MLSCN-3391", licenseExpiresAt: iso(-400), status: "ACTIVE", services: ["Blood Chemistry", "Microbiology", "Imaging"], joinedAt: iso(240), createdAt: iso(240), updatedAt: iso(1), createdBy: "system" },
];

export const seedConsultations: Consultation[] = [
  { id: "con_1", patientId: "pat_1", doctorId: "doc_1", type: "VIDEO", scheduledFor: iso(1), startedAt: iso(1), completedAt: iso(1), status: "COMPLETED", paymentStatus: "PAID", fee: 10_000, currency: "NGN", prescriptionIssued: true, createdAt: iso(1), updatedAt: iso(1), createdBy: "system" },
  { id: "con_2", patientId: "pat_2", doctorId: "doc_3", type: "VOICE", scheduledFor: iso(-0.1), status: "SCHEDULED", paymentStatus: "PENDING", fee: 6_000, currency: "NGN", prescriptionIssued: false, createdAt: iso(2), updatedAt: iso(2), createdBy: "system" },
  { id: "con_3", patientId: "pat_1", doctorId: "doc_3", type: "VIDEO", scheduledFor: iso(6), status: "TECHNICAL_FAILURE", paymentStatus: "REFUNDED", fee: 10_000, currency: "NGN", prescriptionIssued: false, createdAt: iso(6), updatedAt: iso(6), createdBy: "system" },
  { id: "con_4", patientId: "pat_2", doctorId: "doc_1", type: "VIDEO", scheduledFor: iso(3), startedAt: iso(3), completedAt: iso(3), status: "DISPUTED", paymentStatus: "PAID", fee: 12_000, currency: "NGN", prescriptionIssued: true, createdAt: iso(3), updatedAt: iso(3), createdBy: "system" },
  { id: "con_5", patientId: "pat_1", doctorId: "doc_1", type: "CHAT", scheduledFor: iso(2), status: "WAITING", paymentStatus: "PAID", fee: 3_500, currency: "NGN", prescriptionIssued: false, createdAt: iso(2), updatedAt: iso(2), createdBy: "system" },
  { id: "con_6", patientId: "pat_2", doctorId: "doc_3", type: "VOICE", scheduledFor: iso(4), status: "CANCELLED", paymentStatus: "FAILED", fee: 6_000, currency: "NGN", prescriptionIssued: false, createdAt: iso(4), updatedAt: iso(4), createdBy: "system" },
];

export const seedPrescriptions: Prescription[] = [
  { id: "rx_1", patientId: "pat_1", doctorId: "doc_1", consultationId: "con_1", issuedAt: iso(1), medicationCount: 2, status: "ACTIVE", quotationsRequested: 1, createdAt: iso(1), updatedAt: iso(1), createdBy: "system" },
  { id: "rx_2", patientId: "pat_2", doctorId: "doc_3", issuedAt: iso(21), medicationCount: 1, status: "ACTIVE", quotationsRequested: 3, createdAt: iso(21), updatedAt: iso(21), createdBy: "system" },
];

export const seedMedicationOrders: MedicationOrder[] = [
  { id: "ord_1", prescriptionId: "rx_1", patientId: "pat_1", pharmacyId: "phm_1", status: "PREPARING", total: 15_050, currency: "NGN", createdAt: iso(1), updatedAt: iso(0.2), createdBy: "system" },
  { id: "ord_2", prescriptionId: "rx_2", patientId: "pat_2", pharmacyId: "phm_1", status: "AWAITING_PAYMENT", total: 8_400, currency: "NGN", createdAt: iso(5), updatedAt: iso(5), createdBy: "system" },
  { id: "ord_3", prescriptionId: "rx_2", patientId: "pat_2", pharmacyId: "phm_1", status: "DISPATCHED", total: 22_300, currency: "NGN", createdAt: iso(8), updatedAt: iso(6), createdBy: "system" },
];

export const seedProviderOrganizationLinks: ProviderOrganizationLink[] = [];

let verificationDocumentSeq = 0;
function verificationDocs(subjectType: VerificationSubjectType, subjectId: string, statuses: VerificationDocumentStatus[], reviewer?: string): VerificationDocument[] {
  return REQUIRED_DOCUMENTS[subjectType].map((documentType, index) => {
    const status = statuses[index] ?? "PENDING";
    verificationDocumentSeq += 1;
    const reviewed = status === "VERIFIED" || status === "REJECTED";
    return {
      id: `shdoc_${verificationDocumentSeq}`, subjectType, subjectId, documentType, required: true, status,
      reviewedBy: reviewed ? reviewer : undefined, reviewedAt: reviewed ? iso(30) : undefined,
      reason: status === "REJECTED" ? "Document was illegible — requested a clearer scan." : undefined,
      createdAt: iso(60), updatedAt: reviewed ? iso(30) : iso(60), createdBy: "system",
    };
  });
}

// Fully verified network members (doc_1, doc_3, phm_1, lab_1) carry a clean historical checklist;
// the applicants still in the queue (doc_2, phm_2) carry realistic partial progress so the
// Verification Center has a genuine mixed case to review, not just empty or all-green states.
export const seedVerificationDocuments: VerificationDocument[] = [
  ...verificationDocs("Doctor", "doc_1", Array(8).fill("VERIFIED"), "pu_lara"),
  ...verificationDocs("Doctor", "doc_2", ["VERIFIED", "VERIFIED", "VERIFIED", "PENDING", "PENDING", "PENDING", "VERIFIED", "PENDING"], "pu_lara"),
  ...verificationDocs("Doctor", "doc_3", Array(8).fill("VERIFIED"), "pu_lara"),
  ...verificationDocs("Pharmacy", "phm_1", Array(4).fill("VERIFIED"), "pu_lara"),
  ...verificationDocs("Pharmacy", "phm_2", ["VERIFIED", "REJECTED", "PENDING", "PENDING"], "pu_lara"),
  ...verificationDocs("Laboratory", "lab_1", Array(5).fill("VERIFIED"), "pu_lara"),
];
