import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/cn";

export function CommandPageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description?: string; actions?: ReactNode }) {
  return <div className="mb-5 flex flex-wrap items-end justify-between gap-4"><div>{eyebrow && <p className="mb-1 text-[10px] font-bold uppercase tracking-[.18em] text-emerald-700">{eyebrow}</p>}<h1 className="font-display text-[1.65rem] font-bold tracking-tight text-slate-950">{title}</h1>{description && <p className="mt-1 max-w-3xl text-sm leading-5 text-slate-500">{description}</p>}</div>{actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}</div>;
}

export function CommandButton({ children, variant = "primary", className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" | "quiet" }) {
  const styles = { primary: "bg-slate-950 text-white hover:bg-slate-800", secondary: "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50", danger: "bg-red-600 text-white hover:bg-red-700", quiet: "text-slate-600 hover:bg-slate-100" };
  return <button {...props} className={cn("inline-flex h-9 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold transition disabled:pointer-events-none disabled:opacity-45", styles[variant], className)}>{children}</button>;
}

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn("rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,.03)]", className)}>{children}</section>;
}

export function PanelHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3"><div><h2 className="text-sm font-bold text-slate-900">{title}</h2>{description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}</div>{action}</div>;
}

export function MetricCard({ label, value, hint, trend = 0, icon }: { label: string; value: ReactNode; hint?: string; trend?: number; icon?: ReactNode }) {
  return <div className="min-w-0 border-l-2 border-emerald-400 bg-white px-3.5 py-3 shadow-[0_1px_2px_rgba(15,23,42,.04)] ring-1 ring-slate-200"><div className="flex items-start justify-between gap-2"><p className="truncate text-[10px] font-bold uppercase tracking-[.1em] text-slate-500">{label}</p>{icon && <span className="text-slate-400">{icon}</span>}</div><p className="mt-1 font-display text-xl font-bold tracking-tight text-slate-950 [font-variant-numeric:tabular-nums]">{value}</p><div className="mt-1 flex items-center gap-1 text-[11px]">{trend > 0 ? <><ArrowUpRight size={12} className="text-emerald-600" /><span className="font-semibold text-emerald-700">{trend}%</span></> : trend < 0 ? <><ArrowDownRight size={12} className="text-red-600" /><span className="font-semibold text-red-700">{Math.abs(trend)}%</span></> : <Minus size={12} className="text-slate-400" />}{hint && <span className="truncate text-slate-400">{hint}</span>}</div></div>;
}

export function StatusPill({ status }: { status: string }) {
  const s = status.toLowerCase();
  const style = s.includes("active") || s.includes("operational") || s.includes("paid") || s.includes("approved") || s.includes("connected") || s.includes("completed") || s.includes("shipped") || s === "live" || s === "current" || s.includes("succeeded")
    ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
    : s.includes("suspend") || s.includes("expired") || s.includes("overdue") || s.includes("error") || s.includes("outage") || s.includes("failed") || s.includes("rejected") || s.includes("revoked") || s.includes("blocked") || s.includes("cancel")
      ? "bg-red-50 text-red-700 ring-red-200"
      : s.includes("trial") || s.includes("due") || s.includes("grace") || s.includes("review") || s.includes("progress") || s.includes("degraded") || s.includes("maintenance") || s.includes("expiring") || s.includes("monitoring")
        ? "bg-amber-50 text-amber-700 ring-amber-200"
        : "bg-slate-100 text-slate-600 ring-slate-200";
  return <span className={cn("inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset", style)}>{status}</span>;
}

export function CommandInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn("h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15", props.className)} />;
}

export function CommandSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn("h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15", props.className)} />;
}
