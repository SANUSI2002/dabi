import { useState } from "react";
import { Home, Plus } from "lucide-react";
import { PageHeader, Button, Badge, StatCard } from "@/components/ui/primitives";
import { Tabs } from "@/components/ui/Tabs";
import { Table, Row, Cell } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { useEmr } from "@/store/useEmr";
import { staff } from "@/data/mock";
import { shortDate } from "@/lib/format";

export default function Outreach() {
  const { outreachActivities, addOutreach } = useEmr();
  const [open, setOpen] = useState(false);
  const chws = staff.filter((s) => s.role.includes("Community"));
  const [f, setF] = useState({ chw: chws[0]?.name ?? staff[0].name, type: "Household visit", ward: "Kirikiri", households: 0, referrals: 0, date: "" });

  return (
    <div>
      <PageHeader
        title="Community Outreach (CHW)"
        subtitle="Household visits, campaigns & community referrals"
        actions={<Button onClick={() => setOpen(true)}><Plus size={15} /> Log Activity</Button>}
      />
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Activities" value={outreachActivities.length} tone="brand" icon={<Home size={18} />} />
        <StatCard label="Households Reached" value={outreachActivities.reduce((n, a) => n + a.households, 0)} tone="mist" delay={0.05} />
        <StatCard label="Community Referrals" value={outreachActivities.reduce((n, a) => n + a.referrals, 0)} tone="action" delay={0.1} />
        <StatCard label="Active CHWs" value={chws.length} tone="mist" delay={0.15} />
      </div>

      <Tabs tabs={["Activity Log", "CHW Roster"]}>
        {(t) =>
          t === "Activity Log" ? (
            <Table columns={["CHW", "Type", "Ward", "Households", "Referrals", "Date"]}>
              {outreachActivities.map((a, i) => (
                <Row key={a.id} index={i}>
                  <Cell className="font-semibold">{a.chw}</Cell>
                  <Cell><Badge tone="mist">{a.type}</Badge></Cell>
                  <Cell>{a.ward}</Cell>
                  <Cell>{a.households}</Cell>
                  <Cell>{a.referrals}</Cell>
                  <Cell>{shortDate(a.date)}</Cell>
                </Row>
              ))}
            </Table>
          ) : (
            <Table columns={["Name", "Cadre", "Phone", "Status"]}>
              {chws.map((c, i) => (
                <Row key={c.id} index={i}>
                  <Cell className="font-semibold">{c.name}</Cell>
                  <Cell>{c.cadre}</Cell>
                  <Cell>{c.phone ?? "—"}</Cell>
                  <Cell><Badge tone="brand">{c.status}</Badge></Cell>
                </Row>
              ))}
            </Table>
          )
        }
      </Tabs>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Log Outreach Activity"
        footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button disabled={!f.date} onClick={() => { addOutreach({ ...f, date: new Date(f.date).toISOString() }); setOpen(false); setF({ ...f, date: "", households: 0, referrals: 0 }); }}>Save Activity</Button></>}
      >
        <div className="space-y-4">
          <Field label="CHW"><Select value={f.chw} onChange={(e) => setF({ ...f, chw: e.target.value })} options={chws.map((c) => c.name)} /></Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Activity type"><Select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })} options={["Household visit", "Health talk", "Immunization campaign", "Defaulter tracing", "Community screening"]} /></Field>
            <Field label="Ward / zone"><Input value={f.ward} onChange={(e) => setF({ ...f, ward: e.target.value })} /></Field>
            <Field label="Households reached"><Input type="number" value={f.households || ""} onChange={(e) => setF({ ...f, households: +e.target.value })} /></Field>
            <Field label="Referrals made"><Input type="number" value={f.referrals || ""} onChange={(e) => setF({ ...f, referrals: +e.target.value })} /></Field>
          </div>
          <Field label="Date"><Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
          <Field label="Notes"><Textarea /></Field>
        </div>
      </Modal>
    </div>
  );
}
