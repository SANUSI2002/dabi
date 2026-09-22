import { useState } from "react";
import { ArrowRight, MoveRight } from "lucide-react";
import { Button, Badge } from "@/components/ui/primitives";
import { Table, Row, Cell, EmptyRow } from "@/components/ui/Table";
import { Field, Input, Select } from "@/components/ui/form";
import { useInventoryAccounting } from "@/store/accounting/useInventoryAccounting";
import { useInventoryLocations } from "@/store/useInventoryLocations";
import { useHr } from "@/store/useHr";
import { DEFAULT_STORE_LOCATION_ID } from "@/data/accounting/inventory";
import { dateTime, naira } from "@/lib/format";

/** Move stock between two storage locations directly, with no requisition. Posts no ledger entry. */
export function TransfersTab() {
  const inv = useInventoryAccounting();
  const locations = useInventoryLocations();
  const active = locations.activeLocations();
  const items = inv.items.filter((i) => i.active);
  const history = inv.locationTransfers;

  const [form, setForm] = useState({ itemId: items[0]?.id ?? "", fromLocationId: DEFAULT_STORE_LOCATION_ID, toLocationId: active.find((l) => l.id !== DEFAULT_STORE_LOCATION_ID)?.id ?? "", quantity: "", reference: "" });
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  const staffList = useHr((s) => s.staff);
  const staffName = (id: string) => staffList.find((s) => s.id === id)?.name ?? id;

  const item = inv.itemById(form.itemId);
  const available = form.itemId ? inv.availableAtLocation(form.itemId, form.fromLocationId) : 0;
  const quantity = Number(form.quantity);

  function submit() {
    setError("");
    setDone("");
    const res = inv.relocateStock({
      itemId: form.itemId, qty: quantity, fromLocationId: form.fromLocationId, toLocationId: form.toLocationId, date: new Date().toISOString(), reference: form.reference.trim() || undefined,
    });
    if (!res.ok) { setError(res.error ?? "The move could not be completed."); return; }
    setDone(`Moved ${quantity} ${item?.unit ?? ""} of ${item?.name ?? ""} to ${locations.locationName(form.toLocationId)}.`);
    setForm({ ...form, quantity: "", reference: "" });
  }

  return (
    <div className="space-y-4">
      <div className="card space-y-4">
        <p className="flex items-center gap-1.5 text-sm font-bold text-mist-700"><MoveRight size={15} /> Move stock between locations</p>
        <p className="text-xs text-mist-400">Draws the earliest-expiring batches first and keeps their batch number and expiry. Quarantined and expired stock is never moved. This is a physical move within one inventory, so nothing is posted to the ledger.</p>
        {error && <p className="rounded-xl bg-action-50 px-3 py-2 text-sm text-action-700">{error}</p>}
        {done && <p className="rounded-xl bg-brand-50 px-3 py-2 text-sm text-brand-700">{done}</p>}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Field label="Item *"><Select value={form.itemId} onChange={(e) => setForm({ ...form, itemId: e.target.value })} options={items.map((i) => ({ value: i.id, label: i.name }))} /></Field>
          <Field label="From *"><Select value={form.fromLocationId} onChange={(e) => setForm({ ...form, fromLocationId: e.target.value })} options={active.map((l) => ({ value: l.id, label: l.name }))} /></Field>
          <Field label="To *"><Select value={form.toLocationId} onChange={(e) => setForm({ ...form, toLocationId: e.target.value })} options={active.filter((l) => l.id !== form.fromLocationId).map((l) => ({ value: l.id, label: l.name }))} /></Field>
          <Field label="Quantity *" hint={`${available} ${item?.unit ?? ""} available there`}><Input type="number" min={1} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} /></Field>
          <Field label="Reference"><Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} placeholder="Optional" /></Field>
        </div>
        <div className="flex justify-end">
          <Button disabled={!form.itemId || !form.toLocationId || !(quantity > 0)} onClick={submit}>Move stock</Button>
        </div>
      </div>

      <div className="card p-0">
        <p className="border-b border-mist-100 px-4 py-2.5 text-sm font-bold text-mist-700">Transfer history ({history.length})</p>
        <Table columns={["When", "Item", "Movement", "Quantity", "Value", "Reference", "By"]}>
          {history.length === 0 && <EmptyRow colSpan={7}>No stock has been moved between locations yet.</EmptyRow>}
          {history.map((t) => (
            <Row key={t.id}>
              <Cell className="text-mist-400">{dateTime(t.createdAt)}</Cell>
              <Cell className="font-semibold">{inv.itemById(t.itemId)?.name ?? t.itemId}</Cell>
              <Cell>
                <span className="inline-flex items-center gap-1.5">{locations.locationName(t.fromLocationId)} <ArrowRight size={12} className="text-mist-400" /> {locations.locationName(t.toLocationId)}</span>
              </Cell>
              <Cell>{t.qty} {inv.itemById(t.itemId)?.unit}</Cell>
              <Cell>{naira(t.qty * t.unitCost)}</Cell>
              <Cell>{t.requisitionId ? <Badge tone="brand">Requisition</Badge> : null}{t.reference && <span className="ml-1 font-mono text-xs text-mist-500">{t.reference}</span>}{!t.requisitionId && !t.reference && "—"}</Cell>
              <Cell className="text-mist-500">{staffName(t.createdBy)}</Cell>
            </Row>
          ))}
        </Table>
      </div>
    </div>
  );
}
