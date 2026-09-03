import { create } from "zustand";
import { CURRENT_USER } from "@/data/mock";

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
  },
  signOut: () => {
    write(false);
    set({ authed: false });
  },
}));
