export type TenantSetupStatus =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "READY_FOR_REVIEW"
  | "CHANGES_REQUESTED"
  | "APPROVED"
  | "LIVE";

export type TenantSetupStepKey =
  | "ORGANIZATION"
  | "SUBSCRIPTION"
  | "DEPARTMENTS"
  | "SERVICES"
  | "STAFF"
  | "PATIENT_IMPORT"
  | "BILLING"
  | "PHARMACY"
  | "LABORATORY"
  | "BRANDING"
  | "TRAINING"
  | "GO_LIVE_REVIEW";

export type TenantSetupStepStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CHANGES_REQUESTED";

export type TenantSetupStep = {
  key: TenantSetupStepKey;
  label: string;
  description: string;
  status: TenantSetupStepStatus;
  required: boolean;
  moduleKey?: string;
  completedAt?: string;
};

export type SetupDepartment = { id: string; name: string; code: string };

export type TenantSetupConfiguration = {
  organization: {
    displayName: string;
    facilityCode: string;
    timezone: string;
    locale: string;
  };
  departments: SetupDepartment[];
  services: string[];
  staff: { invitationMode: "INDIVIDUAL" | "CSV" | "LATER"; expectedUsers: number };
  patientImport: { approach: "NO_EXISTING_RECORDS" | "TEMPLATE_READY" | "ASSISTED_MIGRATION" | "LATER" };
  billing: { currency: string; receiptPrefix: string; taxMode: "NO_TAX" | "CONFIGURE_LATER" | "STANDARD" };
  pharmacy: { stockMethod: "FEFO" | "FIFO"; prescriptionApproval: boolean };
  laboratory: { resultApprovalRole: "Lab Scientist" | "Pathologist" | "Authorized Reviewer"; requireSecondReview: boolean };
  branding: { organizationDisplayName: string; productDisplayName: string; primaryColor: string };
  training: { ownerName: string; pathway: "SELF_GUIDED" | "REMOTE" | "ONSITE"; acknowledged: boolean };
};

export type TenantReadinessCheck = {
  key: string;
  label: string;
  status: "PASS" | "FAIL";
  detail: string;
};

export type TenantSetupEvent = {
  id: string;
  action: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  timestamp: string;
  reason?: string;
};

export type TenantSetupRecord = {
  id: string;
  organizationId: string;
  applicationId: string;
  provisioningJobId: string;
  status: TenantSetupStatus;
  activeStep: TenantSetupStepKey;
  steps: TenantSetupStep[];
  moduleIds: string[];
  productIds: string[];
  configuration: TenantSetupConfiguration;
  readinessChecks: TenantReadinessCheck[];
  reviewNotes?: string;
  submittedAt?: string;
  approvedAt?: string;
  activatedAt?: string;
  createdAt: string;
  updatedAt: string;
  events: TenantSetupEvent[];
};

export type SetupActor = { id: string; name: string; role: string };
export type SetupActionResult = { ok: true } | { ok: false; error: string };
