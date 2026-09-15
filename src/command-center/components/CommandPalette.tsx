import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, FileCheck2, FileKey2, Map, PackagePlus, ReceiptText, Search, UserRound, X } from "lucide-react";
import { useCommandCenter } from "../useCommandCenter";
import { COMMAND_ITEMS } from "../navigation";
import { hasPermission } from "../access";
import type { PlatformPermission } from "../domain";
import { cn } from "@/lib/cn";
import { useAuth } from "@/store/useAuth";
import { useRoadmap } from "@/roadmap/useRoadmap";

type Result = { id: string; type: string; label: string; meta: string; to: string; icon: typeof Building2; permission?: PlatformPermission };

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const { organizations, tenantUsers, subscriptions, invoices, licenses, documents, platformUsers } = useCommandCenter();
  const roadmapItems = useRoadmap((state) => state.items);
  const userId = useAuth((state) => state.identity?.platformUserId);
  const user = platformUsers.find((item) => item.id === userId);
  const close = useCallback(() => { setQuery(""); onClose(); }, [onClose]);

  useEffect(() => {
    if (!open) return;
    requestAnimationFrame(() => input.current?.focus());
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && close();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [close, open]);

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      const quickActions: Result[] = [
        { id: "create-org", type: "Quick action", label: "Create Organization", meta: "Start a new tenant onboarding", to: "/command-center/organizations?create=1", icon: Building2, permission: "organizations.manage" },
        { id: "create-package", type: "Quick action", label: "Create Package", meta: "Define a versioned plan", to: "/command-center/packages", icon: PackagePlus, permission: "catalog.manage" },
        { id: "extend-license", type: "Quick action", label: "Extend License", meta: "Open renewal and expiry controls", to: "/command-center/licenses", icon: FileKey2, permission: "subscriptions.manage" },
        { id: "view-invoice", type: "Quick action", label: "View Invoice", meta: "Search customer invoices", to: "/command-center/invoices", icon: ReceiptText, permission: "billing.manage" },
        { id: "suspend-org", type: "Quick action", label: "Suspend Organization", meta: "Requires a tenant and audited reason", to: "/command-center/organizations", icon: Building2, permission: "organizations.manage" },
      ];
      return [
        ...quickActions.filter((action) => !action.permission || hasPermission(user, action.permission)),
        ...COMMAND_ITEMS.filter((item) => !item.permission || hasPermission(user, item.permission)).slice(0, 6).map((item) => ({ id: item.to, type: "Navigation", label: item.label, meta: item.to, to: item.to, icon: Search })),
      ];
    }
    const all: Result[] = [
      ...organizations.map((o) => ({ id: o.id, type: "Organizations", label: o.name, meta: `${o.tenantId} · ${o.domain}`, to: `/command-center/organizations/${o.id}`, icon: Building2 })),
      ...tenantUsers.map((u) => ({ id: u.id, type: "Users", label: u.name, meta: `${u.email} · ${u.employeeId}`, to: `/command-center/organizations/${u.organizationId}?tab=Users`, icon: UserRound })),
      ...subscriptions.map((s) => ({ id: s.id, type: "Subscriptions", label: s.id, meta: s.status, to: `/command-center/organizations/${s.organizationId}?tab=Subscription`, icon: PackagePlus })),
      ...invoices.map((i) => ({ id: i.id, type: "Invoices", label: i.number, meta: `${i.status} · ${i.currency} ${i.total.toLocaleString()}`, to: `/command-center/organizations/${i.organizationId}?tab=Billing`, icon: ReceiptText })),
      ...licenses.map((l) => ({ id: l.id, type: "Licenses", label: l.id, meta: `${l.status} · ${l.validUntil}`, to: `/command-center/organizations/${l.organizationId}?tab=Subscription`, icon: FileKey2 })),
      ...documents.map((d) => ({ id: d.id, type: "Documents", label: d.type, meta: d.status, to: `/command-center/organizations/${d.organizationId}?tab=Documents`, icon: FileCheck2 })),
      ...roadmapItems.map((item) => ({ id: item.id, type: "Roadmap", label: item.title, meta: `${item.status.replaceAll("_", " ")} · ${item.ownerName ?? "Unassigned"}`, to: `/command-center/roadmap?item=${encodeURIComponent(item.id)}`, icon: Map, permission: "roadmap.view" as PlatformPermission })),
    ];
    return all.filter((item) => (!item.permission || hasPermission(user, item.permission)) && `${item.label} ${item.meta}`.toLowerCase().includes(needle)).slice(0, 24);
  }, [documents, invoices, licenses, organizations, query, roadmapItems, subscriptions, tenantUsers, user]);

  if (!open) return null;
  const openResult = (to: string) => { navigate(to); close(); };

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center bg-slate-950/55 px-3 pt-[10vh] backdrop-blur-sm" onMouseDown={(event) => event.currentTarget === event.target && close()}>
      <div role="dialog" aria-modal="true" aria-label="Command Center search" className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
        <div className="flex items-center gap-3 border-b border-slate-700 px-4">
          <Search size={19} className="text-emerald-400" />
          <input ref={input} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search organizations, users, invoices, licenses, roadmap…" className="h-14 flex-1 bg-transparent text-[15px] text-white outline-none placeholder:text-slate-500" />
          <button onClick={close} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white" aria-label="Close command palette"><X size={17} /></button>
        </div>
        <div className="max-h-[62vh] overflow-y-auto p-2">
          {!results.length && <div className="px-4 py-12 text-center text-sm text-slate-400">No matching platform resources.</div>}
          {results.map((result, index) => (
            <button key={`${result.type}-${result.id}`} onClick={() => openResult(result.to)} autoFocus={index === 0 && !!query} className={cn("flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left outline-none hover:bg-slate-800 focus:bg-slate-800") }>
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-800 text-emerald-400"><result.icon size={17} /></span>
              <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-slate-100">{result.label}</span><span className="block truncate text-xs text-slate-500">{result.meta}</span></span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600">{result.type}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between border-t border-slate-800 bg-slate-950/60 px-4 py-2 text-[11px] text-slate-500"><span>Enter to open · Esc to close</span><span>Global tenant-scoped search</span></div>
      </div>
    </div>
  );
}
