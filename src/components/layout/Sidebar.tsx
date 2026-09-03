import { NavLink } from "react-router-dom";
import { motion } from "framer-motion";
import { NAV } from "@/data/nav";
import { ShieldPlus } from "lucide-react";
import { useEmr } from "@/store/useEmr";
import { FACILITY } from "@/data/mock";
import { cn } from "@/lib/cn";

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const queue = useEmr((s) => s.queue);
  const labs = useEmr((s) => s.labOrders);
  const encounters = useEmr((s) => s.encounters);

  const badges = {
    queue: queue.filter((q) => q.status === "Waiting" || q.status === "In Progress").length,
    lab: labs.filter((l) => l.status === "Pending" || l.status === "Sample Collected").length,
    rx: encounters.flatMap((e) => e.prescriptions).filter((r) => r.status === "Pending").length,
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
          <p className="text-[11px] text-mist-400">{FACILITY.code}</p>
        </div>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-6">
        {NAV.map((group) => (
          <div key={group.title}>
            <p className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-mist-300">
              {group.title}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const b = item.badge ? badges[item.badge] : 0;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === "/"}
                    onClick={onNavigate}
                    className={({ isActive }) => cn("nav-link", isActive && "nav-link-active")}
                  >
                    {({ isActive }) => (
                      <>
                        <item.icon size={17} className="shrink-0" />
                        <span className="flex-1 truncate">{item.label}</span>
                        {b > 0 && (
                          <motion.span
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className={cn(
                              "grid h-5 min-w-[20px] place-items-center rounded-full px-1 text-[10px] font-bold",
                              isActive ? "bg-white/25 text-white" : "bg-action-gradient text-white",
                            )}
                          >
                            {b}
                          </motion.span>
                        )}
                      </>
                    )}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-mist-100 px-5 py-3 text-[11px] text-mist-400">
        {FACILITY.name} · {FACILITY.lga}, {FACILITY.state}
      </div>
    </aside>
  );
}
