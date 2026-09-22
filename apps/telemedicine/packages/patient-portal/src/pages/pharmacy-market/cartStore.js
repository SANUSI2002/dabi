import { getMarketplacePharmacies } from "./marketplaceData";

const CART_KEY = "sabi-cart";
const ADDRESS_KEY = "sabi-addresses";
const ORDERS_KEY = "sabi-orders";
const EXTRA_PRODUCTS_KEY = "sabi-cart-extra-products";
const CART_UPDATED_EVENT = "sabi-cart-updated";

// ---------------- Cart ----------------
// Shape: { [pharmacyId]: { [productId]: qty } }
// Kept per-pharmacy since delivery/checkout happens one pharmacy at a
// time (matches how the storefront and quotes flow are already scoped).

export function getCart() {
  try {
    const raw = window.localStorage.getItem(CART_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* fall through */
  }
  return {};
}

function persistCart(cart) {
  try {
    window.localStorage.setItem(CART_KEY, JSON.stringify(cart));
  } catch {
    /* ignore write failures */
  }
  window.dispatchEvent(new Event(CART_UPDATED_EVENT));
  return cart;
}

export function subscribeToCart(listener) {
  window.addEventListener(CART_UPDATED_EVENT, listener);
  return () => window.removeEventListener(CART_UPDATED_EVENT, listener);
}

export function getCartForPharmacy(pharmacyId) {
  return getCart()[pharmacyId] || {};
}

export function getCartCount() {
  const cart = getCart();
  return Object.values(cart).reduce(
    (sum, items) => sum + Object.values(items).reduce((s, qty) => s + qty, 0),
    0
  );
}

export function getCartSummary() {
  const cart = getCart();
  return Object.entries(cart).reduce((summary, [pharmacyId, items]) => {
    Object.entries(items).forEach(([productId, qty]) => {
      const product = findProduct(pharmacyId, productId);
      if (!product) return;
      summary.itemCount += qty;
      summary.total += product.price * qty;
    });
    return summary;
  }, { itemCount: 0, total: 0 });
}

export function addToCart(pharmacyId, productId, qty = 1) {
  const cart = getCart();
  const pharmacyCart = { ...(cart[pharmacyId] || {}) };
  pharmacyCart[productId] = (pharmacyCart[productId] || 0) + qty;
  const next = { ...cart, [pharmacyId]: pharmacyCart };
  return persistCart(next);
}

export function setCartQty(pharmacyId, productId, qty) {
  const cart = getCart();
  const pharmacyCart = { ...(cart[pharmacyId] || {}) };
  if (qty <= 0) {
    delete pharmacyCart[productId];
  } else {
    pharmacyCart[productId] = qty;
  }
  const next = { ...cart, [pharmacyId]: pharmacyCart };
  if (Object.keys(pharmacyCart).length === 0) delete next[pharmacyId];
  return persistCart(next);
}

export function removeFromCart(pharmacyId, productId) {
  return setCartQty(pharmacyId, productId, 0);
}

export function clearPharmacyCart(pharmacyId) {
  const cart = getCart();
  const next = { ...cart };
  delete next[pharmacyId];
  return persistCart(next);
}

export function clearCart() {
  return persistCart({});
}

// ---------------- Extra (non-catalog) products ----------------
// Prescription refills, AI-matched uploads, and emergency-condition
// medications aren't part of the static marketplaceData catalog, but
// still need to behave like any other cart line (show up in Cart /
// Checkout with a name, price, photo). Registering them here lets
// CartPage/CheckoutPage resolve a productId to real details via
// findProduct() below, without changing the cart's storage shape.

function getExtraProducts() {
  try {
    const raw = window.localStorage.getItem(EXTRA_PRODUCTS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* fall through */
  }
  return {};
}

function persistExtraProducts(data) {
  try {
    window.localStorage.setItem(EXTRA_PRODUCTS_KEY, JSON.stringify(data));
  } catch {
    /* ignore */
  }
  return data;
}

export function registerExtraProduct(pharmacyId, product) {
  const data = getExtraProducts();
  const forPharmacy = { ...(data[pharmacyId] || {}), [product.id]: product };
  return persistExtraProducts({ ...data, [pharmacyId]: forPharmacy });
}

export function findProduct(pharmacyId, productId) {
  const pharmacy = getMarketplacePharmacies().find((p) => p.id === pharmacyId);
  const catalogMatch = pharmacy?.products.find((p) => p.id === productId);
  if (catalogMatch) return catalogMatch;
  return getExtraProducts()[pharmacyId]?.[productId] || null;
}

// ---------------- Extra (non-catalog) pharmacies ----------------
// Items added to the cart from a pharmacy quote (SelectPharmacyPage /
// PharmacyQuotesPage) come from a pharmacy that isn't necessarily in the
// static marketplace catalog. Registering a lightweight { id, name }
// record here lets Cart/Checkout resolve the pharmacy's name for order
// grouping without requiring every quoting pharmacy to also be a full
// marketplace storefront.

const EXTRA_PHARMACIES_KEY = "sabi-cart-extra-pharmacies";

function getExtraPharmacies() {
  try {
    const raw = window.localStorage.getItem(EXTRA_PHARMACIES_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* fall through */
  }
  return {};
}

function persistExtraPharmacies(data) {
  try {
    window.localStorage.setItem(EXTRA_PHARMACIES_KEY, JSON.stringify(data));
  } catch {
    /* ignore */
  }
  return data;
}

export function registerExtraPharmacy(pharmacy) {
  const data = getExtraPharmacies();
  return persistExtraPharmacies({ ...data, [pharmacy.id]: pharmacy });
}

export function findPharmacy(pharmacyId) {
  return getMarketplacePharmacies().find((p) => p.id === pharmacyId) || getExtraPharmacies()[pharmacyId] || null;
}

// Adds a one-off item (refill pick, AI-matched upload, emergency med)
// to the cart, registering it as an extra product first so it resolves
// correctly everywhere the cart is read.
export function addPrescriptionItemToCart(pharmacyId, product, qty = 1) {
  registerExtraProduct(pharmacyId, product);
  return addToCart(pharmacyId, product.id, qty);
}

// Adds the items a patient selected out of a pharmacy's quote invoice
// (partial selection is allowed — see PharmacyInvoice) into the shared
// cart, so orders from multiple pharmacies for the same prescription can
// be combined into one checkout (per the Shopping Cart PRD section).
export function addQuoteItemsToCart(quote, items, meta = {}) {
  registerExtraPharmacy({ id: quote.id, name: quote.name });
  items.forEach((item) => {
    const productId = `rx-${quote.id}-${item.id}`;
    registerExtraProduct(quote.id, {
      id: productId,
      name: item.name,
      price: item.unitPrice,
      category: item.dosage,
      photo: "https://images.unsplash.com/photo-1550572017-edd951b55104?w=400&q=80",
      source: "prescription",
      deliveryMode: meta.deliveryMode,
    });
    addToCart(quote.id, productId, item.quantity || 1);
  });
}

// ---------------- Saved delivery addresses ----------------

const SEED_ADDRESSES = [
  {
    id: "addr-home",
    label: "Home",
    recipient: "John Doe",
    phone: "+234 801 234 5678",
    address: "14 Admiralty Way, Lekki Phase 1, Lagos",
    lat: 6.4474,
    lng: 3.4726,
    isDefault: true,
  },
  {
    id: "addr-office",
    label: "Office",
    recipient: "John Doe",
    phone: "+234 801 234 5678",
    address: "9th Floor, Cocoa House, Dugbe, Ibadan",
    lat: 7.3775,
    lng: 3.8961,
    isDefault: false,
  },
];

export function getAddresses() {
  try {
    const raw = window.localStorage.getItem(ADDRESS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* fall through */
  }
  return SEED_ADDRESSES;
}

function persistAddresses(addresses) {
  try {
    window.localStorage.setItem(ADDRESS_KEY, JSON.stringify(addresses));
  } catch {
    /* ignore */
  }
  return addresses;
}

export function addAddress(address) {
  const addresses = getAddresses();
  const withId = { id: `addr-${Date.now()}`, isDefault: addresses.length === 0, ...address };
  const next = [...addresses, withId];
  persistAddresses(next);
  return withId;
}

export function setDefaultAddress(id) {
  const next = getAddresses().map((a) => ({ ...a, isDefault: a.id === id }));
  persistAddresses(next);
  return next;
}

// ---------------- Orders ----------------

export function getOrders() {
  try {
    const raw = window.localStorage.getItem(ORDERS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* fall through */
  }
  return [];
}

// A representative past order so "Repeat Last Order" has something to
// show on a fresh install, before the user has ever checked out here.
const SEED_LAST_ORDER = {
  id: "SH-10482913",
  placedAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(),
  status: "Delivered",
  groups: [
    {
      pharmacyId: "sabi-premium",
      pharmacyName: "Sabi Premium Pharmacy",
      items: [
        { productId: "amox", name: "Amoxicillin 500mg", qty: 1, price: 19400 },
        { productId: "multi", name: "Daily Multivitamin+", qty: 2, price: 29450 },
      ],
      subtotal: 78300,
    },
  ],
  itemsTotal: 78300,
  deliveryFee: 1500,
  grandTotal: 79800,
  address: null,
  paymentMethod: "card",
};

export function getLastOrder() {
  const orders = getOrders();
  return orders[0] || SEED_LAST_ORDER;
}

// A single checkout can bundle items from multiple pharmacies (per the
// Shopping Cart PRD section — one checkout, routed to each pharmacy's
// own order). Each group gets its own status so it can still be tracked
// independently (see delivery-tracking/DeliveryListPage.jsx).
export function placeOrder(order) {
  const groups = order.groups || [];
  if (!groups.length) {
    throw new Error("An order needs at least one pharmacy group.");
  }
  if (groups.some((group) => !group.pharmacyId)) {
    throw new Error("Every order group needs a pharmacyId.");
  }

  const orders = getOrders();
  const id = `SH-${Date.now().toString().slice(-8)}`;
  const withId = {
    id,
    placedAt: new Date().toISOString(),
    // "Submitted", not "Confirmed" or "Paid" — this is a local request record only.
    // No payment provider or pharmacy has actually processed or confirmed it yet.
    status: "Submitted",
    ...order,
    groups: groups.map((group) => ({ status: "Awaiting Confirmation", ...group })),
  };
  try {
    window.localStorage.setItem(ORDERS_KEY, JSON.stringify([withId, ...orders]));
  } catch {
    /* ignore */
  }
  return withId;
}

export function getOrder(id) {
  return getOrders().find((o) => o.id === id) || null;
}
