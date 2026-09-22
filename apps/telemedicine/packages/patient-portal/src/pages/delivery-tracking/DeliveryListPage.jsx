import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Bike, ChevronRight, MapPin, Package, Store } from "lucide-react";

import "../../styles/share.css";
import "./DeliveryTracking.css";

import { pageVars } from "../../pageVars";
import { useZoom } from "../../hooks/useZoom";
import { formatNaira } from "../../utils/currency";
import { Sidebar, Topbar } from "../dashboard/components";
import { ACTIVE_DELIVERIES } from "./data";
import { getOrders } from "../pharmacy-market/cartStore";

function fromCheckoutOrder(order) {
  const firstGroup = order.groups?.[0];
  const extraStores = (order.groups?.length || 1) - 1;
  const firstItem = firstGroup?.items?.[0];
  const extraItems = (firstGroup?.items?.length || 1) - 1 + (order.groups?.slice(1).reduce((s, g) => s + g.items.length, 0) || 0);

  return {
    id: order.id.replace(/^SH-/, ""),
    status: order.status === "Delivered" ? "Delivered" : "Awaiting Confirmation",
    statusTone: order.status === "Delivered" ? "done" : "current",
    pharmacy: firstGroup ? `${firstGroup.pharmacyName}${extraStores > 0 ? ` + ${extraStores} more` : ""}` : "Sabi Health Order",
    location: order.address?.label ? `Delivering to ${order.address.label}` : "Delivery address on file",
    itemsSummary: firstItem ? `${firstItem.name}${extraItems > 0 ? ` + ${extraItems} more item${extraItems === 1 ? "" : "s"}` : ""}` : "Order items",
    total: formatNaira(order.grandTotal),
    eta: order.status === "Delivered" ? "Delivered" : "Pending dispatch",
    minutes: "—",
    distance: "—",
    rider: "Not assigned yet",
    vehicle: "—",
    fromCheckout: true,
  };
}

export function DeliveryListPage() {
  const [zoom] = useZoom();
  const navigate = useNavigate();

  const deliveries = useMemo(() => {
    const realOrders = getOrders().map(fromCheckoutOrder);
    return [...realOrders, ...ACTIVE_DELIVERIES];
  }, []);

  return (
    <div className="sabi-dashboard" style={{ ...pageVars, zoom }}>
      <Sidebar />
      <main className="sabi-main sabi-delivery-main">
        <Topbar placeholder="Search orders, meds..." />

        <header className="sabi-delivery-header">
          <span>◎</span>
          Delivery Tracking
        </header>

        {deliveries.length === 0 ? (
          <div className="sabi-card sabi-empty-state">
            <Package size={40} />
            <h3>No deliveries yet</h3>
            <p>Orders you place from the marketplace will show up here so you can track them in real time.</p>
            <button type="button" className="sabi-btn-primary" style={{ marginTop: 8 }} onClick={() => navigate("/pharmacy-market")}>
              Browse Marketplace
            </button>
          </div>
        ) : (
          <div className="sabi-delivery-list">
            {deliveries.map((d) => (
              <button
                type="button"
                key={d.id}
                className="sabi-delivery-list-item"
                onClick={() => navigate(`/delivery-tracking/${d.id}`)}
              >
                <div className="sabi-delivery-list-icon">
                  {d.statusTone === "done" ? <Package size={20} /> : <Bike size={20} />}
                </div>

                <div className="sabi-delivery-list-body">
                  <div className="sabi-delivery-list-top">
                    <strong>Order #{d.id}</strong>
                    <span className={`sabi-delivery-status-pill ${d.statusTone}`}>{d.status}</span>
                  </div>
                  <div className="sabi-delivery-list-meta">
                    <span><Store size={13} /> {d.pharmacy}</span>
                    <span><MapPin size={13} /> {d.location}</span>
                  </div>
                  <div className="sabi-delivery-list-items">{d.itemsSummary} · {d.total}</div>
                </div>

                <div className="sabi-delivery-list-trail">
                  <span>{d.eta}</span>
                  <ChevronRight size={18} />
                </div>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

export default DeliveryListPage;
