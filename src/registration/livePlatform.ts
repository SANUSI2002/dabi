import { liveApiRequest } from '@/identity/liveIdentity';
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
export const liveVerifyApplication = (id: string, token: string) => liveApiRequest<{ data: LiveApplicationSummary }>(`/api/v1/applications/${encodeURIComponent(id)}/verify`, { method: 'POST', body: JSON.stringify({ token }) });
export const livePlatformApplications = (status = 'SUBMITTED', page = 1) => liveApiRequest<{ data: { items: LivePlatformApplication[]; nextPage: number | null } }>(`/api/v1/platform/applications?status=${encodeURIComponent(status)}&page=${page}`);
export const livePlatformApplicationDetail = (id: string) => liveApiRequest<{ data: LivePlatformApplicationDetail }>(`/api/v1/platform/applications/${encodeURIComponent(id)}`);
export const liveStartApplicationReview = (id: string) => liveApiRequest<{ data: LivePlatformApplicationDetail }>(`/api/v1/platform/applications/${encodeURIComponent(id)}/start-review`, { method: 'POST', body: '{}' });
