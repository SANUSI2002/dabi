import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Boxes, Plus, LayoutDashboard, Siren } from "lucide-react";
import { PageHeader, Button, Badge, StatCard } from "@/components/ui/primitives";
import { Tabs } from "@/components/ui/Tabs";
import { Table, Row, Cell, EmptyRow } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select, Grid } from "@/components/ui/form";
import { useIsLiveEmr } from "@/emr-live/session";
import { useLiveEquipment, useLiveEquipmentLoad } from "@/emr-live/equipment";
import type { AssetCategory, AssetStatus } from "@/data/assets";
import type { InventoryItem } from "@/data/accounting/inventory";
import { useStoreLocationsSource, useStoresSource } from "@/emr-live/stores";
import { shortDate, dateTime, naira } from "@/lib/format";
import { QuarantineModal, QuarantinePanel } from "./inventory/Quarantine";
import { RequisitionsTab } from "./inventory/RequisitionsTab";
import { TransfersTab } from "./inventory/TransfersTab";
import { StockCountTab } from "./inventory/StockCountTab";

type Asset = { id: string; name: string; category: string; serial: string; location: string; cost: number; status: "Functional" | "Faulty" | "Under Repair" | "Disposed"; acquired: string };

// Live hospitals keep one asset register (Equipment & Maintenance); this tab shows it in its own terms.
const FROM_REGISTER: Record<AssetStatus, Asset["status"]> = { "In service": "Functional", "Under repair": "Under Repair", "Out of service": "Faulty", Retired: "Disposed" };
const TO_REGISTER: Record<Asset["status"], AssetStatus> = { Functional: "In service", "Under Repair": "Under repair", Faulty: "Out of service", Disposed: "Retired" };
const REGISTER_CATEGORY: Record<string, AssetCategory> = { Equipment: "General", "Cold Chain": "Cold chain", Furniture: "General", Vehicle: "General", IT: "IT", Other: "General" };
const ITEM_CATEGORIES: InventoryItem["category"][] = ["Consumables", "Reagents", "PPE", "Surgical Supplies", "Linen", "Medical Devices", "Drugs", "Other"];

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
  const inv = useStoresSource();
  const locations = useStoreLocationsSource();
  const activeLocations = locations.activeLocations();
  const live = useIsLiveEmr();
  useLiveEquipmentLoad(live);
  const register = useLiveEquipment((s) => s.assets);
  const shownAssets: Asset[] = live
    ? register.map((a) => ({ id: a.id, name: a.name, category: a.category, serial: a.serialNumber ?? a.tag, location: a.location, cost: a.cost ?? 0, status: FROM_REGISTER[a.status], acquired: a.commissionedOn }))
    : assets;
  const storesError = live && "error" in inv ? (inv as { error: string }).error : "";
  const [assetError, setAssetError] = useState("");
  // ---- live: new items and receiving stock (the demo receives through accounting goods receipts) ----
  const [itemOpen, setItemOpen] = useState(false);
  const [itemForm, setItemForm] = useState({ sku: "", name: "", category: "Consumables" as InventoryItem["category"], unit: "", reorderLevel: "", minLevel: "" });
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [receiveForm, setReceiveForm] = useState({ itemId: "", locationId: "", quantity: "", unitCost: "", batchNumber: "", expiryDate: "", reference: "" });
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  async function saveItem() {
    if (!("addItem" in inv) || !live) return;
    setBusy(true); setFormError("");
    const res = await (inv as { addItem: (i: object) => Promise<{ ok: boolean; error?: string }> }).addItem({
      sku: itemForm.sku.trim(), name: itemForm.name.trim(), category: itemForm.category, unit: itemForm.unit.trim(), reorderLevel: Number(itemForm.reorderLevel) || 0,
      ...(itemForm.minLevel !== "" ? { minLevel: Number(itemForm.minLevel) } : {}),
    });
    setBusy(false);
    if (!res.ok) { setFormError(res.error ?? "The item could not be added."); return; }
    setItemOpen(false);
  }
  async function saveReceipt() {
    setBusy(true); setFormError("");
    const res = await inv.receiveStock({
      itemId: receiveForm.itemId, qty: Number(receiveForm.quantity), unitCost: Number(receiveForm.unitCost), date: new Date().toISOString(), locationId: receiveForm.locationId,
      batchNumber: receiveForm.batchNumber.trim() || undefined, expiryDate: receiveForm.expiryDate || undefined, reference: receiveForm.reference.trim() || undefined,
    });
    setBusy(false);
    if (!res.ok) { setFormError(res.error ?? "The stock could not be received."); return; }
    setReceiveOpen(false);
  }
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

  async function submitAction() {
    if (!actionItem) return;
    setActionError("");
    const item = inv.itemById(actionItem.itemId);
    if (!item) return;
    const today = new Date().toISOString();
    let result: { ok: boolean; error?: string };
    if (actionItem.mode === "issue") {
      result = await inv.issueStock({ itemId: item.id, qty: Number(actionForm.quantity), date: today, locationId: actionForm.locationId, department: actionForm.department, purpose: actionForm.purpose });
    } else if (actionItem.mode === "adjust") {
      // Live stock is held per location: the new quantity is for the chosen location.
      const delta = Number(actionForm.quantity) - (live ? inv.balanceByLocation(item.id, actionForm.locationId) : item.currentQty);
      result = await inv.adjustStock({ itemId: item.id, qtyDelta: delta, date: today, reason: actionForm.reason, locationId: actionForm.locationId });
    } else {
      result = await inv.writeOff({ itemId: item.id, qty: Number(actionForm.quantity), date: today, reason: actionForm.reason, locationId: actionForm.locationId });
    }
    if (!result.ok) { setActionError(result.error ?? "This action could not be completed."); return; }
    setActionItem(null);
  }

  return (
    <div>
      <PageHeader
        title="Inventory"
        subtitle="Assets, general supplies & drug stock"
        actions={tab === "Assets" ? <Button onClick={() => { setAssetError(""); setOpen(true); }}><Plus size={15} /> Add Asset</Button>
          : live && (tab === "Stock List" || tab === "Dashboard") ? (
            <>
              <Button variant="ghost" onClick={() => { setFormError(""); setItemForm({ sku: "", name: "", category: "Consumables", unit: "", reorderLevel: "", minLevel: "" }); setItemOpen(true); }}><Plus size={15} /> New item</Button>
              <Button onClick={() => { setFormError(""); setReceiveForm({ itemId: items[0]?.id ?? "", locationId: locations.mainLocationId, quantity: "", unitCost: "", batchNumber: "", expiryDate: "", reference: "" }); setReceiveOpen(true); }}><Boxes size={15} /> Receive stock</Button>
            </>
          ) : undefined}
      />
      {storesError && <p role="alert" className="mb-4 rounded-xl bg-action-50 px-3 py-2 text-sm text-action-700">{storesError}</p>}

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
              {shownAssets.length === 0 && <EmptyRow colSpan={7}>No assets registered yet.</EmptyRow>}
              {shownAssets.map((a, i) => (
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
          <Button disabled={!f.name || (live && !f.serial.trim())} onClick={async () => {
            if (!live) { setAssets((a) => [{ ...f, id: Math.random().toString(), acquired: new Date().toISOString() }, ...a]); setOpen(false); return; }
            // Live: added to the hospital's equipment register (the serial number is its tag there).
            setAssetError("");
            const today = new Date().toISOString();
            try {
              await useLiveEquipment.getState().addAsset({
                tag: f.serial.trim().toUpperCase(), name: f.name.trim(), category: REGISTER_CATEGORY[f.category] ?? "General", location: f.location, commissionedOn: today, lastServicedOn: today,
                serviceIntervalDays: 180, serialNumber: f.serial.trim(), cost: f.cost || undefined, status: TO_REGISTER[f.status],
              });
              setOpen(false);
            } catch (cause) {
              setAssetError(cause instanceof Error ? cause.message : "The asset could not be added.");
            }
          }}>Add Asset</Button></>}
      >
        <div className="space-y-4">
          {assetError && <p role="alert" className="rounded-xl bg-action-50 px-3 py-2 text-sm text-action-700">{assetError}</p>}
          {live && <p className="rounded-xl bg-mist-50 px-3 py-2 text-xs text-mist-500">Added to the equipment register (Equipment &amp; Maintenance), where its servicing is scheduled.</p>}
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
        footer={<><Button variant="ghost" onClick={() => setActionItem(null)}>Cancel</Button><Button variant={actionItem?.mode === "writeoff" ? "action" : "primary"} onClick={() => void submitAction()}>Confirm</Button></>}
      >
        {actionItem && (
          <div className="space-y-4">
            {actionError && <p className="rounded-xl bg-action-50 px-3 py-2 text-sm text-action-700">{actionError}</p>}
            <p className="text-sm text-mist-500">
              Current on hand: {inv.itemById(actionItem.itemId)?.currentQty} {inv.itemById(actionItem.itemId)?.unit}
              {live && <> · at {locations.locationName(actionForm.locationId)}: {inv.balanceByLocation(actionItem.itemId, actionForm.locationId)}</>}
            </p>
            <Field label={actionItem.mode === "adjust" ? (live ? "New quantity at this location *" : "New quantity *") : "Quantity *"}>
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

      {/* live: a new store item */}
      <Modal
        open={itemOpen}
        onClose={() => setItemOpen(false)}
        title="New store item"
        footer={<><Button variant="ghost" onClick={() => setItemOpen(false)}>Cancel</Button><Button disabled={busy || !itemForm.sku.trim() || !itemForm.name.trim() || !itemForm.unit.trim()} onClick={() => void saveItem()}>{busy ? "Saving…" : "Add item"}</Button></>}
      >
        <div className="space-y-4">
          {formError && <p role="alert" className="rounded-xl bg-action-50 px-3 py-2 text-sm text-action-700">{formError}</p>}
          <Grid cols={2}>
            <Field label="SKU *"><Input value={itemForm.sku} onChange={(e) => setItemForm({ ...itemForm, sku: e.target.value.toUpperCase() })} placeholder="e.g. GLV-M" /></Field>
            <Field label="Name *"><Input value={itemForm.name} onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })} /></Field>
            <Field label="Category"><Select value={itemForm.category} onChange={(e) => setItemForm({ ...itemForm, category: e.target.value as InventoryItem["category"] })} options={ITEM_CATEGORIES} /></Field>
            <Field label="Unit *"><Input value={itemForm.unit} onChange={(e) => setItemForm({ ...itemForm, unit: e.target.value })} placeholder="e.g. box, pack, roll" /></Field>
            <Field label="Reorder level"><Input type="number" min={0} value={itemForm.reorderLevel} onChange={(e) => setItemForm({ ...itemForm, reorderLevel: e.target.value })} /></Field>
            <Field label="Minimum level"><Input type="number" min={0} value={itemForm.minLevel} onChange={(e) => setItemForm({ ...itemForm, minLevel: e.target.value })} /></Field>
          </Grid>
        </div>
      </Modal>

      {/* live: receiving stock */}
      <Modal
        open={receiveOpen}
        onClose={() => setReceiveOpen(false)}
        title="Receive stock"
        footer={<><Button variant="ghost" onClick={() => setReceiveOpen(false)}>Cancel</Button><Button disabled={busy || !receiveForm.itemId || !(Number(receiveForm.quantity) > 0) || receiveForm.unitCost === ""} onClick={() => void saveReceipt()}>{busy ? "Saving…" : "Receive"}</Button></>}
      >
        <div className="space-y-4">
          {formError && <p role="alert" className="rounded-xl bg-action-50 px-3 py-2 text-sm text-action-700">{formError}</p>}
          {items.length === 0 ? (
            <p className="text-sm text-mist-500">Add an item first, then receive stock against it.</p>
          ) : (
            <Grid cols={2}>
              <Field label="Item *"><Select value={receiveForm.itemId} onChange={(e) => setReceiveForm({ ...receiveForm, itemId: e.target.value })} options={items.map((i) => ({ value: i.id, label: `${i.name} (${i.unit})` }))} /></Field>
              <Field label="Into *"><Select value={receiveForm.locationId} onChange={(e) => setReceiveForm({ ...receiveForm, locationId: e.target.value })} options={activeLocations.map((l) => ({ value: l.id, label: l.name }))} /></Field>
              <Field label="Quantity *"><Input type="number" min={1} value={receiveForm.quantity} onChange={(e) => setReceiveForm({ ...receiveForm, quantity: e.target.value })} /></Field>
              <Field label="Unit cost (₦) *"><Input type="number" min={0} step="0.01" value={receiveForm.unitCost} onChange={(e) => setReceiveForm({ ...receiveForm, unitCost: e.target.value })} /></Field>
              <Field label="Batch / lot number"><Input value={receiveForm.batchNumber} onChange={(e) => setReceiveForm({ ...receiveForm, batchNumber: e.target.value })} /></Field>
              <Field label="Expiry date"><Input type="date" value={receiveForm.expiryDate} onChange={(e) => setReceiveForm({ ...receiveForm, expiryDate: e.target.value })} /></Field>
              <Field label="Reference"><Input value={receiveForm.reference} onChange={(e) => setReceiveForm({ ...receiveForm, reference: e.target.value })} placeholder="e.g. delivery note no." /></Field>
            </Grid>
          )}
        </div>
      </Modal>
    </div>
  );
}
