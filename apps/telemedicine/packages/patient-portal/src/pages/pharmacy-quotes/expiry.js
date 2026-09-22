// "Quote Expiry Timer" future enhancement — pharmacy quotations expire a
// configurable period after the prescription was sent out.

export const QUOTE_EXPIRY_HOURS = 24;

export function getExpiryInfo(sentAtIso) {
  if (!sentAtIso) return { expiresAt: null, expired: false, label: null };

  const sentAt = new Date(sentAtIso).getTime();
  const expiresAt = sentAt + QUOTE_EXPIRY_HOURS * 60 * 60 * 1000;
  const remainingMs = expiresAt - Date.now();

  if (remainingMs <= 0) {
    return { expiresAt, expired: true, label: "Expired" };
  }

  const hours = Math.floor(remainingMs / (60 * 60 * 1000));
  const minutes = Math.floor((remainingMs % (60 * 60 * 1000)) / (60 * 1000));
  const label = hours > 0 ? `Expires in ${hours}h ${minutes}m` : `Expires in ${minutes}m`;

  return { expiresAt, expired: false, label };
}
