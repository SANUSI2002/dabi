import { useState } from "react";
import { BedDouble, Plus } from "lucide-react";
import { PageHeader, Button, Badge, StatCard } from "@/components/ui/primitives";
import { Tabs } from "@/components/ui/Tabs";
import { Table, Row, Cell } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { PatientPicker } from "@/components/ui/PatientPicker";
import { useEmr } from "@/store/useEmr";
import { WARDS } from "@/data/catalog";
import { dateTime } from "@/lib/format";
import { cn } from "@/lib/cn";

const BEDS_PER_WARD = 6;

export default function Inpatient() {
  const { admissions, patientById, admit, discharge } = useEmr();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ patientId: "", ward: WARDS[1], bed: "Bed 1", diagnosis: "" });
  const active = admissions.filter((a) => a.status === "Active");

  return (
    <div>
      <PageHeader
        title="Inpatient Management"
        subtitle={`${active.length} active admissions · ${24 - active.length} beds available`}
        actions={<Button onClick={() => setOpen(true)}><Plus size={15} /> Admit Patient</Button>}
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Active Admissions" value={active.length} tone="brand" icon={<BedDouble size={18} />} />
        <StatCard label="Beds Available" value={24 - active.length} tone="mist" delay={0.05} />
        <StatCard label="Beds Occupied" value={active.length} tone="action" delay={0.1} />
        <StatCard label="Outcomes Today" value={admissions.filter((a) => a.status === "Discharged").length} tone="mist" delay={0.15} />
      </div>

      <Tabs tabs={["Current Patients", "Ward Overview", "Outcomes"]}>
        {(t) =>
          t === "Current Patients" ? (
            active.length === 0 ? (
              <div className="card py-16 text-center text-mist-400">No active admissions. Click "Admit Patient" to start.</div>
            ) : (
              <Table columns={["Patient", "Ward", "Bed", "Diagnosis", "Admitted", ""]}>
                {active.map((a, i) => {
                  const p = patientById(a.patientId);
                  return (
                    <Row key={a.id} index={i}>
                      <Cell className="font-semibold">{p ? `${p.firstName} ${p.lastName}` : "—"}</Cell>
                      <Cell>{a.ward}</Cell>
                      <Cell>{a.bed}</Cell>
                      <Cell>{a.diagnosis}</Cell>
                      <Cell className="text-mist-400">{dateTime(a.admittedAt)}</Cell>
                      <Cell>
                        <button onClick={() => discharge(a.id, "Recovered")} className="btn-action px-2.5 py-1 text-xs">
                          Discharge
                        </button>
                      </Cell>
                    </Row>
                  );
                })}
              </Table>
            )
          ) : t === "Ward Overview" ? (
            <div className="grid gap-4 md:grid-cols-2">
              {WARDS.map((w) => (
                <div key={w} className="card">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="font-display font-bold text-mist-900">{w}</h3>
                    <Badge tone="mist">General</Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                    {Array.from({ length: BEDS_PER_WARD }).map((_, i) => {
                      const occ = active.find((a) => a.ward === w && a.bed === `Bed ${i + 1}`);
                      return (
                        <div
                          key={i}
                          className={cn(
                            "rounded-xl p-2 text-center text-[11px] font-semibold ring-1",
                            occ ? "bg-action-50 text-action-700 ring-action-200" : "bg-brand-50 text-brand-700 ring-brand-200",
                          )}
                        >
                          Bed {i + 1}
                          <span className="block font-normal">{occ ? "Occupied" : "Available"}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Table columns={["Patient", "Ward", "Admitted", "Outcome"]}>
              {admissions.filter((a) => a.status === "Discharged").map((a, i) => {
                const p = patientById(a.patientId);
                return (
                  <Row key={a.id} index={i}>
                    <Cell className="font-semibold">{p ? `${p.firstName} ${p.lastName}` : "—"}</Cell>
                    <Cell>{a.ward}</Cell>
                    <Cell className="text-mist-400">{dateTime(a.admittedAt)}</Cell>
                    <Cell><Badge tone="brand">{a.outcome}</Badge></Cell>
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
        title="Admit Patient"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              disabled={!f.patientId || !f.diagnosis}
              onClick={() => { admit(f.patientId, f.ward, f.bed, f.diagnosis); setOpen(false); }}
            >
              Admit Patient
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Patient"><PatientPicker value={f.patientId} onChange={(id) => setF({ ...f, patientId: id })} /></Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Ward"><Select value={f.ward} onChange={(e) => setF({ ...f, ward: e.target.value })} options={WARDS} /></Field>
            <Field label="Bed">
              <Select value={f.bed} onChange={(e) => setF({ ...f, bed: e.target.value })}
                options={Array.from({ length: BEDS_PER_WARD }).map((_, i) => `Bed ${i + 1}`)} />
            </Field>
          </div>
          <Field label="Admitting diagnosis"><Input value={f.diagnosis} onChange={(e) => setF({ ...f, diagnosis: e.target.value })} /></Field>
          <Field label="Reason for admission"><Textarea placeholder="Clinical details…" /></Field>
        </div>
      </Modal>
    </div>
  );
}
