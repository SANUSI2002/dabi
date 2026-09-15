import { MODULES, PRODUCTS } from "@/platform/entitlements";
import type {
  AuditedEntity, CustomerInvoice, Entitlement, FeatureFlag, IdentitySession, Integration, License,
  ModuleCatalogItem, NotificationTemplate, OnboardingTask, OnboardingWorkflow, Organization,
  OrganizationBranch, OrganizationDocument, Package, PackageVersion, Payment, PlatformAuditEvent,
  PlatformIncident, PlatformUser, PriceVersion, ProductCatalogItem, ServiceHealth, Subscription,
  TenantUser, ThemeConfiguration, UsageMetric,
} from "./domain";

const CREATED_BY = "pu_ada";
const NOW = "2026-09-14T08:30:00.000Z";
const meta = (id: string, createdAt = "2025-01-10T09:00:00.000Z"): AuditedEntity => ({ id, createdAt, updatedAt: NOW, createdBy: CREATED_BY });

const orgRows = [
  ["org-sabi", "Sabi Health Post", "Hospital", "Nigeria", "Lagos", "Active", "Current", "Live", 318, 400, 3, "2027-03-31", "sabi-health"],
  ["org-mercy", "Mercy Gate Specialist Hospital", "Hospital", "Nigeria", "Oyo", "Active", "Current", "Live", 246, 300, 2, "2026-10-08", "mercy-gate"],
  ["org-northstar", "Northstar Medical Centre", "Hospital Group", "Nigeria", "Abuja FCT", "Active", "Current", "Live", 511, 600, 4, "2027-01-31", "northstar"],
  ["org-lagoon", "Lagoon Crest Clinics", "Clinic", "Nigeria", "Lagos", "Trial", "Current", "In Progress", 42, 60, 1, "2026-10-01", "lagoon-crest"],
  ["org-sunrise", "Sunrise Women & Children", "Hospital", "Ghana", "Greater Accra", "Active", "Current", "Live", 189, 220, 2, "2027-05-15", "sunrise-wc"],
  ["org-cedar", "Cedar Diagnostics", "Diagnostic Centre", "Nigeria", "Rivers", "Payment Due", "Past Due", "Live", 74, 80, 2, "2026-09-21", "cedar-diagnostics"],
  ["org-olive", "Olive Branch Hospital", "Hospital", "Nigeria", "Enugu", "Suspended", "Suspended", "Live", 0, 140, 1, "2026-08-31", "olive-branch"],
  ["org-atlas", "Atlas Community Health", "Clinic", "Sierra Leone", "Western Area", "Onboarding", "Current", "In Progress", 16, 120, 2, "2027-08-31", "atlas-health"],
  ["org-heritage", "Heritage Teaching Hospital", "Hospital Group", "Nigeria", "Kano", "Active", "Current", "Live", 704, 900, 6, "2027-06-30", "heritage-teaching"],
  ["org-haven", "Haven Pharmacy Network", "Pharmacy", "Nigeria", "Lagos", "Grace Period", "Due", "Live", 83, 100, 5, "2026-09-10", "haven-pharmacy"],
  ["org-riverbend", "Riverbend General Hospital", "Hospital", "Nigeria", "Delta", "Expired", "Past Due", "Live", 0, 180, 1, "2026-08-12", "riverbend"],
  ["org-newleaf", "New Leaf Care Centre", "Clinic", "Nigeria", "Kwara", "Prospect", "Current", "Not Started", 0, 25, 1, "2027-09-30", "new-leaf"],
] as const;

export const seedOrganizations: Organization[] = orgRows.map((r, i) => ({
  ...meta(r[0], `202${4 + (i % 2)}-${String((i % 9) + 1).padStart(2, "0")}-10T09:00:00.000Z`),
  tenantId: `TEN-${String(i + 1).padStart(4, "0")}`, name: r[1], legalName: `${r[1]} Limited`, slug: r[12], type: r[2],
  registrationNumber: `RC-${420100 + i}`, country: r[3], state: r[4], address: `${14 + i} Central Medical Way, ${r[4]}`,
  email: `admin@${r[12]}.health`, phone: `+234 80${31000000 + i}`, domain: `${r[12]}.sabios.com`, primaryContact: ["Dr. Kemi Adebayo", "Chinwe Okafor", "Tunde Lawal"][i % 3],
  accountManager: ["Lara Bello", "Ola Martins", "Ife Nwosu"][i % 3], implementationManager: ["Tomi Adeyemi", "Maya Cole"][i % 2],
  status: r[5], billingStatus: r[6], onboardingStatus: r[7], activeUsers: r[8], licensedUsers: r[9],
  storageUsedGb: Math.round(r[8] * 0.18), storageLimitGb: Math.max(50, r[9]), branchCount: r[10],
  createdDate: `202${4 + (i % 2)}-${String((i % 9) + 1).padStart(2, "0")}-10`, activationDate: r[5] === "Prospect" ? undefined : `2025-${String((i % 9) + 2).padStart(2, "0")}-01`,
  expirationDate: r[11], lastActivityAt: r[8] ? `2026-09-${String(14 - (i % 7)).padStart(2, "0")}T${String(8 + (i % 8)).padStart(2, "0")}:20:00.000Z` : undefined,
  timezone: r[3] === "Ghana" ? "Africa/Accra" : r[3] === "Sierra Leone" ? "Africa/Freetown" : "Africa/Lagos",
  locale: "en-NG", currency: "NGN",
}));

const modulePrice: Record<string, number> = {
  "emr.clinical": 85_000, "emr.wards": 35_000, "emr.laboratory": 45_000, "emr.pharmacy": 38_000,
  "emr.radiology": 42_000, "emr.mch": 28_000, "emr.billing": 30_000, "emr.operations": 32_000,
  "workforce.core": 45_000, "workforce.time": 22_000, "workforce.recruitment": 18_000, "workforce.payroll": 32_000,
  "accounting.gl": 55_000, "accounting.ar": 22_000, "accounting.ap": 22_000, "accounting.banking": 18_000,
};

export const seedProducts: ProductCatalogItem[] = Object.values(PRODUCTS).map((p) => ({
  ...meta(p.id), productKey: p.id, name: p.label, description: p.description, status: p.status, version: p.version,
  basePrice: p.basePrice, currency: "NGN", billingModel: p.billingModel, releaseStatus: p.releaseStatus,
  moduleIds: MODULES.filter((m) => m.product === p.id).map((m) => m.key),
}));

export const futureProducts: ProductCatalogItem[] = [
  ["patient-portal", "Patient Portal", "Patient self-service, records and payments", "Beta"],
  ["doctor-portal", "Doctor Portal", "Cross-facility clinician workspace", "Planned"],
  ["telemedicine", "Telemedicine", "Virtual care and remote follow-up", "Planned"],
  ["analytics", "Sabi Analytics", "Enterprise operational intelligence", "Internal"],
  ["ai-services", "Sabi AI Services", "Governed AI assistance across workflows", "Internal"],
].map(([id, name, description, releaseStatus]) => ({ ...meta(id), name, description, status: releaseStatus === "Beta" ? "Beta" : "Internal", version: "0.1", basePrice: 0, currency: "NGN", billingModel: "enterprise", releaseStatus, moduleIds: [] } as ProductCatalogItem));

export const seedModules: ModuleCatalogItem[] = MODULES.map((m) => ({
  ...meta(m.key), productId: m.product, key: m.key, name: m.label, description: m.description,
  price: modulePrice[m.key] ?? (m.core ? 25_000 : 15_000), currency: "NGN", pricingUnit: m.pricingUnit ?? "month",
  core: !!m.core, dependencies: m.dependencies ?? [], status: m.status ?? "Active",
  routeEntitlements: m.routes, featureEntitlements: m.featureEntitlements ?? (m.submodules?.map((s) => s.key) ?? []),
}));

const basicModules = MODULES.filter((m) => m.core || ["emr.billing"].includes(m.key)).map((m) => m.key);
const standardModules = MODULES.filter((m) => !["emr.radiology", "emr.equipmentScada", "workforce.payroll", "accounting.banking", "accounting.integrations"].includes(m.key)).map((m) => m.key);
const premiumModules = MODULES.map((m) => m.key);

export const seedPackageVersions: PackageVersion[] = [
  { ...meta("pkgv-basic-1"), packageId: "pkg-basic", version: 1, effectiveFrom: "2026-01-01", monthlyPrice: 145_000, annualPrice: 1_479_000, currency: "NGN", moduleIds: basicModules, status: "Published" },
  { ...meta("pkgv-standard-2"), packageId: "pkg-standard", version: 2, effectiveFrom: "2026-07-01", monthlyPrice: 295_000, annualPrice: 3_009_000, currency: "NGN", moduleIds: standardModules, status: "Published" },
  { ...meta("pkgv-premium-3"), packageId: "pkg-premium", version: 3, effectiveFrom: "2026-07-01", monthlyPrice: 485_000, annualPrice: 4_947_000, currency: "NGN", moduleIds: premiumModules, status: "Published" },
  { ...meta("pkgv-enterprise-1"), packageId: "pkg-enterprise", version: 1, effectiveFrom: "2026-01-01", monthlyPrice: 0, annualPrice: 0, currency: "NGN", moduleIds: premiumModules, status: "Published" },
];

export const seedPackages: Package[] = [
  { ...meta("pkg-basic"), code: "BASIC", name: "Basic", description: "Core digital records for smaller care teams.", trialDurationDays: 14, recommended: false, active: true, minimumUsers: 5, maximumUsers: 50, branchLimit: 1, storageLimitGb: 50, supportLevel: "Standard", currentVersionId: "pkgv-basic-1" },
  { ...meta("pkg-standard"), code: "STANDARD", name: "Standard", description: "Connected clinical and operational workflows.", trialDurationDays: 21, recommended: true, active: true, minimumUsers: 25, maximumUsers: 300, branchLimit: 3, storageLimitGb: 250, supportLevel: "Priority", currentVersionId: "pkgv-standard-2" },
  { ...meta("pkg-premium"), code: "PREMIUM", name: "Premium", description: "Full-suite platform for complex hospitals.", trialDurationDays: 30, recommended: false, active: true, minimumUsers: 100, maximumUsers: 1000, branchLimit: 8, storageLimitGb: 1000, supportLevel: "Priority", currentVersionId: "pkgv-premium-3" },
  { ...meta("pkg-enterprise"), code: "ENTERPRISE", name: "Enterprise", description: "Custom entitlements, limits and implementation terms.", trialDurationDays: 30, recommended: false, active: true, minimumUsers: 250, branchLimit: 99, storageLimitGb: 5000, supportLevel: "Dedicated", currentVersionId: "pkgv-enterprise-1" },
];

const subscriptionStatusMap: Partial<Record<Organization["status"], Subscription["status"]>> = { Trial: "Trialing", Active: "Active", "Payment Due": "Past Due", "Grace Period": "Grace Period", Suspended: "Suspended", Expired: "Expired", Terminated: "Cancelled" };
const subscriptionStatus = (org: Organization): Subscription["status"] => subscriptionStatusMap[org.status] ?? "Trialing";
export const seedSubscriptions: Subscription[] = seedOrganizations.filter((o) => o.status !== "Prospect").map((o, i) => {
  const pkg = i % 4 === 0 ? seedPackages[2] : i % 3 === 0 ? seedPackages[0] : seedPackages[1];
  const pv = seedPackageVersions.find((v) => v.id === pkg.currentVersionId)!;
  const base = pv.monthlyPrice;
  return { ...meta(`sub-${o.id}`), organizationId: o.id, packageId: pkg.id, packageVersionId: pv.id, status: subscriptionStatus(o), billingCycle: i % 3 === 0 ? "Annual" : "Monthly", currency: "NGN", baseAmount: base, addOnAmount: i % 2 ? 45_000 : 0, discount: i % 4 === 0 ? 25_000 : 0, tax: Math.round(base * 0.075), finalAmount: base + (i % 2 ? 45_000 : 0) - (i % 4 === 0 ? 25_000 : 0) + Math.round(base * 0.075), startDate: o.activationDate ?? "2026-01-01", renewalDate: o.expirationDate ?? "2027-01-01", expirationDate: o.expirationDate ?? "2027-01-01", gracePeriodDays: 14, autoRenewal: o.status === "Active", snapshotModuleIds: pv.moduleIds };
});

export const seedEntitlements: Entitlement[] = [
  { ...meta("ent-sabi-lab"), organizationId: "org-sabi", subscriptionId: "sub-org-sabi", targetType: "module", targetKey: "emr.laboratory", source: "add-on", enabled: true, validFrom: "2026-01-01", reason: "Purchased diagnostic add-on" },
];

export const seedLicenses: License[] = seedSubscriptions.map((s) => {
  const org = seedOrganizations.find((o) => o.id === s.organizationId)!;
  const days = Math.ceil((new Date(s.expirationDate).getTime() - new Date("2026-09-14").getTime()) / 86_400_000);
  const status: License["status"] = s.status === "Suspended" ? "Suspended" : s.status === "Expired" ? "Expired" : days <= 30 ? "Expiring Soon" : s.status === "Grace Period" ? "Grace Period" : "Active";
  return { ...meta(`lic-${org.id}`), organizationId: org.id, subscriptionId: s.id, type: s.status === "Trialing" ? "Trial" : s.packageId === "pkg-enterprise" ? "Enterprise" : "Subscription", productIds: ["emr", ...(s.snapshotModuleIds.some((m) => m.startsWith("workforce")) ? ["workforce"] : []), ...(s.snapshotModuleIds.some((m) => m.startsWith("accounting")) ? ["accounting"] : [])], moduleIds: s.snapshotModuleIds, validFrom: s.startDate, validUntil: s.expirationDate, userLimit: org.licensedUsers, branchLimit: Math.max(org.branchCount, 1), facilityLimit: Math.max(org.branchCount, 1), storageLimitGb: org.storageLimitGb, status, lastValidatedAt: NOW };
});

export const seedPriceVersions: PriceVersion[] = seedModules.map((m) => ({ ...meta(`price-${m.id}-1`), moduleId: m.id, amount: m.price, currency: m.currency, pricingUnit: m.pricingUnit, effectiveFrom: "2026-07-01", status: "Active" }));

export const seedBranches: OrganizationBranch[] = seedOrganizations.flatMap((o) => Array.from({ length: Math.min(o.branchCount, 3) }, (_, i) => ({ ...meta(`branch-${o.id}-${i + 1}`), organizationId: o.id, name: i === 0 ? `${o.name} — Main` : `${o.name} — Branch ${i + 1}`, facilityCode: `${o.tenantId}-${String(i + 1).padStart(2, "0")}`, address: `${24 + i} ${["Medical", "Unity", "Health"][i]} Avenue, ${o.state}`, activeUsers: Math.round(o.activeUsers / Math.min(o.branchCount, 3)), departmentCount: 6 + i * 3, status: "Active", moduleIds: seedSubscriptions.find((s) => s.organizationId === o.id)?.snapshotModuleIds ?? basicModules })));

export const seedPlatformUsers: PlatformUser[] = [
  { ...meta("pu_ada"), name: "Adaeze Okonjo", email: "adaeze@sabios.com", role: "Platform Super Admin", permissions: ["platform.view", "organizations.manage", "subscriptions.manage", "billing.manage", "catalog.manage", "pricing.manage", "identity.manage", "security.manage", "onboarding.manage", "documents.verify", "branding.manage", "operations.manage", "audit.view", "support.access.request", "support.access.approve"], status: "Active", mfaEnabled: true, lastLoginAt: NOW },
  { ...meta("pu_lara"), name: "Lara Bello", email: "lara@sabios.com", role: "Implementation Manager", permissions: ["platform.view", "organizations.manage", "onboarding.manage", "documents.verify", "support.access.request"], status: "Active", mfaEnabled: true, lastLoginAt: "2026-09-14T07:15:00.000Z" },
  { ...meta("pu_olamide"), name: "Olamide Yusuf", email: "olamide@sabios.com", role: "Finance Admin", permissions: ["platform.view", "subscriptions.manage", "billing.manage", "pricing.manage", "audit.view"], status: "Active", mfaEnabled: true, lastLoginAt: "2026-09-13T16:42:00.000Z" },
  { ...meta("pu_maya"), name: "Maya Cole", email: "maya@sabios.com", role: "Support Agent", permissions: ["platform.view", "support.access.request"], status: "Active", mfaEnabled: true, lastLoginAt: "2026-09-14T08:04:00.000Z" },
];

export const seedTenantUsers: TenantUser[] = seedOrganizations.flatMap((o, oi) => ["Administrator", "Clinical Lead", "Finance Manager"].map((role, i) => ({ ...meta(`tu-${o.id}-${i}`), organizationId: o.id, branchId: `branch-${o.id}-1`, name: [["Amaka Obi", "Femi Cole", "Nana Mensah"], ["Tolu Okeke", "Amina Bello", "Peter James"]][oi % 2][i], email: `${["admin", "clinical", "finance"][i]}@${o.slug}.health`, employeeId: `EMP-${oi + 1}${i + 1}0`, role, department: ["Administration", "Clinical Services", "Finance"][i], status: o.status === "Suspended" ? "Disabled" : "Active", mfaEnabled: i !== 1, lastLoginAt: o.activeUsers ? `2026-09-${String(14 - i).padStart(2, "0")}T09:00:00Z` : undefined })));

export const seedSessions: IdentitySession[] = [...seedPlatformUsers.slice(0, 3), ...seedTenantUsers.slice(0, 5)].map((u, i) => ({ ...meta(`sess-${u.id}`), userId: u.id, organizationId: "organizationId" in u ? u.organizationId : undefined, sessionId: `sid_${u.id}_${i}`, device: i % 2 ? "Chrome on Windows" : "Safari on macOS", location: i % 3 ? "Lagos, NG" : "Abuja, NG", lastSeenAt: `2026-09-14T0${8 - (i % 6)}:20:00Z`, expiresAt: "2026-09-14T18:30:00Z", status: "Active" }));

export const seedInvoices: CustomerInvoice[] = seedSubscriptions.slice(0, 9).map((s, i) => ({ ...meta(`inv-${10041 + i}`), organizationId: s.organizationId, subscriptionId: s.id, number: `SABI-${10041 + i}`, billingPeriod: "01 Sep – 30 Sep 2026", subtotal: s.baseAmount + s.addOnAmount - s.discount, tax: s.tax, total: s.finalAmount, currency: s.currency, dueDate: `2026-09-${String(5 + i * 2).padStart(2, "0")}`, status: i === 5 || i === 6 ? "Overdue" : i < 4 ? "Paid" : "Due", paidDate: i < 4 ? `2026-09-0${3 + i}` : undefined }));

export const seedPayments: Payment[] = seedInvoices.slice(0, 5).map((invoice, i) => ({ ...meta(`pay-${i + 1}`), organizationId: invoice.organizationId, invoiceId: invoice.id, reference: `PAY-NG-${82001 + i}`, amount: invoice.total, currency: invoice.currency, provider: i % 2 ? "Paystack" : "Bank Transfer", status: i === 4 ? "Failed" : "Succeeded", paidAt: i === 4 ? undefined : invoice.paidDate }));

const docTypes = [["Legal", "Certificate of Incorporation"], ["Legal", "Facility Registration"], ["Contract", "Service Agreement"], ["Contract", "Data Processing Agreement"], ["Compliance", "Security Assessment"], ["Implementation", "Staff Import Spreadsheet"]] as const;
export const seedDocuments: OrganizationDocument[] = seedOrganizations.slice(0, 8).flatMap((o, oi) => docTypes.map(([category, type], i) => ({ ...meta(`doc-${o.id}-${i}`), organizationId: o.id, category, type, filename: i < 4 ? `${type.toLowerCase().replaceAll(" ", "-")}.pdf` : undefined, storageObjectId: i < 4 ? `obj_${o.id}_${i}` : undefined, version: 1, uploadedBy: i < 4 ? `tu-${o.id}-0` : undefined, uploadedAt: i < 4 ? "2026-08-20T10:00:00Z" : undefined, expiryDate: i === 1 ? "2026-10-20" : undefined, status: i >= 4 ? "Missing" : oi % 4 === 3 && i === 2 ? "Under Review" : "Approved", verifiedBy: i < 4 ? "pu_lara" : undefined, verifiedAt: i < 4 ? "2026-08-22T11:00:00Z" : undefined })));

const onboardingStages = ["Organization Created", "Commercial Agreement", "KYC / Company Verification", "Facility Documentation", "Subscription Selected", "Contract Signed", "Payment Confirmed", "Modules Selected", "Organization Configuration", "Admin Account Created", "Staff Import", "Master Data Setup", "Training", "Go-Live Readiness", "Go Live", "Post-Go-Live Review"];
export const seedWorkflows: OnboardingWorkflow[] = seedOrganizations.filter((o) => ["Onboarding", "Trial"].includes(o.status)).map((o) => ({ ...meta(`onb-${o.id}`), organizationId: o.id, status: "In Progress", startedAt: o.createdAt, targetGoLiveDate: o.id === "org-atlas" ? "2026-10-28" : "2026-10-05" }));
export const seedOnboardingTasks: OnboardingTask[] = seedWorkflows.flatMap((w, wi) => onboardingStages.map((name, i) => ({ ...meta(`onbt-${w.organizationId}-${i + 1}`), organizationId: w.organizationId, workflowId: w.id, order: i + 1, name, status: i < 6 + wi * 2 ? "Completed" : i === 6 + wi * 2 ? "In Progress" : "Not Started", assignee: i < 6 ? "Lara Bello" : i < 12 ? "Tomi Adeyemi" : "Maya Cole", dueDate: `2026-${i < 8 ? "09" : "10"}-${String(10 + (i % 18)).padStart(2, "0")}`, documentIds: [], checklist: [{ id: `check-${w.organizationId}-${i}`, label: `Confirm ${name.toLowerCase()}`, completed: i < 6 + wi * 2 }], completedAt: i < 6 + wi * 2 ? `2026-09-${String(2 + i).padStart(2, "0")}T15:00:00Z` : undefined })));

export const seedThemes: ThemeConfiguration[] = seedOrganizations.map((o, i) => ({ ...meta(`theme-${o.id}`), organizationId: o.id, organizationDisplayName: o.name, productDisplayName: "Sabi OS", colors: { primary: i === 0 ? "#0fc06d" : ["#2563eb", "#7c3aed", "#0f766e"][i % 3], secondary: "#0a4f32", accent: "#22c55e", success: "#16a34a", warning: "#d97706", error: "#dc2626", background: "#f7faf8", sidebar: "#0b1f17", header: "#ffffff" }, typography: { fontFamily: "Inter", baseFontSize: 16, headingScale: 1.22, fontWeight: 400 }, ui: { borderRadius: 12, density: "Comfortable", sidebarStyle: "Solid", navigationStyle: "Groups", allowLight: true, allowDark: true, defaultMode: "Light" }, login: { welcomeMessage: `Welcome to ${o.name}`, supportContact: "support@sabios.com" } }));

export const seedFeatureFlags: FeatureFlag[] = [
  { ...meta("ff-consultation-v2"), key: "consultation.v2", name: "New consultation experience", description: "Structured clinical workspace with a revised note flow.", status: "Testing", targets: [{ type: "organization", ids: ["org-sabi", "org-lagoon"] }] },
  { ...meta("ff-ai-assistant"), key: "ai.assistant", name: "AI assistant", description: "Governed assistance for non-diagnostic operational tasks.", status: "Draft", targets: [{ type: "plan", ids: ["pkg-enterprise"] }] },
  { ...meta("ff-inventory-v3"), key: "inventory.v3", name: "Inventory workflow v3", description: "Batch-first stock operations and approval routing.", status: "Enabled", targets: [{ type: "everyone", ids: [] }] },
];

export const seedIntegrations: Integration[] = seedOrganizations.slice(0, 9).flatMap((o, i) => [
  { ...meta(`int-${o.id}-pay`), organizationId: o.id, provider: i % 2 ? "Paystack" : "Flutterwave", category: "Payments", environment: "Production", status: i === 5 ? "Error" : "Connected", maskedCredential: "sk_live_••••••••8H2K", lastSyncAt: NOW, lastSuccessfulSyncAt: i === 5 ? "2026-09-13T11:00:00Z" : NOW, lastError: i === 5 ? "Webhook signature validation failed" : undefined, errorCount: i === 5 ? 7 : 0 },
  { ...meta(`int-${o.id}-sms`), organizationId: o.id, provider: "Termii", category: "SMS", environment: "Production", status: "Connected", maskedCredential: "tm_••••••••31Q", lastSyncAt: NOW, lastSuccessfulSyncAt: NOW, errorCount: 0 },
] as Integration[]);

export const seedHealth: ServiceHealth[] = [
  ["api", "Core API", "Operational", 118, 99.99], ["auth", "Identity & authentication", "Operational", 93, 99.995],
  ["database", "Database clusters", "Operational", 34, 99.998], ["notifications", "Notification service", "Degraded", 840, 99.82],
  ["payments", "Payment service", "Operational", 326, 99.96], ["storage", "File storage", "Operational", 156, 99.99],
  ["queues", "Queue workers", "Operational", 68, 99.97], ["backups", "Backups", "Maintenance", 0, 100],
].map(([id, name, status, latencyMs, availability]) => ({ id, name, status, latencyMs, availability, lastCheckedAt: NOW } as ServiceHealth));

export const seedIncidents: PlatformIncident[] = [
  { ...meta("incident-104"), title: "Delayed SMS delivery in West Africa", service: "Notification service", status: "Monitoring", severity: "Minor", startedAt: "2026-09-14T06:30:00Z" },
  { ...meta("incident-103"), title: "Payment callback latency", service: "Payment service", status: "Resolved", severity: "Minor", startedAt: "2026-09-09T12:10:00Z", resolvedAt: "2026-09-09T13:42:00Z" },
];

export const seedUsage: UsageMetric[] = seedOrganizations.filter((o) => o.activeUsers).flatMap((o, oi) => ["DAU", "WAU", "MAU", "Sessions", "Encounters", "Appointments", "Lab Requests", "Storage GB"].map((metric, mi) => ({ id: `usage-${o.id}-${mi}`, organizationId: o.id, date: "2026-09-14", metric, value: metric === "DAU" ? Math.round(o.activeUsers * .42) : metric === "WAU" ? Math.round(o.activeUsers * .73) : metric === "MAU" ? o.activeUsers : metric === "Storage GB" ? o.storageUsedGb : Math.round(o.activeUsers * (1.5 + mi + oi * .02)) } as UsageMetric)));

export const seedAuditEvents: PlatformAuditEvent[] = [
  { id: "pae-1", actorId: "pu_ada", actorName: "Adaeze Okonjo", actorRole: "Platform Super Admin", organizationId: "org-sabi", resourceType: "Entitlement", resourceId: "emr.laboratory", action: "Enabled Laboratory module", previousValue: false, newValue: true, timestamp: "2026-09-14T08:12:00Z", ipAddress: "102.89.34.17", userAgent: "Chrome / Windows", correlationId: "corr-921A", reason: "Approved add-on order AO-221" },
  { id: "pae-2", actorId: "pu_olamide", actorName: "Olamide Yusuf", actorRole: "Finance Admin", organizationId: "org-mercy", resourceType: "License", resourceId: "lic-org-mercy", action: "Extended license expiry", previousValue: "2026-09-30", newValue: "2026-10-08", timestamp: "2026-09-13T16:30:00Z", ipAddress: "105.112.18.9", userAgent: "Edge / Windows", correlationId: "corr-878J", reason: "Payment confirmed by bank transfer" },
  { id: "pae-3", actorId: "pu_maya", actorName: "Maya Cole", actorRole: "Support Agent", organizationId: "org-northstar", resourceType: "SupportAccessSession", resourceId: "sas-104", action: "Ended support access session", timestamp: "2026-09-13T14:18:00Z", ipAddress: "102.89.34.21", userAgent: "Chrome / macOS", correlationId: "corr-812B", reason: "Configuration review completed" },
];

export const seedNotificationTemplates: NotificationTemplate[] = [
  ["welcome", "Welcome to Sabi", ["Email", "In-app"], "Welcome to {{organization_name}}", "Your Sabi OS workspace is ready. Sign in at {{login_url}}.", ["organization_name", "login_url"]],
  ["license-30", "License expires in 30 days", ["Email", "SMS", "In-app"], "Your Sabi OS license renews soon", "The license for {{organization_name}} expires on {{expiry_date}}.", ["organization_name", "expiry_date"]],
  ["payment-failed", "Payment failed", ["Email", "In-app"], "Payment requires attention", "We could not process invoice {{invoice_number}}. Please update your billing method.", ["invoice_number"]],
].map(([key, name, channels, subject, body, variables], i) => ({ ...meta(`nt-${i + 1}`), key, name, channels, subject, body, variables, status: "Active" } as NotificationTemplate));
