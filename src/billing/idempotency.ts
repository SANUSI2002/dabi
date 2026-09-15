/** Stable, bounded command key suitable for retries and server idempotency indexes. */
export async function stableBillingIdempotencyKey(operation: string, scope: string) {
  const bytes = new TextEncoder().encode(`${operation}:${scope}`);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  const fingerprint = Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join("");
  return `${operation}:${fingerprint}`;
}
