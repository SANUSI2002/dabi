import { create } from "zustand";
import { ACCOUNTS, DEFAULT_ACCOUNT, accountById, type Account } from "@/data/accounts";
import { activeTenantId } from "@/platform/tenantRuntime";

const key = () => `sabi-emr-account:${activeTenantId()}`;

const load = (): Account => {
  try {
    return accountById(localStorage.getItem(key()) ?? DEFAULT_ACCOUNT);
  } catch {
    return accountById(DEFAULT_ACCOUNT);
  }
};

type IdentityState = {
  user: Account;
  setUser: (id: string) => void;
};

/**
 * The signed-in identity. Kept in its own zero-dependency store so both
 * useAuth and useAudit can read it without an import cycle.
 */
export const useIdentity = create<IdentityState>((set) => ({
  user: load(),
  setUser: (id) => {
    const acct = ACCOUNTS.find((a) => a.id === id);
    if (!acct) return;
    try {
      localStorage.setItem(key(), id);
    } catch {
      /* ignore */
    }
    set({ user: acct });
  },
}));
