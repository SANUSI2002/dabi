import { useMemo, useState } from "react";
import { Share2, Plus, CheckCircle2, CornerDownLeft, CalendarClock, Ban } from "lucide-react";
import { PageHeader, Button, Badge, StatCard, SectionNote } from "@/components/ui/primitives";
import { Tabs } from "@/components/ui/Tabs";
import { Table, Row, Cell, EmptyRow } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select, Grid, Checkbox, Textarea } from "@/components/ui/form";
import { PatientPicker } from "@/components/ui/PatientPicker";
import { PatientLink } from "@/components/ui/PatientLink";
import { ClinicalStatusBadge } from "@/components/clinical/ClinicalStatusBadge";
import { useEmr, referralStatus, referralOverdue } from "@/store/useEmr";
import { useHr } from "@/store/useHr";
import { OUT_REFERRAL_REASONS } from "@/data/catalog";
import { shortDate, timeAgo } from "@/lib/format";
import type { Referral, ReferralFeedback } from "@/data/types";

const OUTCOMES: ReferralFeedback["outcome"][] = [
  "Admitted & managed", "Treated & discharged", "Investigations done", "Patient did not attend", "Referred onward",
];
const INTERNAL_UNITS = ["NCD clinic", "Antenatal clinic", "Family planning", "Nutrition (CMAM)", "Immunization", "Laboratory", "Pharmacy review", "Counselling / mental health"];

export default function Referrals() {
  const emr = useEmr();
  const { referrals, patientById, labOrders, addReferral, acceptReferral, declineReferral, scheduleReferral, markReferralAttended, cancelReferral, recordReferralFeedback } = emr;
  const clinicians = useHr((state) => state.staff).filter((staff) => staff.status === "Active" && staff.role === "Medical Officer");

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ patientId: "", type: "Out" as Referral["type"], diagnosis: "", facility: "", reason: OUT_REFERRAL_REASONS[6].reason, urgency: "Routine" as Referral["urgency"], clinicalSummary: "", attachedResultIds: [] as string[] });

  const [feedbackFor, setFeedbackFor] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ outcome: ReferralFeedback["outcome"]; note: string; by: string; backReferral: boolean }>({ outcome: "Treated & discharged", note: "", by: "", backReferral: false });
  const [declineFor, setDeclineFor] = useState<string | null>(null);
  const [declineReason, setDeclineReason] = useState("");
  const [scheduleFor, setScheduleFor] = useState<string | null>(null);
  const [scheduleDate, setScheduleDate] = useState("");

  const external = referrals.filter((referral) => referral.type === "Out");
  const internal = referrals.filter((referral) => referral.type === "Internal");
  const inbound = referrals.filter((referral) => referral.type === "In");
  const openExternal = external.filter((referral) => !["Completed", "Declined", "Cancelled"].includes(referralStatus(referral.status)));
  const overdue = referrals.filter(referralOverdue);
  const loopRate = external.length ? Math.round((external.filter((referral) => referralStatus(referral.status) === "Completed").length / external.length) * 100) : 0;

  const formPatientResults = useMemo(
    () => (form.patientId ? labOrders.filter((order) => order.patientId === form.patientId && order.status === "Resulted") : []),
    [form.patientId, labOrders],
  );

  function nextActions(referral: Referral) {
    const status = referralStatus(referral.status);
    const buttons: { label: string; icon?: React.ReactNode; onClick: () => void; primary?: boolean }[] = [];
    if (referral.type !== "In") {
      if (status === "Requested") {
        buttons.push({ label: "Accept", onClick: () => acceptReferral(referral.id), primary: true });
        buttons.push({ label: "Decline", onClick: () => { setDeclineReason(""); setDeclineFor(referral.id); } });
      }
      if (status === "Accepted") {
        buttons.push({ label: "Schedule appointment", icon: <CalendarClock size={12} />, onClick: () => { setScheduleDate(""); setScheduleFor(referral.id); } });
      }
      if (status === "Scheduled") {
        buttons.push({ label: "Mark attended", onClick: () => markReferralAttended(referral.id) });
      }
      if (["Accepted", "Scheduled", "Attended", "Requested"].includes(status)) {
        buttons.push({ label: "Record outcome", icon: <CornerDownLeft size={12} />, onClick: () => { setFeedbackFor(referral.id); setFeedback({ outcome: "Treated & discharged", note: "", by: referral.receivingClinician ?? "", backReferral: false }); }, primary: status === "Attended" });
      }
      if (["Requested", "Accepted", "Scheduled"].includes(status)) {
        buttons.push({ label: "Cancel", icon: <Ban size={12} />, onClick: () => cancelReferral(referral.id) });
      }
    }
    return buttons;
  }

  const renderList = (list: Referral[], internalView: boolean) => (
    <Table columns={["Patient", internalView ? "Unit" : "Facility", "Reason for referral", "Urgency", "Requested", "Status", "Actions"]} caption={internalView ? "Internal referrals" : "External referrals"}>
      {list.length === 0 && <EmptyRow colSpan={7}>{internalView ? "No internal referrals." : "No external referrals."}</EmptyRow>}
      {list.map((referral, index) => {
        const patient = patientById(referral.patientId);
        const status = referralStatus(referral.status);
        return (
          <Row key={referral.id} index={index}>
            <Cell><PatientLink patient={patient} /></Cell>
            <Cell>{referral.facility}</Cell>
            <Cell>
              {referral.diagnosis}
              <span className="block text-[11px] text-mist-400">{referral.reason}</span>
              {referral.appointmentDate && status === "Scheduled" && <span className="block text-[11px] text-brand-600">Appointment {shortDate(referral.appointmentDate)}</span>}
              {referral.declineReason && <span className="block text-[11px] text-action-600">Declined: {referral.declineReason}</span>}
              {referral.feedback && <span className="block text-[11px] text-brand-600">↩ {referral.feedback.outcome} — {referral.feedback.by} · {timeAgo(referral.feedback.at)}</span>}
            </Cell>
            <Cell><Badge tone={referral.urgency === "Routine" ? "mist" : "action"}>{referral.urgency}</Badge></Cell>
            <Cell className="text-mist-400">
              {shortDate(referral.date)}
              {referral.referredBy && <span className="block text-[11px]">{referral.referredBy}</span>}
            </Cell>
            <Cell>
              <ClinicalStatusBadge kind="referral" status={status.toLowerCase()} />
              {referralOverdue(referral) && <Badge tone="action">Overdue</Badge>}
            </Cell>
            <Cell>
              <div className="flex flex-wrap justify-end gap-1">
                {nextActions(referral).map((action) => (
                  <button key={action.label} onClick={action.onClick} className={`${action.primary ? "btn-primary" : "btn-ghost"} px-2 py-1 text-xs`}>
                    {action.icon}{action.label}
                  </button>
                ))}
              </div>
            </Cell>
          </Row>
        );
      })}
    </Table>
  );

  return (
    <div>
      <PageHeader
        title="Referrals"
        subtitle={`${openExternal.length} external referrals open · ${loopRate}% loop closed · ${overdue.length} overdue`}
        actions={<Button onClick={() => { setForm({ patientId: "", type: "Out", diagnosis: "", facility: "", reason: OUT_REFERRAL_REASONS[6].reason, urgency: "Routine", clinicalSummary: "", attachedResultIds: [] }); setCreateOpen(true); }}><Plus size={15} /> New referral</Button>}
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="All referrals" value={referrals.length} tone="brand" icon={<Share2 size={18} />} />
        <StatCard label="External open" value={openExternal.length} tone={openExternal.length ? "amber" : "mist"} delay={0.05} />
        <StatCard label="Loop closed" value={`${loopRate}%`} tone="brand" delay={0.1} icon={<CheckCircle2 size={18} />} />
        <StatCard label="Overdue" value={overdue.length} tone={overdue.length ? "action" : "mist"} delay={0.15} />
      </div>

      {overdue.length > 0 && (
        <div className="mb-5 rounded-2xl border border-action-200 bg-action-50/50 p-3 text-sm">
          <p className="font-semibold text-action-700">Referrals overdue a response</p>
          <ul className="mt-1 space-y-0.5 text-mist-600">
            {overdue.slice(0, 6).map((referral) => {
              const patient = patientById(referral.patientId);
              return <li key={referral.id}>{patient ? `${patient.firstName} ${patient.lastName}` : "—"} → {referral.facility} · {referral.urgency} · sent {shortDate(referral.date)}</li>;
            })}
          </ul>
        </div>
      )}

      <Tabs tabs={["External referrals", "Internal referrals", "Inbound / back-referrals", "Reasons (NHMIS)"]} label="Referrals">
        {(tab) =>
          tab === "External referrals" ? (
            <div className="space-y-2">
              <SectionNote>External referrals send the patient to another organisation. Track acceptance, appointment and the outcome that comes back.</SectionNote>
              {renderList(external, false)}
            </div>
          ) : tab === "Internal referrals" ? (
            <div className="space-y-2">
              <SectionNote>Internal referrals move the patient to another unit or clinic within this facility. The patient stays on this record.</SectionNote>
              {renderList(internal, true)}
            </div>
          ) : tab === "Inbound / back-referrals" ? (
            <Table columns={["Patient", "From", "For", "Received", "Status"]} caption="Inbound and back-referrals">
              {inbound.length === 0 && <EmptyRow colSpan={5}>No inbound referrals.</EmptyRow>}
              {inbound.map((referral, index) => (
                <Row key={referral.id} index={index}>
                  <Cell><PatientLink patient={patientById(referral.patientId)} /></Cell>
                  <Cell>{referral.facility}</Cell>
                  <Cell className="text-mist-500">{referral.diagnosis} · {referral.reason}</Cell>
                  <Cell className="text-mist-400">{shortDate(referral.date)}</Cell>
                  <Cell><ClinicalStatusBadge kind="referral" status={referralStatus(referral.status).toLowerCase()} /></Cell>
                </Row>
              ))}
            </Table>
          ) : (
            <Table columns={["NHMIS code", "Reason", "Referrals"]} caption="NHMIS out-referral reasons">
              {OUT_REFERRAL_REASONS.map((reasonRow, index) => (
                <Row key={reasonRow.code} index={index}>
                  <Cell className="font-mono text-xs">{reasonRow.code}</Cell>
                  <Cell>{reasonRow.reason}</Cell>
                  <Cell>{referrals.filter((referral) => referral.reason === reasonRow.reason).length}</Cell>
                </Row>
              ))}
            </Table>
          )
        }
      </Tabs>

      {/* Create referral */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New referral"
        wide
        footer={<><Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button
            disabled={!form.patientId || !form.facility.trim() || !form.diagnosis.trim()}
            onClick={() => {
              addReferral({
                patientId: form.patientId,
                type: form.type,
                diagnosis: form.diagnosis.trim(),
                facility: form.facility.trim(),
                reason: form.reason,
                urgency: form.urgency,
                clinicalSummary: form.clinicalSummary.trim() || undefined,
                attachedResultIds: form.attachedResultIds.length ? form.attachedResultIds : undefined,
              });
              setCreateOpen(false);
            }}
          >
            Send referral
          </Button></>}
      >
        <div className="space-y-4">
          <Field label="Patient"><PatientPicker value={form.patientId} onChange={(id) => setForm({ ...form, patientId: id, attachedResultIds: [] })} /></Field>
          <Grid cols={3}>
            <Field label="Referral type">
              <Select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as Referral["type"], facility: "" })} options={[{ value: "Out", label: "External — another facility" }, { value: "Internal", label: "Internal — a unit here" }]} />
            </Field>
            <Field label={form.type === "Internal" ? "Receiving unit" : "Receiving facility"}>
              {form.type === "Internal" ? (
                <Select value={form.facility} onChange={(event) => setForm({ ...form, facility: event.target.value })} options={[{ value: "", label: "Choose a unit…" }, ...INTERNAL_UNITS]} />
              ) : (
                <Input value={form.facility} onChange={(event) => setForm({ ...form, facility: event.target.value })} placeholder="e.g. General Hospital, Amuwo" />
              )}
            </Field>
            <Field label="Urgency"><Select value={form.urgency} onChange={(event) => setForm({ ...form, urgency: event.target.value as Referral["urgency"] })} options={["Routine", "Urgent", "Emergency"]} /></Field>
          </Grid>
          <Grid cols={2}>
            <Field label="Working diagnosis"><Input value={form.diagnosis} onChange={(event) => setForm({ ...form, diagnosis: event.target.value })} /></Field>
            <Field label="Reason (NHMIS)"><Select value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} options={OUT_REFERRAL_REASONS.map((reasonRow) => reasonRow.reason)} /></Field>
          </Grid>
          <Field label="Clinical summary" hint="History, examination, treatment given, current status — sent with the referral.">
            <Textarea value={form.clinicalSummary} onChange={(event) => setForm({ ...form, clinicalSummary: event.target.value })} className="min-h-[90px]" />
          </Field>
          <div>
            <p className="label mb-1.5">Attach verified results</p>
            {!form.patientId ? (
              <SectionNote>Select a patient to attach their results.</SectionNote>
            ) : formPatientResults.length === 0 ? (
              <SectionNote>This patient has no verified laboratory results to attach.</SectionNote>
            ) : (
              <div className="space-y-1">
                {formPatientResults.map((order) => (
                  <label key={order.id} className="flex items-center gap-2 text-sm text-mist-600">
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5 rounded border-mist-300 text-brand-600"
                      checked={form.attachedResultIds.includes(order.id)}
                      onChange={(event) => setForm({ ...form, attachedResultIds: event.target.checked ? [...form.attachedResultIds, order.id] : form.attachedResultIds.filter((entry) => entry !== order.id) })}
                    />
                    {order.test}: {order.result ?? "—"}{order.flag && order.flag !== "Normal" ? ` (${order.flag})` : ""}
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* Decline */}
      <Modal
        open={Boolean(declineFor)}
        onClose={() => setDeclineFor(null)}
        title="Decline referral"
        footer={<><Button variant="ghost" onClick={() => setDeclineFor(null)}>Cancel</Button>
          <Button variant="action" disabled={!declineReason.trim()} onClick={() => { if (declineFor) declineReferral(declineFor, declineReason.trim()); setDeclineFor(null); }}>Decline</Button></>}
      >
        <Field label="Reason for declining"><Textarea value={declineReason} onChange={(event) => setDeclineReason(event.target.value)} placeholder="e.g. Not the appropriate service, missing information, capacity" /></Field>
      </Modal>

      {/* Schedule */}
      <Modal
        open={Boolean(scheduleFor)}
        onClose={() => setScheduleFor(null)}
        title="Schedule referral appointment"
        footer={<><Button variant="ghost" onClick={() => setScheduleFor(null)}>Cancel</Button>
          <Button disabled={!scheduleDate} onClick={() => { if (scheduleFor) scheduleReferral(scheduleFor, new Date(scheduleDate).toISOString()); setScheduleFor(null); }}>Schedule</Button></>}
      >
        <Field label="Appointment date"><Input type="date" value={scheduleDate} onChange={(event) => setScheduleDate(event.target.value)} /></Field>
      </Modal>

      {/* Record outcome */}
      <Modal
        open={Boolean(feedbackFor)}
        onClose={() => setFeedbackFor(null)}
        title="Record referral outcome"
        footer={<><Button variant="ghost" onClick={() => setFeedbackFor(null)}>Cancel</Button>
          <Button disabled={!feedback.by.trim() || !feedback.note.trim()} onClick={() => { if (feedbackFor) recordReferralFeedback(feedbackFor, feedback); setFeedbackFor(null); }}>
            <CheckCircle2 size={14} /> Save &amp; close the loop
          </Button></>}
      >
        {(() => {
          const referral = feedbackFor ? referrals.find((entry) => entry.id === feedbackFor) : undefined;
          const patient = referral ? patientById(referral.patientId) : undefined;
          return (
            <div className="space-y-4">
              {referral && (
                <div className="rounded-xl bg-mist-50 px-3 py-2 text-sm text-mist-600">
                  <b>{patient ? `${patient.firstName} ${patient.lastName}` : "—"}</b> → {referral.facility} · {referral.diagnosis} · sent {shortDate(referral.date)}
                </div>
              )}
              <Grid cols={2}>
                <Field label="Outcome"><Select value={feedback.outcome} onChange={(event) => setFeedback({ ...feedback, outcome: event.target.value as ReferralFeedback["outcome"] })} options={OUTCOMES} /></Field>
                <Field label="Receiving clinician">
                  <Input list="referral-clinicians" value={feedback.by} onChange={(event) => setFeedback({ ...feedback, by: event.target.value })} placeholder="e.g. Dr. Bello (O&G)" />
                  <datalist id="referral-clinicians">{clinicians.map((clinician) => <option key={clinician.id} value={clinician.name} />)}</datalist>
                </Field>
              </Grid>
              <Field label="Management summary from the receiving service"><Textarea value={feedback.note} onChange={(event) => setFeedback({ ...feedback, note: event.target.value })} className="min-h-[80px]" /></Field>
              <Checkbox label="Patient sent back for continued care (opens an inbound referral)" checked={feedback.backReferral} onChange={(event) => setFeedback({ ...feedback, backReferral: event.target.checked })} />
              <p className="rounded-xl bg-mist-50 px-3 py-2 text-xs text-mist-500">
                Saving marks the referral <b>Completed</b> and attaches the outcome to the patient timeline and audit log.
              </p>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}
