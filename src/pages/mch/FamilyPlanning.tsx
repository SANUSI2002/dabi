import { useState } from "react";
import { Users, Plus } from "lucide-react";
import { PageHeader, Button, Badge, StatCard, statusTone } from "@/components/ui/primitives";
import { Tabs } from "@/components/ui/Tabs";
import { Table, Row, Cell } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select, Textarea, Grid, Checkbox } from "@/components/ui/form";
import { PatientPicker } from "@/components/ui/PatientPicker";
import { useEmr } from "@/store/useEmr";
import { FP_METHODS } from "@/data/catalog";
import { shortDate, ageFromDob } from "@/lib/format";

export default function FamilyPlanning() {
  const { fpClients, patientById, addFpClient } = useEmr();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ patientId: "", method: FP_METHODS[0], firstTime: false, startDate: "", nextVisit: "", counselled: true, notes: "" });

  const active = fpClients.filter((c) => c.status === "Active");

  return (
    <div>
      <PageHeader
        title="Family Planning"
        subtitle={`${active.length} active clients`}
        actions={<Button onClick={() => setOpen(true)}><Plus size={15} /> Record Visit</Button>}
      />
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Clients" value={fpClients.length} tone="brand" icon={<Users size={18} />} />
        <StatCard label="Active" value={active.length} tone="brand" delay={0.05} />
        <StatCard label="New acceptors" value={fpClients.filter((c) => c.firstTime).length} tone="mist" delay={0.1} />
        <StatCard label="Discontinued" value={fpClients.filter((c) => c.status === "Discontinued").length} tone="action" delay={0.15} />
      </div>

      <Tabs tabs={["FP Clients", "Method Mix"]}>
        {(t) =>
          t === "FP Clients" ? (
            <Table columns={["Patient", "Age", "Method", "First time", "Start", "Next visit", "Status"]}>
              {fpClients.map((c, i) => {
                const p = patientById(c.patientId);
                return (
                  <Row key={c.id} index={i}>
                    <Cell className="font-semibold">{p ? `${p.firstName} ${p.lastName}` : "—"}</Cell>
                    <Cell>{p ? ageFromDob(p.dob) : "—"}</Cell>
                    <Cell><Badge tone="mist">{c.method}</Badge></Cell>
                    <Cell>{c.firstTime ? "Yes" : "No"}</Cell>
                    <Cell>{shortDate(c.startDate)}</Cell>
                    <Cell>{c.nextVisit ? shortDate(c.nextVisit) : "—"}</Cell>
                    <Cell><Badge tone={statusTone(c.status)}>{c.status}</Badge></Cell>
                  </Row>
                );
              })}
            </Table>
          ) : (
            <div className="card">
              {FP_METHODS.map((m) => {
                const n = fpClients.filter((c) => c.method === m).length;
                return (
                  <div key={m} className="flex items-center justify-between border-b border-mist-100 py-2.5 last:border-0">
                    <span className="text-sm text-mist-700">{m}</span>
                    <span className="text-sm font-semibold text-mist-900">{n}</span>
                  </div>
                );
              })}
            </div>
          )
        }
      </Tabs>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Record FP Visit"
        footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button disabled={!f.patientId || !f.startDate} onClick={() => { addFpClient(f as never); setOpen(false); }}>Save Visit</Button></>}
      >
        <div className="space-y-4">
          <Field label="Patient (female)"><PatientPicker value={f.patientId} onChange={(id) => setF({ ...f, patientId: id })} filter={(p) => p.sex === "F"} /></Field>
          <Grid cols={2}>
            <Field label="Method"><Select value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })} options={FP_METHODS} /></Field>
            <Field label="Visit type"><Select options={["New Visit", "Revisit", "Removal", "Switch method"]} /></Field>
          </Grid>
          <Grid cols={2}>
            <Field label="Start date"><Input type="date" value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value })} /></Field>
            <Field label="Next visit"><Input type="date" value={f.nextVisit} onChange={(e) => setF({ ...f, nextVisit: e.target.value })} /></Field>
          </Grid>
          <Checkbox label="First-time FP user (never used contraception before)" checked={f.firstTime} onChange={(e) => setF({ ...f, firstTime: e.target.checked })} />
          <Checkbox label="Counselling provided (incl. postpartum FP)" checked={f.counselled} onChange={(e) => setF({ ...f, counselled: e.target.checked })} />
          <Field label="Notes / side effects"><Textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
        </div>
      </Modal>
    </div>
  );
}
