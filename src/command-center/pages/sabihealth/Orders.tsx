import { useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, Filter, Package, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useSabiHealth, orderNeedsAttention } from "../../useSabiHealth";
import { CommandInput, CommandPageHeader, CommandSelect, Panel, StatusPill } from "./shared";

const PAGE_SIZE = 10;
const STATUSES = ["DRAFT", "AWAITING_PAYMENT", "PAID", "ACCEPTED", "PREPARING", "READY", "DISPATCHED", "READY_FOR_PICKUP", "COMPLETED", "CANCELLED", "REFUNDED"];

export default function Orders() {
  const navigate = useNavigate();
  const state = useSabiHealth();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All");
  const [onlyAttention, setOnlyAttention] = useState(true);
  const [page, setPage] = useState(1);

  const rows = useMemo(() => state.medicationOrders.map((order) => ({
    order,
    patient: state.patients.find((p) => p.id === order.patientId),
    pharmacy: state.pharmacies.find((ph) => ph.id === order.pharmacyId),
    attention: orderNeedsAttention(order),
  })), [state.medicationOrders, state.patients, state.pharmacies]);

  const filtered = rows.filter(({ order, patient, pharmacy, attention }) => {
    const needle = `${patient?.name ?? ""} ${pharmacy?.businessName ?? ""}`.toLowerCase();
    return (!onlyAttention || attention) && (!query || needle.includes(query.toLowerCase())) && (status === "All" || order.status === status);
  });
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const shown = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const needingAttention = rows.filter((r) => r.attention).length;
  const refundFlagged = state.medicationOrders.filter((o) => o.refundFlagged && o.status !== "REFUNDED").length;

  return <div>
    <CommandPageHeader eyebrow="Sabi Health" title="Prescription & pharmacy operations" description="Medication order fulfillment across the network. Refunds are flagged for the payments team, never processed here." />
    <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-4">
      {[{ label: "Total", value: state.medicationOrders.length }, { label: "Completed", value: state.medicationOrders.filter((o) => o.status === "COMPLETED").length }, { label: "Needs attention", value: needingAttention }, { label: "Flagged for refund", value: refundFlagged }].map((stat) => <div key={stat.label} className="rounded-lg border border-slate-200 bg-white px-3 py-2"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{stat.label}</p><p className="mt-0.5 font-display text-lg font-bold text-slate-900">{stat.value}</p></div>)}
    </div>
    <Panel>
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3">
        <div className="relative min-w-[220px] flex-1"><Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><CommandInput className="w-full pl-9" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Patient or pharmacy name" /></div>
        <span className="flex items-center gap-1 text-xs font-semibold text-slate-400"><Filter size={14} /> Filters</span>
        <CommandSelect value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option>All</option>{STATUSES.map((item) => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}</CommandSelect>
        <label className="flex items-center gap-2 text-xs font-semibold text-slate-600"><input type="checkbox" checked={onlyAttention} onChange={(event) => { setOnlyAttention(event.target.checked); setPage(1); }} />Needs attention only</label>
      </div>
      {filtered.length === 0 ? (
        <div className="px-4 py-14 text-center text-sm text-slate-400">{onlyAttention ? "Nothing needs attention right now." : "No orders match this search."}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead><tr className="border-b border-slate-100 bg-slate-50/80"><th className="cc-th">Patient</th><th className="cc-th">Pharmacy</th><th className="cc-th">Total</th><th className="cc-th">Status</th><th className="cc-th">Last update</th><th className="cc-th">Flags</th><th className="cc-th"><span className="sr-only">Open</span></th></tr></thead>
            <tbody>{shown.map(({ order, patient, pharmacy, attention }) => <tr key={order.id} onClick={() => navigate(`/command-center/sabi-health/orders/${order.id}`)} className="cursor-pointer border-b border-slate-100 transition hover:bg-emerald-50/35">
              <td className="cc-td"><div className="flex items-center gap-2.5"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-500"><Package size={15} /></span><span className="font-semibold text-slate-900">{patient?.name ?? "Unknown patient"}</span></div></td>
              <td className="cc-td">{pharmacy?.businessName ?? "Unknown pharmacy"}</td>
              <td className="cc-td">{order.currency} {order.total.toLocaleString()}</td>
              <td className="cc-td"><StatusPill status={order.status.replaceAll("_", " ")} /></td>
              <td className="cc-td text-xs text-slate-400">{new Date(order.updatedAt).toLocaleDateString("en-NG", { day: "2-digit", month: "short" })}</td>
              <td className="cc-td">{attention && <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-200"><AlertTriangle size={11} />Needs attention</span>}{order.refundFlagged && order.status !== "REFUNDED" && <span className="ml-1 inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700 ring-1 ring-inset ring-red-200">Refund flagged</span>}</td>
              <td className="cc-td"><ArrowRight size={15} className="text-slate-300" /></td>
            </tr>)}</tbody>
          </table>
        </div>
      )}
      <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-xs text-slate-500"><span>Showing {shown.length} of {filtered.length} orders</span><div className="flex items-center gap-1"><button disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="rounded-md border border-slate-200 px-2 py-1 font-semibold disabled:opacity-40">Previous</button>{Array.from({ length: pages }, (_, i) => <button key={i} onClick={() => setPage(i + 1)} className={`h-7 w-7 rounded-md font-semibold ${page === i + 1 ? "bg-slate-900 text-white" : "hover:bg-slate-100"}`}>{i + 1}</button>)}<button disabled={page === pages} onClick={() => setPage((p) => p + 1)} className="rounded-md border border-slate-200 px-2 py-1 font-semibold disabled:opacity-40">Next</button></div></div>
    </Panel>
  </div>;
}
