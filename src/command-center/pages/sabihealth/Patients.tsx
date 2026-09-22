import { useMemo, useState } from "react";
import { ArrowRight, Filter, Search, UserRound } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useSabiHealth } from "../../useSabiHealth";
import { useAuth } from "@/store/useAuth";
import { formatDate } from "../../format";
import { CommandInput, CommandPageHeader, CommandSelect, Panel, ReasonDialog, StatusPill, type PendingAction } from "./shared";

const PAGE_SIZE = 10;

export default function Patients() {
  const navigate = useNavigate();
  const state = useSabiHealth();
  const actorId = useAuth((s) => s.identity?.platformUserId);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All");
  const [page, setPage] = useState(1);
  const [pending, setPending] = useState<PendingAction | null>(null);

  const rows = useMemo(() => state.patients.filter((patient) => {
    const needle = `${patient.name} ${patient.sabiHealthId} ${patient.email} ${patient.phone}`.toLowerCase();
    return (!query || needle.includes(query.toLowerCase())) && (status === "All" || patient.accountStatus === status);
  }), [query, state.patients, status]);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const shown = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const promptSuspend = (patient: (typeof state.patients)[number]) => setPending({
    title: `Suspend ${patient.name}`,
    description: "This immediately blocks the patient from booking consultations or placing orders until restored.",
    confirm: "Suspend account",
    danger: true,
    onConfirm: (reason) => { const result = state.setPatientStatus(patient.id, "Suspended", reason, actorId); if (!result.ok) throw new Error(result.error); },
  });
  const promptRestore = (patient: (typeof state.patients)[number]) => setPending({
    title: `Restore ${patient.name}`,
    description: "This restores the patient's ability to book consultations and place orders.",
    confirm: "Restore account",
    onConfirm: (reason) => { const result = state.setPatientStatus(patient.id, "Active", reason, actorId); if (!result.ok) throw new Error(result.error); },
  });

  return <div>
    <CommandPageHeader eyebrow="Sabi Health" title="Patients" description="Platform-level patient account administration — clinical records stay inside the telemedicine app; this is account, order and support visibility only." />
    <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-4">
      {[{ label: "Total", value: state.patients.length }, { label: "Active", value: state.patients.filter((p) => p.accountStatus === "Active").length }, { label: "Suspended", value: state.patients.filter((p) => p.accountStatus === "Suspended").length }, { label: "Unverified", value: state.patients.filter((p) => p.verificationStatus !== "Verified").length }].map((stat) => <div key={stat.label} className="rounded-lg border border-slate-200 bg-white px-3 py-2"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{stat.label}</p><p className="mt-0.5 font-display text-lg font-bold text-slate-900">{stat.value}</p></div>)}
    </div>
    <Panel>
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3">
        <div className="relative min-w-[240px] flex-1"><Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><CommandInput className="w-full pl-9" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Name, patient ID, email or phone" /></div>
        <span className="flex items-center gap-1 text-xs font-semibold text-slate-400"><Filter size={14} /> Filters</span>
        <CommandSelect value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option>All</option><option>Active</option><option>Suspended</option><option>Deactivated</option></CommandSelect>
      </div>
      {rows.length === 0 ? (
        <div className="px-4 py-14 text-center text-sm text-slate-400">{state.patients.length === 0 ? "No patients on the network yet." : "No patients match this search."}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px]">
            <thead><tr className="border-b border-slate-100 bg-slate-50/80"><th className="cc-th">Patient</th><th className="cc-th">Contact</th><th className="cc-th">Country</th><th className="cc-th">Account</th><th className="cc-th">Verification</th><th className="cc-th">Joined</th><th className="cc-th">Last activity</th><th className="cc-th">Consultations</th><th className="cc-th">Active orders</th><th className="cc-th"><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>{shown.map((patient) => <tr key={patient.id} onClick={() => navigate(`/command-center/sabi-health/patients/${patient.id}`)} className="cursor-pointer border-b border-slate-100 transition hover:bg-emerald-50/35">
              <td className="cc-td"><div className="flex items-center gap-2.5"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-500"><UserRound size={15} /></span><span><span className="block max-w-[200px] truncate font-semibold text-slate-900">{patient.name}</span><span className="block font-mono text-xs text-slate-400">{patient.sabiHealthId}</span></span></div></td>
              <td className="cc-td"><span className="block">{patient.email}</span><span className="block text-xs text-slate-400">{patient.phone}</span></td>
              <td className="cc-td">{patient.country}</td>
              <td className="cc-td"><StatusPill status={patient.accountStatus} /></td>
              <td className="cc-td"><StatusPill status={patient.verificationStatus} /></td>
              <td className="cc-td">{formatDate(patient.joinedAt)}</td>
              <td className="cc-td">{formatDate(patient.lastActivityAt)}</td>
              <td className="cc-td">{patient.consultationCount}</td>
              <td className="cc-td">{patient.activeOrderCount}</td>
              <td className="cc-td" onClick={(event) => event.stopPropagation()}>
                {patient.accountStatus === "Suspended"
                  ? <button onClick={() => promptRestore(patient)} className="text-xs font-semibold text-emerald-700 hover:underline">Restore</button>
                  : <button onClick={() => promptSuspend(patient)} className="text-xs font-semibold text-red-600 hover:underline">Suspend</button>}
              </td>
            </tr>)}</tbody>
          </table>
        </div>
      )}
      <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-xs text-slate-500"><span>Showing {shown.length} of {rows.length} patients</span><div className="flex items-center gap-1"><button disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="rounded-md border border-slate-200 px-2 py-1 font-semibold disabled:opacity-40">Previous</button>{Array.from({ length: pages }, (_, i) => <button key={i} onClick={() => setPage(i + 1)} className={`h-7 w-7 rounded-md font-semibold ${page === i + 1 ? "bg-slate-900 text-white" : "hover:bg-slate-100"}`}>{i + 1}</button>)}<button disabled={page === pages} onClick={() => setPage((p) => p + 1)} className="rounded-md border border-slate-200 px-2 py-1 font-semibold disabled:opacity-40">Next <ArrowRight size={12} className="inline" /></button></div></div>
    </Panel>
    <ReasonDialog pending={pending} onClose={() => setPending(null)} />
  </div>;
}
