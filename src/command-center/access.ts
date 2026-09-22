import type { PlatformPermission, PlatformRole, PlatformUser } from "./domain";

// PHASE 10: sabihealth.* grants are deliberate, per-role decisions — not copied from whichever
// Sabi OS permission a role already happened to hold. See domain.ts's PlatformPermission comment.
export const ROLE_PERMISSIONS: Record<PlatformRole, PlatformPermission[]> = {
  "Platform Super Admin": ["platform.view", "organizations.manage", "subscriptions.manage", "billing.manage", "catalog.manage", "pricing.manage", "identity.manage", "security.manage", "onboarding.manage", "documents.verify", "branding.manage", "operations.manage", "audit.view", "support.access.request", "support.access.approve", "sabihealth.network.manage", "sabihealth.verification.decide", "sabihealth.operations.manage", "sabihealth.billing.manage", "roadmap.view", "roadmap.create", "roadmap.edit", "roadmap.archive", "roadmap.manage_dates", "roadmap.manage_priority", "roadmap.manage_visibility", "roadmap.publish", "roadmap.unpublish", "roadmap.manage_releases", "roadmap.view_internal_notes", "roadmap.comment", "roadmap.export"],
  "Platform Admin": ["platform.view", "organizations.manage", "subscriptions.manage", "catalog.manage", "identity.manage", "onboarding.manage", "documents.verify", "branding.manage", "operations.manage", "audit.view", "support.access.request", "sabihealth.network.manage", "sabihealth.verification.decide", "sabihealth.operations.manage", "roadmap.view", "roadmap.create", "roadmap.edit", "roadmap.archive", "roadmap.manage_dates", "roadmap.manage_priority", "roadmap.manage_visibility", "roadmap.unpublish", "roadmap.manage_releases", "roadmap.view_internal_notes", "roadmap.comment", "roadmap.export"],
  "Finance Admin": ["platform.view", "subscriptions.manage", "billing.manage", "pricing.manage", "audit.view", "sabihealth.billing.manage"],
  "Billing Officer": ["platform.view", "subscriptions.manage", "billing.manage", "sabihealth.billing.manage"],
  "Implementation Manager": ["platform.view", "organizations.manage", "onboarding.manage", "documents.verify", "branding.manage", "support.access.request", "roadmap.view"],
  "Support Agent": ["platform.view", "support.access.request"],
  "Compliance Officer": ["platform.view", "onboarding.manage", "documents.verify", "audit.view", "sabihealth.verification.decide"],
  "Security Administrator": ["platform.view", "identity.manage", "security.manage", "audit.view", "support.access.approve"],
  "Read Only Auditor": ["platform.view", "audit.view", "roadmap.view"],
  "Product Lead": ["platform.view", "roadmap.view", "roadmap.create", "roadmap.edit", "roadmap.archive", "roadmap.manage_dates", "roadmap.manage_priority", "roadmap.manage_visibility", "roadmap.publish", "roadmap.unpublish", "roadmap.manage_releases", "roadmap.view_internal_notes", "roadmap.comment", "roadmap.export"],
  "Product Manager": ["platform.view", "roadmap.view", "roadmap.create", "roadmap.edit", "roadmap.manage_dates", "roadmap.manage_priority", "roadmap.manage_visibility", "roadmap.view_internal_notes", "roadmap.comment", "roadmap.export"],
  "Engineering Lead": ["platform.view", "roadmap.view", "roadmap.edit", "roadmap.manage_dates", "roadmap.view_internal_notes", "roadmap.comment", "roadmap.export"],
  Designer: ["platform.view", "roadmap.view", "roadmap.edit", "roadmap.comment"],
  "Executive Viewer": ["platform.view", "roadmap.view", "roadmap.export"],
  Marketing: ["platform.view", "roadmap.view", "roadmap.edit", "roadmap.manage_visibility", "roadmap.comment", "roadmap.export"],
  "Customer Success": ["platform.view", "roadmap.view", "roadmap.comment", "roadmap.export"],
};

export function hasPermission(user: PlatformUser | undefined, permission: PlatformPermission) {
  if (!user || user.status !== "Active") return false;
  return user.permissions.includes(permission) || ROLE_PERMISSIONS[user.role].includes(permission);
}
