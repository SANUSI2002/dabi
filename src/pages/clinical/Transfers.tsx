import { useState } from "react";
import { ArrowLeftRight, Plus, Check, X, FileCheck2, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { PageHeader, Button, Badge, StatCard, statusTone } from "@/components/ui/primitives";
import { Tabs } from "@/components/ui/Tabs";
import { Table, Row, Cell } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select, Textarea, Grid } from "@/components/ui/form";
import { PatientPicker } from "@/components/ui/PatientPicker";
import { PatientLink } from "@/components/ui/PatientLink";
import { useEmr } from "@/store/useEmr";
import { useIdentity } from "@/store/useIdentity";
import { shortDate } from "@/lib/format";
import type { Patient, PatientTransfer } from "@/data/types";
import { useIsLiveEmr } from "@/emr-live/session";
import { describeEmrError } from "@/emr-live/client";
import { newIdempotencyKey, useLiveTransfers, useLiveTransfersLoad, type LiveTransfer } from "@/emr-live/transfers";
import { useListValues } from "@/lib/listOptions";


export default function Transfers() {
  const { transfers: demoTransfers, patients, patientById, addTransfer, completeTransfer, cancelTransfer } = useEmr();
  const live = useIsLiveEmr();
  useLiveTransfersLoad(live);
  const liveTransfers = useLiveTransfers((st) => st.transfers);
  const liveError = useLiveTransfers((st) => st.error);
  const transfers: (PatientTransfer & Partial<LiveTransfer>)[] = live ? liveTransfers : demoTransfers;
  const patientOf = (t: { patientId?: string; patient?: Patient }) => (live ? t.patient : t.patientId ? patientById(t.patientId) : undefined);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [recordKey, setRecordKey] = useState(newIdempotencyKey);
  async function run(work: () => Promise<void> | void, after: () => void = () => {}) {
    setBusy(true); setActionError("");
    try { await work(); after(); }
    catch (cause) { setActionError(describeEmrError(cause)); }
    finally { setBusy(false); }
  }
  const errorLine = live && actionError ? <p role="alert" className="rounded-xl bg-action-50 px-3 py-2 text-sm text-action-700">{actionError}</p> : null;
  const finish = (t: PatientTransfer, action: "complete" | "cancel") => void run(() => {
    if (live) return useLiveTransfers.getState().finish(liveTransfers.find((x) => x.id === t.id)!, action);
    if (action === "complete") completeTransfer(t.id, me); else cancelTransfer(t.id);
  });
  const me = useIdentity((s) => s.user.name);

  const [open, setOpen] = useState(false);
  const reasons = useListValues("transfer-reasons"); // the hospital's Transfer Reasons
  const [f, setF] = useState<{ direction: "In" | "Out"; patientId: string; patientName: string; facility: string; reason: PatientTransfer["reason"]; summary: string }>({
    direction: "Out", patientId: "", patientName: "", facility: "", reason: "Relocation", summary: "",
  });

  const pending = transfers.filter((t) => t.status === "Pending");
  const outstanding = transfers.filter((t) => t.direction === "Out" && t.status !== "Cancelled" && !t.recordsSent);

  const patientLabel = (t: PatientTransfer) =>
    t.patientId ? <PatientLink patient={patientOf(t)} /> : <span className="font-semibold text-mist-800">{t.patientName}</span>;

  const rows = (list: PatientTransfer[]) => (
    <Table columns={["Patient", "Direction", "Other facility", "Reason", "Records", "Date", "Status", ""]}>
      {list.map((t, i) => (
        <Row key={t.id} index={i}>
          <Cell>{patientLabel(t)}</Cell>
          <Cell>
            <Badge tone={t.direction === "Out" ? "action" : "brand"}>
              {t.direction === "Out" ? <ArrowUpRight size={11} /> : <ArrowDownLeft size={11} />} {t.direction}
            </Badge>
          </Cell>
          <Cell>{t.facility}</Cell>
          <Cell className="text-mist-500">{t.reason}</Cell>
          <Cell>{t.recordsSent ? <Badge tone="brand"><FileCheck2 size={11} /> Sent</Badge> : <Badge tone="amber">Outstanding</Badge>}</Cell>
          <Cell className="text-mist-400">{shortDate(t.date)}</Cell>
          <Cell><Badge tone={statusTone(t.status)}>{t.status}</Badge></Cell>
          <Cell>
            {t.status === "Pending" && (
              <div className="flex justify-end gap-1.5">
                <button onClick={() => finish(t, "cancel")} disabled={busy} className="btn-ghost px-2 py-1 text-xs"><X size={12} /> Cancel</button>
                <button onClick={() => finish(t, "complete")} disabled={busy} className="btn-primary px-2.5 py-1 text-xs"><Check size={12} /> Complete</button>
              </div>
            )}
          </Cell>
        </Row>
      ))}
      {list.length === 0 && <Row><Cell className="text-mist-400">Nothing here.</Cell><Cell /><Cell /><Cell /><Cell /><Cell /><Cell /><Cell /></Row>}
    </Table>
  );

  return (
    <div>
      <PageHeader
        title="Patient Transfers"
        subtitle="Facility-to-facility transfers of care (distinct from clinical referrals)"
        actions={<Button onClick={() => { setRecordKey(newIdempotencyKey()); setActionError(""); setF({ direction: "Out", patientId: "", patientName: "", facility: "", reason: "Relocation", summary: "" }); setOpen(true); }}><Plus size={15} /> New transfer</Button>}
      />

      {live && liveError && <p role="alert" className="mb-4 rounded-xl bg-action-50 px-3 py-2 text-sm text-action-700">{liveError}</p>}
      {!open && errorLine && <div className="mb-4">{errorLine}</div>}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Transfers" value={transfers.length} tone="brand" icon={<ArrowLeftRight size={18} />} />
        <StatCard label="Pending" value={pending.length} tone={pending.length ? "amber" : "mist"} delay={0.05} />
        <StatCard label="Transferred in" value={transfers.filter((t) => t.direction === "In").length} tone="brand" delay={0.1} />
        <StatCard label="Records outstanding" value={outstanding.length} tone={outstanding.length ? "action" : "brand"} delay={0.15} />
      </div>

      <Tabs tabs={["Pending", "Transferred Out", "Transferred In", "All"]}>
        {(t) =>
          t === "Pending" ? rows(pending)
          : t === "Transferred Out" ? rows(transfers.filter((x) => x.direction === "Out"))
          : t === "Transferred In" ? rows(transfers.filter((x) => x.direction === "In"))
          : rows(transfers)
        }
      </Tabs>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="New patient transfer"
        wide
        footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            disabled={!f.facility.trim() || (f.direction === "Out" ? !f.patientId : !f.patientName.trim()) || busy}
            onClick={() => {
              if (live) { void run(() => useLiveTransfers.getState().record(f, recordKey), () => setOpen(false)); return; }
              const patientName = f.direction === "Out"
                ? (() => { const p = patientById(f.patientId); return p ? `${p.firstName} ${p.lastName}` : ""; })()
                : f.patientName.trim();
              addTransfer({
                direction: f.direction,
                patientId: f.direction === "Out" ? f.patientId : undefined,
                patientName,
                facility: f.facility.trim(),
                reason: f.reason,
                summary: f.summary.trim() || undefined,
                date: new Date().toISOString(),
                recordsSent: f.direction === "In",
              });
              setOpen(false);
            }}
          >{busy ? "Saving…" : "Initiate transfer"}</Button></>}
      >
        <div className="space-y-4">
          {errorLine}
          <Grid cols={2}>
            <Field label="Direction">
              <Select value={f.direction} onChange={(e) => setF({ ...f, direction: e.target.value as "In" | "Out" })} options={["Out", "In"]} />
            </Field>
            <Field label="Reason">
              <Select value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value as PatientTransfer["reason"] })} options={reasons} />
            </Field>
          </Grid>
          {f.direction === "Out" ? (
            <Field label="Patient"><PatientPicker value={f.patientId} onChange={(id) => setF({ ...f, patientId: id })} /></Field>
          ) : (
            <Field label="Patient name (as received)"><Input value={f.patientName} onChange={(e) => setF({ ...f, patientName: e.target.value })} /></Field>
          )}
          <Field label={f.direction === "Out" ? "Receiving facility" : "Sending facility"}>
            <Input value={f.facility} onChange={(e) => setF({ ...f, facility: e.target.value })} placeholder="e.g. PHC Kirikiri" />
          </Field>
          <Field label="Handover summary">
            <Textarea value={f.summary} onChange={(e) => setF({ ...f, summary: e.target.value })} placeholder="Active problems, current medication, outstanding follow-up" />
          </Field>
          <p className="rounded-xl bg-mist-50 px-3 py-2 text-xs text-mist-500">
            {f.direction === "Out"
              ? live
                ? "Completing the transfer records that you handed the records to the receiving facility; nothing is sent electronically. It is written to the audit log."
                : "Completing the transfer marks the EMR summary as transmitted to the receiving facility and is written to the audit log."
              : "Inbound transfers are recorded here; register the patient locally from Registration to open a chart."}
          </p>
        </div>
      </Modal>

      <p className="mt-4 text-center text-[11px] text-mist-300">{patients.length} patients on register · transfers feed the NHMIS catchment-movement return</p>
    </div>
  );
}
