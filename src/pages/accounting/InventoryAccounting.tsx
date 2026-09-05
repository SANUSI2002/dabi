import { useMemo, useState } from "react";
import { Plus, Boxes, ArrowDownToLine, ArrowUpFromLine, SlidersHorizontal } from "lucide-react";
import { PageHeader, Button, Badge, StatCard, Card, statusTone, EmptyState } from "@/components/ui/primitives";
import { Tabs } from "@/components/ui/Tabs";
import { Table, Row, Cell } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select } from "@/components/ui/form";
import { money, shortDate, isoDate } from "@/lib/format";
import { useInventoryAccounting } from "@/store/accounting/useInventoryAccounting";
import type { InventoryItem } from "@/data/accounting/inventory";

export default function InventoryAccounting() {
  const { items, movements, valuationOf, totalValuation, receiveStock, issueStock, adjustStock, writeOff, movementsFor } = useInventoryAccounting();
  const [view, setView] = useState<InventoryItem | null>(null);
  const [action, setAction] = useState<{ item: InventoryItem; kind: "receive" | "issue" | "adjust" | "writeoff" } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [af, setAf] = useState({ qty: 0, unitCost: 0, date: isoDate(new Date()), reason: "", reference: "" });

  const lowStock = useMemo(() => items.filter((i) => i.currentQty <= i.reorderLevel), [items]);

  function run() {
    if (!action) return;
    setErr(null);
    const d = new Date(af.date + "T12:00:00Z").toISOString();
    let r: { ok: boolean; error?: string };
    if (action.kind === "receive") r = receiveStock({ itemId: action.item.id, qty: af.qty, unitCost: af.unitCost, date: d, reference: af.reference || undefined, postGL: true });
    else if (action.kind === "issue") r = issueStock({ itemId: action.item.id, qty: af.qty, date: d, reference: af.reference || undefined, note: af.reason || undefined });
    else if (action.kind === "adjust") r = adjustStock({ itemId: action.item.id, qtyDelta: af.qty, date: d, reason: af.reason || "Stock count" });
    else r = writeOff({ itemId: action.item.id, qty: af.qty, date: d, reason: af.reason || "Damaged / expired" });
    if (!r.ok) return setErr(r.error ?? "Could not post");
    setAction(null);
    setAf({ qty: 0, unitCost: 0, date: isoDate(new Date()), reason: "", reference: "" });
  }

  return (
    <div>
      <PageHeader title="Inventory Accounting" subtitle="Financial value of stock and cost of goods sold — physical counts stay in Pharmacy / Inventory" />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Items" value={items.length} tone="brand" icon={<Boxes size={18} />} />
        <StatCard label="Stock valuation" value={money(totalValuation())} tone="brand" delay={0.05} />
        <StatCard label="Below reorder" value={lowStock.length} tone={lowStock.length ? "action" : "mist"} delay={0.1} />
        <StatCard label="Movements" value={movements.length} tone="mist" delay={0.15} />
      </div>

      <Tabs tabs={["Items", "Movements"]}>
        {(t) =>
          t === "Movements" ? (
            movements.length === 0 ? <EmptyState title="No movements yet" hint="Receive or issue stock to see the cost impact." /> : (
              <Card className="p-0">
                <Table columns={["Date", "Item", "Type", "Qty", "Unit cost", "Value", "Journal"]}>
                  {movements.map((m, i) => (
                    <Row key={m.id} index={i}>
                      <Cell className="whitespace-nowrap text-mist-500">{shortDate(m.date)}</Cell>
                      <Cell className="font-semibold">{items.find((x) => x.id === m.itemId)?.name}</Cell>
                      <Cell><Badge tone={statusTone(m.type === "Receipt" || m.type === "Return" ? "approved" : m.type === "Issue" ? "submitted" : "returned")}>{m.type}</Badge></Cell>
                      <Cell className="font-mono">{m.qtyDelta > 0 ? "+" : ""}{m.qtyDelta}</Cell>
                      <Cell className="font-mono">{money(m.unitCost)}</Cell>
                      <Cell className={`font-mono ${m.value < 0 ? "text-action-600" : ""}`}>{money(m.value)}</Cell>
                      <Cell>{m.journalEntryId ? <Badge tone="brand">posted</Badge> : "—"}</Cell>
                    </Row>
                  ))}
                </Table>
              </Card>
            )
          ) : (
            <Card className="p-0">
              <Table columns={["SKU", "Item", "Method", "On hand", "Avg cost", "Valuation", "Status", ""]}>
                {items.map((it, i) => (
                  <Row key={it.id} index={i} onClick={() => setView(it)}>
                    <Cell className="font-mono text-xs">{it.sku}</Cell>
                    <Cell className="font-semibold">{it.name}<span className="block text-xs font-normal text-mist-400">{it.category}</span></Cell>
                    <Cell className="text-xs">{it.valuationMethod}</Cell>
                    <Cell className="font-mono">{it.currentQty} {it.unit}</Cell>
                    <Cell className="font-mono">{money(it.averageCost)}</Cell>
                    <Cell className="font-mono font-semibold">{money(valuationOf(it.id))}</Cell>
                    <Cell><Badge tone={it.currentQty <= it.reorderLevel ? "action" : "brand"}>{it.currentQty <= it.reorderLevel ? "Reorder" : "OK"}</Badge></Cell>
                    <Cell>
                      <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        <button className="btn-ghost px-1.5 py-1 text-xs" title="Receive" onClick={() => { setErr(null); setAf({ qty: 0, unitCost: it.averageCost, date: isoDate(new Date()), reason: "", reference: "" }); setAction({ item: it, kind: "receive" }); }}><ArrowDownToLine size={12} /></button>
                        <button className="btn-ghost px-1.5 py-1 text-xs" title="Issue" onClick={() => { setErr(null); setAf({ qty: 0, unitCost: 0, date: isoDate(new Date()), reason: "", reference: "" }); setAction({ item: it, kind: "issue" }); }}><ArrowUpFromLine size={12} /></button>
                        <button className="btn-ghost px-1.5 py-1 text-xs" title="Adjust / write-off" onClick={() => { setErr(null); setAf({ qty: 0, unitCost: 0, date: isoDate(new Date()), reason: "", reference: "" }); setAction({ item: it, kind: "adjust" }); }}><SlidersHorizontal size={12} /></button>
                      </div>
                    </Cell>
                  </Row>
                ))}
              </Table>
            </Card>
          )
        }
      </Tabs>

      <Modal open={!!action} onClose={() => setAction(null)} title={action ? `${action.kind === "receive" ? "Receive" : action.kind === "issue" ? "Issue" : action.kind === "writeoff" ? "Write off" : "Adjust"} — ${action.item.name}` : ""}
        footer={<><Button variant="ghost" onClick={() => setAction(null)}>Cancel</Button><Button onClick={run}>Post</Button></>}>
        {action && (
          <div className="space-y-3">
            {err && <p className="rounded-lg bg-action-50 px-3 py-2 text-sm text-action-700 ring-1 ring-action-200">{err}</p>}
            <p className="text-sm text-mist-600">On hand: <b>{action.item.currentQty} {action.item.unit}</b> · avg cost {money(action.item.averageCost)}</p>
            {action.kind === "adjust" && <div className="flex gap-2 text-xs"><button className="btn-soft px-2 py-1" onClick={() => setAction({ ...action, kind: "adjust" })}>Count adjustment</button><button className="btn-soft px-2 py-1" onClick={() => setAction({ ...action, kind: "writeoff" })}>Write-off</button></div>}
            <Field label={action.kind === "adjust" ? "Quantity change (+/-)" : "Quantity"}><Input type="number" value={af.qty || ""} onChange={(e) => setAf({ ...af, qty: +e.target.value })} /></Field>
            {action.kind === "receive" && <Field label="Unit cost"><Input type="number" value={af.unitCost || ""} onChange={(e) => setAf({ ...af, unitCost: +e.target.value })} /></Field>}
            <Field label="Date"><Input type="date" value={af.date} onChange={(e) => setAf({ ...af, date: e.target.value })} /></Field>
            {action.kind === "receive" ? <Field label="Reference"><Input value={af.reference} onChange={(e) => setAf({ ...af, reference: e.target.value })} /></Field> : <Field label="Reason / note"><Input value={af.reason} onChange={(e) => setAf({ ...af, reason: e.target.value })} /></Field>}
            <p className="text-xs text-mist-400">
              {action.kind === "receive" && `Dr ${action.item.inventoryAccountNumber} Inventory / Cr Accounts Payable.`}
              {action.kind === "issue" && `Dr ${action.item.cogsAccountNumber} COGS / Cr ${action.item.inventoryAccountNumber} Inventory (at ${action.item.valuationMethod} cost).`}
              {action.kind === "adjust" && `Adjusts inventory value vs Misc Expense.`}
              {action.kind === "writeoff" && `Dr Misc Expense / Cr ${action.item.inventoryAccountNumber} Inventory.`}
            </p>
          </div>
        )}
      </Modal>

      <Modal open={!!view} onClose={() => setView(null)} title={view?.name ?? ""} wide>
        {view && (
          <div className="space-y-4">
            <div className="grid gap-2 rounded-xl bg-mist-50 p-3 text-sm sm:grid-cols-2">
              <div><span className="text-mist-400">SKU</span> · {view.sku}</div>
              <div><span className="text-mist-400">Method</span> · {view.valuationMethod}</div>
              <div><span className="text-mist-400">Inventory / COGS a/c</span> · {view.inventoryAccountNumber} / {view.cogsAccountNumber}</div>
              <div><span className="text-mist-400">Valuation</span> · <b>{money(valuationOf(view.id))}</b></div>
            </div>
            <Table columns={["Date", "Type", "Qty", "Unit cost", "Value"]}>
              {movementsFor(view.id).map((m) => (
                <Row key={m.id}>
                  <Cell>{shortDate(m.date)}</Cell>
                  <Cell><Badge tone="mist">{m.type}</Badge></Cell>
                  <Cell className="font-mono">{m.qtyDelta > 0 ? "+" : ""}{m.qtyDelta}</Cell>
                  <Cell className="font-mono">{money(m.unitCost)}</Cell>
                  <Cell className="font-mono">{money(m.value)}</Cell>
                </Row>
              ))}
            </Table>
          </div>
        )}
      </Modal>
    </div>
  );
}
