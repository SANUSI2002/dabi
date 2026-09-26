import React from "react";
import { CheckCircle2, Clock3, Gauge, ReceiptText, Star, Truck } from "lucide-react";
import { formatNaira } from "../../../utils/currency";
import { lineFor } from "../pricing";

function invoiceTotalFor(quote, items) {
  const unavailableIds = new Set(quote.unavailableItemIds || []);
  const available = items.filter((item) => !unavailableIds.has(item.id));
  return available.reduce((sum, item) => sum + (lineFor(quote, item)?.lineTotal || 0), 0);
}

export function QuoteCard({ quote, items, selected, onSelect }) {
  const unavailable = quote.availability === "Out of Stock";
  const unavailableIds = new Set(quote.unavailableItemIds || []);
  const availableCount = items ? items.filter((item) => !unavailableIds.has(item.id)).length : null;
  const total = !unavailable && items ? invoiceTotalFor(quote, items) : null;

  return (
    <article className={`sabi-quote-card sabi-card ${unavailable ? "unavailable" : ""} ${selected ? "selected" : ""}`}>
      <div className="sabi-quote-store-icon">
        {unavailable ? <ReceiptText /> : <span>{quote.name.slice(0, 2)}</span>}
      </div>

      <div className="sabi-quote-content">
        <div className="sabi-quote-store-head">
          <div>
            <h2>
              {quote.name}
              {quote.best && !unavailable && <span className="sabi-quote-best-badge">Best Price</span>}
            </h2>
            <p>
              <Star size={17} fill="currentColor" /> {quote.rating}
              <i />
              {quote.distance}
            </p>
          </div>
          <span className={unavailable ? "out" : "available"}>
            {unavailable ? (
              <>⊘ Out of Stock</>
            ) : (
              <>
                <CheckCircle2 size={15} /> Available
              </>
            )}
          </span>
        </div>

        {unavailable ? (
          <div className="sabi-quote-unavailable">
            <strong>MEDICATION UNAVAILABLE</strong>
            <span>This pharmacy doesn&apos;t have the requested medication in stock right now.</span>
          </div>
        ) : (
          <>
            {items && items.length > 1 && (
              <div className="sabi-quote-fulfillment">
                {availableCount} of {items.length} medications available
                {typeof quote.fulfillmentRate === "number" && (
                  <span className="sabi-quote-fulfillment-score">
                    <Gauge size={13} /> {quote.fulfillmentRate}% fulfillment score
                  </span>
                )}
              </div>
            )}

            <div className="sabi-quote-invoice">
              <div className="sabi-quote-invoice-icon">
                <ReceiptText />
              </div>
              <div>
                <span>TOTAL INVOICE</span>
                <strong>{total != null ? formatNaira(total) : quote.total}</strong>
              </div>
              <button type="button" onClick={() => onSelect(quote)}>
                {selected ? "Invoice Selected" : "Review Invoice"}
              </button>
            </div>
            <p className="sabi-quote-eta">
              {quote.eta.includes("Delivery") ? <Truck size={16} /> : <Clock3 size={16} />}
              {quote.eta}
            </p>
          </>
        )}
      </div>
    </article>
  );
}

export function QuoteList({ quotes, items, selectedId, onSelect }) {
  return (
    <div className="sabi-quote-list">
      {quotes.map((quote) => (
        <QuoteCard key={quote.id} quote={quote} items={items} selected={quote.id === selectedId} onSelect={onSelect} />
      ))}
    </div>
  );
}
