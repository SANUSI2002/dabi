import type { ProductKey } from "@/platform/entitlements";

export type IdentityKind = "platform" | "organization" | "patient";
export type IdentityStatus = "INVITED" | "ACTIVE" | "SUSPENDED" | "LOCKED";
export type MembershipStatus = "INVITED" | "ACTIVE" | "SUSPENDED";

export type SabiIdentity = {
  id: string;
  email: string;
  name: string;
  kind: IdentityKind;
  status: IdentityStatus;
  emailVerified: boolean;
  phoneVerified: boolean;
  mfaEnabled: boolean;
  platformUserId?: string;
};

export type OrganizationMembership = {
  id: string;
  identityId: string;
  organizationId: string;
  role: string;
  accountId: string;
  products: ProductKey[];
  status: MembershipStatus;
};

export type SabiSession = {
  id: string;
  identityId: string;
  membershipId?: string;
  createdAt: string;
  expiresAt: string;
  rememberMe: boolean;
  mfaVerified: boolean;
  device: string;
};

export type SignInInput = { email: string; password: string; rememberMe: boolean };
export type AuthResult =
  | { status: "AUTHENTICATED"; identity: SabiIdentity; memberships: OrganizationMembership[] }
  | { status: "MFA_REQUIRED"; identity: SabiIdentity; memberships: OrganizationMembership[]; challengeId: string }
  | { status: "FAILED"; message: string };

export type PostAuthDestination = "/command-center" | "/choose-organization" | "/workspace" | "/patient";
