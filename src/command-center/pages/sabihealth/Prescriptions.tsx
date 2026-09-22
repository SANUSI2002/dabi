import { useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, FileText, Filter, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useSabiHealth, prescriptionNeedsAttention } from "../../useSabiHealth";
import { formatDate } from "../../format";
import { CommandInput, CommandPageHeader, CommandSelect, Panel, StatusPill } from "./shared";

const PAGE_SIZE = 10;
const STATUSES = ["ACTIVE", "PARTIALLY_FILLED", "FULFILLED", "EXPIRED", "CANCELLED"];

export default function Prescriptions() {
  const navigate = useNavigate();
  const state = useSabiHealth();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All");
  const [page, setPage] = useState(1);

  const rows = useMemo(() => state.prescriptions.map((rx) => ({
    prescription: rx,
    patient: state.patients.find((p) => p.id === rx.patientId),
    doctor: state.doctors.find((d) => d.id === rx.doctorId),
    orders: state.medicationOrders.filter((o) => o.prescriptionId === rx.id),
    attention: prescriptionNeedsAttention(rx, state.medicationOrders),
  })), [state.doctors, state.medicationOrders, state.patients, state.prescriptions]);

  const filtered = rows.filter(({ prescription, patient, doctor }) => {
    const needle = `${patient?.name ?? ""} ${doctor?.name ?? ""}`.toLowerCase();
    return (!query || needle.includes(query.toLowerCase())) && (status === "All" || prescription.status === status);
  });
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const shown = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const needingAttention = rows.filter((r) => r.attention).length;

  return <div>
    <CommandPageHeader eyebrow="Sabi Health" title="Prescriptions" description="Prescriptions issued across the network and their fulfillment status. Medication contents stay in the clinical record — only fulfillment metadata is shown here." />
    <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-4">
      {[{ label: "Total", value: state.prescriptions.length }, { label: "Fulfilled", value: state.prescriptions.filter((p) => p.status === "FULFILLED").length }, { label: "Active", value: state.prescriptions.filter((p) => p.status === "ACTIVE" || p.status === "PARTIALLY_FILLED").length }, { label: "Needs attention", value: needingAttention }].map((stat) => <div key={stat.label} className="rounded-lg border border-slate-200 bg-white px-3 py-2"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{stat.label}</p><p className="mt-0.5 font-display text-lg font-bold text-slate-900">{stat.value}</p></div>)}
    </div>
    <Panel>
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3">
        <div className="relative min-w-[220px] flex-1"><Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><CommandInput className="w-full pl-9" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Patient or doctor name" /></div>
        <span className="flex items-center gap-1 text-xs font-semibold text-slate-400"><Filter size={14} /> Filters</span>
        <CommandSelect value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option>All</option>{STATUSES.map((item) => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}</CommandSelect>
      </div>
      {filtered.length === 0 ? (
        <div className="px-4 py-14 text-center text-sm text-slate-400">No prescriptions match this search.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead><tr className="border-b border-slate-100 bg-slate-50/80"><th className="cc-th">Patient</th><th className="cc-th">Doctor</th><th className="cc-th">Issued</th><th className="cc-th">Medications</th><th className="cc-th">Quotations</th><th className="cc-th">Orders</th><th className="cc-th">Status</th><th className="cc-th"><span className="sr-only">Open</span></th></tr></thead>
            <tbody>{shown.map(({ prescription, patient, doctor, orders, attention }) => <tr key={prescription.id} onClick={() => navigate(`/command-center/sabi-health/prescriptions/${prescription.id}`)} className="cursor-pointer border-b border-slate-100 transition hover:bg-emerald-50/35">
              <td className="cc-td"><div className="flex items-center gap-2.5"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-500"><FileText size={15} /></span><span className="font-semibold text-slate-900">{patient?.name ?? "Unknown patient"}</span></div></td>
              <td className="cc-td">{doctor?.name ?? "Unknown doctor"}</td>
              <td className="cc-td">{formatDate(prescription.issuedAt)}</td>
              <td className="cc-td">{prescription.medicationCount}</td>
              <td className="cc-td">{prescription.quotationsRequested}</td>
              <td className="cc-td">{orders.length}</td>
              <td className="cc-td"><StatusPill status={prescription.status.replaceAll("_", " ")} />{attention && <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-200"><AlertTriangle size={11} />Stale</span>}</td>
              <td className="cc-td"><ArrowRight size={15} className="text-slate-300" /></td>
            </tr>)}</tbody>
          </table>
        </div>
      )}
      <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-xs text-slate-500"><span>Showing {shown.length} of {filtered.length} prescriptions</span><div className="flex items-center gap-1"><button disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="rounded-md border border-slate-200 px-2 py-1 font-semibold disabled:opacity-40">Previous</button>{Array.from({ length: pages }, (_, i) => <button key={i} onClick={() => setPage(i + 1)} className={`h-7 w-7 rounded-md font-semibold ${page === i + 1 ? "bg-slate-900 text-white" : "hover:bg-slate-100"}`}>{i + 1}</button>)}<button disabled={page === pages} onClick={() => setPage((p) => p + 1)} className="rounded-md border border-slate-200 px-2 py-1 font-semibold disabled:opacity-40">Next</button></div></div>
    </Panel>
  </div>;
}
