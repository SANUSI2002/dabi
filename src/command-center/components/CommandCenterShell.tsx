import { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, Building2, Check, ChevronDown, Command, HeartHandshake, LogOut, Menu, Search, ShieldCheck, X } from "lucide-react";
import { navForProduct } from "../navigation";
import { hasPermission } from "../access";
import { useCommandCenter } from "../useCommandCenter";
import { useProductContext, type ProductContext } from "../useProductContext";
import { CommandPalette } from "./CommandPalette";
import { cn } from "@/lib/cn";
import { useAuth } from "@/store/useAuth";

const PRODUCT_OPTIONS: { value: ProductContext; label: string }[] = [
  { value: "all", label: "All Sabi" },
  { value: "sabi-os", label: "Sabi OS" },
  { value: "sabi-health", label: "Sabi Health" },
];

function ProductSwitcher() {
  const product = useProductContext((state) => state.product);
  const setProduct = useProductContext((state) => state.setProduct);
  const [open, setOpen] = useState(false);
  const current = PRODUCT_OPTIONS.find((option) => option.value === product)!;
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-2 text-left text-[12px] font-semibold text-slate-200 hover:bg-white/[0.07]"
      >
        {product === "sabi-os" ? <Building2 size={14} className="text-emerald-400" /> : product === "sabi-health" ? <HeartHandshake size={14} className="text-emerald-400" /> : <ShieldCheck size={14} className="text-emerald-400" />}
        <span className="flex-1 truncate">{current.label}</span>
        <ChevronDown size={13} className={cn("shrink-0 text-slate-500 transition", open && "rotate-180")} />
      </button>
      {open && (
        <div className="absolute inset-x-0 top-[calc(100%+4px)] z-20 overflow-hidden rounded-lg border border-white/10 bg-[#0d1a15] shadow-xl">
          {PRODUCT_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => { setProduct(option.value); setOpen(false); }}
              className="flex w-full items-center gap-2 px-2.5 py-2 text-left text-[12px] font-medium text-slate-300 hover:bg-white/[0.06]"
            >
              <span className="w-3.5">{option.value === product && <Check size={13} className="text-emerald-400" />}</span>
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CommandSidebar({ close }: { close?: () => void }) {
  const userId = useAuth((state) => state.identity?.platformUserId);
  const platformUsers = useCommandCenter((state) => state.platformUsers);
  const user = platformUsers.find((item) => item.id === userId);
  const product = useProductContext((state) => state.product);
  const nav = useMemo(() => navForProduct(product).map((group) => ({ ...group, items: group.items.filter((item) => !item.permission || hasPermission(user, item.permission)) })).filter((group) => group.items.length), [product, user]);
  return (
    <aside className="flex h-full w-[252px] shrink-0 flex-col border-r border-white/[0.07] bg-[#09130f] text-slate-300">
      <div className="flex h-[68px] items-center gap-3 border-b border-white/[0.07] px-4">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-400 text-slate-950 shadow-[0_0_24px_rgba(52,211,153,.22)]"><ShieldCheck size={19} /></div>
        <div className="leading-tight"><p className="font-display text-sm font-extrabold tracking-tight text-white">SABI</p><p className="text-[10px] font-semibold uppercase tracking-[.14em] text-emerald-400">Command Center</p></div>
        {close && <button onClick={close} className="ml-auto rounded-lg p-1.5 text-slate-400 hover:bg-white/10 lg:hidden" aria-label="Close navigation"><X size={18} /></button>}
      </div>
      <div className="border-b border-white/[0.07] px-3 py-3"><ProductSwitcher /></div>
      <nav className="flex-1 space-y-4 overflow-y-auto px-2.5 py-4 [scrollbar-width:thin]">
        {nav.map((group) => (
          <div key={group.title || "overview"}>
            {group.title && <p className="mb-1 px-2.5 text-[9px] font-bold uppercase tracking-[.18em] text-slate-600">{group.title}</p>}
            <div className="space-y-0.5">{group.items.map((item) => <NavLink key={item.to} to={item.to} end={item.to === "/command-center"} onClick={close} className={({ isActive }) => cn("group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[12px] font-medium transition", isActive ? "bg-emerald-400/12 text-emerald-300 ring-1 ring-inset ring-emerald-400/15" : "text-slate-400 hover:bg-white/[0.05] hover:text-slate-200")}><item.icon size={15} className="shrink-0" /><span className="truncate">{item.label}</span></NavLink>)}</div>
          </div>
        ))}
      </nav>
      <div className="border-t border-white/[0.07] px-4 py-3"><p className="truncate text-xs font-semibold text-slate-200">{user?.name}</p><p className="truncate text-[10px] text-slate-500">{user?.role}</p></div>
    </aside>
  );
}

export function CommandCenterShell() {
  const identity = useAuth((state) => state.identity);
  const signOut = useAuth((state) => state.signOut);
  const userId = identity?.platformUserId;
  const platformUsers = useCommandCenter((state) => state.platformUsers);
  const user = platformUsers.find((item) => item.id === userId);
  const serviceHealth = useCommandCenter((state) => state.serviceHealth);
  const degradedServices = serviceHealth.filter((service) => service.status !== "Operational");
  const location = useLocation();
  const navigate = useNavigate();
  const [mobile, setMobile] = useState(false);
  const [palette, setPalette] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setPalette(true); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const previous = document.title;
    document.title = "Sabi Command Center";
    return () => { document.title = previous; };
  }, []);

  if (!user || !hasPermission(user, "platform.view")) return null;

  return (
    <div className="flex h-full min-h-screen bg-[#f4f7f5] text-slate-900">
      <div className="hidden lg:block"><CommandSidebar /></div>
      <AnimatePresence>{mobile && <><motion.button aria-label="Close navigation" className="fixed inset-0 z-40 bg-slate-950/50 lg:hidden" onClick={() => setMobile(false)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} /><motion.div className="fixed inset-y-0 left-0 z-50 lg:hidden" initial={{ x: -260 }} animate={{ x: 0 }} exit={{ x: -260 }}><CommandSidebar close={() => setMobile(false)} /></motion.div></>}</AnimatePresence>
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex h-[68px] items-center gap-3 border-b border-slate-200/80 bg-white/90 px-4 backdrop-blur-xl lg:px-6">
          <button onClick={() => setMobile(true)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden" aria-label="Open navigation"><Menu size={18} /></button>
          <button onClick={() => setPalette(true)} className="flex h-9 min-w-0 max-w-xl flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 text-left text-sm text-slate-400 transition hover:border-slate-300 hover:bg-white"><Search size={15} /><span className="truncate">Search tenants, users, invoices, licenses…</span><span className="ml-auto hidden items-center gap-1 rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-400 sm:flex"><Command size={10} />K</span></button>
          <div className="ml-auto flex items-center gap-2">
            {serviceHealth.length > 0 && (
              <span className={cn("hidden rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 sm:inline", degradedServices.length === 0 ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-amber-50 text-amber-700 ring-amber-200")}>
                {degradedServices.length === 0 ? "All systems operational" : `${degradedServices.length} service${degradedServices.length === 1 ? "" : "s"} degraded`}
              </span>
            )}
            <button onClick={() => navigate("/command-center/notifications")} className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Notifications">
              <Bell size={17} />
              {degradedServices.length > 0 && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-amber-500 ring-2 ring-white" />}
            </button>
            <button onClick={() => { signOut(); window.location.assign("/login"); }} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Sign out of Command Center"><LogOut size={17} /></button>
          </div>
        </header>
        <main className="min-h-[calc(100vh-68px)] overflow-y-auto"><div className="mx-auto max-w-[1560px] px-4 py-5 lg:px-7 lg:py-6"><motion.div key={location.pathname + location.search} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .18 }}><Outlet /></motion.div></div></main>
      </div>
      <CommandPalette open={palette} onClose={() => setPalette(false)} />
    </div>
  );
}
