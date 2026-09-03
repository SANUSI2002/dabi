import { useState } from "react";
import { IdCard, Plus } from "lucide-react";
import { PageHeader, Button, Badge, StatCard } from "@/components/ui/primitives";
import { Tabs } from "@/components/ui/Tabs";
import { Table, Row, Cell } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select, Grid } from "@/components/ui/form";
import { staff as seed } from "@/data/mock";
import { shortDate } from "@/lib/format";
import type { StaffMember } from "@/data/types";

export default function Hris() {
  const [staff, setStaff] = useState<StaffMember[]>(seed);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: "", role: "Nurse", cadre: "", phone: "", email: "", license: "", hireDate: "" });

  const list = staff.filter((s) => `${s.name} ${s.role}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <div>
      <PageHeader
        title="HRIS"
        subtitle={`${staff.length} staff on record`}
        actions={<Button onClick={() => setOpen(true)}><Plus size={15} /> Add Staff</Button>}
      />
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Staff" value={staff.length} tone="brand" icon={<IdCard size={18} />} />
        <StatCard label="Clinical" value={staff.filter((s) => ["Medical Officer", "Nurse"].includes(s.role)).length} tone="mist" delay={0.05} />
        <StatCard label="CHWs" value={staff.filter((s) => s.role.includes("Community")).length} tone="mist" delay={0.1} />
        <StatCard label="Active" value={staff.filter((s) => s.status === "Active").length} tone="brand" delay={0.15} />
      </div>

      <Tabs tabs={["Staff", "Schedule", "Attendance"]}>
        {(t) =>
          t === "Staff" ? (
            <>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or role…" className="input mb-4 max-w-md" />
              <Table columns={["Name", "Role", "Cadre", "Phone", "Hire Date", "License", "Status"]}>
                {list.map((s, i) => (
                  <Row key={s.id} index={i}>
                    <Cell className="font-semibold">{s.name}</Cell>
                    <Cell>{s.role}</Cell>
                    <Cell>{s.cadre}</Cell>
                    <Cell>{s.phone ?? "—"}</Cell>
                    <Cell className="text-mist-400">{shortDate(s.hireDate)}</Cell>
                    <Cell className="font-mono text-xs">{s.license ?? "—"}</Cell>
                    <Cell><Badge tone="brand">{s.status}</Badge></Cell>
                  </Row>
                ))}
              </Table>
            </>
          ) : t === "Schedule" ? (
            <div className="card py-16 text-center text-mist-400">No shifts scheduled for this week. Use "Add Shift" to roster staff.</div>
          ) : (
            <div className="card py-16 text-center text-mist-400">No attendance records for this range.</div>
          )
        }
      </Tabs>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Add Staff"
        footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button disabled={!f.name} onClick={() => { setStaff((s) => [{ ...f, id: Math.random().toString(), status: "Active", hireDate: f.hireDate || new Date().toISOString() }, ...s]); setOpen(false); }}>Add Staff</Button></>}
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
