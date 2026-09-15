export type ProvisioningStatus = "NOT_STARTED" | "QUEUED" | "PROVISIONING" | "CONFIGURING" | "READY" | "FAILED";
export type ProvisioningStepKey = "VALIDATE_INPUTS" | "CREATE_CONTROL_PLANE" | "VERIFY_CONFIGURATION" | "HAND_OFF_TO_SETUP";
export type ProvisioningStepStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";

export type ProvisioningStep = {
  key: ProvisioningStepKey;
  label: string;
  status: ProvisioningStepStatus;
  startedAt?: string;
  completedAt?: string;
  error?: string;
};

export type ProvisioningAuditEvent = {
  id: string;
  action: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  timestamp: string;
  reason?: string;
};

export type TenantProvisioningJob = {
  id: string;
  applicationId: string;
  commercialOpportunityId: string;
  idempotencyKey: string;
  status: ProvisioningStatus;
  attempts: number;
  steps: ProvisioningStep[];
  organizationId?: string;
  tenantId?: string;
  slug?: string;
  lastError?: string;
  events: ProvisioningAuditEvent[];
  createdAt: string;
  updatedAt: string;
};
