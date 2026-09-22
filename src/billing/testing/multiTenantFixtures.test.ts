import { describe, expect, it } from "vitest";
import { invoiceStatusFor } from "../domain";
import { makeTenantBillingFixture, MULTI_TENANT_BILLING_FIXTURES, verifyMultiTenantBillingFixtures } from "./multiTenantFixtures";

describe("multi-tenant revenue-cycle invariants", () => {
  it("keeps fixture records tenant- and branch-scoped", () => {
    expect(verifyMultiTenantBillingFixtures()).toEqual({ tenants: 2, invoices: 2, status: "ok" });
    const [sabi, mercy] = MULTI_TENANT_BILLING_FIXTURES;
    expect(new Set(sabi.accounts.map((item) => item.id))).not.toEqual(new Set(mercy.accounts.map((item) => item.id)));
    expect(sabi.accounts.every((item) => item.organizationId === "org-sabi")).toBe(true);
    expect(mercy.accounts.every((item) => item.organizationId === "org-mercy")).toBe(true);
  });

  it.each([
    [10_000, 0, "ISSUED"],
    [10_000, 4_000, "PARTIALLY_PAID"],
    [10_000, 10_000, "PAID"],
  ] as const)("calculates payment status for %i total and %i paid", (total, paid, status) => {
    expect(invoiceStatusFor(total, paid)).toBe(status);
  });

  it("detects a cross-tenant record", () => {
    const fixture = makeTenantBillingFixture("org-sabi", "PHC-SABI-014");
    fixture.accounts[0] = { ...fixture.accounts[0], organizationId: "org-mercy" };
    expect(() => verifyMultiTenantBillingFixtures([fixture])).toThrow("cross-tenant record detected");
  });

  it("detects payment allocations that do not reconcile", () => {
    const fixture = makeTenantBillingFixture("org-sabi", "PHC-SABI-014");
    fixture.allocations = fixture.allocations.map((allocation) => ({ ...allocation, amountMinor: allocation.amountMinor - 1 }));
    expect(() => verifyMultiTenantBillingFixtures([fixture])).toThrow("allocations do not reconcile");
  });
});
