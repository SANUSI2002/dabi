import type { Organization, Subscription, Entitlement, License, ResolvedEntitlements } from "./domain";
import { resolveEntitlements } from "./resolver";

export type TenantControlSnapshot = {
  organizations: Organization[];
  subscriptions: Subscription[];
  entitlements: Entitlement[];
  licenses: License[];
};

export interface CommandCenterRepository {
  getOrganization(id: string): Promise<Organization | undefined>;
  listOrganizations(): Promise<Organization[]>;
  getResolvedEntitlements(organizationId: string): Promise<ResolvedEntitlements | undefined>;
}

/**
 * Repository adapter over the current local state. The callback is injected so
 * views never read localStorage or seed modules directly. Replace this object
 * with an HTTP implementation without changing page components.
 */
export class LocalCommandCenterRepository implements CommandCenterRepository {
  private readonly snapshot: () => TenantControlSnapshot;

  constructor(snapshot: () => TenantControlSnapshot) {
    this.snapshot = snapshot;
  }

  async getOrganization(id: string) {
    return this.snapshot().organizations.find((organization) => organization.id === id);
  }

  async listOrganizations() {
    return this.snapshot().organizations;
  }

  async getResolvedEntitlements(organizationId: string) {
    const state = this.snapshot();
    const subscription = state.subscriptions.find((item) => item.organizationId === organizationId);
    const license = state.licenses.find((item) => item.organizationId === organizationId);
    if (!subscription || !license) return undefined;
    return resolveEntitlements(organizationId, subscription, license, state.entitlements);
  }
}

export class CommandCenterValidationError extends Error {}

export const validateReason = (reason: string) => {
  if (reason.trim().length < 8) throw new CommandCenterValidationError("Provide a reason of at least 8 characters.");
  return reason.trim();
};

export const validateHexColor = (color: string) => {
  if (!/^#[0-9a-f]{6}$/i.test(color)) throw new CommandCenterValidationError("Use a six-digit hex color.");
  return color.toLowerCase();
};
