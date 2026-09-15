import { useCommandCenter } from "@/command-center/useCommandCenter";
import { resolveEntitlements } from "@/command-center/resolver";
import { DEFAULT_TENANT } from "@/platform/tenantRuntime";
import { useEntitlements } from "@/platform/useEntitlements";
import { useIdentity } from "@/store/useIdentity";
import { useTenant } from "@/store/useTenant";
import type { OrganizationMembership } from "./domain";
import { setupForOrganization } from "@/tenant-setup/useTenantSetup";

export function activateTenantMembership(membership: OrganizationMembership) {
  const state = useCommandCenter.getState();
  const organization = state.organizations.find((item) => item.id === membership.organizationId);
  const subscription = state.subscriptions.find((item) => item.organizationId === membership.organizationId);
  const license = state.licenses.find((item) => item.organizationId === membership.organizationId);
  if (!organization) throw new Error("This organization is no longer available.");
  if (!subscription || !license) throw new Error("This organization does not have an active workspace subscription.");
  const firstRunSetup = setupForOrganization(organization.id);
  const setupAccess = organization.status === "Onboarding" && !!firstRunSetup && firstRunSetup.status !== "LIVE" && membership.role.toLowerCase().includes("administrator");
  if (!["Active", "Trial", "Grace Period", "Payment Due"].includes(organization.status) && !setupAccess) throw new Error("This organization workspace is not currently accessible.");
  const branch = state.branches.find((item) => item.organizationId === organization.id);

  useTenant.getState().setTenant({
    id: organization.id, tenantId: organization.tenantId, name: organization.name, slug: organization.slug,
    facilityCode: organization.id === DEFAULT_TENANT.id ? DEFAULT_TENANT.facilityCode : branch?.facilityCode ?? `${organization.tenantId}-01`,
    country: organization.country, state: organization.state, timezone: organization.timezone,
    locale: organization.locale, currency: organization.currency, status: organization.status,
  });
  useEntitlements.getState().applyResolved(resolveEntitlements(organization.id, subscription, license, state.entitlements));
  useIdentity.getState().setUser(membership.accountId);
  return organization;
}
