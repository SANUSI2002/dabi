import { useAudit } from "@/store/useAudit";
import { workforceRequest } from "@/emr-live/client";
import type { AuditEvent } from "@/data/types";

// The HR audit trail in live mode (GET /people/audit-events): the server records every Workforce change
// as it happens, so the browser's own audit log is switched off (nothing is kept in local storage) and the
// HR screens — HR Reports' compliance tab, an employee's History — show the organization's trail. Field
// names only, never values; payroll entries only for payroll staff; nothing clinical.

type ApiAuditEvent = { id: string; at: string; action: string; resourceType: string; resourceId: string | null; changedFields: string[]; actorName: string | null; actorRoles: string[] };

const title = (code: string) => code.split("_").map((w) => (w.length <= 2 ? w : w.charAt(0) + w.slice(1).toLowerCase())).join(" "); // HR_OFFICER → HR Officer

export async function loadHrAudit() {
  const { data } = await workforceRequest<{ data: { items: ApiAuditEvent[] } }>("/people/audit-events?limit=500");
  useAudit.setState({
    events: data.items.map((e): AuditEvent => ({
      id: e.id, ts: e.at, user: e.actorName ?? "Former member", role: e.actorRoles.map(title).join(", "),
      action: e.action.replace(/[._]/g, " ").toUpperCase(), resource: `hr/${e.resourceType}/${e.resourceId ?? ""}`, ip: "",
      ...(e.changedFields.length ? { meta: { fields: e.changedFields } } : {}),
    })),
  });
}

export function goLiveAudit() {
  useAudit.setState({ log: () => undefined });
}

export function clearAudit() {
  useAudit.setState({ events: [] });
}
