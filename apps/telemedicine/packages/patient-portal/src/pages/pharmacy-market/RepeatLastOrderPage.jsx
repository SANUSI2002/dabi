import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, History, RotateCw, Store, CheckCircle2 } from "lucide-react";

import "../../styles/share.css";
import "./PharmacyMarket.css";

import { pageVars } from "../../pageVars";
import { useZoom } from "../../hooks/useZoom";
import { formatNaira } from "../../utils/currency";
import { Sidebar, Topbar } from "../dashboard/components";
import { useApiData } from "../../api/useApiData";
import { listOrders, listPrescriptions, naira, ORDER_LABELS } from "../../api/commerceApi";

// The most recent paid order, with the prescription each line came from.
async function loadLastOrder() {
  const [orders, prescriptions] = await Promise.all([listOrders(), listPrescriptions()]);
  const last = orders.filter((o) => o.status === "PAID").sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
  if (!last) return null;
  const prescriptionOf = new Map(prescriptions.flatMap((p) => p.items.map((item) => [item.id, p.id])));
  const groups = last.fulfilments.map((f) => {
    const items = (f.allocations || []).map((a) => ({
      productId: a.prescriptionItemId,
      prescriptionId: prescriptionOf.get(a.prescriptionItemId) || null,
      name: a.medicationName,
      qty: a.selectedQuantity,
      price: naira(a.unitPriceMinor),
    }));
    return { pharmacyId: f.pharmacy?.id, pharmacyName: f.pharmacy?.name || "Pharmacy", items, subtotal: naira(f.subtotalMinor) };
  });
  return {
    id: last.reference,
    placedAt: last.createdAt,
    status: ORDER_LABELS[last.status] || last.status,
    groups,
    itemsTotal: naira(last.subtotalMinor),
    deliveryFee: naira(last.deliveryFeeMinor),
    grandTotal: naira(last.totalPayableMinor),
  };
}

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
  const { data: order, loading } = useApiData(loadLastOrder, []);
  const [added] = useState(() => new Set());
  const [toast, setToast] = useState("");

  const notify = (message) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2400);
  };

  // Prices change, so a reorder sends the prescription back to pharmacies for fresh quotes.
  const addLine = (pharmacyId, item) => {
    if (!item.prescriptionId) {
      notify("This prescription is no longer active. Ask your doctor for a new one.");
      return;
    }
    navigate(`/prescriptions/${item.prescriptionId}/select-pharmacy`);
  };

  const addAll = () => {
    const first = order.groups.flatMap((g) => g.items).find((item) => item.prescriptionId);
    addLine(null, first || {});
  };

  if (!order) {
    return (
      <div className="sabi-dashboard" style={{ ...pageVars, zoom }}>
        <Sidebar />
        <div className="sabi-main">
          <Topbar />
          <div className="sabi-card sabi-empty-state">
            <History size={40} />
            <h3>{loading ? "Loading your last order…" : "No past orders yet"}</h3>
            {!loading && <p>Orders you pay for will show up here so you can reorder them quickly.</p>}
            <button type="button" className="sabi-btn-primary" style={{ marginTop: 8 }} onClick={() => navigate("/prescriptions")}>
              Go to Prescriptions
            </button>
          </div>
        </div>
      </div>
    );
  }

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
                    onClick={() => addLine(g.pharmacyId, item)}
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
