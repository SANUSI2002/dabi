import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CheckCircle2, MapPin, Package, Truck } from "lucide-react";

import "../../styles/share.css";
import "./PharmacyMarket.css";

import { pageVars } from "../../pageVars";
import { useZoom } from "../../hooks/useZoom";
import { formatNaira } from "../../utils/currency";
import { Sidebar, Topbar } from "../dashboard/components";
import { getOrder } from "./cartStore";
import { openExternalDirections, validateCoordinates } from "../../utils/mapUtils";

export function OrderConfirmationPage() {
  const [zoom] = useZoom();
  const navigate = useNavigate();
  const { orderId } = useParams();
  const order = getOrder(orderId);
  const trackingOrderId = order?.id;
  const [destinationLat, destinationLng] = validateCoordinates(order?.address?.lat, order?.address?.lng);
  const [secondsRemaining, setSecondsRemaining] = useState(3);

  /* DEBUG NOTE: Checkout flow - Show purchase confirmation before handing the active order to delivery tracking. */
  useEffect(() => {
    if (!order) return undefined;
    const trackingPath = `/delivery-tracking/${trackingOrderId.replace(/^SH-/, "")}?lat=${destinationLat}&lng=${destinationLng}`;
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
          <h1>Order Request Sent</h1>
          <p>We&apos;ve sent your order request to {order.groups.length} pharmac{order.groups.length === 1 ? "y" : "ies"}. No payment has been processed yet — you&apos;ll get updates as the pharmacy confirms and prepares it.</p>
          <div className="sabi-order-id-box">Order {order.id}</div>
          <p className="sabi-order-redirect-message">Taking you to delivery tracking in {secondsRemaining}s…</p>

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
              <h2 style={{ fontSize: "1rem" }}><MapPin size={16} style={{ verticalAlign: "-3px", marginRight: 6 }} />Delivering to</h2>
            </div>
            <p style={{ margin: 0, fontSize: "0.86rem", color: "var(--sabi-text-secondary)" }}>
              {order.address?.label} — {order.address?.recipient}, {order.address?.phone}<br />
              {order.address?.address}
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
            <button type="button" className="sabi-btn-primary" onClick={() => navigate(`/delivery-tracking/${order.id.replace(/^SH-/, "")}?lat=${destinationLat}&lng=${destinationLng}`)}>
              <Truck size={15} /> Track Delivery
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default OrderConfirmationPage;
