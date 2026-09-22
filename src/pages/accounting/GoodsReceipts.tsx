import { useState } from "react";
import { PackagePlus } from "lucide-react";
import { PageHeader, Card, Badge, Button, EmptyState } from "@/components/ui/primitives";
import { Table, Row, Cell } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select } from "@/components/ui/form";
import { shortDate } from "@/lib/format";
import { useAP } from "@/store/accounting/useAP";
import { useHr } from "@/store/useHr";
import { useInventoryAccounting } from "@/store/accounting/useInventoryAccounting";
import { useInventoryLocations } from "@/store/useInventoryLocations";
import { usePharmacy } from "@/store/usePharmacy";
import { DEFAULT_STORE_LOCATION_ID, type InventoryItem } from "@/data/accounting/inventory";
import { PHARMACY_LOCATIONS, DEFAULT_PHARMACY_LOCATION, type PharmacyLocation } from "@/data/pharmacyOps";
import type { GoodsReceipt, GoodsReceiptLine } from "@/data/accounting/payables";

type StockForm = { batchNumber: string; expiryDate: string; locationId: string; pharmacyLocation: PharmacyLocation };

const isoDate = (d: Date) => d.toISOString().slice(0, 10);
const defaultDrugExpiry = () => {
  const d = new Date();
  d.setMonth(d.getMonth() + 18);
  return isoDate(d);
};

export default function GoodsReceipts() {
  const { goodsReceipts, purchaseOrders, vendorById, markGoodsReceiptStocked } = useAP();
  const staff = useHr((s) => s.staff);
  const inventory = useInventoryAccounting();
  const pharmacy = usePharmacy();
  const locations = useInventoryLocations((s) => s.locations).filter((l) => l.status === "Active");

  const [stockingId, setStockingId] = useState<string | null>(null);
  const [forms, setForms] = useState<Record<string, StockForm>>({});
  const [error, setError] = useState("");

  const isStocked = (g: GoodsReceipt, l: GoodsReceiptLine) => (g.stockedLineIds ?? []).includes(l.poLineId);
  const stockLinesOf = (g: GoodsReceipt) => g.lines.filter((l) => l.itemId && l.qtyReceived > 0);
  const pendingLinesOf = (g: GoodsReceipt) => stockLinesOf(g).filter((l) => !isStocked(g, l));

  const stocking = goodsReceipts.find((g) => g.id === stockingId);
  const pending = stocking ? pendingLinesOf(stocking) : [];
  const drugOf = (item: InventoryItem | undefined) => (item ? pharmacy.drugForItem(item.id) : undefined);

  function openStocking(g: GoodsReceipt) {
    const next: Record<string, StockForm> = {};
    for (const line of pendingLinesOf(g)) {
      const item = inventory.itemById(line.itemId!);
      next[line.poLineId] = {
        batchNumber: "", expiryDate: drugOf(item) ? defaultDrugExpiry() : "", locationId: DEFAULT_STORE_LOCATION_ID, pharmacyLocation: DEFAULT_PHARMACY_LOCATION,
      };
    }
    setForms(next);
    setError("");
    setStockingId(g.id);
  }

  function setForm(poLineId: string, patch: Partial<StockForm>) {
    setForms((f) => ({ ...f, [poLineId]: { ...f[poLineId], ...patch } }));
  }

  // Receiving goods into stock never posts to the ledger: the bill already debits the inventory account.
  function submitStocking() {
    if (!stocking) return;
    const po = purchaseOrders.find((p) => p.id === stocking.purchaseOrderId);
    const done: string[] = [];
    const problems: string[] = [];
    for (const line of pending) {
      const item = inventory.itemById(line.itemId!);
      const f = forms[line.poLineId];
      if (!item || !f) continue;
      const unitCost = po?.lines.find((l) => l.id === line.poLineId)?.unitPrice ?? 0;
      const drug = drugOf(item);
      if (drug) {
        if (!f.expiryDate) { problems.push(`${item.name}: an expiry date is required for a drug batch.`); continue; }
        // receiveBatch records the pharmacy batch AND the matching stock-ledger layer
        pharmacy.receiveBatch({
          drugId: drug.id, quantity: line.qtyReceived, batchNumber: f.batchNumber || undefined, expiryDate: f.expiryDate, costPerUnit: unitCost, supplierId: stocking.vendorId, location: f.pharmacyLocation,
        });
      } else {
        const res = inventory.receiveStock({
          itemId: item.id, qty: line.qtyReceived, unitCost, date: new Date().toISOString(), reference: stocking.number,
          batchNumber: f.batchNumber || undefined, expiryDate: f.expiryDate || undefined, locationId: f.locationId,
        });
        if (!res.ok) { problems.push(`${item.name}: ${res.error ?? "could not be received."}`); continue; }
      }
      done.push(line.poLineId);
    }
    if (done.length) markGoodsReceiptStocked(stocking.id, done);
    if (problems.length) { setError(problems.join(" ")); return; }
    setStockingId(null);
  }

  return (
    <div>
      <PageHeader title="Goods Receipts" subtitle="Proof that ordered goods physically arrived — recorded against a purchase order, then matched to the bill" />
      {goodsReceipts.length === 0 ? (
        <EmptyState title="No goods receipts yet" hint="Receive goods from the Purchase Orders page." />
      ) : (
        <Card className="p-0">
          <Table columns={["GRN", "Vendor", "PO", "Date", "Received by", "Lines", "Completeness", "Stock"]}>
            {goodsReceipts.map((g, i) => {
              const po = purchaseOrders.find((p) => p.id === g.purchaseOrderId);
              const full = g.lines.every((l) => l.qtyReceived >= l.qtyOrdered);
              const stockLines = stockLinesOf(g);
              const waiting = pendingLinesOf(g);
              return (
                <Row key={g.id} index={i}>
                  <Cell className="font-mono text-xs">{g.number}</Cell>
                  <Cell className="font-semibold">{vendorById(g.vendorId)?.name}</Cell>
                  <Cell className="font-mono text-xs">{po?.number ?? "—"}</Cell>
                  <Cell>{shortDate(g.date)}</Cell>
                  <Cell>{staff.find((s) => s.id === g.receivedBy)?.name ?? "—"}</Cell>
                  <Cell>{g.lines.length}</Cell>
                  <Cell><Badge tone={full ? "brand" : "amber"}>{full ? "Complete" : "Partial"}</Badge></Cell>
                  <Cell>
                    {stockLines.length === 0 ? (
                      <span className="text-mist-300">—</span>
                    ) : waiting.length > 0 ? (
                      <Button variant="soft" className="px-2.5 py-1 text-xs" onClick={() => openStocking(g)}><PackagePlus size={13} /> Receive into stock</Button>
                    ) : (
                      <Badge tone="brand">In stock</Badge>
                    )}
                  </Cell>
                </Row>
              );
            })}
          </Table>
        </Card>
      )}

      <Modal
        open={Boolean(stocking)}
        onClose={() => setStockingId(null)}
        title={stocking ? `Receive into stock — ${stocking.number}` : ""}
        wide
        footer={<><Button variant="ghost" onClick={() => setStockingId(null)}>Cancel</Button><Button disabled={pending.length === 0} onClick={submitStocking}>Receive {pending.length} line{pending.length === 1 ? "" : "s"}</Button></>}
      >
        <div className="space-y-4">
          {error && <p className="rounded-xl bg-action-50 px-3 py-2 text-sm text-action-700">{error}</p>}
          <p className="text-sm text-mist-500">
            The batch number, expiry and storage location weren't captured on the order — enter them for what physically arrived. This updates stock only; the ledger is
            debited when the bill is posted, so nothing is posted twice.
          </p>
          {pending.length === 0 && <p className="text-sm text-mist-400">Every stock-linked line on this receipt is already in stock.</p>}
          {pending.map((line) => {
            const item = inventory.itemById(line.itemId!);
            const f = forms[line.poLineId];
            const isDrug = Boolean(drugOf(item));
            if (!item || !f) return null;
            return (
              <div key={line.poLineId} className="space-y-3 rounded-xl bg-mist-50 p-3">
                <p className="text-sm font-semibold text-mist-800">
                  {item.name} <span className="font-normal text-mist-500">— {line.qtyReceived} {item.unit} received</span>
                  {isDrug && <Badge tone="brand"> Drug batch</Badge>}
                </p>
                <div className="grid gap-3 sm:grid-cols-4">
                  <Field label="Batch number"><Input value={f.batchNumber} onChange={(e) => setForm(line.poLineId, { batchNumber: e.target.value })} placeholder="Auto if blank" /></Field>
                  <Field label={isDrug ? "Expiry date *" : "Expiry date"}><Input type="date" value={f.expiryDate} onChange={(e) => setForm(line.poLineId, { expiryDate: e.target.value })} /></Field>
                  {isDrug ? (
                    <Field label="Pharmacy location">
                      <Select value={f.pharmacyLocation} onChange={(e) => setForm(line.poLineId, { pharmacyLocation: e.target.value as PharmacyLocation })} options={[...PHARMACY_LOCATIONS]} />
                    </Field>
                  ) : (
                    <Field label="Storage location">
                      <Select value={f.locationId} onChange={(e) => setForm(line.poLineId, { locationId: e.target.value })} options={locations.map((l) => ({ value: l.id, label: l.name }))} />
                    </Field>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Modal>
    </div>
  );
}
