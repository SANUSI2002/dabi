import { create } from "zustand";
import { audit } from "@/store/useAudit";
import { useIdentity } from "@/store/useIdentity";
import { useAcctControl } from "@/store/accounting/useAcctControl";
import { useAR } from "@/store/accounting/useAR";
import { useAP } from "@/store/accounting/useAP";
import { useInventoryAccounting } from "@/store/accounting/useInventoryAccounting";
import { useBudgets } from "@/store/accounting/useBudgets";
import { useLedger } from "@/store/accounting/useLedger";

// B18 — per-user notification preferences + a derived accounting-alert feed.
// There is no real delivery channel; prefs filter the in-app feed.

export type NotificationKey =
  | "approvalPending"
  | "invoiceOverdue"
  | "billDueSoon"
  | "lowStock"
  | "budgetExceeded"
  | "largeJournal";

export const NOTIFICATION_LABELS: Record<NotificationKey, string> = {
  approvalPending: "A document is waiting for my approval",
  invoiceOverdue: "A customer invoice has gone overdue",
  billDueSoon: "A vendor bill is due within 7 days",
  lowStock: "Inventory item at or below reorder level",
  budgetExceeded: "A budget line is over 100% spent",
  largeJournal: "A journal entry over ₦5,000,000 was posted",
};

export type Alert = { id: string; key: NotificationKey; severity: "info" | "warn" | "urgent"; title: string; detail: string; href: string };

const LARGE_JE = 5_000_000;

type NotificationState = {
  prefs: Record<string, Record<NotificationKey, boolean>>; // by staffId
  prefsFor: (staffId: string) => Record<NotificationKey, boolean>;
  setPref: (key: NotificationKey, on: boolean) => void;
  alerts: () => Alert[]; // filtered by the current user's prefs
};

const ALL_ON: Record<NotificationKey, boolean> = { approvalPending: true, invoiceOverdue: true, billDueSoon: true, lowStock: true, budgetExceeded: true, largeJournal: false };

export const useNotifications = create<NotificationState>((set, get) => ({
  prefs: {},
  prefsFor: (staffId) => get().prefs[staffId] ?? ALL_ON,
  setPref: (key, on) => {
    const uid = useIdentity.getState().user.id;
    set((s) => ({ prefs: { ...s.prefs, [uid]: { ...(s.prefs[uid] ?? ALL_ON), [key]: on } } }));
    audit(`${on ? "enabled" : "muted"} notification "${NOTIFICATION_LABELS[key]}"`, "accounting/notifications");
  },
  alerts: () => {
    const uid = useIdentity.getState().user.id;
    const prefs = get().prefsFor(uid);
    const out: Alert[] = [];
    const now = Date.now();

    if (prefs.approvalPending) {
      const me = useIdentity.getState().user.financeRole;
      const pending = [
        ...useAP.getState().bills.filter((b) => b.approval.status === "Pending" && b.approval.steps.some((st) => st.level === b.approval.currentLevel && st.decision === "Pending" && (st.approverRole === me || me === "Finance Controller"))),
      ];
      for (const b of pending) out.push({ id: `ap-${b.id}`, key: "approvalPending", severity: "urgent", title: `Bill ${b.number} needs your approval`, detail: useAP.getState().vendorById(b.vendorId)?.name ?? "", href: "/accounting/bills" });
    }

    if (prefs.invoiceOverdue) {
      for (const i of useAR.getState().invoices.filter((x) => x.status === "Overdue")) {
        out.push({ id: `inv-${i.id}`, key: "invoiceOverdue", severity: "warn", title: `Invoice ${i.number} overdue`, detail: `${useAR.getState().customerById(i.customerId)?.name} · due ${new Date(i.dueDate).toLocaleDateString()}`, href: "/accounting/invoices" });
      }
    }

    if (prefs.billDueSoon) {
      for (const b of useAP.getState().bills.filter((x) => (x.status === "Awaiting Payment" || x.status === "Partially Paid"))) {
        const days = Math.floor((new Date(b.dueDate).getTime() - now) / 864e5);
        if (days >= 0 && days <= 7) out.push({ id: `bill-${b.id}`, key: "billDueSoon", severity: "info", title: `Bill ${b.number} due in ${days}d`, detail: useAP.getState().vendorById(b.vendorId)?.name ?? "", href: "/accounting/bills" });
      }
    }

    if (prefs.lowStock) {
      for (const it of useInventoryAccounting.getState().items) {
        if (it.active && it.reorderLevel && it.currentQty <= it.reorderLevel) out.push({ id: `stk-${it.id}`, key: "lowStock", severity: "warn", title: `${it.name} low on stock`, detail: `${it.currentQty} on hand · reorder at ${it.reorderLevel}`, href: "/accounting/inventory" });
      }
    }

    if (prefs.budgetExceeded) {
      const b = useBudgets.getState().budgets.find((x) => x.status === "Active");
      if (b) {
        const bva = useBudgets.getState().budgetVsActual(b.id, new Date().getUTCMonth() + 1);
        for (const r of bva.rows.filter((x) => x.type !== "revenue" && x.budgeted > 0 && x.actual > x.budgeted)) {
          out.push({ id: `bud-${r.accountNumber}`, key: "budgetExceeded", severity: "warn", title: `${r.accountName} over budget`, detail: `${Math.round((r.actual / r.budgeted) * 100)}% of YTD budget spent`, href: "/accounting/budgets" });
        }
      }
    }

    if (prefs.largeJournal) {
      for (const e of useLedger.getState().entries.filter((x) => x.status === "Posted")) {
        const dr = e.lines.reduce((n, l) => n + l.debit, 0);
        if (dr >= LARGE_JE) out.push({ id: `je-${e.id}`, key: "largeJournal", severity: "info", title: `Large entry ${e.number}`, detail: `${e.memo} · ${dr.toLocaleString()}`, href: "/accounting/journal-entries" });
      }
    }

    return out;
  },
}));
