import type { OrganizationMembership, SabiIdentity } from "./domain";

export const SABI_IDENTITIES: SabiIdentity[] = [
  { id: "id-platform-ada", email: "adaeze@sabios.com", name: "Adaeze Okonjo", kind: "platform", status: "ACTIVE", emailVerified: true, phoneVerified: true, mfaEnabled: true, platformUserId: "pu_ada" },
  { id: "id-owner-amaka", email: "amaka@sabi.health", name: "Dr. Amaka Obi", kind: "organization", status: "ACTIVE", emailVerified: true, phoneVerified: true, mfaEnabled: true },
  { id: "id-owner-haven", email: "admin@haven-pharmacy.health", name: "Haven Pharmacy Admin", kind: "organization", status: "ACTIVE", emailVerified: true, phoneVerified: true, mfaEnabled: false },
  { id: "id-clinical-grace", email: "grace@sabi.health", name: "Nurse Grace Nwangbo", kind: "organization", status: "ACTIVE", emailVerified: true, phoneVerified: false, mfaEnabled: false },
  { id: "id-patient-zoe", email: "zoe@sabi.health", name: "Zoe Amissah", kind: "patient", status: "ACTIVE", emailVerified: true, phoneVerified: false, mfaEnabled: false },
];

export const ORGANIZATION_MEMBERSHIPS: OrganizationMembership[] = [
  { id: "mem-amaka-sabi", identityId: "id-owner-amaka", organizationId: "org-sabi", role: "Organization Administrator", accountId: "s1", products: ["emr", "workforce", "accounting"], status: "ACTIVE" },
  { id: "mem-amaka-mercy", identityId: "id-owner-amaka", organizationId: "org-mercy", role: "Hospital Administrator", accountId: "s1", products: ["emr", "workforce", "accounting"], status: "ACTIVE" },
  { id: "mem-haven-pharmacy", identityId: "id-owner-haven", organizationId: "org-haven", role: "Pharmacy Administrator", accountId: "s1", products: ["pharmacy"], status: "ACTIVE" },
  { id: "mem-grace-sabi", identityId: "id-clinical-grace", organizationId: "org-sabi", role: "Nurse Manager", accountId: "s2", products: ["emr", "workforce"], status: "ACTIVE" },
];

export const DEMO_PASSWORD = "demo1234";

export const demoIdentityOptions = SABI_IDENTITIES.map((identity) => ({
  id: identity.id,
  email: identity.email,
  name: identity.name,
  label: identity.kind === "platform" ? "Platform administrator" : identity.kind === "patient" ? "Patient" : identity.id === "id-owner-haven" ? "Pharmacy organization administrator" : ORGANIZATION_MEMBERSHIPS.filter((membership) => membership.identityId === identity.id).length > 1 ? "Multi-organization administrator" : "Hospital employee",
}));
