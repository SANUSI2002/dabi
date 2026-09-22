import { useCommandCenter } from "@/command-center/useCommandCenter";
import type { OrganizationMembership } from "@/identity/domain";

/**
 * Client-side routing guard only. The pharmacy API must independently derive
 * the tenant from the authenticated session and enforce pharmacy permissions.
 */
export function hasPharmacyPortalAccess(membership?: OrganizationMembership) {
  if (!membership || membership.status !== "ACTIVE") return false;
  if (membership.products.includes("pharmacy")) return true;
  const organization = useCommandCenter.getState().organizations.find((item) => item.id === membership.organizationId);
  return organization?.type.toLowerCase() === "pharmacy";
}
