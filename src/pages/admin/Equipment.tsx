import { useState } from "react";
import { Wrench, Plus } from "lucide-react";
import { PageHeader, Button, Badge, StatCard } from "@/components/ui/primitives";
import { Table, Row, Cell } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { shortDate } from "@/lib/format";

type Job = { id: string; asset: string; issue: string; reportedBy: string; priority: "Low" | "Medium" | "High"; status: "Open" | "In Progress" | "Resolved"; date: string };

export default function Equipment() {
  const [jobs, setJobs] = useState<Job[]>([
    { id: "j1", asset: "Delivery Bed (DB-1120)", issue: "Side rail loose, hydraulics leaking", reportedBy: "Nurse Grace Nwangbo", priority: "High", status: "In Progress", date: new Date(Date.now() - 3 * 864e5).toISOString() },
    { id: "j2", asset: "Vaccine Refrigerator (VR-8890)", issue: "Temperature log shows 2 excursions", reportedBy: "Folashade Adeniyi", priority: "High", status: "Open", date: new Date(Date.now() - 1 * 864e5).toISOString() },
  ]);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ asset: "", issue: "", reportedBy: "Dr. Adaeze Okonjo", priority: "Medium" as const });

  return (
    <div>
      <PageHeader
        title="Equipment & Maintenance"
        subtitle="Maintenance jobs & preventive schedule"
        actions={<Button onClick={() => setOpen(true)}><Plus size={15} /> Report Fault</Button>}
      />
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Open Jobs" value={jobs.filter((j) => j.status !== "Resolved").length} tone="action" icon={<Wrench size={18} />} />
        <StatCard label="In Progress" value={jobs.filter((j) => j.status === "In Progress").length} tone="amber" delay={0.05} />
        <StatCard label="Resolved (30d)" value={jobs.filter((j) => j.status === "Resolved").length} tone="brand" delay={0.1} />
        <StatCard label="High Priority" value={jobs.filter((j) => j.priority === "High").length} tone="action" delay={0.15} />
      </div>

      <Table columns={["Asset", "Issue", "Reported By", "Priority", "Status", "Date"]}>
        {jobs.map((j, i) => (
          <Row key={j.id} index={i}>
            <Cell className="font-semibold">{j.asset}</Cell>
            <Cell className="max-w-[280px] text-mist-600">{j.issue}</Cell>
            <Cell>{j.reportedBy}</Cell>
            <Cell><Badge tone={j.priority === "High" ? "action" : j.priority === "Medium" ? "amber" : "mist"}>{j.priority}</Badge></Cell>
            <Cell>
              <select
                value={j.status}
                onChange={(e) => setJobs((x) => x.map((y) => (y.id === j.id ? { ...y, status: e.target.value as never } : y)))}
                className="input w-auto py-1 text-xs"
              >
                {["Open", "In Progress", "Resolved"].map((s) => <option key={s}>{s}</option>)}
              </select>
            </Cell>
            <Cell className="text-mist-400">{shortDate(j.date)}</Cell>
          </Row>
        ))}
      </Table>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Report Equipment Fault"
        footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="action" disabled={!f.asset || !f.issue} onClick={() => { setJobs((j) => [{ ...f, id: Math.random().toString(), status: "Open", date: new Date().toISOString() }, ...j]); setOpen(false); }}>Submit</Button></>}
      >
        <div className="space-y-4">
          <Field label="Asset"><Input value={f.asset} onChange={(e) => setF({ ...f, asset: e.target.value })} placeholder="Name or serial" /></Field>
          <Field label="Issue"><Textarea value={f.issue} onChange={(e) => setF({ ...f, issue: e.target.value })} /></Field>
          <Field label="Priority"><Select value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value as never })} options={["Low", "Medium", "High"]} /></Field>
        </div>
      </Modal>
    </div>
  );
}
