import { create } from "zustand";
import { persisted } from "@/platform/persist";
import { useEntitlements } from "@/platform/useEntitlements";
import type {
  CustomerInvoice, Entitlement, FeatureFlag, IdentitySession, Integration, License, ModuleCatalogItem,
  NotificationTemplate, OnboardingTask, OnboardingWorkflow, Organization, OrganizationBranch,
  OrganizationDocument, Package, PackageVersion, Payment, PlatformAuditEvent, PlatformIncident,
  PlatformUser, PriceVersion, ProductCatalogItem, ServiceHealth, Subscription, TenantUser,
  ThemeConfiguration, UsageMetric, ProvisioningCommit, ProvisionTenantInput, SupportAccessSession,
} from "./domain";
import { resolveEntitlements } from "./resolver";
import { validateHexColor, validateReason } from "./repository";
import {
  futureProducts, seedAuditEvents, seedBranches, seedDocuments, seedEntitlements, seedFeatureFlags,
  seedHealth, seedIncidents, seedIntegrations, seedInvoices, seedLicenses, seedModules,
  seedNotificationTemplates, seedOnboardingTasks, seedOrganizations, seedPackages,
  seedPackageVersions, seedPayments, seedPlatformUsers, seedPriceVersions, seedProducts,
  seedSessions, seedSubscriptions, seedTenantUsers, seedThemes, seedUsage, seedWorkflows,
} from "./seed";
import { hasPermission } from "./access";

type CommandCenterState = {
  organizations: Organization[]; branches: OrganizationBranch[]; products: ProductCatalogItem[];
  modules: ModuleCatalogItem[]; prices: PriceVersion[]; packages: Package[]; packageVersions: PackageVersion[];
  subscriptions: Subscription[]; entitlements: Entitlement[]; licenses: License[];
  platformUsers: PlatformUser[]; tenantUsers: TenantUser[]; sessions: IdentitySession[];
  invoices: CustomerInvoice[]; payments: Payment[]; documents: OrganizationDocument[];
  workflows: OnboardingWorkflow[]; onboardingTasks: OnboardingTask[]; themes: ThemeConfiguration[];
  featureFlags: FeatureFlag[]; integrations: Integration[]; incidents: PlatformIncident[];
  serviceHealth: ServiceHealth[]; usage: UsageMetric[]; auditEvents: PlatformAuditEvent[];
  notificationTemplates: NotificationTemplate[];
  supportAccessSessions: SupportAccessSession[];
  customRoles: { id: string; name: string; permissions: string[]; createdAt: string; createdBy: string }[];
  platformSettings: Record<string, Record<string, string>>;
  provisioningCommits: ProvisioningCommit[];
  recordAuditEvent: (event: Omit<PlatformAuditEvent, "id" | "timestamp" | "correlationId" | "actorId" | "actorName" | "actorRole">, actorId: string) => void;
  createOrganization: (input: Pick<Organization, "name" | "type" | "country" | "state" | "email" | "phone" | "domain">) => string;
  setOrganizationStatus: (organizationId: string, status: Organization["status"], reason: string) => void;
  setModuleEntitlement: (organizationId: string, moduleKey: string, enabled: boolean, reason: string) => void;
  updateThemeColor: (organizationId: string, key: keyof ThemeConfiguration["colors"], color: string) => void;
  updateThemeIdentity: (organizationId: string, values: Pick<ThemeConfiguration, "organizationDisplayName" | "productDisplayName">) => void;
  reviewDocument: (documentId: string, status: "Approved" | "Rejected", reason: string) => void;
  revokeSession: (sessionId: string, reason: string) => void;
  updateOnboardingTask: (taskId: string, status: OnboardingTask["status"]) => void;
  toggleFeatureFlag: (flagId: string) => void;
  clonePackage: (packageId: string) => void;
  createProduct: (input: ProductDraft, actorId: string) => MutationResult;
  updateProduct: (productId: string, input: ProductDraft, actorId: string, reason: string) => MutationResult;
  createModule: (input: ModuleDraft, actorId: string) => MutationResult;
  savePriceVersion: (input: PriceDraft, actorId: string) => MutationResult;
  savePackageDraft: (packageId: string | undefined, input: PackageDraft, actorId: string, reason?: string) => MutationResult;
  publishPackageVersion: (packageId: string, versionId: string, actorId: string, reason: string) => MutationResult;
  createCustomerInvoice: (input: InvoiceDraft, actorId: string) => MutationResult;
  recordCustomerPayment: (input: PaymentDraft, actorId: string) => MutationResult;
  addDocumentRequest: (organizationId: string, category: OrganizationDocument["category"], type: string, actorId: string) => MutationResult;
  inviteTenantUser: (input: TenantUserDraft, actorId: string) => MutationResult;
  invitePlatformUser: (input: PlatformUserDraft, actorId: string) => MutationResult;
  addBranch: (input: BranchDraft, actorId: string) => MutationResult;
  addIntegration: (input: IntegrationDraft, actorId: string) => MutationResult;
  requestSupportAccess: (organizationId: string, reason: string, durationMinutes: number, actorId: string) => MutationResult;
  changeSubscriptionPackage: (subscriptionId: string, packageVersionId: string, actorId: string, reason: string) => MutationResult;
  applySubscriptionCredit: (subscriptionId: string, amount: number, actorId: string, reason: string) => MutationResult;
  renewSubscription: (subscriptionId: string, actorId: string, reason: string) => MutationResult;
  createCustomRole: (name: string, permissions: string[], actorId: string) => MutationResult;
  declareIncident: (title: string, service: string, severity: PlatformIncident["severity"], actorId: string) => MutationResult;
  refreshServiceHealth: (actorId: string) => void;
  runIntegrationJob: (integrationId: string, actorId: string) => MutationResult;
  savePlatformSettings: (section: string, values: Record<string, string>, actorId: string) => MutationResult;
  createFeatureFlag: (name: string, key: string, description: string, actorId: string) => MutationResult;
  createNotificationTemplate: (name: string, key: string, actorId: string) => MutationResult;
  updateNotificationTemplate: (templateId: string, values: Pick<NotificationTemplate, "subject" | "body" | "channels">, actorId: string) => MutationResult;
  commitProvisionedTenant: (input: ProvisionTenantInput, actorId: string) => { organizationId?: string; error?: string };
  activateProvisionedTenant: (organizationId: string, actorId: string, reason: string) => { ok: true } | { ok: false; error: string };
};

export type ProductDraft = Pick<ProductCatalogItem, "name" | "description" | "status" | "version" | "basePrice" | "currency" | "billingModel" | "releaseStatus">;
export type ModuleDraft = Pick<ModuleCatalogItem, "productId" | "key" | "name" | "description" | "price" | "currency" | "pricingUnit" | "core" | "dependencies" | "status" | "routeEntitlements" | "featureEntitlements">;
export type PriceDraft = Pick<PriceVersion, "moduleId" | "amount" | "currency" | "pricingUnit" | "effectiveFrom" | "introductory" | "grandfathered">;
export type PackageDraft = Pick<Package, "code" | "name" | "description" | "trialDurationDays" | "recommended" | "minimumUsers" | "maximumUsers" | "branchLimit" | "storageLimitGb" | "supportLevel"> & Pick<PackageVersion, "monthlyPrice" | "annualPrice" | "currency" | "moduleIds" | "effectiveFrom">;
export type InvoiceDraft = Pick<CustomerInvoice, "organizationId" | "subscriptionId" | "billingPeriod" | "subtotal" | "tax" | "currency" | "dueDate">;
export type PaymentDraft = Pick<Payment, "organizationId" | "invoiceId" | "reference" | "amount" | "currency" | "provider">;
export type TenantUserDraft = Pick<TenantUser, "organizationId" | "branchId" | "name" | "email" | "employeeId" | "role" | "department">;
export type PlatformUserDraft = Pick<PlatformUser, "name" | "email" | "role">;
export type BranchDraft = Pick<OrganizationBranch, "organizationId" | "name" | "facilityCode" | "address">;
export type IntegrationDraft = Pick<Integration, "organizationId" | "provider" | "category" | "environment">;
export type MutationResult = { ok: true; id: string } | { ok: false; error: string };

const uid = (prefix: string) => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

const subscriptionStatusMap: Partial<Record<Organization["status"], Subscription["status"]>> = { Active: "Active", Trial: "Trialing", "Payment Due": "Past Due", "Grace Period": "Grace Period", Suspended: "Suspended", Expired: "Expired", Terminated: "Cancelled" };
const licenseStatusMap: Partial<Record<Organization["status"], License["status"]>> = { Active: "Active", Trial: "Active", "Payment Due": "Expiring Soon", "Grace Period": "Grace Period", Suspended: "Suspended", Expired: "Expired", Terminated: "Revoked" };
const tenantStatusToSubscription = (status: Organization["status"]) => subscriptionStatusMap[status];
const tenantStatusToLicense = (status: Organization["status"]) => licenseStatusMap[status];

function applyTenantProjection(state: Pick<CommandCenterState, "subscriptions" | "licenses" | "entitlements">, organizationId: string) {
  if (organizationId !== useEntitlements.getState().org.id) return;
  const subscription = state.subscriptions.find((item) => item.organizationId === organizationId);
  const license = state.licenses.find((item) => item.organizationId === organizationId);
  if (!subscription || !license) return;
  useEntitlements.getState().applyResolved(resolveEntitlements(organizationId, subscription, license, state.entitlements));
}

export const useCommandCenter = create<CommandCenterState>(
  persisted<CommandCenterState>("command-center-v1", (set, get) => {
    const audit = (event: Omit<PlatformAuditEvent, "id" | "timestamp" | "correlationId" | "actorId" | "actorName" | "actorRole">, explicitActor?: PlatformUser) => {
      const actor = explicitActor ?? get().platformUsers[0];
      set((state) => ({ auditEvents: [{ ...event, id: uid("audit"), timestamp: new Date().toISOString(), correlationId: uid("corr"), actorId: actor.id, actorName: actor.name, actorRole: actor.role }, ...state.auditEvents] }));
    };

    return {
      organizations: seedOrganizations, branches: seedBranches, products: [...seedProducts, ...futureProducts], modules: seedModules,
      prices: seedPriceVersions, packages: seedPackages, packageVersions: seedPackageVersions,
      subscriptions: seedSubscriptions, entitlements: seedEntitlements, licenses: seedLicenses,
      platformUsers: seedPlatformUsers, tenantUsers: seedTenantUsers, sessions: seedSessions,
      invoices: seedInvoices, payments: seedPayments, documents: seedDocuments, workflows: seedWorkflows,
      onboardingTasks: seedOnboardingTasks, themes: seedThemes, featureFlags: seedFeatureFlags,
      integrations: seedIntegrations, incidents: seedIncidents, serviceHealth: seedHealth, usage: seedUsage,
      auditEvents: seedAuditEvents, notificationTemplates: seedNotificationTemplates,
      supportAccessSessions: [], customRoles: [], platformSettings: {},
      provisioningCommits: [],
      recordAuditEvent: (event, actorId) => {
        const actor = get().platformUsers.find((item) => item.id === actorId);
        if (actor) audit(event, actor);
      },

      createOrganization: (input) => {
        if (input.name.trim().length < 3) throw new Error("Organization name must be at least 3 characters.");
        if (!input.email.includes("@")) throw new Error("Provide a valid primary email address.");
        const id = uid("org");
        const now = new Date().toISOString();
        const sequence = get().organizations.length + 1;
        const slug = input.domain.trim().toLowerCase().replace(/^https?:\/\//, "").split(".")[0].replace(/[^a-z0-9-]/g, "-") || `tenant-${sequence}`;
        const organization: Organization = {
          id, tenantId: `TEN-${String(sequence).padStart(4, "0")}`, name: input.name.trim(), legalName: input.name.trim(), slug,
          type: input.type, registrationNumber: "Pending verification", country: input.country, state: input.state,
          address: "Pending onboarding", email: input.email.trim(), phone: input.phone.trim(), domain: input.domain.trim(),
          primaryContact: "Pending assignment", accountManager: "Unassigned", implementationManager: "Unassigned",
          status: "Prospect", billingStatus: "Current", onboardingStatus: "Not Started", activeUsers: 0, licensedUsers: 0,
          storageUsedGb: 0, storageLimitGb: 0, branchCount: 0, createdDate: now.slice(0, 10), timezone: "Africa/Lagos",
          locale: "en-NG", currency: "NGN", createdAt: now, updatedAt: now, createdBy: get().platformUsers[0].id,
        };
        set((state) => ({ organizations: [organization, ...state.organizations] }));
        audit({ organizationId: id, resourceType: "Organization", resourceId: id, action: "Created organization prospect", newValue: { name: organization.name, tenantId: organization.tenantId } });
        return id;
      },

      setOrganizationStatus: (organizationId, status, rawReason) => {
        const reason = validateReason(rawReason);
        const before = get().organizations.find((item) => item.id === organizationId)?.status;
        const subscriptionStatus = tenantStatusToSubscription(status);
        const licenseStatus = tenantStatusToLicense(status);
        set((state) => ({
          organizations: state.organizations.map((item) => item.id === organizationId ? { ...item, status, updatedAt: new Date().toISOString() } : item),
          subscriptions: subscriptionStatus ? state.subscriptions.map((item) => item.organizationId === organizationId ? { ...item, status: subscriptionStatus, updatedAt: new Date().toISOString() } : item) : state.subscriptions,
          licenses: licenseStatus ? state.licenses.map((item) => item.organizationId === organizationId ? { ...item, status: licenseStatus, updatedAt: new Date().toISOString() } : item) : state.licenses,
        }));
        audit({ organizationId, resourceType: "Organization", resourceId: organizationId, action: `Changed organization status to ${status}`, previousValue: before, newValue: status, reason });
        applyTenantProjection(get(), organizationId);
      },

      setModuleEntitlement: (organizationId, moduleKey, enabled, rawReason) => {
        const reason = validateReason(rawReason);
        const subscription = get().subscriptions.find((item) => item.organizationId === organizationId);
        if (!subscription) throw new Error("This organization does not have a subscription.");
        const license = get().licenses.find((item) => item.organizationId === organizationId);
        if (!license) throw new Error("This organization does not have a license.");
        const beforeResolved = resolveEntitlements(organizationId, subscription, license, get().entitlements);
        const wasEnabled = !!beforeResolved.modules[moduleKey];
        const now = new Date();
        const nowIso = now.toISOString();
        const closedAt = new Date(now.getTime() - 1).toISOString();
        const grant: Entitlement = { id: uid("ent"), organizationId, subscriptionId: subscription.id, targetType: "module", targetKey: moduleKey, source: enabled ? "override" : "revocation", enabled, validFrom: nowIso, reason, createdAt: nowIso, updatedAt: nowIso, createdBy: get().platformUsers[0].id };
        const catalogModule = get().modules.find((item) => item.key === moduleKey);
        const includedInSnapshot = subscription.snapshotModuleIds.includes(moduleKey);
        const priceDelta = enabled && !wasEnabled && !includedInSnapshot
          ? catalogModule?.price ?? 0
          : !enabled && wasEnabled && !includedInSnapshot
            ? -(catalogModule?.price ?? 0)
            : 0;
        set((state) => ({
          entitlements: [
            ...state.entitlements.map((item) => item.organizationId === organizationId && item.targetType === "module" && item.targetKey === moduleKey && !item.validUntil ? { ...item, validUntil: closedAt, updatedAt: nowIso } : item),
            grant,
          ],
          subscriptions: priceDelta ? state.subscriptions.map((item) => {
            if (item.id !== subscription.id) return item;
            const addOnAmount = Math.max(0, item.addOnAmount + priceDelta);
            const tax = Math.round((item.baseAmount + addOnAmount - item.discount) * 0.075);
            return { ...item, addOnAmount, tax, finalAmount: item.baseAmount + addOnAmount - item.discount + tax, updatedAt: nowIso };
          }) : state.subscriptions,
        }));
        audit({ organizationId, resourceType: "Entitlement", resourceId: moduleKey, action: `${enabled ? "Enabled" : "Disabled"} module`, previousValue: wasEnabled, newValue: enabled, reason });
        applyTenantProjection(get(), organizationId);
      },

      updateThemeColor: (organizationId, key, rawColor) => {
        const color = validateHexColor(rawColor);
        const before = get().themes.find((item) => item.organizationId === organizationId)?.colors[key];
        set((state) => ({ themes: state.themes.map((item) => item.organizationId === organizationId ? { ...item, colors: { ...item.colors, [key]: color }, updatedAt: new Date().toISOString() } : item) }));
        audit({ organizationId, resourceType: "ThemeConfiguration", resourceId: `theme-${organizationId}`, action: `Changed ${key} color`, previousValue: before, newValue: color });
      },

      updateThemeIdentity: (organizationId, values) => {
        const before = get().themes.find((item) => item.organizationId === organizationId);
        set((state) => ({ themes: state.themes.map((item) => item.organizationId === organizationId ? { ...item, ...values, updatedAt: new Date().toISOString() } : item) }));
        audit({ organizationId, resourceType: "ThemeConfiguration", resourceId: `theme-${organizationId}`, action: "Updated tenant display identity", previousValue: { organizationDisplayName: before?.organizationDisplayName, productDisplayName: before?.productDisplayName }, newValue: values });
      },

      reviewDocument: (documentId, status, rawReason) => {
        const reason = validateReason(rawReason);
        const document = get().documents.find((item) => item.id === documentId);
        if (!document) return;
        set((state) => ({ documents: state.documents.map((item) => item.id === documentId ? { ...item, status, verifiedBy: state.platformUsers[0].id, verifiedAt: new Date().toISOString(), notes: reason, updatedAt: new Date().toISOString() } : item) }));
        audit({ organizationId: document.organizationId, resourceType: "OrganizationDocument", resourceId: documentId, action: `${status} document`, previousValue: document.status, newValue: status, reason });
      },

      revokeSession: (sessionId, rawReason) => {
        const reason = validateReason(rawReason);
        const session = get().sessions.find((item) => item.id === sessionId);
        if (!session) return;
        set((state) => ({ sessions: state.sessions.map((item) => item.id === sessionId ? { ...item, status: "Revoked", updatedAt: new Date().toISOString() } : item) }));
        audit({ organizationId: session.organizationId, resourceType: "IdentitySession", resourceId: sessionId, action: "Revoked session", previousValue: "Active", newValue: "Revoked", reason });
      },

      updateOnboardingTask: (taskId, status) => {
        const task = get().onboardingTasks.find((item) => item.id === taskId);
        if (!task) return;
        set((state) => ({ onboardingTasks: state.onboardingTasks.map((item) => item.id === taskId ? { ...item, status, completedAt: status === "Completed" ? new Date().toISOString() : undefined, updatedAt: new Date().toISOString() } : item) }));
        audit({ organizationId: task.organizationId, resourceType: "OnboardingTask", resourceId: taskId, action: `Set onboarding task to ${status}`, previousValue: task.status, newValue: status });
      },

      toggleFeatureFlag: (flagId) => {
        const flag = get().featureFlags.find((item) => item.id === flagId);
        if (!flag) return;
        const next = flag.status === "Enabled" ? "Disabled" : "Enabled";
        set((state) => ({ featureFlags: state.featureFlags.map((item) => item.id === flagId ? { ...item, status: next, updatedAt: new Date().toISOString() } : item) }));
        audit({ resourceType: "FeatureFlag", resourceId: flagId, action: `${next} feature flag`, previousValue: flag.status, newValue: next });
      },

      clonePackage: (packageId) => {
        const source = get().packages.find((item) => item.id === packageId);
        const sourceVersion = get().packageVersions.find((item) => item.id === source?.currentVersionId);
        if (!source || !sourceVersion) return;
        const packageIdNext = uid("pkg");
        const versionId = uid("pkgv");
        set((state) => ({ packages: [...state.packages, { ...source, id: packageIdNext, code: `${source.code}-COPY`, name: `${source.name} Copy`, recommended: false, currentVersionId: versionId, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }], packageVersions: [...state.packageVersions, { ...sourceVersion, id: versionId, packageId: packageIdNext, version: 1, status: "Draft", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }] }));
        audit({ resourceType: "Package", resourceId: packageIdNext, action: `Cloned package ${source.name}`, newValue: { sourcePackageId: packageId } });
      },

      createProduct: (input, actorId) => {
        const actor = get().platformUsers.find((item) => item.id === actorId);
        if (!actor || !hasPermission(actor, "catalog.manage")) return { ok: false, error: "You do not have permission to create catalog products." };
        if (input.name.trim().length < 3 || !input.description.trim() || !input.version.trim()) return { ok: false, error: "Name, description and version are required." };
        const baseId = input.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
        if (!baseId) return { ok: false, error: "Enter a product name that can form a catalog identifier." };
        let id = baseId; let sequence = 2;
        while (get().products.some((item) => item.id === id)) id = `${baseId}-${sequence++}`;
        const now = new Date().toISOString();
        const product: ProductCatalogItem = { ...input, id, moduleIds: [], createdAt: now, updatedAt: now, createdBy: actor.id };
        set((state) => ({ products: [...state.products, product] }));
        audit({ resourceType: "ProductCatalogItem", resourceId: id, action: "Created catalog product", newValue: product }, actor);
        return { ok: true, id };
      },

      updateProduct: (productId, input, actorId, rawReason) => {
        const actor = get().platformUsers.find((item) => item.id === actorId);
        const previous = get().products.find((item) => item.id === productId);
        if (!actor || !hasPermission(actor, "catalog.manage")) return { ok: false, error: "You do not have permission to edit catalog products." };
        if (!previous) return { ok: false, error: "Product not found." };
        let reason: string; try { reason = validateReason(rawReason); } catch { return { ok: false, error: "Provide a reason of at least eight characters." }; }
        if (input.name.trim().length < 3 || !input.description.trim() || !input.version.trim()) return { ok: false, error: "Name, description and version are required." };
        const updated: ProductCatalogItem = { ...previous, ...input, updatedAt: new Date().toISOString() };
        set((state) => ({ products: state.products.map((item) => item.id === productId ? updated : item) }));
        audit({ resourceType: "ProductCatalogItem", resourceId: productId, action: "Updated catalog product", previousValue: previous, newValue: updated, reason }, actor);
        return { ok: true, id: productId };
      },

      createModule: (input, actorId) => {
        const actor = get().platformUsers.find((item) => item.id === actorId);
        const product = get().products.find((item) => item.id === input.productId);
        if (!actor || !hasPermission(actor, "catalog.manage")) return { ok: false, error: "You do not have permission to create catalog modules." };
        if (!product) return { ok: false, error: "Select a valid product." };
        if (!input.key.trim() || !input.name.trim() || !input.description.trim()) return { ok: false, error: "Module key, name and description are required." };
        if (get().modules.some((item) => item.key.toLowerCase() === input.key.trim().toLowerCase())) return { ok: false, error: "That module key already exists." };
        if (input.price < 0) return { ok: false, error: "Module price cannot be negative." };
        const now = new Date().toISOString(); const id = input.key.trim().toLowerCase();
        const module: ModuleCatalogItem = { ...input, id, key: id, createdAt: now, updatedAt: now, createdBy: actor.id };
        set((state) => ({ modules: [...state.modules, module], products: state.products.map((item) => item.id === product.id ? { ...item, moduleIds: [...new Set([...item.moduleIds, id])], updatedAt: now } : item) }));
        audit({ resourceType: "ModuleCatalogItem", resourceId: id, action: "Created catalog module", newValue: module }, actor);
        return { ok: true, id };
      },

      savePriceVersion: (input, actorId) => {
        const actor = get().platformUsers.find((item) => item.id === actorId);
        const module = get().modules.find((item) => item.id === input.moduleId);
        if (!actor || !hasPermission(actor, "pricing.manage")) return { ok: false, error: "You do not have permission to manage prices." };
        if (!module) return { ok: false, error: "Select a valid catalog module." };
        if (!Number.isFinite(input.amount) || input.amount < 0 || !input.effectiveFrom) return { ok: false, error: "Enter a non-negative amount and effective date." };
        if (get().prices.some((item) => item.moduleId === input.moduleId && item.currency === input.currency && item.effectiveFrom === input.effectiveFrom && item.status !== "Retired")) return { ok: false, error: "A price already exists for this module, currency and effective date." };
        const now = new Date(); const nowIso = now.toISOString(); const today = nowIso.slice(0, 10);
        const status: PriceVersion["status"] = input.effectiveFrom <= today ? "Active" : "Scheduled";
        const id = uid("price");
        const price: PriceVersion = { ...input, id, status, createdAt: nowIso, updatedAt: nowIso, createdBy: actor.id };
        const prior = get().prices.filter((item) => item.moduleId === input.moduleId && item.currency === input.currency && item.status === "Active");
        const previousDay = new Date(`${input.effectiveFrom}T12:00:00`); previousDay.setDate(previousDay.getDate() - 1);
        set((state) => ({
          prices: [price, ...state.prices.map((item) => status === "Active" && prior.some((entry) => entry.id === item.id) ? { ...item, status: "Retired" as const, effectiveTo: previousDay.toISOString().slice(0, 10), updatedAt: nowIso } : item)],
          modules: status === "Active" ? state.modules.map((item) => item.id === module.id ? { ...item, price: input.amount, currency: input.currency, pricingUnit: input.pricingUnit, updatedAt: nowIso } : item) : state.modules,
        }));
        audit({ resourceType: "PriceVersion", resourceId: id, action: `${status} price version`, previousValue: prior, newValue: price }, actor);
        return { ok: true, id };
      },

      savePackageDraft: (packageId, input, actorId, rawReason) => {
        const actor = get().platformUsers.find((item) => item.id === actorId);
        if (!actor || !hasPermission(actor, "catalog.manage")) return { ok: false, error: "You do not have permission to manage packages." };
        if (input.code.trim().length < 2 || input.name.trim().length < 2 || !input.description.trim()) return { ok: false, error: "Package code, name and description are required." };
        if (input.monthlyPrice < 0 || input.annualPrice < 0 || input.minimumUsers < 1 || input.branchLimit < 1 || input.storageLimitGb < 1) return { ok: false, error: "Prices cannot be negative and package limits must be positive." };
        if (!input.moduleIds.length) return { ok: false, error: "Select at least one module." };
        if (input.moduleIds.some((id) => !get().modules.some((module) => module.id === id))) return { ok: false, error: "Package scope contains an unknown module." };
        const now = new Date().toISOString();
        if (!packageId) {
          if (get().packages.some((item) => item.code.toLowerCase() === input.code.trim().toLowerCase())) return { ok: false, error: "That package code already exists." };
          const newPackageId = uid("pkg"); const versionId = uid("pkgv");
          const pkg: Package = { id: newPackageId, code: input.code.trim().toUpperCase(), name: input.name.trim(), description: input.description.trim(), trialDurationDays: input.trialDurationDays, recommended: input.recommended, active: false, minimumUsers: input.minimumUsers, maximumUsers: input.maximumUsers, branchLimit: input.branchLimit, storageLimitGb: input.storageLimitGb, supportLevel: input.supportLevel, currentVersionId: versionId, createdAt: now, updatedAt: now, createdBy: actor.id };
          const version: PackageVersion = { id: versionId, packageId: newPackageId, version: 1, effectiveFrom: input.effectiveFrom, monthlyPrice: input.monthlyPrice, annualPrice: input.annualPrice, currency: input.currency, moduleIds: input.moduleIds, status: "Draft", createdAt: now, updatedAt: now, createdBy: actor.id };
          set((state) => ({ packages: [...state.packages, pkg], packageVersions: [...state.packageVersions, version] }));
          audit({ resourceType: "Package", resourceId: newPackageId, action: "Created package draft", newValue: { package: pkg, version } }, actor);
          return { ok: true, id: newPackageId };
        }
        const pkg = get().packages.find((item) => item.id === packageId);
        if (!pkg) return { ok: false, error: "Package not found." };
        let reason: string; try { reason = validateReason(rawReason ?? ""); } catch { return { ok: false, error: "Provide a reason of at least eight characters." }; }
        const latest = [...get().packageVersions.filter((item) => item.packageId === packageId)].sort((a, b) => b.version - a.version)[0];
        const draftVersion = latest?.status === "Draft" ? latest : undefined;
        const versionId = draftVersion?.id ?? uid("pkgv");
        const version: PackageVersion = { id: versionId, packageId, version: draftVersion?.version ?? (latest?.version ?? 0) + 1, effectiveFrom: input.effectiveFrom, monthlyPrice: input.monthlyPrice, annualPrice: input.annualPrice, currency: input.currency, moduleIds: input.moduleIds, inheritedFromVersionId: draftVersion?.inheritedFromVersionId ?? (latest?.status === "Published" ? latest.id : undefined), status: "Draft", createdAt: draftVersion?.createdAt ?? now, updatedAt: now, createdBy: draftVersion?.createdBy ?? actor.id };
        const updated: Package = { ...pkg, code: input.code.trim().toUpperCase(), name: input.name.trim(), description: input.description.trim(), trialDurationDays: input.trialDurationDays, recommended: input.recommended, minimumUsers: input.minimumUsers, maximumUsers: input.maximumUsers, branchLimit: input.branchLimit, storageLimitGb: input.storageLimitGb, supportLevel: input.supportLevel, updatedAt: now };
        set((state) => ({ packages: state.packages.map((item) => item.id === packageId ? updated : item), packageVersions: draftVersion ? state.packageVersions.map((item) => item.id === versionId ? version : item) : [...state.packageVersions, version] }));
        audit({ resourceType: "Package", resourceId: packageId, action: `Saved package v${version.version} draft`, previousValue: { package: pkg, version: latest }, newValue: { package: updated, version }, reason }, actor);
        return { ok: true, id: versionId };
      },

      publishPackageVersion: (packageId, versionId, actorId, rawReason) => {
        const actor = get().platformUsers.find((item) => item.id === actorId);
        const pkg = get().packages.find((item) => item.id === packageId);
        const version = get().packageVersions.find((item) => item.id === versionId && item.packageId === packageId);
        if (!actor || !hasPermission(actor, "catalog.manage") || !hasPermission(actor, "pricing.manage")) return { ok: false, error: "Publishing requires catalog and pricing permissions." };
        if (!pkg || !version || version.status !== "Draft") return { ok: false, error: "Only a draft package version can be published." };
        let reason: string; try { reason = validateReason(rawReason); } catch { return { ok: false, error: "Provide a publication reason of at least eight characters." }; }
        const now = new Date().toISOString(); const previousVersion = get().packageVersions.find((item) => item.id === pkg.currentVersionId && item.status === "Published");
        set((state) => ({
          packages: state.packages.map((item) => item.id === packageId ? { ...item, currentVersionId: versionId, active: true, updatedAt: now } : pkg.recommended && item.recommended ? { ...item, recommended: false, updatedAt: now } : item),
          packageVersions: state.packageVersions.map((item) => item.id === versionId ? { ...item, status: "Published", updatedAt: now } : item.id === previousVersion?.id ? { ...item, status: "Retired", effectiveTo: new Date(new Date(`${version.effectiveFrom}T12:00:00`).getTime() - 86_400_000).toISOString().slice(0, 10), updatedAt: now } : item),
        }));
        audit({ resourceType: "PackageVersion", resourceId: versionId, action: `Published package v${version.version}`, previousValue: previousVersion, newValue: version, reason }, actor);
        return { ok: true, id: versionId };
      },

      createCustomerInvoice: (input, actorId) => {
        const actor = get().platformUsers.find((item) => item.id === actorId);
        const subscription = get().subscriptions.find((item) => item.id === input.subscriptionId && item.organizationId === input.organizationId);
        if (!actor || !hasPermission(actor, "billing.manage")) return { ok: false, error: "You do not have permission to create customer invoices." };
        if (!subscription) return { ok: false, error: "Select a valid organization subscription." };
        if (!input.billingPeriod.trim() || !input.dueDate || input.subtotal < 0 || input.tax < 0) return { ok: false, error: "Billing period, due date and non-negative amounts are required." };
        const now = new Date().toISOString(); const id = uid("inv");
        const invoice: CustomerInvoice = { ...input, id, number: `SABI-${String(10000 + get().invoices.length + 1)}`, total: input.subtotal + input.tax, status: "Issued", createdAt: now, updatedAt: now, createdBy: actor.id };
        set((state) => ({ invoices: [invoice, ...state.invoices] }));
        audit({ organizationId: input.organizationId, resourceType: "CustomerInvoice", resourceId: id, action: "Created customer subscription invoice", newValue: invoice }, actor);
        return { ok: true, id };
      },

      recordCustomerPayment: (input, actorId) => {
        const actor = get().platformUsers.find((item) => item.id === actorId);
        const invoice = get().invoices.find((item) => item.id === input.invoiceId && item.organizationId === input.organizationId);
        if (!actor || !hasPermission(actor, "billing.manage")) return { ok: false, error: "You do not have permission to record customer payments." };
        if (!invoice) return { ok: false, error: "Select a valid invoice." };
        if (input.reference.trim().length < 4 || input.amount <= 0) return { ok: false, error: "A reference and positive payment amount are required." };
        if (get().payments.some((item) => item.reference.toLowerCase() === input.reference.trim().toLowerCase())) return { ok: false, error: "That payment reference already exists." };
        const previouslyPaid = get().payments.filter((item) => item.invoiceId === invoice.id && item.status === "Succeeded").reduce((sum, item) => sum + item.amount, 0);
        const remaining = Math.max(0, invoice.total - previouslyPaid);
        if (input.amount > remaining) return { ok: false, error: `Payment exceeds the outstanding balance of ${remaining.toLocaleString()} ${invoice.currency}.` };
        const now = new Date().toISOString(); const id = uid("pay");
        const payment: Payment = { ...input, id, reference: input.reference.trim(), status: "Succeeded", paidAt: now, createdAt: now, updatedAt: now, createdBy: actor.id };
        const nextPaid = previouslyPaid + input.amount; const invoiceStatus: CustomerInvoice["status"] = nextPaid >= invoice.total ? "Paid" : "Partially Paid";
        set((state) => ({ payments: [payment, ...state.payments], invoices: state.invoices.map((item) => item.id === invoice.id ? { ...item, status: invoiceStatus, paidDate: invoiceStatus === "Paid" ? now : undefined, updatedAt: now } : item) }));
        audit({ organizationId: input.organizationId, resourceType: "Payment", resourceId: id, action: "Recorded customer payment", previousValue: { invoiceStatus: invoice.status, outstanding: remaining }, newValue: { payment, invoiceStatus, outstanding: remaining - input.amount } }, actor);
        return { ok: true, id };
      },

      addDocumentRequest: (organizationId, category, type, actorId) => {
        const actor = get().platformUsers.find((item) => item.id === actorId);
        if (!actor || !hasPermission(actor, "documents.verify")) return { ok: false, error: "You do not have permission to manage document requests." };
        if (!get().organizations.some((item) => item.id === organizationId) || type.trim().length < 3) return { ok: false, error: "Select an organization and enter a document name." };
        const now = new Date().toISOString(); const id = uid("doc");
        const document: OrganizationDocument = { id, organizationId, category, type: type.trim(), version: 1, status: "Missing", createdAt: now, updatedAt: now, createdBy: actor.id };
        set((state) => ({ documents: [document, ...state.documents] }));
        audit({ organizationId, resourceType: "OrganizationDocument", resourceId: id, action: "Created document request", newValue: { category, type: type.trim() } }, actor);
        return { ok: true, id };
      },

      inviteTenantUser: (input, actorId) => {
        const actor = get().platformUsers.find((item) => item.id === actorId);
        if (!actor || !hasPermission(actor, "identity.manage")) return { ok: false, error: "You do not have permission to invite tenant users." };
        if (!input.email.includes("@") || input.name.trim().length < 2) return { ok: false, error: "Enter a name and valid email address." };
        if (get().tenantUsers.some((item) => item.email.toLowerCase() === input.email.toLowerCase())) return { ok: false, error: "A tenant user with this email already exists." };
        const now = new Date().toISOString(); const id = uid("tuser");
        const user: TenantUser = { ...input, id, name: input.name.trim(), email: input.email.trim().toLowerCase(), status: "Invited", mfaEnabled: false, createdAt: now, updatedAt: now, createdBy: actor.id };
        set((state) => ({ tenantUsers: [user, ...state.tenantUsers] }));
        audit({ organizationId: input.organizationId, resourceType: "TenantUser", resourceId: id, action: "Invited tenant user", newValue: { email: user.email, role: user.role } }, actor);
        return { ok: true, id };
      },

      invitePlatformUser: (input, actorId) => {
        const actor = get().platformUsers.find((item) => item.id === actorId);
        if (!actor || !hasPermission(actor, "identity.manage")) return { ok: false, error: "You do not have permission to invite platform users." };
        if (!input.email.includes("@") || input.name.trim().length < 2) return { ok: false, error: "Enter a name and valid email address." };
        if (get().platformUsers.some((item) => item.email.toLowerCase() === input.email.toLowerCase())) return { ok: false, error: "A platform user with this email already exists." };
        const now = new Date().toISOString(); const id = uid("puser");
        const user: PlatformUser = { ...input, id, name: input.name.trim(), email: input.email.trim().toLowerCase(), permissions: [], status: "Invited", mfaEnabled: false, createdAt: now, updatedAt: now, createdBy: actor.id };
        set((state) => ({ platformUsers: [user, ...state.platformUsers] }));
        audit({ resourceType: "PlatformUser", resourceId: id, action: "Invited internal user", newValue: { email: user.email, role: user.role } }, actor);
        return { ok: true, id };
      },

      addBranch: (input, actorId) => {
        const actor = get().platformUsers.find((item) => item.id === actorId);
        if (!actor || !hasPermission(actor, "organizations.manage")) return { ok: false, error: "You do not have permission to add facilities." };
        if (!input.name.trim() || !input.facilityCode.trim() || !input.address.trim()) return { ok: false, error: "Name, facility code and address are required." };
        if (get().branches.some((item) => item.facilityCode.toLowerCase() === input.facilityCode.toLowerCase())) return { ok: false, error: "That facility code is already in use." };
        const now = new Date().toISOString(); const id = uid("branch");
        const subscription = get().subscriptions.find((item) => item.organizationId === input.organizationId);
        const branch: OrganizationBranch = { ...input, id, facilityCode: input.facilityCode.trim().toUpperCase(), activeUsers: 0, departmentCount: 0, status: "Opening", moduleIds: [...(subscription?.snapshotModuleIds ?? [])], createdAt: now, updatedAt: now, createdBy: actor.id };
        set((state) => ({ branches: [branch, ...state.branches], organizations: state.organizations.map((item) => item.id === input.organizationId ? { ...item, branchCount: item.branchCount + 1, updatedAt: now } : item) }));
        audit({ organizationId: input.organizationId, resourceType: "OrganizationBranch", resourceId: id, action: "Added branch", newValue: { name: branch.name, facilityCode: branch.facilityCode } }, actor);
        return { ok: true, id };
      },

      addIntegration: (input, actorId) => {
        const actor = get().platformUsers.find((item) => item.id === actorId);
        if (!actor || !hasPermission(actor, "operations.manage")) return { ok: false, error: "You do not have permission to configure integrations." };
        if (!input.provider.trim() || !input.category.trim()) return { ok: false, error: "Provider and category are required." };
        const now = new Date().toISOString(); const id = uid("int");
        const integration: Integration = { ...input, id, provider: input.provider.trim(), category: input.category.trim(), status: "Disconnected", maskedCredential: "Not configured", errorCount: 0, createdAt: now, updatedAt: now, createdBy: actor.id };
        set((state) => ({ integrations: [integration, ...state.integrations] }));
        audit({ organizationId: input.organizationId, resourceType: "Integration", resourceId: id, action: "Created integration configuration", newValue: { provider: integration.provider, environment: integration.environment } }, actor);
        return { ok: true, id };
      },

      requestSupportAccess: (organizationId, rawReason, durationMinutes, actorId) => {
        const actor = get().platformUsers.find((item) => item.id === actorId);
        if (!actor || !hasPermission(actor, "support.access.request")) return { ok: false, error: "You do not have permission to request support access." };
        let reason: string; try { reason = validateReason(rawReason); } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Provide a reason." }; }
        const now = new Date(); const id = uid("support");
        const session: SupportAccessSession = { id, organizationId, requestedBy: actor.id, reason, startsAt: now.toISOString(), expiresAt: new Date(now.getTime() + durationMinutes * 60_000).toISOString(), status: "Requested", createdAt: now.toISOString(), updatedAt: now.toISOString(), createdBy: actor.id };
        set((state) => ({ supportAccessSessions: [session, ...state.supportAccessSessions] }));
        audit({ organizationId, resourceType: "SupportAccessSession", resourceId: id, action: "Requested time-bound support access", newValue: { durationMinutes }, reason }, actor);
        return { ok: true, id };
      },

      changeSubscriptionPackage: (subscriptionId, packageVersionId, actorId, rawReason) => {
        const actor = get().platformUsers.find((item) => item.id === actorId); const subscription = get().subscriptions.find((item) => item.id === subscriptionId); const version = get().packageVersions.find((item) => item.id === packageVersionId && item.status === "Published");
        if (!actor || !hasPermission(actor, "subscriptions.manage")) return { ok: false, error: "You do not have permission to change packages." };
        if (!subscription || !version) return { ok: false, error: "Select a published package version." };
        let reason: string; try { reason = validateReason(rawReason); } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Provide a reason." }; }
        const pkg = get().packages.find((item) => item.id === version.packageId); if (!pkg) return { ok: false, error: "Package not found." };
        const before = { packageId: subscription.packageId, packageVersionId: subscription.packageVersionId, finalAmount: subscription.finalAmount };
        const baseAmount = subscription.billingCycle === "Annual" ? version.annualPrice : version.monthlyPrice; const tax = Math.round(Math.max(0, baseAmount + subscription.addOnAmount - subscription.discount) * .075); const now = new Date().toISOString();
        set((state) => ({ subscriptions: state.subscriptions.map((item) => item.id === subscriptionId ? { ...item, packageId: pkg.id, packageVersionId: version.id, snapshotModuleIds: [...version.moduleIds], baseAmount, tax, finalAmount: baseAmount + item.addOnAmount - item.discount + tax, updatedAt: now } : item), licenses: state.licenses.map((item) => item.subscriptionId === subscriptionId ? { ...item, moduleIds: [...version.moduleIds], updatedAt: now } : item) }));
        audit({ organizationId: subscription.organizationId, resourceType: "Subscription", resourceId: subscriptionId, action: `Changed package to ${pkg.name}`, previousValue: before, newValue: { packageId: pkg.id, packageVersionId: version.id }, reason }, actor); applyTenantProjection(get(), subscription.organizationId);
        return { ok: true, id: subscriptionId };
      },

      applySubscriptionCredit: (subscriptionId, amount, actorId, rawReason) => {
        const actor = get().platformUsers.find((item) => item.id === actorId); const subscription = get().subscriptions.find((item) => item.id === subscriptionId);
        if (!actor || !hasPermission(actor, "billing.manage")) return { ok: false, error: "You do not have permission to apply credits." }; if (!subscription || amount <= 0) return { ok: false, error: "Enter a positive credit amount." };
        let reason: string; try { reason = validateReason(rawReason); } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Provide a reason." }; }
        const now = new Date().toISOString(); set((state) => ({ subscriptions: state.subscriptions.map((item) => item.id === subscriptionId ? { ...item, discount: item.discount + amount, finalAmount: Math.max(0, item.finalAmount - amount), updatedAt: now } : item) }));
        audit({ organizationId: subscription.organizationId, resourceType: "SubscriptionCredit", resourceId: uid("credit"), action: "Applied account credit", newValue: { amount, currency: subscription.currency }, reason }, actor); return { ok: true, id: subscriptionId };
      },

      renewSubscription: (subscriptionId, actorId, rawReason) => {
        const actor = get().platformUsers.find((item) => item.id === actorId); const subscription = get().subscriptions.find((item) => item.id === subscriptionId);
        if (!actor || !hasPermission(actor, "subscriptions.manage")) return { ok: false, error: "You do not have permission to renew subscriptions." }; if (!subscription) return { ok: false, error: "Subscription not found." };
        let reason: string; try { reason = validateReason(rawReason); } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Provide a reason." }; }
        const start = new Date(subscription.expirationDate); const months = subscription.billingCycle === "Annual" ? 12 : subscription.billingCycle === "Quarterly" ? 3 : 1; start.setMonth(start.getMonth() + months); const renewalDate = start.toISOString().slice(0, 10); const now = new Date().toISOString();
        set((state) => ({ subscriptions: state.subscriptions.map((item) => item.id === subscriptionId ? { ...item, status: "Active", renewalDate, expirationDate: renewalDate, updatedAt: now } : item), licenses: state.licenses.map((item) => item.subscriptionId === subscriptionId ? { ...item, status: "Active", validUntil: renewalDate, updatedAt: now } : item), organizations: state.organizations.map((item) => item.id === subscription.organizationId ? { ...item, status: "Active", expirationDate: renewalDate, updatedAt: now } : item) }));
        audit({ organizationId: subscription.organizationId, resourceType: "Subscription", resourceId: subscriptionId, action: "Renewed subscription", previousValue: subscription.expirationDate, newValue: renewalDate, reason }, actor); return { ok: true, id: subscriptionId };
      },

      createCustomRole: (name, permissions, actorId) => {
        const actor = get().platformUsers.find((item) => item.id === actorId); if (!actor || !hasPermission(actor, "identity.manage")) return { ok: false, error: "You do not have permission to create roles." }; if (name.trim().length < 3 || !permissions.length) return { ok: false, error: "Enter a role name and choose at least one permission." };
        const id = uid("role"); set((state) => ({ customRoles: [{ id, name: name.trim(), permissions: [...permissions], createdAt: new Date().toISOString(), createdBy: actor.id }, ...state.customRoles] })); audit({ resourceType: "CustomRole", resourceId: id, action: "Created custom role", newValue: { name: name.trim(), permissions } }, actor); return { ok: true, id };
      },

      declareIncident: (title, service, severity, actorId) => {
        const actor = get().platformUsers.find((item) => item.id === actorId); if (!actor || !hasPermission(actor, "operations.manage")) return { ok: false, error: "You do not have permission to declare incidents." }; if (title.trim().length < 5 || !service.trim()) return { ok: false, error: "Incident title and service are required." };
        const now = new Date().toISOString(); const id = uid("inc"); const incident: PlatformIncident = { id, title: title.trim(), service: service.trim(), severity, status: "Investigating", startedAt: now, createdAt: now, updatedAt: now, createdBy: actor.id }; set((state) => ({ incidents: [incident, ...state.incidents] })); audit({ resourceType: "PlatformIncident", resourceId: id, action: "Declared incident", newValue: { title: incident.title, service, severity } }, actor); return { ok: true, id };
      },

      refreshServiceHealth: (actorId) => {
        const actor = get().platformUsers.find((item) => item.id === actorId); if (!actor || !hasPermission(actor, "operations.manage")) return; const now = new Date().toISOString(); set((state) => ({ serviceHealth: state.serviceHealth.map((item) => ({ ...item, lastCheckedAt: now })) })); audit({ resourceType: "ServiceHealth", resourceId: "platform", action: "Refreshed health snapshot", newValue: { checkedAt: now } }, actor);
      },

      runIntegrationJob: (integrationId, actorId) => {
        const actor = get().platformUsers.find((item) => item.id === actorId); const integration = get().integrations.find((item) => item.id === integrationId); if (!actor || !hasPermission(actor, "operations.manage")) return { ok: false, error: "You do not have permission to run jobs." }; if (!integration) return { ok: false, error: "Integration job not found." };
        const now = new Date().toISOString(); set((state) => ({ integrations: state.integrations.map((item) => item.id === integrationId ? { ...item, status: "Connected", errorCount: 0, lastError: undefined, lastSyncAt: now, lastSuccessfulSyncAt: now, updatedAt: now } : item) })); audit({ organizationId: integration.organizationId, resourceType: "IntegrationJob", resourceId: integrationId, action: "Ran integration sync", newValue: { status: "Succeeded", completedAt: now } }, actor); return { ok: true, id: integrationId };
      },

      savePlatformSettings: (section, values, actorId) => {
        const actor = get().platformUsers.find((item) => item.id === actorId); if (!actor || (!hasPermission(actor, "security.manage") && !hasPermission(actor, "operations.manage"))) return { ok: false, error: "You do not have permission to save platform settings." };
        set((state) => ({ platformSettings: { ...state.platformSettings, [section]: { ...(state.platformSettings[section] ?? {}), ...values } } })); audit({ resourceType: "PlatformSettings", resourceId: section, action: `Saved ${section} settings`, newValue: values }, actor); return { ok: true, id: section };
      },

      createFeatureFlag: (name, key, description, actorId) => {
        const actor = get().platformUsers.find((item) => item.id === actorId); if (!actor || !hasPermission(actor, "operations.manage")) return { ok: false, error: "You do not have permission to create feature flags." }; const cleanKey = key.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "-"); if (name.trim().length < 3 || !cleanKey || !description.trim()) return { ok: false, error: "Name, unique key and description are required." }; if (get().featureFlags.some((item) => item.key === cleanKey)) return { ok: false, error: "That feature flag key already exists." };
        const now = new Date().toISOString(); const id = uid("flag"); const flag: FeatureFlag = { id, key: cleanKey, name: name.trim(), description: description.trim(), status: "Draft", targets: [{ type: "everyone", ids: [] }], createdAt: now, updatedAt: now, createdBy: actor.id }; set((state) => ({ featureFlags: [flag, ...state.featureFlags] })); audit({ resourceType: "FeatureFlag", resourceId: id, action: "Created feature flag", newValue: { key: cleanKey, name: flag.name } }, actor); return { ok: true, id };
      },

      createNotificationTemplate: (name, key, actorId) => {
        const actor = get().platformUsers.find((item) => item.id === actorId); if (!actor || !hasPermission(actor, "operations.manage")) return { ok: false, error: "You do not have permission to create notification templates." }; const cleanKey = key.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "-"); if (name.trim().length < 3 || !cleanKey) return { ok: false, error: "Name and unique key are required." }; if (get().notificationTemplates.some((item) => item.key === cleanKey)) return { ok: false, error: "That template key already exists." };
        const now = new Date().toISOString(); const id = uid("notification"); const template: NotificationTemplate = { id, key: cleanKey, name: name.trim(), channels: ["Email"], subject: "", body: "", variables: [], status: "Draft", createdAt: now, updatedAt: now, createdBy: actor.id }; set((state) => ({ notificationTemplates: [template, ...state.notificationTemplates] })); audit({ resourceType: "NotificationTemplate", resourceId: id, action: "Created notification template", newValue: { key: cleanKey, name: template.name } }, actor); return { ok: true, id };
      },

      updateNotificationTemplate: (templateId, values, actorId) => {
        const actor = get().platformUsers.find((item) => item.id === actorId); const template = get().notificationTemplates.find((item) => item.id === templateId); if (!actor || !hasPermission(actor, "operations.manage")) return { ok: false, error: "You do not have permission to update notification templates." }; if (!template || !values.subject.trim() || !values.body.trim() || !values.channels.length) return { ok: false, error: "Subject, message and at least one channel are required." };
        const now = new Date().toISOString(); set((state) => ({ notificationTemplates: state.notificationTemplates.map((item) => item.id === templateId ? { ...item, ...values, status: "Active", updatedAt: now } : item) })); audit({ resourceType: "NotificationTemplate", resourceId: templateId, action: "Updated notification template", previousValue: { subject: template.subject, channels: template.channels }, newValue: values }, actor); return { ok: true, id: templateId };
      },

      commitProvisionedTenant: (input, actorId) => {
        const existing = get().provisioningCommits.find((item) => item.idempotencyKey === input.idempotencyKey);
        if (existing) return { organizationId: existing.organizationId };
        const actor = get().platformUsers.find((item) => item.id === actorId);
        if (!actor || !hasPermission(actor, "organizations.manage") || !hasPermission(actor, "subscriptions.manage")) return { error: "Provisioning requires organization and subscription permissions." };
        const selectedPackage = get().packages.find((item) => item.id === input.packageId && item.active);
        const packageVersion = get().packageVersions.find((item) => item.id === input.packageVersionId && item.packageId === input.packageId && item.status === "Published");
        if (!selectedPackage || !packageVersion) return { error: "The accepted package snapshot is no longer provisionable." };
        if (input.name.trim().length < 3 || !input.ownerEmail.includes("@") || input.userLimit < 1 || input.branchLimit < 1 || input.storageLimitGb < 1) return { error: "The provisioning payload is incomplete." };
        const nowDate = new Date();
        const nowIso = nowDate.toISOString();
        const startDate = nowIso.slice(0, 10);
        const renewal = new Date(nowDate);
        if (input.billingCycle === "Annual") renewal.setFullYear(renewal.getFullYear() + 1);
        else renewal.setMonth(renewal.getMonth() + 1);
        const expirationDate = renewal.toISOString().slice(0, 10);
        const sequence = get().organizations.length + 1;
        const organizationId = uid("org");
        const tenantId = `TEN-${String(sequence).padStart(4, "0")}`;
        const desiredSlug = (input.domain || input.name).trim().toLowerCase().replace(/^https?:\/\//, "").split(".")[0].replace(/[^a-z0-9-]/g, "-").replace(/^-+|-+$/g, "") || `tenant-${sequence}`;
        const slug = get().organizations.some((item) => item.slug === desiredSlug) ? `${desiredSlug}-${sequence}` : desiredSlug;
        const subscriptionId = uid("sub");
        const licenseId = uid("lic");
        const branchId = uid("branch");
        const ownerId = uid("usr");
        const organization: Organization = {
          id: organizationId, tenantId, name: input.name.trim(), legalName: input.legalName.trim(), slug, type: input.type,
          registrationNumber: input.registrationNumber, country: input.country, state: input.state, address: input.address,
          email: input.email, phone: input.phone, domain: input.domain, primaryContact: input.primaryContact,
          accountManager: "Unassigned", implementationManager: actor.name, status: "Onboarding", billingStatus: "Current", onboardingStatus: "Not Started",
          activeUsers: 0, licensedUsers: input.userLimit, storageUsedGb: 0, storageLimitGb: input.storageLimitGb, branchCount: 1,
          createdDate: startDate, timezone: input.country === "Ghana" ? "Africa/Accra" : "Africa/Lagos", locale: input.country === "Nigeria" ? "en-NG" : "en", currency: packageVersion.currency,
          createdAt: nowIso, updatedAt: nowIso, createdBy: actor.id,
        };
        const subscription: Subscription = {
          id: subscriptionId, organizationId, packageId: input.packageId, packageVersionId: input.packageVersionId,
          status: input.paymentPath === "TRIAL" ? "Trialing" : "Active", billingCycle: input.billingCycle, currency: packageVersion.currency,
          baseAmount: input.baseAmount, addOnAmount: input.addOnAmount, discount: input.discount, tax: input.tax, finalAmount: input.finalAmount,
          startDate, trialEndDate: input.paymentPath === "TRIAL" ? new Date(nowDate.getTime() + selectedPackage.trialDurationDays * 86_400_000).toISOString().slice(0, 10) : undefined,
          renewalDate: expirationDate, expirationDate, gracePeriodDays: 14, autoRenewal: false, snapshotModuleIds: [...packageVersion.moduleIds],
          createdAt: nowIso, updatedAt: nowIso, createdBy: actor.id,
        };
        const license: License = {
          id: licenseId, organizationId, subscriptionId, type: input.paymentPath === "TRIAL" ? "Trial" : "Subscription",
          productIds: [...input.productIds], moduleIds: [...packageVersion.moduleIds], validFrom: startDate, validUntil: expirationDate,
          userLimit: input.userLimit, branchLimit: input.branchLimit, facilityLimit: input.facilityLimit, storageLimitGb: input.storageLimitGb,
          status: "Active", lastValidatedAt: nowIso, createdAt: nowIso, updatedAt: nowIso, createdBy: actor.id,
        };
        const branch: OrganizationBranch = {
          id: branchId, organizationId, name: "Main facility", facilityCode: `${tenantId}-MAIN`, address: input.address,
          activeUsers: 0, departmentCount: 0, status: "Opening", moduleIds: [...packageVersion.moduleIds],
          createdAt: nowIso, updatedAt: nowIso, createdBy: actor.id,
        };
        const owner: TenantUser = {
          id: ownerId, organizationId, branchId, name: input.primaryContact, email: input.ownerEmail, employeeId: "OWNER-001",
          role: "Organization Administrator", department: "Administration", status: "Invited", mfaEnabled: false,
          createdAt: nowIso, updatedAt: nowIso, createdBy: actor.id,
        };
        const commit: ProvisioningCommit = { idempotencyKey: input.idempotencyKey, applicationId: input.applicationId, commercialOpportunityId: input.commercialOpportunityId, organizationId, committedAt: nowIso, committedBy: actor.id };
        set((state) => ({
          organizations: [organization, ...state.organizations], branches: [branch, ...state.branches], subscriptions: [subscription, ...state.subscriptions],
          licenses: [license, ...state.licenses], tenantUsers: [owner, ...state.tenantUsers], provisioningCommits: [commit, ...state.provisioningCommits],
        }));
        audit({ organizationId, resourceType: "TenantProvisioning", resourceId: input.applicationId, action: "Atomically created onboarding control-plane records", newValue: { tenantId, slug, subscriptionId, licenseId, branchId, ownerId }, reason: input.idempotencyKey });
        return { organizationId };
      },

      activateProvisionedTenant: (organizationId, actorId, rawReason) => {
        const actor = get().platformUsers.find((item) => item.id === actorId);
        if (!actor || !hasPermission(actor, "organizations.manage") || !hasPermission(actor, "onboarding.manage")) return { ok: false, error: "Go-live requires organization and onboarding permissions." };
        let reason: string;
        try { reason = validateReason(rawReason); } catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Provide an activation reason." }; }
        const organization = get().organizations.find((item) => item.id === organizationId);
        const subscription = get().subscriptions.find((item) => item.organizationId === organizationId);
        const license = get().licenses.find((item) => item.organizationId === organizationId);
        const branch = get().branches.find((item) => item.organizationId === organizationId);
        const owner = get().tenantUsers.find((item) => item.organizationId === organizationId && item.role === "Organization Administrator");
        if (!organization || organization.status !== "Onboarding") return { ok: false, error: "Only an onboarding organization can be activated through first-run setup." };
        if (!subscription || !["Active", "Trialing"].includes(subscription.status)) return { ok: false, error: "The subscription is not eligible for go-live." };
        if (!license || license.status !== "Active") return { ok: false, error: "The tenant license is not active." };
        if (!branch || branch.status !== "Opening" || !owner) return { ok: false, error: "The primary branch or organization owner is missing." };
        const activatedAt = new Date().toISOString();
        const status: Organization["status"] = subscription.status === "Trialing" ? "Trial" : "Active";
        set((state) => ({
          organizations: state.organizations.map((item) => item.id === organizationId ? { ...item, status, onboardingStatus: "Live", activationDate: activatedAt.slice(0, 10), lastActivityAt: activatedAt, activeUsers: Math.max(1, item.activeUsers), updatedAt: activatedAt } : item),
          branches: state.branches.map((item) => item.id === branch.id ? { ...item, status: "Active", activeUsers: Math.max(1, item.activeUsers), updatedAt: activatedAt } : item),
          tenantUsers: state.tenantUsers.map((item) => item.id === owner.id ? { ...item, status: "Active", updatedAt: activatedAt } : item),
        }));
        audit({ organizationId, resourceType: "TenantSetup", resourceId: organizationId, action: "Activated tenant after first-run readiness approval", previousValue: { status: organization.status, onboardingStatus: organization.onboardingStatus }, newValue: { status, onboardingStatus: "Live", branchStatus: "Active", ownerStatus: "Active" }, reason }, actor);
        applyTenantProjection(get(), organizationId);
        return { ok: true };
      },
    };
  }, { scope: "global", pick: (state) => ({ organizations: state.organizations, branches: state.branches, products: state.products, modules: state.modules, prices: state.prices, packages: state.packages, packageVersions: state.packageVersions, subscriptions: state.subscriptions, entitlements: state.entitlements, licenses: state.licenses, platformUsers: state.platformUsers, tenantUsers: state.tenantUsers, documents: state.documents, onboardingTasks: state.onboardingTasks, themes: state.themes, featureFlags: state.featureFlags, sessions: state.sessions, integrations: state.integrations, incidents: state.incidents, serviceHealth: state.serviceHealth, auditEvents: state.auditEvents, notificationTemplates: state.notificationTemplates, invoices: state.invoices, payments: state.payments, supportAccessSessions: state.supportAccessSessions, customRoles: state.customRoles, platformSettings: state.platformSettings, provisioningCommits: state.provisioningCommits }) }),
);
