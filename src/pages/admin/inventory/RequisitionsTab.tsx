import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button, Badge } from "@/components/ui/primitives";
import { Table, Row, Cell, EmptyRow } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { useInventoryAccounting } from "@/store/accounting/useInventoryAccounting";
import { useInventoryLocations } from "@/store/useInventoryLocations";
import { DEFAULT_STORE_LOCATION_ID, type RequisitionStatus, type StockRequisition } from "@/data/accounting/inventory";
import { shortDate } from "@/lib/format";

const STATUS_TONE: Record<RequisitionStatus, "brand" | "action" | "mist" | "amber"> = {
  Draft: "mist", "Pending Approval": "amber", Approved: "brand", Rejected: "action", "Partially Fulfilled": "amber", Fulfilled: "brand", Cancelled: "mist",
};

type DraftLine = { itemId: string; qty: string };

/** A ward or department asking a store for stock: raise → approve → fulfil (which moves the stock). */
export function RequisitionsTab() {
  const inv = useInventoryAccounting();
  const locations = useInventoryLocations();
  const active = locations.activeLocations();
  const items = inv.items.filter((i) => i.active);
  const rows = [...inv.requisitions].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  // ---- raise ----
  const blank = () => ({ requestingLocationId: active.find((l) => l.type !== "Store")?.id ?? active[0]?.id ?? "", neededBy: "", justification: "", lines: [{ itemId: items[0]?.id ?? "", qty: "" }] as DraftLine[] });
  const [raising, setRaising] = useState(false);
  const [form, setForm] = useState(blank);

  const validLines = form.lines.filter((l) => l.itemId && Number(l.qty) > 0);

  function raise(submit: boolean) {
    const id = inv.createRequisition({
      requestingLocationId: form.requestingLocationId, date: new Date().toISOString(), neededBy: form.neededBy ? new Date(form.neededBy + "T12:00:00Z").toISOString() : undefined,
      lines: validLines.map((l) => ({ itemId: l.itemId, qtyRequested: Number(l.qty) })), justification: form.justification.trim() || undefined,
    });
    if (submit) inv.submitRequisition(id);
    setRaising(false);
  }

  // ---- reject ----
  const [rejecting, setRejecting] = useState<StockRequisition | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  // ---- fulfil ----
  const [fulfilling, setFulfilling] = useState<StockRequisition | null>(null);
  const [fromLocationId, setFromLocationId] = useState(DEFAULT_STORE_LOCATION_ID);
  const [fulfilError, setFulfilError] = useState("");
  // always read the live record — a partial fulfilment changes its lines
  const liveFulfilling = fulfilling ? inv.requisitions.find((r) => r.id === fulfilling.id) : undefined;

  function openFulfil(r: StockRequisition) {
    setFulfilling(r);
    setFromLocationId(r.fulfillingLocationId ?? (r.requestingLocationId === DEFAULT_STORE_LOCATION_ID ? active.find((l) => l.id !== r.requestingLocationId)?.id ?? "" : DEFAULT_STORE_LOCATION_ID));
    setFulfilError("");
  }

  function submitFulfil() {
    if (!fulfilling) return;
    const res = inv.fulfillRequisition(fulfilling.id, fromLocationId);
    if (!res.ok) { setFulfilError(res.error ?? "Could not fulfil this requisition."); return; }
    setFulfilling(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-mist-400">A ward or department asks a store for stock. Approving is a single store-supervisor decision; fulfilling moves the stock between locations (no ledger entry — it stays one inventory).</p>
        <Button variant="soft" className="px-2.5 py-1 text-xs" onClick={() => { setForm(blank()); setRaising(true); }}><Plus size={13} /> New requisition</Button>
      </div>

      <Table columns={["Number", "Requesting", "Items", "Needed by", "Requested by", "Status", ""]} caption="Stock requisitions">
        {rows.length === 0 && <EmptyRow colSpan={7}>No requisitions yet.</EmptyRow>}
        {rows.map((r) => (
          <Row key={r.id}>
            <Cell className="font-mono text-xs">{r.number}<span className="block text-[11px] text-mist-400">{shortDate(r.date)}</span></Cell>
            <Cell className="font-semibold">{locations.locationName(r.requestingLocationId)}{r.justification && <span className="block text-[11px] font-normal text-mist-400">{r.justification}</span>}</Cell>
            <Cell>
              {r.lines.map((l) => (
                <span key={l.itemId} className="block text-sm">{inv.itemById(l.itemId)?.name ?? l.itemId} <span className="text-mist-400">· {l.qtyIssued}/{l.qtyRequested}</span></span>
              ))}
            </Cell>
            <Cell>{r.neededBy ? shortDate(r.neededBy) : "—"}</Cell>
            <Cell className="text-mist-500">{r.requestedBy}</Cell>
            <Cell>
              <Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge>
              {r.status === "Rejected" && r.rejectionReason && <span className="block text-[11px] text-action-600">{r.rejectionReason}</span>}
              {r.fulfillingLocationId && <span className="block text-[11px] text-mist-400">from {locations.locationName(r.fulfillingLocationId)}</span>}
            </Cell>
            <Cell>
              <div className="flex justify-end gap-1">
                {r.status === "Draft" && <button className="btn-ghost px-2 py-1 text-xs" onClick={() => inv.submitRequisition(r.id)}>Submit</button>}
                {r.status === "Pending Approval" && (
                  <>
                    <button className="btn-ghost px-2 py-1 text-xs" onClick={() => inv.decideRequisition(r.id, "Approved")}>Approve</button>
                    <button className="btn-ghost px-2 py-1 text-xs text-action-600" onClick={() => { setRejecting(r); setRejectReason(""); }}>Reject</button>
                  </>
                )}
                {(r.status === "Approved" || r.status === "Partially Fulfilled") && <button className="btn-soft px-2 py-1 text-xs" onClick={() => openFulfil(r)}>Fulfil</button>}
                {["Draft", "Pending Approval", "Approved"].includes(r.status) && <button className="btn-ghost px-2 py-1 text-xs" onClick={() => inv.cancelRequisition(r.id)}>Cancel</button>}
              </div>
            </Cell>
          </Row>
        ))}
      </Table>

      {/* raise */}
      <Modal
        open={raising}
        onClose={() => setRaising(false)}
        title="New stock requisition"
        wide
        footer={
          <>
            <Button variant="ghost" onClick={() => setRaising(false)}>Cancel</Button>
            <Button variant="soft" disabled={validLines.length === 0} onClick={() => raise(false)}>Save draft</Button>
            <Button disabled={validLines.length === 0} onClick={() => raise(true)}>Submit for approval</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Requesting location *">
              <Select value={form.requestingLocationId} onChange={(e) => setForm({ ...form, requestingLocationId: e.target.value })} options={active.map((l) => ({ value: l.id, label: l.name }))} />
            </Field>
            <Field label="Needed by"><Input type="date" value={form.neededBy} onChange={(e) => setForm({ ...form, neededBy: e.target.value })} /></Field>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="label mb-0">Items *</span>
              <button type="button" className="btn-soft px-2 py-1 text-xs" onClick={() => setForm({ ...form, lines: [...form.lines, { itemId: items[0]?.id ?? "", qty: "" }] })}><Plus size={12} /> Add item</button>
            </div>
            {form.lines.map((line, i) => (
              <div key={i} className="grid grid-cols-[1fr_110px_24px] items-center gap-2">
                <Select
                  aria-label="Item"
                  value={line.itemId}
                  onChange={(e) => setForm({ ...form, lines: form.lines.map((l, j) => (j === i ? { ...l, itemId: e.target.value } : l)) })}
                  options={items.map((it) => ({ value: it.id, label: `${it.name} (${it.unit})` }))}
                />
                <Input
                  aria-label="Quantity"
                  type="number"
                  min={1}
                  placeholder="Qty"
                  value={line.qty}
                  onChange={(e) => setForm({ ...form, lines: form.lines.map((l, j) => (j === i ? { ...l, qty: e.target.value } : l)) })}
                />
                <button type="button" aria-label="Remove item" className="text-action-500 hover:text-action-700 disabled:opacity-30" disabled={form.lines.length === 1} onClick={() => setForm({ ...form, lines: form.lines.filter((_, j) => j !== i) })}><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
          <Field label="Justification"><Textarea value={form.justification} onChange={(e) => setForm({ ...form, justification: e.target.value })} className="min-h-[60px]" placeholder="e.g. Weekly ward restock" /></Field>
        </div>
      </Modal>

      {/* reject */}
      <Modal
        open={Boolean(rejecting)}
        onClose={() => setRejecting(null)}
        title={rejecting ? `Reject ${rejecting.number}` : ""}
        footer={<><Button variant="ghost" onClick={() => setRejecting(null)}>Cancel</Button><Button variant="action" disabled={!rejectReason.trim()} onClick={() => { if (rejecting) inv.decideRequisition(rejecting.id, "Rejected", rejectReason.trim()); setRejecting(null); }}>Reject requisition</Button></>}
      >
        <Field label="Reason *"><Input value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Shown to the requesting location" /></Field>
      </Modal>

      {/* fulfil */}
      <Modal
        open={Boolean(fulfilling)}
        onClose={() => setFulfilling(null)}
        title={fulfilling ? `Fulfil ${fulfilling.number} → ${locations.locationName(fulfilling.requestingLocationId)}` : ""}
        wide
        footer={<><Button variant="ghost" onClick={() => setFulfilling(null)}>Close</Button><Button onClick={submitFulfil}>Issue what's available</Button></>}
      >
        {liveFulfilling && (
          <div className="space-y-4">
            {fulfilError && <p className="rounded-xl bg-action-50 px-3 py-2 text-sm text-action-700">{fulfilError}</p>}
            <Field label="Issue from">
              <Select value={fromLocationId} onChange={(e) => setFromLocationId(e.target.value)} options={active.filter((l) => l.id !== liveFulfilling.requestingLocationId).map((l) => ({ value: l.id, label: l.name }))} />
            </Field>
            <Table columns={["Item", "Requested", "Already issued", "Outstanding", "Available here", "Will issue"]}>
              {liveFulfilling.lines.map((l) => {
                const outstanding = l.qtyRequested - l.qtyIssued;
                const available = inv.availableAtLocation(l.itemId, fromLocationId);
                return (
                  <Row key={l.itemId}>
                    <Cell className="font-semibold">{inv.itemById(l.itemId)?.name ?? l.itemId}</Cell>
                    <Cell>{l.qtyRequested}</Cell>
                    <Cell>{l.qtyIssued}</Cell>
                    <Cell>{outstanding}</Cell>
                    <Cell className={available < outstanding ? "text-amber-600" : ""}>{available}</Cell>
                    <Cell className="font-semibold">{Math.max(0, Math.min(outstanding, available))}</Cell>
                  </Row>
                );
              })}
            </Table>
            <p className="text-[11px] text-mist-400">Anything short stays outstanding — fulfil again once the store is restocked.</p>
          </div>
        )}
      </Modal>
    </div>
  );
}
