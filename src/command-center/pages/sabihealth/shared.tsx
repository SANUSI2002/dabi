import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { CommandButton, Panel, StatusPill } from "../../components/ui";

// Shared building blocks for the Sabi Health 360 views (Patient/Doctor/Pharmacy/Laboratory),
// mirroring the Sabi OS Tenant360 patterns (see ../Tenant360.tsx) so both halves of the
// ecosystem feel like one product.

export type PendingAction = { title: string; description: string; confirm: string; danger?: boolean; onConfirm: (reason: string) => void };

export function ReasonDialog({ pending, onClose }: { pending: PendingAction | null; onClose: () => void }) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const confirm = () => { try { pending?.onConfirm(reason); setReason(""); setError(""); onClose(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to complete this action."); } };
  return (
    <Modal open={!!pending} onClose={() => { setReason(""); setError(""); onClose(); }} title={pending?.title ?? "Confirm action"} footer={<><CommandButton variant="secondary" onClick={onClose}>Cancel</CommandButton><CommandButton variant={pending?.danger ? "danger" : "primary"} onClick={confirm}>{pending?.confirm ?? "Confirm"}</CommandButton></>}>
      <div className="flex gap-3 rounded-lg bg-slate-50 p-3"><AlertTriangle size={18} className={pending?.danger ? "shrink-0 text-red-600" : "shrink-0 text-amber-600"} /><p className="text-sm leading-5 text-slate-600">{pending?.description}</p></div>
      <label className="mt-4 block"><span className="cc-label">Reason required</span><textarea autoFocus value={reason} onChange={(e) => setReason(e.target.value)} className="min-h-24 w-full rounded-lg border border-slate-200 p-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15" placeholder="Provide the operational reason…" /></label>
      {error && <p role="alert" className="mt-2 text-xs font-semibold text-red-600">{error}</p>}
    </Modal>
  );
}

export function Field({ label, value, icon }: { label: string; value: React.ReactNode; icon?: React.ReactNode }) {
  return <div><p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">{icon}{label}</p><p className="mt-1 text-sm font-medium leading-5 text-slate-800">{value}</p></div>;
}

export function Mini({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="px-4 py-4"><p className="font-display text-xl font-bold text-slate-950">{value}</p><p className="mt-1 text-xs text-slate-500">{label}</p></div>;
}

export function Summary({ label, value, status }: { label: string; value: React.ReactNode; status?: boolean }) {
  return <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5"><p className="text-[9px] font-bold uppercase tracking-[.12em] text-slate-400">{label}</p><div className="mt-1 truncate text-sm font-bold text-slate-900">{status && typeof value === "string" ? <StatusPill status={value} /> : value}</div></div>;
}

export function BackLink({ to, label }: { to: string; label: string }) {
  const navigate = useNavigate();
  return <button onClick={() => navigate(to)} className="mb-3 flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900"><ArrowLeft size={14} /> {label}</button>;
}

export function NotFound({ label, backTo, backLabel }: { label: string; backTo: string; backLabel: string }) {
  const navigate = useNavigate();
  return <Panel className="p-10 text-center"><h1 className="font-display text-xl font-bold">{label}</h1><CommandButton className="mt-4" onClick={() => navigate(backTo)}>{backLabel}</CommandButton></Panel>;
}

// Re-export so callers only need one import line.
export * from "../../components/ui";
