import { create } from "zustand";
import { audit } from "@/store/useAudit";
import { useIdentity } from "@/store/useIdentity";
import type { Account } from "@/data/accounts";

const KEY = "sabi-emr-auth";
const read = () => {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
};
const write = (v: boolean) => {
  try {
    v ? localStorage.setItem(KEY, "1") : localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
};

type AuthState = {
  authed: boolean;
  /** convenience mirror of the signed-in identity */
  user: Account;
  signInAs: (accountId: string) => void;
  signOut: () => void;
};

export const useAuth = create<AuthState>((set) => {
  // keep the mirror in sync with the identity store
  useIdentity.subscribe((s) => set({ user: s.user }));
  return {
    authed: read(),
    user: useIdentity.getState().user,
    signInAs: (accountId) => {
      useIdentity.getState().setUser(accountId);
      write(true);
      set({ authed: true });
      audit("signed in", "auth/session");
    },
    signOut: () => {
      audit("signed out", "auth/session");
      write(false);
      set({ authed: false });
    },
  };
});
