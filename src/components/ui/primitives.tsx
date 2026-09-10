import { type ReactNode, type ButtonHTMLAttributes, forwardRef } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/cn";

/* ---------- Button ---------- */
type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "action" | "ghost" | "soft";
};
export const Button = forwardRef<HTMLButtonElement, BtnProps>(function Button(
  { variant = "primary", className, children, ...rest },
  ref,
) {
  const map = {
    primary: "btn-primary",
    action: "btn-action",
    ghost: "btn-ghost",
    soft: "btn-soft",
  } as const;
  return (
    <button ref={ref} className={cn(map[variant], className)} {...rest}>
      {children}
    </button>
  );
});

/* ---------- Card ---------- */
export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("card", className)}>{children}</div>;
}

/* ---------- Page header ---------- */
export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-6 flex flex-wrap items-end justify-between gap-4"
    >
      <div>
        <h1 className="font-display text-2xl font-bold text-mist-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-mist-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </motion.div>
  );
}

/* ---------- Stat card ---------- */
export function StatCard({
  label,
  value,
  hint,
  tone = "brand",
  icon,
  delay = 0,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: "brand" | "action" | "mist" | "amber";
  icon?: ReactNode;
  delay?: number;
}) {
  const tones = {
    brand: { wash: "from-brand-500/[0.10]", text: "text-brand-700" },
    action: { wash: "from-action-500/[0.10]", text: "text-action-700" },
    mist: { wash: "from-mist-500/[0.10]", text: "text-mist-700" },
    amber: { wash: "from-amber-500/[0.10]", text: "text-amber-700" },
  } as const;
  const tk = tones[tone];
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="card relative flex min-w-0 items-start justify-between gap-3 overflow-hidden p-4"
    >
      <div className={cn("pointer-events-none absolute inset-0 bg-gradient-to-br to-transparent", tk.wash)} />
      <div className="relative min-w-0">
        <p className="truncate text-[11px] font-bold uppercase tracking-wider text-mist-400">{label}</p>
        <p className="mt-1 font-display text-[1.65rem] font-bold leading-tight tracking-tight text-mist-900 [font-variant-numeric:tabular-nums]">
          {value}
        </p>
        {hint && <p className="mt-0.5 truncate text-xs text-mist-400">{hint}</p>}
      </div>
      {icon && (
        <div className={cn("relative shrink-0 rounded-xl bg-white/80 p-2 ring-1 ring-mist-200", tk.text)}>{icon}</div>
      )}
    </motion.div>
  );
}

/* ---------- Badge ---------- */
export function Badge({
  children,
  tone = "mist",
}: {
  children: ReactNode;
  tone?: "brand" | "action" | "mist" | "amber";
}) {
  const map = {
    brand: "bg-brand-50 text-brand-700 ring-1 ring-brand-200",
    action: "bg-action-50 text-action-700 ring-1 ring-action-200",
    mist: "bg-mist-100 text-mist-600 ring-1 ring-mist-200",
    amber: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  } as const;
  return <span className={cn("chip", map[tone])}>{children}</span>;
}

export function statusTone(s: string): "brand" | "action" | "mist" | "amber" {
  const v = s.toLowerCase();
  if (
    ["in progress", "active", "resulted", "dispensed", "completed", "attended", "normal", "paid",
     "approved", "done", "cured", "recovered", "current", "up to date", "synced", "protected", "controlled", "acknowledged",
     "confirmed", "settled"].includes(v)
  )
    return "brand";
  if (
    ["waiting", "pending", "sample collected", "scheduled", "open", "mam", "submitted", "draft",
     "due", "future", "in process", "under repair", "not started", "queued", "unpaid", "incomplete",
     "requested", "uploaded", "ongoing", "new", "repaying", "review ongoing", "awaiting approval"].includes(v)
  )
    return "amber";
  if (
    ["referred", "rejected", "no-show", "critical", "sam", "out", "discontinued", "blocked",
     "overdue", "locked", "faulty", "died", "uncontrolled", "high", "emergency", "returned", "declined"].includes(v)
  )
    return "action";
  return "mist";
}

/* ---------- Empty state ----------
 * `variant` keeps two very different meanings apart:
 *   "empty"       — nothing has been recorded yet (a normal, expected state)
 *   "unavailable" — the information exists elsewhere but cannot be shown here
 *   "error"       — something went wrong loading it
 */
export function EmptyState({
  title,
  hint,
  action,
  variant = "empty",
  compact = false,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
  variant?: "empty" | "unavailable" | "error";
  compact?: boolean;
}) {
  const mark = {
    empty: "bg-brand-gradient-soft",
    unavailable: "bg-mist-200",
    error: "bg-action-100 ring-1 ring-action-200",
  }[variant];
  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed text-center",
        variant === "error" ? "border-action-200 bg-action-50/50" : "border-mist-300 bg-mist-50/60",
        compact ? "px-4 py-8" : "px-6 py-14",
      )}
    >
      <div className={cn("h-10 w-10 rounded-xl", mark)} />
      <p className="font-semibold text-mist-700">{title}</p>
      {hint && <p className="max-w-sm text-sm text-mist-400">{hint}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/* ---------- Section note ----------
 * Inline honest placeholder for a panel that genuinely has nothing to show —
 * distinguishes "none recorded" from "unavailable" without a full empty state.
 */
export function SectionNote({
  children,
  tone = "empty",
}: {
  children: ReactNode;
  tone?: "empty" | "unavailable";
}) {
  return (
    <p
      className={cn(
        "rounded-xl px-3 py-2 text-sm",
        tone === "unavailable" ? "bg-mist-100 text-mist-500" : "bg-mist-50 text-mist-400",
      )}
    >
      {children}
    </p>
  );
}

/* ---------- Progress bar ---------- */
export function Progress({ value, target, tone = "brand" }: { value: number; target: number; tone?: "brand" | "action" }) {
  const p = target > 0 ? Math.min(100, Math.max(0, Math.round((value / target) * 100))) : 0;
  return (
    <div
      className="h-2 w-full overflow-hidden rounded-full bg-mist-200/70"
      role="progressbar"
      aria-valuenow={p}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <motion.div
        className={cn("h-full rounded-full", tone === "action" ? "bg-action-gradient" : "bg-brand-gradient")}
        initial={{ width: 0 }}
        animate={{ width: `${p}%` }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      />
    </div>
  );
}
