import { liveApiRequest } from '@/identity/liveIdentity';
import { apiBaseUrl } from '@/config/runtime';
import type { OrganizationApplication } from './domain';

export type LivePackageVersion = { id: string; version: number; currency: string; monthlyPriceMinor: number; annualPriceMinor: number; moduleKeys: string[]; status: 'DRAFT' | 'PUBLISHED' | 'RETIRED'; publishedAt: string | null };
export type LivePackage = { id: string; code: string; name: string; description: string; recommended: boolean; active: boolean; branchLimit: number; storageLimitGb: number; supportLevel: string; publishedVersion: number | null; versions: LivePackageVersion[] };
export type LiveApplicationSummary = { id: string; reference: string; status: string; createdAt: string; submittedAt: string | null };
export type LivePlatformApplication = LiveApplicationSummary & { organizationName: string; packageId: string; packageVersionId: string };
export type LivePlatformApplicationDetail = LivePlatformApplication & {
  emailVerifiedAt: string | null;
  billingCycle: 'Monthly' | 'Annual';
  details: {
    owner: { firstName: string; lastName: string; workEmail: string; phone: string };
    organization: OrganizationApplication['organization'];
    corporate: OrganizationApplication['corporate'];
    regulatoryRegistration: OrganizationApplication['regulatoryRegistration'];
    operatingOfficer: OrganizationApplication['operatingOfficer'];
    facility: OrganizationApplication['facility'];
    selectedProducts: OrganizationApplication['selectedProducts'];
  };
};
export type LiveApprovalReadiness = { ready: boolean; requiredEvidence: string[]; blockers: string[] };
export type LiveReviewNote = { id: string; reviewerId: string; note: string; createdAt: string };
export type LiveEvidence = { id: string; requirementKey: string; fileName: string; contentType: string; sizeBytes: number; sha256: string; scanStatus: string; reviewStatus: string; createdAt: string };
export type LiveEvidenceList = { requiredEvidence: string[] | null; items: LiveEvidence[] };

export const livePublicPackages = () => liveApiRequest<{ data: { items: LivePackage[] } }>('/api/v1/catalog/packages');
export const livePlatformPackages = () => liveApiRequest<{ data: { items: LivePackage[] } }>('/api/v1/platform/packages');
export const liveCreatePackage = (payload: { code: string; name: string; description: string; recommended: boolean; branchLimit: number; storageLimitGb: number; supportLevel: string; version: { monthlyPriceMinor: number; annualPriceMinor: number; currency: 'NGN'; moduleKeys: string[] } }) => liveApiRequest<{ data: LivePackage }>('/api/v1/platform/packages', { method: 'POST', body: JSON.stringify(payload) });
export const liveCreatePackageVersion = (packageId: string, payload: { monthlyPriceMinor: number; annualPriceMinor: number; currency: 'NGN'; moduleKeys: string[] }) => liveApiRequest<{ data: LivePackageVersion }>(`/api/v1/platform/packages/${encodeURIComponent(packageId)}/versions`, { method: 'POST', body: JSON.stringify(payload) });
export const livePublishPackageVersion = (packageId: string, versionId: string) => liveApiRequest<{ data: { packageId: string; publishedVersion: number } }>(`/api/v1/platform/packages/${encodeURIComponent(packageId)}/versions/${encodeURIComponent(versionId)}/publish`, { method: 'POST', body: '{}' });

export const liveSubmitApplication = (application: OrganizationApplication) => {
  const { owner, organization, corporate, regulatoryRegistration, operatingOfficer, facility } = application;
  return liveApiRequest<{ data: LiveApplicationSummary }>('/api/v1/applications', { method: 'POST', body: JSON.stringify({
    clientDraftId: application.id,
    owner: { firstName: owner.firstName, lastName: owner.lastName, workEmail: owner.workEmail, phone: owner.phone, termsAccepted: owner.termsAccepted, privacyAccepted: owner.privacyAccepted },
    organization, corporate, regulatoryRegistration, operatingOfficer, facility,
    selectedProducts: application.selectedProducts, packageId: application.packageId, billingCycle: application.billingCycle,
  }) });
};
export const liveVerifyApplication = (id: string, token: string) => liveApiRequest<{ data: LiveApplicationSummary & { evidenceAccessToken?: string } }>(`/api/v1/applications/${encodeURIComponent(id)}/verify`, { method: 'POST', body: JSON.stringify({ token }) });
export const liveRequestEvidenceAccess = (id: string, email: string) => liveApiRequest<{ message: string }>(`/api/v1/applications/${encodeURIComponent(id)}/evidence-access`, { method: 'POST', body: JSON.stringify({ email }) });
export const liveApplicantEvidence = (id: string, token: string) => liveApiRequest<{ data: LiveEvidenceList }>(`/api/v1/applications/${encodeURIComponent(id)}/evidence`, { headers: { 'X-Sabi-Evidence-Token': token } });
export async function liveUploadApplicantEvidence(id: string, key: string, token: string, file: File): Promise<{ data: LiveEvidence }> {
  if (!apiBaseUrl) throw new Error('Sabi API is not configured.');
  if (!['application/pdf', 'image/jpeg', 'image/png'].includes(file.type) || file.size === 0 || file.size > 10 * 1024 * 1024) throw new Error('Select a PDF, JPEG, or PNG file no larger than 10 MB.');
  const response = await fetch(`${apiBaseUrl}/api/v1/applications/${encodeURIComponent(id)}/evidence/${encodeURIComponent(key)}`, {
    method: 'PUT', credentials: 'include', headers: { 'Content-Type': file.type, 'X-Sabi-Client': 'browser', 'X-Sabi-Evidence-Token': token }, body: file,
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error?.message || body.message || 'The document could not be uploaded.');
  return body as { data: LiveEvidence };
}
export const livePlatformEvidence = (id: string) => liveApiRequest<{ data: { items: LiveEvidence[]; previewAvailable: boolean } }>(`/api/v1/platform/applications/${encodeURIComponent(id)}/evidence`);
export const liveEvidencePreview = (applicationId: string, evidenceId: string) => liveApiRequest<{ data: { url: string; expiresInSeconds: number } }>(`/api/v1/platform/applications/${encodeURIComponent(applicationId)}/evidence/${encodeURIComponent(evidenceId)}/preview`);
export const liveReviewEvidence = (applicationId: string, evidenceId: string, decision: { decision: 'VERIFIED'; sourceName: string; reference: string; note?: string } | { decision: 'REJECTED'; note: string }) => liveApiRequest<{ data: { id: string; reviewStatus: string; reviewedAt: string } }>(`/api/v1/platform/applications/${encodeURIComponent(applicationId)}/evidence/${encodeURIComponent(evidenceId)}/review`, { method: 'POST', body: JSON.stringify(decision) });
export const livePlatformApplications = (status = 'SUBMITTED', page = 1) => liveApiRequest<{ data: { items: LivePlatformApplication[]; nextPage: number | null } }>(`/api/v1/platform/applications?status=${encodeURIComponent(status)}&page=${page}`);
export const livePlatformApplicationDetail = (id: string) => liveApiRequest<{ data: LivePlatformApplicationDetail }>(`/api/v1/platform/applications/${encodeURIComponent(id)}`);
export const liveApprovalReadiness = (id: string) => liveApiRequest<{ data: LiveApprovalReadiness }>(`/api/v1/platform/applications/${encodeURIComponent(id)}/approval-readiness`);
export const liveStartApplicationReview = (id: string) => liveApiRequest<{ data: LivePlatformApplicationDetail }>(`/api/v1/platform/applications/${encodeURIComponent(id)}/start-review`, { method: 'POST', body: '{}' });
export const liveReviewNotes = (id: string) => liveApiRequest<{ data: { items: LiveReviewNote[] } }>(`/api/v1/platform/applications/${encodeURIComponent(id)}/review-notes`);
export const liveAddReviewNote = (id: string, note: string) => liveApiRequest<{ data: LiveReviewNote }>(`/api/v1/platform/applications/${encodeURIComponent(id)}/review-notes`, { method: 'POST', body: JSON.stringify({ note }) });
