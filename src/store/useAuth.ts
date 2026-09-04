import { create } from "zustand";
import { CURRENT_USER } from "@/data/mock";
import { audit } from "@/store/useAudit";

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
  user: typeof CURRENT_USER;
  signIn: () => void;
  signOut: () => void;
};

export const useAuth = create<AuthState>((set) => ({
  authed: read(),
  user: CURRENT_USER,
  signIn: () => {
    write(true);
    set({ authed: true });
    audit("signed in", "auth/session");
  },
  signOut: () => {
    audit("signed out", "auth/session");
    write(false);
    set({ authed: false });
  },
}));
