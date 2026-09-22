import { useMemo } from "react";
import { AlertTriangle, ArrowRight, BadgeCheck, WalletCards } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useSabiHealth } from "../../useSabiHealth";
import { formatDate, formatMoney } from "../../format";
import { CommandPageHeader, MetricCard, Panel, PanelHeader, StatusPill } from "./shared";

type Id = string;
type LedgerRow = { kind: "Consultation" | "Order"; id: Id; patientName: string; amount: number; currency: string; reason?: string; resolvedAt?: string; to: string };

export default function Payments() {
  const navigate = useNavigate();
  const state = useSabiHealth();

  const collected = useMemo(() => {
    const consultationTotal = state.consultations.filter((c) => c.paymentStatus === "PAID").reduce((sum, c) => sum + c.fee, 0);
    const orderTotal = state.medicationOrders.filter((o) => !["DRAFT", "AWAITING_PAYMENT", "CANCELLED", "REFUNDED"].includes(o.status)).reduce((sum, o) => sum + o.total, 0);
    return consultationTotal + orderTotal;
  }, [state.consultations, state.medicationOrders]);

  const refunded = useMemo(() => {
    const consultationTotal = state.consultations.filter((c) => c.paymentStatus === "REFUNDED").reduce((sum, c) => sum + c.fee, 0);
    const orderTotal = state.medicationOrders.filter((o) => o.status === "REFUNDED").reduce((sum, o) => sum + o.total, 0);
    return consultationTotal + orderTotal;
  }, [state.consultations, state.medicationOrders]);

  const failed = useMemo(() => state.consultations.filter((c) => c.paymentStatus === "FAILED").reduce((sum, c) => sum + c.fee, 0), [state.consultations]);
  const pending = useMemo(() => state.consultations.filter((c) => c.paymentStatus === "PENDING").reduce((sum, c) => sum + c.fee, 0), [state.consultations]);

  const awaitingRefund: LedgerRow[] = useMemo(() => [
    ...state.consultations.filter((c) => c.refundFlagged && c.paymentStatus !== "REFUNDED").map((c) => ({ kind: "Consultation" as const, id: c.id, patientName: state.patients.find((p) => p.id === c.patientId)?.name ?? "Unknown patient", amount: c.fee, currency: c.currency, reason: c.refundFlagReason, to: `/command-center/sabi-health/consultations/${c.id}` })),
    ...state.medicationOrders.filter((o) => o.refundFlagged && o.status !== "REFUNDED").map((o) => ({ kind: "Order" as const, id: o.id, patientName: state.patients.find((p) => p.id === o.patientId)?.name ?? "Unknown patient", amount: o.total, currency: o.currency, reason: o.refundFlagReason, to: `/command-center/sabi-health/orders/${o.id}` })),
  ], [state.consultations, state.medicationOrders, state.patients]);

  const recentlyRefunded: LedgerRow[] = useMemo(() => [
    ...state.consultations.filter((c) => c.paymentStatus === "REFUNDED").map((c) => ({ kind: "Consultation" as const, id: c.id, patientName: state.patients.find((p) => p.id === c.patientId)?.name ?? "Unknown patient", amount: c.fee, currency: c.currency, resolvedAt: c.reviewedAt, to: `/command-center/sabi-health/consultations/${c.id}` })),
    ...state.medicationOrders.filter((o) => o.status === "REFUNDED").map((o) => ({ kind: "Order" as const, id: o.id, patientName: state.patients.find((p) => p.id === o.patientId)?.name ?? "Unknown patient", amount: o.total, currency: o.currency, resolvedAt: o.reviewedAt, to: `/command-center/sabi-health/orders/${o.id}` })),
  ], [state.consultations, state.medicationOrders, state.patients]);

  return <div>
    <CommandPageHeader eyebrow="Sabi Health" title="Payments" description="Consultation and order revenue across the network. No payment gateway is connected yet — refunds are recorded here as a manual log, never processed automatically." />
    <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
      <MetricCard label="Collected" value={formatMoney(collected)} icon={<WalletCards size={15} />} />
      <MetricCard label="Pending" value={formatMoney(pending)} />
      <MetricCard label="Failed" value={formatMoney(failed)} />
      <MetricCard label="Refunded" value={formatMoney(refunded)} />
    </div>

    <div className="mt-4">
      <Panel>
        <PanelHeader title="Awaiting refund" description="Flagged by operations — record the refund once it's been processed through the payment processor's own dashboard" action={<span className="rounded-lg bg-slate-950 px-3 py-2 text-xs font-bold text-white">{awaitingRefund.length} pending</span>} />
        {awaitingRefund.length === 0 ? (
          <div className="px-4 py-14 text-center text-sm text-slate-400">Nothing is awaiting refund right now.</div>
        ) : (
          <div className="overflow-x-auto"><table className="w-full min-w-[700px]"><thead><tr className="border-b border-slate-100 bg-slate-50/80"><th className="cc-th">Type</th><th className="cc-th">Patient</th><th className="cc-th">Amount</th><th className="cc-th">Reason</th><th className="cc-th"><span className="sr-only">Open</span></th></tr></thead><tbody>
            {awaitingRefund.map((row) => <tr key={`${row.kind}-${row.id}`} onClick={() => navigate(row.to)} className="cursor-pointer border-b border-slate-100 transition hover:bg-emerald-50/35">
              <td className="cc-td"><span className="inline-flex items-center gap-1.5 font-semibold text-slate-900"><AlertTriangle size={13} className="text-red-500" />{row.kind}</span></td>
              <td className="cc-td">{row.patientName}</td>
              <td className="cc-td">{formatMoney(row.amount, row.currency)}</td>
              <td className="cc-td max-w-[280px] truncate text-slate-500">{row.reason}</td>
              <td className="cc-td"><ArrowRight size={15} className="text-slate-300" /></td>
            </tr>)}
          </tbody></table></div>
        )}
      </Panel>
    </div>

    <div className="mt-4">
      <Panel>
        <PanelHeader title="Recently refunded" description="Closed out with an external reference in the audit trail" />
        {recentlyRefunded.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-slate-400">No refunds have been recorded yet.</div>
        ) : (
          <div className="overflow-x-auto"><table className="w-full min-w-[600px]"><thead><tr className="border-b border-slate-100 bg-slate-50/80"><th className="cc-th">Type</th><th className="cc-th">Patient</th><th className="cc-th">Amount</th><th className="cc-th">Resolved</th><th className="cc-th"><span className="sr-only">Open</span></th></tr></thead><tbody>
            {recentlyRefunded.map((row) => <tr key={`${row.kind}-${row.id}`} onClick={() => navigate(row.to)} className="cursor-pointer border-b border-slate-100 last:border-0 transition hover:bg-emerald-50/35">
              <td className="cc-td"><span className="inline-flex items-center gap-1.5 font-semibold text-slate-900"><BadgeCheck size={13} className="text-emerald-500" />{row.kind}</span></td>
              <td className="cc-td">{row.patientName}</td>
              <td className="cc-td"><StatusPill status="Refunded" /> {formatMoney(row.amount, row.currency)}</td>
              <td className="cc-td text-slate-500">{formatDate(row.resolvedAt)}</td>
              <td className="cc-td"><ArrowRight size={15} className="text-slate-300" /></td>
            </tr>)}
          </tbody></table></div>
        )}
      </Panel>
    </div>
  </div>;
}
