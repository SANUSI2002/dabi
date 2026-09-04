import { create } from "zustand";
import { auditTrail } from "@/data/mock";
import { useIdentity } from "@/store/useIdentity";
import type { AuditEvent } from "@/data/types";

const rid = () => Math.random().toString(36).slice(2, 9);
const IP = "102.89.34.17";

type AuditState = {
  events: AuditEvent[];
  log: (action: string, resource: string, meta?: { user?: string; role?: string }) => void;
};

export const useAudit = create<AuditState>((set) => ({
  events: auditTrail,
  log: (action, resource, meta) =>
    set((s) => ({
      events: [
        {
          id: rid(),
          ts: new Date().toISOString(),
          user: meta?.user ?? useIdentity.getState().user.name,
          role: meta?.role ?? useIdentity.getState().user.role,
          action: action.toUpperCase(),
          resource,
          ip: IP,
        },
        ...s.events,
      ],
    })),
}));

/** fire-and-forget helper for use outside React render */
export const audit = (action: string, resource: string, meta?: { user?: string; role?: string }) =>
  useAudit.getState().log(action, resource, meta);
