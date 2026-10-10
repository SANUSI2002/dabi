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
import { PRESCRIPTION_PENDING_STATUSES } from "@/data/pharmacyOps";
import { LAB_TESTS } from "@/data/catalog";
import { naira, timeAgo, shortDate } from "@/lib/format";
import { useIsLiveEmr, useLiveEmr } from "@/emr-live/session";
import { describeAction, overdueLabTests, useLiveDashboard, useLiveDashboardRefresh } from "@/emr-live/dashboard";

const tatFor = (test: string) => LAB_TESTS.find((entry) => entry.name === test)?.tat ?? 60;

export default function Dashboard() {
  const { user } = useAuth();
  const emr = useEmr();
  const { queue, labOrders, encounters, admissions, patients, patientById, invoices, referrals, appointments } = emr;
  const drugs = useCatalog((state) => state.drugs);
  const events = useAudit((state) => state.events);
  const beds = useWards((state) => state.beds);
  const carePlans = useClinical((state) => state.carePlans);
  // A live hospital's dashboard comes from its EMR (see src/emr-live/dashboard.ts); parts the
  // role may not see are null and say so, and modules not yet connected say that.
  const live = useIsLiveEmr();
  useLiveDashboardRefresh(live);
  const liveData = useLiveDashboard((state) => state.data);
  const liveError = useLiveDashboard((state) => state.error);
  const liveUser = useLiveEmr((state) => state.user);
  const greeted = live && liveUser ? liveUser : user;

  const collected = invoices
    .filter((invoice) => invoice.status === "Paid")
    .reduce((total, invoice) => total + invoice.lines.reduce((sum, line) => sum + line.qty * line.unitPrice, 0), 0);
  const unpaidCount = invoices.filter((invoice) => invoice.status === "Unpaid").length;

  const waiting = queue.filter((entry) => entry.status === "Waiting").length;
  const inProgress = queue.filter((entry) => entry.status === "In Progress").length;
  const completed = queue.filter((entry) => entry.status === "Completed").length;
  const referredCount = queue.filter((entry) => entry.status === "Referred").length;
  const labPending = labOrders.filter((order) => ["Pending", "Sample Collected"].includes(order.status)).length;
  const rxPending = encounters.flatMap((encounter) => encounter.prescriptions).filter((prescription) => (PRESCRIPTION_PENDING_STATUSES as readonly string[]).includes(prescription.status)).length;
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
  const patientName = (id: string) => {
    const patient = patientById(id);
    return patient ? `${patient.firstName} ${patient.lastName}` : "—";
  };

  type WorkItem = { key: string; text: string; detail: string };
  const work: NonNullable<typeof liveData>["work"] = liveData?.work ?? {};
  const person = (patient: { name: string } | null) => patient?.name ?? "—";
  const queueItems: Record<"unsigned" | "critical" | "acknowledge" | "overdueLab" | "referrals" | "followUps", WorkItem[]> = live
    ? {
      unsigned: (work.unsignedNotes ?? []).map((note) => ({ key: note.id, text: person(note.patient), detail: `${note.reason ?? `${note.kind.toLowerCase()} note`} · ${timeAgo(note.createdAt)}` })),
      critical: (work.criticalResults ?? []).map((item) => ({ key: item.id, text: person(item.patient), detail: `${item.testName}: ${item.result}` })),
      acknowledge: (work.resultsToAcknowledge ?? []).map((item) => ({ key: item.id, text: person(item.patient), detail: `${item.testName}: ${item.result}${item.abnormal ? " (Abnormal)" : ""}` })),
      overdueLab: overdueLabTests(work.pendingLabTests ?? [], tatFor)
        .map((test) => ({ key: test.id, text: person(test.patient), detail: `${test.testName} · ordered ${timeAgo(test.orderedAt)}` })),
      referrals: [],
      followUps: [],
    }
    : {
      unsigned: unsignedNotes.map((encounter) => ({ key: encounter.id, text: patientName(encounter.patientId), detail: `${encounter.complaint} · ${timeAgo(encounter.date)}` })),
      critical: criticalResults.map((order) => ({ key: order.id, text: patientName(order.patientId), detail: `${order.test}: ${order.result ?? "—"}` })),
      acknowledge: unacknowledgedResults.map((order) => ({ key: order.id, text: patientName(order.patientId), detail: `${order.test}: ${order.result ?? "—"}${order.flag && order.flag !== "Normal" ? ` (${order.flag})` : ""}` })),
      overdueLab: overdueLabOrders.map((order) => ({ key: order.id, text: patientName(order.patientId), detail: `${order.test} · ordered ${timeAgo(order.orderedAt)}` })),
      referrals: overdueReferrals.map((referral) => ({ key: referral.id, text: patientName(referral.patientId), detail: `${referral.facility} · sent ${timeAgo(referral.date)}` })),
      followUps: dueFollowUps.map((appointment) => ({ key: appointment.id, text: patientName(appointment.patientId), detail: `${shortDate(appointment.date)} · ${appointment.reason ?? "Follow-up"}` })),
    };
  /** Live: a part the role may not see says so, rather than "nothing waiting". */
  const notForRole = (list: unknown[] | undefined, text: string) => (live && liveData && list === undefined ? "Not part of your role." : text);
  const liveOverdueActivities = live ? [] : overdueActivities;
  const workQueueTotal = Object.values(queueItems).reduce((total, list) => total + list.length, 0) + liveOverdueActivities.length;

  /** Live figures: "…" while loading, "—" when the role may not see them. */
  const figure = (pick: (data: NonNullable<typeof liveData>) => number | null | undefined) => {
    if (!liveData) return "…";
    const value = pick(liveData);
    return value === null || value === undefined ? "—" : value;
  };
  const liveLowStock = liveData?.lowStock ?? [];
  const stats = [
    { label: "Today Waiting", value: live ? figure((d) => d.queue?.waiting) : waiting, icon: <Clock size={18} />, tone: "mist" as const },
    { label: "In Progress", value: live ? figure((d) => d.queue?.inProgress) : inProgress, icon: <Activity size={18} />, tone: "brand" as const },
    { label: "Completed", value: live ? figure((d) => d.queue?.completed) : completed, icon: <CheckCircle2 size={18} />, tone: "brand" as const },
    { label: "Referred", value: live ? figure((d) => d.queue?.referred) : referredCount, icon: <Share2 size={18} />, tone: "action" as const },
    { label: "Lab Pending", value: live ? figure((d) => d.labPending) : labPending, icon: <FlaskConical size={18} />, tone: "mist" as const },
    { label: "Rx Pending", value: live ? figure((d) => d.prescriptionsPending) : rxPending, icon: <Pill size={18} />, tone: "action" as const },
    { label: "Low Stock", value: live ? figure((d) => d.lowStock?.length) : lowStock.length, icon: <PackageX size={18} />, tone: "action" as const },
    { label: "Total Patients", value: live ? figure((d) => d.patients) : patients.length, icon: <Users size={18} />, tone: "brand" as const },
    { label: "Beds Available", value: live ? figure((d) => d.beds?.available) : activeBeds - activeAdmissions, icon: <BedDouble size={18} />, tone: "mist" as const },
    { label: "Admissions Today", value: live ? figure((d) => d.beds?.admitted) : activeAdmissions, icon: <BedDouble size={18} />, tone: "brand" as const },
  ];

  const liveMonth = liveData
    ? ([["OPD Visits", liveData.month.outpatientVisits], ["Admissions", liveData.month.admissions], ["Lab Tests", liveData.month.labTestsResulted], ["Prescriptions Dispensed", liveData.month.prescriptionsDispensed]] as const)
      .filter(([, value]) => value !== undefined)
    : [];
  const liveCollected = liveData?.revenue ? liveData.revenue.collectedThisMonthMinor / 100 : 0;
  const lastActivity = live ? liveData?.activity?.[0]?.createdAt : events[0]?.ts;

  return (
    <div>
      <PageHeader
        title={`Welcome, ${greeted.name.split(" ").slice(-1)[0]}`}
        subtitle={`Today is ${shortDate(new Date())} · ${greeted.role} dashboard`}
      />
      {live && liveError && <p role="alert" className="mb-4 rounded-xl bg-action-50 px-3 py-2 text-sm text-action-700">{liveError}</p>}

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
              items={queueItems.unsigned}
              emptyText={notForRole(work.unsignedNotes, "No unsigned notes.")}
              linkTo="/consultation"
              linkLabel="Open consultation"
              urgent
            />
            <WorkQueueGroup
              icon={<AlertTriangle size={15} />}
              title="Critical results to communicate"
              items={queueItems.critical}
              emptyText={notForRole(work.criticalResults, "No uncommunicated critical results.")}
              linkTo="/laboratory"
              linkLabel="Open laboratory"
              urgent
            />
            <WorkQueueGroup
              icon={<Beaker size={15} />}
              title="Results awaiting acknowledgement"
              items={queueItems.acknowledge}
              emptyText={notForRole(work.resultsToAcknowledge, "Nothing waiting on you.")}
              linkTo="/laboratory"
              linkLabel="Open laboratory"
            />
            <WorkQueueGroup
              icon={<Clock size={15} />}
              title="Overdue lab orders"
              items={queueItems.overdueLab}
              emptyText={notForRole(work.pendingLabTests, "No specimens overdue.")}
              linkTo="/laboratory"
              linkLabel="Open laboratory"
            />
            <WorkQueueGroup
              icon={<Share2 size={15} />}
              title="Overdue referrals"
              items={queueItems.referrals}
              emptyText={live ? "Referrals are not connected for your hospital yet." : "No referrals overdue a response."}
              linkTo="/referrals"
              linkLabel="Open referrals"
            />
            <WorkQueueGroup
              icon={<CalendarClock size={15} />}
              title="Follow-ups due"
              items={queueItems.followUps}
              emptyText={live ? "Appointments are not connected for your hospital yet." : "No follow-ups due."}
              linkTo="/appointments"
              linkLabel="Open appointments"
            />
          </div>
          {liveOverdueActivities.length > 0 && (
            <div className="border-t border-mist-100 px-5 py-3">
              <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-mist-400">
                <ClipboardList size={13} /> Care plan activities overdue ({liveOverdueActivities.length})
              </p>
              <ul className="space-y-0.5 text-sm text-mist-600">
                {liveOverdueActivities.slice(0, 5).map(({ plan, activity }) => (
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
              {live && !liveData && <SectionNote>Loading this month’s figures…</SectionNote>}
              {live && liveData && liveMonth.length === 0 && <SectionNote>This month’s clinical figures are not part of your role.</SectionNote>}
              {live && liveMonth.map(([label, value]) => (
                <div key={label} className="flex items-center justify-between text-sm">
                  <span className="font-medium text-mist-700">{label}</span>
                  <span className="font-semibold text-mist-900">{value}</span>
                </div>
              ))}
              {live && liveMonth.length > 0 && <SectionNote>No monthly targets are set for your hospital yet, so these are this month’s counts.</SectionNote>}
              {!live && monthlyTargets.map((target) => (
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
              <Badge tone="action">{live ? liveLowStock.length : lowStock.length}</Badge>
            </div>
            <div className="space-y-2">
              {live && liveData && liveData.lowStock === null && <SectionNote>Pharmacy stock is not part of your role.</SectionNote>}
              {live && liveData?.lowStock?.length === 0 && <SectionNote>No items at or below reorder level.</SectionNote>}
              {live && liveLowStock.map((drug) => (
                <div key={drug.code} className="rounded-xl bg-action-50/60 px-3 py-2 ring-1 ring-action-100">
                  <p className="text-sm font-semibold text-action-800">{drug.name} — {drug.onHand} left</p>
                  <p className="text-[11px] text-action-500">{drug.form} · reorder at {drug.reorderLevel}</p>
                </div>
              ))}
              {!live && lowStock.length === 0 && <SectionNote>No items at or below reorder level.</SectionNote>}
              {!live && lowStock.map((drug) => (
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
              {live && liveData && liveData.activity === null && <SectionNote>The hospital’s activity trail is shown to administrators.</SectionNote>}
              {live && liveData?.activity?.length === 0 && <SectionNote>No changes recorded yet.</SectionNote>}
              {live && (liveData?.activity ?? []).map((event) => (
                <div key={event.id} className="flex items-start gap-2.5 text-sm">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-gradient" aria-hidden />
                  <div className="min-w-0">
                    <p className="truncate text-mist-700">
                      <span className="font-semibold">{(event.actorName ?? "System").split(" ").slice(-1)[0]}</span>{" "}
                      {describeAction(event.action)}
                    </p>
                    <p className="text-[11px] text-mist-400">{timeAgo(event.createdAt)}</p>
                  </div>
                </div>
              ))}
              {!live && events.slice(0, 8).map((event) => (
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
        {live
          ? liveData?.revenue
            ? `Revenue collected this month: ${naira(liveCollected)} · ${liveData.revenue.unpaidInvoices} unpaid invoice${liveData.revenue.unpaidInvoices === 1 ? "" : "s"} · `
            : ""
          : `Revenue collected this period: ${naira(collected)} · ${unpaidCount} unpaid invoice${unpaidCount === 1 ? "" : "s"} · `}
        last activity {lastActivity ? timeAgo(lastActivity) : "—"}
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
