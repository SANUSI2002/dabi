import { useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, ArrowDownLeft, ArrowUpRight, Boxes, Check, History, PackagePlus, Plus, Search, X } from "lucide-react";
import {
  MASTER_DRUGS,
  masterDrug,
  usePharmacyCatalogue,
  type PharmacyOffer,
  type PharmacyStockMovementType,
} from "./catalogue";

const money = (amount: number) => new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(amount);
const control = "w-full rounded-xl border border-[#cfe0d8] bg-[#fbfefc] px-3 py-3 text-sm text-[#17342a] outline-none transition focus:border-[#0b8a63] focus:ring-2 focus:ring-[#0b8a63]/10";

export function InventoryView({ organizationId, branchId }: { organizationId: string; branchId: string }) {
  const allOffers = usePharmacyCatalogue((state) => state.offers);
  const allMovements = usePharmacyCatalogue((state) => state.movements);
  const offers = useMemo(() => allOffers.filter((offer) => offer.organizationId === organizationId), [allOffers, organizationId]);
  const movements = useMemo(() => (allMovements ?? []).filter((movement) => movement.organizationId === organizationId).slice().reverse(), [allMovements, organizationId]);
  const addOffer = usePharmacyCatalogue((state) => state.addOffer);
  const recordStockMovement = usePharmacyCatalogue((state) => state.recordStockMovement);
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [moving, setMoving] = useState<PharmacyOffer | null>(null);
  const [notice, setNotice] = useState("");

  const visible = useMemo(() => offers.filter((offer) => {
    const drug = masterDrug(offer.masterDrugId);
    return `${drug?.name} ${drug?.strength} ${offer.sku} ${offer.batchNumber ?? ""}`.toLowerCase().includes(query.toLowerCase());
  }), [offers, query]);
  const units = offers.reduce((total, offer) => total + (offer.stockQuantity ?? 0), 0);
  const stockValue = offers.reduce((total, offer) => total + (offer.stockQuantity ?? 0) * (offer.costPriceMinor ?? offer.priceMinor), 0);
  const lowStock = offers.filter((offer) => offer.stockStatus === "LOW_STOCK" || offer.stockStatus === "OUT_OF_STOCK").length;

  return <div className="space-y-5">
    {notice && <div className="rounded-2xl border border-[#b9dfcf] bg-[#eaf8f2] px-4 py-3 text-sm font-semibold text-[#087f5b]">{notice}</div>}
    <div className="grid gap-4 sm:grid-cols-3">
      <Metric label="Inventory items" value={String(offers.length)} detail={`${units.toLocaleString()} total units`} icon={<Boxes size={18}/>} />
      <Metric label="Stock value" value={money(stockValue)} detail="At recorded cost" icon={<ArrowUpRight size={18}/>} />
      <Metric label="Needs attention" value={String(lowStock)} detail="Low or out of stock" icon={<AlertTriangle size={18}/>} warning={lowStock > 0} />
    </div>

    <div className="rounded-[24px] border border-[#dbe9e2] bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#edf3ef] p-5">
        <div><p className="text-xs font-extrabold uppercase tracking-wider text-[#b06d10]">Branch inventory</p><p className="mt-1 text-sm text-[#70877d]">Add products, receive stock and maintain an immutable movement history.</p></div>
        <div className="flex flex-wrap gap-2">
          <label className="flex items-center gap-2 rounded-xl border border-[#cfe0d8] bg-[#fbfefc] px-3 py-2.5 text-[#70877d]"><Search size={15}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search inventory" className="w-40 bg-transparent text-xs outline-none" /></label>
          <button type="button" onClick={() => setAdding(true)} className="flex items-center gap-2 rounded-xl bg-[#0d2c22] px-4 py-2.5 text-xs font-bold text-white"><Plus size={15}/> Add inventory item</button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <div className="min-w-[900px]">
          <div className="grid grid-cols-[1.5fr_.7fr_.7fr_.7fr_.7fr_auto] gap-3 border-b border-[#edf3ef] px-5 py-3 text-[10px] font-extrabold uppercase tracking-wider text-[#8aa096]"><span>Product</span><span>Batch / expiry</span><span>Cost</span><span>Selling price</span><span>Available</span><span>Action</span></div>
          {visible.length === 0 ? <div className="p-10 text-center"><Boxes className="mx-auto text-[#9bb1a7]"/><p className="mt-3 font-bold text-[#17342a]">No inventory items yet</p><p className="mt-1 text-sm text-[#70877d]">Use “Add inventory item” to create your first stock record.</p></div> : visible.map((offer) => {
            const drug = masterDrug(offer.masterDrugId);
            return <div key={offer.id} className="grid grid-cols-[1.5fr_.7fr_.7fr_.7fr_.7fr_auto] items-center gap-3 border-b border-[#edf3ef] px-5 py-4 last:border-0">
              <div><p className="text-sm font-bold text-[#17342a]">{drug?.name} {drug?.strength}</p><p className="mt-1 text-[11px] text-[#82958c]">{offer.sku} · {offer.packSize}</p></div>
              <div className="text-xs text-[#5f786d]"><p>{offer.batchNumber || "Not set"}</p><p className="mt-1 text-[10px] text-[#9aad9f]">{offer.expiryDate || "No expiry"}</p></div>
              <span className="text-xs font-semibold text-[#355348]">{money(offer.costPriceMinor ?? 0)}</span>
              <span className="text-xs font-bold text-[#17342a]">{money(offer.priceMinor)}</span>
              <div><p className={`text-sm font-extrabold ${offer.stockStatus === "OUT_OF_STOCK" ? "text-red-600" : offer.stockStatus === "LOW_STOCK" ? "text-[#b06d10]" : "text-[#0b8a63]"}`}>{offer.stockQuantity ?? 0}</p><p className="text-[10px] uppercase text-[#82958c]">Reorder at {offer.reorderLevel ?? 10}</p></div>
              <button type="button" onClick={() => setMoving(offer)} className="flex items-center gap-2 rounded-xl border border-[#cfe0d8] px-3 py-2 text-xs font-bold text-[#355348] hover:border-[#0b8a63]"><PackagePlus size={14}/> Update stock</button>
            </div>;
          })}
        </div>
      </div>
    </div>

    <div className="rounded-[24px] border border-[#dbe9e2] bg-white p-5">
      <div className="flex items-center gap-2"><History size={17} className="text-[#b06d10]"/><h2 className="font-display text-lg font-bold text-[#17342a]">Stock movement history</h2></div>
      <p className="mt-1 text-xs text-[#70877d]">Transactions are appended, never edited. The backend will become the authoritative ledger when connected.</p>
      <div className="mt-4 overflow-x-auto"><div className="min-w-[760px]">
        {movements.length === 0 ? <p className="rounded-2xl bg-[#f7faf8] p-6 text-center text-sm text-[#82958c]">No stock movements recorded yet.</p> : movements.slice(0, 20).map((movement) => {
          const offer = offers.find((item) => item.id === movement.offerId); const drug = offer ? masterDrug(offer.masterDrugId) : undefined;
          return <div key={movement.id} className="grid grid-cols-[1.3fr_.8fr_.5fr_.8fr_1fr] items-center gap-3 border-b border-[#edf3ef] py-3 text-xs last:border-0"><span className="font-bold text-[#17342a]">{drug?.name ?? "Inventory item"}</span><span className="text-[#5f786d]">{movement.type.replaceAll("_", " ")}</span><span className={`font-extrabold ${movement.quantity > 0 ? "text-[#0b8a63]" : "text-red-600"}`}>{movement.quantity > 0 ? "+" : ""}{movement.quantity}</span><span className="text-[#5f786d]">Balance {movement.balanceAfter}</span><span className="text-right text-[#82958c]">{new Date(movement.occurredAt).toLocaleString()}</span></div>;
        })}
      </div></div>
    </div>

    {adding && <AddInventoryModal organizationId={organizationId} branchId={branchId} onClose={() => setAdding(false)} onSave={(input) => { addOffer(input); setAdding(false); setNotice("Inventory item added successfully."); }} />}
    {moving && <StockMovementModal offer={moving} onClose={() => setMoving(null)} onSave={(input) => { const result = recordStockMovement(input); if (result.error) return result.error; setMoving(null); setNotice("Stock updated and the movement was recorded."); return ""; }} />}
  </div>;
}

function Metric({ label, value, detail, icon, warning = false }: { label: string; value: string; detail: string; icon: ReactNode; warning?: boolean }) {
  return <div className="rounded-[22px] border border-[#dbe9e2] bg-white p-5"><div className={`grid h-9 w-9 place-items-center rounded-xl ${warning ? "bg-[#fff3dd] text-[#b06d10]" : "bg-[#e8f5ef] text-[#0b8a63]"}`}>{icon}</div><p className="mt-4 text-[10px] font-extrabold uppercase tracking-wider text-[#83968e]">{label}</p><p className="mt-1 font-display text-2xl font-extrabold text-[#17342a]">{value}</p><p className="mt-1 text-xs text-[#82958c]">{detail}</p></div>;
}

function AddInventoryModal({ organizationId, branchId, onClose, onSave }: { organizationId: string; branchId: string; onClose: () => void; onSave: (input: Omit<PharmacyOffer, "id" | "updatedAt">) => void }) {
  const [form, setForm] = useState({ masterDrugId: MASTER_DRUGS[0]?.id ?? "d1", sku: "", packSize: "", batchNumber: "", expiryDate: "", costPriceMinor: 0, priceMinor: 0, stockQuantity: 0, reorderLevel: 10 });
  const selected = masterDrug(form.masterDrugId);
  const valid = form.sku.trim() && form.packSize.trim() && form.priceMinor > 0;
  return <Modal title="Add inventory item" eyebrow="Inventory setup" onClose={onClose}>
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Master drug" wide><select value={form.masterDrugId} onChange={(event) => setForm({ ...form, masterDrugId: event.target.value })} className={control}>{MASTER_DRUGS.map((drug) => <option key={drug.id} value={drug.id}>{drug.name} · {drug.strength} · {drug.form}</option>)}</select></Field>
      <Field label="SKU"><input value={form.sku} onChange={(event) => setForm({ ...form, sku: event.target.value })} className={control} placeholder="e.g. HVN-PARA-500-20"/></Field>
      <Field label="Pack size"><input value={form.packSize} onChange={(event) => setForm({ ...form, packSize: event.target.value })} className={control} placeholder="e.g. 20 tablets"/></Field>
      <Field label="Batch number"><input value={form.batchNumber} onChange={(event) => setForm({ ...form, batchNumber: event.target.value })} className={control} placeholder="Supplier batch"/></Field>
      <Field label="Expiry date"><input type="date" value={form.expiryDate} onChange={(event) => setForm({ ...form, expiryDate: event.target.value })} className={control}/></Field>
      <Field label="Cost price (NGN)"><input type="number" min="0" value={form.costPriceMinor} onChange={(event) => setForm({ ...form, costPriceMinor: Number(event.target.value) })} className={control}/></Field>
      <Field label="Selling price (NGN)"><input type="number" min="0" value={form.priceMinor} onChange={(event) => setForm({ ...form, priceMinor: Number(event.target.value) })} className={control}/></Field>
      <Field label="Opening stock"><input type="number" min="0" value={form.stockQuantity} onChange={(event) => setForm({ ...form, stockQuantity: Number(event.target.value) })} className={control}/></Field>
      <Field label="Reorder level"><input type="number" min="0" value={form.reorderLevel} onChange={(event) => setForm({ ...form, reorderLevel: Number(event.target.value) })} className={control}/></Field>
    </div>
    <div className="mt-6 flex justify-end gap-3"><button onClick={onClose} className="rounded-xl px-4 py-2.5 text-xs font-bold text-[#5f786d]">Cancel</button><button disabled={!valid} onClick={() => onSave({ organizationId, branchId, masterDrugId: form.masterDrugId, sku: form.sku.trim(), packSize: form.packSize.trim(), batchNumber: form.batchNumber.trim(), expiryDate: form.expiryDate, costPriceMinor: form.costPriceMinor, priceMinor: form.priceMinor, reorderLevel: form.reorderLevel, currency: "NGN", stockQuantity: form.stockQuantity, stockStatus: form.stockQuantity === 0 ? "OUT_OF_STOCK" : form.stockQuantity <= form.reorderLevel ? "LOW_STOCK" : "IN_STOCK", prescriptionRequired: selected?.prescriptionRequired ?? false, marketplaceStatus: "DRAFT", pickupEnabled: true, deliveryEnabled: true })} className="flex items-center gap-2 rounded-xl bg-[#0d2c22] px-4 py-2.5 text-xs font-bold text-white disabled:opacity-40"><Check size={15}/> Add item</button></div>
  </Modal>;
}

function StockMovementModal({ offer, onClose, onSave }: { offer: PharmacyOffer; onClose: () => void; onSave: (input: { organizationId: string; branchId: string; offerId: string; type: PharmacyStockMovementType; quantity: number; reference: string; notes?: string }) => string }) {
  const [type, setType] = useState<PharmacyStockMovementType>("RECEIPT");
  const [quantity, setQuantity] = useState(1);
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const drug = masterDrug(offer.masterDrugId);
  const submit = () => setError(onSave({ organizationId: offer.organizationId, branchId: offer.branchId, offerId: offer.id, type, quantity, reference: reference.trim() || type.replaceAll("_", " "), notes: notes.trim() }));
  return <Modal title={`Update ${drug?.name ?? "stock"}`} eyebrow={`Available: ${offer.stockQuantity ?? 0} units`} onClose={onClose}>
    {error && <p className="mb-4 rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{error}</p>}
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Movement type"><select value={type} onChange={(event) => setType(event.target.value as PharmacyStockMovementType)} className={control}><option value="RECEIPT">Receive from supplier</option><option value="RETURN">Customer / branch return</option><option value="ADJUSTMENT_IN">Positive adjustment</option><option value="ADJUSTMENT_OUT">Negative adjustment</option><option value="SALE">Sale / issue</option></select></Field>
      <Field label="Quantity"><input type="number" min="1" value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} className={control}/></Field>
      <Field label="Reference"><input value={reference} onChange={(event) => setReference(event.target.value)} className={control} placeholder="PO, invoice or reason"/></Field>
      <Field label="Notes"><input value={notes} onChange={(event) => setNotes(event.target.value)} className={control} placeholder="Optional note"/></Field>
    </div>
    <div className="mt-6 flex justify-end gap-3"><button onClick={onClose} className="rounded-xl px-4 py-2.5 text-xs font-bold text-[#5f786d]">Cancel</button><button onClick={submit} disabled={quantity <= 0} className="flex items-center gap-2 rounded-xl bg-[#0d2c22] px-4 py-2.5 text-xs font-bold text-white disabled:opacity-40">{type === "ADJUSTMENT_OUT" || type === "SALE" ? <ArrowUpRight size={15}/> : <ArrowDownLeft size={15}/>} Record movement</button></div>
  </Modal>;
}

function Modal({ title, eyebrow, onClose, children }: { title: string; eyebrow: string; onClose: () => void; children: ReactNode }) {
  return <div className="fixed inset-0 z-50 grid place-items-center bg-[#071b14]/60 p-4"><div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-[28px] bg-white p-6 shadow-2xl"><div className="flex items-start justify-between"><div><p className="text-[10px] font-extrabold uppercase tracking-[.18em] text-[#b06d10]">{eyebrow}</p><h2 className="mt-1 font-display text-2xl font-extrabold text-[#17342a]">{title}</h2></div><button onClick={onClose} className="rounded-xl p-2 text-[#82958c] hover:bg-[#f3f8f5]"><X size={18}/></button></div><div className="mt-6">{children}</div></div></div>;
}

function Field({ label, wide = false, children }: { label: string; wide?: boolean; children: ReactNode }) {
  return <label className={wide ? "block sm:col-span-2" : "block"}><span className="mb-1.5 block text-xs font-bold text-[#5b766a]">{label}</span>{children}</label>;
}
