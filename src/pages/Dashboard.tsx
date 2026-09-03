import { Link } from "react-router-dom";
import {
  Users, Activity, CheckCircle2, Share2, FlaskConical, Pill, PackageX, BedDouble,
  ArrowRight, Clock,
} from "lucide-react";
import { PageHeader, StatCard, Card, Badge, Progress, statusTone } from "@/components/ui/primitives";
import { Reveal } from "@/components/motion/Reveal";
import { useEmr } from "@/store/useEmr";
import { useAuth } from "@/store/useAuth";
import { monthlyTargets, drugs, auditTrail } from "@/data/mock";
import { naira, timeAgo, shortDate } from "@/lib/format";

export default function Dashboard() {
  const { user } = useAuth();
  const { queue, labOrders, encounters, admissions, patients, patientById } = useEmr();

  const waiting = queue.filter((q) => q.status === "Waiting").length;
  const inProgress = queue.filter((q) => q.status === "In Progress").length;
  const completed = queue.filter((q) => q.status === "Completed").length;
  const referred = queue.filter((q) => q.status === "Referred").length;
  const labPending = labOrders.filter((l) => ["Pending", "Sample Collected"].includes(l.status)).length;
  const rxPending = encounters.flatMap((e) => e.prescriptions).filter((r) => r.status === "Pending").length;
  const lowStock = drugs.filter((d) => d.stock <= d.reorder);

  const stats = [
    { label: "Today Waiting", value: waiting, icon: <Clock size={18} />, tone: "mist" as const },
    { label: "In Progress", value: inProgress, icon: <Activity size={18} />, tone: "brand" as const },
    { label: "Completed", value: completed, icon: <CheckCircle2 size={18} />, tone: "brand" as const },
    { label: "Referred", value: referred, icon: <Share2 size={18} />, tone: "action" as const },
    { label: "Lab Pending", value: labPending, icon: <FlaskConical size={18} />, tone: "mist" as const },
    { label: "Rx Pending", value: rxPending, icon: <Pill size={18} />, tone: "action" as const },
    { label: "Low Stock", value: lowStock.length, icon: <PackageX size={18} />, tone: "action" as const },
    { label: "Total Patients", value: patients.length, icon: <Users size={18} />, tone: "brand" as const },
    { label: "Beds Available", value: 22 - admissions.filter((a) => a.status === "Active").length, icon: <BedDouble size={18} />, tone: "mist" as const },
    { label: "Admissions Today", value: admissions.filter((a) => a.status === "Active").length, icon: <BedDouble size={18} />, tone: "brand" as const },
  ];

  return (
    <div>
      <PageHeader
        title={`Welcome, ${user.name.split(" ").slice(-1)[0]}`}
        subtitle={`Today is ${shortDate(new Date())} · ${user.role} dashboard`}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map((s, i) => (
          <StatCard key={s.label} {...s} delay={i * 0.04} />
        ))}
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        <Reveal className="lg:col-span-2">
          <Card>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-display font-bold text-mist-900">Monthly Performance</h3>
              <span className="text-xs text-mist-400">{new Date().toLocaleString("en", { month: "long", year: "numeric" })}</span>
            </div>
            <div className="space-y-4">
              {monthlyTargets.map((m) => (
                <div key={m.label}>
                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <span className="font-medium text-mist-700">{m.label}</span>
                    <span className="text-mist-400">
                      {m.value} / {m.target}
                    </span>
                  </div>
                  <Progress value={m.value} target={m.target} />
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
              {lowStock.map((d) => (
                <div key={d.id} className="rounded-xl bg-action-50/60 px-3 py-2 ring-1 ring-action-100">
                  <p className="text-sm font-semibold text-action-800">
                    {d.name} — {d.stock} left
                  </p>
                  <p className="text-[11px] text-action-500">
                    {d.form} · reorder at {d.reorder}
                  </p>
                </div>
              ))}
              <Link to="/pharmacy" className="btn-soft mt-1 w-full">
                Open Pharmacy <ArrowRight size={14} />
              </Link>
            </div>
          </Card>
        </Reveal>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <Reveal className="lg:col-span-2">
          <Card className="p-0">
            <div className="flex items-center justify-between px-5 py-4">
              <h3 className="font-display font-bold text-mist-900">Live Clinical Queue</h3>
              <Link to="/queue" className="text-xs font-semibold text-brand-700 hover:underline">
                Open queue →
              </Link>
            </div>
            <table className="w-full">
              <thead className="border-y border-mist-100 bg-mist-50/50">
                <tr>
                  <th className="th">Patient</th>
                  <th className="th">Station</th>
                  <th className="th">Priority</th>
                  <th className="th">Status</th>
                  <th className="th">Wait</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-mist-100">
                {queue.map((q) => {
                  const p = patientById(q.patientId);
                  return (
                    <tr key={q.id} className="hover:bg-brand-50/40">
                      <td className="td font-medium">{p ? `${p.firstName} ${p.lastName}` : "—"}</td>
                      <td className="td">{q.station}</td>
                      <td className="td">
                        <Badge tone={q.priority === "Normal" ? "mist" : "action"}>{q.priority}</Badge>
                      </td>
                      <td className="td">
                        <Badge tone={statusTone(q.status)}>{q.status}</Badge>
                      </td>
                      <td className="td text-mist-400">{q.waitMins}m</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        </Reveal>

        <Reveal delay={0.1}>
          <Card className="h-full">
            <h3 className="mb-3 font-display font-bold text-mist-900">Recent Activity</h3>
            <div className="space-y-3">
              {auditTrail.slice(0, 8).map((e) => (
                <div key={e.id} className="flex items-start gap-2.5 text-sm">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-gradient" />
                  <div className="min-w-0">
                    <p className="truncate text-mist-700">
                      <span className="font-semibold">{e.user.split(" ").slice(-1)[0]}</span>{" "}
                      {e.action.toLowerCase()} · <span className="text-mist-400">{e.resource}</span>
                    </p>
                    <p className="text-[11px] text-mist-400">{timeAgo(e.ts)}</p>
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
        Government revenue this month: {naira(184000)} · NHMIS last synced {timeAgo(auditTrail[3].ts)}
      </p>
    </div>
  );
}
