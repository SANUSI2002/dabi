import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Minus, Plus, ShoppingBag, Store, Trash2 } from "lucide-react";

import "../../styles/share.css";
import "./PharmacyMarket.css";

import { pageVars } from "../../pageVars";
import { useZoom } from "../../hooks/useZoom";
import { formatNaira } from "../../utils/currency";
import { Sidebar, Topbar } from "../dashboard/components";
import { clearCart, getCart, setCartQty, removeFromCart, findProduct, findPharmacy } from "./cartStore";


function buildGroups(cart) {
  return Object.entries(cart)
    .map(([pharmacyId, items]) => {
      const pharmacy = findPharmacy(pharmacyId);
      if (!pharmacy) return null;
      const lines = Object.entries(items)
        .map(([productId, qty]) => {
          const product = findProduct(pharmacyId, productId);
          if (!product) return null;
          return { product, qty };
        })
        .filter(Boolean);
      if (lines.length === 0) return null;
      const subtotal = lines.reduce((sum, l) => sum + l.product.price * l.qty, 0);
      return { pharmacy, lines, subtotal };
    })
    .filter(Boolean);
}

export function CartPage() {
  const [zoom] = useZoom();
  const navigate = useNavigate();
  const [cart, setCart] = useState(getCart);
  const [toast, setToast] = useState("");

  const groups = useMemo(() => buildGroups(cart), [cart]);
  const itemsTotal = groups.reduce((sum, g) => sum + g.subtotal, 0);
  // Delivery (by distance) and the platform fee are priced at checkout.
  const grandTotal = itemsTotal;
  const totalItemCount = groups.reduce((sum, g) => sum + g.lines.reduce((s, l) => s + l.qty, 0), 0);

  const notify = (message) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2000);
  };

  const changeQty = (pharmacyId, productId, delta, currentQty) => {
    const next = setCartQty(pharmacyId, productId, Math.max(0, currentQty + delta));
    setCart(next);
  };

  const remove = (pharmacyId, productId, name) => {
    const next = removeFromCart(pharmacyId, productId);
    setCart(next);
    notify(`${name} removed from cart`);
  };

  const handleClearCart = () => {
    clearCart();
    setCart({});
    notify("Cart cleared");
  };

  return (
    <div className="sabi-dashboard" style={{ ...pageVars, zoom }}>
      <Sidebar />
      <div className="sabi-main sabi-storefront-main">
        <Topbar placeholder="Search medicines, pharmacies..." />

        <button className="sabi-rxd-back" onClick={() => navigate("/pharmacy-market")}>
          <ArrowLeft size={18} /> Continue Shopping
        </button>

        <div className="sabi-fam-header sabi-cart-page-header" style={{ marginTop: 12 }}>
          <div>
            <h1 style={{ color: "var(--sabi-primary-dark)", fontSize: "1.5rem", fontWeight: 800, margin: "0 0 4px" }}>
              Your Cart
            </h1>
            <p style={{ margin: 0, color: "var(--sabi-text-secondary)" }}>
              {totalItemCount > 0 ? `${totalItemCount} item(s) from ${groups.length} pharmac${groups.length === 1 ? "y" : "ies"}` : "Your cart is empty"}
            </p>
          </div>
          {groups.length > 0 && <button type="button" className="sabi-btn-outline" onClick={handleClearCart}>Clear Cart</button>}
        </div>

        {groups.length === 0 ? (
          <div className="sabi-card sabi-empty-state">
            <ShoppingBag size={40} />
            <h3>Your cart is empty</h3>
            <p>Browse the marketplace and add medicines or health essentials to get started.</p>
            <button type="button" className="sabi-btn-primary" style={{ marginTop: 8 }} onClick={() => navigate("/pharmacy-market")}>
              Browse Marketplace
            </button>
          </div>
        ) : (
          <div className="sabi-cart-layout">
            <div>
              {groups.map(({ pharmacy, lines, subtotal }) => (
                <div className="sabi-card sabi-cart-group" key={pharmacy.id}>
                  <div className="sabi-cart-group-head">
                    <h3><Store size={16} /> {pharmacy.name}</h3>
                    <button type="button" className="sabi-btn-ghost" onClick={() => navigate(lines[0]?.product.prescriptionId ? `/prescriptions/${lines[0].product.prescriptionId}/quotes` : `/pharmacy-market/${pharmacy.id}`)}>
                      Add more items
                    </button>
                  </div>

                  {lines.map(({ product, qty }) => (
                    <div className="sabi-cart-item" key={product.id}>
                      <img src={product.photo} alt={product.name} />
                      <div>
                        <div className="sabi-cart-item-name">{product.name}</div>
                        <div className="sabi-cart-item-category">{product.category}</div>
                      </div>
                      <div className="sabi-stepper">
                        <button type="button" onClick={() => changeQty(pharmacy.id, product.id, -1, qty)} aria-label="Decrease quantity" disabled={product.fixedQuantity}>
                          <Minus size={13} />
                        </button>
                        <span>{qty}</span>
                        <button type="button" onClick={() => changeQty(pharmacy.id, product.id, 1, qty)} aria-label="Increase quantity" disabled={product.fixedQuantity}>
                          <Plus size={13} />
                        </button>
                      </div>
                      <div className="sabi-cart-item-price">
                        {formatNaira(product.price * qty)}
                        <small>{formatNaira(product.price)} each</small>
                      </div>
                      <button type="button" className="sabi-cart-remove" onClick={() => remove(pharmacy.id, product.id, product.name)} aria-label={`Remove ${product.name}`}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}

                  <div className="sabi-cart-summary-row total" style={{ marginTop: 4 }}>
                    <span>Store subtotal</span>
                    <span>{formatNaira(subtotal)}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="sabi-cart-summary">
              <h3>Order Summary</h3>
              <div className="sabi-cart-summary-row">
                <span>Items ({totalItemCount})</span>
                <span>{formatNaira(itemsTotal)}</span>
              </div>
              <div className="sabi-cart-summary-row">
                <span>Delivery fee ({groups.length} store{groups.length === 1 ? "" : "s"})</span>
                <span>Calculated at checkout</span>
              </div>
              <div className="sabi-cart-summary-row total">
                <span>Total</span>
                <span>{formatNaira(grandTotal)}</span>
              </div>

              {/* One checkout covers every pharmacy group — Sabi Health routes
                  each group to its own pharmacy behind the scenes. */}
              <button
                type="button"
                className="sabi-btn-primary sabi-btn-block"
                style={{ marginTop: 16 }}
                onClick={() => navigate("/checkout")}
              >
                Proceed to Checkout · {formatNaira(grandTotal)}
              </button>
            </div>
          </div>
        )}

        {toast && <div className="sabi-toast">{toast}</div>}
      </div>
    </div>
  );
}

export default CartPage;
