import { Link } from "react-router-dom";
import { CalendarRange, Fingerprint, ClipboardList, AlertTriangle, ArrowRight } from "lucide-react";
import { Bars } from "@/components/ui/Chart";
import { PageHeader, StatCard, Card, Badge } from "@/components/ui/primitives";
import { Reveal } from "@/components/motion/Reveal";
import { useWorkforce } from "@/store/useWorkforce";
import { useHr } from "@/store/useHr";
import { shortDate } from "@/lib/format";

const name = (id: string) => useHr.getState().byId(id)?.name ?? id;

export default function WorkforceDashboard() {
  const { attendance, timesheets, assignments, tasks, leave, holidayWork } = useWorkforce();

  const openIntervals = attendance.filter((a) => !a.clockOut);
  const exceptions = attendance.filter((a) => a.flags.some((f) => ["Late", "Missing checkout", "Auto-checkout"].includes(f)));
  const awaiting = timesheets.filter((t) => t.status === "Submitted");
  const pendingApprovals =
    leave.filter((l) => l.status === "Pending").length + holidayWork.filter((w) => w.status === "Pending").length;
  const worked = (t: (typeof timesheets)[number]) => t.lines.reduce((n, l) => n + l.workedHours, 0);
  const expected = (t: (typeof timesheets)[number]) => t.lines.reduce((n, l) => n + l.expectedHours, 0);

  const byPerson = timesheets.map((t) => ({
    label: name(t.staffId).split(" ").slice(-1)[0],
    expected: +expected(t).toFixed(1),
    worked: +worked(t).toFixed(1),
  }));

  return (
    <div>
      <PageHeader title="Time Dashboard" subtitle="Workforce scheduling, attendance & timesheet health — WBiz V3" />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        <StatCard label="Scheduled staff" value={assignments.length} tone="brand" icon={<CalendarRange size={18} />} />
        <StatCard label="Currently clocked in" value={openIntervals.length} tone="mist" delay={0.05} icon={<Fingerprint size={18} />} />
        <StatCard label="Attendance exceptions" value={exceptions.length} tone="action" delay={0.1} icon={<AlertTriangle size={18} />} />
        <StatCard label="Timesheets awaiting" value={awaiting.length} tone="amber" delay={0.15} icon={<ClipboardList size={18} />} />
        <StatCard label="Leave / holiday approvals" value={pendingApprovals} tone={pendingApprovals ? "amber" : "mist"} delay={0.2} />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        <Reveal className="lg:col-span-2">
          <Card>
            <h3 className="mb-3 font-display font-bold text-mist-900">Expected vs worked (this period)</h3>
            <Bars
              data={byPerson}
              x="label"
              height={240}
              series={[
                { key: "expected", label: "Expected", color: "#cdffe4" },
                { key: "worked", label: "Worked", color: "#0fc06d" },
              ]}
            />
          </Card>
        </Reveal>

        <Reveal delay={0.1}>
          <Card className="h-full">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-display font-bold text-mist-900">Exceptions</h3>
              <Badge tone="action">{exceptions.length}</Badge>
            </div>
            <div className="space-y-2">
              {exceptions.map((a) => (
                <div key={a.id} className="rounded-xl bg-action-50/60 px-3 py-2 ring-1 ring-action-100">
                  <p className="text-sm font-semibold text-action-800">{name(a.staffId)} — {a.flags.join(", ")}</p>
                  <p className="text-[11px] text-action-500">{shortDate(a.date)} · in {a.clockIn}{a.clockOut ? ` · out ${a.clockOut}` : ""}</p>
                </div>
              ))}
              {exceptions.length === 0 && <p className="text-sm text-mist-400">No open exceptions.</p>}
              <Link to="/workforce/attendance" className="btn-soft mt-1 w-full">Review attendance <ArrowRight size={14} /></Link>
            </div>
          </Card>
        </Reveal>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Reveal>
          <Card>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-display font-bold text-mist-900">Timesheets awaiting approval</h3>
              <Link to="/workforce/timesheets" className="text-xs font-semibold text-brand-700 hover:underline">Open →</Link>
            </div>
            <div className="space-y-2">
              {awaiting.map((t) => (
                <div key={t.id} className="flex items-center justify-between rounded-xl bg-mist-50 px-3 py-2 text-sm">
                  <span className="font-medium text-mist-800">{name(t.staffId)}</span>
                  <span className="text-mist-400">
                    {worked(t).toFixed(1)}h worked · var {(worked(t) - expected(t) >= 0 ? "+" : "")}{(worked(t) - expected(t)).toFixed(1)}h
                  </span>
                </div>
              ))}
              {awaiting.length === 0 && <p className="text-sm text-mist-400">Nothing awaiting approval.</p>}
            </div>
          </Card>
        </Reveal>

        <Reveal delay={0.08}>
          <Card>
            <h3 className="mb-3 font-display font-bold text-mist-900">Task allocation</h3>
            <div className="space-y-2">
              {tasks.slice(0, 5).map((tk) => (
                <div key={tk.id} className="flex items-center justify-between text-sm">
                  <span className="text-mist-700">{tk.name}</span>
                  <span className="text-mist-400">{tk.loggedHours}/{tk.estimateHours}h · {tk.assignedTo}</span>
                </div>
              ))}
            </div>
            <Link to="/workforce/work" className="btn-ghost mt-3 w-full text-xs">Open Work & Tasks</Link>
          </Card>
        </Reveal>
      </div>
    </div>
  );
}
