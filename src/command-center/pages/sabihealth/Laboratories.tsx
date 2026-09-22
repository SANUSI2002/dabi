import { useMemo, useState } from "react";
import { ArrowRight, FlaskConical, Filter, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useSabiHealth } from "../../useSabiHealth";
import { formatDate } from "../../format";
import { CommandInput, CommandPageHeader, CommandSelect, Panel, StatusPill } from "./shared";

const PAGE_SIZE = 10;
const STATUSES = ["APPLICATION", "PENDING_VERIFICATION", "VERIFIED", "ACTIVE", "SUSPENDED", "REJECTED"];

export default function Laboratories() {
  const navigate = useNavigate();
  const state = useSabiHealth();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All");
  const [page, setPage] = useState(1);

  const rows = useMemo(() => state.laboratories.filter((lab) => {
    const needle = `${lab.name} ${lab.legalEntity} ${lab.licenseNumber} ${lab.id}`.toLowerCase();
    return (!query || needle.includes(query.toLowerCase())) && (status === "All" || lab.status === status);
  }), [query, state.laboratories, status]);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const shown = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const awaitingReview = state.laboratories.filter((l) => l.status === "APPLICATION" || l.status === "PENDING_VERIFICATION").length;

  return <div>
    <CommandPageHeader eyebrow="Sabi Health" title="Laboratories" description="Diagnostic laboratory network verification and service coverage." />
    <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-4">
      {[{ label: "Total", value: state.laboratories.length }, { label: "Active", value: state.laboratories.filter((l) => l.status === "ACTIVE").length }, { label: "Awaiting review", value: awaitingReview }, { label: "Suspended", value: state.laboratories.filter((l) => l.status === "SUSPENDED").length }].map((stat) => <div key={stat.label} className="rounded-lg border border-slate-200 bg-white px-3 py-2"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{stat.label}</p><p className="mt-0.5 font-display text-lg font-bold text-slate-900">{stat.value}</p></div>)}
    </div>
    <Panel>
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3">
        <div className="relative min-w-[240px] flex-1"><Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><CommandInput className="w-full pl-9" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Name, legal entity or license number" /></div>
        <span className="flex items-center gap-1 text-xs font-semibold text-slate-400"><Filter size={14} /> Filters</span>
        <CommandSelect value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option>All</option>{STATUSES.map((item) => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}</CommandSelect>
      </div>
      {rows.length === 0 ? (
        <div className="px-4 py-14 text-center text-sm text-slate-400">{state.laboratories.length === 0 ? "No laboratories on the network yet." : "No laboratories match this search."}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead><tr className="border-b border-slate-100 bg-slate-50/80"><th className="cc-th">Laboratory</th><th className="cc-th">Location</th><th className="cc-th">License</th><th className="cc-th">Status</th><th className="cc-th">Services</th><th className="cc-th">Joined</th><th className="cc-th"><span className="sr-only">Open</span></th></tr></thead>
            <tbody>{shown.map((lab) => <tr key={lab.id} onClick={() => navigate(`/command-center/sabi-health/laboratories/${lab.id}`)} className="cursor-pointer border-b border-slate-100 transition hover:bg-emerald-50/35">
              <td className="cc-td"><div className="flex items-center gap-2.5"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-500"><FlaskConical size={15} /></span><span><span className="block max-w-[200px] truncate font-semibold text-slate-900">{lab.name}</span><span className="block text-xs text-slate-400">{lab.legalEntity}</span></span></div></td>
              <td className="cc-td">{lab.city}, {lab.country}</td>
              <td className="cc-td font-mono text-xs">{lab.licenseNumber}</td>
              <td className="cc-td"><StatusPill status={lab.status.replaceAll("_", " ")} /></td>
              <td className="cc-td">{lab.services.length === 0 ? "—" : lab.services.join(", ")}</td>
              <td className="cc-td">{formatDate(lab.joinedAt)}</td>
              <td className="cc-td"><ArrowRight size={15} className="text-slate-300" /></td>
            </tr>)}</tbody>
          </table>
        </div>
      )}
      <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-xs text-slate-500"><span>Showing {shown.length} of {rows.length} laboratories</span><div className="flex items-center gap-1"><button disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="rounded-md border border-slate-200 px-2 py-1 font-semibold disabled:opacity-40">Previous</button>{Array.from({ length: pages }, (_, i) => <button key={i} onClick={() => setPage(i + 1)} className={`h-7 w-7 rounded-md font-semibold ${page === i + 1 ? "bg-slate-900 text-white" : "hover:bg-slate-100"}`}>{i + 1}</button>)}<button disabled={page === pages} onClick={() => setPage((p) => p + 1)} className="rounded-md border border-slate-200 px-2 py-1 font-semibold disabled:opacity-40">Next</button></div></div>
    </Panel>
  </div>;
}
