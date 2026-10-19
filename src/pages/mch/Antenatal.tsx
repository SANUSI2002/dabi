import { useState } from "react";
import { HeartPulse, Plus } from "lucide-react";
import { PageHeader, Button, Badge, StatCard } from "@/components/ui/primitives";
import { Tabs } from "@/components/ui/Tabs";
import { Table, Row, Cell } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select, Grid } from "@/components/ui/form";
import { PatientPicker } from "@/components/ui/PatientPicker";
import { PatientLink } from "@/components/ui/PatientLink";
import { GuidelineBanner } from "@/components/clinical/GuidelineBanner";
import { useEmr } from "@/store/useEmr";
import { shortDate, ageFromDob } from "@/lib/format";
import type { AncRecord, Patient } from "@/data/types";
import { useIsLiveEmr } from "@/emr-live/session";
import { describeEmrError } from "@/emr-live/client";
import { newIdempotencyKey, useLiveAntenatal, useLiveAntenatalLoad, weeksFromLmp, type LiveAncRecord } from "@/emr-live/antenatal";

export default function Antenatal() {
  const { ancRecords, patientById, enrollAnc, addAncVisit } = useEmr();
  // A live hospital's pregnancies come from its EMR (see src/emr-live/antenatal.ts).
  const live = useIsLiveEmr();
  useLiveAntenatalLoad(live);
  const liveRecords = useLiveAntenatal((state) => state.records);
  const liveError = useLiveAntenatal((state) => state.error);
  const records: (AncRecord & Partial<LiveAncRecord>)[] = live ? liveRecords : ancRecords;
  const patientOf = (r: AncRecord & Partial<LiveAncRecord>): Patient | undefined => (live ? r.patient : patientById(r.patientId));
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [enrolKey, setEnrolKey] = useState(newIdempotencyKey);
  const [visitKey, setVisitKey] = useState(newIdempotencyKey);

  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ patientId: "", lmp: "", gravida: 1, para: 0, bloodGroup: "", hb: 0, ttDoses: 0 });

  const [visitOpen, setVisitOpen] = useState(false);
  const [vf, setVf] = useState({ recordId: "", date: "", weeks: 0, weight: 0, bp: "", hb: 0, fhr: 0, next: "" });
  const visitRecord = records.find((r) => r.id === vf.recordId);

  const visits = records.flatMap((r) => r.visits.map((v) => ({ ...v, r })));
  const highRisk = (r: AncRecord) => (r.riskFlags ? r.riskFlags.length > 0 : (r.hb ?? 12) < 10);

  /** Saves (live: on the hospital's record) and shows the hospital's answer if it refuses. */
  async function run(work: () => Promise<void> | void, after: () => void) {
    setBusy(true); setActionError("");
    try { await work(); after(); }
    catch (cause) { setActionError(describeEmrError(cause)); }
    finally { setBusy(false); }
  }

  return (
    <div>
      <PageHeader
        title="Antenatal Care"
        subtitle={`${records.filter((r) => r.status === "Active").length} active enrollments`}
        actions={
          <>
            <Button variant="ghost" onClick={() => { setVf({ recordId: "", date: "", weeks: 0, weight: 0, bp: "", hb: 0, fhr: 0, next: "" }); setVisitKey(newIdempotencyKey()); setActionError(""); setVisitOpen(true); }}>
              <Plus size={15} /> Record Visit
            </Button>
            <Button onClick={() => { setEnrolKey(newIdempotencyKey()); setActionError(""); setOpen(true); }}><Plus size={15} /> Enroll New Patient</Button>
          </>
        }
      />

      <GuidelineBanner guidelineKey="anc-2016" className="mb-5" />

      {live && (actionError || liveError) && !open && !visitOpen && (
        <p role="alert" className="mb-4 rounded-xl bg-action-50 px-3 py-2 text-sm text-action-700">{actionError || liveError}</p>
      )}

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Enrollments" value={records.length} tone="brand" icon={<HeartPulse size={18} />} />
        <StatCard label="Total ANC Visits" value={visits.length} tone="mist" delay={0.05} />
        <StatCard label="High-risk" value={records.filter(highRisk).length} tone="action" delay={0.1} />
        <StatCard label="Deliveries" value={records.filter((r) => r.status === "Delivered").length} tone="brand" delay={0.15} />
      </div>

      <Tabs tabs={["ANC Enrollments", "Visit Records", "Lab Investigations"]}>
        {(t) =>
          t === "ANC Enrollments" ? (
            <Table columns={["Patient", "Age", "LMP", "EDD", "G / P", "Blood", "Hb", "TT", "Status"]}>
              {records.map((r, i) => {
                const p = patientOf(r);
                return (
                  <Row key={r.id} index={i}>
                    <Cell className="font-semibold"><PatientLink patient={p} /></Cell>
                    <Cell>{p ? ageFromDob(p.dob) : "—"}</Cell>
                    <Cell>{shortDate(r.lmp)}</Cell>
                    <Cell>{shortDate(r.edd)}{r.gestationalWeeksToday !== undefined && <span className="block text-xs text-mist-500">{r.gestationalWeeksToday} weeks today</span>}</Cell>
                    <Cell>{r.gravida} / {r.para}</Cell>
                    <Cell>{r.bloodGroup}</Cell>
                    <Cell>
                      <span className={(r.hb ?? 12) < 10 ? "font-semibold text-action-600" : ""}>{r.hb ?? "—"}</span>
                    </Cell>
                    <Cell>{r.ttDoses} / 5</Cell>
                    <Cell>
                      <Badge tone="brand">{r.status}</Badge>
                      {r.riskFlags && r.riskFlags.length > 0 && (
                        <span className="ml-1.5" title={r.riskFlags.map((flag) => flag.label).join("\n")}><Badge tone="action">High risk</Badge></span>
                      )}
                    </Cell>
                  </Row>
                );
              })}
            </Table>
          ) : t === "Visit Records" ? (
            <Table columns={["Patient", "Visit Date", "Weeks", "Weight", "BP", "Hb", "FHR", "Next Visit"]}>
              {visits.map((v, i) => {
                const p = patientOf(v.r);
                return (
                  <Row key={v.id ?? i} index={i}>
                    <Cell className="font-semibold"><PatientLink patient={p} /></Cell>
                    <Cell>{shortDate(v.date)}</Cell>
                    <Cell>{v.weeks}w</Cell>
                    <Cell>{v.weight ? `${v.weight} kg` : "—"}</Cell>
                    <Cell>{v.bp || "—"}</Cell>
                    <Cell>{v.hb ?? "—"}</Cell>
                    <Cell>{v.fhr ?? "—"}</Cell>
                    <Cell>{v.next ? shortDate(v.next) : "—"}</Cell>
                  </Row>
                );
              })}
            </Table>
          ) : live ? (
            <Table columns={["Patient", "Test", "Ordered", "Status", "Result"]}>
              {records.flatMap((r) => (r.labs ?? []).map((lab) => ({ r, lab }))).map(({ r, lab }, i) => (
                <Row key={lab.id} index={i}>
                  <Cell className="font-semibold"><PatientLink patient={patientOf(r)} /></Cell>
                  <Cell>{lab.testName}</Cell>
                  <Cell>{shortDate(lab.orderedAt)}</Cell>
                  <Cell><Badge tone={lab.status === "Pending" ? "amber" : "brand"}>{lab.status}</Badge></Cell>
                  <Cell>{lab.result ?? ""}</Cell>
                </Row>
              ))}
              {records.some((r) => r.labs === null) && (
                <Row index={0}><Cell className="text-sm text-mist-500">Lab orders are visible to staff who may read lab orders.</Cell><Cell /><Cell /><Cell /><Cell /></Row>
              )}
            </Table>
          ) : (
            <Table columns={["Patient", "Test", "Ordered", "Status", "Result"]}>
              {records.map((r, i) => {
                const p = patientOf(r);
                return (
                  <Row key={r.id} index={i}>
                    <Cell className="font-semibold"><PatientLink patient={p} /></Cell>
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
          <Button disabled={!f.patientId || !f.lmp || busy} onClick={() => void run(() => (live ? useLiveAntenatal.getState().enrol(f, enrolKey) : enrollAnc(f as never)), () => setOpen(false))}>{busy ? "Enrolling…" : "Enroll Patient"}</Button></>}
      >
        <div className="space-y-4">
          {live && actionError && <p role="alert" className="rounded-xl bg-action-50 px-3 py-2 text-sm text-action-700">{actionError}</p>}
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
              disabled={!vf.recordId || !vf.date || busy}
              onClick={() => void run(
                () => (live
                  ? useLiveAntenatal.getState().recordVisit(vf, visitKey)
                  : addAncVisit(vf.recordId, {
                    date: new Date(vf.date).toISOString(),
                    weeks: vf.weeks, weight: vf.weight, bp: vf.bp,
                    hb: vf.hb || undefined, fhr: vf.fhr || undefined,
                    next: vf.next ? new Date(vf.next).toISOString() : new Date(Date.now() + 28 * 864e5).toISOString(),
                  })),
                () => setVisitOpen(false),
              )}
            >
              {busy ? "Saving…" : "Save Visit"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {live && actionError && <p role="alert" className="rounded-xl bg-action-50 px-3 py-2 text-sm text-action-700">{actionError}</p>}
          <Field label="ANC enrollment">
            <Select
              value={vf.recordId}
              onChange={(e) => setVf({ ...vf, recordId: e.target.value })}
              options={[
                { value: "", label: "Select an enrolled patient…" },
                ...records.filter((r) => r.status === "Active").map((r) => {
                  const p = patientOf(r);
                  return { value: r.id, label: p ? `${p.firstName} ${p.lastName} · EDD ${shortDate(r.edd)}` : r.id };
                }),
              ]}
            />
          </Field>
          <Grid cols={3}>
            <Field label="Visit date"><Input type="date" value={vf.date} onChange={(e) => setVf({ ...vf, date: e.target.value })} /></Field>
            {live ? (
              <Field label="Gestational age (weeks)"><Input disabled value={visitRecord && vf.date ? `${weeksFromLmp(visitRecord.lmp, vf.date)} (from LMP)` : "From LMP"} /></Field>
            ) : (
              <Field label="Gestational age (weeks)"><Input type="number" value={vf.weeks || ""} onChange={(e) => setVf({ ...vf, weeks: +e.target.value })} /></Field>
            )}
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
