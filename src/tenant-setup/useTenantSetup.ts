import { create } from "zustand";
import { hasPermission } from "@/command-center/access";
import { useCommandCenter } from "@/command-center/useCommandCenter";
import { persisted } from "@/platform/persist";
import { useTenantProvisioning } from "@/provisioning/useTenantProvisioning";
import { useRegistration } from "@/registration/useRegistration";
import type {
  SetupActionResult,
  SetupActor,
  TenantReadinessCheck,
  TenantSetupConfiguration,
  TenantSetupEvent,
  TenantSetupRecord,
  TenantSetupStep,
  TenantSetupStepKey,
} from "./domain";

type TenantSetupState = {
  records: TenantSetupRecord[];
  syncProvisionedTenants: () => void;
  setActiveStep: (organizationId: string, step: TenantSetupStepKey) => void;
  updateConfiguration: <K extends keyof TenantSetupConfiguration>(organizationId: string, key: K, value: TenantSetupConfiguration[K], actor: SetupActor) => SetupActionResult;
  completeStep: (organizationId: string, step: TenantSetupStepKey, actor: SetupActor) => SetupActionResult;
  reopenStep: (organizationId: string, step: TenantSetupStepKey, actor: SetupActor) => SetupActionResult;
  submitForReview: (organizationId: string, actor: SetupActor) => SetupActionResult;
  requestChanges: (organizationId: string, platformUserId: string, reason: string) => SetupActionResult;
  approveReadiness: (organizationId: string, platformUserId: string, reason: string) => SetupActionResult;
  activateTenant: (organizationId: string, platformUserId: string, reason: string) => SetupActionResult;
};

const uid = (prefix: string) => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
const now = () => new Date().toISOString();
const adminRole = (actor: SetupActor) => actor.role.toLowerCase().includes("administrator");

function auditEvent(actor: SetupActor, action: string, reason?: string): TenantSetupEvent {
  return { id: uid("setup_evt"), action, actorId: actor.id, actorName: actor.name, actorRole: actor.role, timestamp: now(), reason };
}

function step(key: TenantSetupStepKey, label: string, description: string, options?: { completed?: boolean; moduleKey?: string }): TenantSetupStep {
  return { key, label, description, required: true, moduleKey: options?.moduleKey, status: options?.completed ? "COMPLETED" : "PENDING", completedAt: options?.completed ? now() : undefined };
}

function buildSteps(moduleIds: string[]): TenantSetupStep[] {
  const has = (key: string) => moduleIds.includes(key);
  return [
    step("ORGANIZATION", "Organization", "Confirm the legal tenant and primary facility details.", { completed: true }),
    step("SUBSCRIPTION", "Subscription", "Confirm the package, license and entitled modules.", { completed: true }),
    step("DEPARTMENTS", "Create departments", "Define the clinical and administrative structure used by staff and workflows."),
    ...(has("emr.clinical") ? [step("SERVICES", "Configure services", "Select the services patients can be registered and scheduled against.", { moduleKey: "emr.clinical" })] : []),
    step("STAFF", "Add staff", "Choose how the initial workforce will be invited or imported."),
    ...(has("emr.clinical") ? [step("PATIENT_IMPORT", "Import patients", "Choose a safe migration path without loading patient data into setup state.", { moduleKey: "emr.clinical" })] : []),
    ...(has("emr.billing") || moduleIds.some((key) => key.startsWith("accounting.")) ? [step("BILLING", "Configure billing", "Set the operating currency, receipt numbering and tax approach.", { moduleKey: has("emr.billing") ? "emr.billing" : "accounting.gl" })] : []),
    ...(has("emr.pharmacy") ? [step("PHARMACY", "Configure pharmacy", "Set the default stock rotation and prescription controls.", { moduleKey: "emr.pharmacy" })] : []),
    ...(has("emr.laboratory") ? [step("LABORATORY", "Configure laboratory", "Set result approval responsibility and review controls.", { moduleKey: "emr.laboratory" })] : []),
    step("BRANDING", "Branding", "Confirm the organization and Sabi OS display identity."),
    step("TRAINING", "Training", "Assign the training owner and acknowledge the launch pathway."),
    step("GO_LIVE_REVIEW", "Go-live review", "Submit the completed configuration for Sabi implementation review."),
  ];
}

function buildRecord(job: ReturnType<typeof useTenantProvisioning.getState>["jobs"][number]): TenantSetupRecord | undefined {
  if (!job.organizationId) return undefined;
  const command = useCommandCenter.getState();
  const organization = command.organizations.find((item) => item.id === job.organizationId);
  const branch = command.branches.find((item) => item.organizationId === job.organizationId);
  const license = command.licenses.find((item) => item.organizationId === job.organizationId);
  const application = useRegistration.getState().applications.find((item) => item.id === job.applicationId);
  if (!organization || !branch || !license) return undefined;
  const createdAt = now();
  return {
    id: uid("setup"), organizationId: organization.id, applicationId: job.applicationId, provisioningJobId: job.id,
    status: "NOT_STARTED", activeStep: "DEPARTMENTS", steps: buildSteps(license.moduleIds),
    moduleIds: [...license.moduleIds], productIds: [...license.productIds],
    configuration: {
      organization: { displayName: organization.name, facilityCode: branch.facilityCode, timezone: organization.timezone, locale: organization.locale },
      departments: [],
      services: [...(application?.facility.services ?? [])],
      staff: { invitationMode: "LATER", expectedUsers: Math.max(1, application?.facility.staff ?? 1) },
      patientImport: { approach: "LATER" },
      billing: { currency: organization.currency, receiptPrefix: organization.slug.slice(0, 4).toUpperCase() || "SABI", taxMode: "CONFIGURE_LATER" },
      pharmacy: { stockMethod: "FEFO", prescriptionApproval: true },
      laboratory: { resultApprovalRole: "Lab Scientist", requireSecondReview: true },
      branding: { organizationDisplayName: organization.name, productDisplayName: "Sabi OS", primaryColor: "#0f9f63" },
      training: { ownerName: organization.primaryContact, pathway: "REMOTE", acknowledged: false },
    },
    readinessChecks: [], createdAt, updatedAt: createdAt,
    events: [auditEvent({ id: "system", name: "Sabi provisioning", role: "SYSTEM" }, "First-run setup created from verified provisioning handoff")],
  };
}

function validationError(record: TenantSetupRecord, key: TenantSetupStepKey): string | undefined {
  const c = record.configuration;
  if (key === "DEPARTMENTS" && c.departments.length < 2) return "Add at least two departments before continuing.";
  if (key === "SERVICES" && c.services.length < 1) return "Select at least one facility service.";
  if (key === "STAFF" && c.staff.expectedUsers < 1) return "Enter the expected number of staff users.";
  if (key === "PATIENT_IMPORT" && !c.patientImport.approach) return "Choose a patient migration approach.";
  if (key === "BILLING" && c.billing.receiptPrefix.trim().length < 2) return "Provide a receipt prefix with at least two characters.";
  if (key === "BRANDING" && (c.branding.organizationDisplayName.trim().length < 3 || !/^#[0-9a-f]{6}$/i.test(c.branding.primaryColor))) return "Provide a display name and a valid six-digit brand color.";
  if (key === "TRAINING" && (!c.training.ownerName.trim() || !c.training.acknowledged)) return "Assign a training owner and acknowledge the selected pathway.";
  return undefined;
}

export function readinessFor(record: TenantSetupRecord): TenantReadinessCheck[] {
  const command = useCommandCenter.getState();
  const organization = command.organizations.find((item) => item.id === record.organizationId);
  const subscription = command.subscriptions.find((item) => item.organizationId === record.organizationId);
  const license = command.licenses.find((item) => item.organizationId === record.organizationId);
  const branch = command.branches.find((item) => item.organizationId === record.organizationId);
  const owner = command.tenantUsers.find((item) => item.organizationId === record.organizationId && item.role === "Organization Administrator");
  const configurationComplete = record.steps.filter((item) => item.required).every((item) => item.status === "COMPLETED");
  return [
    { key: "tenant-boundary", label: "Tenant remains isolated", status: organization?.status === "Onboarding" ? "PASS" : "FAIL", detail: organization?.status === "Onboarding" ? "Organization is held in onboarding." : "Organization is not in the onboarding boundary." },
    { key: "subscription", label: "Commercial access is current", status: subscription && ["Active", "Trialing"].includes(subscription.status) ? "PASS" : "FAIL", detail: subscription ? `Subscription is ${subscription.status}.` : "Subscription is missing." },
    { key: "license", label: "License is valid", status: license?.status === "Active" ? "PASS" : "FAIL", detail: license ? `License is ${license.status}.` : "License is missing." },
    { key: "branch", label: "Primary branch is staged", status: branch?.status === "Opening" ? "PASS" : "FAIL", detail: branch ? `Primary branch is ${branch.status}.` : "Primary branch is missing." },
    { key: "owner", label: "Organization owner exists", status: owner && ["Invited", "Active"].includes(owner.status) ? "PASS" : "FAIL", detail: owner ? `Owner account is ${owner.status}.` : "Organization owner is missing." },
    { key: "configuration", label: "Required setup is complete", status: configurationComplete ? "PASS" : "FAIL", detail: configurationComplete ? "Every module-aware setup step is complete." : "One or more required setup steps remain incomplete." },
  ];
}

function platformActor(id: string): SetupActor | undefined {
  const user = useCommandCenter.getState().platformUsers.find((item) => item.id === id);
  if (!user || !hasPermission(user, "onboarding.manage")) return undefined;
  return { id: user.id, name: user.name, role: user.role };
}

export const useTenantSetup = create<TenantSetupState>(
  persisted<TenantSetupState>("tenant-first-run-v1", (set, get) => ({
    records: [],
    syncProvisionedTenants: () => {
      const existing = new Set(get().records.map((item) => item.provisioningJobId));
      const added = useTenantProvisioning.getState().jobs
        .filter((job) => job.status === "READY" && !existing.has(job.id))
        .map(buildRecord)
        .filter((record): record is TenantSetupRecord => !!record);
      if (added.length) set((state) => ({ records: [...added, ...state.records] }));
    },
    setActiveStep: (organizationId, activeStep) => set((state) => ({ records: state.records.map((record) => record.organizationId === organizationId ? { ...record, activeStep, updatedAt: now() } : record) })),
    updateConfiguration: (organizationId, key, value, actor) => {
      if (!adminRole(actor)) return { ok: false, error: "Only an organization administrator can change first-run configuration." };
      const record = get().records.find((item) => item.organizationId === organizationId);
      if (!record || ["READY_FOR_REVIEW", "APPROVED", "LIVE"].includes(record.status)) return { ok: false, error: "This setup record is not editable in its current state." };
      set((state) => ({ records: state.records.map((item) => item.id === record.id ? { ...item, status: "IN_PROGRESS", configuration: { ...item.configuration, [key]: value }, updatedAt: now() } : item) }));
      return { ok: true };
    },
    completeStep: (organizationId, key, actor) => {
      if (!adminRole(actor)) return { ok: false, error: "Only an organization administrator can complete setup steps." };
      const record = get().records.find((item) => item.organizationId === organizationId);
      if (!record || ["READY_FOR_REVIEW", "APPROVED", "LIVE"].includes(record.status)) return { ok: false, error: "This setup record is not editable in its current state." };
      if (["ORGANIZATION", "SUBSCRIPTION", "GO_LIVE_REVIEW"].includes(key)) return { ok: false, error: "This step is controlled by the platform workflow." };
      const error = validationError(record, key);
      if (error) return { ok: false, error };
      const completedAt = now();
      set((state) => ({ records: state.records.map((item) => item.id === record.id ? { ...item, status: "IN_PROGRESS", steps: item.steps.map((entry) => entry.key === key ? { ...entry, status: "COMPLETED", completedAt } : entry), updatedAt: completedAt, events: [...item.events, auditEvent(actor, `Completed ${item.steps.find((entry) => entry.key === key)?.label ?? key}`)] } : item) }));
      return { ok: true };
    },
    reopenStep: (organizationId, key, actor) => {
      if (!adminRole(actor)) return { ok: false, error: "Only an organization administrator can reopen setup steps." };
      const record = get().records.find((item) => item.organizationId === organizationId);
      if (!record || ["APPROVED", "LIVE"].includes(record.status) || ["ORGANIZATION", "SUBSCRIPTION"].includes(key)) return { ok: false, error: "This step cannot be reopened." };
      set((state) => ({ records: state.records.map((item) => item.id === record.id ? { ...item, status: "IN_PROGRESS", activeStep: key, readinessChecks: [], steps: item.steps.map((entry) => entry.key === key || entry.key === "GO_LIVE_REVIEW" ? { ...entry, status: "PENDING", completedAt: undefined } : entry), updatedAt: now(), events: [...item.events, auditEvent(actor, `Reopened ${item.steps.find((entry) => entry.key === key)?.label ?? key}`)] } : item) }));
      return { ok: true };
    },
    submitForReview: (organizationId, actor) => {
      if (!adminRole(actor)) return { ok: false, error: "Only an organization administrator can submit go-live readiness." };
      const record = get().records.find((item) => item.organizationId === organizationId);
      if (!record || ["READY_FOR_REVIEW", "APPROVED", "LIVE"].includes(record.status)) return { ok: false, error: "This setup cannot be submitted from its current state." };
      const incomplete = record.steps.find((item) => item.required && item.key !== "GO_LIVE_REVIEW" && item.status !== "COMPLETED");
      if (incomplete) return { ok: false, error: `Complete ${incomplete.label} before submitting for review.` };
      const submittedAt = now();
      const candidate: TenantSetupRecord = { ...record, steps: record.steps.map((item) => item.key === "GO_LIVE_REVIEW" ? { ...item, status: "COMPLETED", completedAt: submittedAt } : item) };
      const readinessChecks = readinessFor(candidate);
      const failed = readinessChecks.find((item) => item.status === "FAIL");
      if (failed) return { ok: false, error: `${failed.label}: ${failed.detail}` };
      set((state) => ({ records: state.records.map((item) => item.id === record.id ? { ...candidate, status: "READY_FOR_REVIEW", readinessChecks, submittedAt, updatedAt: submittedAt, events: [...item.events, auditEvent(actor, "Submitted go-live readiness for platform review")] } : item) }));
      return { ok: true };
    },
    requestChanges: (organizationId, platformUserId, reason) => {
      const actor = platformActor(platformUserId);
      const record = get().records.find((item) => item.organizationId === organizationId);
      if (!actor) return { ok: false, error: "Requesting changes requires onboarding permission." };
      if (!record || record.status !== "READY_FOR_REVIEW") return { ok: false, error: "Only a submitted setup can be returned for changes." };
      if (reason.trim().length < 10) return { ok: false, error: "Provide a clear review note of at least 10 characters." };
      set((state) => ({ records: state.records.map((item) => item.id === record.id ? { ...item, status: "CHANGES_REQUESTED", activeStep: "GO_LIVE_REVIEW", reviewNotes: reason.trim(), steps: item.steps.map((entry) => entry.key === "GO_LIVE_REVIEW" ? { ...entry, status: "CHANGES_REQUESTED", completedAt: undefined } : entry), updatedAt: now(), events: [...item.events, auditEvent(actor, "Requested changes before go-live", reason.trim())] } : item) }));
      return { ok: true };
    },
    approveReadiness: (organizationId, platformUserId, reason) => {
      const actor = platformActor(platformUserId);
      const user = useCommandCenter.getState().platformUsers.find((item) => item.id === platformUserId);
      const record = get().records.find((item) => item.organizationId === organizationId);
      if (!actor || !hasPermission(user, "organizations.manage")) return { ok: false, error: "Readiness approval requires onboarding and organization permissions." };
      if (!record || record.status !== "READY_FOR_REVIEW") return { ok: false, error: "Only submitted readiness can be approved." };
      if (reason.trim().length < 10) return { ok: false, error: "Provide an approval rationale of at least 10 characters." };
      const checks = readinessFor(record);
      const failed = checks.find((item) => item.status === "FAIL");
      if (failed) return { ok: false, error: `${failed.label}: ${failed.detail}` };
      const approvedAt = now();
      set((state) => ({ records: state.records.map((item) => item.id === record.id ? { ...item, status: "APPROVED", readinessChecks: checks, reviewNotes: reason.trim(), approvedAt, updatedAt: approvedAt, events: [...item.events, auditEvent(actor, "Approved tenant go-live readiness", reason.trim())] } : item) }));
      return { ok: true };
    },
    activateTenant: (organizationId, platformUserId, reason) => {
      const actor = platformActor(platformUserId);
      const record = get().records.find((item) => item.organizationId === organizationId);
      if (!actor) return { ok: false, error: "Tenant activation requires onboarding permission." };
      if (!record || record.status !== "APPROVED") return { ok: false, error: "Readiness must be approved before tenant activation." };
      const result = useCommandCenter.getState().activateProvisionedTenant(organizationId, platformUserId, reason);
      if (!result.ok) return result;
      const activatedAt = now();
      set((state) => ({ records: state.records.map((item) => item.id === record.id ? { ...item, status: "LIVE", activatedAt, updatedAt: activatedAt, events: [...item.events, auditEvent(actor, "Activated tenant workspace", reason.trim())] } : item) }));
      return { ok: true };
    },
  }), { scope: "global", pick: (state) => ({ records: state.records }) }),
);

export const setupForOrganization = (organizationId: string) => {
  useTenantSetup.getState().syncProvisionedTenants();
  return useTenantSetup.getState().records.find((item) => item.organizationId === organizationId);
};
