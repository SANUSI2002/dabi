import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ShieldCheck, ShoppingCart } from "lucide-react";
import { apiBaseUrl } from "../../utils/sabiIdentity";
import { Sidebar, Topbar } from "../dashboard/components";
import { pageVars } from "../../pageVars";
import { useZoom } from "../../hooks/useZoom";
import { formatNaira } from "../../utils/currency";
import {
  addToCart,
  findProduct,
  getCartForPharmacy,
  registerExtraPharmacy,
  registerExtraProduct,
} from "./cartStore";
import "../../styles/share.css";
import "./PharmacyMarket.css";

export default function LiveMarketplace({ pharmacyId }) {
  const [zoom] = useZoom(),
    navigate = useNavigate();
  const [rows, setRows] = useState([]),
    [page, setPage] = useState(1),
    [next, setNext] = useState(null);
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [search, setSearch] = useState(""),
    [category, setCategory] = useState(""),
    [branch, setBranch] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    const query = new URLSearchParams({
      page: String(page),
      ...(pharmacyId ? { pharmacyId } : {}),
    });
    fetch(`${apiBaseUrl}/api/v1/marketplace/products?${query}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok)
          throw new Error(
            result.message || "The marketplace could not be loaded.",
          );
        if (!controller.signal.aborted) {
          setRows(result.data.items);
          setNext(result.data.nextPage);
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [pharmacyId, page, retry]);
  const pharmacies = [
    ...new Map(
      rows.map((row) => [
        row.inventoryItem.pharmacy.id,
        row.inventoryItem.pharmacy,
      ]),
    ).values(),
  ];
  const branches = [
    ...new Map(
      rows.map((row) => [
        row.inventoryItem.branch.id,
        row.inventoryItem.branch,
      ]),
    ).values(),
  ];
  const visible = rows.filter(
    (row) =>
      (!category || row.category === category) &&
      (!branch || row.inventoryItem.branch.id === branch) &&
      `${row.inventoryItem.medicationName} ${row.inventoryItem.genericName || ""}`
        .toLowerCase()
        .includes(search.toLowerCase().trim()),
  );
  function add(row) {
    const item = row.inventoryItem,
      pharmacy = item.pharmacy;
    const cart = getCartForPharmacy(pharmacy.id);
    if (
      Object.keys(cart).some((id) => {
        const existing = findProduct(pharmacy.id, id);
        return (
          existing?.source === "marketplace" &&
          existing.branchId !== item.branch.id
        );
      })
    ) {
      setNotice(
        "Your cart already contains products from another branch of this pharmacy. Remove those products in your cart before choosing this branch.",
      );
      return;
    }
    if ((cart[row.id] || 0) >= item.availableQuantity) {
      setNotice("You have reached the currently available quantity.");
      return;
    }
    registerExtraPharmacy({
      id: pharmacy.id,
      name: pharmacy.name,
      address: item.branch.address,
    });
    registerExtraProduct(pharmacy.id, {
      id: row.id,
      listingId: row.id,
      branchId: item.branch.id,
      source: "marketplace",
      name: item.medicationName,
      price: item.unitPriceMinor / 100,
      photo: `${apiBaseUrl}${row.imageUrl}`,
      deliveryMode: pharmacy.tier.pickupEnabled ? "pickup" : "delivery",
      deliveryAvailable: pharmacy.tier.deliveryEnabled,
      pickupAvailable: pharmacy.tier.pickupEnabled,
    });
    addToCart(pharmacy.id, row.id, 1);
    setNotice(
      `${item.medicationName} added to your cart. Prices and stock will be checked again at checkout.`,
    );
  }
  return (
    <div className="sabi-dashboard" style={{ ...pageVars, zoom }}>
      <Sidebar />
      <main className="sabi-main sabi-storefront-main">
        <Topbar />
        {pharmacyId && (
          <Link className="sabi-rxd-back" to="/pharmacy-market">
            <ArrowLeft size={18} /> Marketplace
          </Link>
        )}
        <section className="sabi-storefront-hero">
          <h1>
            {pharmacyId
              ? pharmacies[0]?.name || "Pharmacy storefront"
              : "Your pharmacy, connected."}
          </h1>
          <p>
            Healthcare essentials from approved pharmacy branches. Every product
            shown has an image and has passed Sabi catalogue review.
          </p>
          <div className="sabi-storefront-hero-actions">
            <Link className="sabi-storefront-hero-primary" to="/prescriptions">
              Order from your prescription
            </Link>
            <Link className="sabi-storefront-hero-outline" to="/cart">
              <ShoppingCart size={18} /> Your cart
            </Link>
          </div>
        </section>
        <p>
          <ShieldCheck size={16} aria-hidden="true" /> Prescription-only
          medicines are supplied through your issued prescription, not this
          public catalogue.
        </p>
        {loading ? (
          <p role="status">Loading approved products…</p>
        ) : error ? (
          <div className="sabi-card" role="alert">
            <p>{error}</p>
            <button
              className="sabi-btn-primary"
              onClick={() => setRetry((value) => value + 1)}
            >
              Retry
            </button>
          </div>
        ) : (
          <>
            {!pharmacyId && pharmacies.length > 0 && (
              <section className="sabi-storefront-section">
                <h2>Browse pharmacies</h2>
                <div className="sabi-storefront-pharmacies">
                  {pharmacies.map((pharmacy) => (
                    <article
                      className="sabi-card sabi-storefront-pharmacy-body"
                      key={pharmacy.id}
                    >
                      <h3>{pharmacy.name}</h3>
                      <p>
                        {pharmacy.city}, {pharmacy.state}
                      </p>
                      <p>
                        {pharmacy.tier.deliveryEnabled
                          ? `Delivery within ${pharmacy.tier.deliveryRadiusKm} km of the serving branch`
                          : "Pickup only"}
                      </p>
                      <button
                        className="sabi-btn-primary"
                        onClick={() =>
                          navigate(`/pharmacy-market/${pharmacy.id}`)
                        }
                      >
                        Visit store
                      </button>
                    </article>
                  ))}
                </div>
              </section>
            )}
            <section
              className="sabi-card live-market-filters"
              aria-label="Filter products"
            >
              <label>
                Search this page
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>
              <label>
                Category
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  <option value="">All categories</option>
                  {[
                    "OTC",
                    "DEVICES",
                    "BABY",
                    "HYGIENE",
                    "SUPPLEMENTS",
                    "WELLNESS",
                  ].map((key) => (
                    <option key={key}>{key}</option>
                  ))}
                </select>
              </label>
              {pharmacyId && (
                <label>
                  Branch
                  <select
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                  >
                    <option value="">All branches</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </section>
            {visible.length === 0 ? (
              <div className="sabi-card sabi-empty-state">
                <h2>No products to show</h2>
                <p>
                  {rows.length
                    ? "No products on this page match your filters."
                    : "Approved, in-stock products will appear here when pharmacies publish their catalogues."}
                </p>
              </div>
            ) : (
              <section
                className="sabi-store-products"
                aria-label="Available products"
              >
                {visible.map((row) => (
                  <article
                    key={row.id}
                    className="sabi-card sabi-store-product"
                  >
                    <img
                      src={`${apiBaseUrl}${row.imageUrl}`}
                      alt={row.inventoryItem.medicationName}
                      loading="lazy"
                      width="240"
                      height="180"
                      style={{ objectFit: "contain" }}
                    />
                    <span className="sabi-store-product-category">
                      {row.category}
                    </span>
                    <h3>{row.inventoryItem.medicationName}</h3>
                    <p>{row.description}</p>
                    <p>
                      {row.inventoryItem.pharmacy.name} ·{" "}
                      {row.inventoryItem.branch.name}
                    </p>
                    <p>{row.inventoryItem.branch.address}</p>
                    {row.nafdacNumber && (
                      <small>NAFDAC registration: {row.nafdacNumber}</small>
                    )}
                    <div className="sabi-store-product-footer">
                      <strong>
                        {formatNaira(row.inventoryItem.unitPriceMinor / 100)}
                      </strong>
                      <button
                        type="button"
                        style={{ minWidth: 44, minHeight: 44 }}
                        onClick={() => add(row)}
                        aria-label={`Add ${row.inventoryItem.medicationName} to cart`}
                      >
                        <ShoppingCart size={18} />
                      </button>
                    </div>
                  </article>
                ))}
              </section>
            )}
            <nav
              className="live-market-pagination"
              aria-label="Catalogue pages"
            >
              <button
                className="sabi-btn-outline"
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </button>
              <span>Page {page}</span>
              <button
                className="sabi-btn-outline"
                disabled={!next}
                onClick={() => setPage(next)}
              >
                Next
              </button>
            </nav>
          </>
        )}
        {notice && (
          <div className="sabi-card" role="status">
            <p>{notice}</p>
            <Link to="/cart">View cart</Link>
            <button className="sabi-btn-outline" onClick={() => setNotice("")}>
              Dismiss
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
