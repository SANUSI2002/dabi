import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, History, RotateCw, Store, CheckCircle2 } from "lucide-react";

import "../../styles/share.css";
import "./PharmacyMarket.css";

import { pageVars } from "../../pageVars";
import { useZoom } from "../../hooks/useZoom";
import { formatNaira } from "../../utils/currency";
import { Sidebar, Topbar } from "../dashboard/components";
import { getLastOrder, addPrescriptionItemToCart, findProduct } from "./cartStore";

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return "";
  }
}

export function RepeatLastOrderPage() {
  const [zoom] = useZoom();
  const navigate = useNavigate();
  const [order] = useState(getLastOrder);
  const [added, setAdded] = useState(() => new Set());
  const [toast, setToast] = useState("");

  const notify = (message) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2400);
  };

  const addLine = (pharmacyId, item) => {
    const existing = findProduct(pharmacyId, item.productId);
    const product = existing || { id: item.productId, name: item.name, price: item.price, category: "Reorder" };
    addPrescriptionItemToCart(pharmacyId, product, item.qty);
    setAdded((prev) => new Set(prev).add(`${pharmacyId}:${item.productId}`));
  };

  const addAll = () => {
    order.groups.forEach((g) => g.items.forEach((item) => addLine(g.pharmacyId, item)));
    notify("Order added to your cart");
    window.setTimeout(() => navigate("/cart"), 500);
  };

  return (
    <div className="sabi-dashboard" style={{ ...pageVars, zoom }}>
      <Sidebar />
      <div className="sabi-main sabi-storefront-main sabi-repeat-page">
        <Topbar placeholder="Search medicines, pharmacies..." />

        <button className="sabi-rxd-back" onClick={() => navigate("/pharmacy-market")}>
          <ArrowLeft size={18} /> Back to Marketplace
        </button>

        <div className="sabi-fam-header sabi-repeat-heading" style={{ marginTop: 12 }}>
          <div>
            <h1 style={{ color: "var(--sabi-primary-dark)", fontSize: "1.5rem", fontWeight: 800, margin: "0 0 4px" }}>
              <History size={22} style={{ verticalAlign: "-4px", marginRight: 8 }} />
              Repeat Last Order
            </h1>
            <p style={{ margin: 0, color: "var(--sabi-text-secondary)" }}>
              Order {order.id} · Placed {formatDate(order.placedAt)} · {order.status}
            </p>
          </div>
          <div className="sabi-fam-header-actions">
            <button type="button" className="sabi-btn-primary" onClick={addAll}>
              <RotateCw size={16} /> Add Entire Order to Cart
            </button>
          </div>
        </div>

        {order.groups.map((g) => (
          <div className="sabi-card sabi-cart-group sabi-repeat-order" key={g.pharmacyId}>
            <div className="sabi-cart-group-head">
              <h3><Store size={16} /> {g.pharmacyName}</h3>
            </div>

            {g.items.map((item) => {
              const key = `${g.pharmacyId}:${item.productId}`;
              const isAdded = added.has(key);
              return (
                <div className="sabi-cart-item sabi-repeat-item" key={item.productId}>
                  <div>
                    <div className="sabi-cart-item-name">{item.name}</div>
                    <div className="sabi-cart-item-category">Qty {item.qty}</div>
                  </div>
                  <div className="sabi-cart-item-price">{formatNaira(item.price * item.qty)}</div>
                  <button
                    type="button"
                    className={isAdded ? "sabi-btn-outline" : "sabi-btn-primary"}
                    onClick={() => { addLine(g.pharmacyId, item); notify(`${item.name} added to cart`); }}
                  >
                    {isAdded ? <><CheckCircle2 size={14} /> Added</> : "Add to Cart"}
                  </button>
                </div>
              );
            })}

            <div className="sabi-cart-summary-row total">
              <span>Subtotal</span>
              <span>{formatNaira(g.subtotal)}</span>
            </div>
          </div>
        ))}

        <div className="sabi-card sabi-repeat-totals">
          <div className="sabi-cart-summary-row"><span>Items total</span><span>{formatNaira(order.itemsTotal)}</span></div>
          <div className="sabi-cart-summary-row"><span>Delivery fee (last paid)</span><span>{formatNaira(order.deliveryFee)}</span></div>
          <div className="sabi-cart-summary-row total"><span>Order total (last paid)</span><span>{formatNaira(order.grandTotal)}</span></div>
        </div>

        {toast && <div className="sabi-toast">{toast}</div>}
      </div>
    </div>
  );
}

export default RepeatLastOrderPage;
