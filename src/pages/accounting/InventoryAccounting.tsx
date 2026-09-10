import { useMemo, useState } from "react";
import { Plus, Boxes, ArrowDownToLine, ArrowUpFromLine, SlidersHorizontal } from "lucide-react";
import { PageHeader, Button, Badge, StatCard, Card, statusTone, EmptyState } from "@/components/ui/primitives";
import { Tabs } from "@/components/ui/Tabs";
import { Table, Row, Cell } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select } from "@/components/ui/form";
import { money, shortDate, isoDate } from "@/lib/format";
import { useInventoryAccounting } from "@/store/accounting/useInventoryAccounting";
import { useAP } from "@/store/accounting/useAP";
import { useLedger } from "@/store/accounting/useLedger";
import type { InventoryItem } from "@/data/accounting/inventory";

export default function InventoryAccounting() {
  const { items, movements, valuationOf, totalValuation, receiveStock, issueStock, adjustStock, writeOff, movementsFor, transfers, counts, transferStock, createStockCount, updateCountLine, postStockCount, applyLandedCost, reorderSuggestions, unitCostOf } = useInventoryAccounting();
  const { vendors, createPurchaseOrder } = useAP();
  const branches = useLedger((s) => s.branches);
  const [msg, setMsg] = useState<string | null>(null);
  const [transferF, setTransferF] = useState({ itemId: "", qty: 0, from: "br-ho", to: "br-ikorodu", date: isoDate(new Date()) });
  const [countId, setCountId] = useState<string | null>(null);
  const [landed, setLanded] = useState<{ description: string; creditAccount: number; date: string; allocs: Record<string, number> } | null>(null);
  const [view, setView] = useState<InventoryItem | null>(null);
  const [action, setAction] = useState<{ item: InventoryItem; kind: "receive" | "issue" | "adjust" | "writeoff" } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [af, setAf] = useState({ qty: 0, unitCost: 0, date: isoDate(new Date()), reason: "", reference: "" });

  const lowStock = useMemo(() => items.filter((i) => i.currentQty <= i.reorderLevel), [items]);
  const suggestions = reorderSuggestions();

  function raiseReorderPOs() {
    const byVendor = new Map<string, typeof suggestions>();
    for (const s of suggestions) {
      const v = s.preferredVendorId ?? vendors[0]?.id ?? "";
      byVendor.set(v, [...(byVendor.get(v) ?? []), s]);
    }
    let made = 0;
    for (const [vendorId, list] of byVendor) {
      if (!vendorId) continue;
      createPurchaseOrder({
        vendorId, date: new Date().toISOString(), notes: "Auto-generated from reorder suggestions",
        lines: list.map((s) => ({ id: `pl-${Math.random().toString(36).slice(2, 7)}`, accountNumber: s.item.inventoryAccountNumber, description: `${s.item.name} (${s.item.sku})`, qty: s.suggestedQty, unitPrice: unitCostOf(s.item.id) || s.item.averageCost, taxRateId: "tax-vat-exempt" })),
      });
      made++;
    }
    setMsg(`Raised ${made} draft purchase order(s) covering ${suggestions.length} low item(s).`);
  }

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

      {msg && <div className="mb-4 rounded-xl bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-700 ring-1 ring-brand-200">{msg}</div>}

      <Tabs tabs={["Items", "Movements", "Operations"]}>
        {(t) =>
          t === "Operations" ? (
            <div className="space-y-4">
              <Card>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-mist-700">Reorder suggestions ({suggestions.length})</h3>
                  {suggestions.length > 0 && <Button variant="soft" onClick={raiseReorderPOs}><Plus size={13} /> Raise draft POs</Button>}
                </div>
                {suggestions.length === 0 ? <p className="text-sm text-mist-400">All items above reorder level.</p> : (
                  <Table columns={["Item", "On hand", "Reorder at", "Suggested order", "Est. cost", "Preferred vendor"]}>
                    {suggestions.map((s, i) => (
                      <Row key={s.item.id} index={i}>
                        <Cell className="font-semibold">{s.item.name}</Cell>
                        <Cell className="font-mono">{s.item.currentQty}</Cell>
                        <Cell className="font-mono">{s.item.reorderLevel}</Cell>
                        <Cell className="font-mono font-semibold">{s.suggestedQty}</Cell>
                        <Cell className="font-mono">{money(s.estCost)}</Cell>
                        <Cell>{vendors.find((v) => v.id === s.preferredVendorId)?.name ?? "—"}</Cell>
                      </Row>
                    ))}
                  </Table>
                )}
              </Card>

              <Card>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-mist-700">Branch transfers</h3>
                </div>
                <div className="flex flex-wrap items-end gap-2">
                  <Field label="Item"><Select value={transferF.itemId} onChange={(e) => setTransferF({ ...transferF, itemId: e.target.value })} options={[{ value: "", label: "—" }, ...items.map((i) => ({ value: i.id, label: i.name }))]} /></Field>
                  <Field label="Qty"><Input type="number" value={transferF.qty || ""} onChange={(e) => setTransferF({ ...transferF, qty: +e.target.value })} className="w-20" /></Field>
                  <Field label="From"><Select value={transferF.from} onChange={(e) => setTransferF({ ...transferF, from: e.target.value })} options={branches.map((b) => ({ value: b.id, label: b.name }))} /></Field>
                  <Field label="To"><Select value={transferF.to} onChange={(e) => setTransferF({ ...transferF, to: e.target.value })} options={branches.map((b) => ({ value: b.id, label: b.name }))} /></Field>
                  <Button onClick={() => { const r = transferStock({ itemId: transferF.itemId, qty: transferF.qty, fromBranchId: transferF.from, toBranchId: transferF.to, date: new Date(transferF.date + "T12:00:00Z").toISOString() }); setMsg(r.ok ? "Transfer posted (intercompany, eliminated on consolidation)." : (r.error ?? "Failed")); }} disabled={!transferF.itemId || transferF.qty <= 0}>Transfer</Button>
                </div>
                {transfers.length > 0 && (
                  <Table columns={["Date", "Item", "Qty", "From → To", "Value"]}>
                    {transfers.slice(0, 6).map((tr, i) => (
                      <Row key={tr.id} index={i}>
                        <Cell className="text-mist-500">{shortDate(tr.date)}</Cell>
                        <Cell>{items.find((x) => x.id === tr.itemId)?.name}</Cell>
                        <Cell className="font-mono">{tr.qty}</Cell>
                        <Cell>{branches.find((b) => b.id === tr.fromBranchId)?.name} → {branches.find((b) => b.id === tr.toBranchId)?.name}</Cell>
                        <Cell className="font-mono">{money(tr.value)}</Cell>
                      </Row>
                    ))}
                  </Table>
                )}
              </Card>

              <Card>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-mist-700">Stock counts</h3>
                  <div className="flex gap-2">
                    <Button variant="soft" onClick={() => setLanded({ description: "Freight & clearing", creditAccount: 2000, date: isoDate(new Date()), allocs: {} })}>Landed cost</Button>
                    <Button variant="soft" onClick={() => { const id = createStockCount({ date: new Date().toISOString(), itemIds: items.map((i) => i.id) }); setCountId(id); }}><Plus size={13} /> New count</Button>
                  </div>
                </div>
                {counts.length === 0 ? <p className="text-sm text-mist-400">No counts yet.</p> : (
                  <Table columns={["Number", "Date", "Items", "Status", ""]}>
                    {counts.map((c, i) => (
                      <Row key={c.id} index={i}>
                        <Cell className="font-mono text-xs">{c.number}</Cell>
                        <Cell>{shortDate(c.date)}</Cell>
                        <Cell>{c.lines.length}</Cell>
                        <Cell><Badge tone={c.status === "Posted" ? "brand" : "amber"}>{c.status}</Badge></Cell>
                        <Cell>{c.status === "Draft" && <button className="btn-ghost px-2 py-1 text-xs" onClick={() => setCountId(c.id)}>Open</button>}</Cell>
                      </Row>
                    ))}
                  </Table>
                )}
              </Card>
            </div>
          ) : t === "Movements" ? (
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

      {/* B25 stock count */}
      {countId && (() => {
        const count = counts.find((c) => c.id === countId);
        if (!count) return null;
        return (
          <Modal open onClose={() => setCountId(null)} title={`Stock Count ${count.number}`} wide
            footer={count.status === "Draft" ? <><Button variant="ghost" onClick={() => setCountId(null)}>Close</Button><Button onClick={() => { const r = postStockCount(count.id); setCountId(null); setMsg(r.ok ? `Count posted — ${r.adjustments} adjustment(s), net ${money(r.netValue ?? 0)}.` : (r.error ?? "Failed")); }}>Post adjustments</Button></> : <Button variant="ghost" onClick={() => setCountId(null)}>Close</Button>}>
            <Table columns={["Item", "System qty", "Counted", "Variance"]}>
              {count.lines.map((l, i) => {
                const item = items.find((x) => x.id === l.itemId);
                const variance = l.countedQty - (item?.currentQty ?? l.systemQty);
                return (
                  <Row key={l.itemId} index={i}>
                    <Cell className="font-semibold">{item?.name}</Cell>
                    <Cell className="font-mono">{item?.currentQty ?? l.systemQty}</Cell>
                    <Cell>{count.status === "Draft" ? <Input type="number" value={l.countedQty} onChange={(e) => updateCountLine(count.id, l.itemId, +e.target.value)} className="h-8 w-24" /> : l.countedQty}</Cell>
                    <Cell className={`font-mono font-semibold ${variance < 0 ? "text-action-600" : variance > 0 ? "text-brand-700" : "text-mist-400"}`}>{variance > 0 ? "+" : ""}{variance}</Cell>
                  </Row>
                );
              })}
            </Table>
          </Modal>
        );
      })()}

      {/* B26 landed cost */}
      {landed && (
        <Modal open onClose={() => setLanded(null)} title="Capitalise Landed Costs" wide
          footer={<><Button variant="ghost" onClick={() => setLanded(null)}>Cancel</Button>
            <Button onClick={() => {
              const r = applyLandedCost({ date: new Date(landed.date + "T12:00:00Z").toISOString(), description: landed.description, creditAccount: landed.creditAccount, allocations: Object.entries(landed.allocs).map(([itemId, amount]) => ({ itemId, amount: +amount })).filter((a) => a.amount > 0) });
              setLanded(null); setMsg(r.ok ? "Landed costs capitalised into inventory." : (r.error ?? "Failed"));
            }}>Post</Button></>}>
          <div className="space-y-3">
            <p className="text-sm text-mist-500">Freight, duty or clearing charges are added to the inventory value and spread across each item's on-hand units.</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Description"><Input value={landed.description} onChange={(e) => setLanded({ ...landed, description: e.target.value })} /></Field>
              <Field label="Credit account"><Input type="number" value={landed.creditAccount} onChange={(e) => setLanded({ ...landed, creditAccount: +e.target.value })} /></Field>
              <Field label="Date"><Input type="date" value={landed.date} onChange={(e) => setLanded({ ...landed, date: e.target.value })} /></Field>
            </div>
            <Table columns={["Item", "On hand", "Allocate cost"]}>
              {items.map((it, i) => (
                <Row key={it.id} index={i}>
                  <Cell className="font-semibold">{it.name}</Cell>
                  <Cell className="font-mono">{it.currentQty}</Cell>
                  <Cell><Input type="number" value={landed.allocs[it.id] ?? ""} onChange={(e) => setLanded({ ...landed, allocs: { ...landed.allocs, [it.id]: +e.target.value } })} className="h-8 w-28" /></Cell>
                </Row>
              ))}
            </Table>
          </div>
        </Modal>
      )}
    </div>
  );
}
