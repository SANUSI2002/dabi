import type { BillingModel, CatalogStatus, PricingUnit, ProductKey } from "@/platform/entitlements";

export type Id = string;
export type Currency = "NGN" | "USD" | "GBP" | "EUR" | (string & {});
export type ISODate = string;
export type AuditedEntity = { id: Id; createdAt: ISODate; updatedAt: ISODate; createdBy: Id };

export type OrganizationStatus = "Prospect" | "Onboarding" | "Trial" | "Active" | "Grace Period" | "Payment Due" | "Suspended" | "Expired" | "Terminated" | "Archived";
export type OnboardingStatus = "Not Started" | "In Progress" | "Blocked" | "Ready" | "Live";
export type BillingStatus = "Current" | "Due" | "Past Due" | "Suspended";

export type Organization = AuditedEntity & {
  tenantId: Id; name: string; legalName: string; slug: string;
  type: "Clinic" | "Hospital" | "Hospital Group" | "Diagnostic Centre" | "Pharmacy";
  registrationNumber: string; country: string; state: string; address: string;
  email: string; phone: string; domain: string; primaryContact: string;
  accountManager: string; implementationManager: string;
  status: OrganizationStatus; billingStatus: BillingStatus; onboardingStatus: OnboardingStatus;
  activeUsers: number; licensedUsers: number; storageUsedGb: number; storageLimitGb: number; branchCount: number;
  createdDate: ISODate; activationDate?: ISODate; expirationDate?: ISODate; lastActivityAt?: ISODate;
  timezone: string; locale: string; currency: Currency;
};

export type OrganizationBranch = AuditedEntity & {
  organizationId: Id; name: string; facilityCode: string; address: string;
  activeUsers: number; departmentCount: number; status: "Active" | "Inactive" | "Opening"; moduleIds: string[];
};

export type ProductCatalogItem = AuditedEntity & {
  productKey?: ProductKey; name: string; description: string; status: CatalogStatus; version: string;
  basePrice: number; currency: Currency; billingModel: BillingModel;
  releaseStatus: "Generally Available" | "Beta" | "Planned" | "Internal"; moduleIds: string[];
};

export type ModuleCatalogItem = AuditedEntity & {
  productId: Id; key: string; name: string; description: string; price: number; currency: Currency;
  pricingUnit: PricingUnit; core: boolean; dependencies: string[]; status: CatalogStatus;
  routeEntitlements: string[]; featureEntitlements: string[];
};

export type PriceVersion = AuditedEntity & {
  moduleId: Id; amount: number; currency: Currency; pricingUnit: PricingUnit;
  effectiveFrom: ISODate; effectiveTo?: ISODate; introductory?: boolean; grandfathered?: boolean;
  status: "Scheduled" | "Active" | "Retired";
};

export type PackageVersion = AuditedEntity & {
  packageId: Id; version: number; effectiveFrom: ISODate; effectiveTo?: ISODate;
  monthlyPrice: number; annualPrice: number; currency: Currency; moduleIds: string[];
  inheritedFromVersionId?: Id; status: "Draft" | "Published" | "Retired";
};

export type Package = AuditedEntity & {
  code: string; name: string; description: string; trialDurationDays: number; recommended: boolean; active: boolean;
  minimumUsers: number; maximumUsers?: number; branchLimit: number; storageLimitGb: number;
  supportLevel: "Standard" | "Priority" | "Dedicated"; currentVersionId: Id;
};

export type SubscriptionStatus = "Trialing" | "Active" | "Past Due" | "Grace Period" | "Suspended" | "Expired" | "Cancelled";
export type BillingCycle = "Monthly" | "Quarterly" | "Annual" | "Custom";
export type Subscription = AuditedEntity & {
  organizationId: Id; packageId: Id; packageVersionId: Id; status: SubscriptionStatus; billingCycle: BillingCycle;
  currency: Currency; baseAmount: number; addOnAmount: number; discount: number; tax: number; finalAmount: number;
  startDate: ISODate; trialEndDate?: ISODate; renewalDate: ISODate; expirationDate: ISODate;
  gracePeriodDays: number; autoRenewal: boolean; cancellationDate?: ISODate; cancellationReason?: string;
  snapshotModuleIds: string[];
};

export type EntitlementTarget = "product" | "module" | "feature";
export type EntitlementSource = "package" | "add-on" | "override" | "temporary" | "revocation";
export type Entitlement = AuditedEntity & {
  organizationId: Id; subscriptionId: Id; branchId?: Id; targetType: EntitlementTarget; targetKey: string;
  source: EntitlementSource; enabled: boolean; validFrom: ISODate; validUntil?: ISODate; reason?: string;
};

export type LicenseStatus = "Active" | "Expiring Soon" | "Grace Period" | "Expired" | "Suspended" | "Revoked";
export type License = AuditedEntity & {
  organizationId: Id; subscriptionId: Id; type: "Trial" | "Subscription" | "Enterprise";
  productIds: Id[]; moduleIds: string[]; validFrom: ISODate; validUntil: ISODate;
  userLimit: number; branchLimit: number; facilityLimit: number; storageLimitGb: number;
  status: LicenseStatus; lastValidatedAt: ISODate;
};

export type ResolvedEntitlements = {
  organizationId: Id; subscriptionId: Id; subscriptionStatus: SubscriptionStatus; licenseStatus: LicenseStatus;
  generatedAt: ISODate; products: Record<string, boolean>; modules: Record<string, boolean>; features: Record<string, boolean>;
};

export type PlatformRole = "Platform Super Admin" | "Platform Admin" | "Finance Admin" | "Billing Officer" | "Implementation Manager" | "Support Agent" | "Compliance Officer" | "Security Administrator" | "Read Only Auditor" | "Product Lead" | "Product Manager" | "Engineering Lead" | "Designer" | "Executive Viewer" | "Marketing" | "Customer Success";
export type PlatformPermission = "platform.view" | "organizations.manage" | "subscriptions.manage" | "billing.manage" | "catalog.manage" | "pricing.manage" | "identity.manage" | "security.manage" | "onboarding.manage" | "documents.verify" | "branding.manage" | "operations.manage" | "audit.view" | "support.access.request" | "support.access.approve" | "roadmap.view" | "roadmap.create" | "roadmap.edit" | "roadmap.archive" | "roadmap.manage_dates" | "roadmap.manage_priority" | "roadmap.manage_visibility" | "roadmap.publish" | "roadmap.unpublish" | "roadmap.manage_releases" | "roadmap.view_internal_notes" | "roadmap.comment" | "roadmap.export";

export type PlatformUser = AuditedEntity & {
  name: string; email: string; role: PlatformRole; permissions: PlatformPermission[];
  status: "Invited" | "Active" | "Suspended" | "Locked"; mfaEnabled: boolean; lastLoginAt?: ISODate;
};

export type TenantUser = AuditedEntity & {
  organizationId: Id; branchId?: Id; name: string; email: string; employeeId: string; role: string; department: string;
  status: "Invited" | "Active" | "Disabled" | "Locked"; mfaEnabled: boolean; lastLoginAt?: ISODate;
};

export type IdentitySession = AuditedEntity & {
  userId: Id; organizationId?: Id; sessionId: Id; device: string; location: string; ipAddress?: string;
  lastSeenAt: ISODate; expiresAt: ISODate; status: "Active" | "Revoked" | "Expired";
};

export type InvoiceStatus = "Draft" | "Issued" | "Due" | "Paid" | "Partially Paid" | "Overdue" | "Void" | "Refunded";
export type CustomerInvoice = AuditedEntity & {
  organizationId: Id; subscriptionId: Id; number: string; billingPeriod: string;
  subtotal: number; tax: number; total: number; currency: Currency; dueDate: ISODate; status: InvoiceStatus; paidDate?: ISODate;
};

export type Payment = AuditedEntity & {
  organizationId: Id; invoiceId: Id; reference: string; amount: number; currency: Currency; provider: string;
  status: "Pending" | "Succeeded" | "Failed" | "Refunded"; paidAt?: ISODate;
};

export type DocumentStatus = "Missing" | "Uploaded" | "Under Review" | "Approved" | "Rejected" | "Expired" | "Expiring Soon";
export type OrganizationDocument = AuditedEntity & {
  organizationId: Id; category: "Legal" | "Contract" | "Compliance" | "Billing" | "Implementation";
  type: string; filename?: string; storageObjectId?: Id; version: number; uploadedBy?: Id; uploadedAt?: ISODate;
  expiryDate?: ISODate; status: DocumentStatus; verifiedBy?: Id; verifiedAt?: ISODate; notes?: string;
};

export type OnboardingTask = AuditedEntity & {
  organizationId: Id; workflowId: Id; order: number; name: string;
  status: "Not Started" | "In Progress" | "Blocked" | "Completed"; assignee: string; dueDate?: ISODate; notes?: string;
  documentIds: Id[]; checklist: { id: Id; label: string; completed: boolean }[]; completedAt?: ISODate;
};

export type OnboardingWorkflow = AuditedEntity & {
  organizationId: Id; status: OnboardingStatus; startedAt: ISODate; targetGoLiveDate?: ISODate; completedAt?: ISODate;
};

export type ThemeConfiguration = AuditedEntity & {
  organizationId?: Id; logoUrl?: string; faviconUrl?: string; organizationDisplayName?: string; productDisplayName?: string;
  colors: Record<"primary" | "secondary" | "accent" | "success" | "warning" | "error" | "background" | "sidebar" | "header", string>;
  typography: { fontFamily: string; baseFontSize: number; headingScale: number; fontWeight: number };
  ui: { borderRadius: number; density: "Compact" | "Comfortable"; sidebarStyle: "Solid" | "Glass"; navigationStyle: "Groups" | "Rail"; allowLight: boolean; allowDark: boolean; defaultMode: "Light" | "Dark" | "System" };
  login: { logoUrl?: string; backgroundUrl?: string; welcomeMessage: string; supportContact: string };
};

export type FeatureFlag = AuditedEntity & {
  key: string; name: string; description: string; status: "Draft" | "Testing" | "Enabled" | "Disabled" | "Deprecated";
  targets: { type: "everyone" | "product" | "plan" | "organization" | "branch" | "role" | "user"; ids: Id[] }[];
};

export type Integration = AuditedEntity & {
  organizationId: Id; provider: string; category: string; environment: "Sandbox" | "Production";
  status: "Connected" | "Degraded" | "Disconnected" | "Error"; maskedCredential?: string;
  lastSyncAt?: ISODate; lastSuccessfulSyncAt?: ISODate; lastError?: string; errorCount: number;
};

export type PlatformIncident = AuditedEntity & {
  title: string; service: string; status: "Investigating" | "Identified" | "Monitoring" | "Resolved";
  severity: "Minor" | "Major" | "Critical"; startedAt: ISODate; resolvedAt?: ISODate;
};

export type ServiceHealth = {
  id: Id; name: string; status: "Operational" | "Degraded" | "Partial Outage" | "Major Outage" | "Maintenance";
  latencyMs: number; availability: number; lastCheckedAt: ISODate;
};

export type UsageMetric = { id: Id; organizationId: Id; date: ISODate; metric: "DAU" | "WAU" | "MAU" | "Sessions" | "Encounters" | "Appointments" | "Lab Requests" | "Prescriptions" | "Platform Invoices" | "Storage GB" | "API Calls"; value: number; moduleKey?: string };

export type PlatformAuditEvent = {
  id: Id; actorId: Id; actorName: string; actorRole: PlatformRole; organizationId?: Id;
  resourceType: string; resourceId: Id; action: string; previousValue?: unknown; newValue?: unknown;
  timestamp: ISODate; ipAddress?: string; userAgent?: string; correlationId: Id; reason?: string;
};

export type SupportAccessSession = AuditedEntity & {
  organizationId: Id; requestedBy: Id; approvedBy?: Id; reason: string; startsAt: ISODate; expiresAt: ISODate;
  status: "Requested" | "Approved" | "Active" | "Ended" | "Expired" | "Rejected"; endedAt?: ISODate;
};

export type NotificationTemplate = AuditedEntity & {
  key: string; name: string; channels: ("Email" | "SMS" | "In-app" | "Push" | "WhatsApp")[];
  subject: string; body: string; variables: string[]; status: "Draft" | "Active" | "Disabled";
};

export type ProvisioningCommit = {
  idempotencyKey: string;
  applicationId: string;
  commercialOpportunityId: string;
  organizationId: Id;
  committedAt: ISODate;
  committedBy: Id;
};

export type ProvisionTenantInput = {
  idempotencyKey: string;
  applicationId: string;
  commercialOpportunityId: string;
  name: string;
  legalName: string;
  type: Organization["type"];
  registrationNumber: string;
  country: string;
  state: string;
  address: string;
  email: string;
  phone: string;
  domain: string;
  primaryContact: string;
  ownerEmail: string;
  packageId: string;
  packageVersionId: string;
  billingCycle: BillingCycle;
  paymentPath: "TRIAL" | "INVOICE" | "MANUAL_TRANSFER";
  productIds: ProductKey[];
  userLimit: number;
  branchLimit: number;
  facilityLimit: number;
  storageLimitGb: number;
  baseAmount: number;
  addOnAmount: number;
  discount: number;
  tax: number;
  finalAmount: number;
};
