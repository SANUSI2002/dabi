import { create } from "zustand";
import { audit } from "@/store/useAudit";
import { useIdentity } from "@/store/useIdentity";
import { accountById, type Account } from "@/data/accounts";
import { identityService } from "@/identity/service";
import { ORGANIZATION_MEMBERSHIPS, SABI_IDENTITIES } from "@/identity/seed";
import type { OrganizationMembership, PostAuthDestination, SabiIdentity, SabiSession, SignInInput } from "@/identity/domain";

const SESSION_KEY = "sabi-id-session-v1";
const LEGACY_KEY = "sabi-emr-auth";

type SignInActionResult = { status: "ROUTE"; destination: PostAuthDestination } | { status: "MFA" } | { status: "ERROR"; message: string };

function readSession(): { session?: SabiSession; identity?: SabiIdentity; membership?: OrganizationMembership } {
  try {
    const session = JSON.parse(localStorage.getItem(SESSION_KEY) ?? "null") as SabiSession | null;
    if (!session || new Date(session.expiresAt).getTime() <= Date.now()) return {};
    const identity = SABI_IDENTITIES.find((item) => item.id === session.identityId);
    const membership = ORGANIZATION_MEMBERSHIPS.find((item) => item.id === session.membershipId && item.identityId === identity?.id);
    if (!identity || identity.status !== "ACTIVE") return {};
    return { session, identity, membership };
  } catch {
    return {};
  }
}

function writeSession(identity: SabiIdentity, membership: OrganizationMembership | undefined, rememberMe: boolean, mfaVerified: boolean) {
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + (rememberMe ? 30 : 0.5) * 86_400_000);
  const session: SabiSession = { id: `sid_${Date.now().toString(36)}`, identityId: identity.id, membershipId: membership?.id, createdAt: createdAt.toISOString(), expiresAt: expiresAt.toISOString(), rememberMe, mfaVerified, device: "This browser" };
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    localStorage.removeItem(LEGACY_KEY);
  } catch { /* in-memory session remains available */ }
  return session;
}

function clearSession() {
  try { localStorage.removeItem(SESSION_KEY); localStorage.removeItem(LEGACY_KEY); } catch { /* ignore */ }
}

function routeFor(identity: SabiIdentity, membership?: OrganizationMembership): PostAuthDestination {
  if (identity.kind === "platform") return "/command-center";
  if (identity.kind === "patient") return "/patient";
  if (membership?.products.includes("pharmacy")) return "/pharmacy-portal";
  return membership ? "/workspace" : "/choose-organization";
}

type PendingMfa = { challengeId: string; identity: SabiIdentity; memberships: OrganizationMembership[]; rememberMe: boolean };

type AuthState = {
  authed: boolean;
  tenantId: string;
  identity?: SabiIdentity;
  memberships: OrganizationMembership[];
  activeMembership?: OrganizationMembership;
  session?: SabiSession;
  pendingMfa?: PendingMfa;
  user: Account;
  signIn: (input: SignInInput) => Promise<SignInActionResult>;
  verifyMfa: (code: string) => Promise<SignInActionResult>;
  activateMembership: (membershipId: string) => Promise<{ destination?: PostAuthDestination; error?: string }>;
  destination: () => PostAuthDestination | "/login";
  signOut: () => void;
};

const restored = readSession();
const restoredMemberships = restored.identity ? ORGANIZATION_MEMBERSHIPS.filter((item) => item.identityId === restored.identity!.id && item.status === "ACTIVE") : [];
const restoredUser = restored.membership ? accountById(restored.membership.accountId) : useIdentity.getState().user;

export const useAuth = create<AuthState>((set, get) => {
  useIdentity.subscribe((state) => set({ user: state.user }));

  const finish = async (identity: SabiIdentity, memberships: OrganizationMembership[], rememberMe: boolean, mfaVerified: boolean): Promise<SignInActionResult> => {
    if (identity.kind === "organization" && memberships.length === 1) {
      const membership = memberships[0];
      try {
        const { activateTenantMembership } = await import("@/identity/tenantProjection");
        const organization = activateTenantMembership(membership);
        const session = writeSession(identity, membership, rememberMe, mfaVerified);
        set({ authed: true, tenantId: organization.id, identity, memberships, activeMembership: membership, session, pendingMfa: undefined, user: accountById(membership.accountId) });
        audit("signed in with Sabi ID", "identity/session", { meta: { identityId: identity.id, membershipId: membership.id } });
        return { status: "ROUTE", destination: "/workspace" };
      } catch (error) {
        return { status: "ERROR", message: error instanceof Error ? error.message : "Unable to open this organization." };
      }
    }

    const session = writeSession(identity, undefined, rememberMe, mfaVerified);
    set({ authed: true, tenantId: "", identity, memberships, activeMembership: undefined, session, pendingMfa: undefined });
    return { status: "ROUTE", destination: routeFor(identity) };
  };

  return {
    authed: !!restored.identity,
    tenantId: restored.membership?.organizationId ?? "",
    identity: restored.identity,
    memberships: restoredMemberships,
    activeMembership: restored.membership,
    session: restored.session,
    user: restoredUser,
    signIn: async (input) => {
      const result = await identityService.signIn(input);
      if (result.status === "FAILED") return { status: "ERROR", message: result.message };
      if (result.status === "MFA_REQUIRED") {
        set({ pendingMfa: { challengeId: result.challengeId, identity: result.identity, memberships: result.memberships, rememberMe: input.rememberMe } });
        return { status: "MFA" };
      }
      return finish(result.identity, result.memberships, input.rememberMe, !result.identity.mfaEnabled);
    },
    verifyMfa: async (code) => {
      const pending = get().pendingMfa;
      if (!pending) return { status: "ERROR", message: "Your verification session has expired. Please sign in again." };
      const result = await identityService.verifyMfa(pending.challengeId, code);
      if (result.status === "FAILED") return { status: "ERROR", message: result.message };
      if (result.status === "MFA_REQUIRED") return { status: "ERROR", message: "A new verification challenge is required." };
      return finish(result.identity, result.memberships, pending.rememberMe, true);
    },
    activateMembership: async (membershipId) => {
      const identity = get().identity;
      const membership = get().memberships.find((item) => item.id === membershipId && item.identityId === identity?.id);
      if (!identity || !membership) return { error: "That organization membership is not available." };
      try {
        const { activateTenantMembership } = await import("@/identity/tenantProjection");
        const organization = activateTenantMembership(membership);
        const session = writeSession(identity, membership, get().session?.rememberMe ?? false, get().session?.mfaVerified ?? false);
        set({ authed: true, tenantId: organization.id, activeMembership: membership, session, user: accountById(membership.accountId) });
        audit("selected organization", "identity/membership", { meta: { identityId: identity.id, membershipId: membership.id } });
        return { destination: routeFor(identity, membership) };
      } catch (error) {
        return { error: error instanceof Error ? error.message : "Unable to open this organization." };
      }
    },
    destination: () => get().identity ? routeFor(get().identity!, get().activeMembership) : "/login",
    signOut: () => {
      if (get().authed) audit("signed out", "identity/session", { meta: { identityId: get().identity?.id } });
      clearSession();
      set({ authed: false, tenantId: "", identity: undefined, memberships: [], activeMembership: undefined, session: undefined, pendingMfa: undefined });
    },
  };
});
