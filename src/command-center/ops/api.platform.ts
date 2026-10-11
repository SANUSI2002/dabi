// Command Centre API client for the remaining Sabi Health products and platform administration.
import { ccGet, ccPost, qs, type Paged, type TimelineEvent } from './api';

// ---- Remaining Sabi Health products ------------------------------------------------------------
export type PersonRef = { id: string; patientId: string; name: string | null } | null;
export type PrescriptionRow = { id: string; reference: string; status: string; createdAt: string; issuedAt: string | null; cancelledAt: string | null; patient: PersonRef; doctor: { profileId: string; name: string | null; specialty: string | null }; items: number; pharmacyRequests: number; orders: { id: string; reference: string; status: string }[]; stage: string };
export type PrescriptionDetail = Omit<PrescriptionRow, 'items' | 'pharmacyRequests' | 'orders' | 'stage'> & {
  itemCount: number; contentNote: string; timeline: TimelineEvent[];
  requests: { id: string; pharmacy: { id: string; name: string }; status: string; requestedAt: string; quotes: { id: string; revision: number; status: string; expiresAt: string; createdAt: string; totalMinor: number; unavailableLines: number }[] }[];
  reservations: { id: string; status: string; expiresAt: string; createdAt: string; releasedAt: string | null; order: { id: string; reference: string; status: string; totalPayableMinor: number } | null }[];
};
export type PrescriptionItem = { id: string; medicationName: string; dosage: string; frequency: string; route: string; duration: string; quantity: number };
export const listPrescriptions = (p: Record<string, string | number | undefined>) => ccGet<Paged<PrescriptionRow>>(`/prescriptions${qs(p)}`);
export const getPrescription = (id: string) => ccGet<PrescriptionDetail>(`/prescriptions/${id}`);
export const openPrescriptionItems = (id: string, reason: string) => ccPost<{ items: PrescriptionItem[] }>(`/prescriptions/${id}/items`, { reason });

export type QuoteRequestRow = { id: string; status: string; requestedAt: string; pharmacy: { id: string; name: string }; patient: PersonRef; prescription: { id: string; reference: string }; quotes: number; firstQuoteMinutes: number | null; latestQuote: { status: string; expiresAt: string } | null };
export type HoldRow = { id: string; kind: string; status: string; createdAt: string; expiresAt: string; releasedAt: string | null; patient: PersonRef; order: { id: string; reference: string; status: string } | null; units: number; valueMinor: number; pharmacies: string[] };
export const listQuoteRequests = (p: Record<string, string | number | undefined>) => ccGet<Paged<QuoteRequestRow>>(`/marketplace/requests${qs(p)}`);
export const listHolds = (p: Record<string, string | number | undefined>) => ccGet<Paged<HoldRow> & { counts: Record<string, number> }>(`/marketplace/holds${qs(p)}`);

type Row = Record<string, unknown> & { id: string };
export const listWellness = (p: Record<string, string | number | undefined>) => ccGet<Paged<Row> & { counts: Record<string, number> }>(`/wellness${qs(p)}`);
export const listHospitals = (p: Record<string, string | number | undefined>) => ccGet<Paged<Row> & { counts: { enrollments: Record<string, number>; appointments: Record<string, number> } }>(`/hospitals${qs(p)}`);

export type TenantActivity = { patients: number; encounters30d: number; labOrders30d: number; invoices30d: number } | null;
export type EmrTenant = { organizationId: string; name: string; type: string; city?: string; status?: string; since: string; package: string | null; emrEnabled: boolean; goLive: string | null; activeMembers: number; activity: TenantActivity; deadWebhooks: number; apiSinceRestart: { requests: number; errors: number; rateLimited: number; avgMs: number } | null };
export const emrTenants = () => ccGet<{ generatedAt: string; note: string; items: EmrTenant[] }>('/emr/tenants');
export type Laboratory = { id: string; name: string; type: string; city: string; state: string; status: string; createdAt: string; decidedAt: string | null; organizationId: string | null; activeMembers: number; activity: TenantActivity };
export const laboratories = () => ccGet<{ generatedAt: string; items: Laboratory[] }>('/laboratories');
export type VerificationItem = { kind: string; id: string; title: string; subtitle: string; since: string | null; href: 'doctors' | 'pharmacies' | 'listings' | 'organizations' | 'onboarding' };
export const verificationQueue = () => ccGet<{ generatedAt: string; items: VerificationItem[]; draftWellnessOfferings: number; note: string }>('/verification');
export type WaitlistRow = { id: string; product: string; email: string | null; name: string | null; role: string; organisation: string | null; source: string | null; consentedAt: string; createdAt: string };
export const listWaitlist = (p: Record<string, string | number | undefined>) => ccGet<Paged<WaitlistRow> & { byProduct: Record<string, number>; byRole: Record<string, number> }>(`/waitlist${qs(p)}`);

// ---- Platform administration ---------------------------------------------------------------------
export type AccessState = { roles: { code: string; description: string | null; members: number; permissions: { code: string; description: string | null }[] }[]; staff: { id: string; name: string | null; email: string | null; accountStatus: string; lastSignInAt: string | null; twoStepVerification: boolean; roles: string[] }[]; grantable: string[]; note: string };
export const accessState = () => ccGet<AccessState>('/access');
export const changeStaffRole = (userId: string, action: 'grant' | 'remove', roleCode: string, reason: string) => ccPost<{ userId: string; roles: string[] }>(`/access/staff/${userId}/${action}`, { roleCode, reason });
export type StaffSession = { id: string; userId: string; staff: string; device: string; createdAt: string; lastUsedAt: string; expiresAt: string; revokedAt: string | null; revokedReason: string | null; mfaVerifiedAt: string | null; current: boolean; state: string };
export const staffSessions = (include: 'active' | 'all') => ccGet<{ items: StaffSession[] }>(`/sessions${qs({ include })}`);
export const revokeStaffSession = (id: string, reason: string) => ccPost<{ id: string }>(`/sessions/${id}/revoke`, { reason });
export type SecurityState = { generatedAt: string; staff: { total: number; active: number; superAdmins: number; withoutTwoStep: { id: string; name: string | null }[] }; signIns: { failed24h: number; accountsWithFailures24h: number; recentFailures: { id: string; at: string; account: string | undefined; ip: string | null; device: string | null; location: string | null }[] }; staffActivity: { adminActions24h: number; exports30d: number; emergencyAccess30d: number; emergencyAwaitingReview: number }; payments: { forgedWebhooks30d: number }; controls: string[] };
export const securityState = () => ccGet<SecurityState>('/security');
export type Tenant = { applicationId: string; reference: string; organisation: { id?: string; name: string; type?: string; status?: string; city?: string }; organizationId: string | null; activeMembers: number; owner: string; subscription: { package: string; code: string; version: number; billingCycle: string; currency: string; priceMinor: number }; licence: { branches: number; storageGb: number; support: string }; entitlements: string[]; provisioning: { state: string; approvedAt: string | null; setupSentAt: string | null; setupDeadlineAt: string | null; liveAt: string | null }; documents: { onboarding: { id: string; key: string; name: string; contentType: string }[]; applicationEvidence: number } };
export const tenants = () => ccGet<{ generatedAt: string; billingNote: string; items: Tenant[] }>('/tenants');
export type Analytics = { generatedAt: string; weeks: number; definitions: Record<string, string>; active: { week: string; patients: number; professionals: number; organisationStaff: number; sabiStaff: number }[]; activity: { week: string; orders: number; consultations: number; prescriptions: number; wellnessBookings: number; hospitalAppointments: number }[] };
export const analytics = (weeks: number) => ccGet<Analytics>(`/analytics${qs({ weeks })}`);
