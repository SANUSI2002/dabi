import { Activity, ShieldPlus } from "lucide-react";
import { motion } from "framer-motion";
import { routeLabel } from "./loadingRoutes";

function BrandLoader({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className={`relative grid place-items-center ${compact ? "h-16 w-16" : "h-20 w-20"}`}>
        <motion.span
          aria-hidden="true"
          className="absolute inset-0 rounded-[24px] border-2 border-brand-200"
          animate={{ rotate: 360 }}
          transition={{ duration: 1.5, ease: "linear", repeat: Infinity }}
          style={{ borderTopColor: "rgb(15 192 109)", borderRightColor: "transparent" }}
        />
        <span className={`${compact ? "h-12 w-12 rounded-2xl" : "h-14 w-14 rounded-[20px]"} grid place-items-center bg-brand-gradient text-white shadow-glow`}>
          <ShieldPlus size={compact ? 23 : 27} />
        </span>
      </div>
      {!compact && (
        <div className="mt-5 flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.18em] text-brand-700">
          <Activity size={13} className="animate-pulse" /> Secure clinical workspace
        </div>
      )}
    </div>
  );
}

export function AppLoadingScreen({ pathname }: { pathname: string }) {
  const isEmr = !pathname.startsWith("/command-center") && !pathname.startsWith("/register") && !pathname.startsWith("/products") && pathname !== "/";

  return (
    <main className="relative grid min-h-full place-items-center overflow-hidden bg-mist-50 px-6" role="status" aria-live="polite" aria-label="Loading Sabi OS">
      <div aria-hidden="true" className="absolute inset-0 bg-mesh" />
      <div className="relative w-full max-w-sm rounded-[30px] bg-white/90 px-8 py-10 text-center shadow-[0_30px_90px_-45px_rgba(2,44,28,.55)] ring-1 ring-mist-200/80 backdrop-blur">
        <BrandLoader />
        <h1 className="mt-5 font-display text-xl font-extrabold text-mist-900">{isEmr ? `Loading ${routeLabel(pathname)}` : "Loading Sabi Health"}</h1>
        <p className="mt-2 text-sm text-mist-500">Preparing your secure workspace and authorized modules.</p>
        <div className="mt-7 h-1.5 overflow-hidden rounded-full bg-brand-100">
          <motion.div className="h-full rounded-full bg-brand-gradient" initial={{ x: "-100%" }} animate={{ x: "260%" }} transition={{ duration: 1.15, ease: "easeInOut", repeat: Infinity }} style={{ width: "38%" }} />
        </div>
      </div>
    </main>
  );
}

export function EmrRouteLoadingScreen({ pathname, tenantName }: { pathname: string; tenantName: string }) {
  return (
    <motion.div
      key={pathname}
      className="absolute inset-0 z-30 grid min-h-[420px] place-items-center overflow-hidden bg-mist-50/95 px-5 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.16 }}
      role="status"
      aria-live="polite"
      aria-label={`Loading ${routeLabel(pathname)}`}
    >
      <div aria-hidden="true" className="absolute inset-0 bg-mesh opacity-70" />
      <div className="relative w-full max-w-lg rounded-[28px] border border-white bg-white/85 p-7 shadow-[0_28px_80px_-48px_rgba(2,44,28,.6)] backdrop-blur">
        <div className="flex items-center gap-5">
          <BrandLoader compact />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-brand-700">{tenantName}</p>
            <h2 className="mt-1 font-display text-xl font-extrabold text-mist-900">Opening {routeLabel(pathname)}</h2>
            <p className="mt-1 text-sm text-mist-500">Loading authorized records and workspace tools…</p>
          </div>
        </div>
        <div aria-hidden="true" className="mt-7 space-y-3">
          <div className="h-2.5 w-2/5 animate-pulse rounded-full bg-brand-100" />
          <div className="h-11 animate-pulse rounded-xl bg-mist-100" />
          <div className="grid grid-cols-3 gap-3">
            <div className="h-16 animate-pulse rounded-xl bg-mist-100" />
            <div className="h-16 animate-pulse rounded-xl bg-mist-100" />
            <div className="h-16 animate-pulse rounded-xl bg-mist-100" />
          </div>
        </div>
        <div className="mt-6 h-1 overflow-hidden rounded-full bg-brand-100">
          <motion.div className="h-full rounded-full bg-brand-gradient" initial={{ width: "12%" }} animate={{ width: "92%" }} transition={{ duration: 0.55, ease: "easeOut" }} />
        </div>
      </div>
    </motion.div>
  );
}
