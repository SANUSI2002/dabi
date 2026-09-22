import { DEMO_PASSWORD, ORGANIZATION_MEMBERSHIPS, SABI_IDENTITIES } from "./seed";
import type { AuthResult, OrganizationMembership, SabiIdentity, SignInInput } from "./domain";
import { developmentFixturesEnabled } from "@/config/runtime";

export interface SabiIdentityService {
  signIn(input: SignInInput): Promise<AuthResult>;
  verifyMfa(challengeId: string, code: string): Promise<AuthResult>;
  requestPasswordReset(email: string): Promise<void>;
  requestSso(email: string): Promise<{ configured: boolean; message: string }>;
  membershipsFor(identityId: string): Promise<OrganizationMembership[]>;
  identityById(identityId: string): Promise<SabiIdentity | undefined>;
}

const pendingChallenges = new Map<string, string>();
const membershipsFor = (identityId: string) => ORGANIZATION_MEMBERSHIPS.filter((membership) => membership.identityId === identityId && membership.status === "ACTIVE");

export class LocalSabiIdentityService implements SabiIdentityService {
  async signIn(input: SignInInput): Promise<AuthResult> {
    if (!developmentFixturesEnabled) return { status: "FAILED", message: "Organization authentication is not connected yet. No session was created." };
    await new Promise((resolve) => setTimeout(resolve, 280));
    const identity = SABI_IDENTITIES.find((item) => item.email.toLowerCase() === input.email.trim().toLowerCase());
    if (!identity || input.password !== DEMO_PASSWORD) return { status: "FAILED", message: "Email or password is incorrect." };
    if (identity.status !== "ACTIVE") return { status: "FAILED", message: "This Sabi ID cannot currently sign in." };
    const memberships = membershipsFor(identity.id);
    if (identity.mfaEnabled) {
      const challengeId = `mfa_${Date.now().toString(36)}`;
      pendingChallenges.set(challengeId, identity.id);
      return { status: "MFA_REQUIRED", identity, memberships, challengeId };
    }
    return { status: "AUTHENTICATED", identity, memberships };
  }

  async verifyMfa(challengeId: string, code: string): Promise<AuthResult> {
    if (!developmentFixturesEnabled) return { status: "FAILED", message: "Multi-factor authentication is not connected yet." };
    await new Promise((resolve) => setTimeout(resolve, 220));
    const identityId = pendingChallenges.get(challengeId);
    const identity = SABI_IDENTITIES.find((item) => item.id === identityId);
    if (!identity || code.replaceAll(" ", "") !== "246810") return { status: "FAILED", message: "That verification code is not valid." };
    pendingChallenges.delete(challengeId);
    return { status: "AUTHENTICATED", identity, memberships: membershipsFor(identity.id) };
  }

  async requestPasswordReset(_email: string) {
    if (!developmentFixturesEnabled) throw new Error("Password recovery is not connected yet.");
    await new Promise((resolve) => setTimeout(resolve, 260));
  }

  async requestSso(email: string) {
    if (!developmentFixturesEnabled) return { configured: false, message: "Organization SSO discovery is not connected yet." };
    await new Promise((resolve) => setTimeout(resolve, 220));
    const configured = email.trim().toLowerCase().endsWith("@sabios.com");
    return { configured, message: configured ? "An SSO connection is configured for this organization." : "No organization SSO connection is configured for that email domain." };
  }

  async membershipsFor(identityId: string) { return membershipsFor(identityId); }
  async identityById(identityId: string) { return SABI_IDENTITIES.find((item) => item.id === identityId); }
}

export const identityService: SabiIdentityService = new LocalSabiIdentityService();
