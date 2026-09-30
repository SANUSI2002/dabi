import { create } from "zustand";
import { apiConfigured } from "@/config/runtime";
import { liveSelectEmrOrganization, liveSignOut, restoreLiveIdentity, type LiveEmrAccess } from "@/identity/liveIdentity";

// Live EMR session: a real Sabi sign-in working inside one hospital's EMR.
//
// The backend decides everything that matters (membership, EMR entitlement, role permissions);
// this store only remembers which hospital the tab is working in, so a page reload re-verifies
// the same hospital instead of dropping the user back to the organization chooser. Only the
// organization id is kept (sessionStorage, this tab only) — never a token or patient data.

const ORGANIZATION_KEY = "sabi.liveEmr.organizationId";

export type LiveEmrUser = { id: string; name: string; email: string; role: string };
type Status = "idle" | "loading" | "ready" | "error";

type LiveEmrState = {
  status: Status;
  access: LiveEmrAccess | null;
  user: LiveEmrUser | null;
  error: string;
  /** Verifies the signed-in user's EMR access to this hospital and opens the workspace. */
  start: (organizationId: string) => Promise<LiveEmrAccess | null>;
  /** After a reload: re-verifies the hospital this tab was working in, if any. */
  restore: () => Promise<void>;
  /** Re-selects the hospital after the short-lived access token expired (see client.ts). */
  reselect: () => Promise<void>;
  signOut: () => Promise<void>;
};

const readOrganization = () => {
  try { return window.sessionStorage.getItem(ORGANIZATION_KEY); } catch { return null; }
};
const writeOrganization = (organizationId: string | null) => {
  try {
    if (organizationId) window.sessionStorage.setItem(ORGANIZATION_KEY, organizationId);
    else window.sessionStorage.removeItem(ORGANIZATION_KEY);
  } catch { /* storage blocked: the session simply does not survive a reload */ }
};

const roleLabel = (roles: string[]) =>
  roles.map((role) => role.toLowerCase().split("_").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ")).join(", ") || "Staff";

export const useLiveEmr = create<LiveEmrState>((set, get) => ({
  status: "idle",
  access: null,
  user: null,
  error: "",

  start: async (organizationId) => {
    set({ status: "loading", error: "" });
    try {
      const identity = await restoreLiveIdentity();
      if (!identity) throw new Error("Your session has ended. Sign in again.");
      const access = await liveSelectEmrOrganization(organizationId);
      writeOrganization(access.organizationId);
      set({
        status: "ready",
        access,
        user: { id: identity.user.id, name: identity.user.fullName?.trim() || identity.user.email, email: identity.user.email, role: roleLabel(access.roles) },
      });
      return access;
    } catch (cause) {
      writeOrganization(null);
      set({ status: "error", access: null, user: null, error: cause instanceof Error ? cause.message : "EMR access could not be verified." });
      return null;
    }
  },

  restore: async () => {
    if (get().status !== "idle") return;
    const organizationId = readOrganization();
    if (!organizationId) { set({ status: "error", error: "Choose a hospital to open the EMR." }); return; }
    await get().start(organizationId);
  },

  reselect: async () => {
    const organizationId = get().access?.organizationId;
    if (!organizationId) throw new Error("No hospital is selected.");
    const identity = await restoreLiveIdentity();
    if (!identity) {
      writeOrganization(null);
      set({ status: "error", access: null, user: null, error: "Your session has ended. Sign in again." });
      throw new Error("Your session has ended. Sign in again.");
    }
    set({ access: await liveSelectEmrOrganization(organizationId) });
  },

  signOut: async () => {
    await liveSignOut();
    writeOrganization(null);
    set({ status: "idle", access: null, user: null, error: "" });
  },
}));

/** True when this tab is a real Sabi sign-in working in a live hospital EMR (not the demo). */
export const useIsLiveEmr = () => useLiveEmr((state) => apiConfigured && state.status === "ready");

export const liveCan = (permission: string) => useLiveEmr.getState().access?.permissions.includes(permission) ?? false;
