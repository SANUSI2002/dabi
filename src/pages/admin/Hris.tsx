import { useState } from "react";
import { Link } from "react-router-dom";
import { IdCard, Plus } from "lucide-react";
import { PageHeader, Button, Badge, StatCard } from "@/components/ui/primitives";
import { Tabs } from "@/components/ui/Tabs";
import { Table, Row, Cell } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select, Grid } from "@/components/ui/form";
import { useHr } from "@/store/useHr";
import { useWorkforce } from "@/store/useWorkforce";
import { shortDate } from "@/lib/format";

export default function Hris() {
  const { staff, addStaff, setStatus } = useHr();
  const { assignments, attendance, schedules } = useWorkforce();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: "", role: "Nurse", cadre: "", phone: "", email: "", license: "", hireDate: "" });

  const list = staff.filter((s) => `${s.name} ${s.role}`.toLowerCase().includes(q.toLowerCase()));
  const scheduled = new Set(assignments.map((a) => a.staffId));
  const clockedIn = new Set(attendance.filter((a) => !a.clockOut).map((a) => a.staffId));

  return (
    <div>
      <PageHeader
        title="HRIS"
        subtitle={`${staff.length} staff on record`}
        actions={<Button onClick={() => setOpen(true)}><Plus size={15} /> Add Staff</Button>}
      />
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Staff" value={staff.length} tone="brand" icon={<IdCard size={18} />} />
        <StatCard label="On a schedule" value={scheduled.size} tone="mist" delay={0.05} />
        <StatCard label="Clocked in now" value={clockedIn.size} tone="brand" delay={0.1} />
        <StatCard label="Active" value={staff.filter((s) => s.status === "Active").length} tone="brand" delay={0.15} />
      </div>

      <Tabs tabs={["Staff", "Schedule", "Attendance"]}>
        {(t) =>
          t === "Staff" ? (
            <>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or role…" className="input mb-4 max-w-md" />
              <Table columns={["Name", "Role", "Cadre", "License", "Workforce", "Status", ""]}>
                {list.map((s, i) => (
                  <Row key={s.id} index={i}>
                    <Cell className="font-semibold">
                      <Link to={`/hr/employees/${s.id}`} className="hover:text-brand-700 hover:underline">{s.name}</Link>
                      <span className="block text-[11px] font-normal text-mist-400">@{s.username} · hired {shortDate(s.hireDate)}</span>
                    </Cell>
                    <Cell>{s.role}</Cell>
                    <Cell>{s.cadre}</Cell>
                    <Cell className="font-mono text-xs">{s.license ?? "—"}</Cell>
                    <Cell>
                      <div className="flex gap-1">
                        {clockedIn.has(s.id) && <Badge tone="brand">Clocked in</Badge>}
                        {scheduled.has(s.id) && !clockedIn.has(s.id) && <Badge tone="mist">Scheduled</Badge>}
                        {!scheduled.has(s.id) && <span className="text-mist-300">—</span>}
                      </div>
                    </Cell>
                    <Cell><Badge tone={s.status === "Active" ? "brand" : "mist"}>{s.status}</Badge></Cell>
                    <Cell>
                      <button
                        onClick={() => setStatus(s.id, s.status === "Active" ? "Inactive" : "Active")}
                        className="btn-ghost px-2 py-1 text-xs"
                      >
                        {s.status === "Active" ? "Deactivate" : "Reactivate"}
                      </button>
                    </Cell>
                  </Row>
                ))}
              </Table>
            </>
          ) : t === "Schedule" ? (
            <Table columns={["Employee", "Schedule assignment", "Capture mode", "Effective from"]}>
              {assignments.map((a, i) => {
                const s = staff.find((x) => x.id === a.staffId);
                return (
                  <Row key={a.id} index={i}>
                    <Cell className="font-semibold">{s?.name ?? a.staffId}</Cell>
                    <Cell>{schedules.find((x) => x.id === a.scheduleId)?.name ?? a.scheduleId}</Cell>
                    <Cell><Badge tone="mist">{a.captureMode}</Badge></Cell>
                    <Cell>{shortDate(a.effectiveFrom)}</Cell>
                  </Row>
                );
              })}
            </Table>
          ) : (
            <Table columns={["Employee", "Date", "In", "Out", "Break", "Flags"]}>
              {attendance.map((a, i) => {
                const s = staff.find((x) => x.id === a.staffId);
                return (
                  <Row key={a.id} index={i}>
                    <Cell className="font-semibold">{s?.name ?? a.staffId}</Cell>
                    <Cell>{shortDate(a.date)}</Cell>
                    <Cell>{a.clockIn}</Cell>
                    <Cell>{a.clockOut ?? <Badge tone="amber">open</Badge>}</Cell>
                    <Cell>{a.breakMins}m</Cell>
                    <Cell>{a.flags.length ? a.flags.map((f) => <Badge key={f} tone="mist">{f}</Badge>) : <span className="text-mist-300">—</span>}</Cell>
                  </Row>
                );
              })}
            </Table>
          )
        }
      </Tabs>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Add Staff"
        footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button disabled={!f.name} onClick={() => { addStaff({ ...f, hireDate: f.hireDate ? new Date(f.hireDate).toISOString() : new Date().toISOString() }); setOpen(false); setF({ name: "", role: "Nurse", cadre: "", phone: "", email: "", license: "", hireDate: "" }); }}>Add Staff</Button></>}
      >
        <div className="space-y-4">
          <Grid cols={2}>
            <Field label="Full name"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
            <Field label="Role"><Select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })} options={["Medical Officer", "Nurse", "Community Health Worker", "Lab Technician", "Pharmacy Technician", "Health Records Officer", "M&E / HMIS Officer", "Receptionist", "System Admin"]} /></Field>
            <Field label="Cadre"><Input value={f.cadre} onChange={(e) => setF({ ...f, cadre: e.target.value })} /></Field>
            <Field label="Phone"><Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
            <Field label="Email"><Input value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
            <Field label="License number"><Input value={f.license} onChange={(e) => setF({ ...f, license: e.target.value })} placeholder="MDCN / NMCN / MLSCN…" /></Field>
            <Field label="Hire date"><Input type="date" value={f.hireDate} onChange={(e) => setF({ ...f, hireDate: e.target.value })} /></Field>
          </Grid>
        </div>
      </Modal>
    </div>
  );
}
