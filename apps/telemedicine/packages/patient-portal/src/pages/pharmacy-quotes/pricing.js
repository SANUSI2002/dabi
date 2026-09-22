// Deterministic pseudo-random pricing so each pharmacy quotes a slightly
// different (but stable across renders) unit price for the same drug —
// real per-pharmacy variation is what powers the "Smart Savings Indicator"
// and "Estimated Total Savings" future enhancements, without needing a
// hand-maintained price table for every drug x pharmacy combination.

function hashString(value) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function quantityFromLabel(label) {
  return Number.parseInt(label, 10) || 1;
}

export function unitPriceFor(pharmacyId, itemName) {
  const base = 150 + (hashString(itemName) % 350); // ~N150 - N500 base
  const variance = (hashString(pharmacyId + itemName) % 60) - 25; // +/- spread
  return Math.max(80, Math.round((base + variance) / 5) * 5);
}

// Smart Savings Indicator / Estimated Total Savings — compares buying the
// whole prescription from a single (cheapest) pharmacy against buying each
// drug from whichever responding pharmacy quotes it cheapest.
export function computeSavings(items, quotes) {
  const available = (quotes || []).filter((q) => q.availability !== "Out of Stock");
  if (!available.length || !items?.length) return null;

  const perPharmacyTotal = available.map((q) => ({
    id: q.id,
    name: q.name,
    total: items.reduce((sum, item) => sum + unitPriceFor(q.id, item.name) * quantityFromLabel(item.qty), 0),
  }));

  const singleBest = perPharmacyTotal.reduce((min, p) => (p.total < min.total ? p : min));

  const splitTotal = items.reduce((sum, item) => {
    const cheapestUnit = Math.min(...available.map((q) => unitPriceFor(q.id, item.name)));
    return sum + cheapestUnit * quantityFromLabel(item.qty);
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
export function cheapestPharmacyForItem(itemName, quotes) {
  const available = (quotes || []).filter((q) => q.availability !== "Out of Stock");
  if (!available.length) return null;
  return available.reduce((min, q) => {
    const price = unitPriceFor(q.id, itemName);
    return !min || price < min.price ? { id: q.id, name: q.name, price } : min;
  }, null);
}
