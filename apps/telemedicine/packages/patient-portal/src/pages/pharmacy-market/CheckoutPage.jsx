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
import { getCart, clearCart, getAddresses, addAddress, findProduct, findPharmacy } from "./cartStore";
import {
  createOrder, createReservation, initializePayment, naira, newIdempotencyKey, previewCheckout, rememberPendingOrder,
} from "../../api/commerceApi";
import { getCurrentUser } from "../../utils/sabiIdentity";

// Card and bank transfer are both paid on Paystack's secure page.
const PAYMENT_METHODS = [
  { id: "card", label: "Debit / Credit Card", icon: CreditCard },
  { id: "transfer", label: "Bank Transfer", icon: Landmark },
  { id: "delivery", label: "Pay on Delivery (coming soon)", icon: Wallet, disabled: true },
];

// The delivery pin for a new address: the device's current location.
const currentPosition = () =>
  new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { timeout: 8000, maximumAge: 300000 },
    );
  });

const RESERVATION_ERRORS = {
  COVERAGE: "Add every medication on the prescription to your order before checking out",
  STOCK: "A pharmacy no longer has enough stock for your order. Check the latest quotes and try again",
  INVALID: "One of these quotes has expired or changed. Check the latest quotes and try again",
};

const fulfilmentMethod = (group) => (group.lines[0]?.product.deliveryMode === "pickup" ? "PICKUP" : "DELIVERY");

function buildGroups(cart) {
  return Object.entries(cart)
    .map(([pharmacyId, items]) => {
      const pharmacy = findPharmacy(pharmacyId);
      if (!pharmacy) return null;
      const lines = Object.entries(items)
        .map(([productId, qty]) => {
          const product = findProduct(pharmacyId, productId);
          return product?.source === "prescription" ? { product, qty } : null;
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
  const needsDelivery = groups.some((group) => fulfilmentMethod(group) === "DELIVERY");
  const prescriptionIds = [...new Set(groups.flatMap((group) => group.lines.map((l) => l.product.prescriptionId)))];

  // Set on Review: the stock hold and the server's prices for it.
  const [prepared, setPrepared] = useState(null); // { reservationId, preview }
  const [preparing, setPreparing] = useState(false);
  const [keys] = useState(() => ({ reservation: newIdempotencyKey(), order: newIdempotencyKey(), payment: newIdempotencyKey() }));
  const preview = prepared?.preview;
  const deliveryFee = preview ? naira(preview.deliveryFeeMinor) : null;
  const platformFee = preview ? naira(preview.platformFeeMinor) : 0;
  const grandTotal = preview ? naira(preview.totalPayableMinor) : itemsTotal;

  const [step, setStep] = useState(1);
  const [addresses, setAddresses] = useState(getAddresses);
  const [selectedAddressId, setSelectedAddressId] = useState(() => addresses.find((a) => a.isDefault)?.id || addresses[0]?.id || null);
  const [showAddressForm, setShowAddressForm] = useState(addresses.length === 0);
  const [newAddress, setNewAddress] = useState({ label: "", recipient: "", phone: "", address: "" });
  const [paymentMethod, setPaymentMethod] = useState("card");
  const [newAddressError, setNewAddressError] = useState("");
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

  const handleSaveNewAddress = async () => {
    if (!newAddress.label.trim() || !newAddress.address.trim() || !newAddress.phone.trim()) {
      notify("Please fill in label, phone, and address");
      return;
    }
    // Riders need a map pin for the address; use where the patient is now.
    const pin = await currentPosition();
    if (!pin) {
      setNewAddressError("Allow location access so we can pin this address for the rider.");
      return;
    }
    setNewAddressError("");
    const saved = addAddress({ ...newAddress, recipient: newAddress.recipient.trim() || getCurrentUser()?.fullName || "", ...pin });
    const next = getAddresses();
    setAddresses(next);
    setSelectedAddressId(saved.id);
    setShowAddressForm(false);
    setNewAddress({ label: "", recipient: "", phone: "", address: "" });
  };

  const goToPayment = () => {
    if (needsDelivery && !selectedAddress) {
      notify("Select or add a delivery address first");
      return;
    }
    if (needsDelivery && (selectedAddress.lat == null || selectedAddress.lng == null)) {
      notify("This address has no map pin — add it again so we can price delivery");
      return;
    }
    setStep(2);
  };

  // Review: hold the stock for 20 minutes and get the server's final prices.
  const goToReview = async () => {
    if (prescriptionIds.length !== 1) {
      notify("Check out one prescription at a time");
      return;
    }
    setPreparing(true);
    try {
      const reservation = prepared?.reservationId
        ? { id: prepared.reservationId }
        : await createReservation({
            prescriptionId: prescriptionIds[0],
            idempotencyKey: keys.reservation,
            allocations: groups.flatMap((group) =>
              group.lines.map(({ product, qty }) => ({ prescriptionItemId: product.prescriptionItemId, quoteItemId: product.quoteItemId, selectedQuantity: qty }))),
          });
      const nextPreview = await previewCheckout(reservation.id, {
        fulfilments: groups.map((group) => ({ pharmacyId: group.pharmacy.id, fulfilmentMethod: fulfilmentMethod(group) })),
        deliveryCoordinates: needsDelivery ? { latitude: selectedAddress.lat, longitude: selectedAddress.lng } : undefined,
      });
      setPrepared({ reservationId: reservation.id, preview: nextPreview });
      setStep(3);
    } catch (err) {
      notify(RESERVATION_ERRORS[err.code] || err.message);
    } finally {
      setPreparing(false);
    }
  };

  // Creates the order from the held stock, then hands over to Paystack to pay.
  const handlePlaceOrder = async () => {
    if (!groups.length || !prepared) return;
    setPlacing(true);
    try {
      const order = await createOrder({
        reservationId: prepared.reservationId,
        idempotencyKey: keys.order,
        fulfilments: groups.map((group) => ({ pharmacyId: group.pharmacy.id, fulfilmentMethod: fulfilmentMethod(group) })),
        delivery: needsDelivery
          ? {
              recipientName: selectedAddress.recipient || getCurrentUser()?.fullName || "Patient",
              recipientPhone: selectedAddress.phone.replace(/[\s-]/g, ""),
              address: selectedAddress.address,
              coordinates: { latitude: selectedAddress.lat, longitude: selectedAddress.lng },
            }
          : undefined,
      });
      const payment = await initializePayment(order.id, keys.payment);
      rememberPendingOrder(order.id, needsDelivery ? selectedAddress : null);
      clearCart();
      window.location.assign(payment.authorizationUrl);
    } catch (err) {
      notify(err.message);
      setPlacing(false);
    }
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

                {!needsDelivery && (
                  <p style={{ margin: "0 0 12px", fontSize: "0.84rem", color: "var(--sabi-text-secondary)" }}>
                    Everything in this order is for in-store pickup, so no delivery address is needed.
                  </p>
                )}
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
                    {newAddressError && <p className="sabi-form-error" role="alert">{newAddressError}</p>}
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
                        onClick={() => !method.disabled && setPaymentMethod(method.id)}
                        aria-disabled={method.disabled || undefined}
                        style={method.disabled ? { opacity: 0.55, cursor: "not-allowed" } : undefined}
                      >
                        <div className="icon"><Icon size={18} /></div>
                        <strong>{method.label}</strong>
                      </div>
                    );
                  })}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="button" className="sabi-btn-outline" onClick={() => setStep(1)}>Back</button>
                  <button type="button" className="sabi-btn-primary" disabled={preparing} onClick={goToReview}>{preparing ? "Checking stock & prices…" : "Review Order"}</button>
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
                  <div style={{ fontWeight: 700, fontSize: "0.86rem", marginBottom: 6 }}>{needsDelivery ? "Delivering to" : "Collecting from"}</div>
                  <div style={{ fontSize: "0.84rem", color: "var(--sabi-text-secondary)" }}>
                    {needsDelivery ? (
                      <>
                        {selectedAddress?.label} — {selectedAddress?.recipient}, {selectedAddress?.phone}<br />
                        {selectedAddress?.address}
                      </>
                    ) : (
                      groups.map((g) => g.pharmacy.name).join(", ")
                    )}
                  </div>
                  <div style={{ fontWeight: 700, fontSize: "0.86rem", margin: "12px 0 4px" }}>Payment method</div>
                  <div style={{ fontSize: "0.84rem", color: "var(--sabi-text-secondary)" }}>
                    {PAYMENT_METHODS.find((m) => m.id === paymentMethod)?.label}
                  </div>
                </div>

                <p style={{ fontSize: "0.78rem", color: "var(--sabi-text-secondary)", marginTop: 4 }}>
                  You&apos;ll pay securely on Paystack. Your medicines are held for you until {preview ? new Date(preview.reservationExpiresAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "checkout"}; the pharmacist reviews the prescription once payment succeeds.
                </p>
                <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                  <button type="button" className="sabi-btn-outline" onClick={() => setStep(2)}>Back</button>
                  <button type="button" className="sabi-btn-primary" disabled={placing} onClick={handlePlaceOrder}>
                    {placing ? "Opening Paystack…" : `Pay Securely · ${formatNaira(grandTotal)}`}
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
              <span>{deliveryFee == null ? (needsDelivery ? "Calculated at review" : formatNaira(0)) : formatNaira(deliveryFee)}</span>
            </div>
            {platformFee > 0 && (
              <div className="sabi-cart-summary-row">
                <span>Service fee</span>
                <span>{formatNaira(platformFee)}</span>
              </div>
            )}
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
