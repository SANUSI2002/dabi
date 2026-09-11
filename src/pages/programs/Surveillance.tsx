import { useState } from "react";
import { Radar, Plus, AlertTriangle } from "lucide-react";
import { PageHeader, Button, Badge, StatCard } from "@/components/ui/primitives";
import { Tabs } from "@/components/ui/Tabs";
import { Table, Row, Cell } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { Field, Select, Textarea } from "@/components/ui/form";
import { PatientPicker } from "@/components/ui/PatientPicker";
import { useEmr } from "@/store/useEmr";
import { NOTIFIABLE } from "@/data/catalog";
import { dateTime } from "@/lib/format";

export default function Surveillance() {
  const { surveillanceCases, patientById, addSurveillanceCase } = useEmr();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ patientId: "", disease: NOTIFIABLE[0].name, onset: "", notes: "" });
  const immediate = NOTIFIABLE.filter((d) => d.class === "IDSR Immediate");

  return (
    <div>
      <PageHeader
        title="Disease Surveillance (IDSR)"
        subtitle="Notifiable disease reporting & alerts"
        actions={<Button variant="action" onClick={() => setOpen(true)}><Plus size={15} /> Notify Case</Button>}
      />
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Cases This Week" value={surveillanceCases.length} tone="brand" icon={<Radar size={18} />} />
        <StatCard label="Immediate-notify" value={surveillanceCases.filter((c) => immediate.some((d) => d.name === c.disease)).length} tone="action" delay={0.05} icon={<AlertTriangle size={18} />} />
        <StatCard label="Confirmed" value={surveillanceCases.filter((c) => c.status === "Confirmed").length} tone="mist" delay={0.1} />
        <StatCard label="Diseases Tracked" value={NOTIFIABLE.length} tone="mist" delay={0.15} />
      </div>

      <Tabs tabs={["Line List", "Notifiable Diseases"]}>
        {(t) =>
          t === "Line List" ? (
            <Table columns={["Patient", "Disease", "Onset", "Reported", "Status"]} caption="Notifiable disease line list">
              {surveillanceCases.length === 0 && <Row><Cell className="text-mist-400">No cases notified this week.</Cell></Row>}
              {surveillanceCases.map((c, i) => {
                const p = patientById(c.patientId);
                return (
                  <Row key={c.id} index={i}>
                    <Cell className="font-semibold">
                      {p ? `${p.firstName} ${p.lastName}` : "—"}
                      {c.notes && <span className="mt-0.5 block text-[11px] font-normal text-mist-400">{c.notes}</span>}
                    </Cell>
                    <Cell>{c.disease}</Cell>
                    <Cell>{c.onset}</Cell>
                    <Cell className="text-mist-400">{dateTime(c.reportedAt)}</Cell>
                    <Cell><Badge tone={c.status === "Confirmed" ? "action" : "amber"}>{c.status}</Badge></Cell>
                  </Row>
                );
              })}
            </Table>
          ) : (
            <Table columns={["Code", "Disease", "Class", "Priority", "Reporting Window"]}>
              {NOTIFIABLE.map((d, i) => (
                <Row key={d.code} index={i}>
                  <Cell className="font-mono text-xs">{d.code}</Cell>
                  <Cell className="font-medium">{d.name}</Cell>
                  <Cell>{d.class}</Cell>
                  <Cell><Badge tone={d.priority === "Critical" ? "action" : d.priority === "High" ? "amber" : "mist"}>{d.priority}</Badge></Cell>
                  <Cell>{d.window}</Cell>
                </Row>
              ))}
            </Table>
          )
        }
      </Tabs>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Notify Disease Case"
        footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="action" disabled={!f.patientId} onClick={() => { addSurveillanceCase({ ...f, notes: f.notes.trim() || undefined }); setOpen(false); setF({ patientId: "", disease: NOTIFIABLE[0].name, onset: "", notes: "" }); }}>Submit Notification</Button></>}
      >
        <div className="space-y-4">
          <Field label="Patient"><PatientPicker value={f.patientId} onChange={(id) => setF({ ...f, patientId: id })} /></Field>
          <Field label="Disease"><Select value={f.disease} onChange={(e) => setF({ ...f, disease: e.target.value })} options={NOTIFIABLE.map((d) => d.name)} /></Field>
          <Field label="Date of onset"><input type="date" className="input" value={f.onset} onChange={(e) => setF({ ...f, onset: e.target.value })} /></Field>
          {immediate.some((d) => d.name === f.disease) && (
            <div className="rounded-xl bg-action-50 px-3 py-2 text-sm font-semibold text-action-700 ring-1 ring-action-200">
              ⚠ Immediate notification — DSNO and LGA will be alerted within 24 hours.
            </div>
          )}
          <Field label="Case notes"><Textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder="Clinical presentation, contacts, travel history…" /></Field>
        </div>
      </Modal>
    </div>
  );
}
