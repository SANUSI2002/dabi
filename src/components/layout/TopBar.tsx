import { useState } from "react";
import { motion } from "framer-motion";
import { Search, Bell, RefreshCw, Wifi, LogOut, ChevronDown, Menu } from "lucide-react";
import { useAuth } from "@/store/useAuth";
import { initials, shortDate } from "@/lib/format";
import { FACILITY } from "@/data/mock";

export function TopBar({ onMenu }: { onMenu?: () => void }) {
  const { user, signOut } = useAuth();
  const [menu, setMenu] = useState(false);

  return (
    <header className="glass sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-mist-200 px-4 lg:px-6">
      <button onClick={onMenu} className="rounded-lg p-2 text-mist-500 hover:bg-mist-100 lg:hidden">
        <Menu size={18} />
      </button>

      <div className="hidden items-center gap-2 rounded-lg bg-mist-100/70 px-2.5 py-1 text-xs font-medium text-mist-500 sm:flex">
        <span className="rounded bg-white px-1.5 py-0.5 font-bold text-brand-700 shadow-sm">{FACILITY.code}</span>
        {FACILITY.name}
      </div>

      <div className="relative mx-auto hidden w-full max-w-md md:block">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-mist-400" />
        <input
          placeholder="Search patients, modules, MRN…"
          className="w-full rounded-xl bg-mist-100/70 py-2 pl-9 pr-3 text-sm outline-none ring-1 ring-transparent transition focus:bg-white focus:ring-brand-400"
        />
      </div>

      <div className="ml-auto flex items-center gap-1">
        <span className="mr-1 hidden items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700 ring-1 ring-brand-200 sm:flex">
          <Wifi size={13} /> Online
        </span>
        <button className="rounded-lg p-2 text-mist-500 hover:bg-mist-100">
          <RefreshCw size={17} />
        </button>
        <button className="relative rounded-lg p-2 text-mist-500 hover:bg-mist-100">
          <Bell size={17} />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-action-500 ring-2 ring-white" />
        </button>
        <span className="mx-2 hidden text-xs text-mist-400 lg:block">{shortDate(new Date())}</span>

        <div className="relative">
          <button
            onClick={() => setMenu((v) => !v)}
            className="flex items-center gap-2 rounded-xl p-1 pr-2 hover:bg-mist-100"
          >
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-gradient text-xs font-bold text-white">
              {initials(user.name)}
            </span>
            <span className="hidden text-left leading-tight sm:block">
              <span className="block text-xs font-semibold text-mist-800">{user.name}</span>
              <span className="block text-[10px] text-mist-400">{user.role}</span>
            </span>
            <ChevronDown size={14} className="text-mist-400" />
          </button>
          {menu && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute right-0 mt-2 w-52 overflow-hidden rounded-xl bg-white p-1.5 shadow-pop ring-1 ring-mist-200"
            >
              <div className="px-3 py-2 text-xs text-mist-400">Signed in as {user.username}</div>
              <button
                onClick={signOut}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-action-600 hover:bg-action-50"
              >
                <LogOut size={15} /> Sign out
              </button>
            </motion.div>
          )}
        </div>
      </div>
    </header>
  );
}
