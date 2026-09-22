import { useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell, Boxes, Check, ClipboardList, CreditCard, Eye, EyeOff, ExternalLink, FileBarChart, Home,
  LogOut, MapPin, Menu, MessageSquare, PackageCheck, Pencil, Pill, Plus, Search, Settings2,
  ShieldCheck, ShoppingBag, Store, Truck, UsersRound, X,
} from "lucide-react";
import { useAuth } from "@/store/useAuth";
import { useTenant } from "@/store/useTenant";
import { developmentFixturesEnabled } from "@/config/runtime";
import { buildMarketplaceProjection, MASTER_DRUGS, masterDrug, usePharmacyCatalogue, type PharmacyOffer, type PharmacyPublicationStatus } from "./catalogue";
import { InventoryView } from "./InventoryView";
import { SettingsView } from "./SettingsView";
import { DispensingView, OrdersView, QuotesView, RequestsView } from "./FulfilmentViews";
import { usePharmacyWorkflow } from "./workflow";

type Section = "overview" | "requests" | "quotes" | "orders" | "dispensing" | "inventory" | "catalogue" | "patients" | "messages" | "delivery" | "branches" | "staff" | "finance" | "reports" | "reviews" | "marketplace" | "settings";
const storeControl = "w-full rounded-xl border border-[#cfe0d8] bg-[#fbfefc] px-3 py-3 text-sm text-[#17342a] outline-none transition focus:border-[#0b8a63] focus:ring-2 focus:ring-[#0b8a63]/10";

const sections: { key: Section; label: string; icon: typeof Home; group?: string }[] = [
  { key: "overview", label: "Overview", icon: Home },
  { key: "requests", label: "Prescription requests", icon: ClipboardList, group: "Fulfilment" },
  { key: "quotes", label: "Quotes", icon: FileBarChart, group: "Fulfilment" },
  { key: "orders", label: "Orders", icon: ShoppingBag, group: "Fulfilment" },
  { key: "dispensing", label: "Dispensing queue", icon: Pill, group: "Fulfilment" },
  { key: "inventory", label: "Inventory", icon: Boxes, group: "Operations" },
  { key: "catalogue", label: "Catalogue", icon: Store, group: "Operations" },
  { key: "patients", label: "Patients", icon: UsersRound, group: "Operations" },
  { key: "messages", label: "Messages", icon: MessageSquare, group: "Operations" },
  { key: "delivery", label: "Pickup & delivery", icon: Truck, group: "Operations" },
  { key: "branches", label: "Branches", icon: MapPin, group: "Organization" },
  { key: "staff", label: "Staff & roles", icon: UsersRound, group: "Organization" },
  { key: "finance", label: "Finance", icon: CreditCard, group: "Business" },
  { key: "reports", label: "Reports & analytics", icon: FileBarChart, group: "Business" },
  { key: "reviews", label: "Reviews", icon: ShieldCheck, group: "Business" },
  { key: "marketplace", label: "Marketplace", icon: Store, group: "Business" },
  { key: "settings", label: "Settings", icon: Settings2, group: "Workspace" },
];

function PharmacyLogo() {
  return <div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#f5a524] text-[#13231e] shadow-[0_8px_20px_-10px_rgba(245,165,36,.9)]"><Pill size={22} strokeWidth={2.4}/></span><span><b className="block font-display text-[17px] tracking-[-.02em] text-white">Sabi <span className="text-[#f5b94e]">Pharmacy</span></b><span className="block text-[10px] font-semibold uppercase tracking-[.18em] text-white/40">Operator workspace</span></span></div>;
}

function EmptyPanel({ title, description, action }: { title: string; description: string; action?: string }) {
  return <div className="flex min-h-48 flex-col items-center justify-center rounded-[24px] border border-dashed border-[#c9ddd5] bg-[#fbfefc] px-6 text-center"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#e8f5ef] text-[#0b8a63]"><PackageCheck size={21}/></span><h3 className="mt-4 font-display text-base font-bold text-[#17342a]">{title}</h3><p className="mt-2 max-w-md text-sm leading-6 text-[#70877d]">{description}</p>{action&&<button disabled className="mt-5 rounded-xl bg-[#dce8e2] px-4 py-2 text-xs font-bold text-[#8ca198]">{action}</button>}</div>;
}

function SectionView({ section, organizationId, organizationName, branchId, onNavigate }: { section: Section; organizationId: string; organizationName: string; branchId: string; onNavigate: (section: Section) => void }) {
  const content: Record<Section, { eyebrow: string; title: string; description: string; action?: string }> = {
    overview: { eyebrow: "Branch command page", title: "Good morning, pharmacy team.", description: "Your operational queue will appear here as prescription requests, paid orders and inventory events arrive." },
    requests: { eyebrow: "Fulfilment", title: "Prescription requests", description: "Incoming prescriptions and their branch-specific review status will appear here.", action: "New requests unavailable" },
    quotes: { eyebrow: "Fulfilment", title: "Quotes", description: "Build, submit and track patient quotations once the pharmacy marketplace service is connected.", action: "Quote builder unavailable" },
    orders: { eyebrow: "Fulfilment", title: "Orders", description: "Paid orders will move through confirmation, preparation, pickup or delivery and completion.", action: "Orders unavailable" },
    dispensing: { eyebrow: "Clinical operations", title: "Dispensing queue", description: "Pharmacist-controlled dispensing starts only after payment and stock reservation are confirmed.", action: "Dispensing queue unavailable" },
    inventory: { eyebrow: "Operations", title: "Inventory", description: "Products, batches, expiry, reservations and the immutable stock movement ledger will be shown here.", action: "Live inventory unavailable" },
    catalogue: { eyebrow: "Operations", title: "Drug catalogue", description: "Create tenant-owned offers from the governed master drug list. Price, pack size, stock and publication are controlled by your pharmacy." },
    patients: { eyebrow: "Operations", title: "Patients", description: "Only patients who have interacted with this pharmacy will be visible, limited to fulfilment context.", action: "Patient history unavailable" },
    messages: { eyebrow: "Operations", title: "Messages", description: "Contextual patient conversations will be anchored to a prescription request, quote or order.", action: "Messaging unavailable" },
    delivery: { eyebrow: "Fulfilment", title: "Pickup & delivery", description: "Track pickup codes, courier assignment, proof of delivery and delivery exceptions here.", action: "Delivery service unavailable" },
    branches: { eyebrow: "Organization", title: "Branches", description: "Switch between permitted branches without changing the signed-in employee account.", action: "Branch service unavailable" },
    staff: { eyebrow: "Organization", title: "Staff & roles", description: "Granular pharmacy permissions will be enforced by the backend before staff access is granted.", action: "Staff service unavailable" },
    finance: { eyebrow: "Business", title: "Finance", description: "Transactions, refunds, settlements and reconciliation require a server-authoritative finance service.", action: "Finance service unavailable" },
    reports: { eyebrow: "Business", title: "Reports & analytics", description: "Reports will be generated from authoritative orders, inventory movements and settlement events.", action: "Reports unavailable" },
    reviews: { eyebrow: "Business", title: "Reviews", description: "Verified patient reviews and public replies will appear here after the review service is connected.", action: "Reviews unavailable" },
    marketplace: { eyebrow: "Business", title: "Marketplace storefront", description: "Control what patients see on the Sabi Health pharmacy marketplace. Only explicitly published offers are public." },
    settings: { eyebrow: "Workspace", title: "Pharmacy settings", description: "Manage branch hours, marketplace preferences, delivery, settlement and integrations after setup is connected.", action: "Settings service unavailable" },
  };
  const view = content[section];
  return <div><div className="mb-7"><p className="text-[11px] font-extrabold uppercase tracking-[.18em] text-[#b06d10]">{view.eyebrow}</p><h1 className="mt-2 font-display text-3xl font-extrabold tracking-[-.045em] text-[#17342a]">{view.title}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[#70877d]">{view.description}</p></div>{section === "overview" ? <DashboardHome organizationId={organizationId} onNavigate={onNavigate}/> : section === "requests" ? <RequestsView organizationId={organizationId} branchId={branchId} onNavigate={onNavigate}/> : section === "quotes" ? <QuotesView organizationId={organizationId} branchId={branchId} onNavigate={onNavigate}/> : section === "orders" ? <OrdersView organizationId={organizationId} branchId={branchId}/> : section === "dispensing" ? <DispensingView organizationId={organizationId} branchId={branchId}/> : section === "inventory" ? <InventoryView organizationId={organizationId} branchId={branchId}/> : section === "catalogue" ? <CatalogueView organizationId={organizationId} branchId={branchId}/> : section === "marketplace" ? <MarketplaceView organizationId={organizationId} onNavigate={onNavigate}/> : section === "settings" ? <SettingsView organizationId={organizationId} organizationName={organizationName}/> : <EmptyPanel title={`No ${view.title.toLowerCase()} to show`} description="This workspace is ready for the live pharmacy service. No records have been substituted with generated data." action={view.action}/>}</div>;
}

function formatNaira(amount: number) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(amount);
}

function statusLabel(status: PharmacyPublicationStatus) {
  return status.replace("_", " ").toLowerCase().replace(/^./, (value) => value.toUpperCase());
}

function CatalogueView({ organizationId, branchId }: { organizationId: string; branchId: string }) {
  const allOffers = usePharmacyCatalogue((state) => state.offers);
  const offers = useMemo(() => allOffers.filter((offer) => offer.organizationId === organizationId), [allOffers, organizationId]);
  const config = usePharmacyCatalogue((state) => state.configs.find((item) => item.organizationId === organizationId));
  const addOffer = usePharmacyCatalogue((state) => state.addOffer);
  const updateOffer = usePharmacyCatalogue((state) => state.updateOffer);
  const setPublicationStatus = usePharmacyCatalogue((state) => state.setPublicationStatus);
  const [editing, setEditing] = useState<PharmacyOffer | null>(null);
  const [showForm, setShowForm] = useState(false);
  const previewMarketplace = () => {
    const projection = buildMarketplaceProjection(organizationId, { offers, configs: config ? [config] : [] });
    const patientPortal = String(import.meta.env.VITE_PATIENT_PORTAL_URL ?? "http://127.0.0.1:5174").replace(/\/$/, "");
    const url = new URL(`${patientPortal}/pharmacy-market`);
    url.searchParams.set("marketplacePreview", JSON.stringify(projection));
    window.open(url.toString(), "_blank", "noopener,noreferrer");
  };

  if (!developmentFixturesEnabled) return <EmptyPanel title="Catalogue service unavailable" description="The live catalogue API is not connected in this environment. No drug or price records have been fabricated." />;

  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-[#dbe9e2] bg-white p-5">
      <div><p className="text-xs font-extrabold uppercase tracking-wider text-[#b06d10]">Tenant-owned offers</p><p className="mt-1 text-sm text-[#70877d]">The master drug list is shared; every pharmacy controls its own price, stock and branches.</p></div>
      <div className="flex flex-wrap gap-2"><button type="button" disabled={!config?.publicListingEnabled || !offers.some((offer) => offer.marketplaceStatus === "PUBLISHED")} onClick={previewMarketplace} className="flex items-center gap-2 rounded-xl border border-[#cfe0d8] bg-white px-4 py-2.5 text-xs font-bold text-[#355348] hover:border-[#0b8a63] disabled:cursor-not-allowed disabled:opacity-40"><ExternalLink size={15}/> Preview marketplace</button><button type="button" onClick={() => { setEditing(null); setShowForm(true); }} className="flex items-center gap-2 rounded-xl bg-[#0d2c22] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#174a3a]"><Plus size={15}/> Add drug</button></div>
    </div>
    <div className="overflow-hidden rounded-[24px] border border-[#dbe9e2] bg-white">
      <div className="grid grid-cols-[1.7fr_.8fr_.7fr_.8fr_.8fr_auto] gap-3 border-b border-[#edf3ef] px-5 py-3 text-[10px] font-extrabold uppercase tracking-wider text-[#8aa096]"><span>Drug / SKU</span><span>Branch</span><span>Price</span><span>Stock</span><span>Marketplace</span><span /></div>
      {offers.length === 0 ? <div className="p-8 text-center text-sm text-[#70877d]">No offers yet. Add a drug to this pharmacy tenant; it stays private until published.</div> : offers.map((offer) => { const drug = masterDrug(offer.masterDrugId); return <div key={offer.id} className="grid grid-cols-[1.7fr_.8fr_.7fr_.8fr_.8fr_auto] items-center gap-3 border-b border-[#edf3ef] px-5 py-4 last:border-0"><div><p className="text-sm font-bold text-[#17342a]">{drug?.name} {drug?.strength}</p><p className="mt-1 text-[11px] text-[#82958c]">{drug?.form} · {offer.packSize} · {offer.sku}</p></div><span className="text-xs text-[#5f786d]">{offer.branchId.endsWith("-1") ? "Main branch" : offer.branchId}</span><span className="text-sm font-bold text-[#17342a]">{formatNaira(offer.priceMinor)}</span><span className={`text-xs font-bold ${offer.stockStatus === "OUT_OF_STOCK" ? "text-red-600" : offer.stockStatus === "LOW_STOCK" ? "text-[#b06d10]" : "text-[#0b8a63]"}`}>{offer.stockQuantity ?? "—"} · {offer.stockStatus.replaceAll("_", " ")}</span><button type="button" onClick={() => setPublicationStatus(offer.id, organizationId, offer.marketplaceStatus === "PUBLISHED" ? "PAUSED" : "PUBLISHED")} className={`flex items-center gap-1 text-xs font-bold ${offer.marketplaceStatus === "PUBLISHED" ? "text-[#0b8a63]" : "text-[#82958c]"}`}>{offer.marketplaceStatus === "PUBLISHED" ? <Eye size={14}/> : <EyeOff size={14}/>} {statusLabel(offer.marketplaceStatus)}</button><button type="button" aria-label={`Edit ${drug?.name}`} onClick={() => { setEditing(offer); setShowForm(true); }} className="rounded-lg p-2 text-[#70877d] hover:bg-[#f3f8f5] hover:text-[#0b8a63]"><Pencil size={15}/></button></div>; })}
    </div>
    {showForm && <OfferForm organizationId={organizationId} branchId={branchId} initial={editing} onClose={() => setShowForm(false)} onSave={(input) => { if (editing) updateOffer(editing.id, organizationId, input); else addOffer({ ...input, organizationId }); setShowForm(false); }} />}
  </div>;
}

function OfferForm({ organizationId, branchId, initial, onClose, onSave }: { organizationId: string; branchId: string; initial: PharmacyOffer | null; onClose: () => void; onSave: (input: Partial<PharmacyOffer> & { branchId: string; masterDrugId: string; sku: string; packSize: string; priceMinor: number; currency: "NGN"; stockQuantity: number | null; stockStatus: PharmacyOffer["stockStatus"]; prescriptionRequired: boolean; marketplaceStatus: PharmacyPublicationStatus; pickupEnabled: boolean; deliveryEnabled: boolean }) => void }) {
  const selected: PharmacyOffer = initial ?? { id: "draft", organizationId, updatedAt: "", masterDrugId: MASTER_DRUGS[0]?.id ?? "d1", branchId, sku: "", packSize: "", priceMinor: 0, stockQuantity: 0, stockStatus: "OUT_OF_STOCK", prescriptionRequired: MASTER_DRUGS[0]?.prescriptionRequired ?? false, marketplaceStatus: "DRAFT", pickupEnabled: true, deliveryEnabled: true, currency: "NGN" };
  const [form, setForm] = useState<PharmacyOffer>(selected);
  const selectedMaster = masterDrug(form.masterDrugId);
  const set = (patch: Partial<typeof form>) => setForm((current) => ({ ...current, ...patch }));
  const submit = () => onSave({ ...form, priceMinor: Number(form.priceMinor) || 0, stockQuantity: form.stockQuantity === null ? null : Number(form.stockQuantity) || 0, prescriptionRequired: selectedMaster?.prescriptionRequired ?? form.prescriptionRequired });
  return <div className="fixed inset-0 z-50 grid place-items-center bg-[#071b14]/60 p-4"><div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[28px] bg-white p-6 shadow-2xl"><div className="flex items-start justify-between"><div><p className="text-[10px] font-extrabold uppercase tracking-[.18em] text-[#b06d10]">{initial ? "Edit offer" : "Add drug offer"}</p><h2 className="mt-1 font-display text-2xl font-extrabold text-[#17342a]">Configure pharmacy listing</h2><p className="mt-2 text-sm text-[#70877d]">This offer belongs to this pharmacy only. Publishing makes it visible on the Sabi Health marketplace.</p></div><button type="button" onClick={onClose} className="rounded-xl p-2 text-[#82958c] hover:bg-[#f3f8f5]"><X size={18}/></button></div><div className="mt-6 grid gap-4 sm:grid-cols-2"><label className="block sm:col-span-2"><span className="mb-1.5 block text-xs font-bold text-[#5b766a]">Master drug</span><select value={form.masterDrugId} onChange={(event) => { const next = masterDrug(event.target.value); set({ masterDrugId: event.target.value, prescriptionRequired: next?.prescriptionRequired ?? false }); }} className="w-full rounded-xl border border-[#cfe0d8] bg-[#fbfefc] px-3 py-3 text-sm">{MASTER_DRUGS.map((drug) => <option key={drug.id} value={drug.id}>{drug.name} · {drug.strength} · {drug.form}</option>)}</select></label><label className="block"><span className="mb-1.5 block text-xs font-bold text-[#5b766a]">SKU</span><input value={form.sku} onChange={(event) => set({ sku: event.target.value })} placeholder="e.g. HVN-PARA-500-20" className="w-full rounded-xl border border-[#cfe0d8] px-3 py-3 text-sm" /></label><label className="block"><span className="mb-1.5 block text-xs font-bold text-[#5b766a]">Pack size</span><input value={form.packSize} onChange={(event) => set({ packSize: event.target.value })} placeholder="20 tablets" className="w-full rounded-xl border border-[#cfe0d8] px-3 py-3 text-sm" /></label><label className="block"><span className="mb-1.5 block text-xs font-bold text-[#5b766a]">Price (NGN)</span><input type="number" min="0" value={form.priceMinor} onChange={(event) => set({ priceMinor: Number(event.target.value) })} className="w-full rounded-xl border border-[#cfe0d8] px-3 py-3 text-sm" /></label><label className="block"><span className="mb-1.5 block text-xs font-bold text-[#5b766a]">Stock quantity</span><input type="number" min="0" value={form.stockQuantity ?? ""} onChange={(event) => { const quantity = event.target.value === "" ? null : Number(event.target.value); set({ stockQuantity: quantity, stockStatus: quantity === null || quantity === 0 ? "OUT_OF_STOCK" : quantity < 10 ? "LOW_STOCK" : "IN_STOCK" }); }} className="w-full rounded-xl border border-[#cfe0d8] px-3 py-3 text-sm" /></label><label className="block"><span className="mb-1.5 block text-xs font-bold text-[#5b766a]">Branch</span><input value="Main branch" disabled className="w-full rounded-xl border border-[#cfe0d8] bg-[#f3f7f5] px-3 py-3 text-sm text-[#70877d]"/></label><label className="block"><span className="mb-1.5 block text-xs font-bold text-[#5b766a]">Publication</span><select value={form.marketplaceStatus} onChange={(event) => set({ marketplaceStatus: event.target.value as PharmacyPublicationStatus })} className="w-full rounded-xl border border-[#cfe0d8] bg-[#fbfefc] px-3 py-3 text-sm"><option value="DRAFT">Draft — private</option><option value="PENDING_REVIEW">Submit for review</option><option value="PUBLISHED">Publish to marketplace</option><option value="PAUSED">Paused</option></select></label></div><div className="mt-4 flex flex-wrap gap-4 text-xs font-semibold text-[#5f786d]"><label className="flex items-center gap-2"><input type="checkbox" checked={form.pickupEnabled} onChange={(event) => set({ pickupEnabled: event.target.checked })} /> Pickup available</label><label className="flex items-center gap-2"><input type="checkbox" checked={form.deliveryEnabled} onChange={(event) => set({ deliveryEnabled: event.target.checked })} /> Delivery available</label></div><div className="mt-7 flex justify-end gap-3 border-t border-[#edf3ef] pt-5"><button type="button" onClick={onClose} className="rounded-xl px-4 py-2.5 text-xs font-bold text-[#5f786d]">Cancel</button><button type="button" onClick={submit} disabled={!form.sku || !form.packSize || !form.priceMinor} className="flex items-center gap-2 rounded-xl bg-[#0d2c22] px-4 py-2.5 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"><Check size={15}/> Save offer</button></div></div></div>;
}

function MarketplaceView({ organizationId, onNavigate }: { organizationId: string; onNavigate: (section: Section) => void }) {
  const allOffers = usePharmacyCatalogue((state) => state.offers);
  const offers = useMemo(() => allOffers.filter((offer) => offer.organizationId === organizationId), [allOffers, organizationId]);
  const config = usePharmacyCatalogue((state) => state.configs.find((item) => item.organizationId === organizationId));
  const setConfig = usePharmacyCatalogue((state) => state.setConfig);
  const [draft, setDraft] = useState(config ?? { organizationId, storefrontName: "", publicListingEnabled: false, showPrices: true, pickupEnabled: true, deliveryEnabled: true, orderLeadTimeMinutes: 45, description: "", address: "", phone: "", weekdayHours: "08:00 AM - 08:00 PM", weekendHours: "09:00 AM - 06:00 PM", deliveryFeeMinor: 0, minimumOrderMinor: 0 });
  const [saved, setSaved] = useState(false);
  const publicOffers = offers.filter((offer) => offer.marketplaceStatus === "PUBLISHED");
  const published = publicOffers.length;
  const openStorefront = () => {
    const projection = buildMarketplaceProjection(organizationId, { offers, configs: [draft] });
    const patientPortal = String(import.meta.env.VITE_PATIENT_PORTAL_URL ?? "http://127.0.0.1:5174").replace(/\/$/, "");
    const url = new URL(`${patientPortal}/pharmacy-market`);
    url.searchParams.set("marketplacePreview", JSON.stringify(projection));
    window.open(url.toString(), "_blank", "noopener,noreferrer");
  };
  if (!developmentFixturesEnabled) return <EmptyPanel title="Marketplace configuration unavailable" description="The marketplace API is not connected in this environment. Public listing settings will be enabled when the backend is ready." />;
  return <div className="space-y-5">
    {saved && <div className="rounded-2xl border border-[#b9dfcf] bg-[#eaf8f2] px-4 py-3 text-sm font-semibold text-[#087f5b]">Storefront settings saved. Your published catalogue is ready to preview.</div>}
    <div className="grid gap-5 xl:grid-cols-[1.1fr_.9fr]">
      <div className="rounded-[24px] border border-[#dbe9e2] bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-extrabold uppercase tracking-wider text-[#b06d10]">Public storefront</p><h2 className="mt-1 font-display text-xl font-bold text-[#17342a]">What patients can see</h2></div><button type="button" disabled={!draft.publicListingEnabled || published === 0} onClick={openStorefront} className="flex items-center gap-2 rounded-xl bg-[#0d2c22] px-4 py-2.5 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"><ExternalLink size={15}/> Open customer storefront</button></div>
        <div className="mt-5 rounded-2xl bg-[#f5fbf7] p-4"><div className="flex items-center justify-between"><span className="text-sm font-bold text-[#17342a]">Marketplace listing</span><span className={`rounded-full px-2 py-1 text-[10px] font-extrabold uppercase ${draft.publicListingEnabled ? "bg-[#d9f3e7] text-[#0b8a63]" : "bg-[#eef2f0] text-[#82958c]"}`}>{draft.publicListingEnabled ? "Visible" : "Hidden"}</span></div><p className="mt-2 text-xs leading-5 text-[#70877d]">Only published products appear. Inventory and draft products remain private.</p></div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3"><Stat label="All products" value={offers.length}/><Stat label="Published" value={published} positive/><Stat label="Private" value={offers.length - published}/></div>
        <div className="mt-6"><div className="flex items-center justify-between"><h3 className="text-sm font-bold text-[#17342a]">Store catalogue preview</h3><button onClick={() => onNavigate("catalogue")} className="text-xs font-bold text-[#0b8a63]">Manage catalogue</button></div><div className="mt-3 grid gap-3 sm:grid-cols-2">
          {publicOffers.length === 0 ? <div className="col-span-full rounded-2xl border border-dashed border-[#c9ddd5] p-6 text-center"><p className="text-sm font-bold text-[#17342a]">Nothing is published yet</p><p className="mt-1 text-xs text-[#70877d]">Add inventory, then publish the product from Catalogue.</p><button onClick={() => onNavigate("inventory")} className="mt-4 rounded-xl bg-[#e8f5ef] px-4 py-2 text-xs font-bold text-[#087f5b]">Add inventory</button></div> : publicOffers.map((offer) => { const drug = masterDrug(offer.masterDrugId); return <div key={offer.id} className="rounded-2xl border border-[#edf3ef] p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-bold text-[#17342a]">{drug?.name} {drug?.strength}</p><p className="mt-1 text-[11px] text-[#82958c]">{offer.packSize} · {drug?.category}</p></div><span className="rounded-full bg-[#d9f3e7] px-2 py-1 text-[9px] font-extrabold uppercase text-[#087f5b]">Live</span></div><div className="mt-4 flex items-end justify-between"><p className="font-display text-lg font-extrabold text-[#17342a]">{draft.showPrices ? formatNaira(offer.priceMinor) : "Ask pharmacy"}</p><p className={`text-[10px] font-bold ${offer.stockStatus === "OUT_OF_STOCK" ? "text-red-600" : "text-[#0b8a63]"}`}>{offer.stockStatus.replaceAll("_", " ")}</p></div></div>; })}
        </div></div>
      </div>
      <div className="rounded-[24px] border border-[#dbe9e2] bg-white p-6"><p className="text-xs font-extrabold uppercase tracking-wider text-[#b06d10]">Storefront settings</p><div className="mt-4 space-y-4">
        <StoreField label="Storefront name"><input value={draft.storefrontName} onChange={(event) => { setSaved(false); setDraft({ ...draft, storefrontName: event.target.value }); }} className={storeControl}/></StoreField>
        <StoreField label="Store description"><textarea rows={3} value={draft.description ?? ""} onChange={(event) => setDraft({ ...draft, description: event.target.value })} className={storeControl}/></StoreField>
        <StoreField label="Public address"><input value={draft.address ?? ""} onChange={(event) => setDraft({ ...draft, address: event.target.value })} className={storeControl}/></StoreField>
        <StoreField label="Customer phone"><input value={draft.phone ?? ""} onChange={(event) => setDraft({ ...draft, phone: event.target.value })} className={storeControl}/></StoreField>
        <div className="grid grid-cols-2 gap-3"><StoreField label="Weekday hours"><input value={draft.weekdayHours ?? ""} onChange={(event) => setDraft({ ...draft, weekdayHours: event.target.value })} className={storeControl}/></StoreField><StoreField label="Weekend hours"><input value={draft.weekendHours ?? ""} onChange={(event) => setDraft({ ...draft, weekendHours: event.target.value })} className={storeControl}/></StoreField></div>
        <label className="flex items-center justify-between gap-3 rounded-xl border border-[#edf3ef] p-3 text-sm font-semibold text-[#355348]"><span>Allow public listing</span><input type="checkbox" checked={draft.publicListingEnabled} onChange={(event) => setDraft({ ...draft, publicListingEnabled: event.target.checked })}/></label>
        <label className="flex items-center justify-between gap-3 rounded-xl border border-[#edf3ef] p-3 text-sm font-semibold text-[#355348]"><span>Show prices</span><input type="checkbox" checked={draft.showPrices} onChange={(event) => setDraft({ ...draft, showPrices: event.target.checked })}/></label>
        <div className="grid grid-cols-2 gap-3"><label className="flex items-center gap-2 text-xs font-semibold text-[#5f786d]"><input type="checkbox" checked={draft.pickupEnabled} onChange={(event) => setDraft({ ...draft, pickupEnabled: event.target.checked })}/> Pickup</label><label className="flex items-center gap-2 text-xs font-semibold text-[#5f786d]"><input type="checkbox" checked={draft.deliveryEnabled} onChange={(event) => setDraft({ ...draft, deliveryEnabled: event.target.checked })}/> Delivery</label></div>
        <div className="grid grid-cols-2 gap-3"><StoreField label="Delivery fee (NGN)"><input type="number" min="0" value={draft.deliveryFeeMinor ?? 0} onChange={(event) => setDraft({ ...draft, deliveryFeeMinor: Number(event.target.value) })} className={storeControl}/></StoreField><StoreField label="Minimum order"><input type="number" min="0" value={draft.minimumOrderMinor ?? 0} onChange={(event) => setDraft({ ...draft, minimumOrderMinor: Number(event.target.value) })} className={storeControl}/></StoreField></div>
        <StoreField label="Preparation time (minutes)"><input type="number" min="0" value={draft.orderLeadTimeMinutes} onChange={(event) => setDraft({ ...draft, orderLeadTimeMinutes: Number(event.target.value) })} className={storeControl}/></StoreField>
        <button type="button" onClick={() => { setConfig(draft); setSaved(true); }} disabled={!draft.storefrontName.trim()} className="w-full rounded-xl bg-[#0d2c22] px-4 py-3 text-xs font-bold text-white hover:bg-[#174a3a] disabled:opacity-40">Save and publish settings</button>
      </div></div>
    </div>
  </div>;
}

function DashboardHome({ organizationId, onNavigate }: { organizationId: string; onNavigate: (section: Section) => void }) {
  const allOffers = usePharmacyCatalogue((state) => state.offers);
  const allRequests = usePharmacyWorkflow((state) => state.requests);
  const allOrders = usePharmacyWorkflow((state) => state.orders);
  const offers = useMemo(() => allOffers.filter((offer) => offer.organizationId === organizationId), [allOffers, organizationId]);
  const requests = useMemo(() => allRequests.filter((item) => item.organizationId === organizationId), [allRequests, organizationId]);
  const orders = useMemo(() => allOrders.filter((item) => item.organizationId === organizationId), [allOrders, organizationId]);
  const config = usePharmacyCatalogue((state) => state.configs.find((item) => item.organizationId === organizationId));
  const units = offers.reduce((total, offer) => total + (offer.stockQuantity ?? 0), 0);
  const low = offers.filter((offer) => offer.stockStatus === "LOW_STOCK" || offer.stockStatus === "OUT_OF_STOCK");
  const published = offers.filter((offer) => offer.marketplaceStatus === "PUBLISHED").length;
  const activeOrders = orders.filter((item) => item.fulfilmentStatus !== "COMPLETED" && item.fulfilmentStatus !== "CANCELLED").length;
  const cards: [string, string, string, Section][] = [
    ["New requests", String(requests.filter((item) => item.status === "NEW").length), "Awaiting pharmacist review", "requests"],
    ["Active orders", String(activeOrders), "Across fulfilment", "orders"],
    ["Inventory products", String(offers.length), `${units} available units`, "inventory"],
    ["Marketplace products", String(published), config?.publicListingEnabled ? "Storefront visible" : "Storefront hidden", "marketplace"],
  ];
  const steps: [string, string, string, Section][] = [
    ["1", "Review requests", "Validate the prescription and patient fulfilment preference.", "requests"],
    ["2", "Send quotes", "Price available medicines and send a time-bound offer.", "quotes"],
    ["3", "Fulfil orders", "Prepare paid orders, dispense stock and complete handover.", "orders"],
  ];
  return <div className="space-y-6"><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map(([label,value,detail,target])=><button onClick={() => onNavigate(target)} className="rounded-[22px] border border-[#dbe9e2] bg-white p-5 text-left transition hover:-translate-y-0.5 hover:border-[#a9cdbf]" key={label}><p className="text-[10px] font-extrabold uppercase tracking-wider text-[#83968e]">{label}</p><p className="mt-4 font-display text-2xl font-extrabold text-[#17342a]">{value}</p><p className="mt-1 text-xs text-[#82958c]">{detail}</p></button>)}</div><div className="grid gap-5 xl:grid-cols-[1.2fr_.8fr]"><div className="rounded-[26px] border border-[#dbe9e2] bg-white p-6"><p className="text-xs font-extrabold uppercase tracking-wider text-[#b06d10]">Fulfilment workflow</p><h2 className="mt-1 font-display text-xl font-bold text-[#17342a]">Prescription to handover</h2><div className="mt-5 grid gap-3 sm:grid-cols-3">{steps.map(([number,title,copy,target])=><button key={title} onClick={() => onNavigate(target)} className="rounded-2xl border border-[#edf3ef] p-4 text-left hover:border-[#0b8a63]"><span className="grid h-7 w-7 place-items-center rounded-full bg-[#e8f5ef] text-xs font-bold text-[#087f5b]">{number}</span><p className="mt-3 text-sm font-bold text-[#17342a]">{title}</p><p className="mt-1 text-xs leading-5 text-[#82958c]">{copy}</p></button>)}</div></div><div className="rounded-[26px] bg-[#14352a] p-6 text-white"><p className="text-xs font-extrabold uppercase tracking-wider text-[#f5b94e]">Stock attention</p><h2 className="mt-2 font-display text-xl font-bold">{low.length ? `${low.length} product${low.length === 1 ? "" : "s"} need action` : "Inventory is healthy"}</h2><div className="mt-5 space-y-3">{low.length ? low.slice(0,4).map((offer) => <div key={offer.id} className="flex items-center justify-between rounded-xl bg-white/[.07] px-3 py-2.5 text-xs"><span>{masterDrug(offer.masterDrugId)?.name}</span><b className="text-[#f5b94e]">{offer.stockQuantity ?? 0} left</b></div>) : <p className="text-sm text-white/60">No low-stock products currently.</p>}</div><button onClick={() => onNavigate("inventory")} className="mt-5 w-full rounded-xl bg-[#f5a524] px-4 py-3 text-xs font-extrabold text-[#13231e]">Manage inventory</button></div></div></div>;
}

function Stat({ label, value, positive = false }: { label: string; value: number; positive?: boolean }) {
  return <div className="rounded-2xl border border-[#edf3ef] p-4"><p className="text-[10px] font-extrabold uppercase tracking-wider text-[#8aa096]">{label}</p><p className={`mt-2 text-2xl font-extrabold ${positive ? "text-[#0b8a63]" : "text-[#17342a]"}`}>{value}</p></div>;
}

function StoreField({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-xs font-bold text-[#5b766a]">{label}</span>{children}</label>;
}

export default function PharmacyPortal() {
  const navigate = useNavigate();
  const { identity, activeMembership, signOut } = useAuth();
  const tenant = useTenant((state) => state.tenant);
  const [section, setSection] = useState<Section>("overview");
  const [mobileOpen, setMobileOpen] = useState(false);
  const branchId = `branch-${tenant.id}-1`;
  const groups = useMemo(() => [...new Set(sections.map((item) => item.group).filter(Boolean))] as string[], []);
  const activeLabel = sections.find((item) => item.key === section)?.label ?? "Overview";
  const nav = <div className="flex h-full flex-col"><div className="px-6 pb-6 pt-7"><PharmacyLogo/></div><div className="mx-5 rounded-2xl border border-white/10 bg-white/[.06] p-3"><p className="text-[9px] font-extrabold uppercase tracking-[.18em] text-white/40">Workspace</p><div className="mt-2 flex w-full items-center gap-2 text-sm font-semibold text-white"><MapPin size={14} className="shrink-0 text-[#f5b94e]"/><span className="truncate">{tenant.name} · Primary branch</span></div><p className="mt-2 text-[10px] text-white/35">{activeMembership?.role ?? "Authorized pharmacy employee"}</p></div><nav className="mt-6 flex-1 overflow-y-auto px-3 pb-6">{<NavGroup items={sections.filter((item) => !item.group)} section={section} setSection={setSection}/>} {groups.map((group)=><div key={group} className="mt-6"><p className="px-3 pb-2 text-[9px] font-extrabold uppercase tracking-[.18em] text-white/30">{group}</p><NavGroup items={sections.filter((item) => item.group === group)} section={section} setSection={setSection}/></div>)}</nav><div className="border-t border-white/10 p-4"><button onClick={() => { signOut(); navigate("/pharmacy/login", { replace: true }); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-bold text-white/55 transition hover:bg-white/10 hover:text-white"><LogOut size={15}/> Sign out</button></div></div>;
  return <div className="min-h-screen bg-[#f3f8f5] text-[#17342a]"><aside className="fixed inset-y-0 left-0 z-40 hidden w-[276px] bg-[#0d2c22] lg:block">{nav}</aside>{mobileOpen&&<><button aria-label="Close navigation" className="fixed inset-0 z-40 bg-[#071b14]/60 lg:hidden" onClick={() => setMobileOpen(false)}/><aside className="fixed inset-y-0 left-0 z-50 w-[290px] bg-[#0d2c22] lg:hidden">{nav}</aside></>}<main className="lg:pl-[276px]"><header className="sticky top-0 z-30 flex h-[76px] items-center justify-between border-b border-[#dbe9e2]/90 bg-[#f3f8f5]/90 px-5 backdrop-blur-lg sm:px-8"><div className="flex items-center gap-3"><button className="rounded-xl border border-[#dbe9e2] bg-white p-2 lg:hidden" onClick={() => setMobileOpen(true)}><Menu size={18}/></button><div><p className="hidden text-[10px] font-extrabold uppercase tracking-[.18em] text-[#b06d10] sm:block">Pharmacy operations</p><p className="font-display text-lg font-bold text-[#17342a]">{activeLabel}</p></div></div><div className="flex items-center gap-2"><button className="rounded-xl border border-[#dbe9e2] bg-white p-2.5 text-[#6c8278] hover:text-[#0b8a63]" aria-label="Search"><Search size={16}/></button><button className="relative rounded-xl border border-[#dbe9e2] bg-white p-2.5 text-[#6c8278] hover:text-[#0b8a63]" aria-label="Notifications"><Bell size={16}/><span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-[#f5a524]"/></button><div className="hidden items-center gap-2 rounded-xl border border-[#dbe9e2] bg-white px-3 py-2 sm:flex"><span className="grid h-7 w-7 place-items-center rounded-lg bg-[#e6f5ef] text-xs font-extrabold text-[#0b8a63]">{(identity?.name ?? "P").slice(0,1)}</span><span className="max-w-[140px] truncate text-xs font-bold text-[#355348]">{identity?.name ?? "Pharmacy team"}</span></div></div></header><div className="mx-auto max-w-[1440px] px-5 py-7 sm:px-8 lg:px-10"><SectionView section={section} organizationId={tenant.id} organizationName={tenant.name} branchId={branchId} onNavigate={setSection}/></div></main></div>;
}

function NavGroup({ items, section, setSection }: { items: typeof sections; section: Section; setSection: (section: Section) => void }) {
  return <div className="space-y-1">{items.map((item) => { const Icon = item.icon; return <button key={item.key} onClick={() => setSection(item.key)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-semibold transition ${section === item.key ? "bg-[#f5a524] text-[#13231e] shadow-[0_8px_20px_-14px_rgba(245,165,36,.9)]" : "text-white/55 hover:bg-white/10 hover:text-white"}`}><Icon size={16}/><span>{item.label}</span>{item.key === "requests"&&<span className="ml-auto rounded-full bg-white/10 px-1.5 py-0.5 text-[9px]">—</span>}</button>; })}</div>;
}
