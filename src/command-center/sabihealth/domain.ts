// Sabi Health domain — the consumer/provider network half of the ecosystem, modeled the same
// way as the Sabi OS domain in ../domain.ts (AuditedEntity, Id, ISODate reused from there).
//
// This is Command Center's OWN model of Sabi Health operations — not a live read of the
// separate patient-portal application's local state. There is no shared backend yet, so the
// patient-portal app (apps/telemedicine) and this domain are both independently backend-ready
// for the same future API, not connected to each other today. See PROVIDER SOURCING /
// ProviderOrganizationLink below for how a Sabi OS hospital optionally joins this network.
import type { AuditedEntity, Id, ISODate } from "../domain";

export type PatientAccountStatus = "Active" | "Suspended" | "Deactivated";
export type PatientVerificationStatus = "Unverified" | "Pending" | "Verified";

export type PatientProfile = AuditedEntity & {
  sabiHealthId: string; name: string; email: string; phone: string; country: string;
  accountStatus: PatientAccountStatus; verificationStatus: PatientVerificationStatus;
  joinedAt: ISODate; lastActivityAt?: ISODate;
  consultationCount: number; activeOrderCount: number;
};

export type DoctorApplicationStatus =
  | "APPLICATION_STARTED" | "APPLICATION_SUBMITTED" | "UNDER_REVIEW"
  | "VERIFIED" | "ACTIVE" | "SUSPENDED" | "REJECTED" | "EXPIRED_CREDENTIAL";

export type DoctorEmploymentType = "INDEPENDENT" | "ORGANIZATION_AFFILIATED" | "BOTH";

export type DoctorProfile = AuditedEntity & {
  name: string; specialty: string; country: string; city: string;
  medicalRegistrationNumber: string;
  status: DoctorApplicationStatus;
  employmentType: DoctorEmploymentType;
  organizationId?: Id; // Sabi OS Organization, when ORGANIZATION_AFFILIATED or BOTH
  completedConsultations: number;
  joinedAt: ISODate; lastActivityAt?: ISODate;
  licenseExpiresAt?: ISODate;
};

export type NetworkVerificationStatus = "APPLICATION" | "PENDING_VERIFICATION" | "VERIFIED" | "ACTIVE" | "SUSPENDED" | "REJECTED";

export type PharmacyProfile = AuditedEntity & {
  businessName: string; legalEntity: string; country: string; city: string;
  licenseNumber: string; licenseExpiresAt?: ISODate;
  status: NetworkVerificationStatus;
  coverageRadiusKm: number;
  activeOrderCount: number; fulfilledOrderCount: number;
  joinedAt: ISODate;
};

export type LaboratoryProfile = AuditedEntity & {
  name: string; legalEntity: string; country: string; city: string;
  licenseNumber: string; licenseExpiresAt?: ISODate;
  status: NetworkVerificationStatus;
  services: string[];
  joinedAt: ISODate;
};

export type ConsultationStatus =
  | "REQUESTED" | "SCHEDULED" | "WAITING" | "IN_PROGRESS"
  | "COMPLETED" | "CANCELLED" | "NO_SHOW" | "TECHNICAL_FAILURE" | "DISPUTED";
export type ConsultationType = "VIDEO" | "VOICE" | "CHAT";
export type ConsultationPaymentStatus = "PENDING" | "PAID" | "REFUNDED" | "FAILED";

export type Consultation = AuditedEntity & {
  patientId: Id; doctorId: Id;
  type: ConsultationType;
  scheduledFor: ISODate;
  startedAt?: ISODate; completedAt?: ISODate;
  status: ConsultationStatus;
  paymentStatus: ConsultationPaymentStatus;
  fee: number; currency: string;
  prescriptionIssued: boolean;
  /** PHASE 5 — TELEMEDICINE OPERATIONS. Command Center can flag a failed/disputed consultation
   *  for the payments team, but it never processes the refund itself — no payment gateway is
   *  connected yet (that's Phase 7). This is the honest hand-off point between the two. */
  refundFlagged?: boolean; refundFlagReason?: string;
  reviewedAt?: ISODate; reviewedBy?: Id; reviewNote?: string;
};

export type PrescriptionStatus = "ACTIVE" | "PARTIALLY_FILLED" | "FULFILLED" | "EXPIRED" | "CANCELLED";

export type Prescription = AuditedEntity & {
  patientId: Id; doctorId: Id; consultationId?: Id;
  issuedAt: ISODate; medicationCount: number;
  status: PrescriptionStatus;
  quotationsRequested: number;
};

export type MedicationOrderStatus =
  | "DRAFT" | "AWAITING_PAYMENT" | "PAID" | "ACCEPTED" | "PREPARING"
  | "READY" | "DISPATCHED" | "READY_FOR_PICKUP" | "COMPLETED" | "CANCELLED" | "REFUNDED";

export type MedicationOrder = AuditedEntity & {
  prescriptionId: Id; patientId: Id; pharmacyId: Id;
  status: MedicationOrderStatus;
  total: number; currency: string;
  /** PHASE 6 — PRESCRIPTION & PHARMACY OPERATIONS. Same honest hand-off as Consultation's refund
   *  fields (see above): Command Center flags a stalled/paid order for the payments team, it
   *  never processes the refund itself. */
  refundFlagged?: boolean; refundFlagReason?: string;
  reviewedAt?: ISODate; reviewedBy?: Id; reviewNote?: string;
};

/** How a Sabi OS Organization optionally participates in the Sabi Health network — an explicit
 *  opt-in link, never an automatic merge of hospital identities (see TEST SCENARIO 4). */
export type ProviderOrganizationLink = {
  organizationId: Id; // Sabi OS Organization.id
  onSabiHealthNetwork: boolean;
  services: ("Online Booking" | "Telemedicine" | "Pharmacy" | "Laboratory" | "Hospital Profile")[];
  activatedAt?: ISODate;
};

/** Mirrors PlatformAuditEvent's shape (see ../domain.ts) but scoped to the Sabi Health network
 *  entities, which live in their own store — see useSabiHealth.ts. */
export type SabiHealthAuditEvent = {
  id: Id; timestamp: ISODate;
  actorId: Id; actorName: string; actorRole: string;
  resourceType: "Patient" | "Doctor" | "Pharmacy" | "Laboratory" | "Consultation" | "Prescription" | "MedicationOrder";
  resourceId: Id;
  action: string;
  previousValue?: unknown; newValue?: unknown;
  reason?: string;
};

/** PHASE 4 — VERIFICATION. A real, evidence-backed verification case per network provider —
 *  replaces a one-click status change with the document checklist the master directive specified
 *  ("gov ID, photo, medical reg, license, specialty credentials, certs, proof of address,
 *  bank/payout info"). Document bodies are not retained by this frontend (no backend/file store
 *  exists yet) — only the structured review decision, mirroring the same honest caveat already
 *  used by Sabi OS's compliance module (see @/compliance/domain's VerificationCase). */
export type VerificationSubjectType = "Doctor" | "Pharmacy" | "Laboratory";

export type VerificationDocumentType =
  | "GOVERNMENT_ID" | "PROFESSIONAL_PHOTO" | "MEDICAL_REGISTRATION" | "PRACTICE_LICENSE"
  | "SPECIALTY_CREDENTIAL" | "PROFESSIONAL_CERTIFICATE" | "PROOF_OF_ADDRESS" | "BANK_PAYOUT_DETAILS"
  | "BUSINESS_REGISTRATION" | "PHARMACY_LICENSE" | "LABORATORY_LICENSE" | "FACILITY_INSPECTION_REPORT";

export type VerificationDocumentStatus = "PENDING" | "VERIFIED" | "REJECTED" | "EXPIRED";

export type VerificationDocument = AuditedEntity & {
  subjectType: VerificationSubjectType;
  subjectId: Id;
  documentType: VerificationDocumentType;
  required: boolean;
  status: VerificationDocumentStatus;
  reviewedBy?: Id;
  reviewedAt?: ISODate;
  reason?: string;
};

export const REQUIRED_DOCUMENTS: Record<VerificationSubjectType, VerificationDocumentType[]> = {
  Doctor: ["GOVERNMENT_ID", "PROFESSIONAL_PHOTO", "MEDICAL_REGISTRATION", "PRACTICE_LICENSE", "SPECIALTY_CREDENTIAL", "PROFESSIONAL_CERTIFICATE", "PROOF_OF_ADDRESS", "BANK_PAYOUT_DETAILS"],
  Pharmacy: ["BUSINESS_REGISTRATION", "PHARMACY_LICENSE", "PROOF_OF_ADDRESS", "BANK_PAYOUT_DETAILS"],
  Laboratory: ["BUSINESS_REGISTRATION", "LABORATORY_LICENSE", "FACILITY_INSPECTION_REPORT", "PROOF_OF_ADDRESS", "BANK_PAYOUT_DETAILS"],
};

export const DOCUMENT_LABELS: Record<VerificationDocumentType, string> = {
  GOVERNMENT_ID: "Government-issued ID",
  PROFESSIONAL_PHOTO: "Professional photo",
  MEDICAL_REGISTRATION: "Medical registration certificate",
  PRACTICE_LICENSE: "Practice license",
  SPECIALTY_CREDENTIAL: "Specialty credential",
  PROFESSIONAL_CERTIFICATE: "Professional certificate",
  PROOF_OF_ADDRESS: "Proof of address",
  BANK_PAYOUT_DETAILS: "Bank / payout details",
  BUSINESS_REGISTRATION: "Business registration certificate",
  PHARMACY_LICENSE: "Pharmacy license",
  LABORATORY_LICENSE: "Laboratory license",
  FACILITY_INSPECTION_REPORT: "Facility inspection report",
};
