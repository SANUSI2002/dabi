import { useState } from "react";
import { Link } from "react-router-dom";
import { Users, ShieldAlert, CalendarClock, Award } from "lucide-react";
import { PageHeader, StatCard, Badge } from "@/components/ui/primitives";
import { Table, Row, Cell } from "@/components/ui/Table";
import { Select } from "@/components/ui/form";
import { useHr } from "@/store/useHr";
import { useEmployees } from "@/store/useEmployees";
import { useOrg } from "@/store/useOrg";
import { shortDate, initials } from "@/lib/format";

export default function EmployeeDirectory() {
  const staff = useHr((s) => s.staff);
  const { profiles, bonusPoints, expiringDocuments } = useEmployees();
  const { departments, departmentName, jobPositionName, employeeTypeName } = useOrg();
  const [dept, setDept] = useState("");
  const [renderedAt] = useState(Date.now);

  const expiring = expiringDocuments(45);
  const contractsEnding = profiles.filter((p) => p.contractEndDate && new Date(p.contractEndDate).getTime() - renderedAt < 30 * 864e5);

  const rows = staff
    .map((s) => ({ s, p: profiles.find((x) => x.id === s.id) }))
    .filter((r) => !dept || r.p?.departmentId === dept);

  return (
    <div>
      <PageHeader title="Employee Directory" subtitle={`${staff.length} people on record · Sabi Health Post`} />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Employees" value={staff.length} tone="brand" icon={<Users size={18} />} />
        <StatCard label="Active" value={staff.filter((s) => s.status === "Active").length} tone="brand" delay={0.05} />
        <StatCard label="Credentials expiring ≤ 45d" value={expiring.length} tone={expiring.length ? "action" : "brand"} delay={0.1} icon={<ShieldAlert size={18} />} />
        <StatCard label="Contracts ending ≤ 30d" value={contractsEnding.length} tone={contractsEnding.length ? "amber" : "mist"} delay={0.15} icon={<CalendarClock size={18} />} />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Select value={dept} onChange={(e) => setDept(e.target.value)} className="w-auto" options={[{ value: "", label: "All departments" }, ...departments.map((d) => ({ value: d.id, label: d.name }))]} />
      </div>

      <Table columns={["Employee", "Department", "Job position", "Type", "Manager", "Joined", "Points", "Status"]}>
        {rows.map(({ s, p }, i) => (
          <Row key={s.id} index={i}>
            <Cell>
              <Link to={`/hr/employees/${s.id}`} className="flex items-center gap-2.5 font-semibold text-mist-900 hover:text-brand-700 hover:underline">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-gradient text-[11px] font-bold text-white">{initials(s.name)}</span>
                <span>
                  {s.name}
                  <span className="block text-[11px] font-normal text-mist-400 no-underline">{s.role}</span>
                </span>
              </Link>
            </Cell>
            <Cell>{departmentName(p?.departmentId)}</Cell>
            <Cell className="text-mist-500">{jobPositionName(p?.jobPositionId)}</Cell>
            <Cell><Badge tone="mist">{employeeTypeName(p?.employeeTypeId)}</Badge></Cell>
            <Cell className="text-mist-500">{p?.reportingManagerId ? staff.find((x) => x.id === p.reportingManagerId)?.name ?? "—" : "—"}</Cell>
            <Cell className="text-mist-400">{p?.dateJoining ? shortDate(p.dateJoining) : "—"}</Cell>
            <Cell>
              {bonusPoints.find((b) => b.employeeId === s.id)?.points ? (
                <span className="inline-flex items-center gap-1 font-semibold text-amber-600"><Award size={12} /> {bonusPoints.find((b) => b.employeeId === s.id)?.points}</span>
              ) : (
                <span className="text-mist-300">—</span>
              )}
            </Cell>
            <Cell><Badge tone={s.status === "Active" ? "brand" : "mist"}>{s.status}</Badge></Cell>
          </Row>
        ))}
        {rows.length === 0 && <Row><Cell className="text-mist-400">No employees in this department.</Cell><Cell /><Cell /><Cell /><Cell /><Cell /><Cell /><Cell /></Row>}
      </Table>
    </div>
  );
}
