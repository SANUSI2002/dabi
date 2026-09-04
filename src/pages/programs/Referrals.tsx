import { useState } from "react";
import { Share2, Plus, CheckCircle2, MailCheck, CornerDownLeft } from "lucide-react";
import { PageHeader, Button, Badge, StatCard, statusTone } from "@/components/ui/primitives";
import { Tabs } from "@/components/ui/Tabs";
import { Table, Row, Cell } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select, Grid, Checkbox } from "@/components/ui/form";
import { PatientPicker } from "@/components/ui/PatientPicker";
import { PatientLink } from "@/components/ui/PatientLink";
import { useEmr } from "@/store/useEmr";
import { OUT_REFERRAL_REASONS } from "@/data/catalog";
import { shortDate, timeAgo } from "@/lib/format";
import type { ReferralFeedback } from "@/data/types";

const OUTCOMES: ReferralFeedback["outcome"][] = [
  "Admitted & managed",
  "Treated & discharged",
  "Investigations done",
  "Patient did not attend",
  "Referred onward",
];

export default function Referrals() {
  const { referrals, patientById, addReferral, setReferralStatus, recordReferralFeedback } = useEmr();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ patientId: "", type: "Out" as const, diagnosis: "", facility: "", reason: OUT_REFERRAL_REASONS[6].reason, urgency: "Routine" as const });

  const [fbFor, setFbFor] = useState<string | null>(null);
  const [fb, setFb] = useState<{ outcome: ReferralFeedback["outcome"]; note: string; by: string; backReferral: boolean }>({
    outcome: "Treated & discharged", note: "", by: "", backReferral: false,
  });

  const out = referrals.filter((r) => r.type === "Out");
  const awaitingFeedback = out.filter((r) => r.status === "Open" || r.status === "Acknowledged");
  const closed = out.filter((r) => r.status === "Completed" || r.status === "Declined");
  const loopRate = out.length ? Math.round((closed.length / out.length) * 100) : 0;

  return (
    <div>
      <PageHeader
        title="Referrals"
        subtitle={`${awaitingFeedback.length} out-referrals awaiting feedback · ${loopRate}% loop closed`}
        actions={<Button onClick={() => setOpen(true)}><Plus size={15} /> New Referral</Button>}
      />
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total Referrals" value={referrals.length} tone="brand" icon={<Share2 size={18} />} />
        <StatCard label="Awaiting feedback" value={awaitingFeedback.length} tone={awaitingFeedback.length ? "amber" : "mist"} delay={0.05} />
        <StatCard label="Loop closed" value={`${loopRate}%`} tone="brand" delay={0.1} icon={<CheckCircle2 size={18} />} />
        <StatCard label="Emergency" value={referrals.filter((r) => r.urgency === "Emergency").length} tone="action" delay={0.15} />
      </div>

      <Tabs tabs={["All Referrals", "Back-Referrals In", "NHMIS Out-Referral Reasons"]}>
        {(t) =>
          t === "All Referrals" ? (
            <Table columns={["Patient", "Type", "Diagnosis", "Facility / Unit", "Sent", "Urgency", "Status", ""]}>
              {referrals.map((r, i) => {
                const p = patientById(r.patientId);
                return (
                  <Row key={r.id} index={i}>
                    <Cell><PatientLink patient={p} /></Cell>
                    <Cell><Badge tone={r.type === "Out" ? "action" : "brand"}>{r.type}</Badge></Cell>
                    <Cell>
                      {r.diagnosis}
                      {r.feedback && (
                        <span className="mt-0.5 block text-[11px] text-brand-600">
                          ↩ {r.feedback.outcome} — {r.feedback.by} · {timeAgo(r.feedback.at)}
                        </span>
                      )}
                    </Cell>
                    <Cell>{r.facility}</Cell>
                    <Cell className="text-mist-400">{shortDate(r.date)}</Cell>
                    <Cell><Badge tone={r.urgency === "Routine" ? "mist" : "action"}>{r.urgency}</Badge></Cell>
                    <Cell><Badge tone={statusTone(r.status)}>{r.status}</Badge></Cell>
                    <Cell>
                      {r.type === "Out" && (
                        <div className="flex justify-end gap-1.5">
                          {r.status === "Open" && (
                            <button onClick={() => setReferralStatus(r.id, "Acknowledged")} className="btn-ghost px-2 py-1 text-xs">
                              <MailCheck size={12} /> Mark acknowledged
                            </button>
                          )}
                          {(r.status === "Open" || r.status === "Acknowledged") && (
                            <button
                              onClick={() => { setFbFor(r.id); setFb({ outcome: "Treated & discharged", note: "", by: "", backReferral: false }); }}
                              className="btn-primary px-2.5 py-1 text-xs"
                            >
                              <CornerDownLeft size={12} /> Record feedback
                            </button>
                          )}
                        </div>
                      )}
                    </Cell>
                  </Row>
                );
              })}
            </Table>
          ) : t === "Back-Referrals In" ? (
            <Table columns={["Patient", "From facility", "For", "Received", "Status"]}>
              {referrals.filter((r) => r.type === "In").map((r, i) => {
                const p = patientById(r.patientId);
                return (
                  <Row key={r.id} index={i}>
                    <Cell><PatientLink patient={p} /></Cell>
                    <Cell>{r.facility}</Cell>
                    <Cell className="text-mist-500">{r.diagnosis}</Cell>
                    <Cell className="text-mist-400">{shortDate(r.date)}</Cell>
                    <Cell><Badge tone={statusTone(r.status)}>{r.status}</Badge></Cell>
                  </Row>
                );
              })}
              {referrals.filter((r) => r.type === "In").length === 0 && (
                <Row><Cell className="text-mist-400">No inbound referrals.</Cell><Cell /><Cell /><Cell /><Cell /></Row>
              )}
            </Table>
          ) : (
            <Table columns={["NHMIS Code", "Reason", "Count"]}>
              {OUT_REFERRAL_REASONS.map((r, i) => (
                <Row key={r.code} index={i}>
                  <Cell className="font-mono text-xs">{r.code}</Cell>
                  <Cell>{r.reason}</Cell>
                  <Cell>{referrals.filter((x) => x.reason === r.reason).length}</Cell>
                </Row>
              ))}
            </Table>
          )
        }
      </Tabs>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="New Referral"
        footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button disabled={!f.patientId || !f.facility} onClick={() => { addReferral(f as never); setOpen(false); }}>Create Referral</Button></>}
      >
        <div className="space-y-4">
          <Field label="Patient"><PatientPicker value={f.patientId} onChange={(id) => setF({ ...f, patientId: id })} /></Field>
          <Grid cols={2}>
            <Field label="Type"><Select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as never })} options={["Out", "In", "Internal"]} /></Field>
            <Field label="Urgency"><Select value={f.urgency} onChange={(e) => setF({ ...f, urgency: e.target.value as never })} options={["Routine", "Urgent", "Emergency"]} /></Field>
          </Grid>
          <Field label="Receiving facility / unit"><Input value={f.facility} onChange={(e) => setF({ ...f, facility: e.target.value })} /></Field>
          <Field label="Working diagnosis"><Input value={f.diagnosis} onChange={(e) => setF({ ...f, diagnosis: e.target.value })} /></Field>
          <Field label="Reason (NHMIS)"><Select value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} options={OUT_REFERRAL_REASONS.map((r) => r.reason)} /></Field>
        </div>
      </Modal>

      <Modal
        open={!!fbFor}
        onClose={() => setFbFor(null)}
        title="Record referral feedback"
        footer={<><Button variant="ghost" onClick={() => setFbFor(null)}>Cancel</Button>
          <Button
            disabled={!fb.by.trim() || !fb.note.trim()}
            onClick={() => { if (fbFor) recordReferralFeedback(fbFor, fb); setFbFor(null); }}
          ><CheckCircle2 size={14} /> Save & close loop</Button></>}
      >
        {(() => {
          const r = fbFor ? referrals.find((x) => x.id === fbFor) : undefined;
          const p = r ? patientById(r.patientId) : undefined;
          return (
            <div className="space-y-4">
              {r && (
                <div className="rounded-xl bg-mist-50 px-3 py-2 text-sm text-mist-600">
                  <b>{p ? `${p.firstName} ${p.lastName}` : "—"}</b> → {r.facility} · {r.diagnosis} · sent {shortDate(r.date)}
                </div>
              )}
              <Grid cols={2}>
                <Field label="Outcome">
                  <Select value={fb.outcome} onChange={(e) => setFb({ ...fb, outcome: e.target.value as ReferralFeedback["outcome"] })} options={OUTCOMES} />
                </Field>
                <Field label="Receiving clinician"><Input value={fb.by} onChange={(e) => setFb({ ...fb, by: e.target.value })} placeholder="e.g. Dr. Bello (O&G)" /></Field>
              </Grid>
              <Field label="Feedback / management summary">
                <Input value={fb.note} onChange={(e) => setFb({ ...fb, note: e.target.value })} placeholder="What was done, current status, follow-up plan" />
              </Field>
              <Checkbox
                label="Patient sent back for continued care (opens an inbound referral)"
                checked={fb.backReferral}
                onChange={(e) => setFb({ ...fb, backReferral: e.target.checked })}
              />
              <p className="rounded-xl bg-mist-50 px-3 py-2 text-xs text-mist-500">
                Saving marks the referral <b>Completed</b>, attaches the feedback to the patient record and audit log, and —
                if ticked — creates a back-referral in the “Back-Referrals In” tab.
              </p>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}
