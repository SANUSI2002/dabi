import { useState } from "react";
import { Link } from "react-router-dom";
import {
  FlaskConical, Printer, TestTube, PlayCircle, CheckCircle2, ShieldCheck, Undo2,
  Settings as SettingsIcon, Eye, TriangleAlert, Ban, Megaphone,
} from "lucide-react";
import { PageHeader, Card, Button, Badge, StatCard } from "@/components/ui/primitives";
import { Tabs } from "@/components/ui/Tabs";
import { Table, Row, Cell, EmptyRow } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select, Textarea, Grid } from "@/components/ui/form";
import { LabReportDoc } from "@/components/print/documents";
import { LabProgress } from "@/components/lab/LabProgress";
import { ClinicalStatusBadge } from "@/components/clinical/ClinicalStatusBadge";
import { CodedValue } from "@/components/clinical/CodedValue";
import { PatientLink } from "@/components/ui/PatientLink";
import { useEmr, labOrderOverdue } from "@/store/useEmr";
import { useLabConfig } from "@/store/useLabConfig";
import { useHr } from "@/store/useHr";
import { useIdentity } from "@/store/useIdentity";
import { LAB_LOINC, localConcept } from "@/data/clinicalCoding";
import { dateTime, shortDate, timeAgo } from "@/lib/format";
import type { LabOrder } from "@/data/types";
import { useIsLiveEmr, liveCan } from "@/emr-live/session";
import { useLiveLab, useLiveLabRefresh, analyteRange, resultValue, referenceText, type LiveLabTest } from "@/emr-live/lab";
import { describeEmrError } from "@/emr-live/client";

// Live labs have no configured bench phases: after collection a test goes straight to analysis.
const LIVE_PHASES = ["Analysis"];

const SAMPLE_TYPES = ["Venous blood (EDTA)", "Venous blood (Plain)", "Capillary blood", "Urine", "Stool", "Sputum", "Swab", "Other"];
const REJECT_REASONS = ["Haemolysed sample", "Insufficient volume", "Clotted sample", "Wrong container", "Unlabelled / mislabelled", "Leaked in transit", "Expired collection", "Other"];

const labConcept = (test: string) => {
  const loinc = LAB_LOINC[test];
  return loinc ? { system: "loinc" as const, code: loinc.code, display: test } : localConcept(test);
};

export default function Laboratory() {
  const emr = useEmr();
  const { collectSample, startProcessing, advancePhase, submitLabResult, approveLabResult, sendLabResultBack, rejectSpecimen, acknowledgeLabResult, communicateCriticalResult } = emr;
  const { configFor } = useLabConfig();
  const user = useIdentity((state) => state.user);
  const demoClinicians = useHr((state) => state.staff).filter((staff) => staff.status === "Active" && staff.role === "Medical Officer");

  // A live hospital's lab works on its own worklist (see src/emr-live/lab.ts); the demo is unchanged.
  const live = useIsLiveEmr();
  const canApprove = live ? liveCan("lab.result.verify") : user.role === "Lab Technician" || user.systemRole === "System Administrator";
  const canAcknowledge = !live || liveCan("lab.order.create");
  useLiveLabRefresh(live, canApprove);
  const lab = useLiveLab();
  const labOrders: LabOrder[] = live ? lab.tests : emr.labOrders;
  const liveTest = (id: string) => lab.tests.find((test) => test.id === id) as LiveLabTest;
  const patientById = (id?: string) => (live ? lab.tests.find((test) => test.patientId === id)?.patient : emr.patientById(id));
  const clinicians = live ? lab.clinicians.map((c) => ({ value: c.userId, label: c.name })) : demoClinicians.map((c) => ({ value: c.name, label: c.name }));
  const phasesFor = (test: string) => (live ? LIVE_PHASES : configFor(test).phases);
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState(false);

  /**
   * Runs a demo action as before, or a live one against the server. `done` runs after success and,
   * unless `keepOpenOnError`, after a failure too (the error then shows on the page).
   */
  async function act(demo: () => void, liveAction: () => Promise<void>, done?: () => void, keepOpenOnError = false) {
    if (!live) { demo(); done?.(); return; }
    setBusy(true);
    setActionError("");
    try {
      await liveAction();
      done?.();
    } catch (cause) {
      setActionError(describeEmrError(cause));
      if (!keepOpenOnError) done?.();
    } finally {
      setBusy(false);
    }
  }

  const [printPatientId, setPrintPatientId] = useState<string | null>(null);
  const [viewId, setViewId] = useState<string | null>(null);
  const [collectFor, setCollectFor] = useState<string | null>(null);
  const [sampleType, setSampleType] = useState(SAMPLE_TYPES[0]);
  const [resultFor, setResultFor] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [flag, setFlag] = useState<"Normal" | "Low" | "High" | "Critical">("Normal");
  const [backFor, setBackFor] = useState<string | null>(null);
  const [backNote, setBackNote] = useState("");
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState(REJECT_REASONS[0]);
  const [criticalFor, setCriticalFor] = useState<string | null>(null);
  const [criticalTo, setCriticalTo] = useState("");

  const pending = labOrders.filter((order) => !["Resulted", "Rejected"].includes(order.status));
  const resulted = labOrders.filter((order) => order.status === "Resulted");
  const rejected = labOrders.filter((order) => order.status === "Rejected");
  const awaiting = labOrders.filter((order) => order.status === "Awaiting Approval");
  const criticalUnacknowledged = resulted.filter(
    (order) => order.flag && order.flag !== "Normal" && !order.acknowledgedAt,
  );
  const viewOrder = labOrders.find((order) => order.id === viewId);
  const resultOrder = labOrders.find((order) => order.id === resultFor);

  function openResult(order: LabOrder) {
    const blank: Record<string, string> = {};
    if (live) liveTest(order.id).analytes.forEach((analyte) => { blank[analyte.code] = ""; });
    else configFor(order.test).resultTemplate.forEach((templateField) => { blank[templateField.label] = ""; });
    setFields(blank);
    setFlag("Normal");
    setResultFor(order.id);
  }

  function patientName(id: string) {
    return <PatientLink patient={patientById(id)} />;
  }

  return (
    <div>
      <PageHeader
        title="Laboratory"
        subtitle={`${pending.length} in progress · ${resulted.length} verified`}
        actions={<Link to="/laboratory/test-settings" className="btn-ghost text-xs"><SettingsIcon size={13} /> Test settings</Link>}
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Orders" value={labOrders.length} tone="brand" icon={<FlaskConical size={18} />} />
        <StatCard label="In progress" value={pending.length} tone="amber" delay={0.05} />
        <StatCard label="Awaiting sign-off" value={awaiting.length} tone="amber" delay={0.1} />
        <StatCard label="Critical unactioned" value={criticalUnacknowledged.length} tone={criticalUnacknowledged.length ? "action" : "mist"} delay={0.15} />
      </div>

      {((actionError && !resultFor) || (live && lab.error)) && (
        <p role="alert" className="mb-4 rounded-xl bg-action-50 px-4 py-2.5 text-sm font-medium text-action-800 ring-1 ring-action-200">
          {actionError || lab.error}
        </p>
      )}

      {criticalUnacknowledged.length > 0 && (
        <div className="mb-5 rounded-2xl border border-action-200 bg-action-50/60 p-4">
          <p className="mb-2 flex items-center gap-1.5 font-display font-bold text-action-700">
            <TriangleAlert size={16} aria-hidden /> Abnormal results awaiting communication / acknowledgement
          </p>
          <ul className="space-y-2">
            {criticalUnacknowledged.map((order) => (
              <li key={order.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white p-3 text-sm ring-1 ring-action-200">
                <span>
                  <b>{patientName(order.patientId)}</b> · {order.test} · <b className="text-action-700">{order.flag}</b> · {order.result ?? "see result"}
                  {order.criticalCommunicatedAt && (
                    <span className="ml-1 text-[11px] text-mist-400">— communicated to {order.criticalCommunicatedTo} {timeAgo(order.criticalCommunicatedAt)}</span>
                  )}
                </span>
                <span className="flex gap-1.5">
                  <button className="btn-ghost px-2.5 py-1 text-xs" onClick={() => setViewId(order.id)}><Eye size={13} /> View</button>
                  {!order.criticalCommunicatedAt && (!live || canApprove) && (
                    <button className="btn-soft px-2.5 py-1 text-xs" onClick={() => { setCriticalTo(clinicians.find((clinician) => clinician.label === order.orderedBy)?.value ?? ""); setCriticalFor(order.id); }}>
                      <Megaphone size={13} /> Communicate
                    </button>
                  )}
                  {canAcknowledge && <button className="btn-primary px-2.5 py-1 text-xs" disabled={busy} onClick={() => act(() => acknowledgeLabResult(order.id), () => lab.acknowledge(liveTest(order.id)))}><CheckCircle2 size={13} /> Acknowledge</button>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Tabs tabs={[`Orders in progress (${pending.length})`, `Verified results (${resulted.length})`, `Rejected specimens (${rejected.length})`]} label="Laboratory work">
        {(tab) =>
          tab.startsWith("Orders") ? (
            <div className="space-y-3">
              {pending.length === 0 && <Card className="text-center text-mist-400">No orders are in progress.</Card>}
              {pending.map((order) => {
                const patient = patientById(order.patientId);
                const config = configFor(order.test);
                const phases = phasesFor(order.test);
                // Turnaround targets are configured per test in the demo only.
                const overdue = !live && labOrderOverdue(order, config.turnaroundMinutes);
                const currentPhase = phases[order.phaseIndex ?? 0];
                return (
                  <Card key={order.id}>
                    <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <CodedValue concept={labConcept(order.test)} className="font-display text-base font-bold" />
                        <p className="mt-0.5 text-[11px] text-mist-400">
                          <PatientLink patient={patient} /> · ordered {dateTime(order.orderedAt)} by {order.orderedBy}
                          {live ? (liveTest(order.id).accessionNumber ? ` · ${liveTest(order.id).accessionNumber}` : "") : ` · expected turnaround ${config.turnaroundMinutes} min`}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1.5">
                        <div className="flex items-center gap-1.5">
                          <Badge tone={order.urgency === "Routine" ? "mist" : "action"}>{order.urgency}</Badge>
                          {overdue && <Badge tone="action">Overdue</Badge>}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <ClinicalStatusBadge kind="request" status={order.status === "Pending" ? "requested" : "active"} title="This is the order / request" />
                          <ClinicalStatusBadge kind="result" status={order.status} title="This is the result state" />
                        </div>
                      </div>
                    </div>

                    <LabProgress order={order} phases={phases} />

                    {order.revisionNote && order.status === "In Process" && (
                      <p className="mt-2 rounded-lg bg-action-50 px-3 py-2 text-xs text-action-600">Sent back for revision: {order.revisionNote}</p>
                    )}

                    <div className="mt-3 flex flex-wrap justify-end gap-2">
                      {(order.status === "Pending" || order.status === "Sample Collected") && (
                        <Button variant="ghost" className="px-2.5 py-1 text-xs" onClick={() => { setRejectReason(REJECT_REASONS[0]); setRejectId(order.id); }}>
                          <Ban size={13} /> Reject specimen
                        </Button>
                      )}
                      {order.status === "Pending" && (
                        <Button onClick={() => { setSampleType(live ? order.category : SAMPLE_TYPES[0]); setCollectFor(order.id); }}>
                          <TestTube size={14} /> Collect sample
                        </Button>
                      )}
                      {order.status === "Sample Collected" && (
                        <Button onClick={() => startProcessing(order.id)}>
                          <PlayCircle size={14} /> Start processing
                        </Button>
                      )}
                      {order.status === "In Process" && ((order.phaseIndex ?? 0) < phases.length - 1 ? (
                        <Button onClick={() => advancePhase(order.id, currentPhase)}>
                          <CheckCircle2 size={14} /> Complete “{currentPhase}”
                        </Button>
                      ) : (
                        <Button onClick={() => openResult(order)}>
                          <CheckCircle2 size={14} /> {live ? "Enter result" : <>Complete final phase &amp; enter result</>}
                        </Button>
                      ))}
                      {order.status === "Awaiting Approval" && (canApprove ? (
                        <>
                          <Button variant="ghost" onClick={() => { setBackFor(order.id); setBackNote(""); }}><Undo2 size={14} /> Send back</Button>
                          <Button variant="soft" onClick={() => setViewId(order.id)}><Eye size={14} /> Review</Button>
                          <Button disabled={busy} onClick={() => act(() => approveLabResult(order.id), () => lab.verify(liveTest(order.id)))}><ShieldCheck size={14} /> Verify &amp; release</Button>
                        </>
                      ) : (
                        <p className="text-xs text-mist-400">Submitted by {order.submittedBy} — awaiting a lab scientist's verification.</p>
                      ))}
                    </div>
                  </Card>
                );
              })}
            </div>
          ) : tab.startsWith("Verified") ? (
            <Table columns={["Patient", "Test", "Result", "Flag", "Verified by", "Communication", ""]} caption="Verified laboratory results">
              {resulted.length === 0 && <EmptyRow colSpan={7}>No results have been verified yet.</EmptyRow>}
              {resulted.map((order, index) => (
                <Row key={order.id} index={index}>
                  <Cell className="font-semibold">{patientName(order.patientId)}</Cell>
                  <Cell><CodedValue concept={labConcept(order.test)} /></Cell>
                  <Cell className={order.flag && order.flag !== "Normal" ? "font-semibold text-action-700" : ""}>{order.result ?? "—"}</Cell>
                  <Cell>
                    {order.flag === "Critical" ? <Badge tone="action">Critical</Badge>
                      : order.flag && order.flag !== "Normal" ? <Badge tone="amber">{order.flag}</Badge>
                      : <Badge tone="mist">Normal</Badge>}
                  </Cell>
                  <Cell className="text-mist-500">
                    {order.approvedBy ?? order.verifiedBy}
                    {order.approvedAt && <span className="block text-[11px] text-mist-400">{shortDate(order.approvedAt)}</span>}
                  </Cell>
                  <Cell>
                    <ClinicalStatusBadge
                      kind="comm"
                      status={order.acknowledgedAt ? "acknowledged" : order.criticalCommunicatedAt ? "communicated" : order.resultViewedAt ? "viewed" : "new"}
                    />
                  </Cell>
                  <Cell>
                    <div className="flex justify-end gap-1.5">
                      {!order.acknowledgedAt && canAcknowledge && (
                        <button disabled={busy} onClick={() => act(() => acknowledgeLabResult(order.id), () => lab.acknowledge(liveTest(order.id)))} className="btn-soft px-2.5 py-1 text-xs">Acknowledge</button>
                      )}
                      <button onClick={() => setViewId(order.id)} className="btn-ghost px-2 py-1 text-xs"><Eye size={13} /></button>
                      <button onClick={() => setPrintPatientId(order.patientId)} className="btn-ghost px-2 py-1 text-xs"><Printer size={13} /></button>
                    </div>
                  </Cell>
                </Row>
              ))}
            </Table>
          ) : (
            <Table columns={["Patient", "Test", "Reason", "Rejected by", "When"]} caption="Rejected specimens">
              {rejected.length === 0 && <EmptyRow colSpan={5}>No specimens have been rejected.</EmptyRow>}
              {rejected.map((order, index) => (
                <Row key={order.id} index={index}>
                  <Cell className="font-semibold">{patientName(order.patientId)}</Cell>
                  <Cell>{order.test}</Cell>
                  <Cell className="text-action-700">{order.rejectedReason}</Cell>
                  <Cell className="text-mist-500">{order.rejectedBy}</Cell>
                  <Cell className="text-mist-400">{order.rejectedAt ? dateTime(order.rejectedAt) : "—"}</Cell>
                </Row>
              ))}
            </Table>
          )
        }
      </Tabs>

      <Modal
        open={Boolean(collectFor)}
        onClose={() => setCollectFor(null)}
        title="Collect sample"
        footer={<><Button variant="ghost" onClick={() => setCollectFor(null)}>Cancel</Button>
          <Button disabled={busy} onClick={() => { if (collectFor) void act(() => collectSample(collectFor, sampleType), () => lab.collect(liveTest(collectFor), sampleType), () => setCollectFor(null)); }}>Confirm collection</Button></>}
      >
        <div className="space-y-4">
          <Field label="Sample type"><Select value={sampleType} onChange={(event) => setSampleType(event.target.value)} options={live && collectFor ? Array.from(new Set([liveTest(collectFor).category, ...SAMPLE_TYPES])) : SAMPLE_TYPES} /></Field>
          <p className="rounded-xl bg-mist-50 px-3 py-2 text-xs text-mist-500">
            Recorded as collected by <b className="text-mist-700">{live ? "you (signed-in user)" : user.name}</b>{live ? "" : " (signed-in user)"} — this starts the turnaround clock.
            {live && collectFor && ` One specimen covers every test on this order; it is given an accession number.`}
          </p>
        </div>
      </Modal>

      <Modal
        open={Boolean(rejectId)}
        onClose={() => setRejectId(null)}
        title="Reject specimen"
        footer={<><Button variant="ghost" onClick={() => setRejectId(null)}>Cancel</Button>
          <Button variant="action" disabled={busy} onClick={() => { if (rejectId) void act(() => rejectSpecimen(rejectId, rejectReason), () => lab.reject(liveTest(rejectId), rejectReason), () => setRejectId(null)); }}>Reject specimen</Button></>}
      >
        <div className="space-y-3">
          <Field label="Rejection reason"><Select value={rejectReason} onChange={(event) => setRejectReason(event.target.value)} options={REJECT_REASONS} /></Field>
          <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700">The ordering clinician should be asked to re-collect. A rejected specimen is a closed order.</p>
        </div>
      </Modal>

      <Modal
        open={Boolean(resultFor)}
        onClose={() => setResultFor(null)}
        title={`Enter result — ${resultOrder?.test ?? ""}`}
        wide
        footer={<><Button variant="ghost" onClick={() => setResultFor(null)}>Cancel</Button>
          <Button disabled={busy} onClick={() => {
            if (!resultFor || !resultOrder) return;
            const config = configFor(resultOrder.test);
            void act(
              () => submitLabResult(resultFor, fields, flag, config.phases[config.phases.length - 1]),
              () => lab.enterResults(liveTest(resultFor), fields),
              () => setResultFor(null),
              true,
            );
          }}>Submit for verification</Button></>}
      >
        {resultOrder && (
          <div className="space-y-4">
            {live && actionError && (
              <p role="alert" className="rounded-xl bg-action-50 px-4 py-3 text-sm font-medium text-action-800 ring-1 ring-action-200">{actionError}</p>
            )}
            <Grid cols={2}>
              {live
                ? liveTest(resultOrder.id).analytes.map((analyte) => {
                  const range = referenceText(analyteRange(analyte, liveTest(resultOrder.id).patient.sex));
                  return (
                    <Field key={analyte.code} label={analyte.unit ? `${analyte.name} (${analyte.unit})` : analyte.name} hint={range ? `Reference: ${range}` : undefined}>
                      {analyte.kind === "CHOICE"
                        ? <Select value={fields[analyte.code] ?? ""} onChange={(event) => setFields({ ...fields, [analyte.code]: event.target.value })} options={["", ...(analyte.options ?? [])]} />
                        : <Input value={fields[analyte.code] ?? ""} inputMode={analyte.kind === "NUMERIC" ? "decimal" : undefined} onChange={(event) => setFields({ ...fields, [analyte.code]: event.target.value })} />}
                    </Field>
                  );
                })
                : configFor(resultOrder.test).resultTemplate.map((templateField) => (
                  <Field key={templateField.id} label={templateField.unit ? `${templateField.label} (${templateField.unit})` : templateField.label} hint={templateField.refRange ? `Reference: ${templateField.refRange}` : undefined}>
                    <Input value={fields[templateField.label] ?? ""} onChange={(event) => setFields({ ...fields, [templateField.label]: event.target.value })} />
                  </Field>
                ))}
            </Grid>
            {live ? (
              <p className="rounded-xl bg-mist-50 px-3 py-2 text-xs text-mist-500">
                Flags (low, high, critical) are worked out from each test&apos;s reference ranges when the result is submitted — they are not chosen by hand.
              </p>
            ) : (
              <Field label="Overall interpretation" hint="Critical results are surfaced for immediate communication to the ordering clinician.">
                <Select value={flag} onChange={(event) => setFlag(event.target.value as never)} options={["Normal", "Low", "High", "Critical"]} />
              </Field>
            )}
            <p className="rounded-xl bg-mist-50 px-3 py-2 text-xs text-mist-500">
              This is a preliminary result submitted by <b className="text-mist-700">{live ? "you" : user.name}</b>. It is not visible as a verified result until a lab scientist releases it.
            </p>
          </div>
        )}
      </Modal>

      <Modal
        open={Boolean(backFor)}
        onClose={() => setBackFor(null)}
        title="Send back for revision"
        footer={<><Button variant="ghost" onClick={() => setBackFor(null)}>Cancel</Button>
          <Button variant="action" disabled={!backNote.trim() || busy} onClick={() => { if (backFor) void act(() => sendLabResultBack(backFor, backNote.trim()), () => lab.sendBack(liveTest(backFor), backNote.trim()), () => setBackFor(null)); }}>Send back</Button></>}
      >
        <Field label="What needs to be corrected?"><Textarea value={backNote} onChange={(event) => setBackNote(event.target.value)} /></Field>
      </Modal>

      <Modal
        open={Boolean(criticalFor)}
        onClose={() => setCriticalFor(null)}
        title="Communicate critical result"
        footer={<><Button variant="ghost" onClick={() => setCriticalFor(null)}>Cancel</Button>
          <Button disabled={!criticalTo.trim() || busy} onClick={() => { if (criticalFor) void act(() => communicateCriticalResult(criticalFor, criticalTo.trim()), () => lab.communicate(liveTest(criticalFor), criticalTo), () => setCriticalFor(null)); }}>Record communication</Button></>}
      >
        <div className="space-y-3">
          <Field label="Communicated to">
            <Select
              value={criticalTo}
              onChange={(event) => setCriticalTo(event.target.value)}
              options={[{ value: "", label: "Choose clinician…" }, ...clinicians]}
            />
          </Field>
          <p className="rounded-xl bg-mist-50 px-3 py-2 text-xs text-mist-500">
            Records that the abnormal result was passed to the responsible clinician, by {live ? "you" : user.name}, now. The clinician still needs to acknowledge it.
          </p>
        </div>
      </Modal>

      <Modal open={Boolean(viewId)} onClose={() => setViewId(null)} title={`Result — ${viewOrder?.test ?? ""}`} wide footer={<Button onClick={() => setViewId(null)}>Close</Button>}>
        {viewOrder && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <ClinicalStatusBadge kind="result" status={viewOrder.status} />
              {viewOrder.flag && viewOrder.flag !== "Normal" && <Badge tone="action">{viewOrder.flag}</Badge>}
              {viewOrder.acknowledgedAt && <Badge tone="brand">Acknowledged by {viewOrder.acknowledgedBy}</Badge>}
            </div>
            <LabProgress order={viewOrder} phases={phasesFor(viewOrder.test)} />
            <div className="grid gap-2 sm:grid-cols-2">
              {live && liveTest(viewOrder.id).results.map((result) => (
                <div key={result.analyteCode} className="rounded-xl bg-mist-50 px-3 py-2">
                  <p className="text-[10px] font-bold uppercase text-mist-400">{result.analyteName}</p>
                  <p className={`text-sm font-semibold ${result.flag && result.flag !== "NORMAL" ? "text-action-700" : "text-mist-800"}`}>
                    {resultValue(result)}{result.flag && result.flag !== "NORMAL" ? ` · ${result.flag.replace("_", " ").toLowerCase()}` : ""}
                  </p>
                  {referenceText(result) && <p className="text-[10px] text-mist-400">Reference: {referenceText(result)}</p>}
                </div>
              ))}
              {!live && configFor(viewOrder.test).resultTemplate.map((templateField) => (
                <div key={templateField.id} className="rounded-xl bg-mist-50 px-3 py-2">
                  <p className="text-[10px] font-bold uppercase text-mist-400">{templateField.label}{templateField.unit ? ` (${templateField.unit})` : ""}</p>
                  <p className="text-sm font-semibold text-mist-800">{viewOrder.resultFields?.[templateField.label] || "—"}</p>
                  {templateField.refRange && <p className="text-[10px] text-mist-400">Reference: {templateField.refRange}</p>}
                </div>
              ))}
            </div>
            {((viewOrder.phaseLog && viewOrder.phaseLog.length > 0) || (live && viewOrder.sampleCollectedAt)) && (
              <div>
                <p className="mb-1 text-[10px] font-bold uppercase text-mist-400">Chain of custody / phase history</p>
                <ol className="space-y-1">
                  {viewOrder.sampleCollectedAt && (
                    <li className="text-xs text-mist-500">Sample collected ({viewOrder.sampleType}) — {viewOrder.sampleCollectedBy} · {dateTime(viewOrder.sampleCollectedAt)}</li>
                  )}
                  {(viewOrder.phaseLog ?? []).map((entry, index) => (
                    <li key={index} className="text-xs text-mist-500">{entry.name} — {entry.by} · {dateTime(entry.at)}</li>
                  ))}
                  {viewOrder.submittedAt && <li className="text-xs text-mist-500">Result submitted — {viewOrder.submittedBy} · {dateTime(viewOrder.submittedAt)}</li>}
                  {viewOrder.approvedAt && <li className="text-xs text-brand-600">Verified &amp; released — {viewOrder.approvedBy} · {dateTime(viewOrder.approvedAt)}</li>}
                </ol>
              </div>
            )}
          </div>
        )}
      </Modal>

      {printPatientId && patientById(printPatientId) && (
        <LabReportDoc
          patient={patientById(printPatientId)!}
          orders={labOrders.filter((order) => order.patientId === printPatientId && order.status === "Resulted")}
          open
          onClose={() => setPrintPatientId(null)}
        />
      )}
    </div>
  );
}
