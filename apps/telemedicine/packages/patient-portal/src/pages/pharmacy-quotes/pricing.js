// Prices come from each pharmacy's quote (see data.js `lines`, keyed by prescription item id).

export function quantityFromLabel(label) {
  return Number.parseInt(label, 10) || 1;
}

export const lineFor = (quote, item) => quote?.lines?.[item.id] || null;

/** This pharmacy's quoted unit price for one prescription item, or null if it didn't quote it. */
export function unitPriceFor(quote, item) {
  return lineFor(quote, item)?.unitPrice ?? null;
}

const availableQuotes = (quotes) => (quotes || []).filter((q) => q.availability !== "Out of Stock");

// Smart Savings Indicator — compares buying the whole prescription from the single cheapest
// pharmacy that has everything against buying each drug wherever it's quoted cheapest.
export function computeSavings(items, quotes) {
  const available = availableQuotes(quotes);
  if (!available.length || !items?.length) return null;

  const complete = available.filter((q) => items.every((item) => lineFor(q, item)?.available));
  if (!complete.length) return null;
  const totals = complete.map((q) => ({ id: q.id, name: q.name, total: items.reduce((sum, item) => sum + lineFor(q, item).lineTotal, 0) }));
  const singleBest = totals.reduce((min, p) => (p.total < min.total ? p : min));

  const splitTotal = items.reduce((sum, item) => {
    const prices = available.map((q) => lineFor(q, item)).filter((line) => line?.available).map((line) => line.lineTotal);
    return sum + Math.min(...prices);
  }, 0);

  return {
    singleBestPharmacy: singleBest.name,
    singleBestTotal: singleBest.total,
    splitTotal,
    savings: Math.max(0, singleBest.total - splitTotal),
  };
}

// Which responding pharmacy quotes the lowest unit price for one drug —
// powers the per-item "Best Price" tag inside the invoice.
export function cheapestPharmacyForItem(item, quotes) {
  return availableQuotes(quotes).reduce((min, q) => {
    const line = lineFor(q, item);
    if (!line?.available) return min;
    return !min || line.unitPrice < min.price ? { id: q.id, name: q.name, price: line.unitPrice } : min;
  }, null);
}
