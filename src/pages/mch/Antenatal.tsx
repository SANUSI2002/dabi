import { useState } from "react";
import { HeartPulse, Plus } from "lucide-react";
import { PageHeader, Button, Badge, StatCard } from "@/components/ui/primitives";
import { Tabs } from "@/components/ui/Tabs";
import { Table, Row, Cell } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select, Grid } from "@/components/ui/form";
import { PatientPicker } from "@/components/ui/PatientPicker";
import { GuidelineBanner } from "@/components/clinical/GuidelineBanner";
import { useEmr } from "@/store/useEmr";
import { shortDate, ageFromDob } from "@/lib/format";

export default function Antenatal() {
  const { ancRecords, patientById, enrollAnc, addAncVisit } = useEmr();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ patientId: "", lmp: "", gravida: 1, para: 0, bloodGroup: "", hb: 0, ttDoses: 0 });

  const [visitOpen, setVisitOpen] = useState(false);
  const [vf, setVf] = useState({ recordId: "", date: "", weeks: 0, weight: 0, bp: "", hb: 0, fhr: 0, next: "" });

  const visits = ancRecords.flatMap((r) => r.visits.map((v) => ({ ...v, r })));

  return (
    <div>
      <PageHeader
        title="Antenatal Care"
        subtitle={`${ancRecords.filter((r) => r.status === "Active").length} active enrollments`}
        actions={
          <>
            <Button variant="ghost" onClick={() => { setVf({ recordId: "", date: "", weeks: 0, weight: 0, bp: "", hb: 0, fhr: 0, next: "" }); setVisitOpen(true); }}>
              <Plus size={15} /> Record Visit
            </Button>
            <Button onClick={() => setOpen(true)}><Plus size={15} /> Enroll New Patient</Button>
          </>
        }
      />

      <GuidelineBanner guidelineKey="anc-2016" className="mb-5" />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Enrollments" value={ancRecords.length} tone="brand" icon={<HeartPulse size={18} />} />
        <StatCard label="Total ANC Visits" value={visits.length} tone="mist" delay={0.05} />
        <StatCard label="High-risk" value={ancRecords.filter((r) => (r.hb ?? 12) < 10).length} tone="action" delay={0.1} />
        <StatCard label="Deliveries" value={ancRecords.filter((r) => r.status === "Delivered").length} tone="brand" delay={0.15} />
      </div>

      <Tabs tabs={["ANC Enrollments", "Visit Records", "Lab Investigations"]}>
        {(t) =>
          t === "ANC Enrollments" ? (
            <Table columns={["Patient", "Age", "LMP", "EDD", "G / P", "Blood", "Hb", "TT", "Status"]}>
              {ancRecords.map((r, i) => {
                const p = patientById(r.patientId);
                return (
                  <Row key={r.id} index={i}>
                    <Cell className="font-semibold">{p ? `${p.firstName} ${p.lastName}` : "—"}</Cell>
                    <Cell>{p ? ageFromDob(p.dob) : "—"}</Cell>
                    <Cell>{shortDate(r.lmp)}</Cell>
                    <Cell>{shortDate(r.edd)}</Cell>
                    <Cell>{r.gravida} / {r.para}</Cell>
                    <Cell>{r.bloodGroup}</Cell>
                    <Cell>
                      <span className={(r.hb ?? 12) < 10 ? "font-semibold text-action-600" : ""}>{r.hb ?? "—"}</span>
                    </Cell>
                    <Cell>{r.ttDoses} / 5</Cell>
                    <Cell><Badge tone="brand">{r.status}</Badge></Cell>
                  </Row>
                );
              })}
            </Table>
          ) : t === "Visit Records" ? (
            <Table columns={["Patient", "Visit Date", "Weeks", "Weight", "BP", "Hb", "FHR", "Next Visit"]}>
              {visits.map((v, i) => {
                const p = patientById(v.r.patientId);
                return (
                  <Row key={i} index={i}>
                    <Cell className="font-semibold">{p ? `${p.firstName} ${p.lastName}` : "—"}</Cell>
                    <Cell>{shortDate(v.date)}</Cell>
                    <Cell>{v.weeks}w</Cell>
                    <Cell>{v.weight} kg</Cell>
                    <Cell>{v.bp}</Cell>
                    <Cell>{v.hb ?? "—"}</Cell>
                    <Cell>{v.fhr ?? "—"}</Cell>
                    <Cell>{shortDate(v.next)}</Cell>
                  </Row>
                );
              })}
            </Table>
          ) : (
            <Table columns={["Patient", "Test", "Ordered", "Status", "Result"]}>
              {ancRecords.map((r, i) => {
                const p = patientById(r.patientId);
                return (
                  <Row key={r.id} index={i}>
                    <Cell className="font-semibold">{p ? `${p.firstName} ${p.lastName}` : "—"}</Cell>
                    <Cell>Booking bloods (Hb, HIV, HBsAg, Blood group)</Cell>
                    <Cell>{shortDate(r.visits[0]?.date ?? r.lmp)}</Cell>
                    <Cell><Badge tone="amber">Pending</Badge></Cell>
                    <Cell />
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
        title="Enroll New ANC Patient"
        footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button disabled={!f.patientId || !f.lmp} onClick={() => { enrollAnc(f as never); setOpen(false); }}>Enroll Patient</Button></>}
      >
        <div className="space-y-4">
          <Field label="Patient (female only)">
            <PatientPicker value={f.patientId} onChange={(id) => setF({ ...f, patientId: id })} filter={(p) => p.sex === "F"} />
          </Field>
          <Grid cols={2}>
            <Field label="LMP"><Input type="date" value={f.lmp} onChange={(e) => setF({ ...f, lmp: e.target.value })} /></Field>
            <Field label="EDD (auto)"><Input disabled value={f.lmp ? shortDate(new Date(new Date(f.lmp).getTime() + 280 * 864e5)) : ""} /></Field>
          </Grid>
          <Grid cols={3}>
            <Field label="Gravida"><Input type="number" value={f.gravida} onChange={(e) => setF({ ...f, gravida: +e.target.value })} /></Field>
            <Field label="Parity"><Input type="number" value={f.para} onChange={(e) => setF({ ...f, para: +e.target.value })} /></Field>
            <Field label="TT doses"><Input type="number" value={f.ttDoses} onChange={(e) => setF({ ...f, ttDoses: +e.target.value })} /></Field>
          </Grid>
          <Grid cols={2}>
            <Field label="Blood group"><Select value={f.bloodGroup} onChange={(e) => setF({ ...f, bloodGroup: e.target.value })} options={["", "O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"]} /></Field>
            <Field label="Last Hb (g/dL)"><Input type="number" step="0.1" value={f.hb || ""} onChange={(e) => setF({ ...f, hb: +e.target.value })} /></Field>
          </Grid>
        </div>
      </Modal>

      <Modal
        open={visitOpen}
        onClose={() => setVisitOpen(false)}
        title="Record ANC Visit"
        wide
        footer={
          <>
            <Button variant="ghost" onClick={() => setVisitOpen(false)}>Cancel</Button>
            <Button
              disabled={!vf.recordId || !vf.date}
              onClick={() => {
                addAncVisit(vf.recordId, {
                  date: new Date(vf.date).toISOString(),
                  weeks: vf.weeks, weight: vf.weight, bp: vf.bp,
                  hb: vf.hb || undefined, fhr: vf.fhr || undefined,
                  next: vf.next ? new Date(vf.next).toISOString() : new Date(Date.now() + 28 * 864e5).toISOString(),
                });
                setVisitOpen(false);
              }}
            >
              Save Visit
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="ANC enrollment">
            <Select
              value={vf.recordId}
              onChange={(e) => setVf({ ...vf, recordId: e.target.value })}
              options={[
                { value: "", label: "Select an enrolled patient…" },
                ...ancRecords.filter((r) => r.status === "Active").map((r) => {
                  const p = patientById(r.patientId);
                  return { value: r.id, label: p ? `${p.firstName} ${p.lastName} · EDD ${shortDate(r.edd)}` : r.id };
                }),
              ]}
            />
          </Field>
          <Grid cols={3}>
            <Field label="Visit date"><Input type="date" value={vf.date} onChange={(e) => setVf({ ...vf, date: e.target.value })} /></Field>
            <Field label="Gestational age (weeks)"><Input type="number" value={vf.weeks || ""} onChange={(e) => setVf({ ...vf, weeks: +e.target.value })} /></Field>
            <Field label="Weight (kg)"><Input type="number" step="0.1" value={vf.weight || ""} onChange={(e) => setVf({ ...vf, weight: +e.target.value })} /></Field>
            <Field label="Blood pressure"><Input value={vf.bp} onChange={(e) => setVf({ ...vf, bp: e.target.value })} placeholder="120/80" /></Field>
            <Field label="Hb (g/dL)"><Input type="number" step="0.1" value={vf.hb || ""} onChange={(e) => setVf({ ...vf, hb: +e.target.value })} /></Field>
            <Field label="Fetal heart rate"><Input type="number" value={vf.fhr || ""} onChange={(e) => setVf({ ...vf, fhr: +e.target.value })} /></Field>
          </Grid>
          <Field label="Next visit date"><Input type="date" value={vf.next} onChange={(e) => setVf({ ...vf, next: e.target.value })} /></Field>
          {vf.hb > 0 && vf.hb < 10 && (
            <div className="rounded-xl bg-action-50 px-3 py-2 text-sm font-semibold text-action-700 ring-1 ring-action-200">
              ⚠ Hb below 10 g/dL — flag as high-risk, commence iron and review in 2 weeks.
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
