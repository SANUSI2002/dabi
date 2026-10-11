// Typed client for the Command Centre API (/api/v1/command-centre). Every call goes through the
// authenticated live session; nothing here is cached or stored in the browser.
import { liveApiRequest, liveApiTextPost } from '@/identity/liveIdentity';

const BASE = '/api/v1/command-centre';
type Envelope<T> = { status: 'success'; data: T };

export const qs = (params: Record<string, string | number | boolean | null | undefined>) => {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '');
  return entries.length ? `?${new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString()}` : '';
};
export const ccGet = async <T,>(path: string) => (await liveApiRequest<Envelope<T>>(`${BASE}${path}`, { cache: 'no-store' })).data;
export const ccPost = async <T,>(path: string, body: unknown = {}) => (await liveApiRequest<Envelope<T>>(`${BASE}${path}`, { method: 'POST', body: JSON.stringify(body) })).data;

export type Paged<T> = { items: T[]; total: number; page: number; limit: number; pages: number };
export type Drill = { section: string; filter?: Record<string, string | boolean> };

// ---- Me / overview / search ------------------------------------------------------------------
export type CcMe = { id: string; name: string | null; email: string; twoStepVerification: boolean; roles: string[]; permissions: string[] };
export type Metric = { key: string; label: string; value: number | null; unit: 'count' | 'kobo' | 'percent'; definition: string; drill?: Drill };
export type QueueItem = { key: string; label: string; value: number; definition: string; drill: Drill; severity: 'ok' | 'info' | 'attention' | 'warning' | 'critical' };
export type Overview = { period: { from: string; to: string; timeZone: string }; generatedAt: string; freshness: string; metrics: Metric[]; queues: QueueItem[]; daily: { day: string; orders: number; paid: number; paidValueMinor: number }[] };
export type SearchGroup = { type: 'patient' | 'order' | 'pharmacy' | 'doctor' | 'organization' | 'case'; label: string; items: { id: string; title: string; subtitle: string }[] };

export const getMe = () => ccGet<CcMe>('/me');
export const getOverview = (p: { from?: string; to?: string; tz?: string }) => ccGet<Overview>(`/overview${qs(p)}`);
export const search = (q: string) => ccGet<{ q: string; groups: SearchGroup[] }>(`/search${qs({ q })}`);

// ---- Patients ---------------------------------------------------------------------------------
export type PatientRow = { id: string; patientId: string; name: string | null; email: string | null; phone: string | null; accountStatus: string; emailVerified: boolean; lastSignInAt: string | null };
export type PatientAccount = {
  account: { id: string; patientId: string; name: string | null; email: string | null; phone: string | null; dateOfBirth: string | null; accountStatus: string; emailVerifiedAt: string | null; phoneVerifiedAt: string | null; lastSignInAt: string | null; twoStepVerification: boolean; roles: string[] };
  sessions: { id: string; device: string; startedAt: string; lastActiveAt: string; expiresAt: string; state: string; endedAt: string | null; endedReason: string | null; twoStepVerifiedAt: string | null }[];
  location: { current: null; note: string; signIns: { at: string; action: string; device: string | null; ip: string | null; approximateLocation: { city: string | null; region: string | null; country: string | null; source: string; recordedAt: string } | null }[] };
  addresses: { kind?: string; address?: string | null; recipientName?: string | null; recipientPhone?: string | null; relation?: string | null; source: string; recordedAt: string; recordedAtNote?: string; orderId?: string; unavailable?: boolean }[];
  careCircle: {
    caregivers: { id: string; name: string | null; invitedEmail: string | null; relationship: string; permissions: string[]; status: string; since: string; accessExpiresAt: string | null; revokedAt: string | null }[];
    caresFor: { id: string; name: string | null; relationship: string; status: string; since: string }[];
    doctors: { id: string; doctor: string | null; specialty: string | null; status: string; requestedAt: string; respondedAt: string | null; revokedAt: string | null; expiresAt: string | null }[];
    dependents: { id: string; name: string; dateOfBirth: string | null; addedAt: string }[];
    hospitals: { id: string; hospital: string; status: string; requestedAt: string; decidedAt: string | null }[];
  };
  orders: { id: string; reference: string; status: string; totalPayableMinor: number; deliveryFeeMinor: number; createdAt: string; fulfilments: { id: string; pharmacy: string; method: string; status: string; totalMinor: number }[] }[];
  payments: { id: string; provider: string; providerReference: string; status: string; amountMinor: number; createdAt: string; completedAt: string | null; orderId: string; orderReference: string }[];
  consents: {
    platform: { key: string; label: string; given: boolean; at: string | null; detail?: Record<string, unknown> }[];
    professionals: { id: string; professional: string | null; professionType: string; active: boolean; grantedAt: string; revokedAt: string | null }[];
    documentShares: { id: string; recipient: string | null; documentKind: string; sharedAt: string; expiresAt: string; revokedAt: string | null }[];
  };
  cases: { id: string; reference: string; kind: string; title: string; status: string; priority: string; createdAt: string }[];
  openedAt: string;
};
export type PatientClinical = {
  access: { kind: 'ROLE' } | { kind: 'EMERGENCY'; grantId: string; expiresAt: string };
  consultations: { id: string; doctor: string | null; specialty: string | null; type: string; status: string; startsAt: string; endsAt: string; requestedAt: string; confirmedAt: string | null; completedAt: string | null; cancelledAt: string | null; cancelledBy: string | null; videoRoomCreatedAt: string | null; noteSigned: boolean }[];
  medicines: {
    definitions: Record<'prescribed' | 'purchased' | 'handedOver' | 'patientReported', string>;
    prescribed: { prescriptionId: string; reference: string; status: string; issuedAt: string | null; cancelledAt: string | null; prescriber: string | null; itemId: string; medicationName: string; dosage: string; frequency: string; route: string; duration: string; quantity: number; purchasedQuantity: number; handedOverQuantity: number }[];
    purchased: { medicationName: string; quantity: number; prescriptionItemId: string | null; orderId: string; orderReference: string; pharmacy: string; method: string; fulfilmentStatus: string; purchasedAt: string; handedOver: boolean; handedOverAt: string | null }[];
    patientReported: { source: string; name: string; instructions?: string | null; dosage?: string | null; status?: string; startDate?: string; endDate?: string | null; recordedAt: string; recordedAtNote?: string }[];
  };
  allergies: { reported: { text: string; source: string; verification: string; recordedAt: string; recordedAtNote?: string }[]; clinicianVerified: unknown[]; note: string };
  conditions: { text: string; source: string; recordedAt: string }[];
  health: { bloodType: string | null; genotype: string | null; recentVitals: { type: string; value: string; unit: string; status: string; recordedAt: string; source: string }[] };
  documents: { id: string; kind: string; status: string; createdAt: string; note: string }[];
  labResults: { items: { id: string; status: string; uploadedAt: string; source: string }[]; note: string };
  openedAt: string;
};
export type AccessEntry = { id: string; at: string; category: string; action: string; summary: string; actor: string; actorUserId: string; byStaff: boolean; reason: string | null; roles: string[] | null; device: string | null; ip: string | null };
export type EmergencyGrant = { id: string; actorUserId: string; subjectUserId: string; reason: string; startedAt: string; expiresAt: string; endedAt: string | null; reviewedAt: string | null; reviewOutcome: string | null; reviewNote: string | null; actor: string; subject: string; reviewer: string | null; state: 'ACTIVE' | 'ENDED' | 'EXPIRED' };

export const listPatients = (p: { q?: string; status?: string; page?: number }) => ccGet<Paged<PatientRow>>(`/patients${qs(p)}`);
export const openPatientAccount = (id: string, reason: string) => ccPost<PatientAccount>(`/patients/${id}/account`, { reason });
export const openPatientClinical = (id: string, reason: string) => ccPost<PatientClinical>(`/patients/${id}/clinical`, { reason });
export const patientAccessHistory = (id: string, p: { page?: number; staffOnly?: boolean }) => ccGet<Paged<AccessEntry>>(`/patients/${id}/access-history${qs({ page: p.page, staffOnly: p.staffOnly ? 'true' : undefined })}`);
export const startEmergencyAccess = (id: string, reason: string, minutes: number) => ccPost<EmergencyGrant>(`/patients/${id}/emergency-access`, { reason, minutes });
export const revokePatientSessions = (id: string, reason: string) => ccPost<{ sessionsRevoked: number }>(`/patients/${id}/sessions/revoke`, { reason });
export const listEmergencyAccess = (p: { page?: number; unreviewed?: boolean }) => ccGet<Paged<EmergencyGrant>>(`/emergency-access${qs({ page: p.page, unreviewed: p.unreviewed ? 'true' : undefined })}`);
export const endEmergencyAccess = (id: string) => ccPost<EmergencyGrant>(`/emergency-access/${id}/end`);
export const reviewEmergencyAccess = (id: string, outcome: 'APPROPRIATE' | 'INAPPROPRIATE', note: string) => ccPost<EmergencyGrant>(`/emergency-access/${id}/review`, { outcome, note });

// ---- Orders / deliveries ----------------------------------------------------------------------
export type OrderRow = { id: string; reference: string; status: string; createdAt: string; updatedAt: string; patient: { id: string; patientId: string; name: string | null }; subtotalMinor: number; deliveryFeeMinor: number; platformFeeMinor: number; totalPayableMinor: number; pricingVersion: number; fulfilments: { id: string; status: string; method: string; pharmacy: string; pharmacyId: string }[] };
export type QuoteLine = { code: string; label: string; amountMinor: number };
export type DeliveryQuote = { feeMinor: number; currency: string; distanceKm: number; billableKm: number; method: string; ratePerKmMinor: number; zone: { id: string; name: string } | null; band: { fromKm: number; toKm: number | null } | null; freeDelivery: boolean; lines: QuoteLine[]; pricingVersion: number; quotedAt: string; methodFallback?: { requested: string; used: string; reason: string } };
export type TimelineEvent = { at: string; kind: string; text: string };
export type RefundCase = { id: string; status: string; amountMinor: number; currency: string; reason: string; createdAt: string; proposedAt: string | null; proposalNote: string | null; decidedAt: string | null; decisionNote: string | null; submittedAt: string | null; provider: string | null; providerRefundReference: string | null; providerStatus: string | null; failureReason: string | null; evidenceNote: string | null; refundedAt: string | null; proposedByUserId: string | null };
export type OrderTrace = {
  id: string; reference: string; status: string; currency: string; createdAt: string; updatedAt: string;
  patient: { id: string; patientId: string; name: string | null; email: string | null };
  money: { subtotalMinor: number; deliveryFeeMinor: number; platformFeeMinor: number; totalPayableMinor: number; pricingVersion: number };
  deliveryDetailsOnFile: boolean;
  payments: { id: string; provider: string; providerReference: string; status: string; amountMinor: number; currency: string; expiresAt: string; completedAt: string | null; createdAt: string; events: { id: string; eventType: string; status: string; createdAt: string }[] }[];
  webhooks: { id: string; eventType: string | null; outcome: string; detail: string | null; receivedAt: string }[];
  fulfilments: {
    id: string; pharmacy: { id: string; name: string; city: string; state: string }; status: string; method: string; createdAt: string;
    subtotalMinor: number; deliveryFeeMinor: number; totalMinor: number; commissionBps: number | null; commissionMinor: number | null; tierVersion: number | null; pharmacyEarningMinor: number | null;
    deliveryQuote: DeliveryQuote | null;
    pharmacistDecision: { at: string; by: string | null; note: string | null; messageToPatient: string | null } | null;
    lines: { id: string; medicationName: string; selectedQuantity: number; unitPriceMinor: number; lineTotalMinor: number; prescriptionItemId: string | null }[];
    deliveries: { id: string; status: string; rejectionReason: string | null; assignedAt: string; respondedAt: string | null; pickedUpAt: string | null; outForDeliveryAt: string | null; deliveredAt: string | null; partner: { id: string; displayName: string }; trackingPoints: number }[];
    refund: RefundCase | null;
    settlement: { id: string; reference: string; status: string } | null;
  }[];
  cases: { id: string; reference: string; kind: string; title: string; status: string; priority: string; createdAt: string }[];
  timeline: TimelineEvent[];
};
export type DeliveryRow = { fulfilmentId: string; order: { id: string; reference: string }; pharmacy: { id: string; name: string; city: string }; status: string; createdAt: string; deliveryFeeMinor: number; distanceKm: number | null; pricingVersion: number | null; assignment: { id: string; status: string; rider: string; riderId: string; assignedAt: string; pickedUpAt: string | null; outForDeliveryAt: string | null; deliveredAt: string | null } | null };
export type Rider = { id: string; name: string; active: boolean; openAssignments: number };

export const listOrders = (p: Record<string, string | number | undefined>) => ccGet<Paged<OrderRow>>(`/orders${qs(p)}`);
export const getOrder = (id: string) => ccGet<OrderTrace>(`/orders/${encodeURIComponent(id)}`);
export const listDeliveries = (p: Record<string, string | number | undefined>) => ccGet<Paged<DeliveryRow> & { riders: Rider[] }>(`/deliveries${qs(p)}`);
export const assignRider = (fulfilmentId: string, partnerId: string, reason: string) => ccPost<{ id: string; rider: string }>(`/deliveries/${fulfilmentId}/assign`, { partnerId, reason });

// ---- Consultations / providers ----------------------------------------------------------------
export type ConsultationRow = { id: string; status: string; type: string; startsAt: string; endsAt: string; requestedAt: string; patient: { id: string; patientId: string; name: string | null }; doctor: { profileId: string; name: string | null; specialty: string | null }; noteSigned: boolean; forDependent: boolean };
export type ConsultationDetail = { id: string; status: string; type: string; startsAt: string; endsAt: string; reasonGiven: boolean; patient: ConsultationRow['patient']; doctor: ConsultationRow['doctor']; note: { started: boolean; signed: boolean; revision?: number; lastChangedAt?: string }; contentNote: string; timeline: TimelineEvent[] };
export type CredentialRow = { kind: 'doctor' | 'pharmacy' | 'branch'; id: string; pharmacyId?: string; name: string | null; credential: string; providerStatus: string; expiresAt: string | null; state: 'EXPIRED' | 'EXPIRING' | 'VALID' | 'UNKNOWN'; daysLeft: number | null };

export const listConsultations = (p: Record<string, string | number | undefined>) => ccGet<Paged<ConsultationRow>>(`/consultations${qs(p)}`);
export const getConsultation = (id: string) => ccGet<ConsultationDetail>(`/consultations/${id}`);
export const listCredentials = (p: { within?: number; kind?: string }) => ccGet<{ within: number; generatedAt: string; items: CredentialRow[] }>(`/providers/credentials${qs(p)}`);
export const providerSummary = () => ccGet<Record<'doctors' | 'pharmacies' | 'organisations' | 'riders', Record<string, number>>>('/providers/summary');
export const setDoctorStatus = (profileId: string, action: 'suspend' | 'reinstate', reason: string) => ccPost<{ id: string; verificationStatus: string }>(`/providers/doctors/${profileId}/${action}`, { reason });

// ---- Pharmacy exceptions (marketplace stock, expiry and listings) -----------------------------
export type PharmacyExceptionType = 'OUT_OF_STOCK' | 'LOW_STOCK' | 'EXPIRED' | 'EXPIRING' | 'WITHDRAWN' | 'REJECTED';
type PharmacyRef = { id: string; name: string; status: string };
type BranchRef = { id: string; name: string | null; status: string | null } | null;
export type PharmacyExceptionRow = {
  id: string; types: PharmacyExceptionType[]; pharmacy: PharmacyRef; branch: BranchRef;
  medicationName: string; batchNumber: string | null; expiryDate: string | null; daysToExpiry: number | null; expiryBand: 'EXPIRED' | '30' | '60' | '90' | null;
  availableQuantity: number; reorderPoint: number; isActive: boolean;
  listing: { id: string; status: string; reviewNote: string | null; reviewedAt: string | null; updatedAt: string | null } | null;
};
export type PharmacyExceptionGroup = { pharmacy: PharmacyRef; branch: BranchRef; counts: { items: number; outOfStock: number; lowStock: number; expired: number; expiring: number; withdrawn: number; rejected: number } };
export type PharmacyExceptions = Paged<PharmacyExceptionRow> & {
  generatedAt: string; freshness: string; definitions: Record<PharmacyExceptionType, string>;
  summary: { outOfStock: number; lowStock: number; expired: number; expiring30: number; expiring60: number; expiring90: number; withdrawn: number; rejected: number; pharmacies: number };
  groups: PharmacyExceptionGroup[];
};
export const listPharmacyExceptions = (p: { type?: PharmacyExceptionType; within?: number; lowStockAt?: number; pharmacyId?: string; branchId?: string; search?: string; page?: number; limit?: number }) => ccGet<PharmacyExceptions>(`/pharmacy-exceptions${qs(p)}`);

// ---- Finance ----------------------------------------------------------------------------------
export type FinanceSummary = {
  period: { from: string; to: string; timeZone: string }; generatedAt: string; definitions: Record<string, string>;
  collected: { count: number; amountMinor: number };
  breakdown: { medicinesMinor: number; deliveryFeesMinor: number; platformFeesMinor: number; commissionMinor: number; pharmacyEarningsMinor: number; sabiRevenueMinor: number };
  refunds: Record<string, { count: number; amountMinor: number }>; settlements: Record<string, { count: number; amountMinor: number }>;
  unsettled: { fulfilments: number; netPayableMinor: number }; providers: { paystack: string; payouts: string };
};
export type PaymentRow = { id: string; provider: string; providerReference: string; status: string; amountMinor: number; currency: string; createdAt: string; completedAt: string | null; expiresAt: string; order: { id: string; reference: string; status: string; totalPayableMinor: number }; providerEvents: number };
export type WebhookRow = { id: string; provider: string; eventType: string | null; reference: string | null; outcome: string; detail: string | null; receivedAt: string };
export type ReconCheck = { key: string; title: string; expectation: string; severity: 'critical' | 'warning'; count: number; status: 'OK' | 'MISMATCH'; items: Record<string, string | number | null>[] };
export type RefundRow = RefundCase & { proposedBy: string | null; decidedBy: string | null; evidenceRecordedBy: string | null; order: { id: string; reference: string; patient: { patientId: string; full_name: string | null } }; pharmacy: string; fulfilmentStatus: string };
export type Settlement = { id: string; reference: string; pharmacyId: string; periodStart: string; periodEnd: string; currency: string; fulfilmentCount: number; grossMinor: number; commissionMinor: number; netPayableMinor: number; status: string; preparedBy: string; approvedBy: string | null; approvedAt: string | null; paidBy: string | null; paidAt: string | null; payoutReference: string | null; payoutNote: string | null; cancelledBy: string | null; cancelReason: string | null; createdAt: string; pharmacy: { id: string; name: string }; preparedByUserId: string; idempotent?: boolean };
export type SettlementPreview = { definition: string; fulfilments: { id: string; orderReference: string; status: string; createdAt: string; grossMinor: number; commissionMinor: number; netMinor: number }[]; fulfilmentCount: number; grossMinor: number; commissionMinor: number; netPayableMinor: number; excludedMissingCommission: number };

export const financeSummary = (p: { from?: string; to?: string; tz?: string }) => ccGet<FinanceSummary>(`/finance/summary${qs(p)}`);
export const listPayments = (p: Record<string, string | number | undefined>) => ccGet<Paged<PaymentRow>>(`/finance/payments${qs(p)}`);
export const listWebhooks = (p: Record<string, string | number | undefined>) => ccGet<Paged<WebhookRow> & { last24h: Record<string, number> }>(`/finance/webhooks${qs(p)}`);
export const reconciliation = () => ccGet<{ generatedAt: string; checks: ReconCheck[] }>('/finance/reconciliation');
export const listRefunds = (p: Record<string, string | number | undefined>) => ccGet<Paged<RefundRow>>(`/finance/refunds${qs(p)}`);
export const refundAction = (id: string, action: 'propose' | 'approve' | 'decline', note: string) => ccPost<RefundCase>(`/finance/refunds/${id}/${action}`, { note });
export const submitRefund = (id: string) => ccPost<RefundCase>(`/finance/refunds/${id}/submit`);
export const refundEvidence = (id: string, body: { outcome: 'REFUNDED' | 'FAILED'; providerRefundReference?: string; note: string }) => ccPost<RefundCase>(`/finance/refunds/${id}/evidence`, body);
export type Payable = { pharmacyId: string; name: string; complianceStatus: string; fulfilments: number; grossMinor: number; commissionMinor: number; netPayableMinor: number; oldestAt: string | null };
export const listPayables = () => ccGet<{ generatedAt: string; definition: string; items: Payable[] }>('/finance/payables');
export const listSettlements = (p: Record<string, string | number | undefined>) => ccGet<Paged<Settlement>>(`/finance/settlements${qs(p)}`);
export const previewSettlement = (body: { pharmacyId: string; periodStart: string; periodEnd: string }) => ccPost<SettlementPreview>('/finance/settlements/preview', body);
export const createSettlement = (body: { pharmacyId: string; periodStart: string; periodEnd: string; idempotencyKey: string }) => ccPost<Settlement>('/finance/settlements', body);
export const settlementAction = (id: string, action: 'approve' | 'cancel', note: string) => ccPost<Settlement>(`/finance/settlements/${id}/${action}`, { note });
export const settlementPaid = (id: string, payoutReference: string, note: string) => ccPost<Settlement>(`/finance/settlements/${id}/paid`, { payoutReference, note });

// ---- Cases ------------------------------------------------------------------------------------
export type CaseRow = { id: string; reference: string; kind: 'SUPPORT' | 'INCIDENT'; category: string; priority: string; status: string; title: string; subjectUserId: string | null; orderId: string | null; assigneeUserId: string | null; dueAt: string | null; resolvedAt: string | null; resolution: string | null; version: number; createdAt: string; updatedAt: string; assignee: string | null; createdBy: string; subject: string | null; overdue: boolean };
export type CaseDetail = Omit<CaseRow, 'subject'> & { subject: { id: string; name: string } | null; order: { id: string; reference: string; status: string } | null; pharmacy: { id: string; name: string; complianceStatus: string } | null; doctor: { id: string; name: string | null; status: string } | null; events: { id: string; kind: string; body: string | null; fromStatus: string | null; toStatus: string | null; createdAt: string; actor: string }[]; allowedTransitions: string[] };
export type CaseMeta = { items: { id: string; name: string }[]; categories: string[]; slaHours: Record<string, Record<string, number>> };

export const listCases = (p: Record<string, string | number | undefined>) => ccGet<Paged<CaseRow> & { open: Record<string, number> }>(`/cases${qs(p)}`);
export const getCase = (id: string) => ccGet<CaseDetail>(`/cases/${id}`);
export const caseMeta = () => ccGet<CaseMeta>('/cases/meta/assignees');
export const createCase = (body: Record<string, string | undefined>) => ccPost<CaseRow>('/cases', body);
export const updateCase = (id: string, body: Record<string, string | number | null | undefined>) => ccPost<CaseRow>(`/cases/${id}/update`, body);

// ---- Ops --------------------------------------------------------------------------------------
export type Integration = { key: string; name: string; purpose: string; status: 'CONFIGURED' | 'NOT_CONFIGURED' | 'SANDBOX' | 'DEGRADED'; detail: string; activity: Record<string, unknown> | null };
export type JobType = 'notification' | 'reminder' | 'pharmacy-email' | 'emr-webhook' | 'document-scan';
export type JobSummary = Record<JobType, { window: string; counts: Record<string, number>; retryable: boolean; note?: string; outbox?: { pending: number; oldestPendingAt: string | null } }>;
export type JobRow = Record<string, unknown> & { id: string; status: string; retryable: boolean };
export type Alert = { key: string; severity: 'critical' | 'warning' | 'info'; category: string; title: string; detail: string; at?: string; drill?: Drill };

export const integrations = () => ccGet<{ generatedAt: string; items: Integration[] }>('/ops/integrations');
export const jobSummary = () => ccGet<{ generatedAt: string; types: JobSummary }>('/ops/jobs/summary');
export const listJobs = (p: { type: JobType; status?: string; page?: number }) => ccGet<Paged<JobRow>>(`/ops/jobs${qs(p)}`);
export const retryJob = (type: JobType, id: string, reason: string) => ccPost<{ id: string; status: string }>(`/ops/jobs/${type}/${id}/retry`, { reason });
export const alerts = () => ccGet<{ generatedAt: string; items: Alert[] }>('/ops/alerts');

// ---- Audit ------------------------------------------------------------------------------------
export type AuditRow = { id: string; at: string; category: string; action: string; summary: string; actor: string; actorUserId: string; subject: string | null; subjectUserId: string | null; resourceType: string | null; resourceId: string | null; reason: string | null; roles: string[] | null; before: unknown; after: unknown; device: string | null; ip: string | null; location: string | null };
export const listAudit = (p: Record<string, string | number | undefined>) => ccGet<Paged<AuditRow> & { appendOnly: boolean }>(`/audit${qs(p)}`);
export const exportAudit = (reason: string, filters: Record<string, string>) => liveApiTextPost(`${BASE}/audit/export`, { reason, filters });

// ---- Delivery pricing -------------------------------------------------------------------------
export type Band = { fromKm: number; toKm: number | null; ratePerKmMinor: number };
export type Zone = { id: string; name: string; centre: { latitude: number; longitude: number }; radiusKm: number; ratePerKmMinor?: number | null; surchargeMinor?: number | null; serviceable?: boolean };
export type Surcharge = { code: string; label: string; amountMinor: number };
export type PricingRules = {
  currency: 'NGN'; platformFeeMinor: number; deliveryRatePerKmMinor: number; baseFeeMinor: number; includedDistanceKm: number; minimumFeeMinor: number; maximumFeeMinor: number | null;
  maxDistanceKm: number | null; distanceMethod: 'STRAIGHT_LINE' | 'ROAD'; roadFallbackToStraightLine: boolean; distanceRounding: 'EXACT' | 'UP_0_1_KM' | 'UP_1_KM' | 'NEAREST_0_1_KM'; feeRoundingMinor: number;
  bands: Band[]; zones: Zone[]; restrictToZones: boolean; freeDeliveryThresholdMinor: number | null; smallOrderThresholdMinor: number | null; smallOrderFeeMinor: number; surcharges: Surcharge[]; quoteTtlMinutes: number;
};
export type PricingVersion = PricingRules & { version: number; effectiveAt: string | null; createdAt?: string; changeReason?: string | null; state?: 'ACTIVE' | 'SCHEDULED' | 'SUPERSEDED' | 'CANCELLED'; createdByName?: string | null; cancelledByName?: string | null; cancelledAt?: string | null };
export type PricingState = { active: PricingVersion; versions: PricingVersion[]; routing: { roadConfigured: boolean; provider: string | null } };
export type Point = { latitude: number; longitude: number };

export const getDeliveryPricing = () => ccGet<PricingState>('/pricing/delivery');
export const createPricingVersion = (body: Partial<PricingRules> & { reason: string; effectiveAt?: string }) => ccPost<PricingVersion>('/pricing/delivery', body);
export const cancelPricingVersion = (version: number, reason: string) => ccPost<PricingVersion>(`/pricing/delivery/${version}/cancel`, { reason });
export const simulateDelivery = (body: { rules?: Partial<PricingRules>; origin: Point; destination: Point; subtotalMinor: number; tierRadiusKm?: number | null }) => ccPost<{ draft: boolean; basedOnVersion: number; quote: DeliveryQuote }>('/pricing/delivery/simulate', body);
