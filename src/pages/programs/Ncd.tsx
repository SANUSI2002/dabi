import { useState } from "react";
import { Activity, Plus } from "lucide-react";
import { PageHeader, Button, Badge, StatCard } from "@/components/ui/primitives";
import { Tabs } from "@/components/ui/Tabs";
import { Table, Row, Cell } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select, Grid } from "@/components/ui/form";
import { PatientPicker } from "@/components/ui/PatientPicker";
import { useEmr } from "@/store/useEmr";
import { shortDate, ageFromDob } from "@/lib/format";

type NcdClient = { id: string; patientId: string; condition: string; enrolledAt: string; bp?: string; fbs?: number; control: "Controlled" | "Uncontrolled"; nextVisit: string };

export default function Ncd() {
  const { patientById } = useEmr();
  const [clients, setClients] = useState<NcdClient[]>([
    { id: "n1", patientId: "p3", condition: "Type 2 Diabetes Mellitus", enrolledAt: new Date(Date.now() - 120 * 864e5).toISOString(), bp: "128/82", fbs: 7.8, control: "Uncontrolled", nextVisit: new Date(Date.now() + 14 * 864e5).toISOString() },
  ]);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ patientId: "", condition: "Essential hypertension", bp: "", fbs: 0, nextVisit: "" });

  return (
    <div>
      <PageHeader
        title="NCD Register"
        subtitle="Hypertension & diabetes chronic care"
        actions={<Button onClick={() => setOpen(true)}><Plus size={15} /> Enrol Client</Button>}
      />
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Enrolled" value={clients.length} tone="brand" icon={<Activity size={18} />} />
        <StatCard label="Hypertension" value={clients.filter((c) => c.condition.toLowerCase().includes("hyperten")).length} tone="mist" delay={0.05} />
        <StatCard label="Diabetes" value={clients.filter((c) => c.condition.toLowerCase().includes("diab")).length} tone="mist" delay={0.1} />
        <StatCard label="Uncontrolled" value={clients.filter((c) => c.control === "Uncontrolled").length} tone="action" delay={0.15} />
      </div>

      <Tabs tabs={["Register", "Due for Review"]}>
        {(t) => (
          <Table columns={["Patient", "Age", "Condition", "Last BP", "Last FBS", "Control", "Next Visit"]}>
            {(t === "Register" ? clients : clients.filter((c) => new Date(c.nextVisit) < new Date(Date.now() + 7 * 864e5))).map((c, i) => {
              const p = patientById(c.patientId);
              return (
                <Row key={c.id} index={i}>
                  <Cell className="font-semibold">{p ? `${p.firstName} ${p.lastName}` : "—"}</Cell>
                  <Cell>{p ? ageFromDob(p.dob) : "—"}</Cell>
                  <Cell>{c.condition}</Cell>
                  <Cell>{c.bp ?? "—"}</Cell>
                  <Cell>{c.fbs ?? "—"}</Cell>
                  <Cell><Badge tone={c.control === "Controlled" ? "brand" : "action"}>{c.control}</Badge></Cell>
                  <Cell>{shortDate(c.nextVisit)}</Cell>
                </Row>
              );
            })}
          </Table>
        )}
      </Tabs>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Enrol NCD Client"
        footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button disabled={!f.patientId} onClick={() => {
            setClients((c) => [{ id: Math.random().toString(), patientId: f.patientId, condition: f.condition, enrolledAt: new Date().toISOString(), bp: f.bp, fbs: f.fbs, control: (f.fbs > 7 || (f.bp && +f.bp.split("/")[0] > 140)) ? "Uncontrolled" : "Controlled", nextVisit: f.nextVisit || new Date(Date.now() + 28 * 864e5).toISOString() }, ...c]);
            setOpen(false);
          }}>Enrol</Button></>}
      >
        <div className="space-y-4">
          <Field label="Patient"><PatientPicker value={f.patientId} onChange={(id) => setF({ ...f, patientId: id })} /></Field>
          <Field label="Condition"><Select value={f.condition} onChange={(e) => setF({ ...f, condition: e.target.value })} options={["Essential hypertension", "Type 2 Diabetes Mellitus", "Hypertension + Diabetes", "Asthma", "Sickle Cell Disease"]} /></Field>
          <Grid cols={3}>
            <Field label="BP"><Input value={f.bp} onChange={(e) => setF({ ...f, bp: e.target.value })} placeholder="120/80" /></Field>
            <Field label="FBS (mmol/L)"><Input type="number" step="0.1" value={f.fbs || ""} onChange={(e) => setF({ ...f, fbs: +e.target.value })} /></Field>
            <Field label="Next visit"><Input type="date" value={f.nextVisit} onChange={(e) => setF({ ...f, nextVisit: e.target.value })} /></Field>
          </Grid>
        </div>
      </Modal>
    </div>
  );
}
