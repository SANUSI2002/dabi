import { useState } from "react";
import { Boxes, Plus } from "lucide-react";
import { PageHeader, Button, Badge, StatCard } from "@/components/ui/primitives";
import { Tabs } from "@/components/ui/Tabs";
import { Table, Row, Cell } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select, Grid } from "@/components/ui/form";
import { drugs } from "@/data/mock";
import { shortDate } from "@/lib/format";

type Asset = { id: string; name: string; category: string; serial: string; location: string; cost: number; status: "Functional" | "Faulty" | "Under Repair" | "Disposed"; acquired: string };

export default function Inventory() {
  const [assets, setAssets] = useState<Asset[]>([
    { id: "as1", name: "Digital BP Monitor", category: "Equipment", serial: "BPM-2231", location: "Consulting Room 1", cost: 45000, status: "Functional", acquired: new Date(Date.now() - 200 * 864e5).toISOString() },
    { id: "as2", name: "Vaccine Refrigerator", category: "Cold Chain", serial: "VR-8890", location: "EPI Room", cost: 380000, status: "Functional", acquired: new Date(Date.now() - 400 * 864e5).toISOString() },
    { id: "as3", name: "Delivery Bed", category: "Furniture", serial: "DB-1120", location: "Labour Room", cost: 120000, status: "Under Repair", acquired: new Date(Date.now() - 700 * 864e5).toISOString() },
  ]);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: "", category: "Equipment", serial: "", location: "", cost: 0, status: "Functional" as const });

  return (
    <div>
      <PageHeader
        title="Inventory"
        subtitle="Assets & consumable stock"
        actions={<Button onClick={() => setOpen(true)}><Plus size={15} /> Add Asset</Button>}
      />
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Assets" value={assets.length} tone="brand" icon={<Boxes size={18} />} />
        <StatCard label="Functional" value={assets.filter((a) => a.status === "Functional").length} tone="brand" delay={0.05} />
        <StatCard label="Needs Repair" value={assets.filter((a) => a.status === "Under Repair" || a.status === "Faulty").length} tone="action" delay={0.1} />
        <StatCard label="Drug Lines" value={drugs.length} tone="mist" delay={0.15} />
      </div>

      <Tabs tabs={["Assets", "Drug Stock"]}>
        {(t) =>
          t === "Assets" ? (
            <Table columns={["Name", "Category", "Serial", "Location", "Acquired", "Cost", "Status"]}>
              {assets.map((a, i) => (
                <Row key={a.id} index={i}>
                  <Cell className="font-semibold">{a.name}</Cell>
                  <Cell>{a.category}</Cell>
                  <Cell className="font-mono text-xs">{a.serial}</Cell>
                  <Cell>{a.location}</Cell>
                  <Cell className="text-mist-400">{shortDate(a.acquired)}</Cell>
                  <Cell>₦{a.cost.toLocaleString()}</Cell>
                  <Cell>
                    <Badge tone={a.status === "Functional" ? "brand" : a.status === "Disposed" ? "mist" : "action"}>{a.status}</Badge>
                  </Cell>
                </Row>
              ))}
            </Table>
          ) : (
            <Table columns={["Drug", "Form", "Strength", "Batches", "Stock", "Reorder", "Status"]}>
              {drugs.map((d, i) => (
                <Row key={d.id} index={i}>
                  <Cell className="font-semibold">{d.name}</Cell>
                  <Cell>{d.form}</Cell>
                  <Cell>{d.strength}</Cell>
                  <Cell>{d.batches}</Cell>
                  <Cell>{d.stock}</Cell>
                  <Cell>{d.reorder}</Cell>
                  <Cell><Badge tone={d.stock === 0 ? "action" : d.stock <= d.reorder ? "amber" : "brand"}>{d.stock === 0 ? "Out" : d.stock <= d.reorder ? "Low" : "OK"}</Badge></Cell>
                </Row>
              ))}
            </Table>
          )
        }
      </Tabs>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Add Asset"
        footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button disabled={!f.name} onClick={() => { setAssets((a) => [{ ...f, id: Math.random().toString(), acquired: new Date().toISOString() }, ...a]); setOpen(false); }}>Add Asset</Button></>}
      >
        <div className="space-y-4">
          <Grid cols={2}>
            <Field label="Name"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
            <Field label="Category"><Select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} options={["Equipment", "Cold Chain", "Furniture", "Vehicle", "IT", "Other"]} /></Field>
            <Field label="Serial number"><Input value={f.serial} onChange={(e) => setF({ ...f, serial: e.target.value })} /></Field>
            <Field label="Location"><Input value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} placeholder="e.g. Consulting Room 1" /></Field>
            <Field label="Cost (₦)"><Input type="number" value={f.cost || ""} onChange={(e) => setF({ ...f, cost: +e.target.value })} /></Field>
            <Field label="Status"><Select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as never })} options={["Functional", "Faulty", "Under Repair", "Disposed"]} /></Field>
          </Grid>
        </div>
      </Modal>
    </div>
  );
}
