import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Users, UserCheck, Briefcase, ClipboardList, Cake, CalendarClock, ShieldAlert, LogOut, ListChecks,
} from "lucide-react";
import { PageHeader, Card, StatCard, Badge } from "@/components/ui/primitives";
import { Bars, Donut } from "@/components/ui/Chart";
import { useHr } from "@/store/useHr";
import { useEmployees } from "@/store/useEmployees";
import { useOrg } from "@/store/useOrg";
import { useRecruitment } from "@/store/useRecruitment";
import { useOnboarding } from "@/store/useOnboarding";
import { useOffboarding } from "@/store/useOffboarding";
import { usePerformance } from "@/store/usePerformance";
import { useCompanyAssets } from "@/store/useCompanyAssets";
import { useHelpdesk } from "@/store/useHelpdesk";
import { useWorkforce } from "@/store/useWorkforce";
import { shortDate, initials } from "@/lib/format";
import { differenceInCalendarDays } from "date-fns";

function upcomingAnnualDate(dateIso: string, withinDays: number) {
  const d = new Date(dateIso);
  const today = new Date();
  const thisYear = new Date(today.getFullYear(), d.getMonth(), d.getDate());
  const next = thisYear < today ? new Date(today.getFullYear() + 1, d.getMonth(), d.getDate()) : thisYear;
  const days = differenceInCalendarDays(next, today);
  return days <= withinDays ? days : null;
}

export default function HrDashboard() {
  const staff = useHr((s) => s.staff);
  const { profiles, expiringDocuments } = useEmployees();
  const { departments } = useOrg();
  const { requisitions, candidates, stages: pipelineStages } = useRecruitment();
  const onboardingProgress = useOnboarding((s) => s.progress);
  const offboardingCases = useOffboarding((s) => s.cases);
  const { employeeObjectives } = usePerformance();
  const assetRequests = useCompanyAssets((s) => s.requests);
  const tickets = useHelpdesk((s) => s.tickets);
  const { leave, holidays } = useWorkforce();

  const active = staff.filter((s) => s.status === "Active");
  const inactive = staff.filter((s) => s.status === "Inactive");

  const deptHeadcount = useMemo(
    () => departments.map((d) => ({ label: d.name, count: profiles.filter((p) => p.departmentId === d.id && staff.some((s) => s.id === p.id && s.status === "Active")).length })).filter((d) => d.count > 0),
    [departments, profiles, staff],
  );

  const genderSplit = useMemo(() => {
    const withGender = profiles.filter((p) => p.gender && staff.some((s) => s.id === p.id));
    const counts: Record<string, number> = {};
    for (const p of withGender) counts[p.gender!] = (counts[p.gender!] ?? 0) + 1;
    return Object.entries(counts).map(([label, value]) => ({ label, value }));
  }, [profiles, staff]);

  const openRecruitments = requisitions.filter((r) => !r.closed);
  const funnel = useMemo(() => {
    const stageTypeById = new Map(pipelineStages.map((s) => [s.id, s.type]));
    const stageTypes = ["Applied", "Test", "Interview", "Hired"];
    return stageTypes.map((type) => ({
      label: type,
      count: candidates.filter((c) => !c.canceled && stageTypeById.get(c.stageId) === type).length,
    }));
  }, [candidates, pipelineStages]);

  const pendingLeave = leave.filter((l) => l.status === "Pending").length;
  const pendingAssets = assetRequests.filter((r) => r.status === "Requested").length;
  const openTickets = tickets.filter((t) => t.status !== "Resolved").length;
  const atRiskObjectives = employeeObjectives.filter((o) => o.status === "At Risk" || o.status === "Behind").length;
  const totalPending = pendingLeave + pendingAssets + openTickets + atRiskObjectives;

  const upcomingHolidays = holidays
    .map((h) => ({ h, days: upcomingAnnualDate(h.date, 30) }))
    .filter((x): x is { h: typeof holidays[number]; days: number } => x.days !== null)
    .sort((a, b) => a.days - b.days);

  const birthdays = useMemo(() => {
    return profiles
      .filter((p) => p.dob && staff.some((s) => s.id === p.id && s.status === "Active"))
      .map((p) => ({ p, days: upcomingAnnualDate(p.dob!, 30) }))
      .filter((x): x is { p: typeof profiles[number]; days: number } => x.days !== null)
      .sort((a, b) => a.days - b.days);
  }, [profiles, staff]);

  const anniversaries = useMemo(() => {
    return staff
      .filter((s) => s.status === "Active")
      .map((s) => ({ s, days: upcomingAnnualDate(s.hireDate, 30) }))
      .filter((x): x is { s: typeof staff[number]; days: number } => x.days !== null)
      .sort((a, b) => a.days - b.days);
  }, [staff]);

  const expiring = expiringDocuments(45);

  return (
    <div>
      <PageHeader title="HR Dashboard" subtitle="Workforce overview across the whole HR suite" />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Employees" value={staff.length} tone="brand" icon={<Users size={18} />} />
        <StatCard label="Active" value={active.length} tone="brand" delay={0.05} icon={<UserCheck size={18} />} />
        <StatCard label="Open recruitments" value={openRecruitments.length} tone="mist" delay={0.1} icon={<Briefcase size={18} />} />
        <StatCard label="Pending approvals" value={totalPending} tone={totalPending ? "amber" : "brand"} delay={0.15} icon={<ClipboardList size={18} />} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <h3 className="mb-3 font-display font-bold text-mist-900">Department headcount</h3>
          {deptHeadcount.length ? (
            <Bars data={deptHeadcount} x="label" height={240} series={[{ key: "count", label: "Employees", color: "#0fc06d" }]} />
          ) : <p className="text-sm text-mist-400">No department placements yet.</p>}
        </Card>
        <div className="grid grid-cols-2 gap-5">
          <Card>
            <h3 className="mb-2 font-display font-bold text-mist-900">Employee status</h3>
            <Donut centerLabel="Total" data={[{ label: "Active", value: active.length, color: "#0fc06d" }, { label: "Inactive", value: inactive.length, color: "#f83b3b" }]} />
          </Card>
          <Card>
            <h3 className="mb-2 font-display font-bold text-mist-900">Gender split</h3>
            {genderSplit.length ? <Donut centerLabel="Recorded" data={genderSplit} /> : <p className="text-sm text-mist-400">No gender recorded yet.</p>}
          </Card>
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card>
          <h3 className="mb-3 font-display font-bold text-mist-900">Recruitment funnel</h3>
          <Bars data={funnel} x="label" height={220} series={[{ key: "count", label: "Candidates", color: "#0a4f32" }]} />
          <p className="mt-2 text-[11px] text-mist-400">{openRecruitments.length} open requisitions · {candidates.filter((c) => !c.canceled).length} active candidates · {candidates.filter((c) => c.hired).length} hired</p>
        </Card>
        <Card>
          <h3 className="mb-3 font-display font-bold text-mist-900">Pending approvals</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["Leave", pendingLeave, "/workforce/leave"],
              ["Assets", pendingAssets, "/hr/assets"],
              ["Helpdesk", openTickets, "/hr/helpdesk"],
              ["At-risk OKRs", atRiskObjectives, "/hr/performance"],
            ].map(([label, val, href]) => (
              <Link key={label as string} to={href as string} className="rounded-xl bg-mist-50 px-3 py-2.5 text-center hover:bg-mist-100">
                <p className="font-display text-xl font-bold text-mist-900">{val}</p>
                <p className="text-[10px] font-bold uppercase text-mist-400">{label}</p>
              </Link>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between rounded-xl bg-mist-50 px-3 py-2 text-sm">
            <span className="flex items-center gap-1.5 text-mist-600"><ListChecks size={13} /> Onboarding in progress</span>
            <Badge tone="amber">{onboardingProgress.filter((p) => !p.employeeId).length}</Badge>
          </div>
          <div className="mt-2 flex items-center justify-between rounded-xl bg-mist-50 px-3 py-2 text-sm">
            <span className="flex items-center gap-1.5 text-mist-600"><LogOut size={13} /> Offboarding in progress</span>
            <Badge tone="action">{offboardingCases.filter((c) => c.status === "Ongoing").length}</Badge>
          </div>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <Card>
          <h3 className="mb-3 flex items-center gap-2 font-display font-bold text-mist-900"><Cake size={15} /> Birthdays & anniversaries</h3>
          <div className="space-y-2">
            {[...birthdays.map((b) => ({ id: b.p.id, name: staff.find((s) => s.id === b.p.id)?.name ?? b.p.id, kind: "Birthday", days: b.days })),
              ...anniversaries.map((a) => ({ id: a.s.id, name: a.s.name, kind: "Anniversary", days: a.days }))]
              .sort((a, b) => a.days - b.days)
              .slice(0, 6)
              .map((x, i) => (
                <div key={i} className="flex items-center gap-2.5 text-sm">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-brand-gradient text-[10px] font-bold text-white">{initials(x.name)}</span>
                  <span className="min-w-0 flex-1 truncate text-mist-700">{x.name}</span>
                  <Badge tone={x.days === 0 ? "brand" : "mist"}>{x.days === 0 ? "Today" : `${x.days}d`}</Badge>
                  <span className="w-16 shrink-0 text-right text-[10px] text-mist-400">{x.kind}</span>
                </div>
              ))}
            {birthdays.length + anniversaries.length === 0 && <p className="text-sm text-mist-400">Nothing in the next 30 days.</p>}
          </div>
        </Card>
        <Card>
          <h3 className="mb-3 flex items-center gap-2 font-display font-bold text-mist-900"><CalendarClock size={15} /> Upcoming holidays</h3>
          <div className="space-y-2">
            {upcomingHolidays.slice(0, 6).map(({ h, days }) => (
              <div key={h.id} className="flex items-center justify-between text-sm">
                <span className="text-mist-700">{h.name}</span>
                <span className="text-mist-400">{shortDate(h.date)} · {days}d</span>
              </div>
            ))}
            {upcomingHolidays.length === 0 && <p className="text-sm text-mist-400">No holidays in the next 30 days.</p>}
          </div>
        </Card>
        <Card>
          <h3 className="mb-3 flex items-center gap-2 font-display font-bold text-mist-900"><ShieldAlert size={15} /> Credentials expiring</h3>
          <div className="space-y-2">
            {expiring.slice(0, 6).map((d) => (
              <Link key={d.id} to={`/hr/employees/${d.employeeId}`} className="flex items-center justify-between text-sm hover:text-brand-700">
                <span className="truncate text-mist-700">{staff.find((s) => s.id === d.employeeId)?.name ?? d.employeeId} — {d.title}</span>
                <Badge tone={d.daysLeft < 0 ? "action" : "amber"}>{d.daysLeft < 0 ? `${Math.abs(d.daysLeft)}d over` : `${d.daysLeft}d`}</Badge>
              </Link>
            ))}
            {expiring.length === 0 && <p className="text-sm text-mist-400">Nothing expiring in the next 45 days.</p>}
          </div>
        </Card>
      </div>

      <p className="mt-5 text-center text-[11px] text-mist-300">Live from Employee, Recruitment, Onboarding, Offboarding, Performance, Assets, Helpdesk and Workforce</p>
    </div>
  );
}
