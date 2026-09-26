// Quote Expiry Timer — each pharmacy quotation expires 24 hours after it was issued.

export const QUOTE_EXPIRY_HOURS = 24;

/** `expiresAtIso` is the soonest quoteExpiresAt among the quotes shown. */
export function getExpiryInfo(expiresAtIso) {
  if (!expiresAtIso) return { expiresAt: null, expired: false, label: null };

  const expiresAt = new Date(expiresAtIso).getTime();
  const remainingMs = expiresAt - Date.now();

  if (remainingMs <= 0) {
    return { expiresAt, expired: true, label: "Expired" };
  }

  const hours = Math.floor(remainingMs / (60 * 60 * 1000));
  const minutes = Math.floor((remainingMs % (60 * 60 * 1000)) / (60 * 1000));
  const label = hours > 0 ? `Expires in ${hours}h ${minutes}m` : `Expires in ${minutes}m`;

  return { expiresAt, expired: false, label };
}
