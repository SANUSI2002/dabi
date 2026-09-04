import { Outlet } from "react-router-dom";
import { motion } from "framer-motion";
import { Users, Eye, ShieldCheck, CalendarRange, User } from "lucide-react";
import { useWorkforceSession, useWfScope, WF_PERSONAS, type WfRole } from "@/store/useWorkforceSession";
import { useHr } from "@/store/useHr";

const roleIcon: Record<WfRole, typeof Users> = {
  "Tenant HR Administrator": ShieldCheck,
  "Line Manager": Users,
  Employee: User,
  Scheduler: CalendarRange,
  Auditor: Eye,
};

export function WorkforceLayout() {
  const personaId = useWorkforceSession((s) => s.personaId);
  const setPersona = useWorkforceSession((s) => s.setPersona);
  const staff = useHr((s) => s.staff);
  const scope = useWfScope();
  const Icon = roleIcon[scope.role];

  const nameOf = (sid: string) => staff.find((s) => s.id === sid)?.name ?? sid;

  return (
    <div>
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl bg-brand-gradient px-4 py-3 text-white shadow-glow"
      >
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-white/15">
            <Icon size={16} />
          </span>
          <div className="leading-tight">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-white/70">Demo persona</p>
            <p className="text-sm font-bold">{scope.name}</p>
          </div>
        </div>

        <label className="flex items-center gap-2 text-xs">
          <span className="text-white/70">Acting as</span>
          <select
            value={personaId}
            onChange={(e) => setPersona(e.target.value)}
            className="rounded-lg border-0 bg-white/15 px-2.5 py-1.5 text-xs font-semibold text-white outline-none ring-1 ring-white/20 focus:ring-white/50 [&>option]:text-mist-900"
          >
            {WF_PERSONAS.map((p) => (
              <option key={p.id} value={p.id}>
                {nameOf(p.staffId)} — {p.role}
              </option>
            ))}
          </select>
        </label>

        <div className="ml-auto flex items-center gap-2 text-xs">
          <span className="rounded-full bg-white/15 px-2.5 py-1 font-semibold ring-1 ring-white/20">
            Scope: {scope.scopeLabel}
          </span>
          {scope.readOnly && (
            <span className="rounded-full bg-white/15 px-2.5 py-1 font-semibold ring-1 ring-white/20">Read-only</span>
          )}
        </div>
      </motion.div>

      <Outlet />
    </div>
  );
}
