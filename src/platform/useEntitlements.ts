import { create } from "zustand";
import { persisted, writeTenantState } from "./persist";
import { audit } from "@/store/useAudit";
import { MODULES, PRODUCTS, ALWAYS_ON_ROUTES, moduleForRoute, submoduleForRoute, type ProductKey } from "./entitlements";

export type OrgProfile = {
  id: string;
  name: string;
  slug: string;
  plan: string;
};

type EntitlementState = {
  org: OrgProfile;
  subscriptionStatus: "Trialing" | "Active" | "Past Due" | "Grace Period" | "Suspended" | "Expired" | "Cancelled";
  licenseStatus: "Active" | "Expiring Soon" | "Grace Period" | "Expired" | "Suspended" | "Revoked";
  accessMode: "full" | "read-only" | "blocked";
  /** product key -> licensed */
  products: Record<ProductKey, boolean>;
  /** module key -> enabled (only meaningful when its product is licensed) */
  modules: Record<string, boolean>;
  /** submodule key -> enabled */
  submodules: Record<string, boolean>;

  isProductEnabled: (p: ProductKey) => boolean;
  isModuleEnabled: (key: string) => boolean;
  isSubmoduleEnabled: (key: string) => boolean;
  /** the client-side entitlement gate — true if this route may render */
  isRouteAllowed: (path: string) => boolean;
  /** why a route is blocked, for the "not licensed" screen */
  routeBlockReason: (path: string) => { product?: string; module?: string; submodule?: string } | null;

  setProduct: (p: ProductKey, on: boolean) => void;
  setModule: (key: string, on: boolean) => void;
  setSubmodule: (key: string, on: boolean) => void;
  /** Hydrates the tenant app from the control-plane's resolved response. */
  applyResolved: (resolved: {
    organizationId: string;
    subscriptionStatus: EntitlementState["subscriptionStatus"];
    licenseStatus: EntitlementState["licenseStatus"];
    products: Record<string, boolean>;
    modules: Record<string, boolean>;
    features: Record<string, boolean>;
  }) => void;
  applyPreset: (preset: "all" | "emr-only" | "workforce-only" | "accounting-only" | "emr-workforce" | "clinic-lite") => void;
};

const allModules = (val: boolean) => Object.fromEntries(MODULES.map((m) => [m.key, val]));
const allSubs = (val: boolean) => Object.fromEntries(MODULES.flatMap((m) => (m.submodules ?? []).map((s) => [s.key, val])));

const DEFAULTS = {
  org: { id: "org-sabi", name: "Sabi Health Post", slug: "phc-sabi-014", plan: "Enterprise (all modules)" } as OrgProfile,
  subscriptionStatus: "Active" as const,
  licenseStatus: "Active" as const,
  accessMode: "full" as const,
  products: { emr: true, workforce: true, accounting: true } as Record<ProductKey, boolean>,
  modules: allModules(true),
  submodules: allSubs(true),
};

export const useEntitlements = create<EntitlementState>(
  persisted<EntitlementState>("entitlements", (set, get) => ({
    ...DEFAULTS,

    isProductEnabled: (p) => !!get().products[p],
    isModuleEnabled: (key) => {
      const m = MODULES.find((x) => x.key === key);
      if (!m) return true;
      if (!get().products[m.product]) return false;
      if (m.core) return true;
      return get().modules[key] !== false;
    },
    isSubmoduleEnabled: (key) => {
      const parent = MODULES.find((m) => (m.submodules ?? []).some((s) => s.key === key));
      if (parent && !get().isModuleEnabled(parent.key)) return false;
      return get().submodules[key] !== false;
    },

    isRouteAllowed: (path) => {
      if (ALWAYS_ON_ROUTES.some((r) => path === r || path.startsWith(r + "/"))) return true;
      const sub = submoduleForRoute(path);
      if (sub) return get().isModuleEnabled(sub.module.key) && get().isSubmoduleEnabled(sub.sub.key);
      const m = moduleForRoute(path);
      if (!m) return true; // unknown route — don't block (fail-open for unmapped infra)
      return get().isModuleEnabled(m.key);
    },
    routeBlockReason: (path) => {
      if (get().isRouteAllowed(path)) return null;
      const sub = submoduleForRoute(path);
      if (sub) {
        if (!get().products[sub.module.product]) return { product: PRODUCTS[sub.module.product].label };
        if (!get().isModuleEnabled(sub.module.key)) return { module: sub.module.label };
        return { submodule: sub.sub.label };
      }
      const m = moduleForRoute(path);
      if (!m) return null;
      if (!get().products[m.product]) return { product: PRODUCTS[m.product].label };
      return { module: m.label };
    },

    setProduct: (p, on) => {
      set((s) => ({ products: { ...s.products, [p]: on } }));
      audit(`${on ? "licensed" : "un-licensed"} product ${PRODUCTS[p].label}`, `platform/entitlements/${p}`);
    },
    setModule: (key, on) => {
      set((s) => ({ modules: { ...s.modules, [key]: on } }));
      audit(`${on ? "enabled" : "disabled"} module ${key}`, `platform/entitlements/${key}`);
    },
    setSubmodule: (key, on) => {
      set((s) => ({ submodules: { ...s.submodules, [key]: on } }));
      audit(`${on ? "enabled" : "disabled"} submodule ${key}`, `platform/entitlements/${key}`);
    },

    applyResolved: (resolved) => {
      const accessMode: EntitlementState["accessMode"] = resolved.subscriptionStatus === "Active" || resolved.subscriptionStatus === "Trialing"
        ? "full"
        : resolved.subscriptionStatus === "Grace Period" || resolved.licenseStatus === "Grace Period"
          ? "read-only"
          : "blocked";
      const current = get();
      const projection = {
        org: { ...current.org, id: resolved.organizationId },
        subscriptionStatus: resolved.subscriptionStatus,
        licenseStatus: resolved.licenseStatus,
        accessMode,
        products: {
          emr: !!resolved.products.emr,
          workforce: !!resolved.products.workforce,
          accounting: !!resolved.products.accounting,
        },
        modules: { ...current.modules, ...resolved.modules },
        submodules: { ...current.submodules, ...resolved.features },
      };
      set(projection);
      writeTenantState("entitlements", projection);
    },

    applyPreset: (preset) => {
      const p = (emr: boolean, workforce: boolean, accounting: boolean) => ({ emr, workforce, accounting });
      const map: Record<string, Record<ProductKey, boolean>> = {
        all: p(true, true, true),
        "emr-only": p(true, false, false),
        "workforce-only": p(false, true, false),
        "accounting-only": p(false, false, true),
        "emr-workforce": p(true, true, false),
        "clinic-lite": p(true, false, false),
      };
      set({ products: map[preset], modules: allModules(true), submodules: allSubs(true) });
      if (preset === "clinic-lite") {
        set((s) => ({ modules: { ...s.modules, "emr.mch": false, "emr.programs": false, "emr.operations": false } }));
      }
      audit(`applied entitlement preset "${preset}"`, "platform/entitlements/preset");
    },
  })),
);

/** non-hook check for guards / route loaders */
export const routeAllowed = (path: string) => useEntitlements.getState().isRouteAllowed(path);

/**
 * Reactive hook: re-renders when entitlements change (subscribes to the raw
 * maps, not the memoised methods). Use this in the sidebar / route guard.
 */
export function useRouteGate() {
  const products = useEntitlements((s) => s.products);
  const modules = useEntitlements((s) => s.modules);
  const submodules = useEntitlements((s) => s.submodules);
  const accessMode = useEntitlements((s) => s.accessMode);
  const subscriptionStatus = useEntitlements((s) => s.subscriptionStatus);
  const licenseStatus = useEntitlements((s) => s.licenseStatus);
  // products/modules/submodules are in the deps implicitly via the closure
  void products; void modules; void submodules;
  const s = useEntitlements.getState();
  return {
    isRouteAllowed: (path: string) => s.isRouteAllowed(path),
    routeBlockReason: (path: string) => s.routeBlockReason(path),
    isModuleEnabled: (key: string) => s.isModuleEnabled(key),
    accessMode,
    subscriptionStatus,
    licenseStatus,
  };
}
