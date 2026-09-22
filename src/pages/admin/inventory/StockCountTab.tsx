import { useState } from "react";
import { Plus } from "lucide-react";
import { Button, Badge } from "@/components/ui/primitives";
import { Table, Row, Cell, EmptyRow } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Checkbox } from "@/components/ui/form";
import { useInventoryAccounting } from "@/store/accounting/useInventoryAccounting";
import { naira, shortDate } from "@/lib/format";

/** Physical counts: freeze the system quantity, enter what's on the shelf, then post the differences as ledger adjustments. */
export function StockCountTab() {
  const inv = useInventoryAccounting();
  const items = inv.items.filter((i) => i.active);
  const counts = inv.counts;

  const [creating, setCreating] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [note, setNote] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const open = openId ? counts.find((c) => c.id === openId) : undefined;

  function startCreate() {
    setPicked(new Set(items.map((i) => i.id)));
    setNote("");
    setCreating(true);
  }

  function create() {
    const id = inv.createStockCount({ date: new Date().toISOString(), itemIds: [...picked], note: note.trim() || undefined });
    setCreating(false);
    setOpenId(id);
  }

  function post() {
    if (!open) return;
    const res = inv.postStockCount(open.id);
    setOpenId(null);
    setMessage(res.ok ? `Count ${open.number} posted — ${res.adjustments} adjustment${res.adjustments === 1 ? "" : "s"}, net ${naira(res.netValue ?? 0)}.` : (res.error ?? "The count could not be posted."));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-mist-400">Posting a count adjusts stock to what was counted and records the gain or shrinkage in the general ledger.</p>
        <Button variant="soft" className="px-2.5 py-1 text-xs" onClick={startCreate}><Plus size={13} /> New count</Button>
      </div>
      {message && <p className="rounded-xl bg-brand-50 px-3 py-2 text-sm text-brand-700">{message}</p>}

      <Table columns={["Count", "Date", "Items", "Status", "Note", ""]} caption="Stock counts">
        {counts.length === 0 && <EmptyRow colSpan={6}>No stock counts yet.</EmptyRow>}
        {counts.map((c) => (
          <Row key={c.id}>
            <Cell className="font-mono text-xs">{c.number}</Cell>
            <Cell>{shortDate(c.date)}</Cell>
            <Cell>{c.lines.length}</Cell>
            <Cell><Badge tone={c.status === "Posted" ? "brand" : "amber"}>{c.status}</Badge></Cell>
            <Cell className="text-mist-500">{c.note ?? "—"}</Cell>
            <Cell><button className="btn-ghost px-2 py-1 text-xs" onClick={() => { setMessage(""); setOpenId(c.id); }}>{c.status === "Draft" ? "Count" : "View"}</button></Cell>
          </Row>
        ))}
      </Table>

      {/* new count */}
      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="New stock count"
        footer={<><Button variant="ghost" onClick={() => setCreating(false)}>Cancel</Button><Button disabled={picked.size === 0} onClick={create}>Start count ({picked.size})</Button></>}
      >
        <div className="space-y-4">
          <Field label="Note"><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Monthly cycle count — Main Store" /></Field>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="label mb-0">Items to count</span>
              <button type="button" className="text-xs font-semibold text-brand-700" onClick={() => setPicked(picked.size === items.length ? new Set() : new Set(items.map((i) => i.id)))}>
                {picked.size === items.length ? "Clear all" : "Select all"}
              </button>
            </div>
            {items.map((i) => (
              <Checkbox
                key={i.id}
                label={`${i.name} — ${i.currentQty} ${i.unit} on hand`}
                checked={picked.has(i.id)}
                onChange={(e) => setPicked((prev) => { const next = new Set(prev); if (e.target.checked) next.add(i.id); else next.delete(i.id); return next; })}
              />
            ))}
          </div>
        </div>
      </Modal>

      {/* count sheet */}
      <Modal
        open={Boolean(open)}
        onClose={() => setOpenId(null)}
        title={open ? `Stock count ${open.number}` : ""}
        wide
        footer={
          open?.status === "Draft" ? (
            <><Button variant="ghost" onClick={() => setOpenId(null)}>Close</Button><Button onClick={post}>Post adjustments</Button></>
          ) : (
            <Button variant="ghost" onClick={() => setOpenId(null)}>Close</Button>
          )
        }
      >
        {open && (
          <div className="space-y-3">
            {open.status === "Draft" && <p className="text-xs text-mist-400">Enter what you physically counted. Lines left at the system quantity post no adjustment.</p>}
            <Table columns={["Item", "System qty", "Counted", "Variance"]}>
              {open.lines.map((l) => {
                const item = inv.itemById(l.itemId);
                const variance = l.countedQty - (open.status === "Draft" ? item?.currentQty ?? l.systemQty : l.systemQty);
                return (
                  <Row key={l.itemId}>
                    <Cell className="font-semibold">{item?.name ?? l.itemId}<span className="block text-[11px] font-normal text-mist-400">{item?.unit}</span></Cell>
                    <Cell>{open.status === "Draft" ? item?.currentQty ?? l.systemQty : l.systemQty}</Cell>
                    <Cell>
                      {open.status === "Draft" ? (
                        <Input aria-label={`Counted ${item?.name ?? ""}`} type="number" min={0} value={l.countedQty} onChange={(e) => inv.updateCountLine(open.id, l.itemId, Number(e.target.value))} className="h-8 w-24" />
                      ) : (
                        l.countedQty
                      )}
                    </Cell>
                    <Cell className={variance === 0 ? "text-mist-400" : variance < 0 ? "font-semibold text-action-600" : "font-semibold text-brand-700"}>{variance > 0 ? "+" : ""}{variance}</Cell>
                  </Row>
                );
              })}
            </Table>
          </div>
        )}
      </Modal>
    </div>
  );
}
