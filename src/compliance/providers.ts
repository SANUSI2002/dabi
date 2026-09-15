import type { VerificationResult } from "./domain";

export type CorporateVerificationInput = { registrationNumber: string; legalName: string; country: string };
export type FacilityVerificationInput = { licenceNumber: string; regulator: string; facilityName: string; jurisdiction: string };
export type ProfessionalVerificationInput = { registrationNumber: string; licenceNumber: string; regulator: string; fullName: string };

export interface CorporateVerificationProvider { verify(input: CorporateVerificationInput): Promise<VerificationResult>; }
export interface FacilityVerificationProvider { verify(input: FacilityVerificationInput): Promise<VerificationResult>; }
export interface ProfessionalVerificationProvider { verify(input: ProfessionalVerificationInput): Promise<VerificationResult>; }
export interface DocumentVerificationProvider { requestReview(applicationId: string, requirementIds: string[]): Promise<VerificationResult>; }

const manualReview = (provider: string, message: string): Promise<VerificationResult> => Promise.resolve({ status: "MANUAL_REVIEW", message, checkedAt: new Date().toISOString(), provider });

export const corporateVerificationProvider: CorporateVerificationProvider = {
  verify: (input) => manualReview("Local corporate-verification adapter", `No authoritative registry connection is configured. ${input.registrationNumber} requires manual review against ${input.legalName}.`),
};
export const facilityVerificationProvider: FacilityVerificationProvider = {
  verify: (input) => manualReview("Local facility-verification adapter", `No authoritative ${input.regulator || "facility regulator"} connection is configured. ${input.licenceNumber} requires manual review.`),
};
export const professionalVerificationProvider: ProfessionalVerificationProvider = {
  verify: (input) => manualReview("Local professional-verification adapter", `No authoritative ${input.regulator || "professional regulator"} connection is configured. The credentials for ${input.fullName} require manual review.`),
};
export const documentVerificationProvider: DocumentVerificationProvider = {
  requestReview: (_applicationId, requirementIds) => manualReview("Local document-verification adapter", `${requirementIds.length} staged document${requirementIds.length === 1 ? "" : "s"} require secure upload, malware scanning and reviewer assessment.`),
};
