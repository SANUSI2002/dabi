import { useState } from "react";
import { PackagePlus } from "lucide-react";
import { Card, Button, Badge, EmptyState } from "@/components/ui/primitives";
import { Table, Row, Cell } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { Field, Input } from "@/components/ui/form";
import { useEquipmentConsumables } from "@/store/useEquipmentConsumables";
import { consumableStateFor, type ConsumableItem } from "@/data/equipmentConsumables";
import type { EquipmentRecord } from "@/data/equipment";
import { shortDate, dateTime, isoDate } from "@/lib/format";

export function ConsumablesTab({ eq }: { eq: EquipmentRecord }) {
  const consumables = useEquipmentConsumables();
  const consumableItems = consumables.itemsFor(eq.id);
  const consumableUsage = consumables.usageFor(eq.id);

  const [registerConsumableModal, setRegisterConsumableModal] = useState(false);
  const [consumableForm, setConsumableForm] = useState({ name: "", lotNumber: "", expiryDate: isoDate(new Date()), unit: "unit", quantityOnHand: "0", reorderThreshold: "0", costPerUnit: "0", supplier: "" });
  const [receiveStockId, setReceiveStockId] = useState<string | null>(null);
  const [receiveQty, setReceiveQty] = useState("0");
  const [wastageId, setWastageId] = useState<string | null>(null);
  const [wastageQty, setWastageQty] = useState("0");

  return (
    <div className="space-y-4">
      <Button variant="soft" onClick={() => { setConsumableForm({ name: "", lotNumber: "", expiryDate: isoDate(new Date()), unit: "unit", quantityOnHand: "0", reorderThreshold: "0", costPerUnit: "0", supplier: "" }); setRegisterConsumableModal(true); }}>
        <PackagePlus size={14} /> Register Consumable
      </Button>

      {consumableItems.length === 0 ? (
        <EmptyState title="No consumables registered" hint="This equipment runs with no reagent/consumable gating until one is registered here." />
      ) : (
        <div className="space-y-3">
          {consumableItems.map((item) => (
            <ConsumableItemCard
              key={item.id}
              item={item}
              onReceiveStock={() => { setReceiveStockId(item.id); setReceiveQty("0"); }}
              onWastage={() => { setWastageId(item.id); setWastageQty("0"); }}
            />
          ))}
        </div>
      )}

      {consumableUsage.length > 0 && (
        <Table columns={["Date", "Item", "Qty", "Reason", "Source"]} caption="Consumable usage log">
          {consumableUsage.map((event, i) => (
            <Row key={event.id} index={i}>
              <Cell className="whitespace-nowrap text-xs text-mist-500">{dateTime(event.at)}</Cell>
              <Cell>{consumableItems.find((it) => it.id === event.consumableId)?.name ?? "—"}</Cell>
              <Cell>{event.quantityUsed}</Cell>
              <Cell>{event.reason}{event.testName ? ` · ${event.testName}` : ""}</Cell>
              <Cell><Badge tone={event.source === "SIMULATOR" ? "mist" : "brand"}>{event.source}</Badge></Cell>
            </Row>
          ))}
        </Table>
      )}

      <Modal
        open={registerConsumableModal}
        onClose={() => setRegisterConsumableModal(false)}
        title="Register Consumable"
        footer={<><Button variant="ghost" onClick={() => setRegisterConsumableModal(false)}>Cancel</Button>
          <Button
            disabled={!consumableForm.name.trim() || !consumableForm.lotNumber.trim()}
            onClick={() => {
              consumables.registerConsumable(eq.id, {
                name: consumableForm.name.trim(), lotNumber: consumableForm.lotNumber.trim(), expiryDate: new Date(consumableForm.expiryDate).toISOString(),
                unit: consumableForm.unit, quantityOnHand: +consumableForm.quantityOnHand || 0, reorderThreshold: +consumableForm.reorderThreshold || 0,
                costPerUnit: +consumableForm.costPerUnit || 0, supplier: consumableForm.supplier || undefined,
              });
              setRegisterConsumableModal(false);
            }}
          >
            Register
          </Button></>}
      >
        <div className="space-y-4">
          <Field label="Name"><Input value={consumableForm.name} onChange={(e) => setConsumableForm({ ...consumableForm, name: e.target.value })} placeholder="e.g. Hemoglobin reagent kit" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Lot number"><Input value={consumableForm.lotNumber} onChange={(e) => setConsumableForm({ ...consumableForm, lotNumber: e.target.value })} /></Field>
            <Field label="Expiry date"><Input type="date" value={consumableForm.expiryDate} onChange={(e) => setConsumableForm({ ...consumableForm, expiryDate: e.target.value })} /></Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Unit"><Input value={consumableForm.unit} onChange={(e) => setConsumableForm({ ...consumableForm, unit: e.target.value })} placeholder="kit, mL, test" /></Field>
            <Field label="Qty on hand"><Input type="number" value={consumableForm.quantityOnHand} onChange={(e) => setConsumableForm({ ...consumableForm, quantityOnHand: e.target.value })} /></Field>
            <Field label="Reorder at"><Input type="number" value={consumableForm.reorderThreshold} onChange={(e) => setConsumableForm({ ...consumableForm, reorderThreshold: e.target.value })} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Cost per unit (₦)"><Input type="number" value={consumableForm.costPerUnit} onChange={(e) => setConsumableForm({ ...consumableForm, costPerUnit: e.target.value })} /></Field>
            <Field label="Supplier" hint="Optional"><Input value={consumableForm.supplier} onChange={(e) => setConsumableForm({ ...consumableForm, supplier: e.target.value })} /></Field>
          </div>
        </div>
      </Modal>

      {receiveStockId && (
        <Modal
          open
          onClose={() => setReceiveStockId(null)}
          title="Receive Stock"
          footer={<><Button variant="ghost" onClick={() => setReceiveStockId(null)}>Cancel</Button>
            <Button disabled={!(+receiveQty > 0)} onClick={() => { consumables.receiveStock(receiveStockId, +receiveQty); setReceiveStockId(null); }}>Receive</Button></>}
        >
          <Field label="Quantity received"><Input type="number" value={receiveQty} onChange={(e) => setReceiveQty(e.target.value)} /></Field>
        </Modal>
      )}

      {wastageId && (
        <Modal
          open
          onClose={() => setWastageId(null)}
          title="Record Wastage"
          footer={<><Button variant="ghost" onClick={() => setWastageId(null)}>Cancel</Button>
            <Button
              disabled={!(+wastageQty > 0)}
              onClick={() => { consumables.consume(wastageId, +wastageQty, { reason: "Wastage", source: "USER" }); setWastageId(null); }}
            >
              Record
            </Button></>}
        >
          <Field label="Quantity wasted"><Input type="number" value={wastageQty} onChange={(e) => setWastageQty(e.target.value)} /></Field>
        </Modal>
      )}
    </div>
  );
}

function ConsumableItemCard({ item, onReceiveStock, onWastage }: { item: ConsumableItem; onReceiveStock: () => void; onWastage: () => void }) {
  const state = consumableStateFor(item);
  const tone = state === "OK" ? "brand" : state === "Low Stock" ? "amber" : "action";
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-semibold text-mist-900">{item.name}</p>
          <p className="text-[11px] text-mist-400">Lot {item.lotNumber} · expires {shortDate(item.expiryDate)}{item.supplier ? ` · ${item.supplier}` : ""}</p>
        </div>
        <Badge tone={tone}>{state}</Badge>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-4 text-sm">
        <span className="text-mist-600">{item.quantityOnHand} {item.unit} on hand</span>
        <span className="text-mist-400">Reorder at {item.reorderThreshold} {item.unit}</span>
        <span className="text-mist-400">₦{item.costPerUnit.toLocaleString()} / {item.unit}</span>
      </div>
      <div className="mt-2 flex gap-1.5">
        <button onClick={onReceiveStock} className="btn-soft px-2.5 py-1 text-xs">Receive Stock</button>
        <button onClick={onWastage} className="text-xs text-mist-400 hover:text-action-600">Record wastage</button>
      </div>
    </Card>
  );
}
