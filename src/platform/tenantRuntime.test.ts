import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_TENANT, readActiveTenant, tenantStorageKey, writeActiveTenant, type TenantContext } from "./tenantRuntime";

const mercyTenant: TenantContext = {
  ...DEFAULT_TENANT,
  id: "org-mercy",
  tenantId: "TEN-0002",
  name: "Mercy Hospital",
  slug: "mercy-hospital",
  facilityCode: "MERCY-HQ-001",
};

describe("tenant runtime isolation", () => {
  beforeEach(() => localStorage.clear());

  it("uses the safe default when no tenant projection exists", () => {
    expect(readActiveTenant()).toEqual(DEFAULT_TENANT);
  });

  it("round-trips a selected tenant projection", () => {
    writeActiveTenant(mercyTenant);
    expect(readActiveTenant()).toEqual(mercyTenant);
  });

  it("qualifies browser persistence keys by active organization", () => {
    expect(tenantStorageKey("emr")).toBe("tenant:org-sabi:emr");
    writeActiveTenant(mercyTenant);
    expect(tenantStorageKey("emr")).toBe("tenant:org-mercy:emr");
  });

  it("rejects malformed tenant data instead of trusting it", () => {
    localStorage.setItem("sabi-emr-active-tenant", JSON.stringify({ id: "attacker-controlled" }));
    expect(readActiveTenant()).toEqual(DEFAULT_TENANT);
  });
});
