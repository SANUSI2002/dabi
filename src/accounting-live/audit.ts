import { useAudit } from "@/store/useAudit";
import { accountingRequest } from "@/emr-live/client";
import type { AuditEvent } from "@/data/types";
import { clearAuditSlice, replaceAuditSlice } from "@/workforce-live/audit";

// The Accounting audit trail in live mode (GET /audit-events): the server records every change to the
// books as it happens, so the browser's own audit log is switched off and the Audit Trail screen shows the
// organization's trail — the books and their subledgers only, field names never values. It shares the
// screens' audit store with the HR trail (see replaceAuditSlice).

type ApiAuditEvent = { id: string; at: string; action: string; module: string; resourceType: string; resourceId: string | null; changedFields: string[]; actorName: string | null; actorRoles: string[] };

const title = (code: string) => code.split("_").map((w) => (w.length <= 2 ? w : w.charAt(0) + w.slice(1).toLowerCase())).join(" "); // FINANCE_OFFICER → Finance Officer

export async function loadAcctAudit() {
  const { data } = await accountingRequest<{ data: { items: ApiAuditEvent[] } }>("/audit-events?limit=500");
  replaceAuditSlice("accounting", data.items.map((e): AuditEvent => ({
    id: e.id, ts: e.at, user: e.actorName ?? "Former member", role: e.actorRoles.map(title).join(", "),
    action: e.action.replace(/[._]/g, " ").toUpperCase(), resource: `accounting/${e.module}/${e.resourceId ?? e.resourceType}`, ip: "",
    ...(e.changedFields.length ? { meta: { fields: e.changedFields } } : {}),
  })));
}

export function goLiveAcctAudit() {
  useAudit.setState({ log: () => undefined });
}

export function clearAcctAudit() {
  clearAuditSlice("accounting");
}
