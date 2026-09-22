import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Boxes, Plus, LayoutDashboard, Siren } from "lucide-react";
import { PageHeader, Button, Badge, StatCard } from "@/components/ui/primitives";
import { Tabs } from "@/components/ui/Tabs";
import { Table, Row, Cell, EmptyRow } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select, Grid } from "@/components/ui/form";
import { useInventoryAccounting } from "@/store/accounting/useInventoryAccounting";
import { useInventoryLocations } from "@/store/useInventoryLocations";
import { shortDate, dateTime, naira } from "@/lib/format";
import { QuarantineModal, QuarantinePanel } from "./inventory/Quarantine";
import { RequisitionsTab } from "./inventory/RequisitionsTab";
import { TransfersTab } from "./inventory/TransfersTab";
import { StockCountTab } from "./inventory/StockCountTab";

type Asset = { id: string; name: string; category: string; serial: string; location: string; cost: number; status: "Functional" | "Faulty" | "Under Repair" | "Disposed"; acquired: string };

type StockStatus = "OK" | "Reorder" | "Low Stock" | "Out of Stock";
function statusFor(currentQty: number, minLevel: number | undefined, reorderLevel: number): { label: StockStatus; tone: "brand" | "action" | "amber" | "mist" } {
  if (currentQty <= 0) return { label: "Out of Stock", tone: "action" };
  if (minLevel !== undefined && currentQty <= minLevel) return { label: "Low Stock", tone: "action" };
  if (currentQty <= reorderLevel) return { label: "Reorder", tone: "amber" };
  return { label: "OK", tone: "brand" };
}

const ALERT_FILTERS: Record<string, StockStatus[] | "expiring" | "expired" | "quarantined"> = {
  out: ["Out of Stock"], low: ["Low Stock"], reorder: ["Reorder"], expiring: "expiring", expired: "expired", quarantined: "quarantined",
};

const TABS = ["Dashboard", "Stock List", "Requisitions", "Transfers", "Stock Count", "Alerts", "Assets"];

export default function Inventory() {
  const [assets, setAssets] = useState<Asset[]>(() => [
    { id: "as1", name: "Digital BP Monitor", category: "Equipment", serial: "BPM-2231", location: "Consulting Room 1", cost: 45000, status: "Functional", acquired: new Date(Date.now() - 200 * 864e5).toISOString() },
    { id: "as2", name: "Vaccine Refrigerator", category: "Cold Chain", serial: "VR-8890", location: "EPI Room", cost: 380000, status: "Functional", acquired: new Date(Date.now() - 400 * 864e5).toISOString() },
    { id: "as3", name: "Delivery Bed", category: "Furniture", serial: "DB-1120", location: "Labour Room", cost: 120000, status: "Under Repair", acquired: new Date(Date.now() - 700 * 864e5).toISOString() },
  ]);
  const inv = useInventoryAccounting();
  const locations = useInventoryLocations();
  const activeLocations = locations.activeLocations();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: "", category: "Equipment", serial: "", location: "", cost: 0, status: "Functional" as const });

  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState("Dashboard");
  const statusFilter = searchParams.get("status") ?? "";

  const items = inv.items.filter((i) => i.active);
  const rows = items.map((item) => {
    const status = statusFor(item.currentQty, item.minLevel, item.reorderLevel);
    const layers = inv.layersForItem(item.id).filter((l) => l.remainingQty > 0);
    const expiries = layers.map((l) => l.expiryDate).filter((d): d is string => Boolean(d)).sort();
    const hasExpiring = layers.some((l) => inv.expiryStatus(l) === "Expiring Soon");
    const hasExpired = layers.some((l) => inv.expiryStatus(l) === "Expired");
    const locationsUsed = new Set(layers.map((l) => l.locationId).filter(Boolean)).size;
    const lastMovement = inv.movementsFor(item.id)[0];
    const quarantinedQty = layers.filter((l) => l.status === "Quarantined").reduce((n, l) => n + l.remainingQty, 0);
    return { item, status, earliestExpiry: expiries[0], hasExpiring, hasExpired, locationsUsed, lastMovement, quarantinedQty, value: inv.valuationOf(item.id) };
  });

  const filteredRows = rows.filter((r) => {
    const filter = ALERT_FILTERS[statusFilter];
    if (!filter) return true;
    if (filter === "expiring") return r.hasExpiring;
    if (filter === "expired") return r.hasExpired;
    if (filter === "quarantined") return r.quarantinedQty > 0;
    return filter.includes(r.status.label);
  });

  const lowStock = rows.filter((r) => r.status.label === "Low Stock");
  const outOfStock = rows.filter((r) => r.status.label === "Out of Stock");
  const reorderRows = rows.filter((r) => r.status.label === "Reorder");
  const expiringRows = rows.filter((r) => r.hasExpiring);
  const expiredRows = rows.filter((r) => r.hasExpired);
  const quarantinedRows = rows.filter((r) => r.quarantinedQty > 0);
  const totalValue = items.reduce((sum, item) => sum + inv.valuationOf(item.id), 0);
  const totalQty = items.reduce((sum, item) => sum + item.currentQty, 0);
  const reorderSuggestions = inv.reorderSuggestions();

  const [actionItem, setActionItem] = useState<{ itemId: string; mode: "issue" | "adjust" | "writeoff" } | null>(null);
  const [actionForm, setActionForm] = useState({ quantity: "", locationId: activeLocations[0]?.id ?? "", department: "", purpose: "", reason: "" });
  const [actionError, setActionError] = useState("");
  const [quarantineItemId, setQuarantineItemId] = useState<string | null>(null);

  function openAction(itemId: string, mode: "issue" | "adjust" | "writeoff") {
    setActionItem({ itemId, mode });
    setActionForm({ quantity: "", locationId: activeLocations[0]?.id ?? "", department: "", purpose: "", reason: "" });
    setActionError("");
  }

  function submitAction() {
    if (!actionItem) return;
    setActionError("");
    const item = inv.itemById(actionItem.itemId);
    if (!item) return;
    const today = new Date().toISOString();
    let result: { ok: boolean; error?: string };
    if (actionItem.mode === "issue") {
      result = inv.issueStock({ itemId: item.id, qty: Number(actionForm.quantity), date: today, locationId: actionForm.locationId, department: actionForm.department, purpose: actionForm.purpose });
    } else if (actionItem.mode === "adjust") {
      const delta = Number(actionForm.quantity) - item.currentQty;
      result = inv.adjustStock({ itemId: item.id, qtyDelta: delta, date: today, reason: actionForm.reason, locationId: actionForm.locationId });
    } else {
      result = inv.writeOff({ itemId: item.id, qty: Number(actionForm.quantity), date: today, reason: actionForm.reason, locationId: actionForm.locationId });
    }
    if (!result.ok) { setActionError(result.error ?? "This action could not be completed."); return; }
    setActionItem(null);
  }

  return (
    <div>
      <PageHeader
        title="Inventory"
        subtitle="Assets, general supplies & drug stock"
        actions={tab === "Assets" ? <Button onClick={() => setOpen(true)}><Plus size={15} /> Add Asset</Button> : undefined}
      />

      <Tabs tabs={TABS} active={tab} onChange={(t) => { setTab(t); setSearchParams({}); }} label="Inventory sections">
        {(activeTab) =>
          activeTab === "Dashboard" ? (
            <div className="space-y-4">
              <p className="flex items-center gap-1.5 text-xs text-mist-400"><LayoutDashboard size={13} /> Every figure here is folded live from batch/cost-layer records — nothing is a separately maintained count.</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatCard label="Total items" value={items.length} tone="brand" icon={<Boxes size={18} />} />
                <StatCard label="Total quantity on hand" value={totalQty} tone="mist" delay={0.05} />
                <StatCard label="Total stock value" value={naira(totalValue)} tone="mist" delay={0.1} />
                <StatCard label="Storage locations" value={activeLocations.length} tone="mist" delay={0.15} />
                <StatCard label="Low stock" value={lowStock.length} tone={lowStock.length ? "amber" : "mist"} delay={0.2} />
                <StatCard label="Out of stock" value={outOfStock.length} tone={outOfStock.length ? "action" : "mist"} delay={0.25} />
                <StatCard label="Expiring soon" value={expiringRows.length} tone={expiringRows.length ? "amber" : "mist"} delay={0.3} />
                <StatCard label="Expired" value={expiredRows.length} tone={expiredRows.length ? "action" : "mist"} delay={0.35} />
              </div>
              <div className="card p-0">
                <p className="border-b border-mist-100 px-4 py-2.5 text-sm font-bold text-mist-700">Reorder recommendations ({reorderSuggestions.length})</p>
                <Table columns={["Item", "On hand", "Reorder level", "Suggested qty", "Est. cost"]}>
                  {reorderSuggestions.length === 0 && <EmptyRow colSpan={5}>Nothing needs reordering right now.</EmptyRow>}
                  {reorderSuggestions.map(({ item, suggestedQty, estCost }) => (
                    <Row key={item.id}>
                      <Cell className="font-semibold">{item.name}</Cell>
                      <Cell>{item.currentQty} {item.unit}</Cell>
                      <Cell>{item.reorderLevel}</Cell>
                      <Cell>{suggestedQty}</Cell>
                      <Cell>{naira(estCost)}</Cell>
                    </Row>
                  ))}
                </Table>
              </div>
            </div>
          ) : activeTab === "Stock List" ? (
            <div className="space-y-4">
              {statusFilter && (
                <div className="flex items-center justify-between rounded-xl bg-mist-50 px-3 py-2 text-sm text-mist-600 ring-1 ring-mist-200">
                  <span>Filtered ({filteredRows.length} item{filteredRows.length === 1 ? "" : "s"})</span>
                  <Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => setSearchParams({})}>Clear filter</Button>
                </div>
              )}
              <Table columns={["Item", "Category", "Unit", "On hand", "Min / Reorder", "Locations", "Earliest expiry", "Status", "Value", "Last movement", ""]} caption="Inventory stock list">
                {filteredRows.length === 0 && <EmptyRow colSpan={11}>No items match.</EmptyRow>}
                {filteredRows.map(({ item, status, earliestExpiry, locationsUsed, lastMovement, quarantinedQty, value }) => (
                  <Row key={item.id}>
                    <Cell className="font-semibold">{item.name}<span className="block text-[11px] font-normal text-mist-400">{item.sku}</span></Cell>
                    <Cell>{item.category}</Cell>
                    <Cell>{item.unit}</Cell>
                    <Cell>{item.currentQty}{quarantinedQty > 0 && <span className="block text-[11px] font-semibold text-action-600">{quarantinedQty} quarantined</span>}</Cell>
                    <Cell className="text-mist-500">{item.minLevel ?? "—"} / {item.reorderLevel}</Cell>
                    <Cell>{locationsUsed || "—"}</Cell>
                    <Cell>{earliestExpiry ? shortDate(earliestExpiry) : "—"}</Cell>
                    <Cell><Badge tone={status.tone}>{status.label}</Badge></Cell>
                    <Cell>{naira(value)}</Cell>
                    <Cell className="text-mist-400">{lastMovement ? dateTime(lastMovement.date) : "—"}</Cell>
                    <Cell>
                      <div className="flex justify-end gap-1">
                        <Link className="btn-ghost px-2 py-1 text-xs" to={`/inventory/item/${item.id}`}>View</Link>
                        <button className="btn-ghost px-2 py-1 text-xs" onClick={() => openAction(item.id, "issue")}>Issue</button>
                        <button className="btn-ghost px-2 py-1 text-xs" onClick={() => openAction(item.id, "adjust")}>Adjust</button>
                        <button className="btn-ghost px-2 py-1 text-xs" onClick={() => setQuarantineItemId(item.id)}>Quarantine</button>
                        <button className="btn-ghost px-2 py-1 text-xs text-action-600" onClick={() => openAction(item.id, "writeoff")}>Write off</button>
                      </div>
                    </Cell>
                  </Row>
                ))}
              </Table>
            </div>
          ) : activeTab === "Requisitions" ? (
            <RequisitionsTab />
          ) : activeTab === "Transfers" ? (
            <TransfersTab />
          ) : activeTab === "Stock Count" ? (
            <StockCountTab />
          ) : activeTab === "Alerts" ? (
            <div className="space-y-3">
              <p className="flex items-center gap-1.5 text-xs text-mist-400"><Siren size={13} /> Every count is live — click a card to open Stock List pre-filtered.</p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  { key: "out", label: "Out of stock", count: outOfStock.length, tone: "action" as const },
                  { key: "low", label: "Low stock", count: lowStock.length, tone: "action" as const },
                  { key: "reorder", label: "Reorder level reached", count: reorderRows.length, tone: "amber" as const },
                  { key: "expiring", label: "Expiring soon", count: expiringRows.length, tone: "amber" as const },
                  { key: "expired", label: "Expired stock", count: expiredRows.length, tone: "action" as const },
                  { key: "quarantined", label: "Quarantined stock", count: quarantinedRows.length, tone: "action" as const },
                ].map((a) => (
                  <button
                    key={a.key}
                    onClick={() => { setTab("Stock List"); setSearchParams({ status: a.key }); }}
                    className={`card text-left transition hover:opacity-90 ${a.count === 0 ? "opacity-50" : ""}`}
                  >
                    <p className="font-display text-2xl font-bold text-mist-900">{a.count}</p>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-mist-500"><Badge tone={a.tone}>{a.label}</Badge></p>
                  </button>
                ))}
              </div>
              <QuarantinePanel />
            </div>
          ) : (
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

      {quarantineItemId && <QuarantineModal key={quarantineItemId} itemId={quarantineItemId} onClose={() => setQuarantineItemId(null)} />}

      <Modal
        open={Boolean(actionItem)}
        onClose={() => setActionItem(null)}
        title={actionItem ? `${actionItem.mode === "issue" ? "Issue" : actionItem.mode === "adjust" ? "Adjust" : "Write off"} — ${inv.itemById(actionItem.itemId)?.name ?? ""}` : ""}
        footer={<><Button variant="ghost" onClick={() => setActionItem(null)}>Cancel</Button><Button variant={actionItem?.mode === "writeoff" ? "action" : "primary"} onClick={submitAction}>Confirm</Button></>}
      >
        {actionItem && (
          <div className="space-y-4">
            {actionError && <p className="rounded-xl bg-action-50 px-3 py-2 text-sm text-action-700">{actionError}</p>}
            <p className="text-sm text-mist-500">Current on hand: {inv.itemById(actionItem.itemId)?.currentQty} {inv.itemById(actionItem.itemId)?.unit}</p>
            <Field label={actionItem.mode === "adjust" ? "New quantity *" : "Quantity *"}>
              <Input type="number" min={0} value={actionForm.quantity} onChange={(e) => setActionForm({ ...actionForm, quantity: e.target.value })} />
            </Field>
            <Field label="Location">
              <Select value={actionForm.locationId} onChange={(e) => setActionForm({ ...actionForm, locationId: e.target.value })} options={activeLocations.map((l) => ({ value: l.id, label: l.name }))} />
            </Field>
            {actionItem.mode === "issue" ? (
              <Field label="Purpose"><Input value={actionForm.purpose} onChange={(e) => setActionForm({ ...actionForm, purpose: e.target.value })} placeholder="e.g. Patient care" /></Field>
            ) : (
              <Field label="Reason *"><Input value={actionForm.reason} onChange={(e) => setActionForm({ ...actionForm, reason: e.target.value })} /></Field>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
