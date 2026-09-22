import { useMemo, useState, type ReactNode } from "react";
import {
  ArrowRight, Check, CheckCircle2, ClipboardCheck, Clock3, FileText, PackageCheck,
  Search, Send, ShieldCheck, ShoppingBag, Truck, UserRound, X,
} from "lucide-react";
import { developmentFixturesEnabled } from "@/config/runtime";
import { usePharmacyCatalogue, type PharmacyOffer } from "./catalogue";
import {
  usePharmacyWorkflow,
  type FulfilmentStatus,
  type PharmacyOrder,
  type PharmacyQuote,
  type PharmacyRequest,
  type QuoteLine,
} from "./workflow";

const money = (amount: number) => new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(amount);
const dateTime = (value: string) => new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
const control = "w-full rounded-xl border border-[#cfe0d8] bg-[#fbfefc] px-3 py-3 text-sm text-[#17342a] outline-none focus:border-[#0b8a63] focus:ring-2 focus:ring-[#0b8a63]/10";

const tones: Record<string, string> = {
  NEW: "bg-blue-50 text-blue-700", UNDER_REVIEW: "bg-amber-50 text-amber-700", QUOTED: "bg-emerald-50 text-emerald-700",
  DRAFT: "bg-slate-100 text-slate-600", SENT: "bg-blue-50 text-blue-700", ACCEPTED: "bg-emerald-50 text-emerald-700",
  PENDING: "bg-amber-50 text-amber-700", CONFIRMED: "bg-emerald-50 text-emerald-700", COMPLETED: "bg-emerald-50 text-emerald-700",
  DISPENSING: "bg-violet-50 text-violet-700", PREPARING: "bg-blue-50 text-blue-700", READY_TO_PREPARE: "bg-cyan-50 text-cyan-700",
};

function Status({ value }: { value: string }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide ${tones[value] ?? "bg-slate-100 text-slate-600"}`}>{value.replaceAll("_", " ")}</span>;
}

function Empty({ icon, title, copy }: { icon: ReactNode; title: string; copy: string }) {
  return <div className="grid min-h-52 place-items-center rounded-[24px] border border-dashed border-[#c9ddd5] bg-[#fbfefc] p-8 text-center"><div><span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#e8f5ef] text-[#0b8a63]">{icon}</span><h3 className="mt-4 font-display text-lg font-bold text-[#17342a]">{title}</h3><p className="mt-2 max-w-md text-sm leading-6 text-[#70877d]">{copy}</p></div></div>;
}

function Notice({ children, tone = "success" }: { children: ReactNode; tone?: "success" | "error" | "info" }) {
  const color = tone === "error" ? "border-red-200 bg-red-50 text-red-700" : tone === "info" ? "border-blue-200 bg-blue-50 text-blue-700" : "border-[#b9dfcf] bg-[#eaf8f2] text-[#087f5b]";
  return <div className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${color}`}>{children}</div>;
}

export function RequestsView({ organizationId, branchId, onNavigate }: { organizationId: string; branchId: string; onNavigate: (section: "quotes") => void }) {
  const allRequests = usePharmacyWorkflow((state) => state.requests);
  const startReview = usePharmacyWorkflow((state) => state.startReview);
  const requests = useMemo(() => allRequests.filter((item) => item.organizationId === organizationId && item.branchId === branchId), [allRequests, branchId, organizationId]);
  const [query, setQuery] = useState("");
  const [building, setBuilding] = useState<PharmacyRequest | null>(null);
  const visible = requests.filter((item) => `${item.patientName} ${item.prescriptionNumber} ${item.prescriberName}`.toLowerCase().includes(query.toLowerCase()));

  return <div className="space-y-5">
    <div className="grid gap-4 sm:grid-cols-3">
      <Metric label="New requests" value={requests.filter((item) => item.status === "NEW").length} icon={<FileText size={18}/>} />
      <Metric label="Under review" value={requests.filter((item) => item.status === "UNDER_REVIEW").length} icon={<Clock3 size={18}/>} />
      <Metric label="Quotes sent" value={requests.filter((item) => item.status === "QUOTED").length} icon={<Send size={18}/>} />
    </div>
    <div className="rounded-[24px] border border-[#dbe9e2] bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#edf3ef] p-5"><div><h2 className="font-display text-lg font-bold text-[#17342a]">Prescription inbox</h2><p className="mt-1 text-xs text-[#70877d]">Review clinical details before pricing or offering alternatives.</p></div><label className="flex items-center gap-2 rounded-xl border border-[#cfe0d8] bg-[#fbfefc] px-3 py-2.5 text-[#70877d]"><Search size={15}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search requests" className="w-44 bg-transparent text-xs outline-none"/></label></div>
      {visible.length === 0 ? <div className="p-5"><Empty icon={<FileText size={20}/>} title="No prescription requests" copy="New requests for this branch will appear here."/></div> : <div className="divide-y divide-[#edf3ef]">{visible.map((request) => <article key={request.id} className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4"><div className="flex gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#e8f5ef] text-[#0b8a63]"><UserRound size={18}/></span><div><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-extrabold text-[#17342a]">{request.patientName}</h3><Status value={request.status}/></div><p className="mt-1 text-xs text-[#70877d]">{request.prescriptionNumber} · {request.prescriberName} · {dateTime(request.receivedAt)}</p></div></div><span className="rounded-xl bg-[#f7faf8] px-3 py-2 text-xs font-bold text-[#5f786d]">{request.deliveryPreference === "DELIVERY" ? "Delivery requested" : "Patient pickup"}</span></div>
        <div className="mt-4 grid gap-2">{request.items.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#f7faf8] px-4 py-3 text-xs"><div><b className="text-[#17342a]">{item.name}</b><p className="mt-1 text-[#70877d]">{item.directions}</p></div><b className="text-[#355348]">Qty {item.quantity}</b></div>)}</div>
        {request.patientNote && <p className="mt-3 rounded-xl border border-[#f0dfbd] bg-[#fffaf0] px-3 py-2 text-xs text-[#805f25]">Patient note: {request.patientNote}</p>}
        <div className="mt-4 flex justify-end gap-2">{request.status === "NEW" && <button onClick={() => startReview(request.id, organizationId)} className="rounded-xl border border-[#cfe0d8] px-4 py-2.5 text-xs font-bold text-[#355348]">Start review</button>}{request.status !== "QUOTED" && <button onClick={() => { if (request.status === "NEW") startReview(request.id, organizationId); setBuilding(request); }} className="flex items-center gap-2 rounded-xl bg-[#0d2c22] px-4 py-2.5 text-xs font-bold text-white"><FileText size={14}/> Build quote</button>}{request.status === "QUOTED" && <button onClick={() => onNavigate("quotes")} className="flex items-center gap-2 rounded-xl border border-[#cfe0d8] px-4 py-2.5 text-xs font-bold text-[#355348]">View quote <ArrowRight size={14}/></button>}</div>
      </article>)}</div>}
    </div>
    {building && <QuoteBuilder request={building} organizationId={organizationId} onClose={() => setBuilding(null)} onDone={() => { setBuilding(null); onNavigate("quotes"); }}/>} 
  </div>;
}

function QuoteBuilder({ request, organizationId, onClose, onDone }: { request: PharmacyRequest; organizationId: string; onClose: () => void; onDone: () => void }) {
  const allOffers = usePharmacyCatalogue((state) => state.offers);
  const quotes = usePharmacyWorkflow((state) => state.quotes);
  const saveQuote = usePharmacyWorkflow((state) => state.saveQuote);
  const sendQuote = usePharmacyWorkflow((state) => state.sendQuote);
  const offers = allOffers.filter((offer) => offer.organizationId === organizationId && offer.branchId === request.branchId);
  const existing = quotes.find((item) => item.requestId === request.id && item.organizationId === organizationId && item.status === "DRAFT");
  const [items, setItems] = useState<QuoteLine[]>(existing?.items ?? request.items.map((item) => {
    const offer = offers.find((candidate) => candidate.masterDrugId === item.masterDrugId);
    return { ...item, available: Boolean(offer && (offer.stockQuantity ?? 0) >= item.quantity), unitPriceMinor: offer?.priceMinor ?? 0 };
  }));
  const [deliveryFeeMinor, setDeliveryFee] = useState(existing?.deliveryFeeMinor ?? (request.deliveryPreference === "DELIVERY" ? 1500 : 0));
  const [expiresAt, setExpiresAt] = useState(() => existing?.expiresAt.slice(0, 16) ?? new Date(Date.now() + 24 * 60 * 60_000).toISOString().slice(0, 16));
  const [error, setError] = useState("");
  const subtotal = items.filter((item) => item.available).reduce((total, item) => total + item.quantity * item.unitPriceMinor, 0);
  const commit = (send: boolean) => {
    const result = saveQuote(organizationId, { requestId: request.id, items, deliveryFeeMinor, expiresAt: new Date(expiresAt).toISOString() });
    if (result.error || !result.quote) return setError(result.error ?? "Quote could not be saved.");
    if (send) {
      const sent = sendQuote(result.quote.id, organizationId);
      if (sent.error) return setError(sent.error);
      onDone();
    } else onClose();
  };
  return <Modal title="Build patient quote" eyebrow={`${request.prescriptionNumber} · ${request.patientName}`} onClose={onClose}>
    {error && <Notice tone="error">{error}</Notice>}
    <div className="mt-4 space-y-3">{items.map((item, index) => <div key={item.id} className="grid gap-3 rounded-2xl border border-[#e3eee8] p-4 sm:grid-cols-[1.5fr_.55fr_.65fr] sm:items-end"><div><p className="text-sm font-bold text-[#17342a]">{item.name}</p><p className="mt-1 text-xs text-[#70877d]">{item.directions} · Qty {item.quantity}</p><label className="mt-3 flex items-center gap-2 text-xs font-semibold text-[#5f786d]"><input type="checkbox" checked={item.available} onChange={(event) => setItems((current) => current.map((line, lineIndex) => lineIndex === index ? { ...line, available: event.target.checked } : line))}/> Available</label></div><label><span className="mb-1 block text-[10px] font-extrabold uppercase text-[#82958c]">Unit price</span><input type="number" min="0" value={item.unitPriceMinor} disabled={!item.available} onChange={(event) => setItems((current) => current.map((line, lineIndex) => lineIndex === index ? { ...line, unitPriceMinor: Number(event.target.value) } : line))} className={control}/></label><div className="pb-3 text-right"><p className="text-[10px] font-extrabold uppercase text-[#82958c]">Line total</p><p className="mt-1 text-sm font-extrabold text-[#17342a]">{money(item.available ? item.unitPriceMinor * item.quantity : 0)}</p></div></div>)}</div>
    <div className="mt-4 grid gap-4 sm:grid-cols-2"><label><span className="mb-1.5 block text-xs font-bold text-[#5b766a]">Delivery fee</span><input type="number" min="0" value={deliveryFeeMinor} onChange={(event) => setDeliveryFee(Number(event.target.value))} className={control}/></label><label><span className="mb-1.5 block text-xs font-bold text-[#5b766a]">Quote expires</span><input type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} className={control}/></label></div>
    <div className="mt-5 flex items-center justify-between rounded-2xl bg-[#f3f8f5] p-4"><span className="text-sm font-bold text-[#5f786d]">Patient total</span><strong className="font-display text-xl text-[#17342a]">{money(subtotal + deliveryFeeMinor)}</strong></div>
    <div className="mt-6 flex flex-wrap justify-end gap-3"><button onClick={onClose} className="rounded-xl px-4 py-2.5 text-xs font-bold text-[#5f786d]">Cancel</button><button onClick={() => commit(false)} className="rounded-xl border border-[#cfe0d8] px-4 py-2.5 text-xs font-bold text-[#355348]">Save draft</button><button onClick={() => commit(true)} disabled={!items.some((item) => item.available && item.unitPriceMinor > 0)} className="flex items-center gap-2 rounded-xl bg-[#0d2c22] px-4 py-2.5 text-xs font-bold text-white disabled:opacity-40"><Send size={14}/> Send quote</button></div>
  </Modal>;
}

export function QuotesView({ organizationId, branchId, onNavigate }: { organizationId: string; branchId: string; onNavigate: (section: "orders") => void }) {
  const allQuotes = usePharmacyWorkflow((state) => state.quotes);
  const sendQuote = usePharmacyWorkflow((state) => state.sendQuote);
  const acceptQuote = usePharmacyWorkflow((state) => state.acceptQuote);
  const quotes = useMemo(() => allQuotes.filter((item) => item.organizationId === organizationId && item.branchId === branchId).slice().reverse(), [allQuotes, branchId, organizationId]);
  const [notice, setNotice] = useState("");
  if (!quotes.length) return <Empty icon={<FileText size={20}/>} title="No quotes yet" copy="Create a quote from a reviewed prescription request."/>;
  return <div className="space-y-4">{notice && <Notice tone={notice.includes("could not") || notice.includes("Only") ? "error" : "success"}>{notice}</Notice>}{developmentFixturesEnabled && <Notice tone="info">Patient acceptance is a development control until the patient marketplace API is connected.</Notice>}{quotes.map((quote) => <QuoteCard key={quote.id} quote={quote} actions={<>
    {quote.status === "DRAFT" && <button onClick={() => { const result = sendQuote(quote.id, organizationId); setNotice(result.error ?? "Quote sent to the patient."); }} className="flex items-center gap-2 rounded-xl bg-[#0d2c22] px-4 py-2.5 text-xs font-bold text-white"><Send size={14}/> Send quote</button>}
    {quote.status === "SENT" && developmentFixturesEnabled && <button onClick={() => { const result = acceptQuote(quote.id, organizationId); setNotice(result.error ?? "Patient acceptance recorded and order created."); if (result.order) onNavigate("orders"); }} className="flex items-center gap-2 rounded-xl bg-[#0d2c22] px-4 py-2.5 text-xs font-bold text-white"><Check size={14}/> Record patient acceptance</button>}
    {quote.status === "ACCEPTED" && <button onClick={() => onNavigate("orders")} className="flex items-center gap-2 rounded-xl border border-[#cfe0d8] px-4 py-2.5 text-xs font-bold text-[#355348]">Open order <ArrowRight size={14}/></button>}
  </>}/>)}</div>;
}

function QuoteCard({ quote, actions }: { quote: PharmacyQuote; actions: ReactNode }) {
  const subtotal = quote.items.filter((item) => item.available).reduce((total, item) => total + item.quantity * item.unitPriceMinor, 0);
  return <article className="rounded-[24px] border border-[#dbe9e2] bg-white p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2"><h3 className="text-sm font-extrabold text-[#17342a]">{quote.patientName}</h3><Status value={quote.status}/></div><p className="mt-1 text-xs text-[#70877d]">{quote.id} · Expires {dateTime(quote.expiresAt)}</p></div><strong className="font-display text-xl text-[#17342a]">{money(subtotal + quote.deliveryFeeMinor)}</strong></div><div className="mt-4 space-y-2">{quote.items.map((item) => <div key={item.id} className="flex items-center justify-between rounded-xl bg-[#f7faf8] px-3 py-2 text-xs"><span className={item.available ? "text-[#355348]" : "text-red-600 line-through"}>{item.name} × {item.quantity}</span><b>{item.available ? money(item.unitPriceMinor * item.quantity) : "Unavailable"}</b></div>)}</div><div className="mt-4 flex justify-end gap-2">{actions}</div></article>;
}

export function OrdersView({ organizationId, branchId }: { organizationId: string; branchId: string }) {
  const allOrders = usePharmacyWorkflow((state) => state.orders);
  const confirmPayment = usePharmacyWorkflow((state) => state.confirmDevelopmentPayment);
  const advance = usePharmacyWorkflow((state) => state.advanceOrder);
  const allEvents = usePharmacyWorkflow((state) => state.events);
  const orders = useMemo(() => allOrders.filter((item) => item.organizationId === organizationId && item.branchId === branchId).slice().reverse(), [allOrders, branchId, organizationId]);
  const events = useMemo(() => allEvents.filter((item) => item.organizationId === organizationId && item.branchId === branchId).slice().reverse().slice(0, 8), [allEvents, branchId, organizationId]);
  const [notice, setNotice] = useState("");
  const run = (result: { error?: string }, success: string) => setNotice(result.error ?? success);
  if (!orders.length) return <Empty icon={<ShoppingBag size={20}/>} title="No orders yet" copy="An order is created only after a patient accepts a sent quote."/>;
  return <div className="grid gap-5 xl:grid-cols-[1.3fr_.7fr]">
    <div className="space-y-4">{notice && <Notice tone={notice.includes("must") || notice.includes("not") ? "error" : "success"}>{notice}</Notice>}{orders.map((order) => <OrderCard key={order.id} order={order} actions={<>
      {order.paymentStatus === "PENDING" && developmentFixturesEnabled && <button onClick={() => run(confirmPayment(order.id, organizationId), "Development payment confirmed.")} className="rounded-xl bg-[#0d2c22] px-4 py-2.5 text-xs font-bold text-white">Confirm development payment</button>}
      {order.fulfilmentStatus === "READY_TO_PREPARE" && <button onClick={() => run(advance(order.id, organizationId, "PREPARING", "Order preparation started"), "Order preparation started.")} className="rounded-xl bg-[#0d2c22] px-4 py-2.5 text-xs font-bold text-white">Start preparation</button>}
      {order.fulfilmentStatus === "PREPARING" && <button onClick={() => run(advance(order.id, organizationId, "DISPENSING", "Order sent to pharmacist for dispensing"), "Order moved to dispensing.")} className="rounded-xl bg-[#0d2c22] px-4 py-2.5 text-xs font-bold text-white">Send to dispensing</button>}
      {order.fulfilmentStatus === "READY_FOR_DELIVERY" && <button onClick={() => run(advance(order.id, organizationId, "OUT_FOR_DELIVERY", "Order dispatched for delivery"), "Order dispatched.")} className="flex items-center gap-2 rounded-xl bg-[#0d2c22] px-4 py-2.5 text-xs font-bold text-white"><Truck size={14}/> Dispatch order</button>}
      {(order.fulfilmentStatus === "READY_FOR_PICKUP" || order.fulfilmentStatus === "OUT_FOR_DELIVERY") && <button onClick={() => run(advance(order.id, organizationId, "COMPLETED", order.deliveryPreference === "PICKUP" ? "Patient pickup completed" : "Delivery completed"), "Order completed.")} className="flex items-center gap-2 rounded-xl bg-[#0d2c22] px-4 py-2.5 text-xs font-bold text-white"><CheckCircle2 size={14}/> Complete order</button>}
    </>}/>)}</div>
    <div className="rounded-[24px] border border-[#dbe9e2] bg-white p-5"><div className="flex items-center gap-2"><ShieldCheck size={17} className="text-[#0b8a63]"/><h2 className="font-display text-lg font-bold text-[#17342a]">Activity trail</h2></div><p className="mt-1 text-xs text-[#70877d]">Workflow events are append-only in this development store.</p><div className="mt-5 space-y-4">{events.length ? events.map((entry) => <div key={entry.id} className="relative border-l-2 border-[#dbe9e2] pl-4"><span className="absolute -left-[5px] top-1 h-2 w-2 rounded-full bg-[#0b8a63]"/><p className="text-xs font-bold text-[#355348]">{entry.action}</p><p className="mt-1 text-[10px] text-[#82958c]">{entry.entityId} · {dateTime(entry.occurredAt)}</p></div>) : <p className="rounded-xl bg-[#f7faf8] p-4 text-xs text-[#82958c]">Actions taken in this workspace will appear here.</p>}</div></div>
  </div>;
}

function OrderCard({ order, actions }: { order: PharmacyOrder; actions: ReactNode }) {
  return <article className="rounded-[24px] border border-[#dbe9e2] bg-white p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-extrabold text-[#17342a]">{order.id}</h3><Status value={order.fulfilmentStatus}/></div><p className="mt-1 text-xs text-[#70877d]">{order.patientName} · {order.deliveryPreference === "PICKUP" ? "Patient pickup" : "Delivery"} · {dateTime(order.createdAt)}</p></div><div className="text-right"><strong className="font-display text-xl text-[#17342a]">{money(order.totalMinor)}</strong><div className="mt-1"><Status value={order.paymentStatus}/></div></div></div><div className="mt-4 space-y-2">{order.items.map((item) => <div key={item.id} className="flex items-center justify-between rounded-xl bg-[#f7faf8] px-3 py-2 text-xs"><span className="text-[#355348]">{item.name} × {item.quantity}</span><b>{money(item.unitPriceMinor * item.quantity)}</b></div>)}</div><div className="mt-4 flex flex-wrap justify-end gap-2">{actions}</div></article>;
}

export function DispensingView({ organizationId, branchId }: { organizationId: string; branchId: string }) {
  const allOrders = usePharmacyWorkflow((state) => state.orders);
  const advance = usePharmacyWorkflow((state) => state.advanceOrder);
  const allOffers = usePharmacyCatalogue((state) => state.offers);
  const recordMovement = usePharmacyCatalogue((state) => state.recordStockMovement);
  const orders = useMemo(() => allOrders.filter((item) => item.organizationId === organizationId && item.branchId === branchId && item.fulfilmentStatus === "DISPENSING"), [allOrders, branchId, organizationId]);
  const offers = useMemo(() => allOffers.filter((item) => item.organizationId === organizationId && item.branchId === branchId), [allOffers, branchId, organizationId]);
  const [notice, setNotice] = useState("");
  const dispense = (order: PharmacyOrder) => {
    const allocations = order.items.map((line) => ({ line, offer: offers.find((item) => item.masterDrugId === line.masterDrugId) }));
    const missing = allocations.find(({ line, offer }) => !offer || (offer.stockQuantity ?? 0) < line.quantity);
    if (missing) return setNotice(`Insufficient branch stock for ${missing.line.name}. Receive or adjust stock before dispensing.`);
    for (const { line, offer } of allocations as { line: QuoteLine; offer: PharmacyOffer }[]) {
      const result = recordMovement({ organizationId, branchId, offerId: offer.id, type: "SALE", quantity: line.quantity, reference: order.id, notes: `Dispensed for ${order.patientName}` });
      if (result.error) return setNotice(result.error);
    }
    const next: FulfilmentStatus = order.deliveryPreference === "PICKUP" ? "READY_FOR_PICKUP" : "READY_FOR_DELIVERY";
    const result = advance(order.id, organizationId, next, `Dispensing completed; ${order.deliveryPreference === "PICKUP" ? "ready for pickup" : "ready for delivery"}`);
    setNotice(result.error ?? "Dispensing completed and stock was deducted from the branch ledger.");
  };
  return <div className="space-y-4">{notice && <Notice tone={notice.includes("Insufficient") || notice.includes("error") ? "error" : "success"}>{notice}</Notice>}{orders.length === 0 ? <Empty icon={<ClipboardCheck size={20}/>} title="Dispensing queue is clear" copy="Paid orders appear here after preparation sends them to the pharmacist."/> : orders.map((order) => <article key={order.id} className="rounded-[24px] border border-[#dbe9e2] bg-white p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-sm font-extrabold text-[#17342a]">{order.id} · {order.patientName}</h3><p className="mt-1 text-xs text-[#70877d]">Verify prescription, medicine, quantity and branch batch before issue.</p></div><Status value={order.fulfilmentStatus}/></div><div className="mt-4 space-y-2">{order.items.map((line) => { const offer = offers.find((item) => item.masterDrugId === line.masterDrugId); return <div key={line.id} className="grid gap-2 rounded-xl bg-[#f7faf8] px-4 py-3 text-xs sm:grid-cols-[1.4fr_.8fr_.6fr]"><div><b className="text-[#17342a]">{line.name}</b><p className="mt-1 text-[#70877d]">{line.directions}</p></div><div><span className="text-[#82958c]">Batch</span><p className="mt-1 font-bold text-[#355348]">{offer?.batchNumber || "Not recorded"}</p></div><div className="text-right"><span className="text-[#82958c]">Required / available</span><p className={`mt-1 font-extrabold ${(offer?.stockQuantity ?? 0) < line.quantity ? "text-red-600" : "text-[#0b8a63]"}`}>{line.quantity} / {offer?.stockQuantity ?? 0}</p></div></div>; })}</div><div className="mt-4 flex justify-end"><button onClick={() => dispense(order)} className="flex items-center gap-2 rounded-xl bg-[#0d2c22] px-4 py-2.5 text-xs font-bold text-white"><PackageCheck size={14}/> Verify and complete dispensing</button></div></article>)}</div>;
}

function Metric({ label, value, icon }: { label: string; value: number; icon: ReactNode }) {
  return <div className="rounded-[22px] border border-[#dbe9e2] bg-white p-5"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#e8f5ef] text-[#0b8a63]">{icon}</span><p className="mt-4 text-[10px] font-extrabold uppercase tracking-wider text-[#83968e]">{label}</p><p className="mt-1 font-display text-2xl font-extrabold text-[#17342a]">{value}</p></div>;
}

function Modal({ title, eyebrow, onClose, children }: { title: string; eyebrow: string; onClose: () => void; children: ReactNode }) {
  return <div className="fixed inset-0 z-50 grid place-items-center bg-[#071b14]/60 p-4"><div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-[28px] bg-white p-6 shadow-2xl"><div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-extrabold uppercase tracking-[.18em] text-[#b06d10]">{eyebrow}</p><h2 className="mt-1 font-display text-2xl font-extrabold text-[#17342a]">{title}</h2></div><button onClick={onClose} className="rounded-xl p-2 text-[#82958c] hover:bg-[#f3f8f5]"><X size={18}/></button></div><div className="mt-6">{children}</div></div></div>;
}
