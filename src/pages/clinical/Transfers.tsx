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
import type { PatientTransfer } from "@/data/types";

const REASONS: PatientTransfer["reason"][] = [
  "Relocation", "Catchment reassignment", "Service not available here", "Patient request", "Higher level of care",
];

export default function Transfers() {
  const { transfers, patients, patientById, addTransfer, completeTransfer, cancelTransfer } = useEmr();
  const me = useIdentity((s) => s.user.name);

  const [open, setOpen] = useState(false);
  const [f, setF] = useState<{ direction: "In" | "Out"; patientId: string; patientName: string; facility: string; reason: PatientTransfer["reason"]; summary: string }>({
    direction: "Out", patientId: "", patientName: "", facility: "", reason: "Relocation", summary: "",
  });

  const pending = transfers.filter((t) => t.status === "Pending");
  const outstanding = transfers.filter((t) => t.direction === "Out" && t.status !== "Cancelled" && !t.recordsSent);

  const patientLabel = (t: PatientTransfer) =>
    t.patientId ? <PatientLink patient={patientById(t.patientId)} /> : <span className="font-semibold text-mist-800">{t.patientName}</span>;

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
                <button onClick={() => cancelTransfer(t.id)} className="btn-ghost px-2 py-1 text-xs"><X size={12} /> Cancel</button>
                <button onClick={() => completeTransfer(t.id, me)} className="btn-primary px-2.5 py-1 text-xs"><Check size={12} /> Complete</button>
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
        actions={<Button onClick={() => { setF({ direction: "Out", patientId: "", patientName: "", facility: "", reason: "Relocation", summary: "" }); setOpen(true); }}><Plus size={15} /> New transfer</Button>}
      />

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
            disabled={!f.facility.trim() || (f.direction === "Out" ? !f.patientId : !f.patientName.trim())}
            onClick={() => {
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
          >Initiate transfer</Button></>}
      >
        <div className="space-y-4">
          <Grid cols={2}>
            <Field label="Direction">
              <Select value={f.direction} onChange={(e) => setF({ ...f, direction: e.target.value as "In" | "Out" })} options={["Out", "In"]} />
            </Field>
            <Field label="Reason">
              <Select value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value as PatientTransfer["reason"] })} options={REASONS} />
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
              ? "Completing the transfer marks the EMR summary as transmitted to the receiving facility and is written to the audit log."
              : "Inbound transfers are recorded here; register the patient locally from Registration to open a chart."}
          </p>
        </div>
      </Modal>

      <p className="mt-4 text-center text-[11px] text-mist-300">{patients.length} patients on register · transfers feed the NHMIS catchment-movement return</p>
    </div>
  );
}
