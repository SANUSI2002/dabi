import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CheckCircle2, MapPin, Package, Truck } from "lucide-react";

import "../../styles/share.css";
import "./PharmacyMarket.css";

import { pageVars } from "../../pageVars";
import { useZoom } from "../../hooks/useZoom";
import { formatNaira } from "../../utils/currency";
import { Sidebar, Topbar } from "../dashboard/components";
import { getOrder, getPayment, naira, pendingOrder } from "../../api/commerceApi";

// The order in the shape this page reads: one group per pharmacy, amounts in naira.
function toView(order, address) {
  return {
    id: order.id,
    reference: order.reference,
    status: order.status,
    groups: order.fulfilments.map((f) => ({
      pharmacyId: f.pharmacy?.id,
      pharmacyName: f.pharmacy?.name || "Pharmacy",
      method: f.fulfilmentMethod,
      items: (f.allocations || []).map((a) => ({ name: a.medicationName, qty: a.selectedQuantity, price: naira(a.unitPriceMinor) })),
    })),
    deliveryFee: naira(order.deliveryFeeMinor),
    grandTotal: naira(order.totalPayableMinor),
    address,
  };
}
import { openExternalDirections, validateCoordinates } from "../../utils/mapUtils";

export function OrderConfirmationPage() {
  const [zoom] = useZoom();
  const navigate = useNavigate();
  const { orderId: routeOrderId } = useParams();
  // Paystack returns to /order-confirmation without an id; the checkout remembered it for this tab.
  const pending = pendingOrder();
  const orderId = routeOrderId || pending?.orderId;
  const [order, setOrder] = useState(null);
  const [payment, setPayment] = useState(null);
  const [missing, setMissing] = useState(false);
  const paid = payment?.status === "SUCCESS" || order?.status === "PAID";
  const failed = ["FAILED", "CANCELLED", "EXPIRED"].includes(payment?.status) || order?.status === "PAYMENT_FAILED";
  const trackingOrderId = paid ? order?.id : null;
  const [destinationLat, destinationLng] = validateCoordinates(order?.address?.lat, order?.address?.lng);
  const [secondsRemaining, setSecondsRemaining] = useState(3);

  // Load the order, then keep checking until Paystack's confirmation arrives.
  useEffect(() => {
    if (!orderId) {
      setMissing(true);
      return undefined;
    }
    let live = true;
    let timer;
    let tries = 0;
    const check = async () => {
      try {
        const [nextOrder, nextPayment] = await Promise.all([getOrder(orderId), getPayment(orderId).catch(() => null)]);
        if (!live) return;
        setOrder(toView(nextOrder, pending?.orderId === orderId ? pending.address : null));
        setPayment(nextPayment);
        const settled = nextOrder.status !== "PENDING_PAYMENT" || ["SUCCESS", "FAILED", "CANCELLED", "EXPIRED"].includes(nextPayment?.status);
        tries += 1;
        if (!settled && tries < 40) timer = window.setTimeout(check, 3000);
      } catch {
        if (live) setMissing(true);
      }
    };
    check();
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [orderId]);

  /* DEBUG NOTE: Checkout flow - Show purchase confirmation before handing the active order to delivery tracking. */
  useEffect(() => {
    if (!trackingOrderId) return undefined;
    const trackingPath = `/delivery-tracking/${trackingOrderId}?lat=${destinationLat}&lng=${destinationLng}`;
    const countdown = window.setInterval(() => {
      setSecondsRemaining((seconds) => Math.max(0, seconds - 1));
    }, 1000);
    const redirect = window.setTimeout(() => navigate(trackingPath, { replace: true }), 3000);

    return () => {
      window.clearInterval(countdown);
      window.clearTimeout(redirect);
    };
  }, [destinationLat, destinationLng, navigate, trackingOrderId]);

  if (!order) {
    if (!missing) {
      return (
        <div className="sabi-dashboard" style={{ ...pageVars, zoom }}>
          <Sidebar />
          <div className="sabi-main">
            <Topbar />
            <div className="sabi-card sabi-empty-state sabi-pharmacy-empty-state">
              <p>Loading your order…</p>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="sabi-dashboard" style={{ ...pageVars, zoom }}>
        <Sidebar />
        <div className="sabi-main">
          <Topbar />
          <div className="sabi-card sabi-empty-state sabi-pharmacy-empty-state">
            <p>We couldn&apos;t find that order.</p>
            <button className="sabi-btn-primary" onClick={() => navigate("/pharmacy-market")}>Back to Marketplace</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="sabi-dashboard" style={{ ...pageVars, zoom }}>
      <Sidebar />
      <div className="sabi-main">
        <Topbar placeholder="Search medicines, pharmacies..." />

        <div className="sabi-order-success">
          <div className="sabi-order-success-check"><CheckCircle2 size={40} /></div>
          <h1>{paid ? "Order Placed" : failed ? "Payment Didn't Go Through" : "Confirming Your Payment…"}</h1>
          <p>
            {paid
              ? `Payment received. ${order.groups.length === 1 ? "The pharmacist" : `Pharmacists at ${order.groups.length} pharmacies`} will now review your prescription and prepare it — you'll see each update here.`
              : failed
                ? "Your payment wasn't completed, so the medicines have been released. You can send the prescription again for fresh quotes."
                : "We're waiting for Paystack to confirm your payment. This usually takes a few seconds."}
          </p>
          <div className="sabi-order-id-box">Order {order.reference}</div>
          {paid && <p className="sabi-order-redirect-message">Taking you to delivery tracking in {secondsRemaining}s…</p>}

          <div className="sabi-card" style={{ textAlign: "left", marginBottom: 16 }}>
            <div className="sabi-fam-section-head">
              <h2 style={{ fontSize: "1rem" }}><Package size={16} style={{ verticalAlign: "-3px", marginRight: 6 }} />Items</h2>
            </div>
            {order.groups.map((g) => (
              <div key={g.pharmacyId} style={{ marginBottom: 12 }}>
                <div style={{ fontWeight: 700, fontSize: "0.86rem", marginBottom: 4 }}>{g.pharmacyName}</div>
                {g.items.map((item) => (
                  <div className="sabi-checkout-review-item" key={item.name}>
                    <span>{item.name} × {item.qty}</span>
                    <span>{formatNaira(item.price * item.qty)}</span>
                  </div>
                ))}
              </div>
            ))}
            <div className="sabi-cart-summary-row">
              <span>Delivery fee</span>
              <span>{formatNaira(order.deliveryFee)}</span>
            </div>
            <div className="sabi-cart-summary-row total">
              <span>Order total</span>
              <span>{formatNaira(order.grandTotal)}</span>
            </div>
          </div>

          <div className="sabi-card" style={{ textAlign: "left", marginBottom: 16 }}>
            <div className="sabi-fam-section-head">
              <h2 style={{ fontSize: "1rem" }}><MapPin size={16} style={{ verticalAlign: "-3px", marginRight: 6 }} />{order.address ? "Delivering to" : "Collecting from"}</h2>
            </div>
            <p style={{ margin: 0, fontSize: "0.86rem", color: "var(--sabi-text-secondary)" }}>
              {order.address ? (
                <>
                  {order.address.label} — {order.address.recipient}, {order.address.phone}<br />
                  {order.address.address}
                </>
              ) : (
                order.groups.map((g) => `${g.pharmacyName} (${g.method === "PICKUP" ? "pickup" : "delivery"})`).join(", ")
              )}
            </p>
            {/* DEBUG NOTE: Connected location click handler to trigger directions. */}
            <button type="button" className="sabi-btn-outline" style={{ marginTop: 12 }} onClick={() => openExternalDirections(destinationLat, destinationLng, order.address?.address)}>
              Get Directions
            </button>
          </div>

          <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
            <button type="button" className="sabi-btn-outline" onClick={() => navigate("/pharmacy-market")}>
              Continue Shopping
            </button>
            {/* DEBUG NOTE: Connected location click handler to pass the active delivery coordinates to the map. */}
            <button type="button" className="sabi-btn-primary" onClick={() => navigate(`/delivery-tracking/${order.id}?lat=${destinationLat}&lng=${destinationLng}`)}>
              <Truck size={15} /> Track Delivery
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default OrderConfirmationPage;
