import { useMemo, useState } from "react";
import { BarChart3, Download } from "lucide-react";
import { PageHeader, Button, Badge, StatCard } from "@/components/ui/primitives";
import { Table, Row, Cell } from "@/components/ui/Table";
import { Select } from "@/components/ui/form";
import { useWorkforce } from "@/store/useWorkforce";
import { useWfScope } from "@/store/useWorkforceSession";
import { useHr } from "@/store/useHr";
import { audit } from "@/store/useAudit";
import { shortDate } from "@/lib/format";

type ReportKey = "Expected vs actual" | "Attendance detail" | "Break compliance" | "Timesheet status" | "Work attribution";
const REPORTS: ReportKey[] = ["Expected vs actual", "Attendance detail", "Break compliance", "Timesheet status", "Work attribution"];

const sum = (ns: number[]) => ns.reduce((a, b) => a + b, 0);
const hm = (h: number) => {
  const mins = Math.round(Math.abs(h) * 60);
  return `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, "0")}m`;
};
const signed = (h: number) => `${h < 0 ? "−" : "+"}${hm(h)}`;
function worked(a: { clockIn: string; clockOut?: string; breakMins: number }) {
  if (!a.clockOut) return 0;
  const [h1, m1] = a.clockIn.split(":").map(Number);
  const [h2, m2] = a.clockOut.split(":").map(Number);
  let mins = h2 * 60 + m2 - (h1 * 60 + m1);
  if (mins < 0) mins += 1440;
  return Math.max(0, mins - a.breakMins) / 60;
}

function downloadCsv(name: string, rows: (string | number)[][]) {
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function WorkforceReports() {
  const wf = useWorkforce();
  const scope = useWfScope();
  const staff = useHr((s) => s.staff);
  const name = (id: string) => staff.find((s) => s.id === id)?.name ?? id;

  const [report, setReport] = useState<ReportKey>("Expected vs actual");
  const [who, setWho] = useState("all");
  const [location, setLocation] = useState("all");

  const inScopeStaff = staff.filter((s) => scope.inScope(s.id));
  const matchStaff = (id: string) => scope.inScope(id) && (who === "all" || who === id);

  const attendance = useMemo(
    () => wf.attendance.filter((a) => matchStaff(a.staffId) && (location === "all" || (a.workLocation ?? "WFO") === location)),
    [wf.attendance, who, location, scope],
  );
  const timesheets = useMemo(() => wf.timesheets.filter((t) => matchStaff(t.staffId)), [wf.timesheets, who, scope]);

  const rows: { cols: (string | number)[]; key: string }[] = [];
  let headers: string[] = [];

  if (report === "Expected vs actual") {
    headers = ["Employee", "Expected", "Actual", "Variance", "Timesheet"];
    inScopeStaff.forEach((s) => {
      if (who !== "all" && who !== s.id) return;
      const ts = wf.timesheets.filter((t) => t.staffId === s.id);
      const exp = sum(ts.flatMap((t) => t.lines.map((l) => l.expectedHours)));
      const act = sum(ts.flatMap((t) => t.lines.map((l) => l.workedHours)));
      rows.push({ key: s.id, cols: [s.name, hm(exp), hm(act), signed(act - exp), ts[0]?.status ?? "No sheet"] });
    });
  } else if (report === "Attendance detail") {
    headers = ["Employee", "Date", "In", "Out", "Break", "Payable", "Location", "Flags"];
    attendance.forEach((a) => rows.push({
      key: a.id,
      cols: [name(a.staffId), shortDate(a.date), a.clockIn, a.clockOut ?? "open", `${a.breakMins}m`, hm(worked(a)), a.workLocation ?? "WFO", a.flags.join(", ") || "—"],
    }));
  } else if (report === "Break compliance") {
    headers = ["Employee", "Date", "Shift", "Break taken", "Required", "Compliant"];
    attendance.forEach((a) => {
      const shift = a.clockOut ? worked(a) + a.breakMins / 60 : 0;
      const required = shift >= 9 ? 45 : shift >= 6 ? 30 : 0;
      rows.push({
        key: a.id,
        cols: [name(a.staffId), shortDate(a.date), hm(shift), `${a.breakMins}m`, `${required}m`, a.breakMins >= required ? "Yes" : "No"],
      });
    });
  } else if (report === "Timesheet status") {
    headers = ["Employee", "Capture mode", "Version", "Status", "Worked", "Variance"];
    timesheets.forEach((t) => {
      const exp = sum(t.lines.map((l) => l.expectedHours));
      const act = sum(t.lines.map((l) => l.workedHours));
      rows.push({ key: t.id, cols: [name(t.staffId), t.captureMode, `v${t.version}`, t.status, hm(act), signed(act - exp)] });
    });
  } else {
    headers = ["Container", "Task", "Assignee", "Estimate", "Logged", "Status"];
    wf.tasks.forEach((tk) => {
      const c = wf.containers.find((x) => x.id === tk.containerId);
      rows.push({ key: tk.id, cols: [c?.name ?? "—", tk.name, tk.assignedTo, `${tk.estimateHours}h`, `${tk.loggedHours}h`, tk.status] });
    });
  }

  const attributed = sum(wf.activities.map((a) => a.hours));

  function exportCsv() {
    downloadCsv(report.replace(/\s+/g, "-").toLowerCase(), [headers, ...rows.map((r) => r.cols)]);
    audit("exported workforce report", `workforce/report/${report}`);
  }

  return (
    <div>
      <PageHeader
        title="Operational time reports"
        subtitle="Expected time, attendance, breaks, timesheet status and work attribution — filtered to your data scope."
        actions={<Button variant="ghost" onClick={exportCsv}><Download size={15} /> Export CSV</Button>}
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Rows" value={rows.length} tone="brand" icon={<BarChart3 size={18} />} />
        <StatCard label="In scope" value={inScopeStaff.length} tone="mist" delay={0.05} />
        <StatCard label="Attributed activity" value={hm(attributed)} tone="mist" delay={0.1} />
        <StatCard label="Report" value={report.split(" ")[0]} tone="brand" delay={0.15} />
      </div>

      <div className="card mb-5 flex flex-wrap items-end gap-3">
        <label className="text-xs font-semibold text-mist-500">
          Report
          <Select value={report} onChange={(e) => setReport(e.target.value as ReportKey)} options={REPORTS} className="mt-1 w-auto" />
        </label>
        <label className="text-xs font-semibold text-mist-500">
          Employee
          <Select
            value={who}
            onChange={(e) => setWho(e.target.value)}
            options={[{ value: "all", label: "All in scope" }, ...inScopeStaff.map((s) => ({ value: s.id, label: s.name }))]}
            className="mt-1 w-auto"
          />
        </label>
        {(report === "Attendance detail" || report === "Break compliance") && (
          <label className="text-xs font-semibold text-mist-500">
            Work location
            <Select value={location} onChange={(e) => setLocation(e.target.value)} options={["all", "WFO", "WFH", "Client Site"]} className="mt-1 w-auto" />
          </label>
        )}
      </div>

      <Table columns={headers}>
        {rows.map((r, i) => (
          <Row key={r.key} index={i}>
            {r.cols.map((c, j) => (
              <Cell key={j} className={j === 0 ? "font-semibold" : undefined}>
                {c === "Yes" ? <Badge tone="brand">Yes</Badge> : c === "No" ? <Badge tone="action">No</Badge> : c}
              </Cell>
            ))}
          </Row>
        ))}
        {rows.length === 0 && <Row><Cell className="text-mist-400">No rows for this filter.</Cell>{headers.slice(1).map((h) => <Cell key={h} />)}</Row>}
      </Table>
    </div>
  );
}
