import React from "react";
import { Check, ClipboardList, MessageSquare, Pill } from "lucide-react";

export function JourneyCard({ steps }) { return <section className="sabi-delivery-journey sabi-card"><h2><ClipboardList /> Order Journey</h2><ol>{steps.map((step) => <li key={step.title} className={step.state}><span>{step.state === "done" ? <Check /> : ""}</span><div><h3>{step.title}</h3><p>{step.detail}</p></div></li>)}</ol></section>; }
export function PharmacyCard({ order }) { return <section className="sabi-delivery-pharmacy sabi-card"><div className="sabi-delivery-pharmacy-icon">✚</div><div><h3>{order.pharmacy}</h3><p>{order.location}</p></div><MessageSquare /><button>Chat with Pharmacist</button></section>; }
export function OrderSummary({ items, deliveryFee }) {
  const subtotal = items.reduce((sum, item) => {
    const numeric = Number(String(item.price).replace(/[^\d.]/g, "")) || 0;
    return sum + numeric;
  }, 0);
  const naira = (amount) => `₦${amount.toLocaleString("en-NG")}`;
  const hasFee = typeof deliveryFee === "number";
  // Delivery fee and "paid" status are only shown when the real order supplies them — never
  // hardcoded, since no payment is actually processed by this frontend yet.
  return <section className="sabi-delivery-summary sabi-card"><h2>Order Summary</h2>{items.map((item) => <div className="sabi-delivery-item" key={item.name}><span><Pill /></span><div><h3>{item.name}</h3><p>{item.detail}</p></div><strong>{item.price}</strong></div>)}<dl><div><dt>Subtotal</dt><dd>{naira(subtotal)}</dd></div><div><dt>Delivery Fee</dt><dd>{hasFee ? naira(deliveryFee) : "Not available"}</dd></div><div className="total"><dt>Order total</dt><dd>{naira(subtotal + (hasFee ? deliveryFee : 0))}</dd></div></dl></section>;
}
