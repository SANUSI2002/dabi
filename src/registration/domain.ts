import type { BillingCycle } from "@/command-center/domain";
import type { ProductKey } from "@/platform/entitlements";
import type { FacilityRegistrationStatus } from "@/compliance/domain";

export type ApplicationStatus =
  | "DRAFT"
  | "AWAITING_EMAIL"
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "NEEDS_INFORMATION"
  | "APPROVED"
  | "REJECTED"
  | "WITHDRAWN";

export type ApplicationStep = "account" | "organization" | "corporate" | "regulation" | "officer" | "facility" | "documents" | "products" | "plan" | "review";

export type VerificationState = "NOT_STARTED" | "PENDING" | "MANUAL_REVIEW" | "VERIFIED" | "FAILED" | "EXPIRED";

export const APPLICATION_STEPS: { key: ApplicationStep; label: string; shortLabel: string }[] = [
  { key: "account", label: "Account owner", shortLabel: "Account" },
  { key: "organization", label: "Organization", shortLabel: "Organization" },
  { key: "corporate", label: "Corporate identity", shortLabel: "Corporate" },
  { key: "regulation", label: "Facility regulation", shortLabel: "Regulation" },
  { key: "officer", label: "Operating officer", shortLabel: "Officer" },
  { key: "facility", label: "Facility profile", shortLabel: "Facility" },
  { key: "documents", label: "Documents", shortLabel: "Documents" },
  { key: "products", label: "Products", shortLabel: "Products" },
  { key: "plan", label: "Plan", shortLabel: "Plan" },
  { key: "review", label: "Review & submit", shortLabel: "Review" },
];

export const FACILITY_TYPES = [
  "Private Hospital", "Public Hospital", "Clinic", "Primary Health Centre", "Maternity Centre",
  "Diagnostic Centre", "Medical Laboratory", "Dental Hospital / Clinic", "Eye Hospital / Clinic",
  "Physiotherapy Clinic", "Dialysis Centre", "Nursing / Convalescent Home", "Home Care Service",
  "Mobile Clinic", "Hospital Group", "Other Healthcare Facility",
] as const;

export const OWNERSHIP_TYPES = ["Private", "Public", "Faith-based", "Non-profit", "Corporate group", "Other"] as const;

export type OrganizationApplication = {
  id: string;
  reference: string;
  status: ApplicationStatus;
  currentStep: ApplicationStep;
  completedSteps: ApplicationStep[];
  owner: {
    firstName: string;
    middleName: string;
    lastName: string;
    workEmail: string;
    phone: string;
    country: string;
    termsAccepted: boolean;
    privacyAccepted: boolean;
    marketingConsent: boolean;
    emailVerification: VerificationState;
  };
  organization: {
    legalName: string;
    tradingName: string;
    facilityType: string;
    ownershipType: string;
    country: string;
    state: string;
    lga: string;
    city: string;
    address: string;
    website: string;
    officialEmail: string;
    officialPhone: string;
  };
  corporate: {
    registrationNumber: string;
    registeredLegalName: string;
    registrationType: string;
    taxIdentificationNumber: string;
    incorporationDate: string;
  };
  regulatoryRegistration: {
    registrationStatus: FacilityRegistrationStatus;
    regulatorId: string;
    registrationNumber: string;
    dateIssued: string;
    expiryDate: string;
    currentStatus: string;
    facilityCategory: string;
  };
  operatingOfficer: {
    fullName: string;
    role: string;
    profession: string;
    regulatorId: string;
    registrationNumber: string;
    practisingLicenceNumber: string;
    licenceExpiryDate: string;
    email: string;
    phone: string;
  };
  facility: {
    facilities: number;
    branches: number;
    beds: number;
    staff: number;
    doctors: number;
    nurses: number;
    monthlyPatients: number;
    openingHours: string;
    services: string[];
  };
  selectedProducts: ProductKey[];
  packageId: string;
  billingCycle: BillingCycle;
  verification: {
    corporate: VerificationState;
    facility: VerificationState;
    operatingOfficer: VerificationState;
  };
  createdAt: string;
  updatedAt: string;
  submittedAt?: string;
  serverApplicationId?: string;
};

export type ApplicantDraftRepository = {
  list(): OrganizationApplication[];
  save(application: OrganizationApplication): void;
  remove(applicationId: string): void;
};

export function createBlankApplication(): OrganizationApplication {
  const now = new Date().toISOString();
  const id = `app_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  return {
    id,
    reference: `SABI-ORG-${new Date().getFullYear()}-${id.slice(-5).toUpperCase()}`,
    status: "DRAFT",
    currentStep: "account",
    completedSteps: [],
    owner: { firstName: "", middleName: "", lastName: "", workEmail: "", phone: "", country: "Nigeria", termsAccepted: false, privacyAccepted: false, marketingConsent: false, emailVerification: "NOT_STARTED" },
    organization: { legalName: "", tradingName: "", facilityType: "Private Hospital", ownershipType: "Private", country: "Nigeria", state: "Lagos", lga: "", city: "", address: "", website: "", officialEmail: "", officialPhone: "" },
    corporate: { registrationNumber: "", registeredLegalName: "", registrationType: "Company", taxIdentificationNumber: "", incorporationDate: "" },
    regulatoryRegistration: { registrationStatus: "EXISTING", regulatorId: "reg-hefamaa", registrationNumber: "", dateIssued: "", expiryDate: "", currentStatus: "Active", facilityCategory: "" },
    operatingOfficer: { fullName: "", role: "Medical Director", profession: "Medical Practitioner", regulatorId: "reg-mdcn", registrationNumber: "", practisingLicenceNumber: "", licenceExpiryDate: "", email: "", phone: "" },
    facility: { facilities: 1, branches: 0, beds: 0, staff: 0, doctors: 0, nurses: 0, monthlyPatients: 0, openingHours: "08:00 – 18:00", services: [] },
    selectedProducts: ["emr"],
    packageId: "pkg-standard",
    billingCycle: "Monthly",
    verification: { corporate: "NOT_STARTED", facility: "NOT_STARTED", operatingOfficer: "NOT_STARTED" },
    createdAt: now,
    updatedAt: now,
  };
}
