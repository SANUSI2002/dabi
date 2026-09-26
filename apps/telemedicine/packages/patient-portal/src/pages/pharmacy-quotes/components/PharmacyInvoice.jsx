import React, { useMemo, useState } from "react";
import { Printer, ReceiptText, Sparkles, Truck, Store, MessageCircle } from "lucide-react";
import { formatNaira } from "../../../utils/currency";
import { lineFor, cheapestPharmacyForItem } from "../pricing";
import { getCurrentUser } from "../../../utils/sabiIdentity";

/* Standard, reusable invoice surface for pharmacy quote responses.
 * Supports partial medicine selection (patients don't have to buy
 * everything a pharmacy quoted), a pickup/delivery toggle, and adds
 * selected items straight into the shared cart so orders can be split
 * across multiple pharmacies in one checkout. */
export function PharmacyInvoice({ detail, quote, allQuotes, expired, onAddToCart, onOpenChat }) {
  const unavailable = quote?.availability === "Out of Stock";

  const unavailableIds = useMemo(() => new Set(quote?.unavailableItemIds || []), [quote]);

  const items = useMemo(
    () =>
      detail.items.map((item) => {
        const line = lineFor(quote, item);
        return {
          ...item,
          quantity: line?.quantity || item.quantity || 1,
          unitPrice: line?.unitPrice ?? 0,
          quoteItemId: line?.quoteItemId,
          prescriptionId: detail.id,
          inStock: !unavailableIds.has(item.id),
        };
      }),
    [detail.items, detail.id, quote, unavailableIds]
  );

  const availableItems = items.filter((item) => item.inStock);
  const unavailableItems = items.filter((item) => !item.inStock);
  const noneAvailable = !unavailable && availableItems.length === 0;
  const locked = unavailable || noneAvailable || expired;

  const [selected, setSelected] = useState(() => new Set(availableItems.map((i) => i.id)));
  const [deliveryMode, setDeliveryMode] = useState(quote.deliveryAvailable === false ? "pickup" : "delivery");

  const toggleItem = (id) => {
    if (locked) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedItems = availableItems.filter((item) => selected.has(item.id));
  const subtotal = selectedItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const vat = 0;
  const serviceCharge = null;
  const deliveryFee = deliveryMode === "pickup" || !selectedItems.length ? 0 : null;
  const grandTotal = subtotal;
  const atCheckout = "Calculated at checkout";

  const handleAddToCart = () => {
    if (locked || !selectedItems.length) return;
    onAddToCart?.({
      pharmacyId: quote.id,
      pharmacyName: quote.name,
      items: selectedItems,
      deliveryMode,
      deliveryFee,
      serviceCharge,
      vat,
    });
  };

  return (
    <section className="sabi-pharmacy-invoice sabi-card" aria-labelledby="pharmacy-invoice-title">
      <div className="sabi-invoice-print-actions">
        {onOpenChat && (
          <button type="button" className="sabi-icon-btn" onClick={onOpenChat} aria-label={`Message ${quote.name}`}>
            <MessageCircle size={17} strokeWidth={2} />
          </button>
        )}
        <button type="button" className="sabi-icon-btn" onClick={() => window.print()} aria-label="Print invoice">
          <Printer size={17} strokeWidth={2} />
        </button>
      </div>

      <header className="sabi-invoice-header">
        <div className="sabi-invoice-header-icon">
          <ReceiptText size={20} strokeWidth={2} />
        </div>
        <div className="sabi-invoice-header-main">
          <p className="sabi-invoice-eyebrow">Pharmacy Invoice</p>
          <h2 id="pharmacy-invoice-title">{quote.name}</h2>
          <span className="sabi-invoice-status">
            {unavailable ? "Out of stock" : noneAvailable ? "None of your items in stock" : expired ? "Quote expired" : "Quote received"}
          </span>
        </div>
      </header>

      {expired && !unavailable && (
        <p className="sabi-invoice-expired-note">
          This quote has expired. Send the prescription to pharmacies again to get a fresh price.
        </p>
      )}

      {noneAvailable && (
        <p className="sabi-invoice-expired-note">
          {quote.name} responded, but doesn&apos;t currently have any of the medications on this prescription in stock.
        </p>
      )}

      {!locked && (
        <>
          <div className="sabi-invoice-delivery-choice">
            <span className="sabi-invoice-eyebrow">Delivery Choice</span>
            <div className="sabi-invoice-delivery-row">
              <button
                type="button"
                className={deliveryMode === "delivery" ? "active" : ""}
                onClick={() => setDeliveryMode("delivery")}
                disabled={quote.deliveryAvailable === false}
              >
                <Truck size={15} /> Home Delivery
              </button>
              <button
                type="button"
                className={deliveryMode === "pickup" ? "active" : ""}
                onClick={() => setDeliveryMode("pickup")}
                disabled={quote.pickupAvailable === false}
              >
                <Store size={15} /> In-Store Pickup
              </button>
            </div>
          </div>

          <div className="sabi-invoice-items">
            <div className="sabi-invoice-items-head">
              <span>
                Select medications to buy from {quote.name}
                {unavailableItems.length > 0 && ` (${availableItems.length} of ${items.length} available)`}
              </span>
              <span>Amount</span>
            </div>
            {availableItems.map((item) => {
              const best = allQuotes?.length > 1 ? cheapestPharmacyForItem(item, allQuotes) : null;
              const isBestHere = best?.id === quote.id;
              return (
                <label className="sabi-invoice-item-row sabi-invoice-item-row-selectable" key={item.id}>
                  <input
                    type="checkbox"
                    checked={selected.has(item.id)}
                    onChange={() => toggleItem(item.id)}
                  />
                  <div className="sabi-invoice-item-main">
                    <strong>
                      {item.name}
                      {isBestHere && (
                        <span className="sabi-invoice-best-tag">
                          <Sparkles size={11} /> Best Price
                        </span>
                      )}
                    </strong>
                    <span>{item.dosage} · Qty {item.quantity} · {formatNaira(item.unitPrice)} each</span>
                  </div>
                  <div className="sabi-invoice-item-amount">{formatNaira(item.unitPrice * item.quantity)}</div>
                </label>
              );
            })}
          </div>
        </>
      )}

      {unavailableItems.length > 0 && (
        <div className="sabi-invoice-items sabi-invoice-items-unavailable">
          <div className="sabi-invoice-items-head">
            <span>Unavailable at {quote.name}</span>
            <span />
          </div>
          {unavailableItems.map((item) => (
            <div className="sabi-invoice-item-row sabi-invoice-item-row-unavailable" key={item.id}>
              <div className="sabi-invoice-item-main">
                <strong>{item.name}</strong>
                <span>{item.dosage} · Qty {item.quantity}</span>
              </div>
              <span className="sabi-invoice-out-of-stock-tag">Out of Stock</span>
            </div>
          ))}
        </div>
      )}

      <div className="sabi-invoice-parties">
        <div>
          <span>Patient name</span>
          <strong>{getCurrentUser()?.fullName || "Sabi Health Patient"}</strong>
        </div>
        <div>
          <span>Prescription number</span>
          <strong>{detail.refId}</strong>
        </div>
      </div>

      {!locked && (
        <>
          <dl className="sabi-invoice-totals">
            <div>
              <dt>Subtotal ({selectedItems.length} of {availableItems.length} available item{availableItems.length === 1 ? "" : "s"})</dt>
              <dd>{formatNaira(subtotal)}</dd>
            </div>
            <div>
              <dt>VAT</dt>
              <dd>{vat ? formatNaira(vat) : "Included in price"}</dd>
            </div>
            <div>
              <dt>Service charge</dt>
              <dd>{serviceCharge == null ? atCheckout : formatNaira(serviceCharge)}</dd>
            </div>
            <div>
              <dt>{deliveryMode === "pickup" ? "Delivery fee (pickup)" : "Delivery fee"}</dt>
              <dd>{deliveryFee == null ? atCheckout : formatNaira(deliveryFee)}</dd>
            </div>
            <div className="sabi-invoice-grand-total">
              <dt>Grand total</dt>
              <dd>{formatNaira(grandTotal)}</dd>
            </div>
          </dl>

          <button
            type="button"
            className="sabi-btn-primary sabi-invoice-add-to-cart"
            disabled={!selectedItems.length}
            onClick={handleAddToCart}
          >
            Add {selectedItems.length || ""} Item{selectedItems.length === 1 ? "" : "s"} to Order
          </button>
        </>
      )}
    </section>
  );
}

export default PharmacyInvoice;
