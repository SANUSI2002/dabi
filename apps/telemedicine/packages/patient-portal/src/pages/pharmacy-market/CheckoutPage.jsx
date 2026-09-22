import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Check, CreditCard, Landmark, MapPin, Plus, Truck, Wallet,
} from "lucide-react";

import "../../styles/share.css";
import "./PharmacyMarket.css";

import { pageVars } from "../../pageVars";
import { useZoom } from "../../hooks/useZoom";
import { formatNaira } from "../../utils/currency";
import { Sidebar, Topbar } from "../dashboard/components";
import { getCart, clearCart, getAddresses, addAddress, placeOrder, findProduct, findPharmacy } from "./cartStore";

const DELIVERY_FEE_PER_PHARMACY = 1500;

const PAYMENT_METHODS = [
  { id: "card", label: "Debit / Credit Card", icon: CreditCard },
  { id: "transfer", label: "Bank Transfer", icon: Landmark },
  { id: "delivery", label: "Pay on Delivery", icon: Wallet },
];

function buildGroups(cart) {
  return Object.entries(cart)
    .map(([pharmacyId, items]) => {
      const pharmacy = findPharmacy(pharmacyId);
      if (!pharmacy) return null;
      const lines = Object.entries(items)
        .map(([productId, qty]) => {
          const product = findProduct(pharmacyId, productId);
          return product ? { product, qty } : null;
        })
        .filter(Boolean);
      if (lines.length === 0) return null;
      const subtotal = lines.reduce((sum, l) => sum + l.product.price * l.qty, 0);
      return { pharmacy, lines, subtotal };
    })
    .filter(Boolean);
}

export function CheckoutPage() {
  const [zoom] = useZoom();
  const navigate = useNavigate();

  const [cart] = useState(getCart);
  // Checkout always covers every pharmacy currently in the cart — one
  // checkout, routed to each pharmacy's own order (per the Shopping
  // Cart PRD section).
  const groups = useMemo(() => buildGroups(cart), [cart]);
  const itemsTotal = groups.reduce((sum, group) => sum + group.subtotal, 0);
  const deliveryFee = groups.length * DELIVERY_FEE_PER_PHARMACY;
  const grandTotal = itemsTotal + deliveryFee;

  const [step, setStep] = useState(1);
  const [addresses, setAddresses] = useState(getAddresses);
  const [selectedAddressId, setSelectedAddressId] = useState(() => addresses.find((a) => a.isDefault)?.id || addresses[0]?.id || null);
  const [showAddressForm, setShowAddressForm] = useState(addresses.length === 0);
  const [newAddress, setNewAddress] = useState({ label: "", recipient: "", phone: "", address: "" });
  const [paymentMethod, setPaymentMethod] = useState("card");
  const [placing, setPlacing] = useState(false);
  const [toast, setToast] = useState("");

  const notify = (message) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2400);
  };

  if (groups.length === 0) {
    return (
      <div className="sabi-dashboard" style={{ ...pageVars, zoom }}>
        <Sidebar />
        <div className="sabi-main">
          <Topbar />
          <div className="sabi-card sabi-empty-state">
            <Truck size={40} />
            <h3>Nothing to check out yet</h3>
            <p>Add items to your cart before starting checkout.</p>
            <button type="button" className="sabi-btn-primary" style={{ marginTop: 8 }} onClick={() => navigate("/pharmacy-market")}>
              Browse Marketplace
            </button>
          </div>
        </div>
      </div>
    );
  }

  const selectedAddress = addresses.find((a) => a.id === selectedAddressId) || null;

  const handleSaveNewAddress = () => {
    if (!newAddress.label.trim() || !newAddress.address.trim() || !newAddress.phone.trim()) {
      notify("Please fill in label, phone, and address");
      return;
    }
    const saved = addAddress(newAddress);
    const next = getAddresses();
    setAddresses(next);
    setSelectedAddressId(saved.id);
    setShowAddressForm(false);
    setNewAddress({ label: "", recipient: "", phone: "", address: "" });
  };

  const goToPayment = () => {
    if (!selectedAddress) {
      notify("Select or add a delivery address first");
      return;
    }
    setStep(2);
  };

  const handlePlaceOrder = () => {
    if (!groups.length) return;
    setPlacing(true);
    const order = placeOrder({
      groups: groups.map((group) => ({
        pharmacyId: group.pharmacy.id,
        pharmacyName: group.pharmacy.name,
        items: group.lines.map(({ product, qty }) => ({ productId: product.id, name: product.name, qty, price: product.price })),
        subtotal: group.subtotal,
        deliveryFee: DELIVERY_FEE_PER_PHARMACY,
      })),
      itemsTotal,
      deliveryFee,
      grandTotal,
      address: selectedAddress,
      paymentMethod,
    });
    clearCart();
    window.setTimeout(() => {
      navigate(`/order-confirmation/${order.id}`);
    }, 500);
  };

  return (
    <div className="sabi-dashboard" style={{ ...pageVars, zoom }}>
      <Sidebar />
      <div className="sabi-main sabi-storefront-main">
        <Topbar placeholder="Search medicines, pharmacies..." />

        <button className="sabi-rxd-back" onClick={() => navigate("/cart")}>
          <ArrowLeft size={18} /> Back to Cart
        </button>

        <div className="sabi-fam-header" style={{ marginTop: 12 }}>
          <div>
            <h1 style={{ color: "var(--sabi-primary-dark)", fontSize: "1.5rem", fontWeight: 800, margin: "0 0 4px" }}>Checkout</h1>
            <p style={{ margin: 0, color: "var(--sabi-text-secondary)" }}>Confirm where and how you&apos;d like your order delivered.</p>
          </div>
        </div>

        <div className="sabi-checkout-steps">
          <div className={`sabi-checkout-step ${step === 1 ? "active" : "done"}`}>
            <span className="n">{step > 1 ? <Check size={13} /> : "1"}</span> Delivery Address
          </div>
          <div className="sabi-checkout-step-line" />
          <div className={`sabi-checkout-step ${step === 2 ? "active" : step > 2 ? "done" : ""}`}>
            <span className="n">{step > 2 ? <Check size={13} /> : "2"}</span> Payment
          </div>
          <div className="sabi-checkout-step-line" />
          <div className={`sabi-checkout-step ${step === 3 ? "active" : ""}`}>
            <span className="n">3</span> Review &amp; Place Order
          </div>
        </div>

        <div className="sabi-cart-layout">
          <div>
            {step === 1 && (
              <div className="sabi-card">
                <div className="sabi-fam-section-head">
                  <h2 style={{ fontSize: "1rem" }}><MapPin size={16} style={{ verticalAlign: "-3px", marginRight: 6 }} />Where should we deliver this?</h2>
                </div>

                <div className="sabi-address-grid">
                  {addresses.map((addr) => (
                    <div
                      key={addr.id}
                      className={`sabi-address-card ${selectedAddressId === addr.id ? "selected" : ""}`}
                      onClick={() => { setSelectedAddressId(addr.id); setShowAddressForm(false); }}
                    >
                      {selectedAddressId === addr.id && <span className="check"><Check size={16} /></span>}
                      <h4><MapPin size={14} /> {addr.label}</h4>
                      <p>{addr.recipient} · {addr.phone}</p>
                      <p>{addr.address}</p>
                      {addr.isDefault && <span className="default-tag">Default</span>}
                    </div>
                  ))}

                  <div className="sabi-address-add" onClick={() => setShowAddressForm((s) => !s)}>
                    <Plus size={16} /> Use a different address
                  </div>
                </div>

                {showAddressForm && (
                  <div className="sabi-address-form">
                    <div className="sabi-fam-form-title" style={{ marginBottom: 12 }}><span className="bar" /> New Delivery Address</div>
                    <div className="sabi-fam-form-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
                      <div className="sabi-fam-field">
                        <label>Label</label>
                        <input type="text" placeholder="e.g. Mum's House" value={newAddress.label} onChange={(e) => setNewAddress((p) => ({ ...p, label: e.target.value }))} />
                      </div>
                      <div className="sabi-fam-field">
                        <label>Recipient Name</label>
                        <input type="text" placeholder="Full name" value={newAddress.recipient} onChange={(e) => setNewAddress((p) => ({ ...p, recipient: e.target.value }))} />
                      </div>
                      <div className="sabi-fam-field">
                        <label>Phone Number</label>
                        <input type="text" placeholder="+234 8xx xxx xxxx" value={newAddress.phone} onChange={(e) => setNewAddress((p) => ({ ...p, phone: e.target.value }))} />
                      </div>
                      <div className="sabi-fam-field">
                        <label>Delivery Address</label>
                        <input type="text" placeholder="Street, area, city" value={newAddress.address} onChange={(e) => setNewAddress((p) => ({ ...p, address: e.target.value }))} />
                      </div>
                    </div>
                    <div className="sabi-fam-form-footer">
                      <button type="button" className="sabi-btn-outline" onClick={() => setShowAddressForm(false)}>Cancel</button>
                      <button type="button" className="sabi-btn-primary" onClick={handleSaveNewAddress}>Save Address</button>
                    </div>
                  </div>
                )}

                <button type="button" className="sabi-btn-primary" style={{ marginTop: 8 }} onClick={goToPayment}>
                  Continue to Payment
                </button>
              </div>
            )}

            {step === 2 && (
              <div className="sabi-card">
                <div className="sabi-fam-section-head">
                  <h2 style={{ fontSize: "1rem" }}><CreditCard size={16} style={{ verticalAlign: "-3px", marginRight: 6 }} />How would you like to pay?</h2>
                </div>
                <div className="sabi-payment-grid">
                  {PAYMENT_METHODS.map((method) => {
                    const Icon = method.icon;
                    return (
                      <div
                        key={method.id}
                        className={`sabi-payment-card ${paymentMethod === method.id ? "selected" : ""}`}
                        onClick={() => setPaymentMethod(method.id)}
                      >
                        <div className="icon"><Icon size={18} /></div>
                        <strong>{method.label}</strong>
                      </div>
                    );
                  })}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="button" className="sabi-btn-outline" onClick={() => setStep(1)}>Back</button>
                  <button type="button" className="sabi-btn-primary" onClick={() => setStep(3)}>Review Order</button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="sabi-card">
                <div className="sabi-fam-section-head">
                  <h2 style={{ fontSize: "1rem" }}>Review your order</h2>
                </div>
                {groups.map(({ pharmacy, lines, subtotal }) => (
                  <div key={pharmacy.id} style={{ marginBottom: 16 }}>
                    <div style={{ fontWeight: 700, fontSize: "0.86rem", marginBottom: 6 }}>{pharmacy.name}</div>
                    {lines.map(({ product, qty }) => (
                      <div className="sabi-checkout-review-item" key={product.id}>
                        <span>{product.name} × {qty}</span>
                        <span>{formatNaira(product.price * qty)}</span>
                      </div>
                    ))}
                    <div className="sabi-checkout-review-item" style={{ fontWeight: 700 }}>
                      <span>Subtotal</span>
                      <span>{formatNaira(subtotal)}</span>
                    </div>
                  </div>
                ))}

                <div className="sabi-card" style={{ background: "var(--sabi-page-bg)", boxShadow: "none" }}>
                  <div style={{ fontWeight: 700, fontSize: "0.86rem", marginBottom: 6 }}>Delivering to</div>
                  <div style={{ fontSize: "0.84rem", color: "var(--sabi-text-secondary)" }}>
                    {selectedAddress?.label} — {selectedAddress?.recipient}, {selectedAddress?.phone}<br />
                    {selectedAddress?.address}
                  </div>
                  <div style={{ fontWeight: 700, fontSize: "0.86rem", margin: "12px 0 4px" }}>Payment method</div>
                  <div style={{ fontSize: "0.84rem", color: "var(--sabi-text-secondary)" }}>
                    {PAYMENT_METHODS.find((m) => m.id === paymentMethod)?.label}
                  </div>
                </div>

                <p style={{ fontSize: "0.78rem", color: "var(--sabi-text-secondary)", marginTop: 4 }}>
                  This sends your order request to the pharmacy. No payment is processed yet — connecting a real payment provider is required before this can charge a card, verify a transfer, or confirm the order.
                </p>
                <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                  <button type="button" className="sabi-btn-outline" onClick={() => setStep(2)}>Back</button>
                  <button type="button" className="sabi-btn-primary" disabled={placing} onClick={handlePlaceOrder}>
                    {placing ? "Sending Order…" : `Send Order Request · ${formatNaira(grandTotal)}`}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="sabi-cart-summary">
            <h3>Order Summary</h3>
            {groups.map(({ pharmacy, subtotal }) => (
              <div className="sabi-cart-summary-row" key={pharmacy.id}>
                <span>{pharmacy.name}</span>
                <span>{formatNaira(subtotal)}</span>
              </div>
            ))}
            <div className="sabi-cart-summary-row">
              <span>Delivery fee</span>
              <span>{formatNaira(deliveryFee)}</span>
            </div>
            <div className="sabi-cart-summary-row total">
              <span>Total</span>
              <span>{formatNaira(grandTotal)}</span>
            </div>
          </div>
        </div>

        {toast && <div className="sabi-toast">{toast}</div>}
      </div>
    </div>
  );
}

export default CheckoutPage;
