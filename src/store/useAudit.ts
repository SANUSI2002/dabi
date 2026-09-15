import { create } from "zustand";
import { auditTrail } from "@/data/mock";
import { useIdentity } from "@/store/useIdentity";
import type { AuditEvent, AuditFieldChange } from "@/data/types";
import { persisted } from "@/platform/persist";
import { activeTenantId } from "@/platform/tenantRuntime";

const rid = () => Math.random().toString(36).slice(2, 9);
const IP = "102.89.34.17";

export type AuditOpts = {
  user?: string;
  role?: string;
  changes?: AuditFieldChange[];
  meta?: Record<string, unknown>;
};

type AuditState = {
  events: AuditEvent[];
  log: (action: string, resource: string, opts?: AuditOpts) => void;
};

export const useAudit = create<AuditState>(persisted<AuditState>("audit", (set) => ({
  events: auditTrail,
  log: (action, resource, opts) =>
    set((s) => ({
      events: [
        {
          id: rid(),
          ts: new Date().toISOString(),
          user: opts?.user ?? useIdentity.getState().user.name,
          role: opts?.role ?? useIdentity.getState().user.role,
          action: action.toUpperCase(),
          resource,
          ip: IP,
          ...(opts?.changes && opts.changes.length ? { changes: opts.changes } : {}),
          meta: { tenantId: activeTenantId(), ...(opts?.meta ?? {}) },
        },
        ...s.events,
      ],
    })),
})));

/** fire-and-forget helper for use outside React render */
export const audit = (action: string, resource: string, opts?: AuditOpts) =>
  useAudit.getState().log(action, resource, opts);

/**
 * Build a field-level before/after diff. Compares `fields` (or every key present
 * in `next`) and returns only the entries that actually changed. Values are
 * compared with JSON equality so arrays/objects are handled.
 */
export function diffFields<T extends Record<string, unknown>>(
  prev: Partial<T> | undefined,
  next: Partial<T>,
  fields?: (keyof T)[],
): AuditFieldChange[] {
  const keys = (fields ?? (Object.keys(next) as (keyof T)[]));
  const out: AuditFieldChange[] = [];
  for (const k of keys) {
    const a = prev?.[k];
    const b = next[k];
    if (b === undefined) continue; // only audit fields being set
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      out.push({ field: String(k), from: a ?? null, to: b ?? null });
    }
  }
  return out;
}

/** log a mutation together with its field-level diff (no-op if nothing changed) */
export function auditChange(
  action: string,
  resource: string,
  changes: AuditFieldChange[],
  opts?: Omit<AuditOpts, "changes">,
) {
  if (!changes.length) return;
  useAudit.getState().log(action, resource, { ...opts, changes });
}
