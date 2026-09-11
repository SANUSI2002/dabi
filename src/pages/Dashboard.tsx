import { type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  Users, Activity, CheckCircle2, Share2, FlaskConical, Pill, PackageX, BedDouble,
  ArrowRight, Clock, FileWarning, AlertTriangle, CalendarClock, ClipboardList, Beaker,
} from "lucide-react";
import { PageHeader, StatCard, Card, Badge, Progress, SectionNote } from "@/components/ui/primitives";
import { Reveal } from "@/components/motion/Reveal";
import { useEmr, referralOverdue, labOrderOverdue } from "@/store/useEmr";
import { useAuth } from "@/store/useAuth";
import { useWards } from "@/store/useWards";
import { useClinical, isActivityOverdue } from "@/store/useClinical";
import { monthlyTargets } from "@/data/mock";
import { useCatalog } from "@/store/useCatalog";
import { useAudit } from "@/store/useAudit";
import { LAB_TESTS } from "@/data/catalog";
import { naira, timeAgo, shortDate } from "@/lib/format";

const tatFor = (test: string) => LAB_TESTS.find((entry) => entry.name === test)?.tat ?? 60;

export default function Dashboard() {
  const { user } = useAuth();
  const emr = useEmr();
  const { queue, labOrders, encounters, admissions, patients, patientById, invoices, referrals, appointments } = emr;
  const drugs = useCatalog((state) => state.drugs);
  const events = useAudit((state) => state.events);
  const beds = useWards((state) => state.beds);
  const carePlans = useClinical((state) => state.carePlans);

  const collected = invoices
    .filter((invoice) => invoice.status === "Paid")
    .reduce((total, invoice) => total + invoice.lines.reduce((sum, line) => sum + line.qty * line.unitPrice, 0), 0);
  const unpaidCount = invoices.filter((invoice) => invoice.status === "Unpaid").length;

  const waiting = queue.filter((entry) => entry.status === "Waiting").length;
  const inProgress = queue.filter((entry) => entry.status === "In Progress").length;
  const completed = queue.filter((entry) => entry.status === "Completed").length;
  const referredCount = queue.filter((entry) => entry.status === "Referred").length;
  const labPending = labOrders.filter((order) => ["Pending", "Sample Collected"].includes(order.status)).length;
  const rxPending = encounters.flatMap((encounter) => encounter.prescriptions).filter((prescription) => prescription.status === "Pending").length;
  const lowStock = drugs.filter((drug) => drug.stock <= drug.reorder);
  const activeBeds = beds.filter((bed) => bed.active).length;
  const activeAdmissions = admissions.filter((admission) => admission.status === "Active").length;

  // ---- work queue: what this clinician actually needs to act on today ----
  const unsignedNotes = encounters.filter((encounter) => encounter.status === "in-progress");
  const criticalResults = labOrders.filter((order) => order.status === "Resulted" && order.flag === "Critical" && !order.criticalCommunicatedBy);
  const unacknowledgedResults = labOrders.filter((order) => order.status === "Resulted" && order.flag !== "Critical" && !order.acknowledgedBy);
  const overdueLabOrders = labOrders.filter((order) => !["Resulted", "Rejected"].includes(order.status) && labOrderOverdue(order, tatFor(order.test)));
  const overdueReferrals = referrals.filter(referralOverdue);
  const today = new Date(); today.setHours(23, 59, 59, 999);
  const dueFollowUps = appointments.filter((appointment) => appointment.type === "Follow-up" && appointment.status === "Scheduled" && new Date(appointment.date) <= today);
  const overdueActivities = carePlans.flatMap((plan) =>
    plan.activities.filter(isActivityOverdue).map((activity) => ({ plan, activity })),
  );
  const workQueueTotal = unsignedNotes.length + criticalResults.length + unacknowledgedResults.length + overdueLabOrders.length + overdueReferrals.length + dueFollowUps.length + overdueActivities.length;

  const stats = [
    { label: "Today Waiting", value: waiting, icon: <Clock size={18} />, tone: "mist" as const },
    { label: "In Progress", value: inProgress, icon: <Activity size={18} />, tone: "brand" as const },
    { label: "Completed", value: completed, icon: <CheckCircle2 size={18} />, tone: "brand" as const },
    { label: "Referred", value: referredCount, icon: <Share2 size={18} />, tone: "action" as const },
    { label: "Lab Pending", value: labPending, icon: <FlaskConical size={18} />, tone: "mist" as const },
    { label: "Rx Pending", value: rxPending, icon: <Pill size={18} />, tone: "action" as const },
    { label: "Low Stock", value: lowStock.length, icon: <PackageX size={18} />, tone: "action" as const },
    { label: "Total Patients", value: patients.length, icon: <Users size={18} />, tone: "brand" as const },
    { label: "Beds Available", value: activeBeds - activeAdmissions, icon: <BedDouble size={18} />, tone: "mist" as const },
    { label: "Admissions Today", value: activeAdmissions, icon: <BedDouble size={18} />, tone: "brand" as const },
  ];

  const patientName = (id: string) => {
    const patient = patientById(id);
    return patient ? `${patient.firstName} ${patient.lastName}` : "—";
  };

  return (
    <div>
      <PageHeader
        title={`Welcome, ${user.name.split(" ").slice(-1)[0]}`}
        subtitle={`Today is ${shortDate(new Date())} · ${user.role} dashboard`}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map((stat, index) => (
          <StatCard key={stat.label} {...stat} delay={index * 0.04} />
        ))}
      </div>

      <Reveal className="mt-6">
        <Card className="p-0">
          <div className="flex items-center justify-between px-5 py-4">
            <div>
              <h3 className="font-display font-bold text-mist-900">My work queue</h3>
              <p className="text-xs text-mist-400">Everything needing your action, in one place — not a status overview.</p>
            </div>
            <Badge tone={workQueueTotal ? "action" : "brand"}>{workQueueTotal} outstanding</Badge>
          </div>
          <div className="grid gap-px bg-mist-100 sm:grid-cols-2 lg:grid-cols-3">
            <WorkQueueGroup
              icon={<FileWarning size={15} />}
              title="Unsigned notes"
              items={unsignedNotes.map((encounter) => ({ key: encounter.id, text: patientName(encounter.patientId), detail: `${encounter.complaint} · ${timeAgo(encounter.date)}` }))}
              emptyText="No unsigned notes."
              linkTo="/consultation"
              linkLabel="Open consultation"
              urgent
            />
            <WorkQueueGroup
              icon={<AlertTriangle size={15} />}
              title="Critical results to communicate"
              items={criticalResults.map((order) => ({ key: order.id, text: patientName(order.patientId), detail: `${order.test}: ${order.result ?? "—"}` }))}
              emptyText="No uncommunicated critical results."
              linkTo="/laboratory"
              linkLabel="Open laboratory"
              urgent
            />
            <WorkQueueGroup
              icon={<Beaker size={15} />}
              title="Results awaiting acknowledgement"
              items={unacknowledgedResults.map((order) => ({ key: order.id, text: patientName(order.patientId), detail: `${order.test}: ${order.result ?? "—"}${order.flag && order.flag !== "Normal" ? ` (${order.flag})` : ""}` }))}
              emptyText="Nothing waiting on you."
              linkTo="/laboratory"
              linkLabel="Open laboratory"
            />
            <WorkQueueGroup
              icon={<Clock size={15} />}
              title="Overdue lab orders"
              items={overdueLabOrders.map((order) => ({ key: order.id, text: patientName(order.patientId), detail: `${order.test} · ordered ${timeAgo(order.orderedAt)}` }))}
              emptyText="No specimens overdue."
              linkTo="/laboratory"
              linkLabel="Open laboratory"
            />
            <WorkQueueGroup
              icon={<Share2 size={15} />}
              title="Overdue referrals"
              items={overdueReferrals.map((referral) => ({ key: referral.id, text: patientName(referral.patientId), detail: `${referral.facility} · sent ${timeAgo(referral.date)}` }))}
              emptyText="No referrals overdue a response."
              linkTo="/referrals"
              linkLabel="Open referrals"
            />
            <WorkQueueGroup
              icon={<CalendarClock size={15} />}
              title="Follow-ups due"
              items={dueFollowUps.map((appointment) => ({ key: appointment.id, text: patientName(appointment.patientId), detail: `${shortDate(appointment.date)} · ${appointment.reason ?? "Follow-up"}` }))}
              emptyText="No follow-ups due."
              linkTo="/appointments"
              linkLabel="Open appointments"
            />
          </div>
          {overdueActivities.length > 0 && (
            <div className="border-t border-mist-100 px-5 py-3">
              <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-mist-400">
                <ClipboardList size={13} /> Care plan activities overdue ({overdueActivities.length})
              </p>
              <ul className="space-y-0.5 text-sm text-mist-600">
                {overdueActivities.slice(0, 5).map(({ plan, activity }) => (
                  <li key={activity.id}>
                    <Link to={`/patients/${plan.patientId}`} className="hover:underline">{patientName(plan.patientId)}</Link> — {activity.description} ({plan.title})
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      </Reveal>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <Reveal className="lg:col-span-2">
          <Card>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-display font-bold text-mist-900">Monthly Performance</h3>
              <span className="text-xs text-mist-400">{new Date().toLocaleString("en", { month: "long", year: "numeric" })}</span>
            </div>
            <div className="space-y-4">
              {monthlyTargets.map((target) => (
                <div key={target.label}>
                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <span className="font-medium text-mist-700">{target.label}</span>
                    <span className="text-mist-400">{target.value} / {target.target}</span>
                  </div>
                  <Progress value={target.value} target={target.target} />
                </div>
              ))}
            </div>
          </Card>
        </Reveal>

        <Reveal delay={0.1}>
          <Card className="h-full">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-display font-bold text-mist-900">Stock Alerts</h3>
              <Badge tone="action">{lowStock.length}</Badge>
            </div>
            <div className="space-y-2">
              {lowStock.length === 0 && <SectionNote>No items at or below reorder level.</SectionNote>}
              {lowStock.map((drug) => (
                <div key={drug.id} className="rounded-xl bg-action-50/60 px-3 py-2 ring-1 ring-action-100">
                  <p className="text-sm font-semibold text-action-800">{drug.name} — {drug.stock} left</p>
                  <p className="text-[11px] text-action-500">{drug.form} · reorder at {drug.reorder}</p>
                </div>
              ))}
              <Link to="/pharmacy" className="btn-soft mt-1 w-full">
                Open Pharmacy <ArrowRight size={14} />
              </Link>
            </div>
          </Card>
        </Reveal>
      </div>

      <div className="mt-5">
        <Reveal delay={0.1}>
          <Card className="h-full">
            <h3 className="mb-3 font-display font-bold text-mist-900">Recent Activity</h3>
            <div className="space-y-3">
              {events.slice(0, 8).map((event) => (
                <div key={event.id} className="flex items-start gap-2.5 text-sm">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-gradient" aria-hidden />
                  <div className="min-w-0">
                    <p className="truncate text-mist-700">
                      <span className="font-semibold">{event.user.split(" ").slice(-1)[0]}</span>{" "}
                      {event.action.toLowerCase()} · <span className="text-mist-400">{event.resource}</span>
                    </p>
                    <p className="text-[11px] text-mist-400">{timeAgo(event.ts)}</p>
                  </div>
                </div>
              ))}
            </div>
            <Link to="/audit-log" className="btn-ghost mt-3 w-full text-xs">
              View full audit log
            </Link>
          </Card>
        </Reveal>
      </div>

      <p className="mt-6 text-center text-[11px] text-mist-300">
        Revenue collected this period: {naira(collected)} · {unpaidCount} unpaid invoice{unpaidCount === 1 ? "" : "s"} · last activity {events[0] ? timeAgo(events[0].ts) : "—"}
      </p>
    </div>
  );
}

function WorkQueueGroup({
  icon,
  title,
  items,
  emptyText,
  linkTo,
  linkLabel,
  urgent,
}: {
  icon: ReactNode;
  title: string;
  items: { key: string; text: string; detail: string }[];
  emptyText: string;
  linkTo: string;
  linkLabel: string;
  urgent?: boolean;
}) {
  return (
    <div className="bg-white px-4 py-3">
      <p className="mb-1.5 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-mist-500">
          {icon} {title}
        </span>
        {items.length > 0 && <Badge tone={urgent ? "action" : "amber"}>{items.length}</Badge>}
      </p>
      {items.length === 0 ? (
        <p className="text-xs text-mist-400">{emptyText}</p>
      ) : (
        <ul className="space-y-1">
          {items.slice(0, 4).map((item) => (
            <li key={item.key} className="text-sm">
              <span className="font-medium text-mist-800">{item.text}</span>
              <span className="block text-[11px] text-mist-400">{item.detail}</span>
            </li>
          ))}
          {items.length > 4 && <li className="text-[11px] text-mist-400">+{items.length - 4} more</li>}
        </ul>
      )}
      {items.length > 0 && (
        <Link to={linkTo} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline">
          {linkLabel} <ArrowRight size={12} />
        </Link>
      )}
    </div>
  );
}
