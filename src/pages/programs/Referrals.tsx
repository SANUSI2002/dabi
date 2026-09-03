import { useState } from "react";
import { Share2, Plus } from "lucide-react";
import { PageHeader, Button, Badge, StatCard, statusTone } from "@/components/ui/primitives";
import { Tabs } from "@/components/ui/Tabs";
import { Table, Row, Cell } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select, Textarea, Grid } from "@/components/ui/form";
import { PatientPicker } from "@/components/ui/PatientPicker";
import { useEmr } from "@/store/useEmr";
import { OUT_REFERRAL_REASONS } from "@/data/catalog";
import { shortDate } from "@/lib/format";

export default function Referrals() {
  const { referrals, patientById, addReferral } = useEmr();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ patientId: "", type: "Out" as const, diagnosis: "", facility: "", reason: OUT_REFERRAL_REASONS[6].reason, urgency: "Routine" as const });

  return (
    <div>
      <PageHeader
        title="Referrals"
        subtitle={`${referrals.filter((r) => r.status === "Open").length} open`}
        actions={<Button onClick={() => setOpen(true)}><Plus size={15} /> New Referral</Button>}
      />
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total Referrals" value={referrals.length} tone="brand" icon={<Share2 size={18} />} />
        <StatCard label="Out" value={referrals.filter((r) => r.type === "Out").length} tone="action" delay={0.05} />
        <StatCard label="In" value={referrals.filter((r) => r.type === "In").length} tone="brand" delay={0.1} />
        <StatCard label="Emergency" value={referrals.filter((r) => r.urgency === "Emergency").length} tone="action" delay={0.15} />
      </div>

      <Tabs tabs={["All Referrals", "NHMIS Out-Referral Reasons"]}>
        {(t) =>
          t === "All Referrals" ? (
            <Table columns={["Patient", "Type", "Diagnosis", "Facility / Unit", "Reason", "Urgency", "Status"]}>
              {referrals.map((r, i) => {
                const p = patientById(r.patientId);
                return (
                  <Row key={r.id} index={i}>
                    <Cell className="font-semibold">{p ? `${p.firstName} ${p.lastName}` : "—"}</Cell>
                    <Cell><Badge tone={r.type === "Out" ? "action" : "brand"}>{r.type}</Badge></Cell>
                    <Cell>{r.diagnosis}</Cell>
                    <Cell>{r.facility}</Cell>
                    <Cell className="text-mist-500">{r.reason}</Cell>
                    <Cell><Badge tone={r.urgency === "Routine" ? "mist" : "action"}>{r.urgency}</Badge></Cell>
                    <Cell><Badge tone={statusTone(r.status)}>{r.status}</Badge></Cell>
                  </Row>
                );
              })}
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
    </div>
  );
}
