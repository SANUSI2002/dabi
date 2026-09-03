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
  return <div className={cn("card p-5", className)}>{children}</div>;
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
    brand: "from-brand-500/12 to-brand-500/0 text-brand-700",
    action: "from-action-500/12 to-action-500/0 text-action-700",
    mist: "from-mist-500/12 to-mist-500/0 text-mist-700",
    amber: "from-amber-500/12 to-amber-500/0 text-amber-700",
  } as const;
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, type: "spring", stiffness: 260, damping: 24 }}
      className="card relative overflow-hidden p-4"
    >
      <div className={cn("pointer-events-none absolute inset-0 bg-gradient-to-br", tones[tone])} />
      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-mist-400">{label}</p>
          <p className="mt-1.5 font-display text-2xl font-bold text-mist-900">{value}</p>
          {hint && <p className="mt-0.5 text-xs text-mist-400">{hint}</p>}
        </div>
        {icon && (
          <div className={cn("rounded-xl bg-white/70 p-2 ring-1 ring-mist-200", tones[tone].split(" ").pop())}>
            {icon}
          </div>
        )}
      </div>
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
  if (["in progress", "active", "resulted", "dispensed", "completed", "attended", "normal"].includes(v)) return "brand";
  if (["waiting", "pending", "sample collected", "scheduled", "open", "mam"].includes(v)) return "amber";
  if (["referred", "rejected", "no-show", "critical", "sam", "out", "discontinued"].includes(v)) return "action";
  return "mist";
}

/* ---------- Empty state ---------- */
export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-mist-300 bg-mist-50/60 px-6 py-14 text-center">
      <div className="h-10 w-10 rounded-xl bg-brand-gradient-soft" />
      <p className="font-semibold text-mist-700">{title}</p>
      {hint && <p className="max-w-sm text-sm text-mist-400">{hint}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/* ---------- Progress bar ---------- */
export function Progress({ value, target }: { value: number; target: number }) {
  const p = Math.min(100, Math.round((value / target) * 100));
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-mist-100">
      <motion.div
        className="h-full rounded-full bg-brand-gradient"
        initial={{ width: 0 }}
        animate={{ width: `${p}%` }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      />
    </div>
  );
}
