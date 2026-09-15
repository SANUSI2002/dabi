import { MODULES } from "@/platform/entitlements";
import type { Entitlement, License, ResolvedEntitlements, Subscription } from "./domain";

const priority: Record<Entitlement["source"], number> = {
  package: 0,
  "add-on": 1,
  override: 2,
  temporary: 3,
  revocation: 4,
};

const activeAt = (grant: Entitlement, at: Date) => {
  const time = at.getTime();
  return new Date(grant.validFrom).getTime() <= time && (!grant.validUntil || new Date(grant.validUntil).getTime() >= time);
};

export function resolveEntitlements(
  organizationId: string,
  subscription: Subscription,
  license: License,
  grants: Entitlement[],
  at = new Date(),
  branchId?: string,
): ResolvedEntitlements {
  const modules: Record<string, boolean> = Object.fromEntries(MODULES.map((m) => [m.key, subscription.snapshotModuleIds.includes(m.key)]));
  const products: Record<string, boolean> = { emr: false, workforce: false, accounting: false };
  const features: Record<string, boolean> = {};

  grants
    .filter((grant) => grant.organizationId === organizationId && grant.subscriptionId === subscription.id && (!grant.branchId || grant.branchId === branchId) && activeAt(grant, at))
    .sort((a, b) => priority[a.source] - priority[b.source] || a.createdAt.localeCompare(b.createdAt))
    .forEach((grant) => {
      if (grant.targetType === "product") products[grant.targetKey] = grant.enabled;
      if (grant.targetType === "module") modules[grant.targetKey] = grant.enabled;
      if (grant.targetType === "feature") features[grant.targetKey] = grant.enabled;
    });

  for (const module of MODULES) {
    if (modules[module.key]) products[module.product] = true;
    for (const feature of module.submodules ?? []) features[feature.key] ??= modules[module.key];
  }

  return {
    organizationId,
    subscriptionId: subscription.id,
    subscriptionStatus: subscription.status,
    licenseStatus: license.status,
    generatedAt: at.toISOString(),
    products,
    modules,
    features,
  };
}

export function entitlementAccessMode(resolved: ResolvedEntitlements): "full" | "read-only" | "blocked" {
  if (resolved.subscriptionStatus === "Active" || resolved.subscriptionStatus === "Trialing") return "full";
  if (resolved.subscriptionStatus === "Grace Period" || resolved.licenseStatus === "Grace Period") return "read-only";
  return "blocked";
}
