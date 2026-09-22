import { useState } from "react";
import { Activity, Plus } from "lucide-react";
import { PageHeader, Button, Badge, StatCard } from "@/components/ui/primitives";
import { Tabs } from "@/components/ui/Tabs";
import { Table, Row, Cell } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select, Grid } from "@/components/ui/form";
import { PatientPicker } from "@/components/ui/PatientPicker";
import { PatientLink } from "@/components/ui/PatientLink";
import { useEmr } from "@/store/useEmr";
import { shortDate, ageFromDob } from "@/lib/format";

export default function Ncd() {
  const { ncdClients, patientById, addNcdClient } = useEmr();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ patientId: "", condition: "Essential hypertension", bp: "", fbs: 0, nextVisit: "", control: "Controlled" as "Controlled" | "Uncontrolled" });

  return (
    <div>
      <PageHeader
        title="NCD Register"
        subtitle="Hypertension & diabetes chronic care"
        actions={<Button onClick={() => setOpen(true)}><Plus size={15} /> Enrol Client</Button>}
      />
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Enrolled" value={ncdClients.length} tone="brand" icon={<Activity size={18} />} />
        <StatCard label="Hypertension" value={ncdClients.filter((c) => c.condition.toLowerCase().includes("hyperten")).length} tone="mist" delay={0.05} />
        <StatCard label="Diabetes" value={ncdClients.filter((c) => c.condition.toLowerCase().includes("diab")).length} tone="mist" delay={0.1} />
        <StatCard label="Uncontrolled" value={ncdClients.filter((c) => c.control === "Uncontrolled").length} tone="action" delay={0.15} />
      </div>

      <Tabs tabs={["Register", "Due for Review"]}>
        {(t) => (
          <Table columns={["Patient", "Age", "Condition", "Last BP", "Last FBS", "Control", "Next Visit"]} caption={t === "Register" ? "NCD register" : "NCD clients due for review"}>
            {(t === "Register" ? ncdClients : ncdClients.filter((c) => new Date(c.nextVisit) < new Date(Date.now() + 7 * 864e5))).length === 0 && (
              <Row><Cell className="text-mist-400">{t === "Register" ? "No NCD clients enrolled yet." : "No clients due for review in the next 7 days."}</Cell></Row>
            )}
            {(t === "Register" ? ncdClients : ncdClients.filter((c) => new Date(c.nextVisit) < new Date(Date.now() + 7 * 864e5))).map((c, i) => {
              const p = patientById(c.patientId);
              return (
                <Row key={c.id} index={i}>
                  <Cell className="font-semibold"><PatientLink patient={p} /></Cell>
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
            addNcdClient({
              patientId: f.patientId, condition: f.condition, bp: f.bp, fbs: f.fbs,
              control: f.control,
              nextVisit: f.nextVisit ? new Date(f.nextVisit).toISOString() : new Date(Date.now() + 28 * 864e5).toISOString(),
            });
            setOpen(false);
            setF({ patientId: "", condition: "Essential hypertension", bp: "", fbs: 0, nextVisit: "", control: "Controlled" });
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
          <Field label="Clinician's control assessment" hint="Your own judgement — this is not auto-derived from the readings above.">
            <Select value={f.control} onChange={(e) => setF({ ...f, control: e.target.value as never })} options={["Controlled", "Uncontrolled"]} />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
