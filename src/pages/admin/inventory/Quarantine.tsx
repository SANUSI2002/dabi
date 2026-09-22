import { useState } from "react";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/primitives";
import { Table, Row, Cell, EmptyRow } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select, Checkbox } from "@/components/ui/form";
import { useInventoryAccounting } from "@/store/accounting/useInventoryAccounting";
import { useInventoryLocations } from "@/store/useInventoryLocations";
import { DEFAULT_STORE_LOCATION_ID, type CostLayer } from "@/data/accounting/inventory";
import { dateTime, shortDate } from "@/lib/format";

const useLayerLocation = () => {
  const locationName = useInventoryLocations((s) => s.locationName);
  return (layer: CostLayer) => locationName(layer.locationId ?? DEFAULT_STORE_LOCATION_ID);
};

/** Put one batch of an item — or the whole lot, in every location — on hold. */
export function QuarantineModal({ itemId, onClose }: { itemId: string; onClose: () => void }) {
  const inv = useInventoryAccounting();
  const locationOf = useLayerLocation();
  const item = inv.itemById(itemId);
  const layers = inv.layersForItem(itemId).filter((l) => l.remainingQty > 0 && l.status !== "Quarantined");
  const [layerId, setLayerId] = useState(layers[0]?.id ?? "");
  const [reason, setReason] = useState("");
  const [wholeLot, setWholeLot] = useState(false);
  const [error, setError] = useState("");

  const layer = layers.find((l) => l.id === layerId);

  function confirm() {
    if (!layer || !item) return;
    setError("");
    const res = wholeLot && layer.batchNumber ? inv.recallLot({ itemId, batchNumber: layer.batchNumber, reason }) : inv.quarantineLayer({ layerId: layer.id, reason });
    if (!res.ok) { setError(res.error ?? "Could not quarantine this batch."); return; }
    onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Quarantine — ${item?.name ?? ""}`}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="action" disabled={!layer || !reason.trim()} onClick={confirm}>{wholeLot ? "Recall lot" : "Quarantine batch"}</Button></>}
    >
      <div className="space-y-4">
        {error && <p className="rounded-xl bg-action-50 px-3 py-2 text-sm text-action-700">{error}</p>}
        {layers.length === 0 ? (
          <p className="text-sm text-mist-500">This item has no batch records to quarantine — its stock predates batch tracking. Receive stock with a batch number and expiry first.</p>
        ) : (
          <>
            <p className="text-sm text-mist-500">Quarantined stock stays on the books but can't be issued, moved or dispensed until it's released or written off.</p>
            <Field label="Batch *">
              <Select
                value={layerId}
                onChange={(e) => { setLayerId(e.target.value); setWholeLot(false); }}
                options={layers.map((l) => ({ value: l.id, label: `${l.batchNumber ?? "No batch no."} · ${l.remainingQty} ${item?.unit ?? ""} · ${locationOf(l)}${l.expiryDate ? ` · exp ${shortDate(l.expiryDate)}` : ""}` }))}
              />
            </Field>
            <Field label="Reason *"><Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Temperature excursion, manufacturer recall" /></Field>
            {layer?.batchNumber && (
              <Checkbox label={`Recall the whole lot ${layer.batchNumber} — every location`} checked={wholeLot} onChange={(e) => setWholeLot(e.target.checked)} />
            )}
          </>
        )}
      </div>
    </Modal>
  );
}

/** Every batch currently on hold, with the two ways out: release it, or write it off. */
export function QuarantinePanel() {
  const inv = useInventoryAccounting();
  const locationOf = useLayerLocation();
  const held = inv.layers.filter((l) => l.status === "Quarantined" && l.remainingQty > 0);
  const [writingOff, setWritingOff] = useState<CostLayer | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  function submitWriteOff() {
    if (!writingOff) return;
    setError("");
    const res = inv.writeOff({ itemId: writingOff.itemId, qty: writingOff.remainingQty, date: new Date().toISOString(), reason: reason.trim(), layerId: writingOff.id });
    if (!res.ok) { setError(res.error ?? "The write-off could not be posted."); return; }
    setWritingOff(null);
    setReason("");
  }

  return (
    <div className="card p-0">
      <p className="flex items-center gap-1.5 border-b border-mist-100 px-4 py-2.5 text-sm font-bold text-mist-700"><ShieldAlert size={14} /> Quarantined batches ({held.length})</p>
      <Table columns={["Item", "Batch", "Location", "Quantity", "Expiry", "Reason", "Held by", ""]}>
        {held.length === 0 && <EmptyRow colSpan={8}>Nothing is in quarantine.</EmptyRow>}
        {held.map((l) => {
          const item = inv.itemById(l.itemId);
          return (
            <Row key={l.id}>
              <Cell className="font-semibold">{item?.name ?? l.itemId}</Cell>
              <Cell className="font-mono text-xs">{l.batchNumber ?? "—"}</Cell>
              <Cell>{locationOf(l)}</Cell>
              <Cell>{l.remainingQty} {item?.unit}</Cell>
              <Cell>{l.expiryDate ? shortDate(l.expiryDate) : "—"}</Cell>
              <Cell className="text-mist-600">{l.quarantineReason ?? "—"}</Cell>
              <Cell className="text-mist-400">{l.quarantinedBy ?? "—"}{l.quarantinedAt && <span className="block text-[11px]">{dateTime(l.quarantinedAt)}</span>}</Cell>
              <Cell>
                <div className="flex justify-end gap-1">
                  <button className="btn-ghost px-2 py-1 text-xs" onClick={() => inv.releaseLayer({ layerId: l.id, note: "Released from Alerts" })}>Release</button>
                  <button className="btn-ghost px-2 py-1 text-xs text-action-600" onClick={() => { setWritingOff(l); setReason(""); setError(""); }}>Write off</button>
                </div>
              </Cell>
            </Row>
          );
        })}
      </Table>

      <Modal
        open={Boolean(writingOff)}
        onClose={() => setWritingOff(null)}
        title={writingOff ? `Write off — ${inv.itemById(writingOff.itemId)?.name ?? ""}` : ""}
        footer={<><Button variant="ghost" onClick={() => setWritingOff(null)}>Cancel</Button><Button variant="action" disabled={!reason.trim()} onClick={submitWriteOff}>Write off</Button></>}
      >
        {writingOff && (
          <div className="space-y-4">
            {error && <p className="rounded-xl bg-action-50 px-3 py-2 text-sm text-action-700">{error}</p>}
            <p className="text-sm text-mist-500">
              Writes off all {writingOff.remainingQty} {inv.itemById(writingOff.itemId)?.unit} of batch <b>{writingOff.batchNumber ?? "—"}</b> and posts the loss to the general ledger.
              This can't be undone.
            </p>
            <Field label="Reason *"><Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Destroyed per SOP" /></Field>
          </div>
        )}
      </Modal>
    </div>
  );
}
