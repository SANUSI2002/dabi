import { useState } from "react";
import { Pill, PackagePlus, Boxes } from "lucide-react";
import { PageHeader, Button, Badge, StatCard, statusTone } from "@/components/ui/primitives";
import { Tabs } from "@/components/ui/Tabs";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select, Grid } from "@/components/ui/form";
import { useEmr } from "@/store/useEmr";
import { useCatalog } from "@/store/useCatalog";
import { DRUG_FORMS, DRUG_CLASSES } from "@/data/catalog";
import { dateTime } from "@/lib/format";

export default function Pharmacy() {
  const { encounters, patientById, dispense } = useEmr();
  const { drugs: stock, add: addCatalog, adjustStock } = useCatalog();
  const [addStock, setAddStock] = useState(false);
  const [newStock, setNewStock] = useState({ drug: "", qty: 0 });

  const pendingByPatient = encounters
    .map((e) => ({ e, pending: e.prescriptions.filter((r) => r.status === "Pending") }))
    .filter((x) => x.pending.length);
  const dispensed = encounters.flatMap((e) => e.prescriptions.filter((r) => r.status === "Dispensed").map((r) => ({ ...r, e })));
  const totalPending = pendingByPatient.reduce((n, x) => n + x.pending.length, 0);
  const stockOut = stock.filter((d) => d.stock === 0).length;

  return (
    <div>
      <PageHeader
        title="Pharmacy"
        subtitle={`${totalPending} pending prescriptions`}
        actions={<Button onClick={() => setAddStock(true)}><PackagePlus size={15} /> Add Drug Stock</Button>}
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Pending Rx" value={totalPending} tone="action" icon={<Pill size={18} />} />
        <StatCard label="Dispensed" value={dispensed.length} tone="brand" delay={0.05} />
        <StatCard label="Catalog Items" value={stock.length} tone="mist" delay={0.1} icon={<Boxes size={18} />} />
        <StatCard label="Stock-out" value={stockOut} tone="action" delay={0.15} />
      </div>

      <Tabs tabs={[`Pending Prescriptions (${totalPending})`, `Drug Stock (${stock.length})`, "Dispense History"]}>
        {(t) =>
          t.startsWith("Pending") ? (
            <div className="space-y-3">
              {pendingByPatient.map(({ e, pending }) => {
                const p = patientById(e.patientId);
                return (
                  <div key={e.id} className="card">
                    <div className="mb-2 flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-mist-900">{p ? `${p.firstName} ${p.lastName}` : "—"}</p>
                        <p className="text-[11px] text-mist-400">{p?.mrn} · {dateTime(e.date)}</p>
                      </div>
                      <Badge tone="amber">{pending.length} pending</Badge>
                    </div>
                    <div className="divide-y divide-mist-100">
                      {pending.map((r) => (
                        <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                          <div className="text-sm">
                            <span className="font-medium text-mist-800">{r.drug}</span>
                            <span className="text-mist-400"> · {r.dose} · {r.frequency} · {r.duration} · Qty {r.qty}</span>
                          </div>
                          <div className="flex gap-1.5">
                            <button onClick={() => { dispense(e.id, r.id, "Dispensed"); adjustStock(r.drug, -(r.qty || 1)); }} className="btn-primary px-2.5 py-1 text-xs">Dispense</button>
                            <button onClick={() => dispense(e.id, r.id, "Outsourced")} className="btn-ghost px-2.5 py-1 text-xs">Outsource</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
              {pendingByPatient.length === 0 && <div className="card py-12 text-center text-mist-400">No pending prescriptions.</div>}
            </div>
          ) : t.startsWith("Drug Stock") ? (
            <div className="card p-0">
              <table className="w-full">
                <thead className="border-b border-mist-200 bg-mist-50/60">
                  <tr>{["Drug", "Form", "Strength", "Class", "Batches", "Stock", "Reorder", "Status"].map((c) => <th key={c} className="th">{c}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-mist-100">
                  {stock.map((d) => (
                    <tr key={d.id} className="hover:bg-brand-50/40">
                      <td className="td font-semibold">{d.name}</td>
                      <td className="td">{d.form}</td>
                      <td className="td text-mist-500">{d.strength}</td>
                      <td className="td text-mist-500">{d.klass}</td>
                      <td className="td">{d.batches}</td>
                      <td className="td font-semibold">{d.stock}</td>
                      <td className="td text-mist-400">{d.reorder}</td>
                      <td className="td">
                        <Badge tone={d.stock === 0 ? "action" : d.stock <= d.reorder ? "amber" : "brand"}>
                          {d.stock === 0 ? "Out" : d.stock <= d.reorder ? "Low" : "OK"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="card p-0">
              <table className="w-full">
                <thead className="border-b border-mist-200 bg-mist-50/60">
                  <tr>{["Patient", "Drug", "Qty", "Dispensed", "Status"].map((c) => <th key={c} className="th">{c}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-mist-100">
                  {dispensed.map((r, i) => {
                    const p = patientById(r.e.patientId);
                    return (
                      <tr key={i}>
                        <td className="td font-semibold">{p ? `${p.firstName} ${p.lastName}` : "—"}</td>
                        <td className="td">{r.drug}</td>
                        <td className="td">{r.qty}</td>
                        <td className="td text-mist-400">{dateTime(r.e.date)}</td>
                        <td className="td"><Badge tone={statusTone(r.status)}>{r.status}</Badge></td>
                      </tr>
                    );
                  })}
                  {dispensed.length === 0 && <tr><td colSpan={5} className="py-12 text-center text-mist-400">No dispenses recorded yet.</td></tr>}
                </tbody>
              </table>
            </div>
          )
        }
      </Tabs>

      <Modal
        open={addStock}
        onClose={() => setAddStock(false)}
        title="Receive Drug Stock"
        footer={
          <>
            <Button variant="ghost" onClick={() => setAddStock(false)}>Cancel</Button>
            <Button
              disabled={!newStock.drug || newStock.qty <= 0}
              onClick={() => { adjustStock(newStock.drug, newStock.qty); setAddStock(false); setNewStock({ drug: "", qty: 0 }); }}
            >
              Receive {newStock.qty > 0 ? `+${newStock.qty}` : ""}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Drug">
            <Select value={newStock.drug} onChange={(e) => setNewStock({ ...newStock, drug: e.target.value })}
              options={[{ value: "", label: "Select a drug…" }, ...stock.map((d) => ({ value: d.name, label: `${d.name} (${d.stock} on hand)` }))]} />
          </Field>
          <Grid cols={2}>
            <Field label="Batch number"><Input placeholder="e.g. AB123" /></Field>
            <Field label="Expiry date"><Input type="date" /></Field>
            <Field label="Quantity received"><Input type="number" value={newStock.qty || ""} onChange={(e) => setNewStock({ ...newStock, qty: +e.target.value })} /></Field>
            <Field label="Supplier"><Input placeholder="Optional" /></Field>
          </Grid>
        </div>
      </Modal>
    </div>
  );
}
