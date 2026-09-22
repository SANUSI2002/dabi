import { useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowRight, HeartHandshake, Pill, ShieldAlert, Stethoscope, Users } from "lucide-react";
import { useSabiHealth, consultationNeedsAttention, orderNeedsAttention, prescriptionNeedsAttention } from "../useSabiHealth";
import { CommandPageHeader, MetricCard, Panel, PanelHeader, StatusPill } from "../components/ui";
import { formatDate } from "../format";

// Every count on this page comes straight from useSabiHealth — no trend percentages or
// historical charts, because there is no dated history to compute them from honestly (the same
// reasoning already applied to the Sabi OS dashboard). This is Command Center's own model of the
// network, not a live read of the separate patient-portal app — see sabihealth/domain.ts.
function PanelEmptyNote({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center justify-center px-4 py-10 text-center text-sm text-slate-400">{children}</div>;
}

export default function SabiHealthDashboard() {
  const navigate = useNavigate();
  const state = useSabiHealth();

  const activePatients = state.patients.filter((p) => p.accountStatus === "Active").length;
  const activeDoctors = state.doctors.filter((d) => d.status === "ACTIVE").length;
  const doctorsAwaitingReview = state.doctors.filter((d) => d.status === "APPLICATION_SUBMITTED" || d.status === "UNDER_REVIEW");
  const activePharmacies = state.pharmacies.filter((p) => p.status === "ACTIVE").length;
  const pharmaciesAwaitingReview = state.pharmacies.filter((p) => p.status === "PENDING_VERIFICATION" || p.status === "APPLICATION");
  const activeLabs = state.laboratories.filter((l) => l.status === "ACTIVE").length;

  const completedConsultations = state.consultations.filter((c) => c.status === "COMPLETED").length;
  const consultationsNeedingAttention = state.consultations.filter(consultationNeedsAttention);
  const ordersNeedingAttention = state.medicationOrders.filter(orderNeedsAttention);
  const prescriptionsNeedingAttention = state.prescriptions.filter((rx) => prescriptionNeedsAttention(rx, state.medicationOrders));
  const activePrescriptions = state.prescriptions.filter((p) => p.status === "ACTIVE" || p.status === "PARTIALLY_FILLED").length;
  const activeOrders = state.medicationOrders.filter((o) => !["COMPLETED", "CANCELLED", "REFUNDED"].includes(o.status)).length;
  const refundsAwaitingProcessing = state.consultations.filter((c) => c.refundFlagged && c.paymentStatus !== "REFUNDED").length
    + state.medicationOrders.filter((o) => o.refundFlagged && o.status !== "REFUNDED").length;

  const attention = [
    ...doctorsAwaitingReview.map((d) => ({ title: `${d.name} awaiting verification review`, detail: `${d.specialty} · ${d.city}, ${d.country}`, to: `/command-center/sabi-health/verification/${d.id}` })),
    ...pharmaciesAwaitingReview.map((p) => ({ title: `${p.businessName} awaiting verification`, detail: `${p.city}, ${p.country}`, to: `/command-center/sabi-health/verification/${p.id}` })),
    ...consultationsNeedingAttention.map((c) => ({ title: `Consultation ${c.status.toLowerCase().replaceAll("_", " ")}`, detail: `${c.type} · scheduled ${formatDate(c.scheduledFor)}`, to: `/command-center/sabi-health/consultations/${c.id}` })),
    ...ordersNeedingAttention.map((o) => ({ title: `Order stalled in ${o.status.toLowerCase().replaceAll("_", " ")}`, detail: `${o.currency} ${o.total.toLocaleString()} · updated ${formatDate(o.updatedAt)}`, to: `/command-center/sabi-health/orders/${o.id}` })),
    ...prescriptionsNeedingAttention.map((rx) => ({ title: "Prescription likely abandoned", detail: `Issued ${formatDate(rx.issuedAt)} · no completed order`, to: `/command-center/sabi-health/prescriptions/${rx.id}` })),
  ];

  const operationalBanners = [
    { count: doctorsAwaitingReview.length + pharmaciesAwaitingReview.length, label: "verification case", to: "/command-center/sabi-health/verification", cta: "Verification center" },
    { count: consultationsNeedingAttention.length, label: "consultation", to: "/command-center/sabi-health/consultations", cta: "Telemedicine operations" },
    { count: ordersNeedingAttention.length, label: "order", to: "/command-center/sabi-health/orders", cta: "Pharmacy operations" },
    { count: prescriptionsNeedingAttention.length, label: "prescription", to: "/command-center/sabi-health/prescriptions", cta: "Prescriptions" },
    { count: refundsAwaitingProcessing, label: "refund", to: "/command-center/sabi-health/payments", cta: "Payments" },
  ].filter((banner) => banner.count > 0);

  return (
    <div>
      <CommandPageHeader
        eyebrow="Sabi Health"
        title="Network overview"
        description="Patients, doctors, pharmacies and laboratories on the Sabi Health consumer network — separate from Sabi OS's hospital-tenant data."
      />

      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
        <MetricCard label="Patients" value={state.patients.length} hint={`${activePatients} active`} icon={<Users size={15} />} />
        <MetricCard label="Doctors" value={state.doctors.length} hint={`${activeDoctors} active`} icon={<Stethoscope size={15} />} />
        <MetricCard label="Pharmacies" value={state.pharmacies.length} hint={`${activePharmacies} active`} icon={<Pill size={15} />} />
        <MetricCard label="Laboratories" value={state.laboratories.length} hint={`${activeLabs} active`} />
        <MetricCard label="Consultations" value={state.consultations.length} hint={`${completedConsultations} completed`} icon={<HeartHandshake size={15} />} />
        <MetricCard label="Active prescriptions" value={activePrescriptions} hint={`${activeOrders} orders in progress`} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <Panel>
          <PanelHeader title="Doctors" description="Recent applications and network status" action={<button className="text-xs font-semibold text-emerald-700 hover:underline" onClick={() => navigate("/command-center/sabi-health/doctors")}>View all <ArrowRight size={12} className="inline" /></button>} />
          {state.doctors.length === 0 ? (
            <PanelEmptyNote>No doctors on the network yet.</PanelEmptyNote>
          ) : (
            <div className="overflow-x-auto"><table className="w-full"><thead><tr className="border-b border-slate-100 bg-slate-50/80"><th className="cc-th">Doctor</th><th className="cc-th">Specialty</th><th className="cc-th">Status</th><th className="cc-th">Consultations</th></tr></thead><tbody>
              {state.doctors.map((doctor) => <tr key={doctor.id} onClick={() => navigate(`/command-center/sabi-health/doctors/${doctor.id}`)} className="cursor-pointer border-b border-slate-100 last:border-0 hover:bg-emerald-50/35"><td className="cc-td font-semibold text-slate-900">{doctor.name}</td><td className="cc-td">{doctor.specialty}</td><td className="cc-td"><StatusPill status={doctor.status.replaceAll("_", " ")} /></td><td className="cc-td">{doctor.completedConsultations}</td></tr>)}
            </tbody></table></div>
          )}
        </Panel>

        <Panel>
          <PanelHeader title="Attention required" description="Prioritized across verification, payments and consultations" />
          {attention.length === 0 ? (
            <PanelEmptyNote>Nothing needs attention right now.</PanelEmptyNote>
          ) : (
            <div className="divide-y divide-slate-100">{attention.map((item, i) => (
              <button key={i} onClick={() => navigate(item.to)} className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-slate-50">
                <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-amber-50 text-amber-600"><AlertTriangle size={14} /></span>
                <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-slate-800">{item.title}</span><span className="block text-xs text-slate-500">{item.detail}</span></span>
              </button>
            ))}</div>
          )}
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel>
          <PanelHeader title="Pharmacies" description="Network verification status" action={<button className="text-xs font-semibold text-emerald-700 hover:underline" onClick={() => navigate("/command-center/sabi-health/pharmacies")}>View all <ArrowRight size={12} className="inline" /></button>} />
          {state.pharmacies.length === 0 ? (
            <PanelEmptyNote>No pharmacies on the network yet.</PanelEmptyNote>
          ) : (
            <div className="overflow-x-auto"><table className="w-full"><thead><tr className="border-b border-slate-100 bg-slate-50/80"><th className="cc-th">Pharmacy</th><th className="cc-th">Status</th><th className="cc-th">Active orders</th></tr></thead><tbody>
              {state.pharmacies.map((pharmacy) => <tr key={pharmacy.id} onClick={() => navigate(`/command-center/sabi-health/pharmacies/${pharmacy.id}`)} className="cursor-pointer border-b border-slate-100 last:border-0 hover:bg-emerald-50/35"><td className="cc-td font-semibold text-slate-900">{pharmacy.businessName}</td><td className="cc-td"><StatusPill status={pharmacy.status.replaceAll("_", " ")} /></td><td className="cc-td">{pharmacy.activeOrderCount}</td></tr>)}
            </tbody></table></div>
          )}
        </Panel>

        <Panel>
          <PanelHeader title="Recent consultations" description="Across the telemedicine network" action={<button className="text-xs font-semibold text-emerald-700 hover:underline" onClick={() => navigate("/command-center/sabi-health/consultations")}>Operations <ArrowRight size={12} className="inline" /></button>} />
          {state.consultations.length === 0 ? (
            <PanelEmptyNote>No consultations recorded yet.</PanelEmptyNote>
          ) : (
            <div className="overflow-x-auto"><table className="w-full"><thead><tr className="border-b border-slate-100 bg-slate-50/80"><th className="cc-th">Scheduled</th><th className="cc-th">Type</th><th className="cc-th">Payment</th><th className="cc-th">Status</th></tr></thead><tbody>
              {state.consultations.map((consultation) => <tr key={consultation.id} onClick={() => navigate(`/command-center/sabi-health/consultations/${consultation.id}`)} className="cursor-pointer border-b border-slate-100 last:border-0 hover:bg-emerald-50/35"><td className="cc-td">{formatDate(consultation.scheduledFor)}</td><td className="cc-td">{consultation.type}</td><td className="cc-td"><StatusPill status={consultation.paymentStatus} /></td><td className="cc-td"><StatusPill status={consultation.status.replaceAll("_", " ")} /></td></tr>)}
            </tbody></table></div>
          )}
        </Panel>
      </div>

      {operationalBanners.map((banner) => (
        <div key={banner.to} className="mt-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <ShieldAlert size={16} className="mt-0.5 shrink-0" />
          <span>{banner.count} {banner.label}{banner.count === 1 ? "" : "s"} {banner.count === 1 ? "needs" : "need"} review — open <button className="underline" onClick={() => navigate(banner.to)}>{banner.cta}</button> to resolve.</span>
        </div>
      ))}
    </div>
  );
}
