import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ShieldPlus } from "lucide-react";
import { NAV, type NavItem } from "@/data/nav";
import { PRESCRIPTION_PENDING_STATUSES } from "@/data/pharmacyOps";
import { useEmr } from "@/store/useEmr";
import { useTenant } from "@/store/useTenant";
import { cn } from "@/lib/cn";
import { useRouteGate } from "@/platform/useEntitlements";

function LeafLink({
  to,
  label,
  icon: Icon,
  badge,
  onNavigate,
}: {
  to: string;
  label: string;
  icon?: NavItem["icon"];
  badge?: number;
  onNavigate?: () => void;
}) {
  return (
    <NavLink
      to={to}
      end={to === "/workspace"}
      onClick={onNavigate}
      className={({ isActive }) => cn("nav-link", isActive && "nav-link-active")}
    >
      {({ isActive }) => (
        <>
          {Icon ? <Icon size={17} className="shrink-0" /> : <span className="ml-1 h-1.5 w-1.5 shrink-0 rounded-full bg-mist-300" />}
          <span className="flex-1 truncate">{label}</span>
          {badge && badge > 0 ? (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className={cn(
                "grid h-5 min-w-[20px] place-items-center rounded-full px-1 text-[10px] font-bold",
                isActive ? "bg-white/25 text-white" : "bg-action-gradient text-white",
              )}
            >
              {badge}
            </motion.span>
          ) : null}
        </>
      )}
    </NavLink>
  );
}

function NestedItem({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  const loc = useLocation();
  const childActive = item.children!.some((c) => loc.pathname === c.to || loc.pathname.startsWith(c.to + "/"));
  const [open, setOpen] = useState(childActive);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn("nav-link w-full", childActive && !open && "text-brand-700")}
      >
        <item.icon size={17} className="shrink-0" />
        <span className="flex-1 truncate text-left">{item.label}</span>
        <ChevronDown size={14} className={cn("shrink-0 transition-transform", open && "rotate-180")} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="ml-4 mt-0.5 space-y-0.5 border-l border-mist-200 pl-2">
              {item.children!.map((c) => (
                <LeafLink key={c.to} to={c.to} label={c.label} onNavigate={onNavigate} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const queue = useEmr((s) => s.queue);
  const labs = useEmr((s) => s.labOrders);
  const encounters = useEmr((s) => s.encounters);
  const tenant = useTenant((s) => s.tenant);
  const { isRouteAllowed } = useRouteGate();

  // drop nav items whose route isn't licensed; drop nested items with no allowed children; drop empty groups
  const nav = NAV.map((group) => ({
    ...group,
    items: group.items
      .map((item) =>
        item.children ? { ...item, children: item.children.filter((c) => isRouteAllowed(c.to)) } : item,
      )
      .filter((item) => (item.children ? item.children.length > 0 : isRouteAllowed(item.to))),
  })).filter((group) => group.items.length > 0);

  const badges = {
    queue: queue.filter((q) => q.status === "Waiting" || q.status === "In Progress").length,
    lab: labs.filter((l) => l.status === "Pending" || l.status === "Sample Collected").length,
    rx: encounters.flatMap((e) => e.prescriptions).filter((r) => (PRESCRIPTION_PENDING_STATUSES as readonly string[]).includes(r.status)).length,
  };

  return (
    <aside className="flex h-full w-[268px] shrink-0 flex-col border-r border-mist-200 bg-white">
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand-gradient text-white shadow-glow">
          <ShieldPlus size={20} />
        </div>
        <div className="leading-tight">
          <p className="font-display text-lg font-extrabold tracking-tight text-mist-900">
            Sabi<span className="text-gradient">EMR</span>
          </p>
          <p className="text-[11px] text-mist-400">{tenant.facilityCode}</p>
        </div>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-6">
        {nav.map((group) => (
          <div key={group.title}>
            <p className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-mist-300">{group.title}</p>
            <div className="space-y-0.5">
              {group.items.map((item) =>
                item.children ? (
                  <NestedItem key={item.label} item={item} onNavigate={onNavigate} />
                ) : (
                  <LeafLink
                    key={item.to}
                    to={item.to}
                    label={item.label}
                    icon={item.icon}
                    badge={item.badge ? badges[item.badge] : 0}
                    onNavigate={onNavigate}
                  />
                ),
              )}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-mist-100 px-5 py-3 text-[11px] text-mist-400">
        {tenant.name} · {tenant.state}, {tenant.country}
      </div>
    </aside>
  );
}
