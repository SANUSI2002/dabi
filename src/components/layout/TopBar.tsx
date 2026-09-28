import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Bell, RefreshCw, LogOut, ChevronDown, Menu, MonitorSmartphone, Building2 } from "lucide-react";
import { useAuth } from "@/store/useAuth";
import { initials, shortDate } from "@/lib/format";
import { useTenant } from "@/store/useTenant";
import { useEmr } from "@/store/useEmr";
import { NAV } from "@/data/nav";
import { useRouteGate } from "@/platform/useEntitlements";
import { useNotifications, type Alert } from "@/store/accounting/useNotifications";

type SearchResult = { label: string; detail: string; to: string };

export function TopBar({ onMenu }: { onMenu?: () => void }) {
  const navigate = useNavigate();
  const { user, signOut, identity, memberships } = useAuth();
  const tenant = useTenant((s) => s.tenant);
  const patients = useEmr((s) => s.patients);
  const alertsForUser = useNotifications((s) => s.alerts);
  const { isRouteAllowed } = useRouteGate();
  const [menu, setMenu] = useState(false);
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Alert[]>([]);
  const ref = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);

  const query = search.trim().toLowerCase();
  const patientResults: SearchResult[] = query.length < 2 ? [] : patients
    .filter((patient) => isRouteAllowed(`/patients/${patient.id}`))
    .filter((patient) => [patient.firstName, patient.lastName, patient.mrn, `${patient.firstName} ${patient.lastName}`]
      .some((value) => value.toLowerCase().includes(query)))
    .slice(0, 5)
    .map((patient) => ({ label: `${patient.firstName} ${patient.lastName}`, detail: patient.mrn, to: `/patients/${patient.id}` }));
  const moduleResults: SearchResult[] = query.length < 2 ? [] : NAV.flatMap((group) => group.items.flatMap((item) => item.children?.length
    ? item.children.map((child) => ({ label: child.label, detail: group.title, to: child.to }))
    : [{ label: item.label, detail: group.title, to: item.to }]))
    .filter((item) => isRouteAllowed(item.to) && `${item.label} ${item.detail}`.toLowerCase().includes(query))
    .slice(0, 5);
  const results = [...patientResults, ...moduleResults];

  function goTo(result: SearchResult) {
    setSearch("");
    setSearchOpen(false);
    navigate(result.to);
  }

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (menu && ref.current && !ref.current.contains(e.target as Node)) setMenu(false);
      if (searchOpen && searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchOpen(false);
      if (notificationsOpen && notificationsRef.current && !notificationsRef.current.contains(e.target as Node)) setNotificationsOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menu, searchOpen, notificationsOpen]);

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
        <span className="rounded bg-white px-1.5 py-0.5 font-bold text-brand-700 shadow-sm">{tenant.facilityCode}</span>
        <span className="hidden max-w-[180px] truncate xl:inline">{tenant.name}</span>
      </div>

      {/* search — flexible, capped */}
      <div className="hidden min-w-0 flex-1 md:block" ref={searchRef}>
        <div className="relative mx-auto max-w-md">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-mist-400" />
          <input
            aria-label="Search patients and modules"
            aria-expanded={searchOpen && query.length >= 2}
            placeholder="Search patients, modules, MRN…"
            value={search}
            onFocus={() => setSearchOpen(true)}
            onChange={(event) => { setSearch(event.target.value); setSearchOpen(true); }}
            onKeyDown={(event) => {
              if (event.key === "Escape") setSearchOpen(false);
              if (event.key === "Enter" && results[0]) goTo(results[0]);
            }}
            className="w-full rounded-xl bg-mist-100/70 py-2 pl-9 pr-3 text-sm text-mist-800 outline-none ring-1 ring-transparent transition placeholder:text-mist-400 focus:bg-white focus:ring-2 focus:ring-brand-400"
          />
          {searchOpen && query.length >= 2 && <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-80 overflow-y-auto rounded-xl border border-mist-200 bg-white p-1.5 shadow-pop">
            {results.length ? results.map((result) => <button key={`${result.to}-${result.label}`} type="button" onClick={() => goTo(result)} className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-mist-50 focus:bg-mist-50">
              <span className="truncate font-medium text-mist-800">{result.label}</span><span className="shrink-0 text-xs text-mist-400">{result.detail}</span>
            </button>) : <p className="px-3 py-2 text-sm text-mist-500">No matching patients or modules.</p>}
          </div>}
        </div>
      </div>

      {/* right cluster — never shrinks */}
      <div className="ml-auto flex shrink-0 items-center gap-1">
        <button onClick={() => window.location.reload()} className="hidden rounded-lg p-2 text-mist-500 hover:bg-mist-100 sm:block" aria-label="Refresh">
          <RefreshCw size={17} />
        </button>
        <div className="relative" ref={notificationsRef}>
          <button type="button" onClick={() => { setNotifications(alertsForUser()); setNotificationsOpen((open) => !open); }} className="rounded-lg p-2 text-mist-500 hover:bg-mist-100" aria-label="Notifications" aria-expanded={notificationsOpen}><Bell size={17} /></button>
          {notificationsOpen && <div className="absolute right-0 top-full z-50 mt-2 w-80 max-w-[90vw] rounded-xl border border-mist-200 bg-white p-3 shadow-pop">
            <p className="mb-2 text-sm font-bold text-mist-900">In-app alerts</p>
            {notifications.length ? <div className="max-h-72 space-y-1 overflow-y-auto">{notifications.slice(0, 10).map((item) => <Link key={item.id} to={item.href} onClick={() => setNotificationsOpen(false)} className="block rounded-lg px-2 py-2 hover:bg-mist-50"><span className="block text-sm font-semibold text-mist-800">{item.title}</span><span className="block text-xs text-mist-500">{item.detail}</span></Link>)}</div> : <p className="text-sm text-mist-500">No current in-app alerts.</p>}
            {notifications.length > 10 && <Link to="/accounting/notifications" onClick={() => setNotificationsOpen(false)} className="mt-2 block text-xs font-semibold text-brand-700">View all alerts</Link>}
          </div>}
        </div>
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
                className="absolute right-0 mt-2 w-60 overflow-hidden rounded-xl bg-white p-1.5 shadow-pop ring-1 ring-mist-200"
              >
                <div className="border-b border-mist-100 px-3 py-2 text-xs text-mist-400">
                  Signed in with Sabi ID
                  <span className="mt-0.5 block truncate font-medium text-mist-700">{identity?.email}</span>
                  <span className="mt-0.5 block text-[11px] text-mist-400">{user.systemRole}</span>
                  <span className="mt-1 block truncate text-[11px] font-semibold text-brand-700">{tenant.name} · {tenant.tenantId}</span>
                </div>
                <Link to="/account/sessions" onClick={() => setMenu(false)} className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-mist-600 hover:bg-mist-50"><MonitorSmartphone size={15}/> Sessions & devices</Link>
                {memberships.length > 1 && <Link to="/choose-organization" onClick={() => setMenu(false)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-mist-600 hover:bg-mist-50"><Building2 size={15}/> Switch organization</Link>}
                <button
                  onClick={signOut}
                  className="mt-1 flex w-full items-center gap-2 rounded-lg border-t border-mist-100 px-3 py-2 text-sm font-medium text-action-600 hover:bg-action-50"
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
