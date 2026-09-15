import type { VerificationState } from "@/registration/domain";

export type RequirementKind = "DOCUMENT" | "ATTESTATION";
export type FacilityRegistrationStatus = "NEW" | "EXISTING";

export type Jurisdiction = {
  id: string;
  country: string;
  state?: string;
  name: string;
  status: "ACTIVE" | "DRAFT";
};

export type Regulator = {
  id: string;
  jurisdictionId: string;
  name: string;
  shortName: string;
  scope: "CORPORATE" | "FACILITY" | "PROFESSIONAL";
  website?: string;
};

export type ComplianceRequirement = {
  id: string;
  code: string;
  label: string;
  description: string;
  kind: RequirementKind;
  required: boolean;
  regulatorId?: string;
  accepts?: string[];
  maximumSizeMb?: number;
  tracksExpiry?: boolean;
  appliesWhen?: {
    ownershipTypes?: string[];
    facilityTypes?: string[];
    registrationStatuses?: FacilityRegistrationStatus[];
    services?: string[];
  };
};

export type ComplianceRequirementSet = {
  id: string;
  name: string;
  jurisdictionId: string;
  facilityTypes: string[];
  requirementIds: string[];
  version: number;
  status: "ACTIVE" | "DRAFT" | "RETIRED";
  effectiveFrom: string;
  reviewNote: string;
};

export type ResolvedComplianceRequirements = {
  jurisdiction?: Jurisdiction;
  regulators: Regulator[];
  requirements: ComplianceRequirement[];
  requirementSets: ComplianceRequirementSet[];
  fallback: boolean;
};

export type VerificationResult = {
  status: Extract<VerificationState, "PENDING" | "MANUAL_REVIEW" | "FAILED">;
  message: string;
  checkedAt: string;
  provider: string;
};

export type StagedComplianceDocument = {
  id: string;
  applicationId: string;
  requirementId: string;
  filename: string;
  mimeType: string;
  size: number;
  status: "STAGED" | "FAILED";
  malwareScan: "NOT_RUN";
  stagedAt: string;
  error?: string;
};

export type ReviewRisk = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type VerificationCheckKind = "CORPORATE" | "FACILITY" | "OFFICER" | "DOCUMENT";
export type VerificationCheckStatus = "NOT_STARTED" | "UNDER_REVIEW" | "VERIFIED" | "FAILED" | "EXPIRED";

export type VerificationCheck = {
  id: string;
  kind: VerificationCheckKind;
  label: string;
  requirementId?: string;
  required: boolean;
  status: VerificationCheckStatus;
  evidenceAvailability: "APPLICATION_DATA" | "SESSION_ONLY";
  reason?: string;
  reviewedBy?: string;
  reviewedAt?: string;
};

export type ReviewNote = {
  id: string;
  visibility: "INTERNAL" | "APPLICANT";
  body: string;
  authorId: string;
  authorName: string;
  createdAt: string;
};

export type ApplicantResponse = {
  id: string;
  body: string;
  createdAt: string;
};

export type InformationRequest = {
  id: string;
  message: string;
  requestedItems: string[];
  status: "OPEN" | "RESPONDED" | "RESOLVED";
  requestedBy: string;
  requestedByName: string;
  requestedAt: string;
  responses: ApplicantResponse[];
  resolvedAt?: string;
  resolvedBy?: string;
};

export type VerificationAuditEvent = {
  id: string;
  action: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  timestamp: string;
  reason?: string;
  previousValue?: string;
  newValue?: string;
};

export type VerificationCase = {
  id: string;
  applicationId: string;
  status: "SUBMITTED" | "UNDER_REVIEW" | "NEEDS_INFORMATION" | "APPROVED" | "REJECTED";
  risk: ReviewRisk;
  riskFlags: string[];
  assigneeId?: string;
  checks: VerificationCheck[];
  notes: ReviewNote[];
  informationRequests: InformationRequest[];
  events: VerificationAuditEvent[];
  createdAt: string;
  updatedAt: string;
};
