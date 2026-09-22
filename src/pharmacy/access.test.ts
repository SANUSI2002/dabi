import { describe, expect, it } from "vitest";
import type { OrganizationMembership } from "@/identity/domain";
import { hasPharmacyPortalAccess } from "./access";

const membership = (products: OrganizationMembership["products"]): OrganizationMembership => ({
  id: "membership-test",
  identityId: "identity-test",
  organizationId: "organization-not-in-fixtures",
  role: "Administrator",
  accountId: "account-test",
  products,
  status: "ACTIVE",
});

describe("pharmacy portal access", () => {
  it("allows any active organization membership licensed for Sabi Pharmacy", () => {
    expect(hasPharmacyPortalAccess(membership(["pharmacy"]))).toBe(true);
  });

  it("does not treat an EMR membership as a pharmacy organization", () => {
    expect(hasPharmacyPortalAccess(membership(["emr"]))).toBe(false);
  });
});
