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

const PREFIX = "sabi-os:";
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

/* eslint-disable @typescript-eslint/no-explicit-any */
type ZSet<T> = (partial: T | Partial<T> | ((s: T) => T | Partial<T>), replace?: boolean) => void;
type ZGet<T> = () => T;

/**
 * Wrap a zustand initializer so the slice named by `key` is loaded from durable
 * storage on start and saved (debounced) on every change. Returns a plain
 * StateCreator so it drops straight into `create(...)`.
 *
 * `pick` selects the persisted subset (default: whole state minus functions).
 */
export function persisted<T extends object>(
  key: string,
  init: (set: ZSet<T>, get: ZGet<T>) => T,
  opts?: { pick?: (s: T) => Partial<T> },
) {
  return ((set: any, get: any) => {
    const pick = opts?.pick ?? ((s: T) => stripFns(s));

    let timer: ReturnType<typeof setTimeout> | undefined;
    const save = () => {
      clearTimeout(timer);
      timer = setTimeout(() => backend.write(key, pick(get())), 120);
    };

    const wrappedSet: ZSet<T> = (partial, replace) => {
      set(partial as any, replace as any);
      save();
    };

    const base = init(wrappedSet, get);
    const saved = backend.read<Partial<T>>(key);
    return saved ? { ...base, ...saved } : base;
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
