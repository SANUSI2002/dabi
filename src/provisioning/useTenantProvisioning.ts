import { create } from "zustand";
import { hasPermission } from "@/command-center/access";
import type { Organization, PlatformUser, ProvisionTenantInput } from "@/command-center/domain";
import { useCommandCenter } from "@/command-center/useCommandCenter";
import { useCommercialOnboarding } from "@/commercial/useCommercialOnboarding";
import { persisted } from "@/platform/persist";
import { useRegistration } from "@/registration/useRegistration";
import { useAuth } from "@/store/useAuth";
import type { ProvisioningAuditEvent, ProvisioningStepKey, ProvisioningStepStatus, TenantProvisioningJob } from "./domain";

type ActionResult = { ok: true } | { ok: false; error: string };
type ProvisioningState = {
  jobs: TenantProvisioningJob[];
  syncActiveAgreements: () => void;
  queueProvisioning: (applicationId: string) => ActionResult;
  runProvisioning: (applicationId: string) => Promise<ActionResult>;
  resetFailedJob: (applicationId: string) => ActionResult;
};
type ProvisioningSet = (partial: Partial<ProvisioningState> | ((state: ProvisioningState) => Partial<ProvisioningState>)) => void;

const uid = (prefix: string) => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
const now = () => new Date().toISOString();
const wait = () => new Promise((resolve) => window.setTimeout(resolve, 160));

function provisioningActor(): PlatformUser | undefined {
  const identity = useAuth.getState().identity;
  const actor = useCommandCenter.getState().platformUsers.find((item) => item.id === identity?.platformUserId);
  return actor && hasPermission(actor, "organizations.manage") && hasPermission(actor, "subscriptions.manage") ? actor : undefined;
}

function event(actor: PlatformUser | undefined, action: string, reason?: string): ProvisioningAuditEvent {
  return { id: uid("pevt"), action, actorId: actor?.id ?? "system", actorName: actor?.name ?? "Sabi workflow", actorRole: actor?.role ?? "SYSTEM", timestamp: now(), reason };
}

function createJob(applicationId: string, opportunityId: string): TenantProvisioningJob {
  const createdAt = now();
  return {
    id: uid("prov"), applicationId, commercialOpportunityId: opportunityId,
    idempotencyKey: `tenant:${applicationId}:${opportunityId}`, status: "NOT_STARTED", attempts: 0,
    steps: [
      { key: "VALIDATE_INPUTS", label: "Validate approved application and active agreement", status: "PENDING" },
      { key: "CREATE_CONTROL_PLANE", label: "Create organization, branch, subscription, license and owner invitation", status: "PENDING" },
      { key: "VERIFY_CONFIGURATION", label: "Verify tenant namespace, package snapshot and access boundary", status: "PENDING" },
      { key: "HAND_OFF_TO_SETUP", label: "Hand off the isolated tenant to first-run setup", status: "PENDING" },
    ],
    events: [event(undefined, "Active commercial agreement became eligible for provisioning")], createdAt, updatedAt: createdAt,
  };
}

function organizationType(facilityType: string): Organization["type"] {
  if (facilityType === "Hospital Group") return "Hospital Group";
  if (facilityType.includes("Diagnostic") || facilityType.includes("Laboratory")) return "Diagnostic Centre";
  if (facilityType.includes("Pharmacy")) return "Pharmacy";
  if (facilityType.includes("Clinic") || facilityType.includes("Centre") || facilityType.includes("Home Care")) return "Clinic";
  return "Hospital";
}

function markStep(set: ProvisioningSet, jobId: string, key: ProvisioningStepKey, status: ProvisioningStepStatus, error?: string) {
  const timestamp = now();
  set((state) => ({ jobs: state.jobs.map((job) => job.id === jobId ? { ...job, updatedAt: timestamp, steps: job.steps.map((step) => step.key === key ? { ...step, status, startedAt: status === "RUNNING" ? timestamp : step.startedAt, completedAt: status === "COMPLETED" ? timestamp : step.completedAt, error } : step) } : job) }));
}

export const useTenantProvisioning = create<ProvisioningState>(
  persisted<ProvisioningState>("tenant-provisioning-v1", (set, get) => ({
    jobs: [],
    syncActiveAgreements: () => {
      const active = useCommercialOnboarding.getState().opportunities.filter((item) => item.status === "ACTIVE");
      const applications = useRegistration.getState().applications;
      const existing = new Set(get().jobs.map((job) => job.commercialOpportunityId));
      const added = active.filter((item) => applications.some((application) => application.id === item.applicationId && application.status === "APPROVED") && !existing.has(item.id)).map((item) => createJob(item.applicationId, item.id));
      if (added.length) set((state) => ({ jobs: [...added, ...state.jobs] }));
    },
    queueProvisioning: (applicationId) => {
      const actor = provisioningActor();
      const job = get().jobs.find((item) => item.applicationId === applicationId);
      if (!actor) return { ok: false, error: "Provisioning requires organization and subscription permissions." };
      if (!job || !["NOT_STARTED", "FAILED"].includes(job.status)) return { ok: false, error: "This provisioning job cannot be queued from its current state." };
      const updatedAt = now();
      set((state) => ({ jobs: state.jobs.map((item) => item.id === job.id ? { ...item, status: "QUEUED", lastError: undefined, updatedAt, steps: item.steps.map((step) => step.status === "FAILED" ? { ...step, status: "PENDING", error: undefined } : step), events: [...item.events, event(actor, "Queued tenant provisioning", item.idempotencyKey)] } : item) }));
      return { ok: true };
    },
    runProvisioning: async (applicationId) => {
      const actor = provisioningActor();
      let job = get().jobs.find((item) => item.applicationId === applicationId);
      if (!actor) return { ok: false, error: "Provisioning requires organization and subscription permissions." };
      if (!job || job.status !== "QUEUED") return { ok: false, error: "Queue this provisioning job before running it." };
      const jobId = job.id;
      const startedAt = now();
      set((state) => ({ jobs: state.jobs.map((item) => item.id === jobId ? { ...item, status: "PROVISIONING", attempts: item.attempts + 1, updatedAt: startedAt, events: [...item.events, event(actor, `Started provisioning attempt ${item.attempts + 1}`)] } : item) }));
      try {
        markStep(set, jobId, "VALIDATE_INPUTS", "RUNNING");
        await wait();
        const application = useRegistration.getState().applications.find((item) => item.id === applicationId);
        const agreement = useCommercialOnboarding.getState().opportunities.find((item) => item.id === job!.commercialOpportunityId);
        const acceptedQuote = agreement ? [...agreement.quotes].sort((a, b) => b.version - a.version).find((quote) => quote.status === "ACCEPTED") : undefined;
        const command = useCommandCenter.getState();
        const selectedPackage = command.packages.find((item) => item.id === agreement?.packageId);
        if (!application || application.status !== "APPROVED") throw new Error("The organization application is no longer approved.");
        if (!agreement || agreement.status !== "ACTIVE" || !agreement.paymentPath || !acceptedQuote) throw new Error("The commercial agreement is not active with an accepted quote.");
        if (!selectedPackage) throw new Error("The accepted package is unavailable.");
        markStep(set, jobId, "VALIDATE_INPUTS", "COMPLETED");

        markStep(set, jobId, "CREATE_CONTROL_PLANE", "RUNNING");
        await wait();
        const packageLine = acceptedQuote.lineItems[0];
        const payload: ProvisionTenantInput = {
          idempotencyKey: job.idempotencyKey, applicationId, commercialOpportunityId: agreement.id,
          name: application.organization.tradingName || application.organization.legalName, legalName: application.organization.legalName,
          type: organizationType(application.organization.facilityType), registrationNumber: application.corporate.registrationNumber,
          country: application.organization.country, state: application.organization.state, address: application.organization.address,
          email: application.organization.officialEmail, phone: application.organization.officialPhone, domain: application.organization.website,
          primaryContact: `${application.owner.firstName} ${application.owner.lastName}`.trim(), ownerEmail: application.owner.workEmail,
          packageId: agreement.packageId, packageVersionId: agreement.packageVersionId, billingCycle: agreement.billingCycle, paymentPath: agreement.paymentPath,
          productIds: agreement.selectedProducts, userLimit: agreement.userCount, branchLimit: agreement.branchCount,
          facilityLimit: Math.max(application.facility.facilities, agreement.branchCount), storageLimitGb: agreement.storageGb,
          baseAmount: packageLine?.amount ?? acceptedQuote.subtotal, addOnAmount: Math.max(0, acceptedQuote.subtotal - (packageLine?.amount ?? acceptedQuote.subtotal)),
          discount: acceptedQuote.discountAmount, tax: acceptedQuote.taxAmount, finalAmount: acceptedQuote.total,
        };
        const committed = useCommandCenter.getState().commitProvisionedTenant(payload, actor.id);
        if (!committed.organizationId) throw new Error(committed.error ?? "The control-plane commit failed.");
        markStep(set, jobId, "CREATE_CONTROL_PLANE", "COMPLETED");

        set((state) => ({ jobs: state.jobs.map((item) => item.id === jobId ? { ...item, status: "CONFIGURING", organizationId: committed.organizationId, updatedAt: now(), events: [...item.events, event(actor, "Created idempotent control-plane records")] } : item) }));
        markStep(set, jobId, "VERIFY_CONFIGURATION", "RUNNING");
        await wait();
        const state = useCommandCenter.getState();
        const organization = state.organizations.find((item) => item.id === committed.organizationId);
        const subscription = state.subscriptions.find((item) => item.organizationId === committed.organizationId);
        const license = state.licenses.find((item) => item.organizationId === committed.organizationId);
        const branch = state.branches.find((item) => item.organizationId === committed.organizationId);
        const owner = state.tenantUsers.find((item) => item.organizationId === committed.organizationId && item.role === "Organization Administrator");
        if (!organization || !subscription || !license || !branch || !owner) throw new Error("Provisioned control-plane records failed integrity verification.");
        if (organization.status !== "Onboarding" || owner.status !== "Invited") throw new Error("The tenant access boundary was not preserved.");
        markStep(set, jobId, "VERIFY_CONFIGURATION", "COMPLETED");

        markStep(set, jobId, "HAND_OFF_TO_SETUP", "RUNNING");
        await wait();
        markStep(set, jobId, "HAND_OFF_TO_SETUP", "COMPLETED");
        const completedAt = now();
        set((store) => ({ jobs: store.jobs.map((item) => item.id === jobId ? { ...item, status: "READY", tenantId: organization.tenantId, slug: organization.slug, updatedAt: completedAt, events: [...item.events, event(actor, "Provisioning ready for first-run setup")] } : item) }));
        return { ok: true };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Provisioning failed.";
        job = get().jobs.find((item) => item.id === jobId);
        const running = job?.steps.find((step) => step.status === "RUNNING");
        if (running) markStep(set, jobId, running.key, "FAILED", message);
        set((state) => ({ jobs: state.jobs.map((item) => item.id === jobId ? { ...item, status: "FAILED", lastError: message, updatedAt: now(), events: [...item.events, event(actor, "Provisioning attempt failed", message)] } : item) }));
        return { ok: false, error: message };
      }
    },
    resetFailedJob: (applicationId) => {
      const actor = provisioningActor();
      const job = get().jobs.find((item) => item.applicationId === applicationId);
      if (!actor) return { ok: false, error: "Provisioning requires organization and subscription permissions." };
      if (!job || job.status !== "FAILED") return { ok: false, error: "Only failed jobs can be reset." };
      if (useCommandCenter.getState().provisioningCommits.some((item) => item.idempotencyKey === job.idempotencyKey)) return { ok: false, error: "Control-plane records already exist. Retry idempotently or escalate for manual remediation." };
      set((state) => ({ jobs: state.jobs.map((item) => item.id === job.id ? { ...item, status: "NOT_STARTED", lastError: undefined, updatedAt: now(), steps: item.steps.map((step) => ({ ...step, status: "PENDING", error: undefined, startedAt: undefined, completedAt: undefined })), events: [...item.events, event(actor, "Reset failed pre-commit provisioning job")] } : item) }));
      return { ok: true };
    },
  }), { scope: "global", pick: (state) => ({ jobs: state.jobs }) }),
);
