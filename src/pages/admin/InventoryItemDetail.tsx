import { ArrowLeft, Boxes, Pill } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Badge, Button, PageHeader, StatCard } from "@/components/ui/primitives";
import { Table, Row, Cell, EmptyRow } from "@/components/ui/Table";
import { useInventoryAccounting } from "@/store/accounting/useInventoryAccounting";
import { useInventoryLocations } from "@/store/useInventoryLocations";
import { usePharmacy } from "@/store/usePharmacy";
import { DEFAULT_STORE_LOCATION_ID, type CostLayer } from "@/data/accounting/inventory";
import { dateTime, naira, shortDate } from "@/lib/format";

export default function InventoryItemDetail() {
  const { itemId } = useParams();
  const navigate = useNavigate();
  const inv = useInventoryAccounting();
  const locations = useInventoryLocations();
  const pharmacy = usePharmacy();
  const item = itemId ? inv.itemById(itemId) : undefined;

  if (!item) {
    return (
      <div className="card py-16 text-center">
        <Boxes size={30} className="mx-auto mb-3 text-mist-300" />
        <h1 className="font-display text-xl font-bold text-mist-900">Item not found</h1>
        <p className="mt-1 text-sm text-mist-500">It may have been removed or belong to another tenant.</p>
        <Button className="mt-4" onClick={() => navigate("/inventory")}><ArrowLeft size={14} /> Back to inventory</Button>
      </div>
    );
  }

  const layers = inv.layersForItem(item.id);
  const live = layers.filter((l) => l.remainingQty > 0);
  const tracked = live.reduce((n, l) => n + l.remainingQty, 0);
  const untracked = Math.max(0, Math.round((item.currentQty - tracked) * 100) / 100);
  const available = inv.availableQtyOf(item.id);
  const held = Math.round((item.currentQty - available) * 100) / 100;
  const drug = pharmacy.drugForItem(item.id);
  const master = drug ? pharmacy.drugMasterFor(drug.id) : undefined;
  const movements = inv.movementsFor(item.id).slice(0, 25);

  const locationOf = (l: CostLayer) => locations.locationName(l.locationId ?? DEFAULT_STORE_LOCATION_ID);
  const stateOf = (l: CostLayer): { label: string; tone: "brand" | "action" | "amber" } => {
    if (l.status === "Quarantined") return { label: "Quarantined", tone: "action" };
    const expiry = inv.expiryStatus(l);
    return expiry === "Expired" ? { label: "Expired", tone: "action" } : expiry === "Expiring Soon" ? { label: "Expiring soon", tone: "amber" } : { label: "Active", tone: "brand" };
  };

  // one row per location that actually holds this item; stock with no batch record is held at the main store
  const byLocation = locations.locations
    .map((loc) => ({ loc, qty: Math.round((inv.balanceByLocation(item.id, loc.id) + (loc.id === DEFAULT_STORE_LOCATION_ID ? untracked : 0)) * 100) / 100 }))
    .filter((r) => r.qty > 0);

  return (
    <div>
      <PageHeader
        title={item.name}
        subtitle={`${item.sku} · ${item.category} · valued ${item.valuationMethod}`}
        actions={<Button variant="ghost" onClick={() => navigate("/inventory")}><ArrowLeft size={14} /> Inventory</Button>}
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="On hand" value={`${item.currentQty} ${item.unit}`} tone="brand" icon={<Boxes size={18} />} />
        <StatCard label="Available" value={`${available} ${item.unit}`} tone="mist" delay={0.05} hint={held > 0 ? `${held} in quarantine` : undefined} />
        <StatCard label="Stock value" value={naira(inv.valuationOf(item.id))} tone="mist" delay={0.1} />
        <StatCard label="Reorder level" value={item.reorderLevel} tone="mist" delay={0.15} hint={item.minLevel !== undefined ? `min ${item.minLevel}` : undefined} />
      </div>

      {drug && (
        <div className="card mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-sm text-mist-600">
            <Pill size={15} className="text-brand-600" />
            Linked to the pharmacy formulary drug <b className="text-mist-900">{drug.name}</b>
            {master?.controlledSubstance && <Badge tone="action">Controlled</Badge>}
            <Badge tone={master?.status === "Discontinued" ? "action" : master?.status === "Draft" ? "amber" : "brand"}>{master?.status ?? "Active"}</Badge>
          </p>
          <Link className="btn-ghost px-2 py-1 text-xs" to="/pharmacy">Open pharmacy</Link>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card p-0 lg:col-span-1">
          <p className="border-b border-mist-100 px-4 py-2.5 text-sm font-bold text-mist-700">Where it is</p>
          <Table columns={["Location", "Quantity"]}>
            {byLocation.length === 0 && <EmptyRow colSpan={2}>No stock on hand.</EmptyRow>}
            {byLocation.map(({ loc, qty }) => (
              <Row key={loc.id}>
                <Cell className="font-semibold">
                  {loc.name}
                  <span className="block text-[11px] font-normal text-mist-400">{loc.type}{loc.id === DEFAULT_STORE_LOCATION_ID && untracked > 0 ? ` · incl. ${untracked} with no batch record` : ""}</span>
                </Cell>
                <Cell>{qty} {item.unit}</Cell>
              </Row>
            ))}
          </Table>
        </div>

        <div className="card p-0 lg:col-span-2">
          <p className="border-b border-mist-100 px-4 py-2.5 text-sm font-bold text-mist-700">Batches ({live.length})</p>
          <Table columns={["Batch", "Location", "Remaining", "Unit cost", "Expiry", "Status"]}>
            {live.length === 0 && <EmptyRow colSpan={6}>No batch records — this item's stock predates batch tracking.</EmptyRow>}
            {live.map((l) => {
              const state = stateOf(l);
              return (
                <Row key={l.id}>
                  <Cell className="font-mono text-xs">{l.batchNumber ?? "—"}<span className="block text-[11px] text-mist-400">received {shortDate(l.date)}</span></Cell>
                  <Cell>{locationOf(l)}</Cell>
                  <Cell>{l.remainingQty}<span className="text-[11px] text-mist-400"> / {l.qty}</span></Cell>
                  <Cell>{naira(l.unitCost)}</Cell>
                  <Cell>{l.expiryDate ? shortDate(l.expiryDate) : "—"}</Cell>
                  <Cell>
                    <Badge tone={state.tone}>{state.label}</Badge>
                    {l.status === "Quarantined" && l.quarantineReason && <span className="block text-[11px] text-mist-500">{l.quarantineReason}</span>}
                  </Cell>
                </Row>
              );
            })}
          </Table>
        </div>
      </div>

      <div className="card mt-4 p-0">
        <p className="border-b border-mist-100 px-4 py-2.5 text-sm font-bold text-mist-700">Movement history</p>
        <Table columns={["When", "Type", "Quantity", "Value", "Location", "Reference"]}>
          {movements.length === 0 && <EmptyRow colSpan={6}>No movements recorded yet.</EmptyRow>}
          {movements.map((m) => (
            <Row key={m.id}>
              <Cell className="text-mist-400">{dateTime(m.createdAt)}</Cell>
              <Cell><Badge tone={m.type === "Receipt" || m.type === "Return" ? "brand" : m.type === "Write-off" ? "action" : "mist"}>{m.type}</Badge></Cell>
              <Cell className={m.qtyDelta < 0 ? "text-action-600" : "text-brand-700"}>{m.qtyDelta > 0 ? "+" : ""}{m.qtyDelta}</Cell>
              <Cell>{naira(Math.abs(m.value))}</Cell>
              <Cell>{m.locationId ? locations.locationName(m.locationId) : "—"}</Cell>
              <Cell className="font-mono text-xs text-mist-500">{m.reference ?? m.note ?? "—"}</Cell>
            </Row>
          ))}
        </Table>
      </div>
    </div>
  );
}
