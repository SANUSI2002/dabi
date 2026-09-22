import { DEFAULT_TENANT_ID, activeTenantId, tenantStorageKey } from "./tenantRuntime";

// Platform persistence seam.
//
// A tiny localStorage-backed persister for Zustand stores. It exists so that
// configuration/state survives a page reload, and — more importantly — so there
// is ONE place that owns reading and writing durable state. Swap the `backend`
// implementation here for real HTTP calls and every persisted store follows,
// without any UI change.
//
// Transaction stores (ledger, EMR encounters, payroll runs) are intentionally
// NOT persisted yet: they re-post derived journal entries on hydrate, so
// persisting them safely needs a coordinated "skip re-seed" pass. Config stores
// (entitlements, terminology, master data, org structure, workflows) persist
// cleanly and are wired now.

// Production and development never share browser-persisted records. This keeps
// local fixtures from becoming apparent production data when origins overlap.
const PREFIX = import.meta.env.PROD ? "sabi-os:production:" : "sabi-os:development:";
const VERSION = 1;

type Envelope<T> = { v: number; t: number; data: T };

export const backend = {
  read<T>(key: string): T | undefined {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      if (!raw) return undefined;
      const env = JSON.parse(raw) as Envelope<T>;
      if (env.v !== VERSION) return undefined; // drop on schema bump
      return env.data;
    } catch {
      return undefined;
    }
  },
  write<T>(key: string, data: T): void {
    try {
      const env: Envelope<T> = { v: VERSION, t: Date.now(), data };
      localStorage.setItem(PREFIX + key, JSON.stringify(env));
    } catch {
      /* quota / private mode — degrade to in-memory */
    }
  },
  clear(key: string): void {
    try {
      localStorage.removeItem(PREFIX + key);
    } catch {
      /* ignore */
    }
  },
};

/** Commit a tenant projection before a navigation or full application reload. */
export function writeTenantState<T>(key: string, data: T): void {
  backend.write(tenantStorageKey(key), data);
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type ZSet<T> = (partial: T | Partial<T> | ((s: T) => T | Partial<T>), replace?: boolean) => void;
type ZGet<T> = () => T;

/**
 * Wrap a zustand initializer so the slice named by `key` is loaded from durable
 * storage on start and saved (debounced) on every change. Returns a plain
 * StateCreator so it drops straight into `create(...)`.
 *
 * `pick` selects the persisted subset (default: whole state minus functions).
 * `merge` reconciles the freshly-built `base` with what was loaded from storage
 * (default: `{ ...base, ...saved }`). Override it when new code ships seed data
 * that a previously-persisted store would otherwise hide (e.g. new workflow defs).
 */
export function persisted<T extends object>(
  key: string,
  init: (set: ZSet<T>, get: ZGet<T>) => T,
  opts?: { pick?: (s: T) => Partial<T>; merge?: (base: T, saved: Partial<T>) => T; scope?: "tenant" | "global" },
) {
  return ((set: any, get: any) => {
    const pick = opts?.pick ?? ((s: T) => stripFns(s));
    const merge = opts?.merge ?? ((base: T, saved: Partial<T>) => ({ ...base, ...saved }));

    let timer: ReturnType<typeof setTimeout> | undefined;
    const save = () => {
      clearTimeout(timer);
      timer = setTimeout(() => backend.write(opts?.scope === "global" ? key : tenantStorageKey(key), pick(get())), 120);
    };

    const wrappedSet: ZSet<T> = (partial, replace) => {
      set(partial as any, replace as any);
      save();
    };

    const base = init(wrappedSet, get);
    const storageKey = opts?.scope === "global" ? key : tenantStorageKey(key);
    // Existing single-tenant installs migrate their unscoped data into the
    // original Sabi tenant. Other tenants always start from isolated seeds.
    const saved = backend.read<Partial<T>>(storageKey)
      ?? (opts?.scope !== "global" && activeTenantId() === DEFAULT_TENANT_ID ? backend.read<Partial<T>>(key) : undefined);
    return saved ? merge(base, saved) : base;
  }) as any;
}

function stripFns<T extends object>(s: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(s)) if (typeof v !== "function") out[k] = v;
  return out as Partial<T>;
}

/** Wipe all persisted platform state (used by a "reset demo data" action). */
export function resetAllPersisted() {
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith(PREFIX)) localStorage.removeItem(k);
  } catch {
    /* ignore */
  }
}
