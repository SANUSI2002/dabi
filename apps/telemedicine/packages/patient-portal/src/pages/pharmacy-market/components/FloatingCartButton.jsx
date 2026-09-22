import React, { useEffect, useState } from "react";
import { ShoppingCart } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { formatNaira } from "../../../utils/currency";
import { getCartSummary, subscribeToCart } from "../cartStore";

const HIDDEN_ROUTES = ["/login", "/signup", "/auth", "/verify", "/success", "/cart"];

/* A shell-level cart shortcut keeps the existing cart store as its sole data source. */
export function FloatingCartButton() {
  const navigate = useNavigate();
  const location = useLocation();
  const [summary, setSummary] = useState(getCartSummary);

  useEffect(() => subscribeToCart(() => setSummary(getCartSummary())), []);

  if (!summary.itemCount || HIDDEN_ROUTES.includes(location.pathname)) return null;

  return (
    <button type="button" className="sabi-global-cart-fab" onClick={() => navigate("/cart")}>
      <span className="sabi-global-cart-fab-icon">
        <ShoppingCart size={20} strokeWidth={2.25} />
        <span className="sabi-global-cart-fab-badge">{summary.itemCount > 99 ? "99+" : summary.itemCount}</span>
      </span>
      <span className="sabi-global-cart-fab-copy">
        <strong>View Cart</strong>
        <small>{summary.itemCount} item{summary.itemCount === 1 ? "" : "s"} · {formatNaira(summary.total)}</small>
      </span>
    </button>
  );
}

export default FloatingCartButton;
