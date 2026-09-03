import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Bell, RefreshCw, Wifi, LogOut, ChevronDown, Menu } from "lucide-react";
import { useAuth } from "@/store/useAuth";
import { initials, shortDate } from "@/lib/format";
import { FACILITY } from "@/data/mock";

export function TopBar({ onMenu }: { onMenu?: () => void }) {
  const { user, signOut } = useAuth();
  const [menu, setMenu] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setMenu(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menu]);

  return (
    <header className="glass sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-mist-200 px-3 sm:gap-3 sm:px-4 lg:px-6">
      <button
        onClick={onMenu}
        className="shrink-0 rounded-lg p-2 text-mist-500 hover:bg-mist-100 lg:hidden"
        aria-label="Open navigation"
      >
        <Menu size={18} />
      </button>

      {/* facility badge */}
      <div className="hidden shrink-0 items-center gap-2 rounded-lg bg-mist-100/70 px-2 py-1 text-xs font-medium text-mist-500 sm:flex">
        <span className="rounded bg-white px-1.5 py-0.5 font-bold text-brand-700 shadow-sm">{FACILITY.code}</span>
        <span className="hidden max-w-[140px] truncate xl:inline">{FACILITY.name}</span>
      </div>

      {/* search — flexible, capped */}
      <div className="relative hidden min-w-0 flex-1 md:block">
        <div className="mx-auto max-w-md">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-mist-400" />
          <input
            placeholder="Search patients, modules, MRN…"
            className="w-full rounded-xl bg-mist-100/70 py-2 pl-9 pr-3 text-sm text-mist-800 outline-none ring-1 ring-transparent transition placeholder:text-mist-400 focus:bg-white focus:ring-2 focus:ring-brand-400"
          />
        </div>
      </div>

      {/* right cluster — never shrinks */}
      <div className="ml-auto flex shrink-0 items-center gap-1">
        <span className="mr-1 hidden items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700 ring-1 ring-brand-200 sm:flex">
          <Wifi size={13} /> Online
        </span>
        <button className="hidden rounded-lg p-2 text-mist-500 hover:bg-mist-100 sm:block" aria-label="Refresh">
          <RefreshCw size={17} />
        </button>
        <button className="relative rounded-lg p-2 text-mist-500 hover:bg-mist-100" aria-label="Notifications">
          <Bell size={17} />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-action-500 ring-2 ring-white" />
        </button>
        <span className="mx-1 hidden whitespace-nowrap text-xs text-mist-400 xl:block">{shortDate(new Date())}</span>

        <div className="relative" ref={ref}>
          <button
            onClick={() => setMenu((v) => !v)}
            className="flex items-center gap-2 rounded-xl p-1 pr-1.5 hover:bg-mist-100 sm:pr-2"
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-gradient text-xs font-bold text-white">
              {initials(user.name)}
            </span>
            <span className="hidden max-w-[160px] text-left leading-tight lg:block">
              <span className="block truncate text-xs font-semibold text-mist-800">{user.name}</span>
              <span className="block truncate text-[10px] text-mist-400">{user.role}</span>
            </span>
            <ChevronDown size={14} className="hidden shrink-0 text-mist-400 sm:block" />
          </button>
          <AnimatePresence>
            {menu && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.98 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 mt-2 w-52 overflow-hidden rounded-xl bg-white p-1.5 shadow-pop ring-1 ring-mist-200"
              >
                <div className="border-b border-mist-100 px-3 py-2 text-xs text-mist-400">
                  Signed in as <span className="font-medium text-mist-600">{user.username}</span>
                </div>
                <button
                  onClick={signOut}
                  className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-action-600 hover:bg-action-50"
                >
                  <LogOut size={15} /> Sign out
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}
